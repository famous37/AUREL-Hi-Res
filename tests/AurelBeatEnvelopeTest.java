package com.aurel.hires;

public final class AurelBeatEnvelopeTest {
    private static void check(boolean condition,String reason){
        if(!condition)throw new AssertionError(reason);
    }
    private static byte[] signal(int amplitude){
        byte[] data=new byte[1024];
        for(int bin=1;bin<=24;bin++){
            // Synthetic bass frequency magnitudes only (NOT a timed beat).
            data[bin*2]=(byte)Math.max(-127,Math.min(127,amplitude));
            data[bin*2+1]=(byte)(amplitude/2);
        }
        return data;
    }
    public static void main(String[] args){
        AurelBeatEnvelope b=new AurelBeatEnvelope();
        byte[] silence=signal(0),bass=signal(90);
        for(int i=0;i<6;i++)
            check(b.onFft(silence)==0f,"silence must never pulse");
        float attack=b.onFft(bass);
        check(attack>.35f,"kick onset must make the cover grow");
        float late=0f;
        for(int i=0;i<25;i++)late=b.onFft(bass);
        check(late<attack*.3f,"steady tone must NOT be a clock-driven pulse");
        for(int i=0;i<12;i++)b.onFft(silence);
        float next=b.onFft(bass);
        check(next>.35f,"next genuine kick must create a new pulse");
        b.reset();
        check(b.onFft(silence)==0f,"reset clears stale playback");
        System.out.println("Beat FFT: true kick onset, silent frames, steady tone and replay PASS");
    }
}
