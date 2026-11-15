package com.aurel.hires;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.content.Context;
import android.graphics.Color;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.audiofx.Equalizer;
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
    private final Handler ui=new Handler(Looper.getMainLooper());
    private final ArrayList<JSONObject> queue=new ArrayList<>();
    private MediaPlayer player;
    private Equalizer equalizer;
    private JSONObject current=new JSONObject();
    private JSONObject fileInfo=new JSONObject();
    private int queueIndex=-1;
    private int playGeneration=0;
    private int repeatMode=0; // 0 off, 1 list, 2 one
    private boolean shuffle=false;
    private boolean eqEnabled=false;
    private int bass=0, mid=0, treble=0;
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
        jobs.shutdownNow(); super.onDestroy();
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
                        case "playbackSettings":{
                            final int mode=Math.max(0,Math.min(2,p.optInt("repeat",0)));
                            final boolean rand=p.optBoolean("shuffle",false);
                            ui.post(()->{repeatMode=mode;shuffle=rand;emit("player",playerState());});data=new JSONObject();break;
                        }
                        case "eq": {
                            final boolean enabled=p.optBoolean("enabled",false);
                            final int low=p.optInt("bass",0),middle=p.optInt("mid",0),high=p.optInt("treble",0);
                            ui.post(()->{eqEnabled=enabled;bass=low;mid=middle;treble=high;applyEq();emit("player",playerState());});
                            data=new JSONObject();break;
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
        if(equalizer!=null){try{equalizer.release();}catch(Exception ignored){}equalizer=null;}
        if(player!=null){try{player.reset();player.release();}catch(Exception ignored){}player=null;}
    }
    private void startAtCurrent() {
        if(queueIndex<0||queueIndex>=queue.size())return;
        playGeneration++;
        final int generation=playGeneration;
        cleanupPlayer();
        current=queue.get(queueIndex);fileInfo=new JSONObject();buffering=true;playerError="";
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
                        player=new MediaPlayer();
                        player.setAudioStreamType(AudioManager.STREAM_MUSIC);
                        player.setOnPreparedListener(mp->{
                            if(generation!=playGeneration)return;
                            prepared=true;buffering=false;
                            try{applyEq();mp.start();}catch(Exception ignored){}
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
    private void applyEq() {
        if(player==null||!prepared)return;
        try {
            if(equalizer!=null){equalizer.release();equalizer=null;}
            if(!eqEnabled)return; // off by default; effects may alter bit-perfect output.
            equalizer=new Equalizer(0,player.getAudioSessionId());
            short count=equalizer.getNumberOfBands();
            short[] range=equalizer.getBandLevelRange();
            for(short b=0;b<count;b++) {
                double pos=count==1?0.5:(double)b/(count-1);
                int gain=pos<0.34?bass:pos<0.67?mid:treble;
                short level=(short)Math.max(range[0],Math.min(range[1],gain*100));
                equalizer.setBandLevel(b,level);
            }
            equalizer.setEnabled(true);
        }catch(Exception ignored){eqEnabled=false;}
    }
    private JSONObject playerState() {
        JSONObject state=new JSONObject();
        try {
            state.put("track",current).put("index",queueIndex).put("count",queue.size());
            state.put("playing",player!=null&&prepared&&player.isPlaying());
            state.put("buffering",buffering).put("prepared",prepared);
            state.put("repeat",repeatMode).put("shuffle",shuffle).put("error",playerError);
            state.put("quality",quality());state.put("eqEnabled",eqEnabled);
            state.put("position",player!=null&&prepared?player.getCurrentPosition():0);
            state.put("duration",player!=null&&prepared?player.getDuration():current.optInt("duration",0)*1000);
            state.put("bits",fileInfo.optInt("bits_depth",0));
            state.put("sampleRate",fileInfo.optDouble("sampling_rate",0));
            state.put("formatId",fileInfo.optInt("format_id",0));
            AudioManager manager=(AudioManager)getSystemService(Context.AUDIO_SERVICE);
            state.put("androidMixerHz",manager==null?"":manager.getProperty(AudioManager.PROPERTY_OUTPUT_SAMPLE_RATE));
        }catch(Exception ignored){}
        return state;
    }
}
