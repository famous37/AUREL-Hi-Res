package com.aurel.hires;

import android.media.MediaPlayer;
import android.media.audiofx.Visualizer;
import android.os.Handler;
import android.os.Looper;

/**
 * Read-only, opt-in FFT envelope of AUREL's OWN MediaPlayer audio session.
 *
 * Never attaches to audio session 0 (the global output mix), never decodes
 * another stream, changes PCM, volume, effects, sample rate or USB routing.
 * The Activity must check RECORD_AUDIO permission and disable this monitor
 * while USB bit-perfect is requested.
 */
final class AurelBeatMonitor {
    interface LevelListener { void onLevel(float level); }

    private final Handler main=new Handler(Looper.getMainLooper());
    private final LevelListener listener;
    private Visualizer visualizer;
    private int sessionId=-1;
    private int generation=0;
    private float baseline=0f;
    private float envelope=0f;

    AurelBeatMonitor(LevelListener listener) { this.listener=listener; }

    /** Must only be invoked on the main thread. Failure is visual-only. */
    void update(MediaPlayer player,boolean active) {
        if(!active||player==null){stop();return;}
        final int session;
        try {session=player.getAudioSessionId();}
        catch(RuntimeException ignored){stop();return;}
        if(session<=0){stop();return;} // NEVER inspect the device-wide mix.
        if(visualizer!=null&&session==sessionId)return;
        stop();
        try {
            Visualizer analyzer=new Visualizer(session);
            try {
                int[] sizes=Visualizer.getCaptureSizeRange();
                analyzer.setCaptureSize(Math.min(1024,sizes[1]));
                final int token=++generation;
                analyzer.setDataCaptureListener(new Visualizer.OnDataCaptureListener(){
                    @Override public void onWaveFormDataCapture(Visualizer v,byte[] waveform,int rate) {
                        // FFT contains bass transients, unlike a decorative clock pulse.
                    }
                    @Override public void onFftDataCapture(Visualizer v,byte[] fft,int rate) {
                        if(fft==null||fft.length<12||token!=generation)return;
                        // DC component is ignored. Bins 1..12 emphasize bass and
                        // kick-drum transients with up to 1024 capture samples.
                        final int last=Math.min(12,(fft.length-2)/2);
                        float sum=0f;
                        for(int k=1;k<=last;k++) {
                            int re=fft[k*2],im=fft[k*2+1];
                            sum+=(float)Math.sqrt(re*re+im*im);
                        }
                        final float energy=sum/Math.max(1,last);
                        if(baseline<0.1f)baseline=energy;
                        final float previous=baseline;
                        baseline=0.94f*baseline+0.06f*energy;
                        final float onset=Math.max(0f,(energy-previous)/(previous+3f));
                        final float loudness=Math.min(1f,energy/55f);
                        final float target=energy<2f?0f:Math.min(1f,0.16f*loudness+1.15f*onset);
                        envelope=target>envelope?envelope*0.25f+target*0.75f
                                                :envelope*0.71f+target*0.29f;
                        final float level=Math.max(0f,Math.min(1f,envelope));
                        main.post(()->{if(token==generation)listener.onLevel(level);});
                    }
                },Math.min(16000,Visualizer.getMaxCaptureRate()),false,true);
                analyzer.setEnabled(true);
                visualizer=analyzer;
                sessionId=session;
            }catch(Exception error){
                try{analyzer.release();}catch(RuntimeException ignored){}
                throw error;
            }
        }catch(Exception ignored){
            // Unsupported device, restricted output or a failed audio effect:
            // leave native playback untouched and let UI use ambient motion.
            visualizer=null;
            sessionId=-1;
        }
    }

    void stop(){
        generation++;
        if(visualizer!=null){
            try{visualizer.setEnabled(false);}catch(RuntimeException ignored){}
            try{visualizer.release();}catch(RuntimeException ignored){}
            visualizer=null;
        }
        sessionId=-1;
        baseline=0f;
        envelope=0f;
    }
}
