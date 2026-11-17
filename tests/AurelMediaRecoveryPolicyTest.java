package com.aurel.hires;

/** JVM regressions for bounded MediaPlayer error recovery. */
public final class AurelMediaRecoveryPolicyTest {
    private static void check(boolean yes,String reason){
        if(!yes)throw new AssertionError(reason);
    }
    public static void main(String[] args){
        AurelMediaRecoveryPolicy p=new AurelMediaRecoveryPolicy();
        check(p.attempts()==0,"New selections start with zero retry attempts");
        check(!p.retryAfter(1,Integer.MIN_VALUE,false),"No retry after manual pause");
        check(p.retryAfter(1,Integer.MIN_VALUE,true),"Known low-level system error gets one retry");
        check(p.attempts()==1,"Must count system retry");
        check(!p.retryAfter(1,Integer.MIN_VALUE,true),"Do not retry endlessly");
        p.rememberPosition(123_456);
        check(p.consumePosition(600_000)==123_456,"Restore last valid position once");
        check(p.consumePosition(600_000)==0,"Position must be consumed");
        p.newSelection();
        check(p.attempts()==0,"New user selection resets retry budget");
        check(!p.retryAfter(1,-1007,true),"Malformed stream must not retry");
        check(!p.retryAfter(1,-1010,true),"Unsupported codec must not retry");
        check(p.retryAfter(1,-1004,true),"I/O failure can retry once");
        check(!p.retryAfter(1,-110,true),"I/O retry consumes full budget");
        p.newSelection();
        check(p.retryAfter(100,0,true),"Media server died may retry once");
        p.rememberPosition(900_000);
        check(p.consumePosition(500_000)==0,"Never seek past stream end");
        p.newSelection();
        p.rememberPosition(199_400);
        check(p.consumePosition(200_000)==0,"Avoid seeking into the completion tail");
        p.newSelection();
        p.rememberPosition(300);
        check(p.consumePosition(300_000)==0,"Do not seek sub-second state");
        System.out.println("AUREL bounded MediaPlayer recovery policy PASS");
    }
}
