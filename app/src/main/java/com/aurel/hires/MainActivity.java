package com.aurel.hires;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Environment;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileInputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.content.Context;
import android.graphics.Color;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.view.View;
import android.view.WindowInsets;
import android.graphics.Insets;
import android.widget.FrameLayout;
import android.os.Build;
import android.view.WindowManager;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.Locale;
import java.util.Collections;
import java.util.ArrayList;

/** Offline UI + native HTTPS API bridge and native Android playback. */
public final class MainActivity extends Activity {
    private WebView web;
    private SecureStore secure;
    private QobuzApi api;
    private final ExecutorService jobs=Executors.newFixedThreadPool(3);
    private final ExecutorService downloads=Executors.newSingleThreadExecutor();
    private final Handler ui=new Handler(Looper.getMainLooper());
    private final ArrayList<JSONObject> queue=new ArrayList<>();
    private MediaPlayer player;
    private JSONObject current=new JSONObject();
    private JSONObject fileInfo=new JSONObject();
    private String codec="", sourceLabel="";
    private boolean sourceVerified=false;
    private int queueIndex=-1;
    private int playGeneration=0;
    private int repeatMode=0; // 0 off, 1 list, 2 one
    private boolean shuffle=false;
    private boolean prepared=false, buffering=false;
    private String playerError="";
    private long lastStateSent=0;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(12,12,16));
        getWindow().setNavigationBarColor(Color.rgb(12,12,16));
        getWindow().getDecorView().setSystemUiVisibility(0);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        secure=new SecureStore(this);
        api=new QobuzApi(secure);
        web=new WebView(this); web.setBackgroundColor(Color.rgb(12,12,16));
        WebSettings s=web.getSettings();
        s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setDefaultTextEncodingName("UTF-8");
        web.addJavascriptInterface(new Bridge(),"AurelNative");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view,android.webkit.WebResourceRequest request) {
                // Keep all navigation inside our packaged UI; no remote web content gets the JS bridge.
                return !"file".equalsIgnoreCase(request.getUrl().getScheme());
            }
        });
        // Android 15+ enforces edge-to-edge for target 35. Put the WebView inside a
        // window-inset-aware container instead of letting HTML sit under the status bar.
        FrameLayout content=new FrameLayout(this);
        content.setBackgroundColor(Color.rgb(12,12,16));
        content.addView(web,new FrameLayout.LayoutParams(-1,-1));
        if(Build.VERSION.SDK_INT>=30){
            content.setOnApplyWindowInsetsListener((v,insets)->{
                Insets sys=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());
                Insets ime=insets.getInsets(WindowInsets.Type.ime());
                v.setPadding(sys.left,sys.top,sys.right,Math.max(sys.bottom,ime.bottom));
                return WindowInsets.CONSUMED;
            });
        }else{
            content.setFitsSystemWindows(true);
        }
        setContentView(content);
        content.requestApplyInsets();
        web.loadUrl("file:///android_asset/index.html");
        ui.postDelayed(ticker,1000);
    }

    private final Runnable ticker=new Runnable() {
        @Override public void run() {
            if(web!=null) {
                long now=System.currentTimeMillis();
                if(player!=null&&now-lastStateSent>900) { emit("player",playerState()); lastStateSent=now; }
                ui.postDelayed(this,1000);
            }
        }
    };

    @Override public void onBackPressed() {
        if(web!=null)web.evaluateJavascript("window.AurelBack ? window.AurelBack() : null",null);
        else super.onBackPressed();
    }
    @Override protected void onDestroy() {
        ui.removeCallbacks(ticker);
        cleanupPlayer();
        if(web!=null){web.removeJavascriptInterface("AurelNative");web.destroy();web=null;}
        jobs.shutdownNow();downloads.shutdownNow();super.onDestroy();
    }
    private void script(String js) { ui.post(()->{ if(web!=null)web.evaluateJavascript(js,null); }); }
    private void complete(String id,JSONObject result) {
        script("window.AurelReceive("+JSONObject.quote(id)+","+result.toString()+")");
    }
    private void emit(String event,JSONObject data) {
        script("window.AurelEvent("+JSONObject.quote(event)+","+data.toString()+")");
    }
    private JSONObject success(JSONObject data) throws Exception {return new JSONObject().put("ok",true).put("data",data);}
    private JSONObject resultError(String message) throws Exception {return new JSONObject().put("ok",false).put("error",message);}
    private JSONObject args(String s) throws Exception {return s==null||s.isEmpty()?new JSONObject():new JSONObject(s);}
    private JSONObject param(String k,Object v) throws Exception {return new JSONObject().put(k,v);}
    private int quality() {
        try {int q=Integer.parseInt(secure.get("quality")); return q==5||q==6||q==7||q==27?q:27;}
        catch(Exception ignored){return 27;}
    }
    private String streamToken(){String t=secure.get("streamToken");return t.isEmpty()?secure.get("token"):t;}
    private String streamAppId(){String t=secure.get("streamAppId");return t.isEmpty()?secure.get("appId"):t;}
    private String streamSecret(){String t=secure.get("streamAppSecret");return t.isEmpty()?secure.get("appSecret"):t;}
    private JSONObject session() throws Exception {
        JSONObject j=new JSONObject();
        boolean stream=!streamToken().isEmpty();
        boolean hasLibrary=!secure.get("libraryToken").isEmpty();
        j.put("loggedIn",stream||hasLibrary);
        j.put("streamConnected",stream);
        j.put("libraryConnected",hasLibrary);
        j.put("separateLibrary",hasLibrary);
        j.put("quality",quality());
        j.put("appId",streamAppId());
        j.put("libraryAppId",secure.get("libraryAppId"));
        j.put("hasSecret",!streamSecret().isEmpty());
        try { j.put("profile",new JSONObject(secure.get("profile"))); }
        catch(Exception ignored) {j.put("profile",new JSONObject());}
        try{j.put("libraryProfile",new JSONObject(secure.get("libraryProfile")));}
        catch(Exception ignored){j.put("libraryProfile",new JSONObject());}
        return j;
    }
    private JSONObject profile(JSONObject response,JSONObject input) throws Exception {
        JSONObject user=response.optJSONObject("user");
        JSONObject j=new JSONObject();
        if(user!=null) {
            j.put("userId",user.optString("id",""));
            j.put("displayName",user.optString("display_name",user.optString("firstname",user.optString("login",""))));
            JSONObject credential=user.optJSONObject("credential");
            JSONObject params=credential==null?null:credential.optJSONObject("parameters");
            j.put("subscription",params!=null?params.optString("label",""):"");
            j.put("verifiedSubscription",params!=null);
            if(input.has("userId")&&!input.optString("userId").isEmpty()&&
                !user.optString("id").equals(input.optString("userId")))
                throw new Exception("User ID does not match the authenticated Qobuz account");
        } else {
            // Never present user-entered subscription claims as account verification.
            j.put("userId", "");j.put("displayName", "Qobuz listener");
            j.put("subscription", "Not verified");j.put("verifiedSubscription",false);
        }
        return j;
    }

    private final class Bridge {
        @JavascriptInterface public void call(String requestId,String action,String payload) {
            if(requestId==null||requestId.length()>72)return;
            jobs.execute(()->{
                try {
                    JSONObject p=args(payload);
                    JSONObject data;
                    switch(action) {
                        case "session": data=session();break;
                        case "loginToken": case "loginPassword": {
                            boolean secondary=p.optBoolean("libraryOnly",false);
                            String appId=p.optString("appId","").trim();
                            if(appId.isEmpty()&&secondary)appId=streamAppId();
                            JSONObject raw;
                            String token;
                            if(action.equals("loginToken")){
                                token=p.optString("token","").trim();
                                raw=api.verifyToken(appId,token);
                            }else{
                                raw=api.passwordLogin(appId,p.optString("email").trim(),p.optString("password"));
                                token=raw.optString("user_auth_token",raw.optString("token",""));
                                if(token.isEmpty())throw new Exception("Qobuz did not issue an auth token. Use session-token login or the official sign-in.");
                            }
                            JSONObject prof=profile(raw,p);
                            if(secondary){
                                secure.put("libraryAppId",appId);
                                secure.put("libraryToken",token);
                                secure.put("libraryProfile",prof.toString());
                            }else{
                                secure.put("streamAppId",appId);
                                secure.put("streamAppSecret",p.optString("appSecret","").trim());
                                secure.put("streamToken",token);
                                secure.put("profile",prof.toString());
                            }
                            // Password is never stored; source and library tokens are distinct.
                            data=session();break;
                        }
                        case "logoutLibrary": {
                            secure.put("libraryAppId","");secure.put("libraryToken","");secure.put("libraryProfile","");
                            data=session();break;
                        }
                        case "logout": {
                            secure.clear();ui.post(()->{cleanupPlayer();queue.clear();queueIndex=-1;current=new JSONObject();fileInfo=new JSONObject();emit("player",playerState());});
                            data=session();break;
                        }
                        case "saveSettings": {
                            int q=p.optInt("quality",27);
                            if(q!=5&&q!=6&&q!=7&&q!=27)throw new Exception("Invalid quality");
                            secure.put("quality",Integer.toString(q));
                            // Credentials can be updated independently; no token shown to JS.
                            if(p.has("appSecret"))secure.put("streamAppSecret",p.optString("appSecret").trim());
                            data=session();break;
                        }
                        case "discover": data=api.get("discover/newReleases",param("limit",24));break;
                        case "search": {
                            String q=p.optString("query").trim();
                            if(q.isEmpty())throw new Exception("Enter a search term");
                            String type=p.optString("type","tracks");
                            String endpoint=type.equals("albums")?"album/search":type.equals("artists")?"artist/search":"track/search";
                            data=api.catalog(endpoint,new JSONObject().put("query",q).put("limit",35));break;
                        }
                        case "album":data=api.catalog("album/get",new JSONObject().put("album_id",p.getString("id")).put("limit",100));break;
                        case "artist":data=api.catalog("artist/get",new JSONObject().put("artist_id",p.getString("id")).put("extra","albums").put("limit",100));break;
                        case "favorites": {
                            String type=p.optString("type","albums");
                            if(!type.equals("albums")&&!type.equals("tracks")&&!type.equals("artists"))type="albums";
                            data=api.library("favorite/getUserFavorites",new JSONObject().put("type",type).put("limit",100));break;
                        }
                        case "favoriteAdd": {
                            String type=p.optString("type","tracks");
                            String field=type.equals("albums")?"album_ids":type.equals("artists")?"artist_ids":"track_ids";
                            JSONObject body=new JSONObject().put("track_ids","").put("album_ids","").put("artist_ids","");
                            body.put(field,p.getString("id"));data=api.libraryPost("favorite/create",body);break;
                        }
                        case "playlists":data=api.library("playlist/getUserPlaylists",new JSONObject().put("limit",100));break;
                        case "playlist":data=api.library("playlist/get",new JSONObject().put("playlist_id",p.getString("id")).put("extra","tracks").put("limit",100));break;
                        case "downloadTrack": {
                            JSONObject track=p.getJSONObject("track");
                            JSONArray tracks=new JSONArray().put(track);
                            enqueuePurchaseDownloads(tracks);
                            data=param("accepted",1);break;
                        }
                        case "downloadAlbum": {
                            JSONArray tracks=p.getJSONArray("tracks");
                            if(tracks.length()<1||tracks.length()>400)throw new Exception("Select up to 400 tracks");
                            enqueuePurchaseDownloads(tracks);
                            data=param("accepted",tracks.length());break;
                        }
                        case "downloadArtist": {
                            String artistId=p.optString("id","");
                            if(!artistId.matches("[0-9]+"))throw new Exception("Invalid artist ID");
                            downloads.execute(()->downloadArtistCatalog(artistId));
                            data=param("queued",true);break;
                        }
                        case "downloadedFiles": {
                            data=localFiles();break;
                        }
                        case "playDownloaded": {
                            String filename=p.optString("file","");
                            File base=offlineDirectory();
                            File requested=new File(base,filename);
                            if(!requested.getCanonicalPath().startsWith(base.getCanonicalPath()+File.separator)
                                    ||!requested.isFile()||!filename.endsWith(".flac")&&!filename.endsWith(".mp3"))
                                throw new Exception("Local audio file not found");
                            ui.post(()->playDownloaded(requested));data=param("local",true);break;
                        }
                        case "play":{
                            final JSONArray list=p.getJSONArray("tracks");final int index=p.optInt("index",0);
                            if(list.length()==0||list.length()>400||index<0||index>=list.length())throw new Exception("Invalid playlist queue");
                            ui.post(()->{
                                queue.clear();
                                for(int i=0;i<list.length();i++){JSONObject o=list.optJSONObject(i);if(o!=null)queue.add(o);}
                                queueIndex=Math.min(index,queue.size()-1);startAtCurrent();
                            });
                            data=param("queued",list.length());break;
                        }
                        case "pause":ui.post(()->{if(player!=null&&prepared&&player.isPlaying())player.pause();emit("player",playerState());});data=new JSONObject();break;
                        case "resume":ui.post(()->{if(player!=null&&prepared&&!player.isPlaying())player.start();emit("player",playerState());});data=new JSONObject();break;
                        case "next":ui.post(()->advance(1,false));data=new JSONObject();break;
                        case "previous":ui.post(()->{
                            if(player!=null&&prepared&&player.getCurrentPosition()>3500)player.seekTo(0);
                            else advance(-1,false);
                        });data=new JSONObject();break;
                        case "seek":{final int to=Math.max(0,p.optInt("ms",0));ui.post(()->{if(player!=null&&prepared)player.seekTo(to);});data=new JSONObject();break;}
                        case "queueAdd": {
                            final JSONArray incoming=p.getJSONArray("tracks");
                            final boolean next=p.optBoolean("next",false);
                            if(incoming.length()>200)throw new Exception("Too many queued tracks");
                            ui.post(()->{
                                int at=next?Math.max(0,queueIndex+1):queue.size();
                                for(int i=0;i<incoming.length()&&queue.size()<500;i++){
                                    JSONObject track=incoming.optJSONObject(i);
                                    if(track!=null)queue.add(Math.min(at++,queue.size()),track);
                                }
                                emit("player",playerState());
                            }); data=new JSONObject();break;
                        }
                        case "queuePlay":{
                            final int index=p.optInt("index",-1);
                            ui.post(()->{if(index>=0&&index<queue.size()){queueIndex=index;startAtCurrent();}});
                            data=new JSONObject();break;
                        }
                        case "queueMove":{
                            final int from=p.optInt("from",-1),to=p.optInt("to",-1);
                            ui.post(()->{
                                if(from<0||to<0||from>=queue.size()||to>=queue.size()||from==to)return;
                                JSONObject moving=queue.remove(from);queue.add(to,moving);
                                if(queueIndex==from)queueIndex=to;
                                else if(from<queueIndex&&to>=queueIndex)queueIndex--;
                                else if(from>queueIndex&&to<=queueIndex)queueIndex++;
                                emit("player",playerState());
                            }); data=new JSONObject();break;
                        }
                        case "queueRemove":{
                            final int index=p.optInt("index",-1);
                            ui.post(()->{
                                if(index<0||index>=queue.size())return;
                                queue.remove(index);
                                if(queue.isEmpty()){playGeneration++;cleanupPlayer();queueIndex=-1;current=new JSONObject();fileInfo=new JSONObject();}
                                else if(index==queueIndex){queueIndex=Math.min(index,queue.size()-1);startAtCurrent();}
                                else if(index<queueIndex)queueIndex--;
                                emit("player",playerState());
                            }); data=new JSONObject();break;
                        }
                        case "openMagazine": {
                            // Only the official Qobuz editorial page may be opened.
                            ui.post(()->{
                                Intent link=new Intent(Intent.ACTION_VIEW,Uri.parse("https://www.qobuz.com/us-en/magazine/"));
                                try{startActivity(link);}catch(Exception ignored){}
                            }); data=new JSONObject();break;
                        }
                        case "playbackSettings":{
                            final int mode=Math.max(0,Math.min(2,p.optInt("repeat",0)));
                            final boolean rand=p.optBoolean("shuffle",false);
                            ui.post(()->{repeatMode=mode;shuffle=rand;emit("player",playerState());});data=new JSONObject();break;
                        }
                        case "playerState": {
                            // UI state must be read on main thread; send by native event instead.
                            ui.post(()->emit("player",playerState()));data=new JSONObject();break;
                        }
                        default:throw new Exception("Unsupported action: "+action);
                    }
                    complete(requestId,success(data));
                } catch(Exception e) {
                    try{complete(requestId,resultError(e.getMessage()==null?"Unexpected error":e.getMessage()));}
                    catch(Exception ignored){}
                }
            });
        }
    }

    private void cleanupPlayer() {
        prepared=false;buffering=false;
        if(player!=null){try{player.reset();player.release();}catch(Exception ignored){}player=null;}
    }
    private void startAtCurrent() {
        if(queueIndex<0||queueIndex>=queue.size())return;
        playGeneration++;
        final int generation=playGeneration;
        cleanupPlayer();
        current=queue.get(queueIndex);fileInfo=new JSONObject();sourceVerified=false;codec="";sourceLabel="";buffering=true;playerError="";
        emit("player",playerState());
        final String id=current.optString("id","");
        jobs.execute(()->{
            try {
                JSONObject info=null;Exception last=null;
                int requested=quality();
                int[] formats=requested==27?new int[]{27,7,6,5}:requested==7?new int[]{7,6,5}:requested==6?new int[]{6,5}:new int[]{5};
                for(int fmt:formats) {
                    try {info=api.streamInfo(id,fmt);break;}
                    catch(Exception e) {last=e;}
                }
                if(info==null)throw last!=null?last:new Exception("No available audio stream");
                final JSONObject metadata=info;
                final String streamUrl=metadata.optString("url");
                if(!streamUrl.startsWith("https://"))throw new Exception("No HTTPS media URL returned");
                ui.post(()->{
                    if(generation!=playGeneration)return;
                    try {
                        fileInfo=metadata;
                        sourceVerified=metadata.optBoolean("source_verified",false);
                        sourceLabel=metadata.optString("source_label","Qobuz API");
                        codec=metadata.optString("codec","");
                        player=new MediaPlayer();
                        player.setAudioStreamType(AudioManager.STREAM_MUSIC);
                        player.setOnPreparedListener(mp->{
                            if(generation!=playGeneration)return;
                            prepared=true;buffering=false;
                            try{mp.start();}catch(Exception ignored){}
                            emit("player",playerState());
                        });
                        player.setOnCompletionListener(mp->advance(1,true));
                        player.setOnErrorListener((mp,what,extra)->{
                            if(generation!=playGeneration)return true;
                            prepared=false;buffering=false;
                            playerError="Media decoder error ("+what+" / "+extra+")";
                            emit("player",playerState());return true;
                        });
                        player.setDataSource(streamUrl);
                        player.prepareAsync();
                        emit("player",playerState());
                    }catch(Exception e){buffering=false;playerError=e.getMessage();emit("player",playerState());}
                });
            }catch(Exception e){
                ui.post(()->{if(generation==playGeneration){buffering=false;playerError=e.getMessage();emit("player",playerState());}});
            }
        });
    }
    private void advance(int dir,boolean completion) {
        if(queue.isEmpty())return;
        if(completion&&repeatMode==2){startAtCurrent();return;}
        int next=queueIndex+dir;
        if(shuffle&&queue.size()>1) {
            int candidate=queueIndex;
            while(candidate==queueIndex)candidate=(int)(Math.random()*queue.size());
            next=candidate;
        }
        if(next<0||next>=queue.size()) {
            if(repeatMode==1)next=(next+queue.size())%queue.size();
            else {
                if(completion){cleanupPlayer();buffering=false;emit("player",playerState());}
                return;
            }
        }
        queueIndex=next;startAtCurrent();
    }
    private File offlineDirectory() {
        File root=getExternalFilesDir(Environment.DIRECTORY_MUSIC);
        if(root==null)root=new File(getFilesDir(),"Music");
        File dir=new File(root,"AUREL Purchases");
        if(!dir.exists()&&!dir.mkdirs())throw new IllegalStateException("Cannot create offline directory");
        return dir;
    }
    private String safeName(String value){
        String cleaned=value.replaceAll("[\\/:*?\"<>|\\p{Cntrl}]","_").trim().replaceAll("\\s+"," ");
        if(cleaned.length()>90)cleaned=cleaned.substring(0,90);
        return cleaned.isEmpty()?"Unknown":cleaned;
    }
    private JSONObject localFiles() throws Exception {
        JSONArray items=new JSONArray();
        File[] files=offlineDirectory().listFiles();
        if(files!=null)for(File f:files)if(f.isFile()&&(f.getName().endsWith(".flac")||f.getName().endsWith(".mp3"))){
            items.put(new JSONObject().put("name",f.getName()).put("bytes",f.length()));
        }
        return new JSONObject().put("items",items).put("location","App private Music/AUREL Purchases (removed when app is uninstalled)");
    }
    private void broadcastDownload(int done,int total,int failed,String text){
        try{emit("download",new JSONObject().put("done",done).put("total",total).put("failed",failed).put("message",text));}
        catch(Exception ignored){}
    }
    private void enqueuePurchaseDownloads(JSONArray input){
        // Only the rights-bearing streaming account can request intent=download.
        downloads.execute(()->downloadTracks(input));
    }
    private void downloadArtistCatalog(String artistId){
        try{
            JSONArray tracks=new JSONArray();int offset=0;
            while(offset<200 && tracks.length()<400){
                JSONObject artist=api.catalog("artist/get",new JSONObject().put("artist_id",artistId)
                    .put("extra","albums").put("offset",offset).put("limit",50));
                JSONObject albums=artist.optJSONObject("albums");
                JSONArray items=albums==null?null:albums.optJSONArray("items");
                if(items==null||items.length()==0)break;
                for(int a=0;a<items.length()&&tracks.length()<400;a++){
                    JSONObject album=items.optJSONObject(a);if(album==null)continue;
                    JSONObject details=api.catalog("album/get",new JSONObject().put("album_id",album.optString("id"))
                        .put("limit",100));
                    JSONObject group=details.optJSONObject("tracks");
                    JSONArray songList=group==null?null:group.optJSONArray("items");
                    if(songList!=null)for(int t=0;t<songList.length()&&tracks.length()<400;t++){
                        JSONObject track=songList.optJSONObject(t);
                        if(track!=null){track.put("album",new JSONObject().put("title",details.optString("title")));
                            tracks.put(track);}
                    }
                }
                offset+=items.length();
                if(albums==null||offset>=albums.optInt("total",offset))break;
            }
            broadcastDownload(0,tracks.length(),0,"Artist catalogue discovered; checking purchased-track rights");
            downloadTracks(tracks);
        }catch(Exception e){broadcastDownload(0,0,1,"Cannot load artist catalogue: "+e.getMessage());}
    }
    private void downloadTracks(JSONArray tracks){
        int done=0,fail=0,total=tracks.length();
        if(total==0){broadcastDownload(0,0,0,"No tracks available");return;}
        broadcastDownload(0,total,0,"Checking purchased downloads…");
        for(int i=0;i<total;i++){
            JSONObject t=tracks.optJSONObject(i);if(t==null){fail++;continue;}
            String id=t.optString("id","");
            try{
                JSONObject signed=api.purchaseDownloadInfo(id,quality());
                String url=signed.optString("url","");
                if(!url.startsWith("https://"))throw new Exception("No authorized download URL");
                String extension=signed.optString("mime_type","").contains("mpeg")?".mp3":".flac";
                String fileName=safeName(t.optString("title","Track"))+" - "+id+extension;
                File dest=new File(offlineDirectory(),fileName);File temp=new File(dest.getAbsolutePath()+".part");
                HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();
                c.setConnectTimeout(15000);c.setReadTimeout(30000);c.setInstanceFollowRedirects(true);
                try{
                    if(c.getResponseCode()!=200)throw new Exception("Download HTTP "+c.getResponseCode());
                    try(InputStream in=c.getInputStream();FileOutputStream out=new FileOutputStream(temp)){
                        byte[] buffer=new byte[32768];int n;long count=0;
                        while((n=in.read(buffer))!=-1){out.write(buffer,0,n);count+=n;
                            if(count>2_000_000_000L)throw new Exception("File exceeds 2 GB");}
                        if(count==0)throw new Exception("Empty download");
                    }
                    if(dest.exists()&&!dest.delete())throw new Exception("Cannot replace existing file");
                    if(!temp.renameTo(dest))throw new Exception("Unable to finalize download");
                    done++;
                }finally{c.disconnect();if(temp.exists())temp.delete();}
            }catch(Exception e){fail++;}
            broadcastDownload(done,total,fail,"Purchased downloads: "+done+" saved, "+fail+" unavailable ("+(i+1)+"/"+total+")");
        }
        broadcastDownload(done,total,fail,"Finished: "+done+" downloaded, "+fail+" unavailable. Only purchased files authorized by Qobuz can be saved.");
    }
    private void playDownloaded(File f){
        playGeneration++;final int generation=playGeneration;
        cleanupPlayer();queue.clear();queueIndex=0;
        current=new JSONObject();fileInfo=new JSONObject();playerError="";
        try {
            current.put("id","offline-"+f.getName()).put("title",f.getName().replaceFirst(" - \\d+\\.(flac|mp3)$", ""))
                .put("artist",new JSONObject().put("name","Purchased download"));
            queue.add(current);
            codec=f.getName().endsWith(".flac")?"FLAC":"MP3";
            sourceLabel="Local file (verified)";
            sourceVerified=f.getName().endsWith(".flac")&&readFlacHeader(f,fileInfo);
            fileInfo.put("mime_type",codec.equals("FLAC")?"audio/flac":"audio/mpeg");
            player=new MediaPlayer();player.setAudioStreamType(AudioManager.STREAM_MUSIC);
            player.setOnPreparedListener(mp->{if(generation!=playGeneration)return;prepared=true;mp.start();emit("player",playerState());});
            player.setOnCompletionListener(mp->advance(1,true));
            player.setDataSource(f.getAbsolutePath());player.prepareAsync();emit("player",playerState());
        }catch(Exception e){playerError=e.getMessage();emit("player",playerState());}
    }
    private boolean readFlacHeader(File f,JSONObject out){
        try(FileInputStream in=new FileInputStream(f)){
            byte[] header=new byte[42];int read=0;
            while(read<header.length){int n=in.read(header,read,header.length-read);if(n<0)break;read+=n;}
            if(read<42||header[0]!='f'||header[1]!='L'||header[2]!='a'||header[3]!='C'||(header[4]&127)!=0)return false;
            long metadata=0;
            for(int i=18;i<26;i++)metadata=(metadata<<8)|(header[i]&0xff);
            int sampleRate=(int)((metadata>>44)&0xfffff);
            int channels=(int)((metadata>>41)&7)+1;
            int depth=(int)((metadata>>36)&31)+1;
            if(sampleRate<8000||sampleRate>768000||depth<4||depth>32)return false;
            out.put("sample_rate_hz",sampleRate).put("bits_depth",depth).put("n_channels",channels);
            return true;
        }catch(Exception e){return false;}
    }
    private JSONObject playerState() {
        JSONObject state=new JSONObject();
        try {
            state.put("track",current).put("index",queueIndex).put("count",queue.size());
            state.put("playing",player!=null&&prepared&&player.isPlaying());
            state.put("buffering",buffering).put("prepared",prepared);
            state.put("repeat",repeatMode).put("shuffle",shuffle).put("error",playerError);
            state.put("quality",quality());
            state.put("position",player!=null&&prepared?player.getCurrentPosition():0);
            state.put("duration",player!=null&&prepared?player.getDuration():current.optInt("duration",0)*1000);
            state.put("bits",fileInfo.optInt("bits_depth",0));
            state.put("sampleRateHz",fileInfo.optDouble("sample_rate_hz",0));
            state.put("channels",fileInfo.optInt("n_channels",0));
            state.put("codec",codec);
            state.put("sourceVerified",sourceVerified);
            state.put("sourceLabel",sourceLabel);
            state.put("mimeType",fileInfo.optString("mime_type",""));
            state.put("fileSize",fileInfo.optLong("file_size",0));
            state.put("formatId",fileInfo.optInt("format_id",0));
            JSONArray nextQueue=new JSONArray();
            for(int i=0;i<queue.size();i++)nextQueue.put(queue.get(i));
            state.put("queue",nextQueue);
            AudioManager manager=(AudioManager)getSystemService(Context.AUDIO_SERVICE);
            state.put("androidMixerHz",manager==null?"":manager.getProperty(AudioManager.PROPERTY_OUTPUT_SAMPLE_RATE));
        }catch(Exception ignored){}
        return state;
    }
}
