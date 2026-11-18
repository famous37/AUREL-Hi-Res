package com.aurel.hires;

/**
 * Conservative route-loss policy for device callbacks. Never pause merely
 * because a second external output was removed while it was not the route.
 * Requires an active playback intention and a previously known route.
 */
final class AurelUnplugPolicy {
    private AurelUnplugPolicy() {}

    static boolean pauseForRemovedOutput(
        boolean playingOrRequested, int activeRouteId, boolean activeExternal,
        int removedId, boolean removedExternal) {
        return playingOrRequested && activeExternal && removedExternal &&
            activeRouteId >= 0 && activeRouteId == removedId;
    }

    static boolean pauseForRoutingChange(
        boolean playingOrRequested,int oldRouteId,boolean oldExternal,
        int newRouteId) {
        return playingOrRequested && oldExternal && oldRouteId >= 0 &&
            oldRouteId != newRouteId;
    }
}
