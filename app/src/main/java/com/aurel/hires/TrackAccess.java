package com.aurel.hires;

import org.json.JSONObject;
import java.time.LocalDate;
import java.time.ZoneId;

/** Qobuz rights and release-date guards shared by queue, skip and streaming.
 * Missing flags alone are NOT a denial. Album pre-release dates are consulted
 * only if the individual track has no explicit streamable=true entitlement.
 * This allows previously released singles from an upcoming album. */
final class TrackAccess {
    private TrackAccess() {}

    private static LocalDate date(String raw) {
        if(raw==null||raw.length()<10)return null;
        try {
            // Qobuz date fields are commonly yyyy-MM-dd; ISO timestamps work too.
            return LocalDate.parse(raw.substring(0,10));
        } catch(Exception ignored) { return null; }
    }

    private static boolean future(String raw) {
        LocalDate candidate=date(raw);
        return candidate!=null&&candidate.isAfter(LocalDate.now(ZoneId.systemDefault()));
    }

    private static String upcoming(String iso) {
        return "Available for streaming from "+iso.substring(0,10)+".";
    }

    static String reason(JSONObject track) {
        if(track==null)return "Track information is unavailable.";
        String streamDate=track.optString("release_date_stream","");
        if(future(streamDate))return upcoming(streamDate);
        // Do not treat previewable, purchasable, downloadable, or album-wide
        // streamability as permission to stream this particular track.
        if(track.has("streamable")&&!track.isNull("streamable")&&
           !track.optBoolean("streamable",false)){
            return "This track is not currently available for streaming.";
        }
        if(track.has("released")&&!track.isNull("released")&&
           !track.optBoolean("released",false)){
            return "This track has not been released yet.";
        }
        final boolean trackStreamable=track.has("streamable")
            &&!track.isNull("streamable")&&track.optBoolean("streamable",false);
        final boolean datedTrack=!streamDate.isEmpty();
        // A track available as an advance single must not be locked merely
        // because the full album's public release date is still in the future.
        if(!trackStreamable&&!datedTrack){
            String original=track.optString("release_date_original","");
            if(future(original))return upcoming(original);
            JSONObject album=track.optJSONObject("album");
            if(album!=null){
                String albumDate=album.optString("release_date_stream","");
                if(albumDate.isEmpty())albumDate=album.optString("release_date_original","");
                if(future(albumDate))return upcoming(albumDate);
            }
        }
        return null; // Not known unavailable; streaming API still decides.
    }

    static boolean playable(JSONObject track){return reason(track)==null;}
}
