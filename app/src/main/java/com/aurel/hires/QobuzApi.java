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
        c.setRequestProperty("User-Agent","AurelHiRes/0.5 Android");
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
            if(code>=400)throw new Exception("Qobuz HTTP "+code+": "+body.optString("message",body.optString("error","Request rejected")));
            return body;
        }finally{c.disconnect();}
    }
    private String streamId(){String id=store.get("streamAppId");return id.isEmpty()?(store.get("appId").isEmpty()?store.get("libraryAppId"):store.get("appId")):id;}
    private String streamToken(){String t=store.get("streamToken");return t.isEmpty()?(store.get("token").isEmpty()?store.get("libraryToken"):store.get("token")):t;}
    private String streamSecret(){String s=store.get("streamAppSecret");return s.isEmpty()?store.get("appSecret"):s;}
    private String libraryId(){String id=store.get("libraryAppId");return id.isEmpty()?streamId():id;}
    private String libraryToken(){String t=store.get("libraryToken");return t.isEmpty()?streamToken():t;}

    JSONObject catalog(String endpoint,JSONObject args)throws Exception{return request(endpoint,args,false,streamId(),streamToken());}
    JSONObject library(String endpoint,JSONObject args)throws Exception{return request(endpoint,args,false,libraryId(),libraryToken());}
    JSONObject libraryPost(String endpoint,JSONObject args)throws Exception{return request(endpoint,args,true,libraryId(),libraryToken());}
    JSONObject get(String endpoint, JSONObject params)throws Exception{return catalog(endpoint,params);}
    JSONObject post(String endpoint, JSONObject params)throws Exception{return libraryPost(endpoint,params);}

    JSONObject verifyToken(String appId,String token)throws Exception{
        if(!appId.matches("\\d{3,15}")||token.trim().isEmpty())throw new Exception("Enter an App ID and a session token");
        try {return request("user/login",new JSONObject().put("extra","partner"),true,appId,token);}
        catch(Exception first){
            // The user/login profile request is not supported by every integration.
            // This verifies the token against the server, without asserting a profile that was not returned.
            JSONObject f=request("favorite/getUserFavorites",new JSONObject().put("type","albums").put("limit",1),false,appId,token);
            return new JSONObject().put("validated",true).put("profile_unavailable",true).put("favorites",f);
        }
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
