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
    private final ExecutorService coverJobs=Executors.newSingleThreadExecutor();
    private final Handler mainThread=new Handler(Looper.getMainLooper());
    private String albumTitle="",coverUrl="";
    private Bitmap coverBitmap;
    private int coverGeneration=0;


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
                for(String quality:new String[]{"extralarge","large","medium","small","thumbnail","default"}) {
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
    /** Representative saturated pixels, then softened into accessible dark tones. */
    private static String[] palette(Bitmap bitmap) {
        float sumSin=0,sumCos=0,total=0;
        float[] hsv=new float[3];
        int w=bitmap.getWidth(),h=bitmap.getHeight();
        for(int y=1;y<13;y++)for(int x=1;x<13;x++){
            int pixel=bitmap.getPixel(Math.min(w-1,x*w/14),Math.min(h-1,y*h/14));
            Color.colorToHSV(pixel,hsv);
            if(hsv[1]<.15f||hsv[2]<.13f||hsv[2]>.96f)continue;
            float weight=hsv[1]*(.25f+hsv[2]);
            double angle=hsv[0]*Math.PI/180.0;
            sumSin+=Math.sin(angle)*weight;
            sumCos+=Math.cos(angle)*weight;
            total+=weight;
        }
        if(total<.01f)return new String[]{"#160F15","#2B1A24","#DEA8B9"};
        float hue=(float)((Math.atan2(sumSin,sumCos)*180/Math.PI+360)%360);
        int bg=Color.HSVToColor(new float[]{hue,.24f,.085f});
        int surface=Color.HSVToColor(new float[]{hue,.30f,.165f});
        int accent=Color.HSVToColor(new float[]{hue,.27f,.86f});
        return new String[]{colorHex(bg),colorHex(surface),colorHex(accent)};
    }
    private void refreshCover(String url,int generation) {
        coverJobs.execute(()->{
            Bitmap bitmap=loadCover(url);
            mainThread.post(()->{
                if(session==null||generation!=coverGeneration||!url.equals(coverUrl))return;
                coverBitmap=bitmap;
                if(bitmap!=null) {
                    String[] colors=palette(bitmap);
                    MainActivity a=controller.get();
                    if(a!=null)a.onAlbumArtworkPalette(url,colors[0],colors[1],colors[2]);
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
        String name=track.optString("title","Music");
        JSONObject a=track.optJSONObject("artist");
        String performer=a==null?track.optString("artist","Artist"):a.optString("name","Artist");
        JSONObject album=track.optJSONObject("album");
        String albumName=album==null?"":album.optString("title","");
        String artwork=coverFromTrack(track);
        boolean playing=state.optBoolean("playing",false);
        boolean buffering=state.optBoolean("buffering",false);
        long length=Math.max(0,state.optLong("duration",0));
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
        title=(track==null||track.trim().isEmpty())?"Music":track;
        artist=(performer==null||performer.trim().isEmpty())?"Artist":performer;
        duration=Math.max(0,durationMs);
        position=Math.max(0,Math.min(duration,durationMs>0?positionMs:0));
        playing=isPlaying;buffering=isBuffering;
        albumTitle=albumName==null?"":albumName;
        String safeUrl=approvedCover(newCoverUrl);
        if(!safeUrl.equals(coverUrl)) {
            coverUrl=safeUrl;
            coverBitmap=null;
            int generation=++coverGeneration;
            if(!safeUrl.isEmpty())refreshCover(safeUrl,generation);
        }
        MediaMetadata.Builder metadataBuilder=new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE,title)
            .putString(MediaMetadata.METADATA_KEY_ARTIST,artist)
            .putString(MediaMetadata.METADATA_KEY_ALBUM_ARTIST,artist)
            .putString(MediaMetadata.METADATA_KEY_ALBUM,albumTitle)
            .putLong(MediaMetadata.METADATA_KEY_DURATION,duration);
        if(!coverUrl.isEmpty())metadataBuilder.putString(MediaMetadata.METADATA_KEY_ART_URI,coverUrl);
        if(coverBitmap!=null){
            metadataBuilder.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART,coverBitmap);
            metadataBuilder.putBitmap(MediaMetadata.METADATA_KEY_ART,coverBitmap);
            metadataBuilder.putBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON,coverBitmap);
        }
        session.setMetadata(metadataBuilder.build());
        int status=buffering?PlaybackState.STATE_BUFFERING:playing?PlaybackState.STATE_PLAYING:PlaybackState.STATE_PAUSED;
        PlaybackState state=new PlaybackState.Builder()
            .setActions(PlaybackState.ACTION_PLAY|PlaybackState.ACTION_PAUSE|
                PlaybackState.ACTION_PLAY_PAUSE|PlaybackState.ACTION_SKIP_TO_NEXT|
                PlaybackState.ACTION_SKIP_TO_PREVIOUS|PlaybackState.ACTION_SEEK_TO)
            .setState(status,position,playing?1f:0f,SystemClock.elapsedRealtime())
            .build();
        session.setPlaybackState(state);
        Notification.Builder notification=Build.VERSION.SDK_INT>=26?
            new Notification.Builder(this,CHANNEL):new Notification.Builder(this);
        notification.setSmallIcon(R.drawable.ic_stat_aurel)
            .setContentTitle(title).setContentText(artist)
            .setContentIntent(openApp()).setShowWhen(false)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOngoing(playing||buffering)
            .setCategory(Notification.CATEGORY_TRANSPORT)
            .addAction(new Notification.Action.Builder(
                android.R.drawable.ic_media_previous,"Previous",control("previous",1)).build())
            .addAction(new Notification.Action.Builder(
                playing?android.R.drawable.ic_media_pause:android.R.drawable.ic_media_play,
                playing?"Pause":"Play",control(playing?"pause":"play",2)).build())
            .addAction(new Notification.Action.Builder(
                android.R.drawable.ic_media_next,"Next",control("next",3)).build())
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
        if(session!=null){session.setActive(false);session.release();session=null;}
        if(notifications!=null)notifications.cancel(NOTIFICATION_ID);
        instance=null;isForeground=false;hasTrack=false;lastSignature="";
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent){return null;}
}
