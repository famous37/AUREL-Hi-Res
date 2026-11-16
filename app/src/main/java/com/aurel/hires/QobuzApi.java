package com.aurel.hires;

import org.json.JSONObject;
import java.net.URL;
import java.net.URLEncoder;
import java.net.HttpURLConnection;
import java.nio.charset.StandardCharsets;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.ByteArrayOutputStream;
import java.security.MessageDigest;
import java.util.Iterator;

/** Separate rights-bearing streaming credentials from the optional collection account.
 *  Qobuz API access is subject to the provider's developer terms and authorizations.
 */
final class QobuzApi {
    private static final String BASE="https://www.qobuz.com/api.json/0.2/";
    private final SecureStore store;
    /** Qobuz status without token, API secret or request headers in diagnostics. */
    static final class ApiException extends Exception {
        final int status;
        final String endpoint;
        ApiException(int status,String endpoint,String message){
            super(message);this.status=status;this.endpoint=endpoint;
        }
    }
    QobuzApi(SecureStore store) {this.store=store;}

    private String encode(String s) throws Exception {return URLEncoder.encode(s,"UTF-8");}
    private String query(JSONObject data) throws Exception {
        StringBuilder b=new StringBuilder();
        Iterator<String> keys=data.keys();
        while(keys.hasNext()) {
            String k=keys.next();if(b.length()>0)b.append('&');
            b.append(encode(k)).append('=').append(encode(data.optString(k)));
        }
        return b.toString();
    }
    private JSONObject request(String endpoint, JSONObject data, boolean post, String appId, String token) throws Exception {
        if(!endpoint.matches("[a-zA-Z]+/[a-zA-Z]+"))throw new IllegalArgumentException("Invalid API endpoint");
        if(appId.isEmpty())throw new IllegalArgumentException("App ID is required for the selected account");
        String payload=query(data);
        URL url=new URL(BASE+endpoint+(post?"":payload.isEmpty()?"":"?"+payload));
        HttpURLConnection c=(HttpURLConnection)url.openConnection();
        c.setConnectTimeout(12000);c.setReadTimeout(18000);c.setInstanceFollowRedirects(false);
        c.setRequestProperty("Accept","application/json");
        c.setRequestProperty("X-App-Id",appId);
        c.setRequestProperty("User-Agent","AurelHiRes/0.6 Android");
        if(!token.isEmpty())c.setRequestProperty("X-User-Auth-Token",token);
        if(post){
            c.setRequestMethod("POST");c.setDoOutput(true);
            c.setRequestProperty("Content-Type","application/x-www-form-urlencoded; charset=UTF-8");
            try(OutputStream out=c.getOutputStream()){out.write(payload.getBytes(StandardCharsets.UTF_8));}
        }
        try{
            int code=c.getResponseCode();
            InputStream in=code<400?c.getInputStream():c.getErrorStream();
            ByteArrayOutputStream out=new ByteArrayOutputStream();
            if(in!=null)try(InputStream input=in){byte[] buf=new byte[8192];int n;
                while((n=input.read(buf))>=0){if(out.size()+n>5_000_000)throw new Exception("API response too large");out.write(buf,0,n);}
            }
            String text=out.toString("UTF-8");
            JSONObject body=text.isEmpty()?new JSONObject():new JSONObject(text);
            if(code>=300||"error".equalsIgnoreCase(body.optString("status"))){
                int status=code>=300?code:body.optInt("code",500);
                // Root identifiers are Qobuz server trace IDs, not evidence of a valid session.
                String detail=body.optString("message",body.optString("error","Request rejected"))
                    .replaceAll("\\s*\\(Root=[^)]*\\)","").trim();
                if(status==401||status==403)
                    throw new ApiException(status,endpoint,
                        "Qobuz HTTP "+status+": token authentication rejected for this App ID. "+
                        "Use the X-App-Id paired with your token, or obtain a fresh token.");
                throw new ApiException(status,endpoint,"Qobuz HTTP "+status+": "+detail);
            }
            return body;
        }finally{c.disconnect();}
    }
    private String streamId(){
        String id=store.get("streamAppId");
        if(id.isEmpty())id=store.get("appId");
        return id.isEmpty()?"312369995":id;
    }
    private String streamToken(){
        String t=store.get("streamToken");
        return t.isEmpty()?store.get("token"):t;
    }
    private String streamSecret(){String s=store.get("streamAppSecret");return s.isEmpty()?store.get("appSecret"):s;}
    private String libraryId(){String id=store.get("libraryAppId");return id.isEmpty()?streamId():id;}
    private String libraryToken(){String t=store.get("libraryToken");return t.isEmpty()?streamToken():t;}

    JSONObject catalog(String endpoint,JSONObject args)throws Exception{return request(endpoint,args,false,streamId(),streamToken());}
    JSONObject library(String endpoint,JSONObject args)throws Exception{return request(endpoint,args,false,libraryId(),libraryToken());}
    JSONObject libraryPost(String endpoint,JSONObject args)throws Exception{return request(endpoint,args,true,libraryId(),libraryToken());}
    JSONObject get(String endpoint, JSONObject params)throws Exception{return catalog(endpoint,params);}
    /** Test the selected account on a genuinely authenticated endpoint before
     *  recording a login as verified. A token without a matching App ID can be
     *  syntactically valid yet receive 401 for every Qobuz API request.
     */
    JSONObject validateLiveToken(String appId,String token,String optionalUserId)throws Exception{
        if(appId==null||!appId.matches("[0-9]{3,15}"))
            throw new Exception("Enter the numeric X-App-Id that belongs to the token source.");
        if(token==null||token.trim().length()<10)
            throw new Exception("Paste the complete Qobuz X-User-Auth-Token.");
        JSONObject args=new JSONObject().put("type","albums").put("limit",1);
        String uid=optionalUserId==null?"":optionalUserId.trim();
        if(!uid.isEmpty()){
            if(!uid.matches("[0-9]{1,20}"))throw new Exception("User ID must contain digits only.");
            args.put("user_id",uid);
        }
        try{
            JSONObject result=request("favorite/getUserFavorites",args,false,appId,token);
            if(!result.has("albums")&&!result.has("tracks")&&!result.has("artists"))
                throw new Exception("Qobuz did not return a recognizable authenticated library response.");
            // Some Qobuz backends treat favourites differently from catalogue
            // routes. Both user entitlement AND App ID catalogue access are
            // required, otherwise a misleading login-success leads to 401
            // on the first search/album page.
            JSONObject catalogue=request("album/getFeatured",
                new JSONObject().put("type","new-releases").put("limit",1),
                false,appId,token);
            if(!catalogue.has("albums")&&!catalogue.has("items"))
                throw new Exception("Qobuz did not return a recognizable catalogue response for this App ID.");
            return new JSONObject().put("validated",true)
                .put("validation_status","verified")
                .put("profile_unavailable",true);
        }catch(ApiException e){
            if(e.status==401||e.status==403)
                throw new Exception("Qobuz rejected this token with App ID "+appId+
                    " (HTTP "+e.status+"). AUREL cannot authenticate using an unrelated "+
                    "App ID. Use the matching X-App-Id from the service that issued "+
                    "the token, or obtain a new token and its matching App ID.");
            throw e;
        }
    }
    /** Fallback to documented album discovery when a newer discover endpoint
     *  is restricted to some Qobuz client capabilities.
     */
    JSONObject discoverReleases(int limit)throws Exception{
        int safeLimit=Math.max(1,Math.min(48,limit));
        try{
            return catalog("discover/newReleases",new JSONObject().put("limit",safeLimit));
        }catch(ApiException e){
            if(e.status!=401&&e.status!=403&&e.status!=404&&e.status!=400)throw e;
            return catalog("album/getFeatured",
                new JSONObject().put("type","new-releases").put("limit",safeLimit));
        }
    }

    JSONObject post(String endpoint, JSONObject params)throws Exception{return libraryPost(endpoint,params);}

    /** Validate an existing browser session token without reusing password login.
     *  Certain Qobuz integrations reject profile or favourites endpoints for an
     *  otherwise usable playback session, so a user may explicitly save unverified
     *  credentials. That choice never masquerades as successful verification.
     */
    JSONObject verifyToken(String appId,String token,String optionalUserId,boolean useWithoutPrecheck)throws Exception{
        if(appId==null||!appId.matches("\\d{3,15}"))
            throw new Exception("Enter a valid numeric Qobuz App ID");
        if(token==null||token.trim().length()<10)
            throw new Exception("Enter the complete X-User-Auth-Token from your Qobuz session");
        String uid=optionalUserId==null?"":optionalUserId.trim();
        if(!uid.isEmpty()&&!uid.matches("\\d{1,20}"))
            throw new Exception("Optional User ID must contain digits only");
        if(useWithoutPrecheck){
            // Explicit opt-in: the user can attempt actual streaming but the session
            // must be described as unverified until Qobuz confirms it.
            return new JSONObject().put("validated",false)
                .put("profile_unavailable",true)
                .put("validation_status","unverified")
                .put("validation_note","Token saved without API verification; playback must be tested.");
        }
        Exception loginFailure=null;
        try{
            JSONObject profile=request("user/login",
                new JSONObject().put("extra","partner"),true,appId,token);
            // The endpoint can succeed without a user object.
            if(profile.has("user"))return profile.put("validated",true);
            loginFailure=new Exception("Profile endpoint did not return an account");
        }catch(Exception e){loginFailure=e;}
        try{
            JSONObject params=new JSONObject().put("type","albums").put("limit",1);
            if(!uid.isEmpty())params.put("user_id",uid);
            JSONObject favorites=request("favorite/getUserFavorites",params,false,appId,token);
            return new JSONObject().put("validated",true).put("profile_unavailable",true)
                .put("validation_status","verified").put("favorites",favorites);
        }catch(Exception favoritesFailure){
            // Neither request confirms validity. Don't discard the token, don't
            // assert it is good, and don't convert failed auth into success.
            throw new Exception("Qobuz did not validate this token ("+
                favoritesFailure.getMessage()+"). If the same token still plays "+
                "in another client, choose 'Use token without precheck' and test "+
                "playback. Otherwise obtain a fresh Qobuz session token.");
        }
    }
    JSONObject verifyToken(String appId,String token)throws Exception{
        return verifyToken(appId,token,"",false);
    }
    JSONObject passwordLogin(String appId,String email,String password)throws Exception{
        if(!appId.matches("\\d{3,15}")||email.trim().isEmpty()||password.isEmpty())
            throw new Exception("Enter account name, password and App ID");
        // Direct password login is legacy, optional and can fail with CAPTCHA/OAuth challenges.
        Exception original;
        try{return request("user/login",new JSONObject().put("email",email).put("password",password),true,appId,"");}
        catch(Exception e){original=e;}
        try{return request("user/login",new JSONObject().put("username",email).put("password",password),true,appId,"");}
        catch(Exception e){throw new Exception("Qobuz did not accept direct password login (browser verification may be required): "+e.getMessage());}
    }
    private String md5(String v)throws Exception{
        byte[] raw=MessageDigest.getInstance("MD5").digest(v.getBytes(StandardCharsets.UTF_8));
        StringBuilder b=new StringBuilder();for(byte item:raw)b.append(String.format(java.util.Locale.US,"%02x",item&0xff));return b.toString();
    }
    private JSONObject audioInfo(JSONObject raw,String origin) throws Exception {
        JSONObject info=new JSONObject(raw.toString());
        int bitDepth=raw.optInt("bits_depth",raw.optInt("bit_depth",0));
        double sr=raw.optDouble("sampling_rate",raw.optDouble("sample_rate",0));
        int format=raw.optInt("format_id",0);
        if(sr>=8&&sr<=768)sr*=1000;  // Qobuz versions expose either kHz or Hz.
        String mime=raw.optString("mime_type","").toLowerCase(java.util.Locale.ROOT);
        String codec=mime.contains("flac")?"FLAC":mime.contains("mpeg")?"MP3":"";
        boolean verified=sr>=8000&&sr<=768000&&bitDepth>0&&bitDepth<=32;
        // A format selection is only a ceiling; do not synthesize source specs from format_id.
        info.put("bits_depth",verified?bitDepth:0);
        info.put("sample_rate_hz",verified?sr:0);
        info.put("source_verified",verified);
        info.put("source_label",origin);
        info.put("codec",codec);
        info.put("format_id",format);
        return info;
    }
    JSONObject streamInfo(String trackId,int format)throws Exception{
        String secret=streamSecret();
        if(secret.isEmpty())throw new Exception("Enter a streaming App Secret in Audio & Account");
        if(!trackId.matches("[0-9]+"))throw new Exception("Invalid Qobuz track ID");
        long ts=System.currentTimeMillis()/1000L;
        JSONObject args=new JSONObject().put("format_id",format).put("intent","stream").put("track_id",trackId).put("request_ts",ts);
        args.put("request_sig",md5("trackgetFileUrlformat_id"+format+"intentstreamtrack_id"+trackId+ts+secret));
        Exception oldError=null;
        try {
            JSONObject info=catalog("track/getFileUrl",args);
            if(info.optString("url").startsWith("https://"))return audioInfo(info,"Qobuz API");
        }catch(Exception e){oldError=e;}
        // New Qobuz responses can require a licensed decryption/session integration.
        args.put("request_sig",md5("fileUrlformat_id"+format+"intentstreamtrack_id"+trackId+ts+secret));
        try {
            JSONObject info=catalog("file/url",args);
            if(info.optString("url").startsWith("https://"))return audioInfo(info,"Qobuz API");
            if(info.has("url_template")||info.has("key_id"))
                throw new Exception("Qobuz returned protected segmented audio. This build does not decrypt or bypass protected streams.");
            throw new Exception("Qobuz did not supply a directly playable URL");
        }catch(Exception e){
            if(oldError!=null&&!e.getMessage().contains("protected segmented"))
                throw new Exception("Stream unavailable. Legacy API: "+oldError.getMessage()+"; current API: "+e.getMessage());
            throw e;
        }
    }


}
