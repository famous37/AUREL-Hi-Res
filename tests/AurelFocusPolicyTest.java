package com.aurel.hires;

/** Host-JVM regression for user intent vs. Android focus callbacks. */
public final class AurelFocusPolicyTest {
    private static void check(boolean ok,String message){
        if(!ok)throw new AssertionError(message);
    }
    public static void main(String[] ignored){
        AurelFocusPolicy policy=new AurelFocusPolicy();
        check(!policy.shouldStartPrepared(),"Must never autoplay on app launch");

        policy.userPlay();
        check(policy.shouldStartPrepared(),"User play permits focus-gated start");
        policy.focusLostTransient();
        check(policy.isWaitingForFocus(),"Transient loss remembers previous play intent");
        check(!policy.shouldStartPrepared(),"Prepared callback must not steal audio focus");
        check(policy.focusGained(),"Temporary interruption can resume automatically");
        check(policy.shouldStartPrepared(),"Resume should allow playback");
        check(!policy.focusGained(),"Duplicate gain must not restart again");

        policy.focusLostTransient();
        policy.userPause();
        check(!policy.focusGained(),"Manual pause must cancel automatic resume");
        check(!policy.shouldStartPrepared(),"User pause blocks network prepare completion");

        policy.userPlay();
        policy.focusLostPermanent();
        check(!policy.focusGained(),"Permanent focus loss must not unexpectedly steal audio");
        check(!policy.shouldStartPrepared(),"Permanent loss remains paused");

        policy.userPlay();
        policy.focusDelayed();
        check(!policy.shouldStartPrepared(),"Delayed focus must not start playback early");
        check(policy.focusGained(),"Delayed focus grant may continue user-requested play");
        check(policy.shouldStartPrepared(),"Delayed grant now permits playback");

        policy.userPlay();
        policy.focusDelayed();
        policy.focusDenied();
        check(!policy.focusGained(),"Denied focus must not auto resume");
        check(!policy.shouldStartPrepared(),"Denied focus must leave playback stopped");

        policy.userPlay();
        policy.focusLostTransient();
        policy.focusLostPermanent();
        check(!policy.focusGained(),"Later permanent focus loss clears transient auto-resume");

        System.out.println("AUREL audio-focus intent state machine PASS");
    }
}
