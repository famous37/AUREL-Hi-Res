package com.aurel.hires;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.AtomicFile;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Iterator;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

/**
 * Local-only library transfer. Never writes to Qobuz favourites/playlists,
 * changes auth state, caches audio URLs or includes credentials in JSON.
 * JSON validation and Android AtomicFile protect the existing local library.
 */
final class AurelLibraryTransfer {
    static final int REQUEST_EXPORT=4861, REQUEST_IMPORT=4862;
    static final String FORMAT="aurel-library-transfer-v1";
    private static final int MAX_BYTES=12*1024*1024;
    private static final int PAGE_SIZE=100, MAX_FAVOURITES=10000,
        MAX_PLAYLISTS=300, MAX_PLAYLIST_TRACKS=1500;
    private static final String[] TYPES={"artists","albums","tracks","playlists"};
    private static final Set<String> TYPE_SET=new HashSet<>(Arrays.asList(TYPES));
    private static final Set<String> ROOT_KEYS=new HashSet<>(
        Arrays.asList("format","createdAt","source","data"));
    private static final Set<String> TRACK_KEYS=new HashSet<>(
        Arrays.asList("id","title","artist","albumId","albumTitle","duration"));
    private static final Set<String> ALBUM_KEYS=new HashSet<>(
        Arrays.asList("id","title","artist"));
    private static final Set<String> ARTIST_KEYS=new HashSet<>(
        Arrays.asList("id","name"));
    private static final Set<String> PLAYLIST_KEYS=new HashSet<>(
        Arrays.asList("id","name","tracks"));
    private final Activity activity;
    private final QobuzApi api;
    private final SecureStore secure;
    private final Consumer<JSONObject> callback;
    private final AtomicFile libraryFile;
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private final AtomicBoolean cancel=new AtomicBoolean(false);
    private boolean busy=false;
    private String stage="idle", message="";
    private int processed=0, expected=0;
    private JSONObject lastCounts=new JSONObject();
    private String importMode="merge";

    AurelLibraryTransfer(Activity activity,QobuzApi api,SecureStore secure,
        Consumer<JSONObject> callback){
        this.activity=activity;
        this.api=api;
        this.secure=secure;
        this.callback=callback;
        libraryFile=new AtomicFile(new File(activity.getFilesDir(),"aurel_library_v1.json"));
        try{lastCounts=count(readData());}catch(Exception ignored){}
    }
    private static String text(Object value,int max){
        if(value==null||value==JSONObject.NULL)return "";
        // Never stringify nested objects into metadata fields; that could
        // accidentally preserve secrets in a hostile or malformed JSON file.
        if(!(value instanceof String)&&!(value instanceof Number))return "";
        String s=String.valueOf(value).replaceAll("[\\p{Cntrl}]"," ").trim();
        return s.substring(0,Math.min(max,s.length()));
    }
    private static String string(JSONObject data,String key,int max){
        return data==null?"":text(data.opt(key),max);
    }
    private static void keys(JSONObject json,Set<String> allowed)throws Exception{
        Iterator<String> it=json.keys();
        while(it.hasNext())if(!allowed.contains(it.next()))
            throw new Exception("The library file contains unsupported fields");
    }
    private static boolean isLocalId(String id){
        // Name-only screenshots cannot provide real Qobuz IDs. Accept only
        // namespaced, deterministic offline IDs; never send them to the API.
        return id!=null && id.matches("local_[0-9a-f]{32}");
    }
    private static boolean validId(String id,String type){
        if(isLocalId(id))return true;
        if(type.equals("artists")||type.equals("tracks"))
            return id.matches("[0-9]{1,24}");
        return id.matches("[a-zA-Z0-9_-]{1,96}");
    }
    private static JSONObject unwrap(JSONObject item,String type){
        JSONObject nested=item.optJSONObject(
            type.equals("artists")?"artist":type.equals("albums")?"album":
            type.equals("tracks")?"track":"playlist");
        return nested==null?item:nested;
    }
    private static String artistName(JSONObject obj){
        JSONObject a=obj.optJSONObject("artist");
        if(a==null)a=obj.optJSONObject("performer");
        return a!=null?string(a,"name",180):string(obj,"artist",180);
    }
    private static JSONObject normalize(JSONObject item,String type,boolean strict)
        throws Exception{
        if(item==null)throw new Exception("Invalid entry in imported library");
        if(strict){
            keys(item,type.equals("artists")?ARTIST_KEYS:
                type.equals("albums")?ALBUM_KEYS:
                type.equals("tracks")?TRACK_KEYS:PLAYLIST_KEYS);
            for(String name:(type.equals("artists")?new String[]{"id","name"}:
                type.equals("albums")?new String[]{"id","title","artist"}:
                type.equals("tracks")?new String[]{
                    "id","title","artist","albumId","albumTitle"}:
                    new String[]{"id","name"})){
                Object value=item.opt(name);
                if(value!=null&&value!=JSONObject.NULL&&!(value instanceof String))
                    throw new Exception("Invalid text field in "+type+" JSON");
            }
            if(type.equals("tracks")&&item.has("duration")&&
                !(item.opt("duration") instanceof Number))
                throw new Exception("Invalid track duration");
        }
        JSONObject src=strict?item:unwrap(item,type);
        String id=string(src,"id",96);
        if(!validId(id,type))throw new Exception("Invalid "+type+" identifier");
        JSONObject out=new JSONObject().put("id",id);
        // These local records deliberately have no Qobuz entitlement or URL.
        // Their public metadata can be viewed/exported until they are matched
        // using actual provider identifiers from an authorized account.
        if(type.equals("artists")){
            out.put("name",string(src,"name",180));
        }else if(type.equals("albums")){
            out.put("title",string(src,"title",180));
            out.put("artist",strict?string(src,"artist",180):artistName(src));
        }else if(type.equals("tracks")){
            JSONObject album=src.optJSONObject("album");
            String albumId=strict?string(src,"albumId",96):string(album,"id",96);
            String albumTitle=strict?string(src,"albumTitle",180):string(album,"title",180);
            String artist=strict?string(src,"artist",180):artistName(src);
            int duration=src.optInt("duration",0);
            out.put("title",string(src,"title",180))
                .put("artist",artist)
                .put("albumId",validId(albumId,"albums")?albumId:"")
                .put("albumTitle",albumTitle)
                .put("duration",Math.max(0,Math.min(86400,duration)));
        }else{
            out.put("name",string(src,"name",180));
            JSONArray raw=src.optJSONArray("tracks");
            if(strict&&raw==null)throw new Exception("Playlist has no tracks array");
            if(raw!=null){
                if(raw.length()>MAX_PLAYLIST_TRACKS)
                    throw new Exception("Playlist exceeds safe track limit");
                JSONArray rows=new JSONArray();
                for(int i=0;i<raw.length();i++){
                    JSONObject track=raw.optJSONObject(i);
                    if(track==null)throw new Exception("Malformed playlist track");
                    // Duplicate playlist occurrences are intentional and retain
                    // their original positions; global favourites are deduplicated.
                    rows.put(normalize(track,"tracks",strict));
                }
                out.put("tracks",rows);
            }else out.put("tracks",new JSONArray());
        }
        return out;
    }
    private static JSONObject empty()throws Exception{
        JSONObject data=new JSONObject();
        for(String type:TYPES)data.put(type,new JSONArray());
        return new JSONObject().put("format",FORMAT)
            .put("createdAt",new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX",
                Locale.US).format(new Date()))
            .put("source","local-qobuz-metadata")
            .put("data",data);
    }
    private static JSONObject validate(JSONObject json)throws Exception{
        keys(json,ROOT_KEYS);
        if(!FORMAT.equals(json.optString("format")))
            throw new Exception("Unsupported AUREL library transfer version");
        if(!json.has("createdAt")||!json.has("source"))
            throw new Exception("Incomplete library transfer metadata");
        JSONObject data=json.optJSONObject("data");
        if(data==null)throw new Exception("Library file has no data object");
        keys(data,TYPE_SET);
        JSONObject sanitized=empty();
        JSONObject target=sanitized.getJSONObject("data");
        for(String type:TYPES){
            JSONArray rows=data.optJSONArray(type);
            if(rows==null)throw new Exception("Missing "+type+" collection");
            if(rows.length()>(type.equals("playlists")?MAX_PLAYLISTS:MAX_FAVOURITES))
                throw new Exception(type+" exceeds library safety limit");
            LinkedHashMap<String,JSONObject> seen=new LinkedHashMap<>();
            for(int i=0;i<rows.length();i++){
                JSONObject row=normalize(rows.optJSONObject(i),type,true);
                seen.put(row.getString("id"),row);
            }
            JSONArray clean=new JSONArray();
            for(JSONObject row:seen.values())clean.put(row);
            target.put(type,clean);
        }
        return sanitized;
    }
    private static JSONObject count(JSONObject library){
        JSONObject counts=new JSONObject();
        JSONObject data=library.optJSONObject("data");
        for(String type:TYPES){
            JSONArray rows=data==null?null:data.optJSONArray(type);
            try{counts.put(type,rows==null?0:rows.length());}catch(Exception ignored){}
        }
        return counts;
    }
    private JSONObject readData()throws Exception{
        if(!libraryFile.getBaseFile().exists()&&
           !new File(libraryFile.getBaseFile().getPath()+".bak").exists()&&
           !new File(libraryFile.getBaseFile().getPath()+".new").exists())
            return empty();
        try(InputStream in=libraryFile.openRead();
            ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] buf=new byte[8192];int n;
            while((n=in.read(buf))!=-1){
                if(out.size()+n>MAX_BYTES)throw new Exception("Local library too large");
                out.write(buf,0,n);
            }
            return validate(new JSONObject(out.toString("UTF-8")));
        }
    }
    private void commit(JSONObject library)throws Exception{
        JSONObject valid=validate(library);
        byte[] bytes=valid.toString().getBytes(StandardCharsets.UTF_8);
        if(bytes.length>MAX_BYTES)throw new Exception("Library exceeds 12 MB limit");
        FileOutputStream stream=null;
        try{
            stream=libraryFile.startWrite();
            stream.write(bytes);
            libraryFile.finishWrite(stream);
        }catch(Exception error){
            if(stream!=null)libraryFile.failWrite(stream);
            throw error;
        }
        lastCounts=count(valid);
    }
    private JSONObject snapshot(){
        JSONObject result=new JSONObject();
        try{
            result.put("busy",busy).put("stage",stage).put("message",message)
                .put("done",processed).put("total",expected)
                .put("counts",new JSONObject(lastCounts.toString()));
        }catch(Exception ignored){}
        return result;
    }
    synchronized JSONObject status(){return snapshot();}
    private synchronized void progress(String at,String note,int done,int total){
        stage=at;message=note;processed=done;expected=total;
        callback.accept(snapshot());
    }
    private synchronized void finished(String at,String note){
        busy=false;stage=at;message=note;
        callback.accept(snapshot());
    }
    private synchronized void begin(String at,String note)throws Exception{
        if(busy)throw new Exception("Another library operation is running");
        busy=true;stage=at;message=note;processed=0;expected=0;cancel.set(false);
        callback.accept(snapshot());
    }
    private void ensureAccount(String token)throws Exception {
        if(cancel.get())throw new Exception("Operation cancelled; existing library unchanged");
        String now=secure.get("libraryToken");
        if(now.isEmpty()||!now.equals(token))
            throw new Exception("Qobuz library account changed during transfer");
    }
    private static JSONArray page(JSONObject response,String category)throws Exception{
        JSONObject block=response.optJSONObject(category);
        JSONArray items=block==null?null:block.optJSONArray("items");
        if(items==null)items=response.optJSONArray("items");
        if(items==null)items=response.optJSONArray(category);
        if(items==null)throw new Exception("Qobuz omitted the "+category+" list");
        return items;
    }
    private static int total(JSONObject response,String category,int fallback){
        JSONObject block=response.optJSONObject(category);
        return block!=null?block.optInt("total",fallback):response.optInt("total",fallback);
    }
    private JSONArray fetchPages(String category,String endpoint,String token,
        int limit,String progressName)throws Exception{
        JSONArray result=new JSONArray();
        int offset=0;
        while(true){
            ensureAccount(token);
            JSONObject args=new JSONObject().put("limit",PAGE_SIZE).put("offset",offset);
            if(endpoint.equals("favorite/getUserFavorites"))args.put("type",category);
            JSONObject response=api.library(endpoint,args);
            ensureAccount(token);
            JSONArray items=page(response,category);
            int expectedTotal=total(response,category,offset+items.length());
            if(expectedTotal>limit)throw new Exception(
                "The "+category+" collection exceeds the "+limit+" item safety cap");
            if(items.length()==0&&offset<expectedTotal)
                throw new Exception("Qobuz stopped before the last "+category+" page");
            for(int i=0;i<items.length();i++){
                JSONObject item=items.optJSONObject(i);
                if(item==null)throw new Exception("Malformed Qobuz "+category+" entry");
                result.put(normalize(item,category,false));
            }
            offset+=items.length();
            progress(category,progressName+": "+offset+"/"+expectedTotal,offset,expectedTotal);
            if(offset>=expectedTotal||items.length()==0)break;
            if(offset>=limit)throw new Exception("Collection safety cap reached");
            if(items.length()<PAGE_SIZE)throw new Exception(
                "Incomplete Qobuz "+category+" page; keeping existing library");
        }
        return result;
    }
    private JSONArray fetchPlaylistTracks(String id,String token,String label)throws Exception{
        JSONArray result=new JSONArray();int offset=0;
        while(true){
            ensureAccount(token);
            JSONObject response=api.library("playlist/get",new JSONObject()
                .put("playlist_id",id).put("extra","tracks")
                .put("limit",PAGE_SIZE).put("offset",offset));
            ensureAccount(token);
            JSONArray page=page(response,"tracks");
            int expectedTotal=total(response,"tracks",offset+page.length());
            if(expectedTotal>MAX_PLAYLIST_TRACKS)
                throw new Exception("Playlist '"+label+"' exceeds 1,500 tracks");
            if(page.length()==0&&offset<expectedTotal)
                throw new Exception("Incomplete playlist '"+label+"'");
            for(int i=0;i<page.length();i++){
                JSONObject entry=page.optJSONObject(i);
                if(entry==null)throw new Exception("Malformed playlist entry");
                result.put(normalize(entry,"tracks",false));
            }
            offset+=page.length();
            progress("playlists","Tracks in "+label+": "+offset+"/"+expectedTotal,
                offset,expectedTotal);
            if(offset>=expectedTotal||page.length()==0)break;
            if(page.length()<PAGE_SIZE)
                throw new Exception("Qobuz returned an incomplete playlist page");
        }
        return result;
    }
    private static Set<String> types(JSONObject args)throws Exception{
        JSONArray incoming=args.optJSONArray("types");
        Set<String> selected=new HashSet<>();
        if(incoming==null){selected.addAll(TYPE_SET);return selected;}
        for(int i=0;i<incoming.length();i++){
            String type=incoming.optString(i,"");
            if(!TYPE_SET.contains(type))throw new Exception("Unsupported library category");
            selected.add(type);
        }
        if(selected.isEmpty())throw new Exception("Select at least one category");
        return selected;
    }
    synchronized JSONObject sync(JSONObject args)throws Exception{
        if(secure.get("libraryToken").isEmpty())
            throw new Exception("Connect the source Qobuz account in Settings → Personal Qobuz library first");
        Set<String> selected=types(args);
        begin("starting","Reading authorized Qobuz library");
        final String token=secure.get("libraryToken");
        io.execute(()->{
            try{
                JSONObject local=readData();
                JSONObject incoming=empty();
                JSONObject dest=incoming.getJSONObject("data");
                for(String type:TYPES){
                    if(!selected.contains(type))continue;
                    if(type.equals("playlists")){
                        JSONArray lists=fetchPages("playlists","playlist/getUserPlaylists",
                            token,MAX_PLAYLISTS,"Playlists");
                        for(int i=0;i<lists.length();i++){
                            ensureAccount(token);
                            JSONObject list=lists.getJSONObject(i);
                            list.put("tracks",fetchPlaylistTracks(list.getString("id"),
                                token,list.optString("name","Playlist")));
                            progress("playlists","Playlist "+(i+1)+"/"+lists.length(),
                                i+1,lists.length());
                        }
                        dest.put(type,lists);
                    }else{
                        dest.put(type,fetchPages(type,"favorite/getUserFavorites",token,
                            MAX_FAVOURITES,type));
                    }
                }
                ensureAccount(token);
                progress("saving","Validating and merging collected metadata",0,1);
                commit(merge(local,incoming,selected,false));
                progress("saved","All selected Qobuz categories saved locally",1,1);
                finished("complete","Local library updated without modifying Qobuz");
            }catch(Exception error){finished(cancel.get()?"cancelled":"error",
                text(error.getMessage(),180));}
        });
        return snapshot();
    }
    synchronized JSONObject cancel(){
        cancel.set(true);
        message="Cancelling after the current Qobuz response";
        callback.accept(snapshot());
        return snapshot();
    }
    private static JSONObject merge(JSONObject existing,JSONObject incoming,
        Set<String> selected,boolean replace)throws Exception{
        JSONObject merged=empty();
        JSONObject base=existing.getJSONObject("data"),
            source=incoming.getJSONObject("data"),result=merged.getJSONObject("data");
        for(String type:TYPES){
            LinkedHashMap<String,JSONObject> rows=new LinkedHashMap<>();
            if(!replace||!selected.contains(type)){
                JSONArray prior=base.getJSONArray(type);
                for(int i=0;i<prior.length();i++){
                    JSONObject row=prior.getJSONObject(i);
                    rows.put(row.getString("id"),row);
                }
            }
            if(selected.contains(type)){
                JSONArray latest=source.getJSONArray(type);
                for(int i=0;i<latest.length();i++){
                    JSONObject row=latest.getJSONObject(i);
                    rows.put(row.getString("id"),row);
                }
            }
            JSONArray arr=new JSONArray();
            for(JSONObject row:rows.values())arr.put(row);
            result.put(type,arr);
        }
        return validate(merged);
    }
    synchronized JSONObject exportPicker()throws Exception{
        begin("export","Choose a destination for the library JSON");
        Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE,"AUREL-Library-"+
            new SimpleDateFormat("yyyy-MM-dd",Locale.US).format(new Date())+".json");
        try{activity.startActivityForResult(intent,REQUEST_EXPORT);}
        catch(Exception error){finished("error",error.getMessage());throw error;}
        return snapshot();
    }
    synchronized JSONObject importPicker(String mode)throws Exception{
        if(!"merge".equals(mode)&&!"replace".equals(mode))
            throw new Exception("Invalid restore mode");
        begin("import","Choose a saved AUREL library JSON");
        importMode=mode;
        Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        try{activity.startActivityForResult(intent,REQUEST_IMPORT);}
        catch(Exception error){finished("error",error.getMessage());throw error;}
        return snapshot();
    }
    void onActivityResult(int request,int result,Intent intent){
        if(result!=Activity.RESULT_OK||intent==null||intent.getData()==null){
            finished("cancelled","File selection cancelled; library unchanged");
            return;
        }
        final Uri uri=intent.getData();
        final String mode=importMode;
        io.execute(()->{
            try{
                if(request==REQUEST_EXPORT){
                    if(cancel.get())throw new Exception("Export cancelled");
                    JSONObject snapshot=readData();
                    byte[] bytes=snapshot.toString().getBytes(StandardCharsets.UTF_8);
                    if(bytes.length>MAX_BYTES)throw new Exception("Export exceeds 12 MB");
                    try(OutputStream out=activity.getContentResolver().openOutputStream(uri,"wt")){
                        if(out==null)throw new Exception("Cannot write selected document");
                        out.write(bytes);out.flush();
                    }
                    finished("complete","Library exported to the chosen JSON file");
                }else{
                    byte[] bytes;
                    try(InputStream in=activity.getContentResolver().openInputStream(uri);
                        ByteArrayOutputStream out=new ByteArrayOutputStream()){
                        if(in==null)throw new Exception("Cannot read selected library file");
                        byte[] buffer=new byte[8192];int n;
                        while((n=in.read(buffer))!=-1){
                            if(out.size()+n>MAX_BYTES)
                                throw new Exception("Library file exceeds 12 MB");
                            out.write(buffer,0,n);
                        }
                        bytes=out.toByteArray();
                    }
                    progress("import","Validating JSON before changing local data",0,1);
                    JSONObject incoming=validate(new JSONObject(
                        new String(bytes,StandardCharsets.UTF_8)));
                    JSONObject old=readData();
                    if(cancel.get())throw new Exception("Restore cancelled; local library unchanged");
                    commit(merge(old,incoming,TYPE_SET,"replace".equals(mode)));
                    progress("saving","Local library safely restored",1,1);
                    finished("complete","Library imported; existing settings and login untouched");
                }
            }catch(Exception error){finished("error",
                "Operation failed; existing local library preserved: "+
                    text(error.getMessage(),135));}
        });
    }
    synchronized JSONObject browse(String type,int offset,int limit)throws Exception{
        if(!TYPE_SET.contains(type))throw new Exception("Unknown library category");
        int start=Math.max(0,offset),size=Math.max(1,Math.min(40,limit));
        JSONObject saved=readData();
        JSONArray rows=saved.getJSONObject("data").getJSONArray(type);
        JSONArray items=new JSONArray();
        for(int i=start;i<Math.min(rows.length(),start+size);i++){
            JSONObject row=rows.getJSONObject(i);
            if(type.equals("playlists")){
                items.put(new JSONObject().put("id",row.getString("id"))
                    .put("name",row.optString("name"))
                    .put("tracksCount",row.optJSONArray("tracks")==null?0:
                        row.getJSONArray("tracks").length()));
            }else items.put(row);
        }
        return new JSONObject().put("type",type).put("items",items)
            .put("offset",start).put("total",rows.length());
    }
    synchronized JSONObject playlist(String id)throws Exception{
        if(!validId(id,"playlists"))throw new Exception("Invalid local playlist ID");
        JSONArray rows=readData().getJSONObject("data").getJSONArray("playlists");
        for(int i=0;i<rows.length();i++){
            JSONObject item=rows.getJSONObject(i);
            if(id.equals(item.optString("id")))return item;
        }
        throw new Exception("Playlist not present in the local library");
    }
    synchronized JSONObject clear()throws Exception{
        begin("clearing","Clearing only the local library");
        io.execute(()->{
            try{
                if(cancel.get())throw new Exception("Clear cancelled");
                commit(empty());
                finished("complete","Local library cleared; Qobuz unchanged");
            }
            catch(Exception error){finished("error",text(error.getMessage(),180));}
        });
        return snapshot();
    }
    void close(){cancel.set(true);io.shutdownNow();}
}
