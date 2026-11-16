package com.aurel.hires;

import android.util.Base64;
import android.net.Uri;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.text.SimpleDateFormat;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Independent Java client for Mornye qobuz-web signedSession@3.
 * Based on the published wire protocol (mornyeapp/Mornye, LGPL-3.0-only).
 * Server controls whether a grant/verification is required. This is NOT a
 * Qobuz user login, and does not mint or read Qobuz user auth tokens.
 *
 * No extension packages, remote scripts, or media files are downloaded.
 * The authenticated gateway may return a time-limited HTTPS media URL.
 */
final class MornyeGateway {
    private static final String BASE="https://api.zarz.moe/v2";
    private static final String APP_VERSION="qobuz-web@1.2.21"; // protocol scope, not display version
    private static final String PLATFORM="extension";
    private static final String SCHEME="ZARZ-HMAC-V1";
    private static final String PREFIX="X-Zarz-";
    private static final int MAX_BYTES=1_500_000;
    /** Never retry a server-enforced streaming limit by changing quality. */
    static class GatewayException extends Exception {
        final int status;
        final String code;
        GatewayException(int status,String code,String message){
            super(message);this.status=status;this.code=code==null?"":code;
        }
    }
    static final class StreamRateLimitException extends GatewayException {
        final long retrySeconds;
        StreamRateLimitException(long seconds){
            super(429,"DOWNLOAD_RATE_LIMITED",
                "Zarz streaming rate limit reached. Try again in "+seconds+
                " seconds. AUREL will not send more stream requests during this period.");
            retrySeconds=seconds;
        }
    }
    /** HTTP 428 is a server-issued request to revalidate the signed session.
     *  It is not a quality/codec failure and must never trigger fallback tickets. */
    static boolean requiresVerification(Exception error){
        if(!(error instanceof GatewayException))return false;
        GatewayException failure=(GatewayException)error;
        String code=failure.code.trim();
        return failure.status==428 ||
            "VERIFY_REQUIRED".equalsIgnoreCase(code) ||
            (failure.status==401 && (
                "SESSION_INVALID".equalsIgnoreCase(code) ||
                "SESSION_EXPIRED".equalsIgnoreCase(code) ||
                "INVALID_SESSION".equalsIgnoreCase(code)));
    }
    static boolean terminalStreamFailure(Exception error){
        if(error instanceof StreamRateLimitException)return true;
        if(error instanceof GatewayException){
            int status=((GatewayException)error).status;
            return status==401||status==403||status==428||status==429;
        }
        return false;
    }
    private long streamHoldSeconds(){
        try{
            long deadline=Long.parseLong(store.get("mornyeStreamHoldUntil"));
            long remaining=deadline-System.currentTimeMillis();
            return remaining>0?(remaining+999L)/1000L:0;
        }catch(Exception ignored){return 0;}
    }
    private void setStreamHold(long seconds)throws Exception{
        long safe=Math.max(1L,Math.min(604800L,seconds));
        long newDeadline=System.currentTimeMillis()+safe*1000L;
        long oldDeadline=0;
        try{oldDeadline=Long.parseLong(store.get("mornyeStreamHoldUntil"));}
        catch(Exception ignored){}
        store.put("mornyeStreamHoldUntil",Long.toString(Math.max(oldDeadline,newDeadline)));
    }
    private static long retryAfterSeconds(HttpURLConnection connection,JSONObject json){
        String value=connection.getHeaderField("Retry-After");
        if(value!=null){
            value=value.trim();
            try{return Math.max(0L,Long.parseLong(value));}
            catch(Exception ignored){
                try{
                    long millis=ZonedDateTime.parse(value,DateTimeFormatter.RFC_1123_DATE_TIME)
                        .toInstant().toEpochMilli()-System.currentTimeMillis();
                    if(millis>0)return (millis+999L)/1000L;
                }catch(Exception ignoredDate){}
            }
        }
        long seconds=json.optLong("retry_after_seconds",json.optLong("retryAfterSeconds",0L));
        return Math.max(0L,seconds);
    }
    private static final long CHALLENGE_TTL_MS=180_000L;
    private static final String CALLBACK="mornye://session-grant";
    private static final SecureRandom RAND=new SecureRandom();
    private final SecureStore store;

    MornyeGateway(SecureStore store){ this.store=store; }

    static String randomHex(int count){
        byte[] bytes=new byte[count];RAND.nextBytes(bytes);
        StringBuilder b=new StringBuilder(count*2);
        for(byte x:bytes)b.append(String.format(Locale.ROOT,"%02x",x&255));
        return b.toString();
    }
    private static String hex(byte[] raw){
        StringBuilder b=new StringBuilder(raw.length*2);
        for(byte x:raw)b.append(String.format(Locale.ROOT,"%02x",x&255));
        return b.toString();
    }
    private static byte[] sha(byte[] data)throws Exception{
        return MessageDigest.getInstance("SHA-256").digest(data);
    }
    private static String shaHex(String s)throws Exception{return hex(sha(s.getBytes(StandardCharsets.UTF_8)));}
    private static String hmac(byte[] key,String data)throws Exception{
        Mac h=Mac.getInstance("HmacSHA256");
        h.init(new SecretKeySpec(key,"HmacSHA256"));
        return Base64.encodeToString(h.doFinal(data.getBytes(StandardCharsets.UTF_8)),
            Base64.URL_SAFE|Base64.NO_PADDING|Base64.NO_WRAP);
    }
    private static String encoded(String v)throws Exception{
        return URLEncoder.encode(v,"UTF-8");
    }
    private static String timestamp(long now){
        SimpleDateFormat date=new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",Locale.ROOT);
        date.setTimeZone(TimeZone.getTimeZone("UTC"));return date.format(new Date(now));
    }
    private String installId()throws Exception{
        String id=store.get("mornyeInstallId");
        if(!id.matches("[a-f0-9]{32}")){
            id=randomHex(16);store.put("mornyeInstallId",id);
        }
        return id;
    }
    boolean isConnected(){
        if(!"1".equals(store.get("mornyeActive")))return false;
        String sid=store.get("mornyeSessionId");
        String key=store.get("mornyeSecret");
        if(sid.isEmpty()||key.isEmpty())return false;
        String expiry=store.get("mornyeExpiry");
        if(expiry.isEmpty())return true;
        try{return Instant.parse(expiry).toEpochMilli()>System.currentTimeMillis();}
        catch(Exception ignored){return false;}
    }
    void disconnect()throws Exception{
        store.put("mornyeActive","");
        store.put("mornyeSessionId","");
        store.put("mornyeSecret","");
        store.put("mornyeExpiry","");
        clearPending();
    }
    private void clearPending()throws Exception{
        store.put("mornyePendingState","");
        store.put("mornyePendingAt","");
        store.put("mornyePendingUrl","");
    }
    private String requireState()throws Exception{
        String state=store.get("mornyePendingState");
        long created=0;
        try{created=Long.parseLong(store.get("mornyePendingAt"));}
        catch(Exception ignored){}
        if(state.isEmpty()||state.length()>4096||created<=0||
            System.currentTimeMillis()-created<0||
            System.currentTimeMillis()-created>=CHALLENGE_TTL_MS)
            throw new Exception("Mornye verification expired. Please connect again.");
        return state;
    }
    boolean awaitingVerification(){
        try{return !requireState().isEmpty();}
        catch(Exception ignored){return false;}
    }
    String challengeUrl()throws Exception{
        requireState();
        return store.get("mornyePendingUrl");
    }
    String pendingState()throws Exception{return requireState();}
    private static String callbackState(Uri uri,int depth){
        if(uri==null||depth>3)return "";
        String state=uri.getQueryParameter("state");
        if(state!=null&&!state.trim().isEmpty())return state.trim();
        for(String key:new String[]{"cb","callback","callback_url","redirect_uri"}){
            String nested=uri.getQueryParameter(key);
            if(nested!=null&&!nested.isEmpty()){
                String value=callbackState(Uri.parse(nested),depth+1);
                if(!value.isEmpty())return value;
            }
        }
        return "";
    }
    private JSONObject challenge(JSONObject result)throws Exception{
        String challengeId=result.optString("challenge_id","").trim();
        String authUrl=result.optString("auth_url","").trim();
        if(authUrl.isEmpty())authUrl=result.optString("challenge_url","").trim();
        String state=randomHex(24);
        if(!authUrl.isEmpty()){
            Uri original=Uri.parse(authUrl);
            if(!"https".equalsIgnoreCase(original.getScheme()))
                throw new Exception("Gateway verification requires a non-HTTPS page");
            // Preserve the server's callback state, including nested redirect URLs.
            String serverState=callbackState(original,0);
            if(!serverState.isEmpty())state=serverState;
            else authUrl=original.buildUpon().appendQueryParameter("state",state).build().toString();
        }else if(!challengeId.isEmpty()){
            String cb=Uri.parse(CALLBACK).buildUpon()
                .appendQueryParameter("cb_version","v2grant")
                .appendQueryParameter("state",state).build().toString();
            authUrl=BASE+"/challenge?id="+encoded(challengeId)+"&cb="+encoded(cb);
        }
        if(authUrl.isEmpty()){
            clearPending();
            return new JSONObject().put("connected",false).put("verificationRequired",false)
                .put("reason","Zarz bootstrap did not return a session or verification link.");
        }
        Uri parsed=Uri.parse(authUrl);
        if(!"https".equalsIgnoreCase(parsed.getScheme())||
             parsed.getHost()==null||parsed.getHost().isEmpty())
            throw new Exception("Untrusted Mornye verification URL");
        // The initial page is the Zarz verification service, not Qobuz Web Player.
        if(!"api.zarz.moe".equalsIgnoreCase(parsed.getHost())||
           parsed.getPath()==null||!parsed.getPath().startsWith("/v2/"))
            throw new Exception("Gateway supplied an unsupported verification URL.");
        store.put("mornyePendingState",state);
        store.put("mornyePendingAt",Long.toString(System.currentTimeMillis()));
        store.put("mornyePendingUrl",authUrl);
        return new JSONObject().put("connected",false)
            .put("verificationRequired",true)
            .put("verificationUrl",authUrl)
            .put("reason","Complete the Mornye gateway verification in the in-app window.");
    }
    JSONObject completeGrant(String state,String grant)throws Exception{
        if(grant==null||grant.trim().isEmpty()||grant.length()>16384)
            throw new Exception("Mornye callback did not include a valid session grant.");
        if(!requireState().equals(state))
            throw new Exception("Mornye callback state mismatch; sign-in was not accepted.");
        JSONObject exchange=http("POST","/session/exchange",
            new JSONObject().put("grant",grant.trim())
                .put("install_id",installId())
                .put("app_version",APP_VERSION)
                .put("platform",PLATFORM).toString(),null);
        remember(exchange);
        clearPending();
        return verifySession();
    }
    private JSONObject http(String method,String relative,String body,String[][] headers)throws Exception{
        if(!relative.startsWith("/")||relative.startsWith("//")||
           relative.contains("..")||relative.contains("\r")||relative.contains("\n"))
            throw new Exception("Invalid gateway path");
        URL address=new URL(BASE+relative);
        if(!"https".equalsIgnoreCase(address.getProtocol())||
           !"api.zarz.moe".equalsIgnoreCase(address.getHost()))
            throw new Exception("Unexpected gateway host");
        HttpURLConnection conn=(HttpURLConnection)address.openConnection();
        conn.setConnectTimeout(12000);conn.setReadTimeout(22000);
        conn.setInstanceFollowRedirects(false);
        conn.setRequestMethod(method);
        conn.setRequestProperty("Accept","application/json");
        conn.setRequestProperty("User-Agent","Mornye/"+APP_VERSION);
        if(headers!=null)for(String[] header:headers)
            if(header!=null&&header.length==2)conn.setRequestProperty(header[0],header[1]);
        if(body!=null&&!body.isEmpty()){
            conn.setDoOutput(true);conn.setRequestProperty("Content-Type","application/json");
            try(OutputStream out=conn.getOutputStream()){out.write(body.getBytes(StandardCharsets.UTF_8));}
        }
        int status=conn.getResponseCode();
        try(InputStream in=status>=400?conn.getErrorStream():conn.getInputStream()){
            ByteArrayOutputStream buffer=new ByteArrayOutputStream();
            if(in!=null){byte[] bytes=new byte[8192];int count;
                while((count=in.read(bytes))>=0){
                    if(buffer.size()+count>MAX_BYTES)throw new Exception("Gateway response too large");
                    buffer.write(bytes,0,count);
                }
            }
            String text=buffer.toString("UTF-8");
            JSONObject json;
            try{json=new JSONObject(text);}catch(Exception e){
                if(status==429&&(relative.startsWith("/dl/qbz")||relative.startsWith("/tickets"))){
                    long retry=retryAfterSeconds(conn,new JSONObject());
                    setStreamHold(retry>0?retry:120L);
                    throw new StreamRateLimitException(streamHoldSeconds());
                }
                throw new GatewayException(status,"NON_JSON",
                    "Mornye gateway returned HTTP "+status+" instead of JSON");
            }
            if(status<200||status>=300){
                String message=json.optString("message",json.optString("error","Request refused"));
                String code=json.optString("code","");
                if(status==429&&(relative.startsWith("/dl/qbz")||relative.startsWith("/tickets"))){
                    long retry=retryAfterSeconds(conn,json);
                    // A conservative pause when Zarz omits Retry-After.
                    setStreamHold(retry>0?retry:120L);
                    throw new StreamRateLimitException(streamHoldSeconds());
                }
                throw new GatewayException(status,code,"Mornye gateway HTTP "+status+
                    (code.isEmpty()?"":" ("+code+")")+": "+message);
            }
            return json;
        }finally{conn.disconnect();}
    }
    private JSONObject signed(String method,String relative,JSONObject body,String[][] extra)throws Exception{
        String sid=store.get("mornyeSessionId");
        String secret=store.get("mornyeSecret");
        if(sid.isEmpty()||secret.isEmpty())throw new Exception("Mornye signed session is not established");
        String raw=body==null?"":body.toString();
        long now=System.currentTimeMillis();
        String stamp=timestamp(now),nonce=randomHex(12);
        String digest=shaHex(raw);
        long window=(now/1000)/300;
        String rolling=hmac(secret.getBytes(StandardCharsets.UTF_8),window+":"+sid);
        String path=new URL(BASE+relative).getPath();
        String input=String.join("\n",SCHEME,method,path,"",digest,stamp,nonce,sid,APP_VERSION,PLATFORM);
        String signature=hmac(rolling.getBytes(StandardCharsets.UTF_8),input);
        String[][] core={
            {PREFIX+"Session",sid},{PREFIX+"Timestamp",stamp},
            {PREFIX+"Nonce",nonce},{PREFIX+"Body-SHA256",digest},
            {PREFIX+"Signature",signature},{PREFIX+"App-Version",APP_VERSION},
            {PREFIX+"Platform",PLATFORM}
        };
        String[][] headers=new String[core.length+(extra==null?0:extra.length)][];
        System.arraycopy(core,0,headers,0,core.length);
        if(extra!=null)System.arraycopy(extra,0,headers,core.length,extra.length);
        return http(method,relative,raw,headers);
    }
    private void remember(JSONObject raw)throws Exception{
        String id=raw.optString("session_id","");
        String key=raw.optString("session_secret","");
        String expiry=raw.optString("expires_at","");
        if(id.isEmpty()||key.isEmpty()||expiry.isEmpty())
            throw new Exception("Gateway did not issue a complete signed session");
        store.put("mornyeSessionId",id);
        store.put("mornyeSecret",key);
        store.put("mornyeExpiry",expiry);
    }
    /** Force a fresh bootstrap when playback returns 428 even if the old
     *  session still has a future expiry and can fetch catalogue metadata.
     *  No CAPTCHAs or server verification are bypassed. */
    JSONObject reconnectAfterVerificationRequired()throws Exception {
        store.put("mornyeActive","");
        store.put("mornyeSessionId","");
        store.put("mornyeSecret","");
        store.put("mornyeExpiry","");
        clearPending();
        return connect();
    }
    JSONObject connect()throws Exception{
        store.put("mornyeActive","");
        if(!isMaterialValid()){
            JSONObject result=http("GET","/bootstrap?app_version="+encoded(APP_VERSION)+
                "&install_id="+encoded(installId()),"",null);
            if(result.has("session_id")&&result.has("session_secret")){
                remember(result);
                clearPending();
            }else{
                return challenge(result);
            }
        }
        return verifySession();
    }
    private JSONObject verifySession()throws Exception{
        try {
            JSONObject probe=metadata("track/search",new JSONObject()
                .put("query","music").put("limit",1));
            if(!probe.has("tracks")&&!probe.has("items"))
                throw new Exception("Gateway metadata response is missing tracks");
            store.put("mornyeActive","1");
            return new JSONObject().put("connected",true).put("verified",true)
                .put("message","Mornye gateway verified using authenticated catalogue request");
        }catch(Exception e){
            store.put("mornyeActive","");
            // Keep the typed 401/428 error so explicit Connect Mornye can
            // start a fresh bootstrap rather than treating an expired session
            // as a generic sign-in failure.
            if(requiresVerification(e))throw e;
            throw new Exception("Mornye signed-session verification failed: "+e.getMessage());
        }
    }
    private boolean isMaterialValid(){
        if(store.get("mornyeSessionId").isEmpty()||store.get("mornyeSecret").isEmpty())
            return false;
        String expiry=store.get("mornyeExpiry");
        if(expiry.isEmpty())return true;
        try{return Instant.parse(expiry).toEpochMilli()>System.currentTimeMillis()+30_000;}
        catch(Exception ignored){return false;}
    }
    JSONObject metadata(String endpoint,JSONObject params)throws Exception{
        if(!endpoint.matches("[A-Za-z][A-Za-z0-9_-]*/[A-Za-z][A-Za-z0-9_-]*"))
            throw new Exception("Unsupported metadata endpoint");
        StringBuilder path=new StringBuilder("/qbz/").append(endpoint);
        path.append("?");
        if(params!=null){
            java.util.Iterator<String> keys=params.keys();
            while(keys.hasNext()){
                String k=keys.next(),v=params.optString(k,"");
                if(k.matches("[A-Za-z0-9_]+")&&!v.isEmpty())
                    path.append(encoded(k)).append("=").append(encoded(v)).append("&");
            }
        }
        path.append("app_id=798273057");
        return signed("GET",path.toString(),null,null);
    }
    JSONObject streamInfo(String id,int quality)throws Exception{
        long cooldown=streamHoldSeconds();
        if(cooldown>0)throw new StreamRateLimitException(cooldown);
        if(!id.matches("[0-9]{1,20}"))throw new Exception("Invalid Qobuz track ID");
        String track="https://open.qobuz.com/track/"+id;
        String hash=shaHex("qbz:track:"+track.toLowerCase(Locale.ROOT));
        JSONObject ticket=signed("POST","/tickets",new JSONObject()
            .put("capability","download_ticket").put("provider","qbz")
            .put("resource_hash",hash),null);
        String token=ticket.optString("ticket_id",ticket.optString("ticket",""));
        if(token.isEmpty())throw new Exception("Gateway did not issue an audio ticket");
        String tier=quality==27?"hi-res-max":quality==7?"hi-res":"cd";
        JSONObject response=signed("POST","/dl/qbz",new JSONObject()
            .put("quality",tier).put("upload_to_r2",false)
            .put("id",id).put("type","track").put("url",track),
            new String[][]{{"X-Zarz-Ticket",token}});
        JSONObject nested=response.optJSONObject("data");
        if(nested==null)nested=new JSONObject();
        String url=response.optString("download_url",
            response.optString("url",response.optString("link","")));
        if(url.isEmpty())url=nested.optString("download_url",nested.optString("url",nested.optString("link","")));
        if(!url.startsWith("https://"))throw new Exception("Gateway did not return a playable HTTPS stream");
        int depth=response.optInt("bit_depth",nested.optInt("bit_depth",0));
        double rate=response.optDouble("sampling_rate",nested.optDouble("sampling_rate",0));
        if(rate>0&&rate<1000)rate*=1000;
        // The gateway may supply a real average bitrate / size. Missing values
        // stay unknown; we never infer lossless bitrate from requested quality.
        long bytes=response.optLong("file_size",
            response.optLong("size",nested.optLong("file_size",nested.optLong("size",0L))));
        if(bytes<=0||bytes>20_000_000_000L)bytes=0;
        double kbps=response.optDouble("bitrate_kbps",nested.optDouble("bitrate_kbps",0));
        if(kbps<=0){
            kbps=response.optDouble("bitrate",nested.optDouble("bitrate",0));
            if(kbps>100000)kbps/=1000.0; // provider occasionally reports bps
        }
        if(kbps<8||kbps>50000)kbps=0;
        // AUREL passes this URL to MediaPlayer directly; no file export/download.
        boolean verified=depth>=8&&depth<=32&&rate>=8000&&rate<=768000;
        return new JSONObject()
            .put("url",url)
            .put("bits_depth",verified?depth:0)
            .put("sample_rate_hz",verified?(long)rate:0)
            .put("bit_depth",depth)
            .put("sampling_rate",rate)
            .put("source_verified",verified)
            .put("source_label","Mornye Zarz signed session")
            .put("codec","")
            .put("format_id",quality)
            .put("file_size",bytes)
            .put("source_bitrate_kbps",kbps>0?Math.round(kbps):0);
    }
}
