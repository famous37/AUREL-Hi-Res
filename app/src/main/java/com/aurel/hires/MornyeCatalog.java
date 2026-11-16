package com.aurel.hires;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Read-only official Mornye Qobuz extension registry compatibility tracker.
 * This is deliberately NOT a plugin executor: qobuz-web.sflx needs Mornye's
 * signedSession@3, sessionGrant@1, and the Zarz gateway protocol.
 *
 * We fetch only version/manifest metadata, never remote executable JavaScript.
 * Automatic checking cannot silently change authentication or player code.
 */
final class MornyeCatalog {
    private static final String URL_REGISTRY=
        "https://raw.githubusercontent.com/mornyeapp/Mornye-Extension/main/registry.json";
    private static final String SOURCE=
        "https://github.com/mornyeapp/Mornye-Extension/tree/main/sources/qobuz-web";
    private static final long CHECK_INTERVAL=24L*60*60*1000;
    private final SharedPreferences prefs;
    MornyeCatalog(Context ctx){
        prefs=ctx.getSharedPreferences("mornye_compatibility",Context.MODE_PRIVATE);
    }
    private String downloadRegistry()throws Exception{
        HttpURLConnection c=(HttpURLConnection)new URL(URL_REGISTRY).openConnection();
        c.setConnectTimeout(9000);c.setReadTimeout(13000);
        c.setInstanceFollowRedirects(false);
        c.setRequestProperty("Accept","application/json");
        c.setRequestProperty("Cache-Control","no-cache");
        try{
            if(c.getResponseCode()!=200)
                throw new Exception("Mornye registry HTTP "+c.getResponseCode());
            ByteArrayOutputStream buffer=new ByteArrayOutputStream();
            try(InputStream in=c.getInputStream()){
                byte[] bytes=new byte[8192];int len;
                while((len=in.read(bytes))!=-1){
                    if(buffer.size()+len>1_500_000)throw new Exception("Registry is too large");
                    buffer.write(bytes,0,len);
                }
            }
            return buffer.toString("UTF-8");
        }finally{c.disconnect();}
    }
    synchronized JSONObject status(boolean force)throws Exception{
        long now=System.currentTimeMillis();
        long checked=prefs.getLong("checked",0);
        String version=prefs.getString("version","");
        if(force||version.isEmpty()||now-checked>CHECK_INTERVAL){
            try{
                JSONObject index=new JSONObject(downloadRegistry());
                JSONArray entries=index.getJSONArray("extensions");
                JSONObject extension=null;
                for(int i=0;i<entries.length();i++){
                    JSONObject candidate=entries.getJSONObject(i);
                    if("qobuz-web".equals(candidate.optString("id"))){
                        extension=candidate;break;
                    }
                }
                if(extension==null)throw new Exception("qobuz-web not found in official registry");
                String next=extension.optString("version","");
                String sha=extension.optString("sha256","");
                String url=extension.optString("download_url","");
                if(!next.matches("[0-9]+\\.[0-9]+\\.[0-9]+(?:-[a-zA-Z0-9.-]+)?")||
                    !sha.matches("[0-9a-fA-F]{64}")||
                    !url.equals("https://raw.githubusercontent.com/mornyeapp/Mornye-Extension/main/extensions/qobuz-web.sflx"))
                    throw new Exception("Mornye registry entry failed validation");
                prefs.edit().putString("version",next).putString("sha256",sha)
                    .putLong("checked",now).remove("error").apply();
            }catch(Exception error){
                prefs.edit().putString("error",error.getMessage()).putLong("checked",now).apply();
            }
        }
        JSONObject result=new JSONObject();
        result.put("name","Qobuz Web (Mornye)");
        result.put("version",prefs.getString("version",""));
        result.put("sha256",prefs.getString("sha256",""));
        result.put("source",SOURCE);
        result.put("checkedAt",prefs.getLong("checked",0));
        result.put("automaticChecks",true);
        result.put("nativeRuntimeAvailable",false);
        result.put("error",prefs.getString("error",""));
        result.put("message",
            "Mornye's extension needs a signed-session runtime. AUREL checks upstream versions, "+
            "but cannot run or auto-install the extension's code. Qobuz Web sign-in "+
            "uses the official website instead.");
        return result;
    }
}
