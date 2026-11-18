package com.aurel.hires;

/** Extracts REAL low-frequency transients from Android Visualizer FFT frames.
 * No timer, BPM guess or synthetic animation source. Pure Java for unit tests.
 * The FFT is 8-bit signed interleaved complex data; bin zero is DC/Nyquist.
 */
final class AurelBeatEnvelope {
    private float previousEnergy;
    private float movingEnergy;
    private float envelope;
    private boolean initialized;

    synchronized float onFft(byte[] fft) {
        if(fft==null || fft.length<16)return 0f;
        int bins=Math.min(30,(fft.length-2)/2);
        if(bins<3)return 0f;
        float total=0f,weights=0f;
        for(int bin=1;bin<=bins;bin++){
            int re=fft[2*bin],im=fft[2*bin+1];
            float magnitude=(float)Math.sqrt(re*re+im*im);
            // Focus on bass/kick bins; downweight upper spectrum.
            float weight=1f/(float)Math.sqrt(bin);
            total+=weight*magnitude;
            weights+=weight;
        }
        float energy=total/Math.max(1f,weights);
        if(!initialized){
            previousEnergy=energy;movingEnergy=energy;initialized=true;
            return 0f;
        }
        float rise=Math.max(0f,energy-previousEnergy);
        float above=Math.max(0f,energy-movingEnergy);
        float divisor=Math.max(4f,movingEnergy*.65f);
        // Attack follows genuine changes in audio energy, NOT the clock.
        float onset=Math.min(1f,(rise*1.8f+above*.65f)/divisor);
        float target=energy<1.5f?0f:onset;
        float factor=target>envelope?.82f:.30f;
        envelope+=factor*(target-envelope);
        movingEnergy=energy>movingEnergy
            ?movingEnergy*.94f+energy*.06f
            :movingEnergy*.88f+energy*.12f;
        previousEnergy=energy;
        envelope=Math.max(0f,Math.min(1f,envelope));
        return envelope;
    }

    synchronized void reset(){
        previousEnergy=0f;movingEnergy=0f;envelope=0f;initialized=false;
    }
}
