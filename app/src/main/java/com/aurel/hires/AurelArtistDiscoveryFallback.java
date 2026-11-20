package com.aurel.hires;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Locale;

/**
 * Optional public chart/category metadata, resolved back to real Qobuz IDs.
 *
 * Qobuz artist/page and artist/getReleasesList may be restricted even when
 * catalog search and playback are available. Deezer's public catalogue can
 * supply an independently sourced popularity ranking and release category,
 * but NEVER an AUREL playable ID, audio URL, session, or fake Qobuz ranking.
 * Every displayed item must be independently matched to this artist in Qobuz.
 */
final class AurelArtistDiscoveryFallback {
    interface Catalogue {
        JSONObject query(String endpoint, JSONObject params) throws Exception;
    }

    private final Catalogue catalogue;
    AurelArtistDiscoveryFallback(Catalogue catalogue) { this.catalogue=catalogue; }

    private static String encode(String text) throws Exception {
        return URLEncoder.encode(text,"UTF-8");
    }
    private static String normalized(String text) {
        if(text==null)return "";
        String value=Normalizer.normalize(text,Normalizer.Form.NFD)
            .replaceAll("\\p{M}+","")
            .toLowerCase(Locale.ROOT);
        // Edition descriptors are commonly omitted from Deezer's top-track list.
        value=value.replaceAll("\\s*[\\(\\[][^\\)\\]]+[\\)\\]]"," ");
        return value.replaceAll("[^\\p{L}\\p{N}]+"," ").trim().replaceAll("\\s+"," ");
    }
    private static JSONArray list(JSONObject response,String collection) {
        if(response==null)return new JSONArray();
        Object data=response.opt(collection);
        if(data instanceof JSONArray)return (JSONArray)data;
        if(data instanceof JSONObject){
            JSONArray items=((JSONObject)data).optJSONArray("items");
            if(items!=null)return items;
            items=((JSONObject)data).optJSONArray("data");
            if(items!=null)return items;
        }
        JSONArray flat=response.optJSONArray("items");
        return flat==null?new JSONArray():flat;
    }
    private static JSONObject entry(JSONArray array,int index) {
        JSONObject o=array.optJSONObject(index);
        return o==null?new JSONObject():o;
    }
    /** The only non-Qobuz network host used. No redirects, cookies or tokens. */
    private static JSONObject publicDeezer(String path) throws Exception {
        if(!path.matches("(?:search/artist\\?q=[^\\r\\n]*|artist/[0-9]{1,20}/(?:top|albums)\\?limit=[0-9]{1,3})"))
            throw new IllegalArgumentException("Invalid public metadata route");
        URL url=new URL("https://api.deezer.com/"+path);
        if(!"api.deezer.com".equalsIgnoreCase(url.getHost()))
            throw new IllegalArgumentException("Unexpected public metadata host");
        HttpURLConnection conn=(HttpURLConnection)url.openConnection();
        conn.setConnectTimeout(4500);
        conn.setReadTimeout(6500);
        conn.setInstanceFollowRedirects(false);
        conn.setUseCaches(true);
        conn.setRequestProperty("Accept","application/json");
        conn.setRequestProperty("User-Agent","AurelHiRes/1.1 Android");
        try {
            if(conn.getResponseCode()!=200)
                throw new Exception("Independent catalogue unavailable");
            try(InputStream in=conn.getInputStream()){
                ByteArrayOutputStream buffer=new ByteArrayOutputStream();
                byte[] bytes=new byte[4096];int n;
                while((n=in.read(bytes))!=-1){
                    if(buffer.size()+n>1_500_000)
                        throw new Exception("Independent catalogue response too large");
                    buffer.write(bytes,0,n);
                }
                JSONObject result=new JSONObject(buffer.toString("UTF-8"));
                if(result.has("error"))throw new Exception("Independent catalogue rejected request");
                return result;
            }
        }finally{conn.disconnect();}
    }
    private static String canonicalArtistId(String name)throws Exception {
        JSONArray artists=list(publicDeezer("search/artist?q="+encode(name)+"&limit=15"),"data");
        for(int i=0;i<artists.length()&&i<15;i++){
            JSONObject artist=entry(artists,i);
            String candidate=artist.optString("name","");
            String id=artist.optString("id","");
            if(normalized(name).equals(normalized(candidate))&&id.matches("[0-9]{1,20}"))
                return id;
        }
        throw new Exception("No exact public artist match");
    }

    /** The artist ID must be verified inside Qobuz, not inferred from matching titles. */
    private static boolean owner(JSONObject object,String ownerId,String artistName) {
        if(object==null)return false;
        JSONObject artist=object.optJSONObject("artist");
        if(artist==null)artist=object.optJSONObject("main_artist");
        if(artist==null){
            JSONObject album=object.optJSONObject("album");
            if(album!=null)artist=album.optJSONObject("artist");
        }
        if(artist==null)return false;
        String id=artist.optString("id","");
        if(!id.isEmpty())return ownerId.equals(id);
        return normalized(artistName).equals(normalized(artist.optString("name","")));
    }
    private static String safeId(JSONObject o) {
        String id=o.optString("id","");
        return id.matches("[A-Za-z0-9]{1,72}")?id:"";
    }
    private JSONArray qobuz(String endpoint,String query,int limit) throws Exception {
        JSONObject response=catalogue.query(endpoint,new JSONObject()
            .put("query",query).put("limit",limit).put("offset",0));
        return list(response,endpoint.startsWith("track/")?"tracks":"albums");
    }
    private static JSONObject unwrap(JSONObject o,String field) {
        JSONObject nested=o.optJSONObject(field);
        return nested==null?o:nested;
    }
    private static ArrayList<JSONObject> candidates(JSONArray array,String field,
        String ownerId,String artistName) {
        ArrayList<JSONObject> matches=new ArrayList<>();
        for(int i=0;i<array.length()&&i<100;i++){
            JSONObject record=unwrap(entry(array,i),field);
            if(!safeId(record).isEmpty()&&owner(record,ownerId,artistName))
                matches.add(record);
        }
        return matches;
    }
    private static JSONObject trackMatch(String title,String isrc,
        ArrayList<JSONObject> candidates) {
        String key=normalized(title);
        if(key.isEmpty())return null;
        for(JSONObject track:candidates){
            if(!isrc.isEmpty()&&isrc.equalsIgnoreCase(track.optString("isrc","")))
                return track;
        }
        for(JSONObject track:candidates){
            if(key.equals(normalized(track.optString("title",""))))
                return track;
        }
        return null;
    }
    private static JSONObject albumMatch(String title,ArrayList<JSONObject> candidates) {
        String key=normalized(title);
        if(key.isEmpty())return null;
        for(JSONObject album:candidates){
            if(key.equals(normalized(album.optString("title",""))))
                return album;
        }
        return null;
    }
    private static boolean shortType(String type){
        return "single".equals(type)||"ep".equals(type)||"epsingle".equals(type);
    }
    private static String sourceType(JSONObject deezer) {
        return deezer.optString("record_type",
            deezer.optString("album_type","")).toLowerCase(Locale.ROOT)
                .replaceAll("[ _-]","");
    }

    JSONObject discover(String ownerId,String artistName) throws Exception {
        if(!ownerId.matches("[0-9]{1,20}")||artistName==null
            ||artistName.trim().isEmpty()||artistName.length()>160)
            throw new IllegalArgumentException("Invalid artist identifier");
        JSONObject result=new JSONObject().put("_provider","deezer")
            .put("top_tracks",new JSONObject().put("items",new JSONArray()))
            .put("eps",new JSONObject().put("items",new JSONArray()));
        final String deezerId;
        try{deezerId=canonicalArtistId(artistName);}
        catch(Exception unavailable){
            return result.put("_error","No matching independent metadata source");
        }

        // One artist page must not spawn dozens of slow Qobuz lookups.
        // Leave headroom for both top tracks and EP discovery.
        final long started=System.nanoTime();
        // A true independent popularity chart, never the arbitrary order of
        // track/search. The playable objects still come exclusively from Qobuz.
        try{
            JSONArray ranked=list(publicDeezer("artist/"+deezerId+"/top?limit=16"),"data");
            ArrayList<JSONObject> owned=new ArrayList<>();
            try{owned=candidates(qobuz("track/search",artistName+" #ByMainArtist",100),
                "track",ownerId,artistName);}
            catch(Exception ignored){}
            if(owned.isEmpty())
                owned=candidates(qobuz("track/search",artistName,100),
                    "track",ownerId,artistName);
            JSONArray matched=new JSONArray();HashSet<String> seen=new HashSet<>();
            for(int i=0;i<ranked.length()&&matched.length()<12;i++){
                JSONObject external=entry(ranked,i);
                JSONObject externalArtist=external.optJSONObject("artist");
                if(externalArtist!=null&&!deezerId.equals(externalArtist.optString("id","")))
                    continue;
                JSONObject chosen=trackMatch(
                    external.optString("title_short",external.optString("title","")),
                    external.optString("isrc",""),owned);
                if(chosen==null&&i<2&&System.nanoTime()-started<15_000_000_000L){
                    try{
                        ArrayList<JSONObject> exact=candidates(qobuz("track/search",
                            artistName+" "+external.optString("title",""),25),
                            "track",ownerId,artistName);
                        chosen=trackMatch(external.optString("title",""),
                            external.optString("isrc",""),exact);
                    }catch(Exception ignored){}
                }
                if(chosen!=null&&seen.add(safeId(chosen)))matched.put(chosen);
            }
            if(matched.length()>0)
                result.put("top_tracks",new JSONObject().put("items",matched))
                    .put("_topSource","deezer");
        }catch(Exception unavailable){
            result.put("_topError","Independent chart or Qobuz track lookup unavailable");
        }

        // Deezer classifies Single/EP. Resolve titles to Qobuz ALBUM IDs only.
        // An external Deezer ID must never be made clickable or playable.
        try{
            JSONArray releases=list(publicDeezer("artist/"+deezerId+"/albums?limit=100"),"data");
            ArrayList<JSONObject> owned=new ArrayList<>();
            try{owned=candidates(qobuz("album/search",artistName+" #ByMainArtist",100),
                "album",ownerId,artistName);}
            catch(Exception ignored){}
            if(owned.isEmpty()){
                owned=candidates(qobuz("album/search",artistName,100),
                    "album",ownerId,artistName);
            }
            JSONArray matched=new JSONArray();HashSet<String> seen=new HashSet<>();
            int targeted=0;
            for(int i=0;i<releases.length()&&matched.length()<25;i++){
                JSONObject external=entry(releases,i);
                String kind=sourceType(external);
                if(!shortType(kind))continue;
                String title=external.optString("title","");
                JSONObject chosen=albumMatch(title,owned);
                if(chosen==null&&targeted<4
                    &&System.nanoTime()-started<35_000_000_000L){
                    targeted++;
                    try{
                        ArrayList<JSONObject> exact=candidates(qobuz("album/search",
                            artistName+" "+title,25),"album",ownerId,artistName);
                        chosen=albumMatch(title,exact);
                    }catch(Exception ignored){}
                }
                if(chosen==null||!seen.add(safeId(chosen)))continue;
                String qobuzType=chosen.optString("release_type",
                    chosen.optString("album_type","")).toLowerCase(Locale.ROOT);
                if(qobuzType.equals("album")||qobuzType.contains("compilation"))
                    continue;
                JSONObject verified=new JSONObject(chosen.toString());
                if(qobuzType.isEmpty())
                    verified.put("release_type",kind.equals("ep")?"ep":"single");
                matched.put(verified);
            }
            if(matched.length()>0)
                result.put("eps",new JSONObject().put("items",matched))
                    .put("_epSource","deezer");
        }catch(Exception unavailable){
            result.put("_epError","Independent single/EP categories or Qobuz album lookup unavailable");
        }
        return result;
    }
}
