package com.aurel.hires;

/**
 * Small, Android-independent policy for media focus intent.
 * AudioManager owns the actual focus grant; this class only decides whether
 * a focus callback may resume playback without overriding a user pause.
 */
final class AurelFocusPolicy {
    private boolean wantsPlayback;
    private boolean resumeOnGain;

    void userPlay() {
        wantsPlayback = true;
        resumeOnGain = false;
    }

    void userPause() {
        wantsPlayback = false;
        resumeOnGain = false;
    }

    void focusDelayed() {
        resumeOnGain = wantsPlayback;
    }

    void focusDenied() {
        userPause();
    }

    void focusLostTransient() {
        resumeOnGain = wantsPlayback;
    }

    void focusLostPermanent() {
        userPause();
    }

    boolean focusGained() {
        boolean shouldResume = wantsPlayback && resumeOnGain;
        resumeOnGain = false;
        return shouldResume;
    }

    boolean shouldStartPrepared() {
        return wantsPlayback && !resumeOnGain;
    }

    boolean isWaitingForFocus() {
        return resumeOnGain;
    }
}
