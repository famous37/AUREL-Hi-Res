package com.aurel.hires;
public final class AurelUnplugPolicyTest {
    private static void expect(boolean value,boolean expected,String description){
        if(value!=expected)throw new AssertionError(description);
    }
    public static void main(String[] args){
        expect(AurelUnplugPolicy.pauseForRemovedOutput(true,41,true,41,true),
            true,"Active USB DAC removal must pause");
        expect(AurelUnplugPolicy.pauseForRemovedOutput(true,41,true,99,true),
            false,"Removing an unrelated device must not pause");
        expect(AurelUnplugPolicy.pauseForRemovedOutput(false,41,true,41,true),
            false,"Already paused track must remain paused");
        expect(AurelUnplugPolicy.pauseForRemovedOutput(true,41,false,41,true),
            false,"Built-in phone output must not falsely pause");
        expect(AurelUnplugPolicy.pauseForRemovedOutput(true,-1,true,41,true),
            false,"Unknown routed device must not trigger a false disconnect");
        expect(AurelUnplugPolicy.pauseForRemovedOutput(true,41,true,41,false),
            false,"Speaker device callback is not an unplugged headset");
        expect(AurelUnplugPolicy.pauseForRoutingChange(true,17,true,2),
            true,"External route replaced with speaker must pause");
        expect(AurelUnplugPolicy.pauseForRoutingChange(true,17,true,17),
            false,"Unchanged route must not pause");
        expect(AurelUnplugPolicy.pauseForRoutingChange(true,17,false,2),
            false,"Speaker route changes are not headphone unplug events");
        expect(AurelUnplugPolicy.pauseForRoutingChange(false,17,true,2),
            false,"Stopped player must not be restarted or paused again");
        System.out.println("AUREL unplug safety: active USB, wired, Bluetooth, route changes and false-positive guard PASS");
    }
}
