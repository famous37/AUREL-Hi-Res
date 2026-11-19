package com.aurel.hires;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Locale;

/** Optional LRCLIB lyrics lookup; no Qobuz/Mornye tokens, cookies or URLs sent. */
final class AurelLyricsClient {
    private static final String ORIGIN="https://lrclib.net";
    private static final int MAX_RESPONSE=128*1024;
    private static final long POSITIVE_TTL=24L*60*60*1000,NEGATIVE_TTL=20L*60*1000;
    private static final class Entry {
        final JSONObject value;final long expires;
        Entry(JSONObject value,long expires){this.value=value;this.expires=expires;}
    }
    private final LinkedHashMap<String,Entry> cache=new LinkedHashMap<String,Entry>(48,.75f,true){
        @Override protected boolean removeEldestEntry(java.util.Map.Entry<String,Entry> e){
            return size()>48;
        }
    };
    private static String clean(String value,int limit){
        if(value==null)return "";
        String safe=value.trim().replaceAll("[\\p{Cntrl}&&[^\\n\\r\\t]]","");
        return safe.substring(0,Math.min(safe.length(),limit));
    }
    private static String enc(String s){
        return URLEncoder.encode(s,StandardCharsets.UTF_8);
    }
    private static String normalized(String s){
        return s==null?"":s.toLowerCase(Locale.ROOT).trim()
            .replaceAll("[^\\p{L}\\p{N}]+"," ");
    }
    private static String request(String path)throws Exception {
        HttpURLConnection connection=null;
        try {
            URL url=new URL(ORIGIN+path);
            connection=(HttpURLConnection)url.openConnection();
            connection.setConnectTimeout(5500);
            connection.setReadTimeout(7000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Accept","application/json");
            connection.setRequestProperty("User-Agent","AUREL-Hi-Res/Stage2 (lyrics lookup; https://github.com/famous37/AUREL-Hi-Res)");
            int status=connection.getResponseCode();
            if(status==404)return null;
            if(status==429)throw new Exception("LRCLIB rate limit; try again later");
            if(status!=200)throw new Exception("LRCLIB HTTP "+status);
            int size=connection.getContentLength();
            if(size>MAX_RESPONSE)throw new Exception("Lyrics response is too large");
            try(InputStream in=connection.getInputStream();
                ByteArrayOutputStream out=new ByteArrayOutputStream()){
                byte[] buf=new byte[4096];int n;
                while((n=in.read(buf))!=-1){
                    if(out.size()+n>MAX_RESPONSE)throw new Exception("Lyrics response is too large");
                    out.write(buf,0,n);
                }
                return out.toString(StandardCharsets.UTF_8.name());
            }
        }finally{if(connection!=null)connection.disconnect();}
    }
    private static JSONObject sanitized(JSONObject raw)throws Exception {
        if(raw==null)return new JSONObject().put("status","missing");
        if(raw.optBoolean("instrumental"))
            return new JSONObject().put("status","instrumental").put("provider","LRCLIB");
        String synced=raw.optString("syncedLyrics","");
        String plain=raw.optString("plainLyrics","");
        if(synced.length()>80000)synced="";
        if(plain.length()>80000)plain="";
        if(synced.isEmpty()&&plain.isEmpty())return new JSONObject().put("status","missing");
        return new JSONObject().put("status","ok").put("provider","LRCLIB")
            .put("syncedLyrics",synced).put("plainLyrics",plain);
    }
    /** Called only when the user opens the lyrics sheet, never during normal playback. */
    synchronized JSONObject find(String title,String artist,String album,int durationSeconds)throws Exception{
        title=clean(title,160);artist=clean(artist,160);album=clean(album,160);
        if(title.isEmpty()||artist.isEmpty()||title.length()>160||artist.length()>160)
            throw new Exception("Track title and artist are required for lyrics");
        int seconds=Math.max(0,Math.min(24*60*60,durationSeconds));
        String key=title+"|"+artist+"|"+album+"|"+seconds;
        Entry existing=cache.get(key);
        if(existing!=null&&existing.expires>System.currentTimeMillis())
            return new JSONObject(existing.value.toString());
        String query="?artist_name="+enc(artist)+"&track_name="+enc(title);
        if(!album.isEmpty())query+="&album_name="+enc(album);
        if(seconds>0)query+="&duration="+seconds;
        JSONObject matched=null;
        try{
            String direct=request("/api/get"+query);
            if(direct!=null)matched=new JSONObject(direct);
        }catch(Exception e){
            if(!e.getMessage().startsWith("LRCLIB HTTP 400"))throw e;
        }
        // Exact lookup can fail for editions/remasters. Search only metadata;
        // never show another artist's lyrics merely because the title matches.
        if(matched==null){
            String search=request("/api/search?track_name="+enc(title)+"&artist_name="+enc(artist));
            if(search!=null){
                JSONArray list=new JSONArray(search);
                for(int i=0;i<Math.min(list.length(),15);i++){
                    JSONObject option=list.optJSONObject(i);
                    if(option==null)continue;
                    if(!normalized(option.optString("trackName")).equals(normalized(title)))continue;
                    if(!normalized(option.optString("artistName")).equals(normalized(artist)))continue;
                    int candidate=option.optInt("duration",0);
                    if(seconds>0&&candidate>0&&Math.abs(candidate-seconds)>3)continue;
                    matched=option;break;
                }
            }
        }
        JSONObject outcome=sanitized(matched);
        cache.put(key,new Entry(outcome,System.currentTimeMillis()+
            ("ok".equals(outcome.optString("status"))?POSITIVE_TTL:NEGATIVE_TTL)));
        return new JSONObject(outcome.toString());
    }
}
