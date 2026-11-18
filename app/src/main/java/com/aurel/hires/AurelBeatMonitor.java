package com.aurel.hires;

import android.media.MediaPlayer;
import android.media.audiofx.Visualizer;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;

/**
 * Read-only FFT monitor of AUREL's own MediaPlayer session. Never attaches
 * to session zero, records microphone audio, changes PCM or probes Qobuz URLs.
 *
 * Real visualization is not guaranteed on Android BIT_PERFECT USB output;
 * the Activity disables this effect when that output mode is selected.
 */
final class AurelBeatMonitor {
    interface LevelListener { void onLevel(float level); }
    private final Handler main=new Handler(Looper.getMainLooper());
    private final LevelListener listener;
    private final AurelBeatEnvelope beat=new AurelBeatEnvelope();
    private Visualizer visualizer;
    private int sessionId=-1;
    private volatile int generation=0;
    private volatile long attachedAt=0L,lastFrameAt=0L,retryAfter=0L;

    AurelBeatMonitor(LevelListener listener){this.listener=listener;}

    /** Main-thread only. Unsupported audio paths must never interrupt music. */
    void update(MediaPlayer player,boolean active){
        if(!active||player==null){stop();return;}
        int session;
        try{session=player.getAudioSessionId();}
        catch(RuntimeException error){stop();return;}
        if(session<=0){stop();return;}
        final long now=SystemClock.elapsedRealtime();
        if(visualizer!=null&&session==sessionId){
            if(lastFrameAt==0L&&now-attachedAt>4000L) {
                // Attached successfully but Android delivered no FFT; retry
                // occasionally rather than silently playing a fake beat.
                stopVisualizer();
                retryAfter=now+5000L;
            }else if(lastFrameAt>0L&&now-lastFrameAt>4000L){
                stopVisualizer();
                retryAfter=now+5000L;
            }else return;
        }
        if(now<retryAfter)return;
        stopVisualizer();
        try{
            Visualizer analyzer=new Visualizer(session);
            try{
                int[] sizes=Visualizer.getCaptureSizeRange();
                int size=Math.min(2048,sizes[1]);
                size=Integer.highestOneBit(size); // power of two required
                if(size<sizes[0])size=sizes[0];
                analyzer.setCaptureSize(size);
                final int token=++generation;
                analyzer.setDataCaptureListener(new Visualizer.OnDataCaptureListener(){
                    @Override public void onWaveFormDataCapture(Visualizer v,byte[] waveform,int rate){
                        // FFT only; no alternate waveform or audio-data export.
                    }
                    @Override public void onFftDataCapture(Visualizer v,byte[] fft,int rate){
                        if(fft==null||fft.length<16||token!=generation)return;
                        final float level=beat.onFft(fft);
                        lastFrameAt=SystemClock.elapsedRealtime();
                        main.post(()->{
                            if(token==generation)listener.onLevel(level);
                        });
                    }
                },Math.min(30000,Visualizer.getMaxCaptureRate()),false,true);
                analyzer.setEnabled(true);
                visualizer=analyzer;
                sessionId=session;
                attachedAt=now;
                lastFrameAt=0L;
            }catch(Exception error){
                try{analyzer.release();}catch(RuntimeException ignored){}
                throw error;
            }
        }catch(Exception ignored){
            visualizer=null;
            sessionId=-1;
            attachedAt=0L;
            lastFrameAt=0L;
            retryAfter=now+5000L;
        }
    }

    boolean isAttached(){return visualizer!=null&&sessionId>0;}
    boolean hasFrames(){
        long time=lastFrameAt;
        return isAttached()&&time>0L&&SystemClock.elapsedRealtime()-time<1600L;
    }
    boolean waitingForFrames(){
        return isAttached()&&lastFrameAt==0L&&
            SystemClock.elapsedRealtime()-attachedAt<1800L;
    }
    private void stopVisualizer(){
        generation++;
        if(visualizer!=null){
            try{visualizer.setEnabled(false);}catch(RuntimeException ignored){}
            try{visualizer.release();}catch(RuntimeException ignored){}
            visualizer=null;
        }
        sessionId=-1;
        attachedAt=0L;
        lastFrameAt=0L;
        beat.reset();
    }
    void stop(){stopVisualizer();retryAfter=0L;}
}
