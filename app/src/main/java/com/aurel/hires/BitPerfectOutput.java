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
 * Android output diagnostics and compatibility shim. It does NOT request
 * bit-perfect Android mixer attributes. Normal playback uses AudioFlinger,
 * while direct PCM output is owned exclusively by libusbdac.
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
            phase = "waiting_track";
            detail = "Direct USB engine selected. Awaiting a compatible DAC and track.";
        }
    }

    boolean isEnabled() { return enabled; }
    AudioAttributes audioAttributes() { return attributes; }

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

    /**
     * Standard Android USB routing works independently of the optional
     * Android 14 bit-perfect mixer preference. Selecting the connected
     * USB sink must never silently depend on the bit-perfect toggle.
     * This does not claim end-to-end PCM identity.
     */
    boolean routeUsb(MediaPlayer mediaPlayer) {
        if (manager == null || mediaPlayer == null) return false;
        try {
            AudioDeviceInfo candidate = connectedUsb(mediaPlayer);
            AudioDeviceInfo preferred = mediaPlayer.getPreferredDevice();
            if (candidate == null) {
                // Do not pin a detached USB device. Let Android pick the
                // speaker, analog headphones, or Bluetooth as appropriate.
                if (preferred != null && usb(preferred))
                    mediaPlayer.setPreferredDevice(null);
                return false;
            }
            if (preferred != null && preferred.getId() == candidate.getId())
                return true;
            return mediaPlayer.setPreferredDevice(candidate);
        } catch (RuntimeException error) {
            android.util.Log.w("AUREL_AUDIO", "USB audio route request failed", error);
            return false;
        }
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

    /** The USB mode switch chooses the libusbdac engine in MainActivity.
     * NEVER negotiate the optional Android mixer bit-perfect path here. */
    void setEnabled(boolean wanted, MediaPlayer mediaPlayer, JSONObject stream) {
        enabled = wanted;
        clearPreference();
        if (Build.VERSION.SDK_INT >= 34 && manager != null) {
            for (AudioDeviceInfo device : manager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
                if (!usb(device)) continue;
                try { manager.clearPreferredMixerAttributes(attributes, device); }
                catch (RuntimeException ignored) {}
            }
        }
        if (mediaPlayer != null) {
            try { mediaPlayer.setPreferredDevice(null); }
            catch (RuntimeException ignored) {}
        }
        phase = wanted ? "waiting_track" : "off";
        detail = wanted ? "libusbdac native USB audio selected; no Android mixer request." :
            "Standard Android MediaPlayer / AudioFlinger";
    }

    /**
     * Deliberate no-op compatibility stub: direct USB bit-perfect routing
     * is implemented ONLY by AurelUsbDacHost/libusbdac, never AudioManager.
     */
    void apply(MediaPlayer mediaPlayer, JSONObject stream) {
        // Standard AudioFlinger output and native USB are separate engines.
    }

    /** Physical and policy capabilities only. A listed sample rate is not
     * evidence that decoded PCM reaches the external DAC unchanged. */
    JSONObject diagnostics(MediaPlayer mediaPlayer) {
        JSONObject out=new JSONObject();
        try {
            out.put("androidApi",Build.VERSION.SDK_INT);
            out.put("bitPerfect",status(mediaPlayer));
            org.json.JSONArray devices=new org.json.JSONArray();
            AudioDeviceInfo route=null;
            try {if(mediaPlayer!=null)route=mediaPlayer.getRoutedDevice();}
            catch(RuntimeException ignored){}
            if(manager!=null) {
                for(AudioDeviceInfo device:manager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
                    JSONObject item=new JSONObject();
                    boolean isUsb=usb(device);
                    int type=device.getType();
                    // AudioDeviceInfo exposes real connected Android audio outputs.
                    // Codec negotiated for an A2DP link is NOT public to normal apps:
                    // BluetoothA2dp.getCodecStatus requires privileged access.
                    boolean isA2dp=type==AudioDeviceInfo.TYPE_BLUETOOTH_A2DP;
                    boolean isBle=Build.VERSION.SDK_INT>=31 &&
                        (type==AudioDeviceInfo.TYPE_BLE_HEADSET ||
                         type==AudioDeviceInfo.TYPE_BLE_SPEAKER);
                    boolean isBtVoice=type==AudioDeviceInfo.TYPE_BLUETOOTH_SCO;
                    boolean isHearingAid=Build.VERSION.SDK_INT>=28 &&
                        type==AudioDeviceInfo.TYPE_HEARING_AID;
                    boolean isBluetooth=isA2dp||isBle||isBtVoice||isHearingAid;
                    String kind=isUsb?"USB DAC / USB audio":
                        isA2dp?"Bluetooth A2DP":
                        isBle?"Bluetooth LE audio":
                        isBtVoice?"Bluetooth call audio":
                        isHearingAid?"Bluetooth hearing aid":
                        type==AudioDeviceInfo.TYPE_BUILTIN_SPEAKER?"Built-in speaker":
                        type==AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
                            type==AudioDeviceInfo.TYPE_WIRED_HEADSET?"Analog headphones":
                        type==AudioDeviceInfo.TYPE_HDMI?"HDMI audio":"Other output";
                    item.put("name",String.valueOf(device.getProductName()));
                    item.put("category",kind);
                    item.put("usb",isUsb);
                    item.put("bluetooth",isBluetooth);
                    item.put("bluetoothTransport",isA2dp?"A2DP":isBle?"LE Audio":
                        isBtVoice?"SCO":isHearingAid?"Hearing aid":"");
                    // A codec (LDAC, aptX, AAC, SBC etc) must never be guessed.
                    if(isBluetooth) {
                        item.put("negotiatedCodec",JSONObject.NULL);
                        item.put("codecStatus","Unavailable to standard Android apps");
                    }
                    item.put("currentlyRouted",route!=null&&route.getId()==device.getId());
                    org.json.JSONArray rates=new org.json.JSONArray();
                    for(int hz:device.getSampleRates())rates.put(hz);
                    item.put("advertisedSampleRates",rates);
                    org.json.JSONArray channels=new org.json.JSONArray();
                    for(int count:device.getChannelCounts())channels.put(count);
                    item.put("advertisedChannelCounts",channels);
                    if(isUsb&&Build.VERSION.SDK_INT>=34) {
                        org.json.JSONArray formats=new org.json.JSONArray();
                        try {
                            List<AudioMixerAttributes> mixers=manager.getSupportedMixerAttributes(device);
                            if(mixers!=null)for(AudioMixerAttributes mixer:mixers) {
                                if(formats.length()>=32)break;
                                if(mixer==null||mixer.getFormat()==null)continue;
                                AudioFormat format=mixer.getFormat();
                                formats.put(new JSONObject()
                                    .put("hz",format.getSampleRate())
                                    .put("channels",format.getChannelCount())
                                    .put("encoding",format.getEncoding())
                                    .put("bitPerfect",mixer.getMixerBehavior()==
                                        AudioMixerAttributes.MIXER_BEHAVIOR_BIT_PERFECT));
                            }
                        }catch(RuntimeException ignored){}
                        item.put("mixerFormats",formats);
                    }
                    devices.put(item);
                }
            }
            out.put("routeKnown",route!=null);
            out.put("outputs",devices);
            out.put("verifiedEndToEnd",false);
            out.put("note","Hardware-reported capabilities, not measured DAC output. "+
                "Android MediaPlayer does not expose bit-identical decoded PCM verification.");
        }catch(Exception ignored){}
        return out;
    }

    /** Reporting a request is not proof of end-to-end bit-identical audio. */
    JSONObject status(MediaPlayer mediaPlayer) {
        JSONObject result = new JSONObject();
        try {
            String currentPhase = phase;
            String currentDetail = detail;
            AudioDeviceInfo requested = configuredDevice;
            boolean routedToUsb = false;
            boolean standardUsb = false;
            if (!enabled && mediaPlayer != null) {
                try {
                    if (mediaPlayer.isPlaying()) {
                        AudioDeviceInfo actual = mediaPlayer.getRoutedDevice();
                        standardUsb = actual != null && usb(actual);
                        if (standardUsb) {
                            currentPhase = "standard_usb_playback";
                            currentDetail = "USB DAC playing through Android audio (not bit-perfect).";
                        } else if (connectedUsb(mediaPlayer) != null) {
                            currentPhase = "standard_usb_not_routed";
                            currentDetail = "USB DAC detected, but Android has not routed this player to USB. Check the system's USB audio routing setting.";
                        }
                    }
                } catch (RuntimeException ignored) {}
            }
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
            result.put("usbRouted", routedToUsb || standardUsb);
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
