package com.aurel.hires;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.MediaMetadata;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.util.LruCache;
import android.os.Handler;
import android.os.Looper;
import java.net.URL;
import java.net.HttpURLConnection;
import java.io.InputStream;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;
import org.json.JSONObject;
import java.lang.ref.WeakReference;

/** Android media controls in the lock screen / quick settings / notification shade.
 * Playback remains owned by the Activity; the foreground service keeps its process
 * alive while the listener is playing or paused. Force closing the app stops audio. */
public final class AurelPlaybackService extends Service {
    private static final String CHANNEL="aurel_playback";
    private static final int NOTIFICATION_ID=2026;
    private static final String ACTION_PREFIX="com.aurel.hires.media.";
    private static AurelPlaybackService instance;
    private static WeakReference<MainActivity> controller=new WeakReference<>(null);
    private static String lastSignature="";
    private MediaSession session;
    private NotificationManager notifications;
    private boolean isForeground=false;
    private boolean hasTrack=false;
    private String title="AUREL",artist="Music",lastTitle="";
    private long duration=0,position=0;
    private boolean playing=false,buffering=false;
    private String lastMetadataSignature="",lastNotificationSignature="";
    private static volatile boolean colorizeMediaNotification=false;
    private int notificationArtworkAccent=Color.rgb(213,215,219);
    /** Android may enforce its own Material You/media colours despite app tint. */
    static void setAlbumNotificationColors(boolean enabled){
        if(colorizeMediaNotification==enabled)return;
        colorizeMediaNotification=enabled;
        AurelPlaybackService s=instance;
        if(s!=null&&s.session!=null&&s.hasTrack){
            s.lastNotificationSignature="";
            s.update(s.title,s.artist,s.albumTitle,s.coverUrl,
                s.duration,s.position,s.playing,s.buffering);
        }
    }
    private final ExecutorService coverJobs=Executors.newSingleThreadExecutor();
    private final Handler mainThread=new Handler(Looper.getMainLooper());
    private String albumTitle="",coverUrl="";
    private Bitmap coverBitmap;
    private volatile int coverGeneration=0;
    // Keep decoded artwork and sampled palettes bounded in native memory.
    // A user reopening the same album should not redownload its Qobuz cover.
    private final LruCache<String,Bitmap> artworkCache=new LruCache<String,Bitmap>(6*1024*1024){
        @Override protected int sizeOf(String key,Bitmap value){
            return Math.max(1,value.getByteCount());
        }
    };
    private final LruCache<String,String[]> artworkPaletteCache=new LruCache<>(48);


    /** Normalize Qobuz/Mornye names before Android MediaMetadata and notifications.
     * Providers sometimes return {"display":"..."} serialized as a JSON string.
     * Never pass raw JSON into the media output dialog or lock screen. */
    static String humanName(Object value,String fallback) {
        return humanName(value,fallback,0);
    }
    private static String humanName(Object value,String fallback,int depth) {
        if(value==null||value==JSONObject.NULL||depth>5)return fallback;
        if(value instanceof JSONObject) {
            JSONObject obj=(JSONObject)value;
            for(String key:new String[]{"display","name","display_name","displayName",
                    "full_name","artist_name","title"}) {
                String found=humanName(obj.opt(key),"",depth+1);
                if(!found.isEmpty())return found;
            }
            for(String key:new String[]{"artist","main_artist","performer"}) {
                String found=humanName(obj.opt(key),"",depth+1);
                if(!found.isEmpty())return found;
            }
            Object items=obj.opt("items");
            if(items!=null) return humanName(items,fallback,depth+1);
            return fallback;
        }
        if(value instanceof org.json.JSONArray) {
            org.json.JSONArray arr=(org.json.JSONArray)value;
            StringBuilder names=new StringBuilder();
            for(int i=0;i<Math.min(arr.length(),8);i++) {
                String part=humanName(arr.opt(i),"",depth+1);
                if(part.isEmpty())continue;
                if(names.length()>0)names.append(", ");
                names.append(part);
            }
            return names.length()>0?names.toString():fallback;
        }
        if(value instanceof String) {
            String str=((String)value).trim();
            if(str.startsWith("{")&&str.endsWith("}")){
                try{return humanName(new JSONObject(str),fallback,depth+1);}
                catch(Exception ignored){return fallback;}
            }
            if(str.startsWith("[")&&str.endsWith("]")){
                try{return humanName(new org.json.JSONArray(str),fallback,depth+1);}
                catch(Exception ignored){return fallback;}
            }
            return str.isEmpty()?fallback:str;
        }
        return fallback;
    }

    /** Match the same artwork hierarchy as the WebView; do not trust arbitrary hosts. */
    private static String imageField(JSONObject item) {
        if(item==null)return "";
        for(String field:new String[]{"image","picture","cover"}) {
            Object value=item.opt(field);
            if(value instanceof String) {
                String url=approvedCover((String)value);
                if(!url.isEmpty())return url;
            } else if(value instanceof JSONObject) {
                JSONObject images=(JSONObject)value;
                for(String quality:new String[]{"large","extralarge","medium","small","thumbnail","default"}) {
                    String url=approvedCover(images.optString(quality,""));
                    if(!url.isEmpty())return url;
                }
            }
        }
        return "";
    }
    private static String approvedCover(String value) {
        if(value==null||!value.startsWith("https://"))return "";
        try {
            URL url=new URL(value);
            String host=url.getHost().toLowerCase(Locale.US);
            return host.equals("qobuz.com")||host.endsWith(".qobuz.com")?value:"";
        }catch(Exception ignored){return "";}
    }
    private static String coverFromTrack(JSONObject track) {
        String own=imageField(track);
        return own.isEmpty()?imageField(track.optJSONObject("album")):own;
    }
    private static Bitmap loadCover(String url) {
        HttpURLConnection conn=null;
        try {
            conn=(HttpURLConnection)new URL(url).openConnection();
            conn.setConnectTimeout(4500);
            conn.setReadTimeout(6000);
            conn.setInstanceFollowRedirects(false);
            if(conn.getResponseCode()!=200)return null;
            int length=conn.getContentLength();
            if(length>4000000)return null;
            BitmapFactory.Options opts=new BitmapFactory.Options();
            opts.inSampleSize=2;
            try(InputStream stream=conn.getInputStream()){
                return BitmapFactory.decodeStream(stream,null,opts);
            }
        }catch(Exception ignored){return null;}
        finally{if(conn!=null)conn.disconnect();}
    }
    private static String colorHex(int c) {
        return String.format(Locale.US,"#%06X",c&0xFFFFFF);
    }
    /**
     * Palette from ACTUAL sampled cover pixels. Choose the strongest hue
     * cluster instead of circularly averaging unrelated colors (which
     * formerly mixed orange album artwork into pink/teal styling).
     * The last three output colors are vivid harmonized shades for shadows.
     */
    static String[] palette(Bitmap bitmap) {
        final float[] bins=new float[24];
        final float[] hsv=new float[3];
        int w=bitmap.getWidth(),h=bitmap.getHeight();
        if(w<1||h<1)return new String[]{"#111214","#232427","#D5D7DB","#B1A8A2","#908781","#D3B9A2"};
        for(int y=1;y<23;y++)for(int x=1;x<23;x++){
            int pixel=bitmap.getPixel(Math.min(w-1,x*w/24),Math.min(h-1,y*h/24));
            Color.colorToHSV(pixel,hsv);
            if(hsv[1]<.21f||hsv[2]<.16f||hsv[2]>.98f)continue;
            float weight=hsv[1]*hsv[1]*(0.35f+hsv[2]);
            int index=Math.min(23,(int)(hsv[0]/15f));
            bins[index]+=weight;
        }
        float[] smooth=new float[24];int dominant=0;
        for(int i=0;i<24;i++){
            smooth[i]=bins[i]*1.7f+bins[(i+23)%24]*.7f+bins[(i+1)%24]*.7f;
            if(smooth[i]>smooth[dominant])dominant=i;
        }
        if(smooth[dominant]<.05f)
            return new String[]{"#111214","#232427","#D5D7DB","#B1A8A2","#908781","#D3B9A2"};
        float hue=((dominant*15f)+7.5f)%360f;
        float secondHue=hue+16f;
        float secondWeight=0f;
        for(int i=0;i<24;i++){
            int distance=Math.abs(i-dominant);
            distance=Math.min(distance,24-distance);
            if(distance<3||distance>7)continue;
            if(smooth[i]>secondWeight){secondWeight=smooth[i];secondHue=(i*15f+7.5f)%360f;}
        }
        if(secondWeight<smooth[dominant]*.29f)secondHue=(hue+17f)%360f;
        float thirdHue=(hue+345f)%360f;
        int bg=Color.HSVToColor(new float[]{hue,.37f,.075f});
        int surface=Color.HSVToColor(new float[]{hue,.43f,.16f});
        int accent=Color.HSVToColor(new float[]{hue,.35f,.94f});
        int glow1=Color.HSVToColor(new float[]{hue,.87f,.98f});
        int glow2=Color.HSVToColor(new float[]{secondHue,.80f,.95f});
        int glow3=Color.HSVToColor(new float[]{thirdHue,.84f,.95f});
        return new String[]{colorHex(bg),colorHex(surface),colorHex(accent),
                            colorHex(glow1),colorHex(glow2),colorHex(glow3)};
    }
    private void refreshCover(String url,int generation) {
        coverJobs.execute(()->{
            // Rapid track changes can enqueue obsolete downloads. Do not fetch
            // artwork that is no longer needed by the visible MediaSession.
            if(generation!=coverGeneration)return;
            Bitmap bitmap=artworkCache.get(url);
            if(bitmap==null){
                bitmap=loadCover(url);
                if(bitmap!=null&&bitmap.getByteCount()<=6*1024*1024)
                    artworkCache.put(url,bitmap);
            }
            String[] colors=null;
            if(bitmap!=null){
                colors=artworkPaletteCache.get(url);
                if(colors==null){
                    colors=palette(bitmap);
                    artworkPaletteCache.put(url,colors);
                }
            }
            final Bitmap artwork=bitmap;
            final String[] paletteColors=colors;
            mainThread.post(()->{
                if(session==null||generation!=coverGeneration||!url.equals(coverUrl))return;
                coverBitmap=artwork;
                if(paletteColors!=null){
                    notificationArtworkAccent=Color.parseColor(paletteColors[2]);
                    MainActivity a=controller.get();
                    if(a!=null)a.onAlbumArtworkPalette(url,paletteColors[0],paletteColors[1],
                        paletteColors[2],paletteColors[3],paletteColors[4],paletteColors[5]);
                }
                update(title,artist,albumTitle,coverUrl,duration,position,playing,buffering);
            });
        });
    }

    public static void publish(MainActivity source,JSONObject state){
        if(source==null||state==null)return;
        JSONObject track=state.optJSONObject("track");
        String trackId=track==null?"":track.optString("id","");
        boolean active=!trackId.isEmpty()&&state.optInt("index",-1)>=0;
        if(!active){stop(source);return;}
        controller=new WeakReference<>(source);
        String name=humanName(track.opt("title"),"Music");
        JSONObject album=track.optJSONObject("album");
        String performer=humanName(track.opt("artist"),"");
        if(performer.isEmpty())performer=humanName(track.opt("main_artist"),"");
        if(performer.isEmpty())performer=humanName(track.opt("performer"),"");
        if(performer.isEmpty()&&album!=null)performer=humanName(album.opt("artist"),"");
        if(performer.isEmpty())performer="Artist";
        String albumName=album==null?"":humanName(album.opt("title"),"");
        String artwork=coverFromTrack(track);
        boolean playing=state.optBoolean("playing",false);
        boolean buffering=state.optBoolean("buffering",false);
        long length=Math.max(0,state.optLong("duration",0));
        // Some stream decoders report duration=0 during prepare/buffering.
        // Qobuz track duration is in seconds; MediaSession requires millis.
        if(length<=0&&track!=null){
            double seconds=track.optDouble("duration",0);
            if(Double.isFinite(seconds)&&seconds>0&&seconds<86400)
                length=Math.round(seconds*1000d);
        }
        long offset=Math.max(0,state.optLong("position",0));
        String signature=trackId+"|"+name+"|"+performer+"|"+playing+"|"+buffering+"|"+length;
        if(instance!=null){
            instance.update(name,performer,albumName,artwork,length,offset,playing,buffering);
            lastSignature=signature;
            return;
        }
        if(signature.equals(lastSignature))return;
        lastSignature=signature;
        Intent launch=new Intent(source,AurelPlaybackService.class);
        launch.setAction(ACTION_PREFIX+"start");
        launch.putExtra("title",name);
        launch.putExtra("artist",performer);
        launch.putExtra("album",albumName);
        launch.putExtra("artwork",artwork);
        launch.putExtra("duration",length);
        launch.putExtra("position",offset);
        launch.putExtra("playing",playing);
        launch.putExtra("buffering",buffering);
        try {
            if(Build.VERSION.SDK_INT>=26)source.startForegroundService(launch);
            else source.startService(launch);
        }catch(Exception ignored){ /* Background start restricted; the UI still controls playback. */ }
    }
    public static void stop(Context ctx){
        lastSignature="";
        if(instance!=null){
            instance.stopPlaybackService();
        }else{
            try{ctx.stopService(new Intent(ctx,AurelPlaybackService.class));}catch(Exception ignored){}
        }
    }
    @Override public void onCreate(){
        super.onCreate();
        instance=this;
        notifications=(NotificationManager)getSystemService(Context.NOTIFICATION_SERVICE);
        if(Build.VERSION.SDK_INT>=26){
            NotificationChannel c=new NotificationChannel(CHANNEL,"AUREL music playback",NotificationManager.IMPORTANCE_LOW);
            c.setDescription("Media playback controls");
            c.setShowBadge(false);
            notifications.createNotificationChannel(c);
        }
        session=new MediaSession(this,"AUREL Hi-Res");
        // All output, including USB DAC and volume keys, is owned by Android.
        session.setPlaybackToLocal(new android.media.AudioAttributes.Builder()
            .setUsage(android.media.AudioAttributes.USAGE_MEDIA)
            .setContentType(android.media.AudioAttributes.CONTENT_TYPE_MUSIC).build());
        session.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS|MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
        session.setCallback(new MediaSession.Callback(){
            @Override public void onPlay(){dispatch("toggle",true);}
            @Override public void onPause(){dispatch("toggle",false);}
            @Override public void onSkipToNext(){dispatch("next",false);}
            @Override public void onSkipToPrevious(){dispatch("previous",false);}
            @Override public void onSeekTo(long position){MainActivity a=controller.get();if(a!=null)a.seekFromMediaSession(position);}
        });
        session.setActive(true);
    }
    private void dispatch(String command,boolean play){
        MainActivity a=controller.get();
        if(a!=null)a.mediaControl(command,play);
    }
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        if(intent==null)return START_NOT_STICKY;
        String action=intent.getAction();
        if((ACTION_PREFIX+"stop").equals(action)){
            stopPlaybackService();
            return START_NOT_STICKY;
        }
        if((ACTION_PREFIX+"play").equals(action)){dispatch("toggle",true);return START_STICKY;}
        if((ACTION_PREFIX+"pause").equals(action)){dispatch("toggle",false);return START_STICKY;}
        if((ACTION_PREFIX+"next").equals(action)){dispatch("next",false);return START_STICKY;}
        if((ACTION_PREFIX+"previous").equals(action)){dispatch("previous",false);return START_STICKY;}
        update(intent.getStringExtra("title"),intent.getStringExtra("artist"),
            intent.getStringExtra("album"),intent.getStringExtra("artwork"),
            intent.getLongExtra("duration",0),intent.getLongExtra("position",0),
            intent.getBooleanExtra("playing",false),intent.getBooleanExtra("buffering",false));
        return START_STICKY;
    }
    private PendingIntent control(String command,int index){
        Intent intent=new Intent(this,AurelPlaybackService.class).setAction(ACTION_PREFIX+command);
        int flags=PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getService(this,index,intent,flags);
    }
    private PendingIntent openApp(){
        Intent home=new Intent(this,MainActivity.class);
        home.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(this,99,home,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    private void update(String track,String performer,String albumName,String newCoverUrl,long durationMs,long positionMs,boolean isPlaying,boolean isBuffering){
        if(session==null)return;
        hasTrack=true;
        title=humanName(track,"Music");
        artist=humanName(performer,"Artist");
        duration=Math.max(0,durationMs);
        position=Math.max(0,Math.min(duration,durationMs>0?positionMs:0));
        playing=isPlaying;buffering=isBuffering;
        albumTitle=albumName==null?"":albumName;
        String safeUrl=approvedCover(newCoverUrl);
        if(!safeUrl.equals(coverUrl)) {
            coverUrl=safeUrl;
            coverBitmap=null;
            notificationArtworkAccent=Color.rgb(213,215,219);
            int generation=++coverGeneration;
            if(!safeUrl.isEmpty())refreshCover(safeUrl,generation);
        }
        // Avoid re-publishing metadata every second: Android SystemUI can reset
        // its media seek bar when metadata changes on every position tick.
        String metadataSignature=title+"|"+artist+"|"+albumTitle+"|"+duration+"|"+coverUrl
            +"|"+(coverBitmap==null?0:System.identityHashCode(coverBitmap));
        if(!metadataSignature.equals(lastMetadataSignature)){
        MediaMetadata.Builder metadataBuilder=new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE,title)
            .putString(MediaMetadata.METADATA_KEY_ARTIST,artist)
            .putString(MediaMetadata.METADATA_KEY_ALBUM_ARTIST,artist)
            .putString(MediaMetadata.METADATA_KEY_ALBUM,albumTitle)
            .putString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE,title)
            .putString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE,artist)
            .putString(MediaMetadata.METADATA_KEY_DISPLAY_DESCRIPTION,albumTitle)
            .putLong(MediaMetadata.METADATA_KEY_DURATION,duration);
        if(!coverUrl.isEmpty())metadataBuilder.putString(MediaMetadata.METADATA_KEY_ART_URI,coverUrl);
        if(coverBitmap!=null){
            metadataBuilder.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART,coverBitmap);
            metadataBuilder.putBitmap(MediaMetadata.METADATA_KEY_ART,coverBitmap);
            metadataBuilder.putBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON,coverBitmap);
        }
        session.setMetadata(metadataBuilder.build());
        lastMetadataSignature=metadataSignature;
        }
        int status=buffering?PlaybackState.STATE_BUFFERING:playing?PlaybackState.STATE_PLAYING:PlaybackState.STATE_PAUSED;
        PlaybackState state=new PlaybackState.Builder()
            .setActions(PlaybackState.ACTION_PLAY|PlaybackState.ACTION_PAUSE|
                PlaybackState.ACTION_PLAY_PAUSE|PlaybackState.ACTION_SKIP_TO_NEXT|
                PlaybackState.ACTION_SKIP_TO_PREVIOUS|PlaybackState.ACTION_SEEK_TO)
            .setState(status,position,playing?1f:0f,SystemClock.elapsedRealtime())
            .build();
        session.setPlaybackState(state);
        // PlaybackState carries the current position and live playback speed.
        // Only rebuild the foreground notification if visible controls, cover
        // or metadata changed; SystemUI advances the seekbar on its own.
        String notificationSignature=metadataSignature+"|"+status+"|"+
            (colorizeMediaNotification?notificationArtworkAccent:0);
        if(isForeground&&notificationSignature.equals(lastNotificationSignature))return;
        lastNotificationSignature=notificationSignature;
        Notification.Builder notification=Build.VERSION.SDK_INT>=26?
            new Notification.Builder(this,CHANNEL):new Notification.Builder(this);
        notification.setColor(notificationArtworkAccent);
        if(Build.VERSION.SDK_INT>=26)
            notification.setColorized(colorizeMediaNotification&&coverBitmap!=null);
        notification.setSmallIcon(R.drawable.ic_stat_aurel)
            .setContentTitle(title).setContentText(artist)
            .setContentIntent(openApp()).setShowWhen(false)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOngoing(playing||buffering)
            .setCategory(Notification.CATEGORY_TRANSPORT)
            .addAction(new Notification.Action.Builder(
                R.drawable.ic_transport_previous,"Previous",control("previous",1)).build())
            .addAction(new Notification.Action.Builder(
                playing?R.drawable.ic_transport_pause:R.drawable.ic_transport_play,
                playing?"Pause":"Play",control(playing?"pause":"play",2)).build())
            .addAction(new Notification.Action.Builder(
                R.drawable.ic_transport_next,"Next",control("next",3)).build())
            .setStyle(new Notification.MediaStyle()
                .setMediaSession(session.getSessionToken())
                .setShowActionsInCompactView(0,1,2));
        if(coverBitmap!=null)notification.setLargeIcon(coverBitmap);
        Notification ready=notification.build();
        if(!isForeground){
            try{
                if(Build.VERSION.SDK_INT>=29)startForeground(NOTIFICATION_ID,ready,android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
                else startForeground(NOTIFICATION_ID,ready);
                isForeground=true;
            }catch(Exception e){
                try{notifications.notify(NOTIFICATION_ID,ready);}catch(Exception ignored){}
            }
        }else{
            try{notifications.notify(NOTIFICATION_ID,ready);}catch(Exception ignored){}
        }
    }
    private void stopPlaybackService(){
        if(session!=null)session.setActive(false);
        if(Build.VERSION.SDK_INT>=24)stopForeground(STOP_FOREGROUND_REMOVE);
        else stopForeground(true);
        if(notifications!=null)notifications.cancel(NOTIFICATION_ID);
        stopSelf();
    }
    @Override public void onDestroy(){
        coverGeneration++;
        coverJobs.shutdownNow();
        artworkCache.evictAll();
        artworkPaletteCache.evictAll();
        if(session!=null){session.setActive(false);session.release();session=null;}
        if(notifications!=null)notifications.cancel(NOTIFICATION_ID);
        instance=null;isForeground=false;hasTrack=false;lastSignature="";
        lastMetadataSignature="";lastNotificationSignature="";
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent){return null;}
}
