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
 * Android platform USB mixer selection, API 34+. No private USB driver,
 * USB permission, interface claim or exclusive JNI streaming.
 *
 * BIT_PERFECT is optional in the device Audio HAL. A preferred mixer setting
 * only applies when the actual AudioTrack's encoding/mask/rate match.
 * MediaPlayer does not disclose its decoded AudioTrack PCM format, therefore
 * we report system-accepted requests, not unmeasured end-to-end identity.
 */
final class BitPerfectOutput {
    private final AudioManager manager;
    private final AudioAttributes attributes=new AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build();

    private volatile boolean enabled;
    private volatile AudioDeviceInfo configuredDevice;
    private volatile int configuredRate,configuredBits,configuredChannels,configuredEncoding;
    private volatile String phase="off",detail="Standard Android MediaPlayer / AudioFlinger";
    private String lastAttempt="";

    BitPerfectOutput(Context context,boolean wanted){
        manager=(AudioManager)context.getSystemService(Context.AUDIO_SERVICE);
        enabled=wanted;
        if(wanted){
            phase="waiting_track";
            detail="Android 14+ USB mixer capability is checked per audio track.";
        }
    }

    boolean isEnabled(){return enabled;}
    AudioAttributes audioAttributes(){return attributes;}

    static boolean usb(AudioDeviceInfo device){
        if(device==null)return false;
        int type=device.getType();
        return type==AudioDeviceInfo.TYPE_USB_DEVICE ||
            type==AudioDeviceInfo.TYPE_USB_HEADSET ||
            type==AudioDeviceInfo.TYPE_USB_ACCESSORY;
    }

    private AudioDeviceInfo connectedUsb(MediaPlayer mp){
        if(manager==null)return null;
        AudioDeviceInfo active=null;
        try{if(mp!=null)active=mp.getRoutedDevice();}catch(RuntimeException ignored){}
        AudioDeviceInfo first=null;
        for(AudioDeviceInfo d:manager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)){
            if(!usb(d))continue;
            if(first==null)first=d;
            if(active!=null&&active.getId()==d.getId())return d;
        }
        return first;
    }

    private boolean stillConnected(AudioDeviceInfo old){
        if(old==null||manager==null)return false;
        for(AudioDeviceInfo d:manager.getDevices(AudioManager.GET_DEVICES_OUTPUTS))
            if(usb(d)&&d.getId()==old.getId())return true;
        return false;
    }

    /** AudioPolicy receives this preference only when explicitly enabled. */
    boolean routeUsb(MediaPlayer mp){
        if(mp==null||manager==null)return false;
        try{
            AudioDeviceInfo usb=connectedUsb(mp);
            AudioDeviceInfo preferred=mp.getPreferredDevice();
            if(usb==null){
                if(BitPerfectOutput.usb(preferred))mp.setPreferredDevice(null);
                return false;
            }
            if(preferred!=null&&preferred.getId()==usb.getId())return true;
            return mp.setPreferredDevice(usb);
        }catch(RuntimeException failure){
            android.util.Log.w("AUREL_AUDIO","Android USB routing request failed",failure);
            return false;
        }
    }

    private void clearPreference(){
        AudioDeviceInfo old=configuredDevice;
        configuredDevice=null;
        configuredRate=0;configuredBits=0;configuredChannels=0;configuredEncoding=0;
        lastAttempt="";
        if(old!=null&&manager!=null&&Build.VERSION.SDK_INT>=34)
            try{manager.clearPreferredMixerAttributes(attributes,old);}
            catch(RuntimeException failure){
                android.util.Log.w("AUREL_AUDIO","Platform mixer cleanup failed",failure);
            }
    }

    void release(){
        clearPreference();
        phase=enabled?"waiting_track":"off";
        detail=enabled?"Waiting for an audio track and USB DAC.":
            "Standard Android MediaPlayer / AudioFlinger";
    }

    void setEnabled(boolean wanted,MediaPlayer mp,JSONObject stream){
        clearPreference();
        enabled=wanted;
        if(!wanted&&Build.VERSION.SDK_INT>=34&&manager!=null)
            try{
                for(AudioDeviceInfo d:manager.getDevices(AudioManager.GET_DEVICES_OUTPUTS))
                    if(usb(d))manager.clearPreferredMixerAttributes(attributes,d);
            }catch(RuntimeException ignored){}
        if(!wanted&&mp!=null)
            try{if(usb(mp.getPreferredDevice()))mp.setPreferredDevice(null);}
            catch(RuntimeException ignored){}
        phase=wanted?"waiting_track":"off";
        detail=wanted?"Checking Android USB bit-perfect policy for the selected track.":
            "Standard Android MediaPlayer / AudioFlinger";
    }

    private static int sourceRate(JSONObject src){
        if(src==null)return 0;
        int r=src.optInt("sample_rate_hz",0);
        if(r==0)r=src.optInt("sample_rate",0);
        return r>=8000&&r<=768000?r:0;
    }
    private static int sourceBits(JSONObject src){
        if(src==null)return 0;
        int b=src.optInt("bits_depth",0);
        return b==16||b==24||b==32?b:0;
    }
    private static int sourceChannels(JSONObject src){
        if(src==null)return 0;
        int n=src.optInt("n_channels",0);
        return n>=1&&n<=8?n:0;
    }
    private static int encodingBits(int encoding){
        if(encoding==AudioFormat.ENCODING_PCM_16BIT)return 16;
        if(encoding==AudioFormat.ENCODING_PCM_24BIT_PACKED)return 24;
        if(encoding==AudioFormat.ENCODING_PCM_32BIT)return 32;
        return 0;
    }
    private static boolean matches(AudioFormat f,int rate,int bits,int channels){
        return f!=null&&f.getSampleRate()==rate&&f.getChannelCount()==channels
            &&encodingBits(f.getEncoding())==bits;
    }

    /**
     * No forced USB claiming, custom driver or stream restart. Unavailable
     * BIT_PERFECT is a normal capability outcome, not a playback error.
     */
    void apply(MediaPlayer mp,JSONObject stream){
        if(!enabled)return;
        if(manager==null||Build.VERSION.SDK_INT<34){
            if(configuredDevice!=null)clearPreference();
            phase="android_version";
            detail="Requires Android 14+ (API 34). Playback uses Android audio normally.";
            return;
        }
        AudioDeviceInfo device=connectedUsb(mp);
        if(device==null){
            if(configuredDevice!=null)clearPreference();
            phase="no_usb";
            detail="USB DAC not connected. Android will select its standard output.";
            return;
        }
        // Android media routing, NOT direct or exclusive USB ownership.
        if(mp!=null)routeUsb(mp);
        final int rate=sourceRate(stream),bits=sourceBits(stream),channels=sourceChannels(stream);
        if(rate==0||bits==0||channels==0){
            if(configuredDevice!=null)clearPreference();
            phase="unknown_format";
            detail="Cannot match source PCM rate/depth/channels; Android playback remains active.";
            return;
        }
        String key=device.getId()+"/"+rate+"/"+bits+"/"+channels;
        if(key.equals(lastAttempt))return;
        if(configuredDevice!=null)clearPreference();
        lastAttempt=key;
        try{
            List<AudioMixerAttributes> supported=manager.getSupportedMixerAttributes(device);
            if(supported==null||supported.isEmpty()){
                phase="policy_unavailable";
                detail="Android reports no supported USB mixer attributes for this DAC.";
                return;
            }
            boolean hasBitPerfect=false;
            AudioMixerAttributes chosen=null;
            for(AudioMixerAttributes entry:supported){
                if(entry==null||entry.getMixerBehavior()!=AudioMixerAttributes.MIXER_BEHAVIOR_BIT_PERFECT)
                    continue;
                hasBitPerfect=true;
                if(matches(entry.getFormat(),rate,bits,channels)){chosen=entry;break;}
            }
            if(chosen==null){
                phase=hasBitPerfect?"unsupported_format":"policy_unavailable";
                detail=hasBitPerfect?
                    "Android offers bit-perfect, but not in this track's exact PCM format.":
                    "USB Audio HAL does not advertise optional BIT_PERFECT. Android playback continues.";
                return;
            }
            if(!manager.setPreferredMixerAttributes(attributes,device,chosen)){
                phase="rejected";
                detail="Android rejected BIT_PERFECT for this format; normal audio continues.";
                return;
            }
            AudioMixerAttributes accepted=manager.getPreferredMixerAttributes(attributes,device);
            if(accepted==null||accepted.getMixerBehavior()!=AudioMixerAttributes.MIXER_BEHAVIOR_BIT_PERFECT||
                !matches(accepted.getFormat(),rate,bits,channels)){
                manager.clearPreferredMixerAttributes(attributes,device);
                phase="rejected";
                detail="Android did not retain the requested bit-perfect mixer policy.";
                return;
            }
            configuredDevice=device;
            configuredRate=rate;configuredBits=bits;configuredChannels=channels;
            configuredEncoding=accepted.getFormat().getEncoding();
            phase="requested";
            detail="Android accepted a BIT_PERFECT mixer preference for "+bits+"-bit / "+
                rate+" Hz / "+channels+" ch. MediaPlayer's actual PCM output is not directly verified.";
        }catch(RuntimeException failure){
            phase="policy_error";
            detail="USB mixer API error; Android playback remains available ("+
                failure.getClass().getSimpleName()+").";
            android.util.Log.w("AUREL_AUDIO","Platform mixer selection failed",failure);
        }
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


    /** A request is not a measurement of bit identity at the USB DAC. */
    JSONObject status(MediaPlayer mp){
        JSONObject result=new JSONObject();
        try{
            String p=phase,d=detail;
            boolean actualUsb=false,selected=false;
            AudioDeviceInfo actual=null;
            try{if(mp!=null&&mp.isPlaying())actual=mp.getRoutedDevice();}
            catch(RuntimeException ignored){}
            actualUsb=usb(actual);
            if(!enabled&&mp!=null&&mp.isPlaying()){
                p=actualUsb?"standard_usb_playback":
                    connectedUsb(mp)!=null?"standard_usb_not_routed":"off";
                d=actualUsb?"Android USB DAC output (not independently bit-perfect).":
                    "Standard Android playback and routing.";
            }
            if(enabled&&configuredDevice!=null){
                selected=stillConnected(configuredDevice);
                if(!selected){
                    p="no_usb";d="USB device disconnected; Android audio remains enabled.";
                }else if(actualUsb&&actual.getId()==configuredDevice.getId()){
                    p="usb_mixer_routed";
                    d="USB route and Android BIT_PERFECT preference are selected. "+
                      "MediaPlayer PCM format and end-to-end bit identity are not independently measured.";
                }else{
                    p="requested";
                }
            }
            result.put("enabled",enabled);
            result.put("status",p);
            result.put("detail",d);
            result.put("usbRouted",actualUsb);
            result.put("mixerPreferenceAccepted",enabled&&selected);
            result.put("sampleRateHz",configuredRate);
            result.put("bits",configuredBits);
            result.put("channels",configuredChannels);
            result.put("pcmEncoding",configuredEncoding);
            result.put("apiSupported",Build.VERSION.SDK_INT>=34);
            result.put("directUsbActive",false);
            result.put("usbVolumeMode","android");
            result.put("endToEndVerified",false);
        }catch(Exception ignored){}
        return result;
    }
}
