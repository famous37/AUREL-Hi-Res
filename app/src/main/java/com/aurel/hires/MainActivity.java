package com.aurel.hires;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import java.nio.charset.StandardCharsets;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.content.Context;
import android.graphics.Color;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.MediaFormat;
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
    private MornyeGateway mornye;
    private AurelUpdateManager updateManager;
    private static final int MORNYE_VERIFICATION_REQUEST=4104;
    // Only UI-thread callbacks mutate these fields. One verification window at a time.
    private boolean verificationInProgress=false;
    private int verificationRetryGeneration=-1;
    private boolean automaticVerificationRecovery=false;
    private long lastAutomaticVerificationAt=0L;
    // A valid catalogue session does not guarantee an accepted stream ticket.
    private volatile boolean gatewayPlaybackRejected=false;
    private static final long AUTO_REVERIFY_COOLDOWN_MS=90_000L;
    private final ExecutorService jobs=Executors.newFixedThreadPool(3);
    private final Handler ui=new Handler(Looper.getMainLooper());
    private final ArrayList<JSONObject> queue=new ArrayList<>();
    private MediaPlayer player;
    private JSONObject current=new JSONObject();
    private JSONObject fileInfo=new JSONObject();
    private String codec="", sourceLabel="";
    private boolean sourceVerified=false;
    private int decoderSampleRateHz=0, decoderChannels=0, decoderBitrateKbps=0;
    private String decoderMime="";
    // Optional bounded inspection: never delays MediaPlayer or requests a Zarz ticket.
    private boolean qualityProbePending=false, qualityProbeAttempted=false;
    private boolean streamHeaderVerified=false;
    private String sourceEvidence="";
    private int frameBitrateKbps=0;
    /** Small bounded metadata cache: revisit/repeat displays without fresh
     * network calls, and prefetch one next track while audio already plays. */
    private final java.util.Map<String,JSONObject> trackCache=
        java.util.Collections.synchronizedMap(
            new java.util.LinkedHashMap<String,JSONObject>(128,0.75f,true){
                @Override protected boolean removeEldestEntry(
                    java.util.Map.Entry<String,JSONObject> item){return size()>128;}
            });
    private final java.util.Set<String> detailsInFlight=
        java.util.Collections.synchronizedSet(new java.util.HashSet<>());

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
        mornye=new MornyeGateway(secure);
        updateManager=new AurelUpdateManager(this,update->emit("update",update));
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

    /** The browser callback and the in-app grant exchange share exactly one
     *  completion path. Only a successful server grant may resume playback. */
    private void reportMornyeVerification(boolean connected,String reason){
        ui.post(()->{
            if(connected&&!mornyeActive()&&!mornyeMode())return; // stale grant after switch
            if(!connected&&mornyeActive())return; // late browser-cancel event after a valid grant
            final int retryGeneration=verificationRetryGeneration;
            final boolean catalogueRecovery=automaticVerificationRecovery&&retryGeneration<0;
            final boolean recovery=automaticVerificationRecovery||retryGeneration>=0;
            verificationRetryGeneration=-1;
            automaticVerificationRecovery=false;
            verificationInProgress=false;
            try {
                JSONObject status=session(); // report the real configured gateway state on failure too
                status.put("connected",connected).put("streamRecovery",recovery)
                    .put("catalogRecovery",catalogueRecovery);
                if(connected){
                    status.put("mornyeMessage","Mornye gateway session verified");
                    // Preserve the Now Playing screen, queue and current track.
                    if(recovery&&retryGeneration==playGeneration&&mornyeActive()
                        &&queueIndex>=0&&queueIndex<queue.size())startAtCurrent();
                }else{
                    String message=reason==null||reason.isEmpty()?
                        "Zarz verification was not completed.":reason;
                    status.put("error",message);
                    if(recovery&&retryGeneration==playGeneration){
                        buffering=false;
                        playerError="Mornye verification not completed: "+message;
                        emit("player",playerState());
                    }
                }
                emit("mornyeVerificationResult",status);
            }catch(Exception e){
                try{emit("mornyeVerificationResult",new JSONObject()
                    .put("connected",false).put("streamRecovery",recovery)
                    .put("error","Gateway verification state could not refresh."));}
                catch(Exception ignored){}
            }
        });
    }

    /** HTTP 428 VERIFY_REQUIRED and HTTP 401 SESSION_INVALID both require a
     *  fresh signed session, not a retry of the expired HMAC credentials.
     *  Metadata and playback failures share one verification window. */
    private void beginStreamReverification(int generation){
        if(generation!=playGeneration)return;
        buffering=false;
        playerError="Mornye session requires verification. Confirm to resume playback.";
        emit("player",playerState());
        gatewayPlaybackRejected=true;
        verificationRetryGeneration=generation;
        beginAutomaticReverification();
    }

    private void scheduleCatalogueReverification(Exception error){
        if(!MornyeGateway.requiresVerification(error)||
            !"mornye".equals(secure.get("authMode")))return;
        ui.post(()->beginAutomaticReverification());
    }

    /** Only called from the Android main thread. Avoid simultaneous prompts,
     *  and do not automatically reopen a CAPTCHA in a tight session-invalid
     *  loop if the gateway rejects a recently verified connection again. */
    private void beginAutomaticReverification(){
        if(verificationInProgress)return;
        if(!"mornye".equals(secure.get("authMode")))return;
        long now=android.os.SystemClock.elapsedRealtime();
        if(lastAutomaticVerificationAt>0 &&
            now-lastAutomaticVerificationAt>=0 &&
            now-lastAutomaticVerificationAt<AUTO_REVERIFY_COOLDOWN_MS){
            // Keep manually triggered Connect Mornye available for a fresh attempt.
            if(verificationRetryGeneration==playGeneration&&queueIndex>=0){
                buffering=false;
                playerError="Zarz rejected playback after renewal. Tap Verify Mornye to request a fresh grant.";
                emit("player",playerState());
            }
            return;
        }
        launchMornyeReverification();
    }

    /** A user-initiated verification is allowed even during automatic recovery's
     *  cooldown. It always discards the old HMAC material before bootstrapping. */
    private void beginManualReverification(){
        if(!mornyeMode()||verificationInProgress)return;
        verificationRetryGeneration=queueIndex>=0?playGeneration:-1;
        launchMornyeReverification();
    }

    private void launchMornyeReverification(){
        if(verificationInProgress||!mornyeMode())return;
        lastAutomaticVerificationAt=android.os.SystemClock.elapsedRealtime();
        verificationInProgress=true;
        automaticVerificationRecovery=true;
        jobs.execute(()->{
            try{
                JSONObject outcome=mornye.reconnectAfterVerificationRequired();
                if(outcome.optBoolean("verificationRequired",false)){
                    final String url=mornye.challengeUrl();
                    final String state=mornye.pendingState();
                    ui.post(()->{
                        if(!verificationInProgress)return;
                        Intent intent=new Intent(MainActivity.this,MornyeVerificationActivity.class);
                        intent.putExtra(MornyeVerificationActivity.EXTRA_URL,url);
                        intent.putExtra(MornyeVerificationActivity.EXTRA_STATE,state);
                        startActivityForResult(intent,MORNYE_VERIFICATION_REQUEST);
                    });
                }else if(outcome.optBoolean("connected",false)){
                    secure.put("authMode","mornye");
                    reportMornyeVerification(true,"");
                }else{
                    reportMornyeVerification(false,
                        outcome.optString("reason","Zarz did not issue a verification link."));
                }
            }catch(Exception failure){
                reportMornyeVerification(false,
                    failure.getMessage()==null?
                        "Could not open Zarz verification.":failure.getMessage());
            }
        });
    }

    @Override protected void onNewIntent(Intent intent){
        super.onNewIntent(intent);
        setIntent(intent);
        if(intent==null||!MornyeGrantCallbackActivity.ACTION_RESULT.equals(intent.getAction()))
            return;
        if(!mornyeMode()&&!mornye.isConnected()&&secure.get("mornyePendingState").isEmpty())return;
        reportMornyeVerification(intent.getBooleanExtra("connected",false),
            intent.getStringExtra("error"));
    }

    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode==AurelUpdateManager.UNKNOWN_SOURCES_REQUEST){
            if(updateManager!=null)updateManager.onPermissionResult();
            return;
        }
        if(requestCode!=MORNYE_VERIFICATION_REQUEST)return;
        if(!mornyeMode()&&!mornye.isConnected()&&secure.get("mornyePendingState").isEmpty())return;
        // An external browser may deliver its grant through onNewIntent first.
        if(resultCode!=RESULT_OK&&mornyeActive())return;
        if(resultCode!=RESULT_OK||data==null){
            reportMornyeVerification(false,"Verification cancelled.");
            return;
        }
        final String state=data.getStringExtra(MornyeVerificationActivity.EXTRA_STATE);
        final String grant=data.getStringExtra(MornyeVerificationActivity.EXTRA_GRANT);
        jobs.execute(()->{
            try{
                if(!mornyeMode()&&!mornye.isConnected()&&secure.get("mornyePendingState").isEmpty())return;
                JSONObject completed=mornye.completeGrant(state,grant);
                if(!completed.optBoolean("connected"))
                    throw new Exception("Gateway did not approve this session grant.");
                secure.put("authMode","mornye");
                reportMornyeVerification(true,"");
            }catch(Exception issue){
                reportMornyeVerification(false,
                    issue.getMessage()==null?"Gateway grant exchange failed":issue.getMessage());
            }
        });
    }
    @Override public void onBackPressed() {
        if(web!=null)web.evaluateJavascript("window.AurelBack ? window.AurelBack() : null",null);
        else super.onBackPressed();
    }
    @Override protected void onDestroy() {
        ui.removeCallbacks(ticker);
        cleanupPlayer();
        AurelPlaybackService.stop(this);
        if(web!=null){web.removeJavascriptInterface("AurelNative");web.destroy();web=null;}
        if(updateManager!=null)updateManager.stop();
        jobs.shutdownNow();super.onDestroy();
    }
    private void script(String js) { ui.post(()->{ if(web!=null)web.evaluateJavascript(js,null); }); }
    private void complete(String id,JSONObject result) {
        script("window.AurelReceive("+JSONObject.quote(id)+","+result.toString()+")");
    }
    private void emit(String event,JSONObject data) {
        script("window.AurelEvent("+JSONObject.quote(event)+","+data.toString()+")");
        if("player".equals(event)) {
            if(Looper.myLooper()==Looper.getMainLooper())AurelPlaybackService.publish(this,data);
            else ui.post(()->AurelPlaybackService.publish(this,data));
        }
    }
    /** Receives verified artwork-derived colours from the native playback service. */
    void onAlbumArtworkPalette(String url,String bg,String surface,String accent) {
        script("window.AurelCoverPalette && window.AurelCoverPalette("+
            JSONObject.quote(url)+","+JSONObject.quote(bg)+","+JSONObject.quote(surface)+","+JSONObject.quote(accent)+")");
    }
    /** Called by Android MediaSession notification and hardware transport controls. */
    void mediaControl(String action,boolean play) {
        ui.post(()->{
            if("next".equals(action))advance(1,false);
            else if("previous".equals(action)){
                if(player!=null&&prepared&&player.getCurrentPosition()>3500)player.seekTo(0);
                else advance(-1,false);
            }else if("toggle".equals(action)){
                if(player!=null&&prepared){
                    if(play&&!player.isPlaying())player.start();
                    else if(!play&&player.isPlaying())player.pause();
                }
            }
            emit("player",playerState());
        });
    }
    void seekFromMediaSession(long position) {
        ui.post(()->{
            if(player!=null&&prepared){
                player.seekTo((int)Math.max(0,Math.min(Integer.MAX_VALUE,position)));
                emit("player",playerState());
            }
        });
    }
    private JSONObject success(JSONObject data) throws Exception {return new JSONObject().put("ok",true).put("data",data);}
    private JSONObject resultError(String message) throws Exception {return new JSONObject().put("ok",false).put("error",message);}
    private JSONObject args(String s) throws Exception {return s==null||s.isEmpty()?new JSONObject():new JSONObject(s);}
    private JSONObject param(String k,Object v) throws Exception {return new JSONObject().put(k,v);}
    private int quality() {
        try {int q=Integer.parseInt(secure.get("quality")); return q==5||q==6||q==7||q==27?q:27;}
        catch(Exception ignored){return 27;}
    }
    private boolean mornyeMode(){return "mornye".equals(secure.get("authMode"));}
    private boolean mornyeActive(){return mornyeMode()&&mornye.isConnected();}
    private JSONObject catalog(String endpoint,JSONObject params)throws Exception{
        if(!mornyeMode())return api.catalog(endpoint,params);
        // An expired gateway session must not silently fall back to unrelated
        // Qobuz credentials: that path surfaces 401 without Zarz verification.
        if(!mornyeActive()){
            ui.post(()->beginAutomaticReverification());
            throw new Exception("Mornye signed session expired; verification required.");
        }
        try{return mornye.metadata(endpoint,params);}
        catch(MornyeGateway.GatewayException error){
            scheduleCatalogueReverification(error);
            throw error;
        }
    }
    private void needLibrary()throws Exception{
        if(mornyeActive()&&secure.get("libraryToken").isEmpty())
            throw new Exception("Connect a separate Qobuz account in Settings to access your personal library.");
    }
    /** Retire gateway only AFTER Qobuz validates its replacement account.
     * This clears active HMAC credentials and any pending verification grant. */
    private boolean retireMornyeForQobuz() throws Exception {
        boolean wasMornye=mornyeMode()||mornye.isConnected();
        mornye.disconnect();
        secure.put("authMode","qobuz");
        gatewayPlaybackRejected=false;
        verificationRetryGeneration=-1;
        automaticVerificationRecovery=false;
        verificationInProgress=false;
        if(wasMornye)ui.post(()->{
            cleanupPlayer();queue.clear();queueIndex=-1;
            current=new JSONObject();fileInfo=new JSONObject();
            emit("player",playerState());
        });
        return wasMornye;
    }
    /** Never fall back to an old token after switching from Mornye
     * into a personal Qobuz library with no catalogue entitlement. */
    private void clearPreviousStreamingCredentials() throws Exception {
        for(String key:new String[]{"streamToken","token","streamAppId","appId",
            "streamAppSecret","appSecret","streamUserId","streamValidation","profile"})
            secure.put(key,"");
    }
    private String streamToken(){String t=secure.get("streamToken");return t.isEmpty()?secure.get("token"):t;}
    // Default App ID shown in the user's original AUREL configuration.
    // Not a secret; callers can override it in Advanced account settings.
    private static final String DEFAULT_APP_ID="312369995";
    private String streamAppId(){
        String t=secure.get("streamAppId");
        if(t.isEmpty())t=secure.get("appId");
        return t.isEmpty()?DEFAULT_APP_ID:t;
    }
    private String streamSecret(){String t=secure.get("streamAppSecret");return t.isEmpty()?secure.get("appSecret"):t;}
    private JSONObject session() throws Exception {
        JSONObject j=new JSONObject();
        boolean gateway=mornyeActive();
        boolean configured=mornyeMode();
        boolean stream=!streamToken().isEmpty()||gateway;
        boolean hasLibrary=!secure.get("libraryToken").isEmpty();
        j.put("loggedIn",stream||hasLibrary);
        j.put("streamConnected",stream);
        j.put("mornyeConnected",gateway);
        j.put("mornyeConfigured",configured);
        j.put("gatewayPlaybackRejected",configured&&gatewayPlaybackRejected);
        j.put("authMode",configured?"mornye":"qobuz");
        j.put("libraryConnected",hasLibrary);
        j.put("separateLibrary",hasLibrary);
        j.put("quality",quality());
        // Do not suggest an obsolete legacy App ID to new accounts.
        String storedId=secure.get("streamAppId");
        if(storedId.isEmpty())storedId=secure.get("appId");
        j.put("appId",storedId);
        j.put("webAppIdAuto",true);
        j.put("libraryAppId",secure.get("libraryAppId"));
        j.put("streamUserId",secure.get("streamUserId"));
        j.put("libraryUserId",secure.get("libraryUserId"));
        j.put("hasLibrarySecret",!secure.get("libraryAppSecret").isEmpty());
        j.put("hasSecret",!streamSecret().isEmpty());
        // The preview package has isolated encrypted storage; it cannot reuse
        // credentials saved under another installed application ID.
        j.put("previewBuild",getPackageName().contains(".preview"));
        String streamValidation=secure.get("streamValidation");
        String libraryValidation=secure.get("libraryValidation");
        j.put("streamValidation",gateway?"catalogue":streamValidation.isEmpty()?"unknown":streamValidation);
        j.put("libraryValidation",libraryValidation.isEmpty()?"unknown":libraryValidation);
        try { j.put("profile",new JSONObject(secure.get("profile"))); }
        catch(Exception ignored) {j.put("profile",new JSONObject());}
        if(gateway)j.put("profile",new JSONObject().put("displayName","Mornye Qobuz Gateway")
            .put("subscription","Gateway access, not a Qobuz user account")
            .put("verifiedSubscription",false));
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
                        case "updateStatus": {
                            data=updateManager.state();
                            break;
                        }
                        case "checkUpdate": {
                            data=updateManager.check();
                            break;
                        }
                        case "downloadUpdate": {
                            data=updateManager.download();
                            break;
                        }
                        case "installUpdate": {
                            data=updateManager.requestInstall();
                            break;
                        }
                        case "session": {
                            data=session();
                            if(mornyeMode()&&!mornyeActive())
                                ui.post(()->beginAutomaticReverification());
                            break;
                        }
                        case "connectMornye": {
                            JSONObject result;
                            try{result=mornye.connect();}
                            catch(Exception stale){
                                if(!MornyeGateway.requiresVerification(stale))throw stale;
                                result=mornye.reconnectAfterVerificationRequired();
                            }
                            if(result.optBoolean("connected",false)){
                                secure.put("authMode","mornye");
                                data=session();
                                data.put("mornyeMessage",result.optString("message","Gateway authenticated"));
                            }else if(result.optBoolean("verificationRequired",false)){
                                final String url=mornye.challengeUrl();
                                final String state=mornye.pendingState();
                                ui.post(()->{
                                    Intent intent=new Intent(MainActivity.this,MornyeVerificationActivity.class);
                                    intent.putExtra(MornyeVerificationActivity.EXTRA_URL,url);
                                    intent.putExtra(MornyeVerificationActivity.EXTRA_STATE,state);
                                    startActivityForResult(intent,MORNYE_VERIFICATION_REQUEST);
                                });
                                data=new JSONObject().put("connected",false)
                                    .put("verificationStarted",true)
                                    .put("reason","Complete the Zarz session grant inside AUREL.");
                            }else data=result;
                            break;
                        }
                        case "reverifyMornye": {
                            if(!mornyeMode())throw new Exception("Connect a Mornye streaming session first.");
                            // This is an explicit user action, not an unrestricted
                            // background retry. The provider chooses if CAPTCHA is needed.
                            ui.post(()->beginManualReverification());
                            data=new JSONObject().put("verificationStarted",true)
                                .put("reason","Requesting a fresh Zarz signed session.");
                            break;
                        }
                        case "mornyeStatus": {
                            data=new JSONObject().put("connected",mornyeActive());
                            break;
                        }
                        case "disconnectMornye": {
                            mornye.disconnect();
                            secure.put("authMode","qobuz");
                            gatewayPlaybackRejected=false;
                            data=session();
                            break;
                        }
                        case "validateSession": {
                            if(mornyeMode()){
                                try{
                                    catalog("track/search",new JSONObject().put("query","music").put("limit",1));
                                    data=session();
                                }catch(Exception issue){
                                    data=session();
                                    data.put("authError","Mornye gateway verification failed: "+issue.getMessage());
                                }
                                break;
                            }
                            String token=streamToken();
                            if(token.isEmpty()){data=session();data.put("authError","No streaming token saved.");break;}
                            try {
                                api.validateLiveToken(streamAppId(),token,secure.get("streamUserId"),false);
                                secure.put("streamValidation","verified");
                                data=session();
                            }catch(Exception issue){
                                String message=issue.getMessage()==null?"Qobuz connection unavailable":issue.getMessage();
                                boolean rejected=message.contains("HTTP 401")||message.contains("HTTP 403");
                                // Only definitive authentication errors invalidate the
                                // saved session; retain credentials for reconnection.
                                if(rejected)secure.put("streamValidation","rejected");
                                data=session();
                                data.put("authError",message);
                                data.put("authRejected",rejected);
                            }
                            break;
                        }
                        case "openQobuzWeb": {
                            // Use the system browser. Qobuz may refuse embedded WebViews;
                            // a browser login does not silently grant this app a token.
                            ui.post(()->{
                                try { startActivity(new Intent(Intent.ACTION_VIEW,
                                    Uri.parse("https://play.qobuz.com/login"))); }
                                catch(Exception ignored){}
                            });
                            data=new JSONObject().put("opened",true);
                            break;
                        }
                        case "loginToken": case "loginPassword": {
                            boolean secondary=p.optBoolean("libraryOnly",false);
                            // No stale hardcoded App ID: blank means resolve public
                            // Web App ID from the current official Qobuz client.
                            // Honor a manually supplied App ID for BOTH token and password
                            // flows (including the independent library account).
                            String suppliedAppId=p.optString("appId","").trim();
                            String appId=!suppliedAppId.isEmpty()
                                ?api.resolveAppId(suppliedAppId)
                                :(secondary?api.automaticLibraryAppId():api.resolveAppId(""));
                            JSONObject raw;
                            String token;
                            if(action.equals("loginToken")){
                                token=p.optString("token","").trim();
                                // Keep existing credentials unchanged if the pair
                                // is rejected: the token and App ID must agree.
                                raw=api.validateLiveToken(appId,token,p.optString("userId",""),secondary);
                            }else{
                                raw=api.passwordLogin(appId,p.optString("email").trim(),p.optString("password"));
                                token=raw.optString("user_auth_token",raw.optString("token",""));
                                if(token.isEmpty())throw new Exception("Qobuz did not issue an auth token. Use session-token login or the official sign-in.");
                                // A password login response is not sufficient when
                                // the client App ID cannot access the catalog/library.
                                api.validateLiveToken(appId,token,p.optString("userId",""),secondary);
                                raw.put("validated",true);
                            }
                            JSONObject prof=profile(raw,p);
                            boolean validated=raw.optBoolean("validated",action.equals("loginPassword")&&raw.has("user"));
                            String validation=validated?"verified":"unverified";
                            String resolvedUserId=prof.optString("userId","").trim();
                            if(resolvedUserId.isEmpty())resolvedUserId=p.optString("userId","").trim();
                            // A library token may work when its App ID does not allow
                            // playback search. Check the latter separately and do not
                            // falsely report playback entitlement.
                            boolean changingFromMornye=mornyeMode()||mornye.isConnected();
                            boolean libraryMayStream=false;
                            if(secondary&&changingFromMornye){
                                try{
                                    api.validateLiveToken(appId,token,resolvedUserId,false);
                                    libraryMayStream=true;
                                }catch(Exception ignored){/* Keep verified library access. */}
                            }
                            boolean leftMornye=retireMornyeForQobuz();
                            if(secondary){
                                String previousAppId=secure.get("libraryAppId");
                                String suppliedSecret=p.optString("appSecret","").trim();
                                secure.put("libraryAppId",appId);
                                secure.put("libraryUserId",resolvedUserId);
                                if(!suppliedSecret.isEmpty())secure.put("libraryAppSecret",suppliedSecret);
                                else if(!appId.equals(previousAppId))secure.put("libraryAppSecret","");
                                secure.put("libraryToken",token);
                                secure.put("libraryValidation",validation);
                                secure.put("libraryProfile",prof.toString());
                                if(leftMornye){
                                    clearPreviousStreamingCredentials();
                                    if(libraryMayStream){
                                        secure.put("streamAppId",appId);
                                        secure.put("streamToken",token);
                                        secure.put("streamUserId",resolvedUserId);
                                        secure.put("streamValidation","verified");
                                        secure.put("profile",prof.toString());
                                        String signedSecret=p.optString("appSecret","").trim();
                                        if(!signedSecret.isEmpty())secure.put("streamAppSecret",signedSecret);
                                    }
                                }
                            }else{
                                // A new primary Qobuz account must own its own
                                // favourites. Do not reuse the previous account's
                                // separately connected library token.
                                for(String key:new String[]{"libraryAppId","libraryAppSecret",
                                    "libraryUserId","libraryToken","libraryProfile",
                                    "libraryValidation"})secure.put(key,"");
                                String previousAppId=streamAppId();
                                String suppliedSecret=p.optString("appSecret","").trim();
                                secure.put("streamAppId",appId);
                                // Never erase an existing signed-stream secret when the
                                // same account is reconnected with an empty secret field.
                                if(!suppliedSecret.isEmpty())secure.put("streamAppSecret",suppliedSecret);
                                else if(!appId.equals(previousAppId))secure.put("streamAppSecret","");
                                secure.put("streamToken",token);
                                secure.put("authMode","qobuz");
                                secure.put("streamUserId",resolvedUserId);
                                secure.put("streamValidation",validation);
                                secure.put("profile",prof.toString());
                            }
                            // Store only the issued token, never the password.
                            // The user and catalogue/library scopes were verified
                            // before modifying the previous encrypted credentials.
                            data=session();break;
                        }
                        case "logoutLibrary": {
                            secure.put("libraryAppId","");secure.put("libraryAppSecret","");secure.put("libraryUserId","");secure.put("libraryToken","");secure.put("libraryProfile","");secure.put("libraryValidation","");
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
                        case "discover":
                            // The Zarz metadata gateway does not guarantee
                            // album/getFeatured authorization (HTTP 403).
                            // Use Qobuz's separate public editorial endpoint.
                            data=mornyeActive()?api.publicFeaturedReleases(24)
                                :api.discoverReleases(24);
                            break;
                        case "search": {
                            String q=p.optString("query").trim();
                            if(q.isEmpty())throw new Exception("Enter a search term");
                            String type=p.optString("type","tracks");
                            String endpoint=type.equals("albums")?"album/search":type.equals("artists")?"artist/search":"track/search";
                            data=catalog(endpoint,new JSONObject().put("query",q).put("limit",35));break;
                        }
                        case "album":data=catalog("album/get",new JSONObject().put("album_id",p.getString("id")).put("limit",100));break;
                        case "artist": {
                            data=catalog("artist/get",new JSONObject().put("artist_id",p.getString("id"))
                                .put("extra","albums").put("limit",100).put("offset",0));
                            data=withArtistReleases(data,p.getString("id"),0,100);
                            break;
                        }
                        case "artistAlbums": {
                            int offset=Math.max(0,p.optInt("offset",0));
                            int limit=Math.max(1,Math.min(100,p.optInt("limit",100)));
                            String artistId=p.getString("id");
                            data=catalog("artist/get",new JSONObject().put("artist_id",artistId)
                                .put("extra","albums").put("limit",limit).put("offset",offset));
                            data=withArtistReleases(data,artistId,offset,limit);
                            break;
                        }

                        case "artistPortrait": {
                            // Lightweight, individual official Qobuz artist lookup.
                            // Similar-artist recommendations frequently contain only id/name,
                            // whereas the full artist record includes the portrait.
                            String artistId=p.getString("id");
                            if(!artistId.matches("[0-9]{1,20}"))
                                throw new Exception("Invalid artist ID");
                            JSONObject params=new JSONObject().put("artist_id",artistId);
                            try {data=catalog("artist/get",params);}
                            catch(Exception signedError){
                                data=artistInformation("artist/get",params);
                            }
                            break;
                        }

                        case "artistExtras": {
                            String artistId=p.getString("id");
                            JSONObject extras=new JSONObject();
                            try {
                                extras=artistInformation("artist/page",
                                    new JSONObject().put("artist_id",artistId));
                            }catch(Exception error) {
                                // A failed endpoint must be distinguishable from an empty Qobuz catalogue.
                                extras.put("_pageError","Qobuz artist page request failed");
                            }
                            Object similar=extras.opt("similar_artists");
                            JSONArray relatedItems=similar instanceof JSONObject
                                ?((JSONObject)similar).optJSONArray("items"):null;
                            if(similar==null||similar==JSONObject.NULL
                                ||relatedItems==null||relatedItems.length()==0) {
                                try {
                                    JSONObject result=artistInformation("artist/getSimilarArtists",
                                        new JSONObject().put("artist_id",artistId).put("limit",25));
                                    JSONObject related=result.optJSONObject("artists");
                                    if(related!=null)extras.put("similar_artists",related);
                                }catch(Exception error) {
                                    if(relatedItems==null||relatedItems.length()==0)
                                        extras.put("_similarError","Qobuz related-artists request failed");
                                }
                            }
                            data=extras;break;
                        }
                        case "artistReleaseType": {
                            String releaseType=p.optString("releaseType","");
                            if(!releaseType.equals("epSingle") && !releaseType.equals("compilation")
                                && !releaseType.equals("album"))
                                throw new Exception("Unsupported release type");
                            String artistId=p.getString("id");
                            try {
                                data=artistInformation("artist/getReleasesList",new JSONObject()
                                    .put("artist_id",artistId).put("release_type",releaseType)
                                    .put("sort","release_date_by_priority").put("offset",0).put("limit",60));
                            }catch(Exception listError) {
                                // Qobuz may restrict the complete releases endpoint. A limited,
                                // correctly typed artist-page preview is better than a fabricated list.
                                try {data=artistPageReleases(artistId,releaseType);}
                                catch(Exception fallbackError) {
                                    throw new Exception("Qobuz release list unavailable: "
                                        +listError.getMessage());
                                }
                            }
                            break;
                        }
                        case "resolveArtist": data=resolveArtist(p);break;
                        case "favorites": {needLibrary();
                            String type=p.optString("type","albums");
                            if(!type.equals("albums")&&!type.equals("tracks")&&!type.equals("artists"))type="albums";
                            data=api.library("favorite/getUserFavorites",new JSONObject().put("type",type).put("limit",100));break;
                        }
                        case "favoriteAdd": {needLibrary();
                            String type=p.optString("type","tracks");
                            String field=type.equals("albums")?"album_ids":type.equals("artists")?"artist_ids":"track_ids";
                            JSONObject body=new JSONObject().put("track_ids","").put("album_ids","").put("artist_ids","");
                            body.put(field,p.getString("id"));data=api.libraryPost("favorite/create",body);break;
                        }
                        case "playlists":needLibrary();data=api.library("playlist/getUserPlaylists",new JSONObject().put("limit",100));break;
                        case "playlist":needLibrary();data=api.library("playlist/get",new JSONObject().put("playlist_id",p.getString("id")).put("extra","tracks").put("limit",100));break;
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
                        case "resume":ui.post(()->{
                            if(player!=null&&prepared&&!player.isPlaying())player.start();
                            else if(!buffering&&queueIndex>=0&&player==null)startAtCurrent();
                            emit("player",playerState());
                        });data=new JSONObject();break;
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

    /** Read artist metadata through an authorized Qobuz library account where available.
     *  In Mornye mode the Zarz gateway may not support artist/page or getReleasesList;
     *  only public artist metadata is retried anonymously (never private library data). */
    private JSONObject artistInformation(String endpoint,JSONObject parameters)throws Exception {
        Exception latest=null;
        boolean publicMetadata=endpoint.equals("artist/page")
            ||endpoint.equals("artist/getSimilarArtists")
            ||endpoint.equals("artist/get");
        if(!secure.get("libraryToken").isEmpty()) {
            try{return api.library(endpoint,parameters);}
            catch(Exception failure){latest=failure;}
        }
        if(mornyeActive()&&publicMetadata) {
            try{return api.publicArtist(endpoint,parameters);}
            catch(Exception failure){latest=failure;}
        }
        try{return catalog(endpoint,parameters);}
        catch(Exception failure){latest=failure;}
        if(!mornyeActive()&&publicMetadata) {
            try{return api.publicArtist(endpoint,parameters);}
            catch(Exception failure){latest=failure;}
        }
        if(latest!=null)throw latest;
        throw new Exception("Qobuz artist metadata unavailable");
    }

    /** Use Qobuz's typed, limited artist/page preview only when its full
     *  getReleasesList request is blocked. The UI never invents release IDs. */
    private JSONObject artistPageReleases(String artistId,String releaseType)throws Exception {
        JSONObject page=artistInformation("artist/page",
            new JSONObject().put("artist_id",artistId));
        JSONArray sections=page.optJSONArray("releases");
        if(sections==null)throw new Exception("Artist page has no release sections");
        JSONArray matches=new JSONArray();
        for(int i=0;i<sections.length();i++) {
            JSONObject section=sections.optJSONObject(i);
            if(section==null)continue;
            String type=section.optString("type",section.optString("release_type",""));
            boolean matchesType=type.equals(releaseType)
                ||(releaseType.equals("epSingle")&&(type.equals("single")||type.equals("ep")));
            if(!matchesType)continue;
            JSONArray items=section.optJSONArray("items");
            if(items==null)continue;
            for(int n=0;n<items.length();n++) {
                JSONObject item=items.optJSONObject(n);
                if(item!=null)matches.put(item);
            }
        }
        return new JSONObject().put("items",matches).put("_partial",true);
    }

    /** A release list may be an artist/get albums block, or the newer getReleasesList.
     *  Normalize the response without modifying Qobuz credentials or removing rights checks. */
    private JSONObject withArtistReleases(JSONObject artist,String id,int offset,int limit) throws Exception {
        JSONObject albums=artist.optJSONObject("albums");
        JSONArray items=albums==null?null:albums.optJSONArray("items");
        if(items!=null&&items.length()>0) {enrichAlbumArtists(artist,items);return artist;}
        try {
            JSONObject latest=catalog("artist/getReleasesList",new JSONObject()
                .put("artist_id",id).put("release_type","all").put("sort","release_date_by_priority")
                .put("offset",offset).put("limit",limit));
            JSONObject block=latest.optJSONObject("albums");
            if(block==null)block=latest.optJSONObject("releases");
            JSONArray releases=block!=null?block.optJSONArray("items"):latest.optJSONArray("items");
            if(releases!=null) {
                JSONArray normalized=new JSONArray();
                for(int i=0;i<releases.length();i++) {
                    JSONObject item=releases.optJSONObject(i);
                    if(item==null)continue;
                    JSONObject album=item.optJSONObject("album");
                    normalized.put(album!=null?album:item);
                }
                enrichAlbumArtists(artist,normalized);
                JSONObject converted=new JSONObject().put("items",normalized)
                    .put("total",block!=null?block.optInt("total",normalized.length()):normalized.length())
                    .put("limit",limit);
                artist.put("albums",converted);
            }
        } catch(Exception ignored) { // Older Qobuz integrations expose only artist/get.
            if(albums==null)artist.put("albums",new JSONObject().put("items",new JSONArray()));
        }
        return artist;
    }
    private void enrichAlbumArtists(JSONObject artist,JSONArray albums) throws Exception {
        JSONObject canonical=new JSONObject().put("id",artist.opt("id"))
            .put("name",artist.optString("name", ""));
        for(int i=0;i<albums.length();i++) {
            JSONObject item=albums.optJSONObject(i);
            if(item==null)continue;
            if(!item.has("artist")||item.isNull("artist"))item.put("artist",canonical);
        }
    }
    private String artistIdFrom(JSONObject o) {
        if(o==null)return "";
        JSONObject artist=o.optJSONObject("artist");
        if(artist!=null&&artist.has("id"))return artist.optString("id","");
        JSONObject album=o.optJSONObject("album");
        if(album!=null){artist=album.optJSONObject("artist");if(artist!=null&&artist.has("id"))return artist.optString("id","");}
        JSONArray artists=o.optJSONArray("artists");
        if(artists!=null&&artists.length()>0){artist=artists.optJSONObject(0);if(artist!=null)return artist.optString("id","");}
        return o.optString("artist_id", "");
    }
    private JSONObject resolveArtist(JSONObject input) throws Exception {
        String albumId=input.optString("albumId", "").trim();
        String trackId=input.optString("trackId", "").trim();
        String name=input.optString("name", "").trim();
        if(trackId.matches("[0-9]+")) {
            try {
                JSONObject track=catalog("track/get",new JSONObject().put("track_id",trackId));
                String found=artistIdFrom(track);
                if(found.matches("[0-9]+"))return new JSONObject().put("id",found).put("matchedBy","track");
                JSONObject album=track.optJSONObject("album");
                if(albumId.isEmpty()&&album!=null)albumId=album.optString("id","");
            } catch(Exception ignored) {}
        }
        if(albumId.matches("[0-9]+")) {
            try {
                JSONObject album=catalog("album/get",new JSONObject().put("album_id",albumId));
                String found=artistIdFrom(album);
                if(found.matches("[0-9]+"))return new JSONObject().put("id",found).put("matchedBy","album");
            } catch(Exception ignored) {}
        }
        if(!name.isEmpty()&&!name.equalsIgnoreCase("Artist information unavailable")&&!name.equalsIgnoreCase("Unknown artist")) {
            JSONObject found=catalog("artist/search",new JSONObject().put("query",name).put("limit",30));
            JSONObject artists=found.optJSONObject("artists");
            JSONArray items=artists==null?found.optJSONArray("items"):artists.optJSONArray("items");
            if(items!=null)for(int i=0;i<items.length();i++) {
                JSONObject candidate=items.optJSONObject(i);
                if(candidate!=null&&name.equalsIgnoreCase(candidate.optString("name").trim())
                    &&candidate.optString("id").matches("[0-9]+"))
                    return new JSONObject().put("id",candidate.optString("id")).put("matchedBy","exactName");
            }
        }
        throw new Exception("Qobuz did not identify the artist. Search the artist by name.");
    }

    private boolean hasArtistName(JSONObject track){
        if(track==null)return false;
        JSONObject artist=track.optJSONObject("artist");
        if(artist!=null&&!artist.optString("name","").isEmpty())return true;
        if(!track.optString("performer","").isEmpty())return true;
        JSONArray artists=track.optJSONArray("artists");
        if(artists!=null&&artists.length()>0)return true;
        JSONObject album=track.optJSONObject("album");
        if(album!=null){
            artist=album.optJSONObject("artist");
            if(artist!=null&&!artist.optString("name","").isEmpty())return true;
            artists=album.optJSONArray("artists");
            if(artists!=null&&artists.length()>0)return true;
        }
        return false;
    }

    /** Fetch full Qobuz track details on the background worker. Never let
     * metadata failures interrupt an already playable audio stream.
     */
    private JSONObject trackDetails(String trackId)throws Exception {
        Exception first=null;
        if(mornyeActive()){
            try{return api.preferredTrackDetails(trackId);}
            catch(Exception e){first=e;}
        }
        try{
            JSONObject result=catalog("track/get",new JSONObject().put("track_id",trackId));
            JSONObject nested=result.optJSONObject("track");
            return nested==null?result:nested;
        }catch(Exception e){
            if(!mornyeActive())return api.preferredTrackDetails(trackId);
            throw first==null?e:first;
        }
    }
    private static void copyMetadata(JSONObject target,JSONObject other)throws Exception {
        java.util.Iterator<String> keys=other.keys();
        while(keys.hasNext()){
            String key=keys.next();
            if("url".equals(key)||"user_auth_token".equals(key))continue;
            Object value=other.opt(key);
            if(value==null||value==JSONObject.NULL)continue;
            Object existing=target.opt(key);
            if(value instanceof JSONObject&&existing instanceof JSONObject){
                copyMetadata((JSONObject)existing,(JSONObject)value);
            }else if(existing==null||existing==JSONObject.NULL||
                (existing instanceof String&&((String)existing).isEmpty())||
                (existing instanceof Number&&((Number)existing).doubleValue()==0)){
                target.put(key,value);
            }
        }
    }

    /** Track parameters from Android's parsed stream headers; not a DAC measurement. */
    private void inspectPreparedTrack(MediaPlayer mp) {
        decoderSampleRateHz=0;decoderChannels=0;decoderBitrateKbps=0;decoderMime="";
        try {
            MediaPlayer.TrackInfo[] tracks=mp.getTrackInfo();
            if(tracks==null)return;
            for(MediaPlayer.TrackInfo track:tracks) {
                if(track.getTrackType()!=MediaPlayer.TrackInfo.MEDIA_TRACK_TYPE_AUDIO)continue;
                MediaFormat format=track.getFormat();
                if(format==null)continue;
                if(format.containsKey(MediaFormat.KEY_SAMPLE_RATE)){
                    int sample= format.getInteger(MediaFormat.KEY_SAMPLE_RATE);
                    if(sample>=8000&&sample<=768000) decoderSampleRateHz=sample;
                }
                if(format.containsKey(MediaFormat.KEY_CHANNEL_COUNT)){
                    int ch=format.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
                    if(ch>=1&&ch<=32)decoderChannels=ch;
                }
                if(format.containsKey(MediaFormat.KEY_MIME))decoderMime=format.getString(MediaFormat.KEY_MIME);
                if(format.containsKey(MediaFormat.KEY_BIT_RATE)){
                    int bitrate=format.getInteger(MediaFormat.KEY_BIT_RATE);
                    if(bitrate>=8000&&bitrate<=50_000_000)
                        decoderBitrateKbps=(bitrate+500)/1000;
                }
                break;
            }
        }catch(Exception ignored){/* Android does not expose track format on every decoder. */}
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
        current=queue.get(queueIndex);fileInfo=new JSONObject();sourceVerified=false;codec="";sourceLabel="";
        decoderSampleRateHz=0;decoderChannels=0;decoderBitrateKbps=0;decoderMime="";
        qualityProbePending=false;qualityProbeAttempted=false;streamHeaderVerified=false;
        sourceEvidence="";frameBitrateKbps=0;
        buffering=true;playerError="";
        // Selecting a different track during CAPTCHA must not use an unrelated
        // account or create further Zarz tickets before verification completes.
        if(verificationInProgress&&mornyeMode()){
            verificationRetryGeneration=playGeneration;
            buffering=false;
            playerError="Complete Mornye verification to resume playback.";
            emit("player",playerState());
            return;
        }
        if(mornyeMode()&&!mornyeActive()){
            beginStreamReverification(generation);
            return;
        }
        final String id=current.optString("id","");
        JSONObject cached=trackCache.get(id);
        if(cached!=null){
            try{copyMetadata(current,cached);}catch(Exception ignored){}
        }
        // Show already known catalogue quality and cover immediately, before
        // the two network requests for a signed audio stream complete.
        emit("player",playerState());
        if(id.matches("[0-9]{1,20}") && cached==null && detailsInFlight.add(id)){
            jobs.execute(()->{
                try{
                    JSONObject full=trackDetails(id);
                    trackCache.put(id,full);
                    ui.post(()->{
                        if(generation!=playGeneration||current==null)return;
                        try {
                            copyMetadata(current,full);
                            queue.set(queueIndex,current);
                            emit("player",playerState());
                        }catch(Exception ignored){}
                    });
                }catch(Exception ignored){}
                finally {detailsInFlight.remove(id);}
            });
        }
        jobs.execute(()->{
            try {
                JSONObject info=null;Exception last=null;
                int requested=quality();
                boolean viaMornye=mornyeMode();
                // The gateway's CD tier is lossless; it does not offer the
                // Qobuz MP3 (format 5) tier. Do not mislabel CD as MP3.
                int[] formats=viaMornye
                    ?(requested==27?new int[]{27,7,6}:requested==7?new int[]{7,6}:new int[]{6})
                    :(requested==27?new int[]{27,7,6,5}:requested==7?new int[]{7,6,5}:requested==6?new int[]{6,5}:new int[]{5});
                for(int fmt:formats) {
                    try {info=viaMornye?mornye.streamInfo(id,fmt):api.streamInfo(id,fmt);break;}
                    catch(Exception e) {
                        last=e;
                        // A 429 is a server-imposed rate limit, never a
                        // reason to request another quality or mint tickets.
                        if(viaMornye&&MornyeGateway.terminalStreamFailure(e))break;
                    }
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
                        qualityProbePending=!sourceVerified;
                        // Report supplier metadata before MediaPlayer.prepareAsync
                        // starts waiting for an HTTP stream/decoder.
                        emit("player",playerState());
                        player=new MediaPlayer();
                        player.setAudioStreamType(AudioManager.STREAM_MUSIC);
                        player.setOnPreparedListener(mp->{
                            if(generation!=playGeneration)return;
                            prepared=true;buffering=false;
                            if(mornyeMode()&&gatewayPlaybackRejected){
                                gatewayPlaybackRejected=false;
                                try{emit("session",session());}catch(Exception ignored){}
                            }
                            inspectPreparedTrack(mp);
                            // Cache just one next-track catalogue entry. No Zarz
                            // ticket/stream prefetch: respects server rate limits.
                            if(queueIndex+1<queue.size()){
                                final String upcomingId=queue.get(queueIndex+1).optString("id","");
                                if(upcomingId.matches("[0-9]{1,20}")&&
                                    !trackCache.containsKey(upcomingId)&&detailsInFlight.add(upcomingId)){
                                    jobs.execute(()->{
                                        try{trackCache.put(upcomingId,api.preferredTrackDetails(upcomingId));}
                                        catch(Exception ignored){}
                                        finally{detailsInFlight.remove(upcomingId);}
                                    });
                                }
                            }
                            try{mp.start();}catch(Exception ignored){}
                            // Probe the existing media URL, never the ticket endpoint.
                            // Run after playback starts to protect single-use stream links.
                            if(qualityProbePending){
                                jobs.execute(()->{
                                    StreamQualityProbe.Result parsed=StreamQualityProbe.inspect(streamUrl);
                                    ui.post(()->{
                                        if(generation!=playGeneration)return;
                                        qualityProbePending=false;qualityProbeAttempted=true;
                                        if(parsed!=null){
                                            try{
                                                streamHeaderVerified=true;
                                                sourceEvidence=parsed.evidence;
                                                if(!parsed.codec.isEmpty())codec=parsed.codec;
                                                frameBitrateKbps=parsed.frameBitrateKbps;
                                                if(parsed.sampleRateHz>0)
                                                    fileInfo.put("sample_rate_hz",parsed.sampleRateHz);
                                                if(parsed.channels>0)
                                                    fileInfo.put("n_channels",parsed.channels);
                                                if(parsed.bitDepth>0&&parsed.sampleRateHz>0){
                                                    fileInfo.put("bits_depth",parsed.bitDepth);
                                                    sourceVerified=true;
                                                }
                                                if(parsed.fileSize>0&&fileInfo.optLong("file_size",0)<=0)
                                                    fileInfo.put("file_size",parsed.fileSize);
                                                if(parsed.totalSamples>0)
                                                    fileInfo.put("total_samples",parsed.totalSamples);
                                            }catch(Exception ignored){}
                                        }
                                        emit("player",playerState());
                                    });
                                });
                            }
                            // The successful start of an actual Qobuz stream is
                            // stronger evidence than an optional login endpoint.
                            if("unverified".equals(secure.get("streamValidation"))){
                                jobs.execute(()->{
                                    try{
                                        secure.put("streamValidation","playback");
                                        emit("session",session());
                                    }catch(Exception ignored){}
                                });
                            }
                            emit("player",playerState());
                        });
                        player.setOnCompletionListener(mp->advance(1,true));
                        player.setOnErrorListener((mp,what,extra)->{
                            if(generation!=playGeneration)return true;
                            prepared=false;buffering=false;qualityProbePending=false;
                            playerError="Media decoder error ("+what+" / "+extra+")";
                            emit("player",playerState());return true;
                        });
                        player.setDataSource(streamUrl);
                        player.prepareAsync();
                        emit("player",playerState());
                    }catch(Exception e){buffering=false;qualityProbePending=false;playerError=e.getMessage();emit("player",playerState());}
                });
            }catch(Exception e){
                ui.post(()->{
                    if(generation!=playGeneration)return;
                    if(MornyeGateway.requiresVerification(e)){
                        beginStreamReverification(generation);
                    }else{
                        buffering=false;qualityProbePending=false;
                        playerError=e.getMessage();
                        emit("player",playerState());
                    }
                });
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
            state.put("qualityProbePending",qualityProbePending);
            state.put("qualityProbeAttempted",qualityProbeAttempted);
            state.put("streamHeaderVerified",streamHeaderVerified);
            state.put("sourceEvidence",sourceEvidence);
            state.put("frameBitrateKbps",frameBitrateKbps);
            state.put("decoderSampleRateHz",decoderSampleRateHz);
            state.put("decoderChannels",decoderChannels);
            state.put("decoderMime",decoderMime);
            state.put("decoderBitrateKbps",decoderBitrateKbps);
            state.put("sourceBitrateKbps",fileInfo.optLong("source_bitrate_kbps",0));
            long fileSize=fileInfo.optLong("file_size",0);
            long durationMs=player!=null&&prepared?player.getDuration():
                current.optLong("duration",0)*1000L;
            long estimated=0;
            long totalSamples=fileInfo.optLong("total_samples",0);
            double exactRate=fileInfo.optDouble("sample_rate_hz",0);
            if(fileSize>0&&totalSamples>0&&exactRate>0)
                estimated=Math.round(fileSize*8.0*exactRate/(totalSamples*1000.0));
            else if(fileSize>0&&durationMs>0)
                estimated=Math.round(fileSize*8.0/durationMs);
            state.put("estimatedAvgBitrateKbps",estimated>0&&estimated<50000?estimated:0);
            state.put("sourceLabel",sourceLabel);
            state.put("mimeType",fileInfo.optString("mime_type",""));
            state.put("fileSize",fileInfo.optLong("file_size",0));
            state.put("formatId",fileInfo.optInt("format_id",0));
            // Separate album/track catalogue capability from the actual stream.
            int catalogBits=current.optInt("maximum_bit_depth",0);
            double catalogRate=current.optDouble("maximum_sampling_rate",0);
            JSONObject albumInfo=current.optJSONObject("album");
            boolean albumCap=false;
            if((catalogBits<=0||catalogRate<=0)&&albumInfo!=null){
                catalogBits=albumInfo.optInt("maximum_bit_depth",catalogBits);
                catalogRate=albumInfo.optDouble("maximum_sampling_rate",catalogRate);
                albumCap=true;
            }
            if(catalogRate>0&&catalogRate<1000)catalogRate*=1000;
            state.put("catalogMaxBits",catalogBits>=8&&catalogBits<=32?catalogBits:0);
            state.put("catalogMaxSampleRateHz",catalogRate>=8000&&catalogRate<=768000?catalogRate:0);
            state.put("catalogMaxFromAlbum",albumCap);
            JSONArray nextQueue=new JSONArray();
            for(int i=0;i<queue.size();i++)nextQueue.put(queue.get(i));
            state.put("queue",nextQueue);
            AudioManager manager=(AudioManager)getSystemService(Context.AUDIO_SERVICE);
            state.put("androidMixerHz",manager==null?"":manager.getProperty(AudioManager.PROPERTY_OUTPUT_SAMPLE_RATE));
        }catch(Exception ignored){}
        return state;
    }
}
