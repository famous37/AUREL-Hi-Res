package com.aurel.hires;

import android.content.Context;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import androidx.media3.exoplayer.audio.AudioSink;
import androidx.media3.exoplayer.audio.DefaultAudioSink;
import org.ostrichbat2k.usbdac.UsbAudioManager;
import org.ostrichbat2k.usbdac.UsbAudioManagerImpl;
import org.ostrichbat2k.usbdac.UsbDacPreferences;
import org.ostrichbat2k.usbdac.control.UsbControlState;
import org.ostrichbat2k.usbdac.streaming.RoutingAudioSink;
import org.ostrichbat2k.usbdac.streaming.UsbPipelineStats;
import kotlin.Pair;
import org.json.JSONObject;
import java.util.concurrent.CopyOnWriteArraySet;

/**
 * Independent USB Audio Class engine. OFF never opens or claims a USB interface:
 * Android MediaPlayer/AudioFlinger owns ALL normal routing and mixing.
 * ON hands decoded PCM to libusbdac's native isochronous USB sink.
 *
 * Dependency: GPL-3.0 libusbdac v0.2.0 (not the previous decent-player driver).
 * Android fallback for a genuinely unsupported USB format is labelled explicitly.
 */
final class AurelUsbDacHost {
    private static final class Prefs implements UsbDacPreferences {
        private volatile boolean enabled;
        private volatile Integer volumeDb;
        private final CopyOnWriteArraySet<UsbDacPreferences.Listener> listeners =
            new CopyOnWriteArraySet<>();
        Prefs(boolean enabled) { this.enabled = enabled; }
        @Override public boolean getEnabled() { return enabled; }
        @Override public boolean getBitPerfectMode() { return enabled; }
        @Override public Integer getVolumeDb() { return volumeDb; }
        @Override public void setVolumeDb(Integer value) { volumeDb = value; }
        @Override public boolean getAbxTestMode() { return false; }
        @Override public int getVolumeStepPercent() { return 2; }
        @Override public boolean getManualReleaseControl() { return false; }
        @Override public void registerListener(UsbDacPreferences.Listener listener) {
            listeners.add(listener);
        }
        @Override public void unregisterListener(UsbDacPreferences.Listener listener) {
            listeners.remove(listener);
        }
        void setEnabled(boolean wanted) {
            if(enabled == wanted) return;
            enabled = wanted;
            for (UsbDacPreferences.Listener listener : listeners) {
                listener.onBitPerfectModeChanged();
                listener.onUsbEnabledChanged();
            }
        }
    }

    private final Prefs prefs;
    private final UsbAudioManagerImpl manager;
    private final Context context;
    private volatile int requestedVolume = 35;

    AurelUsbDacHost(Context appContext, boolean enabled, int volumePercent) {
        context = appContext.getApplicationContext();
        prefs = new Prefs(enabled);
        // The library's third parameter is an optional decoded PCM bit-depth
        // provider; returning null does not fabricate unverified 24-bit data.
        manager = new UsbAudioManagerImpl(context, prefs, format -> null);
        requestedVolume = Math.max(0, Math.min(100, volumePercent));
        manager.start();
        if(enabled) manager.retryActivation();
    }

    void setEnabled(boolean enabled) {
        prefs.setEnabled(enabled);
        if(!enabled) manager.releaseClaim(0L, false, false);
        else manager.retryActivation();
    }

    boolean connected() {
        UsbManager usb = (UsbManager)context.getSystemService(Context.USB_SERVICE);
        if(usb == null) return false;
        for(UsbDevice d : usb.getDeviceList().values()) {
            for(int i=0;i<d.getInterfaceCount();i++)
                if(d.getInterface(i).getInterfaceClass()==1) return true;
        }
        return false;
    }

    boolean permitted() {
        UsbManager usb = (UsbManager)context.getSystemService(Context.USB_SERVICE);
        if(usb==null) return false;
        for(UsbDevice d:usb.getDeviceList().values()) {
            if(!usb.hasPermission(d))continue;
            for(int i=0;i<d.getInterfaceCount();i++)
                if(d.getInterface(i).getInterfaceClass()==1)return true;
        }
        return false;
    }

    void requestPermission() {
        if(!prefs.enabled) return;
        for(org.ostrichbat2k.usbdac.discovery.UsbAudioDevice device :
            manager.getDevices().getValue()) {
            if(!device.getHasPermission()) {
                manager.requestPermission(device.getDevice());
                return;
            }
        }
        manager.retryActivation();
    }

    AudioSink newSink(Context context) {
        return new RoutingAudioSink(manager,
            new DefaultAudioSink.Builder(context).build());
    }

    boolean directRoute() {
        return manager.getPlaybackRoute().getValue()
            instanceof UsbAudioManager.PlaybackRoute.Direct;
    }

    boolean directTransportActive() {
        UsbPipelineStats stats = manager.getPipelineStats().getValue();
        return directRoute() && stats != null && stats.getUrbsSubmitted() > 0 &&
            stats.getReapErrors()==0;
    }

    boolean androidFallback() {
        return manager.getPlaybackRoute().getValue()
            instanceof UsbAudioManager.PlaybackRoute.Fallback;
    }

    void releaseClaim() {
        manager.releaseClaim(0L, false, false);
    }

    void setVolumePercent(int percent) {
        requestedVolume = Math.max(0, Math.min(100,percent));
        UsbControlState state = manager.getControlState().getValue();
        if(state==null)return;
        Pair<Integer,Integer> range = state.getVolumeRange();
        if(range==null)return; // no hardware gain: NEVER do silent DSP scaling
        int minimum=range.getFirst(),maximum=range.getSecond();
        int target=minimum+(int)Math.round((maximum-minimum)*(requestedVolume/100.0));
        manager.setVolume(target);
    }

    String volumeMode() {
        UsbControlState state=manager.getControlState().getValue();
        return state!=null&&state.getVolumeRange()!=null?"hardware":"unity";
    }

    int sampleRate() {
        UsbControlState state=manager.getControlState().getValue();
        return state==null?0:state.getSampleRateHz();
    }

    JSONObject status() {
        JSONObject j=new JSONObject();
        try {
            boolean direct=directTransportActive();
            j.put("driver","libusbdac v0.2.0");
            j.put("connected",connected());
            j.put("permission",permitted());
            j.put("directUsbActive",direct);
            j.put("directUsbSelected",true);
            j.put("directUsbRoute",directRoute());
            j.put("androidFallback",androidFallback());
            j.put("sampleRateHz",sampleRate());
            j.put("usbVolumeMode",volumeMode());
            j.put("usbOutputVolumePercent",requestedVolume);
            UsbPipelineStats stats=manager.getPipelineStats().getValue();
            if(stats!=null) {
                j.put("urbsSubmitted",stats.getUrbsSubmitted());
                j.put("reapErrors",stats.getReapErrors());
                j.put("underrunCount",stats.getUnderrunCount());
                j.put("badPacketCount",stats.getBadPacketCount());
            }
        }catch(Exception ignored){}
        return j;
    }
}
