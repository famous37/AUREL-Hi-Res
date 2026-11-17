package com.aurel.hires;

/** Bounded recovery only for plausible transient MediaPlayer/transport faults.
 * Stream tickets are acquired again at most once per user-selected track.
 * Malformed or unsupported streams are not retried as transport failures.
 */
final class AurelMediaRecoveryPolicy {
    static final int MAX_AUTO_RETRIES=1;
    private int attempts=0;
    private int seekPositionMs=0;

    void newSelection() {
        attempts=0;
        seekPositionMs=0;
    }

    boolean retryAfter(int what,int extra,boolean intendsPlayback) {
        if(!intendsPlayback||attempts>=MAX_AUTO_RETRIES)return false;
        final boolean transientSystemFailure=
            (what==1 && (extra==Integer.MIN_VALUE || extra==-1004 || extra==-110)) ||
            what==100;
        if(!transientSystemFailure)return false;
        attempts++;
        return true;
    }

    void rememberPosition(int positionMs) {
        if(positionMs>0)seekPositionMs=Math.min(positionMs,Integer.MAX_VALUE-1000);
    }

    int consumePosition(int durationMs) {
        int value=seekPositionMs;
        seekPositionMs=0;
        if(durationMs<=1500||value<=500||value>=durationMs-1000)return 0;
        return value;
    }

    int attempts() {
        return attempts;
    }
}
