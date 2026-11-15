package com.aurel.hires;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.MediaStore;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Rights-aware, cancellable music download manager.
 * Only Qobuz API responses issued with intent=download may be saved.
 * Streaming access or a playable stream URL is NOT proof of download rights.
 * No DRM decryption, stream capture or proxy-based bypasses.
 */
final class AuthorizedDownloadManager {
    interface Listener { void onState(JSONObject state); }
    private final Context context;
    private final QobuzApi api;
    private final Listener listener;
    private final Handler ui=new Handler(Looper.getMainLooper());
    private final ExecutorService transfers=Executors.newSingleThreadExecutor();
    private final ExecutorService planner=Executors.newSingleThreadExecutor();
    private final ArrayList<Entry> records=new ArrayList<>();
    private final Set<String> known=new HashSet<>();
    private boolean working=false,closed=false,planning=false;
    private long lastPublish=0;
    private String planMessage="";
    private static final int MAX_ITEMS=3000;
    private static final long MAX_AUDIO_BYTES=3_000_000_000L;

    static final class Entry {
        final String id,title,artist,album,albumId;
        String status="queued",error="",uri="",mime="";
        int percent=0;
        long bytes=0,total=0;
        boolean cancel=false;
        Entry(String id,String title,String artist,String album,String albumId){
            this.id=id;this.title=title;this.artist=artist;this.album=album;this.albumId=albumId;
        }
        JSONObject json() throws Exception {
            return new JSONObject().put("id",id).put("title",title).put("artist",artist)
                .put("album",album).put("albumId",albumId).put("status",status)
                .put("error",error).put("percent",percent).put("bytes",bytes)
                .put("total",total).put("mime",mime).put("uri",uri);
        }
    }
    AuthorizedDownloadManager(Context ctx,QobuzApi api,Listener listener){
        this.context=ctx.getApplicationContext();this.api=api;this.listener=listener;
        load();
        notifyState(true);
    }
    private static String name(String v,String fallback){
        String s=(v==null?"":v).replaceAll("[\\p{Cntrl}/\\\\:*?\"<>|]+"," ")
            .replaceAll("\\s+"," ").trim();
        if(s.isEmpty())s=fallback;
        return s.length()>96?s.substring(0,96).trim():s;
    }
    private static String id(String v)throws Exception{
        if(v==null||!v.matches("[0-9]{1,24}"))throw new Exception("Invalid track ID");
        return v;
    }
    private static String getArtist(JSONObject t,JSONObject album){
        JSONObject a=t.optJSONObject("artist");
        if(a==null)a=album==null?null:album.optJSONObject("artist");
        if(a!=null)return a.optString("name","Unknown artist");
        String s=t.optString("artist","");
        return s.isEmpty()?"Unknown artist":s;
    }
    private synchronized boolean enqueue(String trackId,String title,String artist,String album,String albumId)throws Exception{
        if(closed)return false;
        id(trackId);
        if(known.contains(trackId))return false;
        if(records.size()>=MAX_ITEMS)throw new Exception("Download queue is full (3000 tracks)");
        Entry item=new Entry(trackId,name(title,"Track "+trackId),name(artist,"Unknown artist"),
            name(album,"Singles"),albumId==null?"":albumId);
        records.add(item);known.add(trackId);schedule();return true;
    }
    synchronized JSONObject addTrack(JSONObject t)throws Exception{
        String trackId=id(t.optString("id"));
        boolean added=enqueue(trackId,t.optString("title"),t.optString("artist"),
            t.optString("album"),t.optString("albumId"));
        save();notifyState(true);
        return new JSONObject().put("added",added?1:0).put("existing",added?0:1);
    }
    JSONObject addAlbum(String albumId)throws Exception {
        id(albumId);
        synchronized(this){if(planning)throw new Exception("A batch is already being prepared");planning=true;planMessage="Loading album tracks…";}
        notifyState(true);
        planner.execute(()->{
            int added=0;
            try{added=addAlbumTracks(albumId);}
            catch(Exception e){synchronized(this){planMessage="Album preparation failed: "+e.getMessage();}}
            finally{
                synchronized(this){planning=false;if(!planMessage.startsWith("Album preparation failed"))planMessage=added+" tracks added";}
                notifyState(true);
            }
        });
        return new JSONObject().put("preparing",true);
    }
    private int addAlbumTracks(String albumId)throws Exception{
        JSONObject album=api.catalog("album/get",new JSONObject().put("album_id",albumId)
            .put("limit",100).put("offset",0));
        JSONObject group=album.optJSONObject("tracks");
        JSONArray songs=group==null?album.optJSONArray("tracks"):group.optJSONArray("items");
        if(songs==null)throw new Exception("Qobuz returned no album track list");
        int added=0;
        int offset=0;
        int total=group==null?songs.length():Math.min(500,Math.max(songs.length(),group.optInt("total",songs.length())));
        String artist=getArtist(new JSONObject(),album);
        while(true){
            for(int i=0;i<songs.length();i++){
                JSONObject t=songs.optJSONObject(i);if(t==null)continue;
                String trackId=t.optString("id","");
                if(!trackId.matches("[0-9]{1,24}"))continue;
                if(enqueue(trackId,t.optString("title"),getArtist(t,album),
                    album.optString("title","Singles"),albumId))added++;
            }
            offset+=songs.length();
            if(songs.length()==0||offset>=total||offset>=500)break;
            album=api.catalog("album/get",new JSONObject().put("album_id",albumId)
                .put("limit",100).put("offset",offset));
            group=album.optJSONObject("tracks");
            songs=group==null?album.optJSONArray("tracks"):group.optJSONArray("items");
            if(songs==null)break;
        }
        synchronized(this){save();}
        notifyState(true);
        return added;
    }
    JSONObject addDiscography(String artistId,String mode)throws Exception{
        id(artistId);
        final String selected=mode.equals("albums")?"albums":mode.equals("singles")?"singles":"all";
        synchronized(this){if(planning)throw new Exception("A batch is already being prepared");planning=true;planMessage="Loading artist discography…";}
        notifyState(true);
        planner.execute(()->{
            int added=0,releases=0;
            try {
                Set<String> seenAlbums=new HashSet<>();
                for(int offset=0;offset<150;offset+=50){
                    synchronized(AuthorizedDownloadManager.this){if(closed)break;}
                    JSONObject result;
                    JSONArray albums;
                    JSONObject container;
                    try{
                        result=api.catalog("artist/getReleasesList",new JSONObject()
                            .put("artist_id",artistId).put("release_type",selected)
                            .put("limit",50).put("offset",offset));
                        container=result.optJSONObject("albums");
                        if(container==null)container=result.optJSONObject("releases");
                        albums=container!=null?container.optJSONArray("items"):result.optJSONArray("items");
                    }catch(Exception unavailable){
                        result=api.catalog("artist/get",new JSONObject().put("artist_id",artistId)
                            .put("extra","albums").put("limit",50).put("offset",offset));
                        container=result.optJSONObject("albums");
                        albums=container==null?null:container.optJSONArray("items");
                    }
                    if(albums==null||albums.length()==0)break;
                    for(int i=0;i<albums.length();i++){
                        JSONObject candidate=albums.optJSONObject(i);if(candidate==null)continue;
                        JSONObject nested=candidate.optJSONObject("album");
                        JSONObject album=nested!=null?nested:candidate;
                        String albumId=album.optString("id","");
                        if(!albumId.matches("[0-9]{1,24}")||!seenAlbums.add(albumId))continue;
                        String type=album.optString("release_type",album.optString("type","")).toLowerCase(Locale.ROOT);
                        if(selected.equals("albums")&&(type.equals("single")||type.equals("ep")))continue;
                        if(selected.equals("singles")&&type.equals("album"))continue;
                        releases++;
                        try{added+=addAlbumTracks(albumId);}
                        catch(Exception ignored){ /* Partial catalogues must not abort the entire batch. */ }
                        synchronized(AuthorizedDownloadManager.this){planMessage="Processing discography: "+releases+" releases · "+added+" queued";}
                        notifyState(false);
                    }
                    if(albums.length()<50)break;
                }
            }catch(Exception e){
                synchronized(this){planMessage="Discography partly loaded: "+e.getMessage();}
            }finally{
                synchronized(this){planning=false;planMessage=releases+" releases processed · "+added+" tracks queued";}
                notifyState(true);
            }
        });
        return new JSONObject().put("preparing",true);
    }
    synchronized JSONObject snapshot(){
        JSONObject state=new JSONObject();
        try{
            JSONArray entries=new JSONArray();
            int queued=0,done=0,failed=0,running=0;
            int first=Math.max(0,records.size()-150);
            for(int i=records.size()-1;i>=first;i--)entries.put(records.get(i).json());
            for(Entry e:records){
                switch(e.status){case "queued":queued++;break;case "done":done++;break;
                    case "failed":failed++;break;case "running":running++;break;}
            }
            state.put("items",entries).put("queued",queued).put("done",done)
                .put("failed",failed).put("running",running).put("total",records.size())
                .put("planning",planning).put("planMessage",planMessage);
        }catch(Exception ignored){}
        return state;
    }
    synchronized JSONObject cancel(String trackId)throws Exception{
        for(Entry e:records)if(e.id.equals(id(trackId))){
            e.cancel=true;
            if(e.status.equals("queued"))e.status="cancelled";
            save();notifyState(true);
            return new JSONObject().put("cancelled",true);
        }
        return new JSONObject().put("cancelled",false);
    }
    synchronized JSONObject retry(String trackId)throws Exception{
        for(Entry e:records)if(e.id.equals(id(trackId))&&
            (e.status.equals("failed")||e.status.equals("cancelled"))){
            e.cancel=false;e.error="";e.percent=0;e.bytes=0;e.total=0;e.status="queued";
            save();schedule();notifyState(true);
            return new JSONObject().put("retried",true);
        }
        return new JSONObject().put("retried",false);
    }
    synchronized JSONObject clearHistory(){
        records.removeIf(e->e.status.equals("done")||e.status.equals("cancelled")||e.status.equals("failed"));
        known.clear();for(Entry e:records)known.add(e.id);
        save();notifyState(true);
        return snapshot();
    }
    synchronized String fileUri(String trackId)throws Exception{
        for(Entry e:records)if(e.id.equals(id(trackId))&&e.status.equals("done"))return e.uri;
        throw new Exception("No saved file for this track");
    }
    private synchronized void schedule(){
        if(working||closed)return;
        working=true;
        transfers.execute(()->{
            while(true){
                Entry next=null;
                synchronized(AuthorizedDownloadManager.this){
                    if(closed){working=false;return;}
                    for(Entry e:records)if(e.status.equals("queued")){next=e;break;}
                    if(next==null){working=false;return;}
                    next.status="running";
                }
                notifyState(true);
                try{
                    saveAudio(next);
                    if(next.cancel){next.status="cancelled";next.error="Cancelled";}
                    else{next.status="done";next.percent=100;}
                }
                catch(Exception ex){next.status=next.cancel?"cancelled":"failed";next.error=ex.getMessage()==null?"Download failed":ex.getMessage();}
                synchronized(AuthorizedDownloadManager.this){save();}
                notifyState(true);
            }
        });
    }
    private void saveAudio(Entry entry)throws Exception{
        // This method never asks for a streaming URL or bypasses access control.
        JSONObject info=api.purchasedFileInfo(entry.id,quality());
        String raw=info.optString("url","");
        if(!raw.startsWith("https://"))throw new Exception("No authorized HTTPS file URL");
        String mime=info.optString("mime_type","").toLowerCase(Locale.ROOT);
        if(mime.contains("flac")){entry.mime="audio/flac";}
        else if(mime.contains("mpeg")||info.optInt("format_id")==5){entry.mime="audio/mpeg";}
        else{entry.mime="audio/flac";}
        String ext=entry.mime.equals("audio/mpeg")?".mp3":".flac";
        String base=name(entry.title,"Track")+" - "+entry.id+ext;
        String relative=Environment.DIRECTORY_MUSIC+"/AUREL/"+name(entry.artist,"Artist")+
            "/"+name(entry.album,"Album")+"/";
        ContentResolver resolver=context.getContentResolver();
        Uri target=null;
        File local=null;
        HttpURLConnection connection=null;
        OutputStream out=null;
        try{
            if(Build.VERSION.SDK_INT>=29){
                ContentValues values=new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME,base);
                values.put(MediaStore.MediaColumns.MIME_TYPE,entry.mime);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH,relative);
                values.put(MediaStore.MediaColumns.IS_PENDING,1);
                values.put(MediaStore.Audio.Media.TITLE,entry.title);
                values.put(MediaStore.Audio.Media.ARTIST,entry.artist);
                values.put(MediaStore.Audio.Media.ALBUM,entry.album);
                target=resolver.insert(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,values);
                if(target==null)throw new Exception("Cannot create destination in Music/AUREL");
                out=resolver.openOutputStream(target,"w");
            }else{
                File root=context.getExternalFilesDir(Environment.DIRECTORY_MUSIC);
                if(root==null)throw new Exception("External music storage unavailable");
                File folder=new File(new File(new File(root,"AUREL"),name(entry.artist,"Artist")),name(entry.album,"Album"));
                if(!folder.isDirectory()&&!folder.mkdirs())throw new Exception("Cannot create music folder");
                local=new File(folder,base);
                out=new FileOutputStream(local);
            }
            if(out==null)throw new Exception("Cannot write to destination");
            URL url=new URL(raw);
            for(int redirects=0;redirects<=4;redirects++){
                if(!"https".equalsIgnoreCase(url.getProtocol()))throw new Exception("Only HTTPS file downloads are supported");
                String host=url.getHost().toLowerCase(Locale.ROOT);
                if(host.equals("localhost")||host.endsWith(".local")||host.startsWith("127.")||
                   host.equals("0.0.0.0")||host.startsWith("10.")||host.startsWith("192.168."))
                    throw new Exception("Unsafe destination host");
                connection=(HttpURLConnection)url.openConnection();
                connection.setConnectTimeout(15000);connection.setReadTimeout(30000);
                connection.setInstanceFollowRedirects(false);
                connection.setRequestProperty("Accept","audio/*,application/octet-stream");
                connection.setRequestProperty("User-Agent","AurelHiRes/0.7 Android");
                int code=connection.getResponseCode();
                if(code>=300&&code<400){
                    String redirect=connection.getHeaderField("Location");
                    connection.disconnect();connection=null;
                    if(redirect==null)throw new Exception("Missing download redirect");
                    url=new URL(url,redirect);continue;
                }
                if(code!=200)throw new Exception("Download HTTP "+code+" (check purchased access)");
                break;
            }
            if(connection==null)throw new Exception("Download URL redirected too many times");
            long total=connection.getContentLengthLong();
            if(total>MAX_AUDIO_BYTES)throw new Exception("File exceeds 3 GB safety limit");
            entry.total=Math.max(0,total);
            String returnedType=connection.getContentType();
            if(returnedType!=null&&(returnedType.contains("text/html")||returnedType.contains("application/json")))
                throw new Exception("Audio file was not returned");
            try(InputStream in=connection.getInputStream()){
                byte[] buffer=new byte[65536];int count;long transferred=0;
                while((count=in.read(buffer))!=-1){
                    if(entry.cancel||closed)throw new Exception("Cancelled");
                    out.write(buffer,0,count);transferred+=count;
                    if(transferred>MAX_AUDIO_BYTES)throw new Exception("File exceeds 3 GB safety limit");
                    entry.bytes=transferred;
                    if(total>0)entry.percent=Math.min(99,(int)(transferred*100/total));
                    notifyState(false);
                }
                if(transferred==0||total>0&&transferred<total)
                    throw new Exception("Incomplete audio file");
            }
            out.flush();
            out.close();out=null;
            if(Build.VERSION.SDK_INT>=29&&target!=null){
                ContentValues ready=new ContentValues();
                ready.put(MediaStore.MediaColumns.IS_PENDING,0);
                resolver.update(target,ready,null,null);
                entry.uri=target.toString();
            }else if(local!=null)entry.uri=Uri.fromFile(local).toString();
        }catch(Exception failure){
            if(target!=null)resolver.delete(target,null,null);
            if(local!=null)local.delete();
            throw failure;
        }finally{
            if(out!=null)try{out.close();}catch(Exception ignored){}
            if(connection!=null)connection.disconnect();
        }
    }
    private int quality(){
        String saved=context.getSharedPreferences("aurel_download_settings",Context.MODE_PRIVATE)
            .getString("download_quality","27");
        try{int value=Integer.parseInt(saved);return value==5||value==6||value==7||value==27?value:27;}
        catch(Exception ignored){return 27;}
    }
    JSONObject setQuality(int selected)throws Exception{
        if(selected!=5&&selected!=6&&selected!=7&&selected!=27)
            throw new Exception("Invalid quality");
        context.getSharedPreferences("aurel_download_settings",Context.MODE_PRIVATE).edit()
            .putString("download_quality",Integer.toString(selected)).apply();
        return new JSONObject().put("quality",selected);
    }
    JSONObject settings()throws Exception {return new JSONObject().put("quality",quality());}
    private synchronized void save(){
        try{
            JSONArray all=new JSONArray();for(Entry e:records)all.put(e.json());
            context.getSharedPreferences("aurel_download_history",Context.MODE_PRIVATE).edit()
                .putString("entries",all.toString()).apply();
        }catch(Exception ignored){}
    }
    private synchronized void load(){
        try{
            String old=context.getSharedPreferences("aurel_download_history",Context.MODE_PRIVATE)
                .getString("entries","[]");
            JSONArray stored=new JSONArray(old);
            for(int i=0;i<stored.length()&&records.size()<MAX_ITEMS;i++){
                JSONObject o=stored.optJSONObject(i);if(o==null)continue;
                String trackId=o.optString("id","");
                if(!trackId.matches("[0-9]{1,24}")||!known.add(trackId))continue;
                Entry e=new Entry(trackId,o.optString("title"),o.optString("artist"),
                    o.optString("album"),o.optString("albumId"));
                e.status=o.optString("status","failed");
                if(e.status.equals("queued")||e.status.equals("running")){
                    e.status="failed";e.error="Interrupted; tap Retry";
                }else e.error=o.optString("error","");
                e.uri=o.optString("uri","");
                e.mime=o.optString("mime","");
                e.percent=o.optInt("percent",0);
                e.bytes=o.optLong("bytes",0);
                e.total=o.optLong("total",0);
                records.add(e);
            }
        }catch(Exception ignored){}
    }
    private synchronized void notifyState(boolean force){
        long now=SystemClock.elapsedRealtime();
        if(!force&&now-lastPublish<600)return;
        lastPublish=now;
        JSONObject payload=snapshot();
        ui.post(()->listener.onState(payload));
    }
    synchronized void close(){
        closed=true;
        for(Entry e:records)if(e.status.equals("running")||e.status.equals("queued"))e.cancel=true;
        transfers.shutdownNow();planner.shutdownNow();save();
    }
}
