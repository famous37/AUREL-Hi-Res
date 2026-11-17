package com.aurel.hires;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioDeviceInfo;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioMixerAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import org.json.JSONObject;
import java.util.List;

/**
 * Optional Android 14+ USB mixer preference, NOT a claim that the MediaPlayer
 * decoder has produced bit-identical PCM. Fail closed when the audio policy
 * reports no supported bit-perfect mixer format matching the source track.
 *
 * All mutation is performed by MainActivity on the UI thread. The snapshots
 * are also used by the WebView bridge's background session requests.
 */
final class BitPerfectOutput {
    private final AudioManager manager;
    private final AudioAttributes attributes =
        new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build();

    private volatile boolean enabled;
    private volatile AudioDeviceInfo configuredDevice;
    private volatile int configuredRate;
    private volatile int configuredBits;
    private volatile String phase = "off";
    private volatile String detail = "Standard Android playback";
    private boolean changing = false;

    BitPerfectOutput(Context context, boolean wanted) {
        manager = (AudioManager)context.getSystemService(Context.AUDIO_SERVICE);
        enabled = wanted;
        if (wanted) {
            phase = Build.VERSION.SDK_INT < 34 ? "android_version" : "no_usb";
            detail = Build.VERSION.SDK_INT < 34
                ? "Requires Android 14 (API 34) or newer."
                : "Connect a compatible USB DAC.";
        }
    }

    boolean isEnabled() { return enabled; }

    static boolean usb(AudioDeviceInfo device) {
        if (device == null) return false;
        int type = device.getType();
        return type == AudioDeviceInfo.TYPE_USB_DEVICE
            || type == AudioDeviceInfo.TYPE_USB_HEADSET
            || type == AudioDeviceInfo.TYPE_USB_ACCESSORY;
    }

    private AudioDeviceInfo connectedUsb(MediaPlayer mediaPlayer) {
        if (manager == null) return null;
        AudioDeviceInfo routed = null;
        try { if (mediaPlayer != null) routed = mediaPlayer.getRoutedDevice(); }
        catch (RuntimeException ignored) {}
        AudioDeviceInfo first = null;
        for (AudioDeviceInfo device : manager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
            if (!usb(device)) continue;
            if (first == null) first = device;
            if (routed != null && routed.getId() == device.getId()) return device;
        }
        return first;
    }

    private boolean stillConnected(AudioDeviceInfo device) {
        if (device == null || manager == null) return false;
        for (AudioDeviceInfo active : manager.getDevices(AudioManager.GET_DEVICES_OUTPUTS))
            if (active.getId() == device.getId() && usb(active)) return true;
        return false;
    }

    private void clearPreference() {
        AudioDeviceInfo old = configuredDevice;
        configuredDevice = null;
        configuredRate = 0;
        configuredBits = 0;
        if (old != null && manager != null && Build.VERSION.SDK_INT >= 34) {
            try { manager.clearPreferredMixerAttributes(attributes, old); }
            catch (RuntimeException ignored) {}
        }
    }

    void release() {
        clearPreference();
        phase = enabled ? "waiting_track" : "off";
        detail = enabled ? "Waiting for an audio stream." : "Standard Android playback";
    }

    void setEnabled(boolean wanted, MediaPlayer mediaPlayer, JSONObject stream) {
        enabled = wanted;
        if (!wanted) {
            clearPreference();
            if (mediaPlayer != null) {
                try { mediaPlayer.setPreferredDevice(null); }
                catch (RuntimeException ignored) {}
            }
            phase = "off";
            detail = "Standard Android playback";
        } else {
            apply(mediaPlayer, stream);
        }
    }

    void apply(MediaPlayer mediaPlayer, JSONObject stream) {
        if (changing) return;
        changing = true;
        try { applyInternal(mediaPlayer, stream); }
        finally { changing = false; }
    }

    private void applyInternal(MediaPlayer mediaPlayer, JSONObject stream) {
        if (!enabled) {
            clearPreference();
            phase = "off";
            detail = "Standard Android playback";
            return;
        }
        if (Build.VERSION.SDK_INT < 34) {
            clearPreference();
            phase = "android_version";
            detail = "Requires Android 14 (API 34) or newer.";
            return;
        }
        if (manager == null) {
            clearPreference();
            phase = "unsupported";
            detail = "Android AudioManager is unavailable.";
            return;
        }
        AudioDeviceInfo usbDevice = connectedUsb(mediaPlayer);
        if (usbDevice == null) {
            clearPreference();
            phase = "no_usb";
            detail = "Connect a USB DAC. Speaker, wired analog and Bluetooth are not bit-perfect targets.";
            return;
        }
        if (mediaPlayer == null || stream == null) {
            clearPreference();
            phase = "waiting_track";
            detail = "USB DAC detected. Start a lossless track to request the mixer format.";
            return;
        }

        double sourceHz = stream.optDouble("sample_rate_hz", 0);
        int hz = (int)Math.round(sourceHz < 1000 && sourceHz > 0 ? sourceHz * 1000 : sourceHz);
        int bits = stream.optInt("bits_depth", 0);
        int channels = stream.optInt("n_channels", 0);
        if (hz < 8000 || hz > 768000 || (bits != 16 && bits != 24 && bits != 32)) {
            clearPreference();
            phase = "unknown_format";
            detail = "Stream PCM sample rate or bit depth is not confirmed.";
            return;
        }
        if (channels != 1 && channels != 2) {
            clearPreference();
            phase = "unsupported_format";
            detail = "Only mono and stereo PCM can be matched by this mode.";
            return;
        }

        int encoding = bits == 16 ? AudioFormat.ENCODING_PCM_16BIT :
            bits == 24 ? AudioFormat.ENCODING_PCM_24BIT_PACKED : AudioFormat.ENCODING_PCM_32BIT;
        AudioMixerAttributes matched = null;
        try {
            List<AudioMixerAttributes> supported = manager.getSupportedMixerAttributes(usbDevice);
            if (supported != null) for (AudioMixerAttributes option : supported) {
                if (option == null ||
                    option.getMixerBehavior() != AudioMixerAttributes.MIXER_BEHAVIOR_BIT_PERFECT)
                    continue;
                AudioFormat output = option.getFormat();
                if (output != null && output.getSampleRate() == hz
                    && output.getEncoding() == encoding && output.getChannelCount() == channels) {
                    matched = option;
                    break;
                }
            }
        } catch (RuntimeException ignored) {
            // Some vendors implement the query incompletely.
        }
        if (matched == null) {
            clearPreference();
            phase = "unsupported_format";
            detail = "USB audio policy does not expose bit-perfect "
                + bits + "-bit / " + hz + " Hz / " + channels + "ch for this DAC.";
            return;
        }

        if (configuredDevice != null && configuredDevice.getId() == usbDevice.getId()
            && configuredRate == hz && configuredBits == bits && stillConnected(configuredDevice)) {
            return; // Avoid repeated mixer resets when playback/routing events arrive.
        }
        clearPreference();
        boolean routed = false;
        boolean accepted = false;
        try {
            routed = mediaPlayer.setPreferredDevice(usbDevice);
            if (routed) {
                accepted = manager.setPreferredMixerAttributes(attributes, usbDevice, matched);
                if (accepted) {
                    AudioMixerAttributes actual =
                        manager.getPreferredMixerAttributes(attributes, usbDevice);
                    accepted = actual != null
                        && actual.getMixerBehavior() == AudioMixerAttributes.MIXER_BEHAVIOR_BIT_PERFECT
                        && actual.getFormat().getSampleRate() == hz
                        && actual.getFormat().getEncoding() == encoding;
                }
            }
        } catch (RuntimeException ignored) {
            accepted = false;
        }
        if (!accepted) {
            if (routed) {
                try { mediaPlayer.setPreferredDevice(null); }
                catch (RuntimeException ignored) {}
            }
            clearPreference();
            phase = "rejected";
            detail = "Android rejected the bit-perfect USB mixer request.";
            return;
        }
        configuredDevice = usbDevice;
        configuredRate = hz;
        configuredBits = bits;
        phase = "requested";
        detail = "Android accepted the USB bit-perfect mixer preference. "
            + "Decoder PCM and DAC samples are not independently verified.";
    }

    /** Reporting a request is not proof of end-to-end bit-identical audio. */
    JSONObject status(MediaPlayer mediaPlayer) {
        JSONObject result = new JSONObject();
        try {
            String currentPhase = phase;
            String currentDetail = detail;
            AudioDeviceInfo requested = configuredDevice;
            boolean routedToUsb = false;
            if (enabled && requested != null && stillConnected(requested)
                && mediaPlayer != null) {
                try {
                    AudioDeviceInfo actual = mediaPlayer.getRoutedDevice();
                    routedToUsb = actual != null && usb(actual)
                        && actual.getId() == requested.getId() && mediaPlayer.isPlaying();
                } catch (RuntimeException ignored) {}
                if (routedToUsb) {
                    currentPhase = "usb_mixer_routed";
                    currentDetail = "USB routing and Android bit-perfect mixer preference "
                        + "are active. End-to-end decoded PCM identity is not measured.";
                }
            } else if (enabled && requested != null && !stillConnected(requested)) {
                currentPhase = "no_usb";
                currentDetail = "USB DAC disconnected. Normal Android routing may continue.";
            }
            result.put("enabled", enabled);
            result.put("status", currentPhase);
            result.put("detail", currentDetail);
            result.put("usbRouted", routedToUsb);
            result.put("mixerPreferenceAccepted", enabled && requested != null
                && stillConnected(requested));
            result.put("sampleRateHz", configuredRate);
            result.put("bits", configuredBits);
            result.put("apiSupported", Build.VERSION.SDK_INT >= 34);
            result.put("endToEndVerified", false);
        } catch (Exception ignored) {}
        return result;
    }
}
