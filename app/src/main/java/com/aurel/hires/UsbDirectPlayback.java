package com.aurel.hires;

import android.content.Context;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import androidx.annotation.OptIn;
import androidx.media3.common.C;
import androidx.media3.common.Format;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.audio.AudioSink;
import org.json.JSONObject;

/**
 * Direct USB engine replacement: libusbdac v0.2.0 (UAC1/UAC2/UAC3).
 * All decoded PCM is delivered through RoutingAudioSink. When a device
 * doesn't support a format, the library explicitly returns to Android's
 * DefaultAudioSink; we do not claim bit-perfect on that route.
 *
 * The standard OFF mode never instantiates this class.
 */
@OptIn(markerClass = UnstableApi.class)
final class UsbDirectPlayback {
    interface Listener {
        void onReady(UsbDirectPlayback playback);
        void onEnded(UsbDirectPlayback playback);
        void onError(UsbDirectPlayback playback, String message);
    }

    private final ExoPlayer player;
    private final AurelUsbDacHost host;
    private final Listener listener;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private boolean ready,released,failureReported;
    private String failure="";
    private int sourceRate,sourceChannels;
    private String sourceMime="";
    private int outputLevel;
    private long lastDirectActiveAt,firstPlayAt,lastUrbsSeen=-1L,lastUrbsAdvanceAt;
    private int lastPosition=-1,stagnantSeconds;
    private boolean hardwareLevelApplied;

    private final Runnable healthCheck=new Runnable() {
        @Override public void run(){
            if(released||failureReported)return;
            if(ready&&player.getPlayWhenReady()&&player.getPlaybackState()==Player.STATE_READY){
                // Before 8 seconds, the transport can still be activating
                // asynchronously. Decoder READY is not evidence of USB readiness.
                long nowMs=SystemClock.elapsedRealtime();
                if(host.directRoute()){
                    long submitted=host.submittedUrbs();
                    if(submitted>lastUrbsSeen && submitted>0){
                        lastUrbsSeen=submitted;
                        lastUrbsAdvanceAt=nowMs;
                        lastDirectActiveAt=nowMs;
                        // Activation is asynchronous: writing the saved hardware gain
                        // in the constructor silently did nothing before controlState
                        // was populated. Set it once when real USB packets flow.
                        if(!hardwareLevelApplied){
                            host.setVolumePercent(outputLevel);
                            hardwareLevelApplied=true;
                        }
                    }else if(nowMs-firstPlayAt>7000L &&
                             nowMs-Math.max(lastUrbsAdvanceAt,firstPlayAt)>5000L){
                        reportUnhealthy("Native USB packets stopped advancing");
                        return;
                    }
                }else if(!host.androidFallback() && nowMs-firstPlayAt>12000L){
                    // A route that stays Switching is a failure. In contrast,
                    // Fallback is a legitimate route decision for unsupported
                    // tracks/DACs. Never tear down healthy Android playback.
                    reportUnhealthy("USB route did not finish switching");
                    return;
                }
                if(player.isPlaying()){
                    int now=position();
                    stagnantSeconds=(lastPosition>=0&&now<=lastPosition)
                        ?stagnantSeconds+1:0;
                    lastPosition=now;
                    if(stagnantSeconds>=8) {
                        reportUnhealthy("USB playback timeline stalled");
                        return;
                    }
                } else {lastPosition=-1;stagnantSeconds=0;}
            }else{lastPosition=-1;stagnantSeconds=0;}
            handler.postDelayed(this,1000L);
        }
    };

    static boolean connected(Context context){
        UsbManager manager=(UsbManager)context.getSystemService(Context.USB_SERVICE);
        if(manager==null)return false;
        for(UsbDevice device:manager.getDeviceList().values())
            for(int i=0;i<device.getInterfaceCount();i++)
                if(device.getInterface(i).getInterfaceClass()==1)return true;
        return false;
    }
    static boolean supported(Context context){
        UsbManager manager=(UsbManager)context.getSystemService(Context.USB_SERVICE);
        if(manager==null)return false;
        for(UsbDevice device:manager.getDeviceList().values())
            if(manager.hasPermission(device))
                for(int i=0;i<device.getInterfaceCount();i++)
                    if(device.getInterface(i).getInterfaceClass()==1)return true;
        return false;
    }

    UsbDirectPlayback(Context context,AurelUsbDacHost host,int initialVolume,Listener listener){
        this.host=host;
        this.listener=listener;
        this.outputLevel=Math.max(0,Math.min(100,initialVolume));
        DefaultRenderersFactory factory=new DefaultRenderersFactory(context) {
            @Override protected AudioSink buildAudioSink(Context ctx,
                boolean enableFloatOutput,boolean enableOffload){
                return UsbDirectPlayback.this.host.newSink(ctx);
            }
        };
        // Native FLAC renderer remains preferred over MediaCodec to preserve
        // source PCM precision. The USB output itself is NEW libusbdac.
        factory.setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_PREFER);
        player=new ExoPlayer.Builder(context).setRenderersFactory(factory)
            .setReleaseTimeoutMs(2500L).build();
        player.setAudioAttributes(new androidx.media3.common.AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(),false);
        player.setVolume(1f); // never digitally attenuate bit-perfect decoded PCM
        player.addListener(new Player.Listener(){
            @Override public void onPlaybackStateChanged(int state){
                if(state==Player.STATE_READY&&!ready){
                    ready=true;
                    UsbDirectPlayback.this.listener.onReady(UsbDirectPlayback.this);
                }else if(state==Player.STATE_ENDED){
                    UsbDirectPlayback.this.listener.onEnded(UsbDirectPlayback.this);
                }
            }
            @Override public void onPlayerError(PlaybackException error){
                reportUnhealthy(error.getMessage()==null?"USB decoder error":error.getMessage());
            }
            @Override public void onTracksChanged(androidx.media3.common.Tracks tracks){
                for(androidx.media3.common.Tracks.Group group:tracks.getGroups()){
                    if(group.getType()!=C.TRACK_TYPE_AUDIO)continue;
                    for(int i=0;i<group.length;i++){
                        if(!group.isTrackSelected(i))continue;
                        Format f=group.getTrackFormat(i);
                        sourceRate=Math.max(0,f.sampleRate);
                        sourceChannels=Math.max(0,f.channelCount);
                        sourceMime=f.sampleMimeType==null?"":f.sampleMimeType;
                        return;
                    }
                }
            }
        });
        host.setVolumePercent(outputLevel);
        handler.postDelayed(healthCheck,1000L);
    }

    private void reportUnhealthy(String reason){
        if(released||failureReported)return;
        failureReported=true;failure=reason;
        listener.onError(this,reason);
    }
    void prepare(String httpsUrl){
        if(httpsUrl==null||!httpsUrl.startsWith("https://"))
            throw new IllegalArgumentException("Expected authorized HTTPS stream");
        player.setMediaItem(MediaItem.fromUri(httpsUrl));
        player.setPlayWhenReady(false);
        player.prepare();
    }
    void start(){
        firstPlayAt=SystemClock.elapsedRealtime();
        lastUrbsAdvanceAt=firstPlayAt;
        lastUrbsSeen=-1L;
        stagnantSeconds=0;
        lastPosition=-1;
        hardwareLevelApplied=false;
        player.play();
    }
    void pause(){player.pause();}
    boolean isPlaying(){return player.isPlaying();}
    boolean isReady(){return ready;}
    boolean usbStreamActive(){
        // A cached URB count / route from a paused track does not prove that
        // decoded PCM is currently being sent to the DAC.
        return !released && player.isPlaying() && host.directTransportActive()
            && lastUrbsSeen>0 && lastUrbsAdvanceAt>0
            && SystemClock.elapsedRealtime()-lastUrbsAdvanceAt<3500L;
    }
    int position(){return (int)Math.min(Integer.MAX_VALUE,Math.max(0L,player.getCurrentPosition()));}
    int duration(){
        long duration=player.getDuration();
        return (int)Math.min(Integer.MAX_VALUE,Math.max(0L,duration==C.TIME_UNSET?0:duration));
    }
    void seekTo(int ms){player.seekTo(Math.max(0,ms));}
    int sourceRate(){return sourceRate;}
    int sourceChannels(){return sourceChannels;}
    String sourceMime(){return sourceMime;}
    void setOutputLevel(int percent){
        outputLevel=Math.max(0,Math.min(100,percent));
        host.setVolumePercent(outputLevel);
    }
    String outputVolumeMode(){return host.volumeMode();}
    void release(){
        released=true;
        handler.removeCallbacks(healthCheck);
        try{player.release();}finally{host.releaseClaim();}
    }
    JSONObject status(){
        JSONObject out=host.status();
        try{
            boolean active=usbStreamActive();
            int usbRate=host.sampleRate();
            boolean rateMatches=sourceRate>0 && usbRate==sourceRate;
            out.put("enabled",true);
            out.put("status",failure.isEmpty()?
                (active?(rateMatches?"direct_usb_playback":"direct_usb_rate_mismatch"):
                 host.androidFallback()?"direct_usb_not_active":"direct_usb_preparing"):
                 "direct_usb_error");
            out.put("detail",!failure.isEmpty()?failure:
                active?(rateMatches?
                    "USB packets are advancing at the source sample rate; PCM identity not externally measured.":
                    "Live USB clock differs from source metadata or source rate is unavailable. Do not claim bit-perfect."):
                host.androidFallback()?
                    (host.bitPerfectCapable()?
                        "Track is routed through Android because direct USB rejected this format.":
                        "libusbdac cannot verify DAC hardware unity gain; Android fallback remains active."):
                "Opening USB interface. Bit-perfect has not been confirmed.");
            out.put("usbRouted",false);
            out.put("mixerPreferenceAccepted",false);
            // Direct USB transport alone is not proof of source/decoder
            // fidelity. Report only when the declared source sample rate
            // matches the live USB clock; keep end-to-end unverified.
            out.put("bitPerfectPcm",active && rateMatches);
            out.put("sourceRateMatchesUsb",rateMatches);
            out.put("nativeFlacEngine",sourceMime.contains("flac"));
            out.put("endToEndVerified",false);
            out.put("sourceRateHz",sourceRate);
            out.put("sampleRateHz",active?usbRate:host.androidFallback()?
                host.androidMixerRate():sourceRate);
            out.put("usbOutputVolumePercent",outputLevel);
        }catch(Exception ignored){}
        return out;
    }
}
