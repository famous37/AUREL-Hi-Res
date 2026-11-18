package com.aurel.hires;

import android.media.MediaPlayer;
import android.media.audiofx.Visualizer;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import org.json.JSONObject;

/**
 * Opt-in, read-only FFT capture of AUREL's CURRENT MediaPlayer audio session.
 * Never listens to audio session 0, microphone, other apps or Qobuz URLs.
 * A callback-less Visualizer is retried using Android's official getFft API.
 * This is strictly display-only; errors cannot interrupt playback.
 */
final class AurelBeatMonitor {
    interface LevelListener { void onLevel(float level); }
    private final Handler main=new Handler(Looper.getMainLooper());
    private final LevelListener listener;
    private final AurelBeatEnvelope beat=new AurelBeatEnvelope();
    private Visualizer visualizer;
    private byte[] pollingBuffer;
    private int sessionId=-1;
    private volatile int generation;
    private volatile long attachedAt,lastFrameAt,lastCallbackAt,retryAfter,lastPollAt;
    private volatile int callbackFrames,pollFrames,nonSilentFrames,pollErrors;
    private volatile float lastPeak,lastLevel;
    private volatile String captureMode="off",failure="none";

    AurelBeatMonitor(LevelListener listener) {this.listener=listener;}

    /** Called on main thread; an unsupported effect is NOT an audio error. */
    void update(MediaPlayer player,boolean active) {
        if(!active||player==null){stop();return;}
        final int session;
        try{session=player.getAudioSessionId();}
        catch(RuntimeException error){stopVisualizer();failure="audio_session_error";return;}
        if(session<=0){stopVisualizer();failure="invalid_audio_session";return;}
        if(visualizer!=null&&session==sessionId)return;
        long now=SystemClock.elapsedRealtime();
        if(now<retryAfter)return;
        stopVisualizer();
        try {
            Visualizer analyzer=new Visualizer(session);
            try {
                int[] sizes=Visualizer.getCaptureSizeRange();
                int size=Integer.highestOneBit(Math.min(2048,sizes[1]));
                if(size<sizes[0])size=sizes[0];
                int setSize=analyzer.setCaptureSize(size);
                if(setSize!=Visualizer.SUCCESS)throw new IllegalStateException("capture_size_"+setSize);
                final int token=++generation;
                int result=analyzer.setDataCaptureListener(new Visualizer.OnDataCaptureListener(){
                    @Override public void onWaveFormDataCapture(Visualizer v,byte[] waveform,int rate){}
                    @Override public void onFftDataCapture(Visualizer v,byte[] fft,int rate) {
                        if(token!=generation||fft==null||fft.length<16)return;
                        callbackFrames++;
                        lastCallbackAt=SystemClock.elapsedRealtime();
                        processFrame(fft,token);
                    }
                },Math.min(20000,Visualizer.getMaxCaptureRate()),false,true);
                boolean callbackConfigured=result==Visualizer.SUCCESS;
                int status=analyzer.setEnabled(true);
                if(status!=Visualizer.SUCCESS)throw new IllegalStateException("enable_"+status);
                visualizer=analyzer;
                sessionId=session;
                pollingBuffer=new byte[analyzer.getCaptureSize()];
                attachedAt=now;
                lastFrameAt=0L;
                lastCallbackAt=0L;
                lastPollAt=0L;
                callbackFrames=0;pollFrames=0;nonSilentFrames=0;pollErrors=0;
                lastPeak=0f;lastLevel=0f;
                captureMode=callbackConfigured?"callback":"polling";
                failure=callbackConfigured?"none":"callback_status_"+result;
            } catch(Exception error) {
                try{analyzer.release();}catch(RuntimeException ignored){}
                throw error;
            }
        } catch(Exception error) {
            visualizer=null;
            sessionId=-1;
            pollingBuffer=null;
            lastFrameAt=0L;
            captureMode="unavailable";
            failure=error.getClass().getSimpleName();
            retryAfter=now+6000L;
        }
    }

    /** Called by a bounded foreground-only timer, never the audio thread. */
    void poll() {
        Visualizer v=visualizer;
        if(v==null||pollingBuffer==null)return;
        long now=SystemClock.elapsedRealtime();
        if(now-lastPollAt<100L)return;
        lastPollAt=now;
        // The callback is preferred. Poll ONLY when it is absent/stalled.
        if(lastCallbackAt>0L&&now-lastCallbackAt<700L)return;
        if(callbackFrames==0&&now-attachedAt>1600L&&"callback".equals(captureMode)){
            // Some vendor implementations accept listener registration yet
            // never dispatch FFT frames. Switch to the documented polling API.
            try{
                v.setEnabled(false);
                int disabled=v.setDataCaptureListener(null,0,false,false);
                int enabled=v.setEnabled(true);
                if(disabled==Visualizer.SUCCESS&&enabled==Visualizer.SUCCESS){
                    captureMode="polling";
                    failure="callback_stalled";
                }else{
                    captureMode="callback_fallback";
                    failure="poll_switch_"+disabled+"_"+enabled;
                }
            }catch(RuntimeException error){
                captureMode="callback_fallback";
                failure="poll_switch_"+error.getClass().getSimpleName();
                try{v.setEnabled(true);}catch(RuntimeException ignored){}
            }
        }
        try {
            int result=v.getFft(pollingBuffer);
            if(result==Visualizer.SUCCESS){
                final int token=generation;
                pollFrames++;
                processFrame(pollingBuffer,token);
            }else{
                pollErrors++;
                failure="get_fft_"+result;
            }
        }catch(RuntimeException error){
            pollErrors++;
            failure="get_fft_"+error.getClass().getSimpleName();
        }
        // Never spin or call into the streaming/decoder paths to force FFT.
        if(lastFrameAt==0L&&now-attachedAt>7000L){
            stopVisualizer();
            captureMode="unavailable";
            retryAfter=now+6000L;
        }
    }

    private void processFrame(byte[] fft,int token) {
        if(token!=generation)return;
        int last=Math.min(48,(fft.length-2)/2),peak=0;
        for(int i=1;i<=last;i++){
            peak=Math.max(peak,Math.abs((int)fft[i*2]));
            peak=Math.max(peak,Math.abs((int)fft[i*2+1]));
        }
        if(peak>2)nonSilentFrames++;
        lastPeak=peak;
        final float level=beat.onFft(fft);
        lastLevel=level;
        lastFrameAt=SystemClock.elapsedRealtime();
        main.post(()->{if(token==generation)listener.onLevel(level);});
    }

    boolean isAttached(){return visualizer!=null&&sessionId>0;}
    boolean hasFrames(){
        long t=lastFrameAt;
        return isAttached()&&t>0L&&SystemClock.elapsedRealtime()-t<1600L;
    }
    boolean hasSignal(){return hasFrames()&&nonSilentFrames>0;}
    boolean waitingForFrames(){
        return isAttached()&&lastFrameAt==0L&&
            SystemClock.elapsedRealtime()-attachedAt<1800L;
    }

    JSONObject diagnostics(){
        JSONObject j=new JSONObject();
        try {
            j.put("engine",captureMode);
            j.put("attached",isAttached());
            j.put("validSessionId",sessionId>0);
            j.put("fftFrames",callbackFrames+pollFrames);
            j.put("callbackFrames",callbackFrames);
            j.put("polledFrames",pollFrames);
            j.put("nonSilentFrames",nonSilentFrames);
            j.put("pollErrors",pollErrors);
            j.put("lastPeak",lastPeak);
            j.put("lastLevel",Math.round(lastLevel*100f)/100f);
            j.put("lastError",failure);
            j.put("dataFresh",hasFrames());
        }catch(Exception ignored){}
        return j;
    }

    private void stopVisualizer(){
        generation++;
        if(visualizer!=null){
            try{visualizer.setEnabled(false);}catch(RuntimeException ignored){}
            try{visualizer.release();}catch(RuntimeException ignored){}
            visualizer=null;
        }
        sessionId=-1;pollingBuffer=null;attachedAt=0L;lastFrameAt=0L;
        lastCallbackAt=0L;lastPollAt=0L;
        callbackFrames=0;pollFrames=0;nonSilentFrames=0;pollErrors=0;
        lastLevel=0f;lastPeak=0f;beat.reset();
        captureMode="off";
    }
    void stop(){
        if(visualizer!=null||sessionId>0)stopVisualizer();
        retryAfter=0L;
    }
}
