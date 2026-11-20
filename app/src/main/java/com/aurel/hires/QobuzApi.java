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
import java.util.regex.Pattern;
import java.util.regex.Matcher;
import java.util.Locale;

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

    // The web-player App ID is public configuration, not the application secret.
    // Never extract, ship, cache, or forward a third-party App Secret.
    private static final String WEB_LOGIN="https://play.qobuz.com/login";
    private static final Pattern WEB_JS=Pattern.compile(
        "(?:src|href)\\s*=\\s*[\\\"']([^\\\"']*?/resources/[^\\\"']*?\\.js)[\\\"']",
        Pattern.CASE_INSENSITIVE);
    private static final Pattern WEB_PRODUCTION_APP_ID=Pattern.compile(
        "production:\\{api:\\{appId:[^0-9]{0,3}([0-9]{9})");
    private static final Pattern WEB_APP_ID=Pattern.compile(
        "(?:appId|app_id|appId\\s*=)\\s*[:=]\\s*[\\\"']?([0-9]{6,15})[\\\"']?");
    private static String lastWebAppId="";
    private String loadPublicPage(URL url,int maxBytes)throws Exception {
        return loadPublicPage(url,maxBytes,0);
    }
    private String loadPublicPage(URL url,int maxBytes,int depth)throws Exception {
        if(depth>3)throw new Exception("Too many Qobuz web redirects");
        if(!"https".equalsIgnoreCase(url.getProtocol())||
            !"play.qobuz.com".equalsIgnoreCase(url.getHost()))
            throw new Exception("Unexpected Qobuz web address");
        HttpURLConnection c=(HttpURLConnection)url.openConnection();
        c.setConnectTimeout(10000);c.setReadTimeout(15000);
        c.setInstanceFollowRedirects(false);
        c.setRequestProperty("Accept","text/html,application/javascript");
        c.setRequestProperty("User-Agent","Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36");
        try{
            int status=c.getResponseCode();
            if(status>=300&&status<400){
                String location=c.getHeaderField("Location");
                if(location==null||location.isEmpty())throw new Exception("Missing Qobuz redirect target");
                return loadPublicPage(new URL(url,location),maxBytes,depth+1);
            }
            if(status!=200)throw new Exception("Qobuz web page returned "+status);
            ByteArrayOutputStream out=new ByteArrayOutputStream();
            try(InputStream in=c.getInputStream()){
                byte[] buf=new byte[16384];int n;
                while((n=in.read(buf))!=-1){
                    if(out.size()+n>maxBytes)throw new Exception("Qobuz web resource too large");
                    out.write(buf,0,n);
                }
            }
            return out.toString("UTF-8");
        }finally{c.disconnect();}
    }
    String resolveAppId(String entered)throws Exception{
        String input=entered==null?"":entered.trim();
        if(!input.isEmpty()){
            if(!input.matches("[0-9]{6,15}"))throw new Exception("App ID must contain 6–15 digits");
            return input;
        }
        if(!lastWebAppId.isEmpty())return lastWebAppId;
        try{
            String page=loadPublicPage(new URL(WEB_LOGIN),2_000_000);
            String id=findPublicAppId(page);
            if(!id.isEmpty()){lastWebAppId=id;return id;}
            Matcher scripts=WEB_JS.matcher(page);
            int examined=0;
            while(scripts.find()&&examined++<5){
                URL js=new URL(new URL(WEB_LOGIN),scripts.group(1));
                try{
                    id=findPublicAppId(loadPublicPage(js,14_000_000));
                    if(!id.isEmpty()){lastWebAppId=id;return id;}
                }catch(Exception ignored){
                    // A different bundle may expose the public web configuration.
                }
            }
        }catch(Exception e){
            throw new Exception("Could not determine the current Qobuz Web App ID. "+
                "Enter the X-App-Id from the same browser session as your token. ("+
                e.getMessage()+")");
        }
        throw new Exception("Qobuz changed its web App ID configuration. "+
            "Open Advanced and enter X-App-Id from play.qobuz.com Network requests.");
    }
    private static String findPublicAppId(String text){
        Matcher preferred=WEB_PRODUCTION_APP_ID.matcher(text);
        if(preferred.find())return preferred.group(1);
        Matcher m=WEB_APP_ID.matcher(text);
        while(m.find()){
            String id=m.group(1);
            if(id!=null&&id.matches("[0-9]{6,15}"))return id;
        }
        return "";
    }


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
        if(appId==null||appId.isEmpty())throw new IllegalArgumentException("Qobuz App ID is not configured. Reconnect with the App ID from the same authorized Qobuz session as the token.");
        // Some Qobuz API variants require app_id in the request parameters as
        // well as the X-App-Id header; do not rely on the header alone.
        JSONObject params=new JSONObject(data.toString());
        params.put("app_id",appId);
        String payload=query(params);
        URL url=new URL(BASE+endpoint+(post?"":payload.isEmpty()?"":"?"+payload));
        HttpURLConnection c=(HttpURLConnection)url.openConnection();
        c.setConnectTimeout(12000);c.setReadTimeout(18000);c.setInstanceFollowRedirects(false);
        c.setRequestProperty("Accept","application/json");
        c.setUseCaches(false);
        c.setRequestProperty("Cache-Control","no-store");
        c.setRequestProperty("X-App-Id",appId);
        c.setRequestProperty("User-Agent","AurelHiRes/1.0 Android");
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
            JSONObject body;
            try{body=text.isEmpty()?new JSONObject():new JSONObject(text);}
            catch(Exception invalid){
                throw new ApiException(code,endpoint,
                    code>=300?"Qobuz API returned HTTP "+code+
                      " instead of a JSON response. Check connectivity and App ID.":
                    "Qobuz returned a non-JSON response.");
            }
            if(code>=300||"error".equalsIgnoreCase(body.optString("status"))){
                int status=code>=300?code:body.optInt("code",500);
                // Root identifiers are Qobuz server trace IDs, not evidence of a valid session.
                String detail=body.optString("message",body.optString("error","Request rejected"))
                    .replaceAll("\\s*\\(Root=[^)]*\\)","").trim();
                if(status==405&&detail.toLowerCase(Locale.ROOT).contains("app_id")){
                    throw new ApiException(status,endpoint,
                        "Qobuz HTTP 405: App ID rejected by Qobuz. "
                        +"Use an authorized App ID from the same Qobuz session as your token; "
                        +"do not retry with the former default App ID.");
                }
                if(status==401||status==403){
                    String authHint=endpoint.equals("user/login")&&token.isEmpty()?
                        "Qobuz refused the client password-authentication request.":
                        "Qobuz rejected this session or App ID.";
                    throw new ApiException(status,endpoint,"Qobuz HTTP "+status+": "+authHint);
                }
                throw new ApiException(status,endpoint,"Qobuz HTTP "+status+": "+detail);
            }
            return body;
        }finally{c.disconnect();}
    }
    private String streamId(){
        String id=store.get("streamAppId");
        if(id.isEmpty())id=store.get("appId");
        return id; // No undocumented legacy App ID fallback. Require a validated pair.
    }
    private String streamToken(){
        String t=store.get("streamToken");
        return t.isEmpty()?store.get("token"):t;
    }
    private String streamSecret(){String s=store.get("streamAppSecret");return s.isEmpty()?store.get("appSecret"):s;}
    private String libraryId(){String id=store.get("libraryAppId");return id.isEmpty()?streamId():id;}
    private String libraryToken(){String t=store.get("libraryToken");return t.isEmpty()?streamToken():t;}

    JSONObject catalog(String endpoint,JSONObject args)throws Exception{return request(endpoint,args,false,streamId(),streamToken());}
    JSONObject library(String endpoint,JSONObject args)throws Exception{
        JSONObject params=new JSONObject(args.toString());
        // Qobuz requires user_id for some personal favourites/playlist lists.
        // Use only the user ID associated with the selected library token.
        if((endpoint.equals("favorite/getUserFavorites")||endpoint.equals("playlist/getUserPlaylists"))
            &&!params.has("user_id")){
            String uid=store.get("libraryToken").isEmpty()
                ?store.get("streamUserId"):store.get("libraryUserId");
            if(uid.matches("[0-9]{1,20}"))params.put("user_id",uid);
        }
        return request(endpoint,params,false,libraryId(),libraryToken());
    }
    /** Public artist catalogue only. Do not use unauthenticated credentials for user data or streaming. */
    JSONObject publicArtist(String endpoint,JSONObject args)throws Exception{
        if(!endpoint.equals("artist/page")&&!endpoint.equals("artist/getSimilarArtists")
            &&!endpoint.equals("artist/get"))
            throw new IllegalArgumentException("Unsupported public artist endpoint");
        // Public metadata must use the current published Qobuz web-client ID,
        // not a stale hard-coded widget ID (which now returns HTTP 405).
        return request(endpoint,args,false,resolveAppId(""),"");
    }
    JSONObject libraryPost(String endpoint,JSONObject args)throws Exception{return request(endpoint,args,true,libraryId(),libraryToken());}
    JSONObject get(String endpoint, JSONObject params)throws Exception{return catalog(endpoint,params);}
    /** Test the selected account on a genuinely authenticated endpoint before
     *  recording a login as verified. A token without a matching App ID can be
     *  syntactically valid yet receive 401 for every Qobuz API request.
     */

    /** Confirm the token through a user-specific endpoint, and the catalogue
     * separately for playback accounts. Favourites entitlement must not be
     * confused with the ability to search or stream.
     */
    JSONObject validateLiveToken(String appId,String token,String optionalUserId)throws Exception{
        return validateLiveToken(appId,token,optionalUserId,false);
    }
    JSONObject validateLiveToken(String appId,String token,String optionalUserId,boolean libraryOnly)throws Exception{
        if(appId==null||!appId.matches("[0-9]{6,15}"))
            throw new Exception("Enter a valid Qobuz X-App-Id or leave it blank to find the web ID.");
        if(token==null||token.trim().length()<10)
            throw new Exception("Paste the complete Qobuz X-User-Auth-Token.");
        String uid=optionalUserId==null?"":optionalUserId.trim();
        if(!uid.isEmpty()&&!uid.matches("[0-9]{1,20}"))
            throw new Exception("User ID must contain digits only.");
        JSONObject profile=null;
        Exception userError=null;
        try{
            profile=request("user/login",new JSONObject().put("extra","partner"),true,appId,token);
            if(!profile.has("user"))profile=null;
        }catch(Exception e){userError=e;}
        if(profile==null){
            try{
                // A user's favourites are never a public catalogue endpoint.
                JSONObject favouritesParams=new JSONObject().put("type","albums").put("limit",1);
                if(!uid.isEmpty())favouritesParams.put("user_id",uid);
                JSONObject favourites=request("favorite/getUserFavorites",
                    favouritesParams,false,appId,token);
                if(!favourites.has("albums")&&!favourites.has("tracks")&&!favourites.has("artists"))
                    throw new Exception("Qobuz returned an unexpected library response");
            }catch(Exception favouriteError){
                throw new Exception("Qobuz has not authorized this account with App ID "+appId+
                    ". Check that the token is current and the App ID belongs to its source. "+
                    "If the account uses a password or captcha, try official web sign-in and copy a fresh token. "+
                    "API: "+favouriteError.getMessage());
            }
        }
        if(!libraryOnly){
            try{
                // Search is used by the player. Failure here must be shown as a
                // catalogue/integration error, not silently accepted as a login.
                request("track/search",new JSONObject().put("query","music").put("limit",1),
                    false,appId,token);
            }catch(Exception e){
                throw new Exception("Qobuz accepted the user session but rejected "+
                    "catalogue access for App ID "+appId+". "+e.getMessage());
            }
        }
        JSONObject result=profile!=null?new JSONObject(profile.toString()):new JSONObject();
        result.put("validated",true).put("validation_status","verified");
        if(profile==null)result.put("profile_unavailable",true);
        return result;
    }
    /** Normalize actual Qobuz release metadata across featured and index
     * responses. Never substitute searched or made-up albums for fresh releases.
     * An empty provider list is not a successful discovery response.
     */
    JSONObject checkedFeatured(JSONObject response) throws Exception {
        if(response==null)throw new Exception("Empty Qobuz discovery response");
        JSONObject albums=response.optJSONObject("albums");
        org.json.JSONArray items=albums==null?null:albums.optJSONArray("items");
        if(items==null)items=response.optJSONArray("albums");
        if(items==null)items=response.optJSONArray("items");
        JSONObject releases=response.optJSONObject("releases");
        if(items==null&&releases!=null)items=releases.optJSONArray("items");
        // discover/index may wrap the genuine latest-album list in a separate
        // new_releases/newReleases collection.
        JSONObject recent=response.optJSONObject("new_releases");
        if(recent==null)recent=response.optJSONObject("newReleases");
        if(items==null&&recent!=null){
            JSONObject inner=recent.optJSONObject("albums");
            if(inner!=null)items=inner.optJSONArray("items");
            if(items==null)items=recent.optJSONArray("items");
            if(items==null)items=recent.optJSONArray("albums");
        }
        if(items==null)items=response.optJSONArray("new_releases");
        if(items==null)items=response.optJSONArray("newReleases");
        // Qobuz 2026 discover/index returns sections in containers.*.data.items.
        // Only inspect release containers; never display banners or playlists
        // as album releases.
        if(items==null||items.length()==0){
            JSONObject containers=response.optJSONObject("containers");
            if(containers!=null){
                String[] keys={"new_releases","newReleases","recent_releases",
                               "recentReleases"};
                for(String key:keys){
                    JSONObject wrapper=containers.optJSONObject(key);
                    if(wrapper==null)continue;
                    JSONObject data=wrapper.optJSONObject("data");
                    if(data==null)data=wrapper;
                    JSONObject section=data.optJSONObject("albums");
                    org.json.JSONArray found=section==null?null:section.optJSONArray("items");
                    if(found==null)found=data.optJSONArray("items");
                    if(found==null)found=data.optJSONArray("albums");
                    if(found!=null&&found.length()>0){items=found;break;}
                }
            }
        }
        if(items==null||items.length()==0)
            throw new Exception("Qobuz provided no new release albums");
        org.json.JSONArray verified=new org.json.JSONArray();
        for(int i=0;i<items.length()&&verified.length()<48;i++){
            JSONObject item=items.optJSONObject(i);
            if(item==null)continue;
            JSONObject album=item.optJSONObject("album");
            if(album==null)album=item;
            if(album.optString("id","").trim().isEmpty()||
               album.optString("title","").trim().isEmpty())continue;
            verified.put(album);
        }
        if(verified.length()==0)throw new Exception("Qobuz release list has no album IDs");
        JSONObject normalized=new JSONObject(response.toString());
        normalized.put("albums",new JSONObject().put("items",verified)
            .put("total",verified.length()));
        return normalized;
    }

    /** Try three legitimate Qobuz discovery shapes on the same authorized
     * account. A rejected App ID (405) is never retried against a different
     * endpoint using that same invalid identity.
     */
    JSONObject discoverReleases(int limit)throws Exception{
        int safeLimit=Math.max(1,Math.min(48,limit));
        try{
            return checkedFeatured(catalog("discover/newReleases",
                new JSONObject().put("limit",safeLimit).put("offset",0)));
        }catch(ApiException e){if(e.status==405)throw e;}
         catch(Exception ignored){/* Try the authorized index. */}
        try{
            return checkedFeatured(catalog("discover/index",new JSONObject()));
        }catch(ApiException e){if(e.status==405)throw e;}
         catch(Exception ignored){/* Try supported featured albums. */}
        return checkedFeatured(catalog("album/getFeatured",
            new JSONObject().put("type","new-releases").put("limit",safeLimit)));
    }

    /** Discover with the authorized library first, then streaming, then the
     * current public Qobuz Web App ID. No token is sent to public endpoints.
     */
    JSONObject publicFeaturedReleases(int limit)throws Exception{
        int safeLimit=Math.max(1,Math.min(48,limit));
        JSONObject query=new JSONObject().put("type","new-releases").put("limit",safeLimit);
        Exception authorizedFailure=null;
        String libraryAppId=store.get("libraryAppId");
        String libraryAuthToken=store.get("libraryToken");
        if(libraryAppId.matches("[0-9]{6,15}")&&!libraryAuthToken.isEmpty()){
            try{
                return checkedFeatured(request("discover/newReleases",
                    new JSONObject().put("limit",safeLimit),false,libraryAppId,libraryAuthToken));
            }catch(Exception denied){
                authorizedFailure=denied;
                if(!(denied instanceof ApiException)||
                    ((ApiException)denied).status!=405){
                    boolean idRejected=false;
                    try{return checkedFeatured(request("discover/index",new JSONObject(),
                        false,libraryAppId,libraryAuthToken));}
                    catch(Exception indexDenied){
                        authorizedFailure=indexDenied;
                        idRejected=indexDenied instanceof ApiException &&
                            ((ApiException)indexDenied).status==405;
                    }
                    if(!idRejected){
                        try{return checkedFeatured(request("album/getFeatured",query,false,
                            libraryAppId,libraryAuthToken));}
                        catch(Exception featuredDenied){authorizedFailure=featuredDenied;}
                    }
                }
            }
        }
        String streamingAppId=streamId(),streamingToken=streamToken();
        if(streamingAppId.matches("[0-9]{6,15}")&&!streamingToken.isEmpty()){
            try{return discoverReleases(safeLimit);}
            catch(Exception denied){authorizedFailure=denied;}
        }
        // Never replace a rejected public App ID with a guessed legacy value.
        try{
            String publicId=resolveAppId("");
            try{
                return checkedFeatured(request("discover/newReleases",
                    new JSONObject().put("limit",safeLimit),false,publicId,""));
            }catch(Exception denied){
                if(denied instanceof ApiException&&((ApiException)denied).status==405)
                    throw denied;
                try{return checkedFeatured(request("discover/index",new JSONObject(),
                    false,publicId,""));}
                catch(ApiException indexDenied){
                    if(indexDenied.status==405)throw indexDenied;
                }catch(Exception ignored){/* Fall through to featured albums. */}
                return checkedFeatured(request("album/getFeatured",query,
                    false,publicId,""));
            }
        }catch(Exception publicError){
            String hint=authorizedFailure==null?
                "No connected Qobuz account provided a permitted featured catalogue.":
                "The connected account and public featured catalogue both failed.";
            throw new Exception("Fresh releases unavailable: "+hint+
                " Qobuz authorization is required for this source; regular search and playback can remain functional.");
        }
    }

    /** Curated Qobuz New Releases playlist, not the complete global feed.
     * Source is the Qobuz-owned public playlist 2049430; expose that source
     * honestly in the UI. Track/album IDs come only from the live catalogue.
     */
    private JSONObject newReleasesPlaylist(String appId,String token,int limit)
        throws Exception {
        JSONObject params=new JSONObject().put("playlist_id","2049430")
            .put("extra","tracks").put("offset",0).put("limit",80);
        JSONObject playlist=request("playlist/get",params,false,appId,token);
        JSONObject tracks=playlist.optJSONObject("tracks");
        if(tracks==null){
            JSONObject wrapped=playlist.optJSONObject("playlist");
            if(wrapped!=null)tracks=wrapped.optJSONObject("tracks");
        }
        org.json.JSONArray items=tracks==null?playlist.optJSONArray("items"):
            tracks.optJSONArray("items");
        if(items==null||items.length()==0)
            throw new Exception("Qobuz New Releases playlist has no tracks");
        org.json.JSONArray albums=new org.json.JSONArray();
        java.util.HashSet<String> seen=new java.util.HashSet<>();
        for(int i=0;i<items.length()&&albums.length()<Math.max(1,limit);i++){
            JSONObject track=items.optJSONObject(i);
            if(track==null)continue;
            JSONObject item=track.optJSONObject("track");
            if(item==null)item=track;
            JSONObject album=item.optJSONObject("album");
            if(album==null)continue;
            String id=album.optString("id","").trim();
            if(id.isEmpty()||album.optString("title","").trim().isEmpty()
                ||!seen.add(id))continue;
            albums.put(album);
        }
        if(albums.length()==0)
            throw new Exception("Qobuz curated playlist contains no resolved albums");
        return new JSONObject()
            .put("albums",new JSONObject().put("items",albums)
                .put("total",albums.length()))
            .put("_source","qobuz_new_releases_playlist");
    }

    JSONObject curatedNewReleaseAlbums(int limit)throws Exception {
        Exception last=null;
        String libraryAppId=store.get("libraryAppId");
        String libraryToken=store.get("libraryToken");
        if(libraryAppId.matches("[0-9]{6,15}")&&!libraryToken.isEmpty()){
            try{return newReleasesPlaylist(libraryAppId,libraryToken,limit);}
            catch(Exception e){last=e;}
        }
        String streamingAppId=streamId(),streamingToken=streamToken();
        if(streamingAppId.matches("[0-9]{6,15}")&&!streamingToken.isEmpty()&&
            (!streamingAppId.equals(libraryAppId)||
             !streamingToken.equals(libraryToken))){
            try{return newReleasesPlaylist(streamingAppId,streamingToken,limit);}
            catch(Exception e){last=e;}
        }
        try{return newReleasesPlaylist(resolveAppId(""),"",limit);}
        catch(Exception e){last=e;}
        if(last instanceof ApiException)throw last;
        throw new Exception("Qobuz curated releases unavailable");
    }

    /** Public track credits and catalogue capabilities from Qobuz's widget
     * endpoint. Never confuse catalogue max bit depth with actual stream quality.
     * No personal library token, password or stream secret is sent.
     */
    JSONObject publicTrackDetails(String trackId)throws Exception{
        if(trackId==null||!trackId.matches("[0-9]{1,20}"))
            throw new Exception("Invalid Qobuz track identifier");
        JSONObject response=request("widget/getTrackById",
            new JSONObject().put("track_id",trackId),false,resolveAppId(""),"");
        JSONObject track=response.optJSONObject("track");
        if(track==null)track=response;
        if(!track.has("id")&&!track.has("album")&&!track.has("title"))
            throw new Exception("Qobuz did not return track details");
        return track;
    }
    /** First use the independent authenticated library account for rich
     * credits/ISRC, otherwise use Qobuz's public track widget.
     * Does not use the Mornye gateway for user-specific metadata.
     */
    JSONObject preferredTrackDetails(String trackId)throws Exception{
        if(trackId==null||!trackId.matches("[0-9]{1,20}"))
            throw new Exception("Invalid track ID");
        String token=store.get("libraryToken");
        if(!token.isEmpty()){
            try{
                JSONObject details=request("track/get",
                    new JSONObject().put("track_id",trackId),false,libraryId(),token);
                JSONObject wrapped=details.optJSONObject("track");
                if(wrapped!=null)return wrapped;
                if(details.has("id")||details.has("album"))return details;
            }catch(Exception ignored){/* Public source remains an option. */}
        }
        return publicTrackDetails(trackId);
    }

    /** Reuse the installed Qobuz App ID for a separate personal library.
     * Mornye gateway identity itself is not a Qobuz user App ID.
     */
    String automaticLibraryAppId()throws Exception{
        // A previously verified separate library token has priority.
        if(!store.get("libraryToken").isEmpty()){
            String prior=store.get("libraryAppId");
            if(prior.matches("[0-9]{6,15}"))return prior;
        }
        // For a new password login prefer the currently published web client,
        // not a stale streaming token's unrelated integration App ID.
        try{
            String current=resolveAppId("");
            if(current.matches("[0-9]{6,15}"))return current;
        }catch(Exception ignored){
            // Existing locally configured integration is an explicit fallback.
        }
        for(String name:new String[]{"streamAppId","appId"}){
            String saved=store.get(name);
            if(saved.matches("[0-9]{6,15}"))return saved;
        }
        throw new Exception("No suitable Qobuz App ID was detected. "+
            "AUREL could not access Qobuz's public client configuration. "+
            "You can still connect your library using a session token.");
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

    /** Qobuz's legacy user/login accepts an MD5 representation of the
     * password. The raw password never enters URL params, GET requests or
     * persistent storage. A 401 from Qobuz can also mean third-party login
     * is disabled; do not brute-force different request variants.
     */
    JSONObject passwordLogin(String appId,String email,String password)throws Exception{
        if(appId==null||!appId.matches("[0-9]{6,15}")||
           email==null||email.trim().isEmpty()||password==null||password.isEmpty())
            throw new Exception("Enter your Qobuz email and password.");
        String passwordHash=md5(password);
        // Qobuz uses separate fields for an account email and a username.
        String account=email.trim();
        JSONObject body=new JSONObject().put("password",passwordHash);
        if(account.contains("@"))body.put("email",account);
        else body.put("username",account);
        try {
            JSONObject response=request("user/login",body,true,appId,"");
            if(response.optString("user_auth_token").isEmpty())
                throw new Exception("Qobuz did not return a library session token.");
            return response;
        }catch(ApiException e){
            if(e.status==401||e.status==403)
                throw new ApiException(e.status,"user/login",
                    "Qobuz HTTP "+e.status+": password API login refused (App ID "+appId+
                    "). Qobuz may require an authorized OAuth sign-in. "+
                    "The Qobuz password endpoint refused this client. Try a compatible App ID or a valid account session token.");
            throw e;
        }
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
