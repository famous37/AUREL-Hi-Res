package com.aurel.hires;

import android.content.Context;
import android.hardware.usb.UsbDevice;
import android.os.Build;
import androidx.annotation.OptIn;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.Format;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.audio.AudioSink;
import androidx.media3.exoplayer.audio.DefaultAudioSink;
import com.decent.usbaudio.UsbAudioDevice;
import com.decent.usbaudio.media3.UsbAudioSink;
import com.decent.usbaudio.media3.UsbAudioSinkConfig;
import org.json.JSONObject;

/**
 * Experimental, real USB Audio Class 2.0 output. Unlike an Android mixer
 * preference, UsbAudioSink sends decoded PCM over the USB host connection via
 * usbdevfs. The standard MediaPlayer path remains available as a fallback.
 *
 * Do not equate this object's existence with a verified bit-perfect transfer:
 * DAC clock, precision and stream health must be checked on real hardware.
 */
@OptIn(markerClass = UnstableApi.class)
final class UsbDirectPlayback {
    interface Listener {
        void onReady(UsbDirectPlayback playback);
        void onEnded(UsbDirectPlayback playback);
        void onError(UsbDirectPlayback playback, String message);
    }

    private final ExoPlayer player;
    private UsbAudioSink sink;
    private boolean ready;
    private String failure = "";
    private int sourceRate;
    private int sourceChannels;
    private String sourceMime = "";
    private final Listener listener;

    static boolean supported(Context context) {
        if (Build.VERSION.SDK_INT < 29) return false;
        try {
            UsbAudioDevice usb = UsbAudioDevice.Companion.getInstance(context);
            UsbDevice device = usb.findUsbAudioDevice();
            return device != null && usb.hasPermission(device);
        } catch (RuntimeException | LinkageError error) {
            return false;
        }
    }

    static boolean connected(Context context) {
        if (Build.VERSION.SDK_INT < 29) return false;
        try {
            return UsbAudioDevice.Companion.getInstance(context).findUsbAudioDevice() != null;
        } catch (RuntimeException | LinkageError error) {
            return false;
        }
    }

    static void requestPermission(Context context, java.util.function.Consumer<Boolean> callback) {
        if (Build.VERSION.SDK_INT < 29) { callback.accept(false); return; }
        try {
            UsbAudioDevice usb = UsbAudioDevice.Companion.getInstance(context);
            UsbDevice device = usb.findUsbAudioDevice();
            if (device == null) { callback.accept(false); return; }
            if (usb.hasPermission(device)) { callback.accept(true); return; }
            usb.requestPermission(device, granted -> {
                callback.accept(Boolean.TRUE.equals(granted));
                return kotlin.Unit.INSTANCE;
            });
        } catch (RuntimeException | LinkageError error) {
            callback.accept(false);
        }
    }

    UsbDirectPlayback(Context context, Listener listener) {
        this.listener = listener;
        DefaultRenderersFactory factory = new DefaultRenderersFactory(context) {
            @Override
            protected AudioSink buildAudioSink(Context ctx, boolean enableFloatOutput,
                                                boolean enableOffload) {
                DefaultAudioSink delegate = new DefaultAudioSink.Builder(ctx)
                    .setEnableFloatOutput(true).build();
                // Native USB stream owns the actual audio samples. DefaultAudioSink
                // is used for timeline tracking and muted while direct USB runs.
                sink = new UsbAudioSink(delegate, ctx,
                    new UsbAudioSinkConfig(true, true));
                return sink;
            }
        };
        // Prefer FFmpeg for 24-bit FLAC; platform MediaCodec may truncate to 16-bit.
        factory.setExtensionRendererMode(
            DefaultRenderersFactory.EXTENSION_RENDERER_MODE_PREFER);
        player = new ExoPlayer.Builder(context)
            .setRenderersFactory(factory).build();
        player.setAudioAttributes(
            new androidx.media3.common.AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .build(), false);
        player.setVolume(1f);
        if (sink != null) sink.attachToPlayer(player);
        player.addListener(new Player.Listener() {
            @Override public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_READY && !ready) {
                    ready = true;
                    UsbDirectPlayback.this.listener.onReady(UsbDirectPlayback.this);
                } else if (state == Player.STATE_ENDED) {
                    UsbDirectPlayback.this.listener.onEnded(UsbDirectPlayback.this);
                }
            }
            @Override public void onPlayerError(PlaybackException error) {
                failure = error.getMessage() == null
                    ? "USB audio playback error" : error.getMessage();
                UsbDirectPlayback.this.listener.onError(UsbDirectPlayback.this, failure);
            }
            @Override public void onTracksChanged(androidx.media3.common.Tracks tracks) {
                for (androidx.media3.common.Tracks.Group group : tracks.getGroups()) {
                    if (group.getType() != C.TRACK_TYPE_AUDIO) continue;
                    for (int i = 0; i < group.length; i++) {
                        if (!group.isTrackSelected(i)) continue;
                        Format format = group.getTrackFormat(i);
                        sourceRate = Math.max(0, format.sampleRate);
                        sourceChannels = Math.max(0, format.channelCount);
                        sourceMime = format.sampleMimeType == null ? "" : format.sampleMimeType;
                        return;
                    }
                }
            }
        });
    }

    void prepare(String httpsUrl) {
        if (httpsUrl == null || !httpsUrl.startsWith("https://"))
            throw new IllegalArgumentException("Expected a signed HTTPS audio stream");
        player.setMediaItem(MediaItem.fromUri(httpsUrl));
        player.setPlayWhenReady(false);
        player.prepare();
    }
    void start() { player.play(); }
    void pause() { player.pause(); }
    boolean isPlaying() { return player.isPlaying(); }
    boolean isReady() { return ready; }
    boolean usbStreamActive() {
        try { return sink != null && sink.isDirectUsbStreamActive(); }
        catch (RuntimeException | LinkageError error) { return false; }
    }
    int position() { return (int)Math.min(Integer.MAX_VALUE,Math.max(0,player.getCurrentPosition())); }
    int duration() {
        long d = player.getDuration();
        return (int)Math.min(Integer.MAX_VALUE,Math.max(0, d == C.TIME_UNSET ? 0 : d));
    }
    void seekTo(int ms) { player.seekTo(Math.max(0,ms)); }
    int sourceRate() { return sourceRate; }
    int sourceChannels() { return sourceChannels; }
    String sourceMime() { return sourceMime; }
    void release() {
        try { if (sink != null) sink.detachFromPlayer(); }
        catch (RuntimeException ignored) {}
        player.release();
    }

    JSONObject status() {
        JSONObject out = new JSONObject();
        try {
            out.put("enabled",true);
            boolean actualUsb = usbStreamActive();
            out.put("status",failure.isEmpty() ?
                    (ready && actualUsb ? "direct_usb_playback" :
                     ready ? "direct_usb_not_active" : "direct_usb_preparing")
                    : "direct_usb_error");
            out.put("detail",failure.isEmpty()
                ? (actualUsb
                  ? "Native USB isochronous stream active; decoded PCM sample identity is not independently measured."
                  : "Native USB stream is not active. Audio may be using Android fallback.")
                : failure);
            out.put("usbRouted",false); // Android AudioTrack is NOT the direct USB route
            out.put("mixerPreferenceAccepted",false); // no Android mixer is used
            out.put("directUsbSelected",true);
            out.put("directUsbActive",actualUsb);
            out.put("nativeFlacEngine",sink != null && sink.isNativeEngineActive());
            out.put("endToEndVerified",false);
            out.put("sampleRateHz",sourceRate);
            out.put("apiSupported",true);
        } catch (Exception ignored) {}
        return out;
    }
}
