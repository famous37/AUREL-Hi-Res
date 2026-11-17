#!/usr/bin/env python3
"""Pinned Decent UAC2 driver: safe hardware volume + explicit software fallback.

The genuine bit-perfect path remains unmodified whenever the DAC exposes
read/write UAC2 hardware volume. When hardware control is not available, the
USB stream uses clearly identified software attenuation to prevent full-scale
headphone output. Fail closed on mismatched source revisions.
"""
from pathlib import Path
import sys
root=Path(sys.argv[1])
def edit(relative,changes):
    p=root/relative
    source=p.read_text()
    for before,after in changes:
        c=source.count(before)
        if c!=1:
            raise RuntimeError(f"{relative}: expected one match, found {c}: {before[:75]!r}")
        source=source.replace(before,after,1)
    p.write_text(source)
    print("Volume support:",relative)

dev="libs/decent-usb-audio-driver/src/main/kotlin/com/decent/usbaudio/UsbAudioDevice.kt"
edit(dev,[
("""    private var cachedDeviceInfo: UsbAudioDeviceInfo? = null""",
"""    private var cachedDeviceInfo: UsbAudioDeviceInfo? = null
    // UAC2 Feature Unit: standard 1/256 dB volume, master channel zero.
    // Never guess vendor-private iBasso commands.
    private var hardwareVolumeUnitId = -1
    private var volumeMin = 0
    private var volumeMax = 0
    private var volumeStep = 0
    private var volumeControlInterface = 0
"""),
("""        cachedDeviceInfo = info
        return info""",
"""        cachedDeviceInfo = info
        discoverHardwareVolume(conn)
        return info"""),
("""    fun closeDevice() {
        cachedDeviceInfo = null""",
"""    fun closeDevice() {
        hardwareVolumeUnitId = -1
        cachedDeviceInfo = null"""),
("""    /**
     * Close the USB device and release all resources.
     */""",
"""    /**
     * Probe only a standard, writable UAC2 Feature Unit master-volume control.
     * 24/32-bit PCM is never touched when this feature is present.
     */
    private fun discoverHardwareVolume(conn: UsbDeviceConnection) {
        hardwareVolumeUnitId = -1
        volumeMin = 0; volumeMax = 0; volumeStep = 0
        val bytes = conn.rawDescriptors ?: return
        var inControl = false
        var controlId = 0
        var candidate = -1
        var i = 0
        while (i + 1 < bytes.size) {
            val size = bytes[i].toInt() and 0xFF
            if (size < 2 || i + size > bytes.size) break
            val descriptorType = bytes[i+1].toInt() and 0xFF
            if (descriptorType == 0x04 && size >= 9) {
                inControl = (bytes[i+5].toInt() and 0xFF) == 1 &&
                    (bytes[i+6].toInt() and 0xFF) == 1 &&
                    (bytes[i+7].toInt() and 0xFF) == 0x20
                if (inControl) controlId=bytes[i+2].toInt() and 0xFF
            } else if (inControl && descriptorType == 0x24 && size >= 10 &&
                       (bytes[i+2].toInt() and 0xFF) == 0x06) {
                val controls=(bytes[i+5].toInt() and 0xFF) or
                    ((bytes[i+6].toInt() and 0xFF) shl 8) or
                    ((bytes[i+7].toInt() and 0xFF) shl 16) or
                    ((bytes[i+8].toInt() and 0xFF) shl 24)
                if (((controls ushr 2) and 3) == 3) {
                    candidate=bytes[i+3].toInt() and 0xFF
                    break
                }
            }
            i+=size
        }
        if (candidate<=0) return
        val index=(candidate shl 8) or controlId
        // UAC2 GET_RANGE returns wNumSubRanges + signed 16-bit min/max/res.
        val range=ByteArray(8)
        val result=conn.controlTransfer(0xA1,0x02,0x0200,index,range,8,300)
        if(result!=8) return
        val count=(range[0].toInt() and 255) or
            ((range[1].toInt() and 255) shl 8)
        if(count<1) return
        fun signed16(at:Int):Int =
            (((range[at].toInt() and 255) or
            ((range[at+1].toInt() and 255) shl 8)).toShort()).toInt()
        val min=signed16(2)
        val max=signed16(4)
        val step=signed16(6)
        if(min>=max || step<=0 || max>0 || min < -32768) return
        val verify=ByteArray(2)
        if(conn.controlTransfer(0xA1,0x01,0x0200,index,verify,2,300)!=2)
            return
        hardwareVolumeUnitId=candidate
        volumeControlInterface=controlId
        volumeMin=min;volumeMax=max;volumeStep=step
        Log.i(TAG,"Writable UAC2 hardware volume detected")
    }

    /** Returns false on any unsupported control, NAK or readback mismatch. */
    @Synchronized
    fun setHardwareVolumePercent(percent:Int):Boolean {
        val conn=connection ?: return false
        val unit=hardwareVolumeUnitId
        if(unit<=0 || volumeStep<=0) return false
        val index=(unit shl 8) or volumeControlInterface
        val steps=(volumeMax-volumeMin)/volumeStep
        if(steps<=0) return false
        val pos=((percent.coerceIn(0,100)/100f)*steps).toInt()
        val value=(volumeMin+pos*volumeStep).coerceIn(volumeMin,volumeMax)
        val bytes=byteArrayOf((value and 255).toByte(),
                              ((value ushr 8) and 255).toByte())
        if(conn.controlTransfer(0x21,0x01,0x0200,index,bytes,2,300)!=2)
            return false
        val read=ByteArray(2)
        if(conn.controlTransfer(0xA1,0x01,0x0200,index,read,2,300)!=2)
            return false
        val actual=(((read[0].toInt() and 255) or
                    ((read[1].toInt() and 255) shl 8)).toShort()).toInt()
        return kotlin.math.abs(actual-value)<=volumeStep
    }

    /** Close the USB device and release all resources. */""")
])
stream="libs/decent-usb-audio-driver/src/main/kotlin/com/decent/usbaudio/UsbAudioStream.kt"
edit(stream,[
("""    fun start(): Boolean {""",
"""    fun setDigitalGain(volume:Float) {
        if(nativeHandle!=0L) nativeSetDigitalGain(nativeHandle,volume.coerceIn(0f,1f))
    }

    fun start(): Boolean {"""),
("""    private external fun nativeUsbAudioStart(handle: Long): Boolean""",
"""    private external fun nativeSetDigitalGain(handle:Long,gain:Float)
    private external fun nativeUsbAudioStart(handle: Long): Boolean""")
])
header="libs/decent-usb-audio-driver/src/main/jni/usb-audio-output.h"
edit(header,[
("""    std::atomic<bool> running;""",
"""    std::atomic<bool> running;
    /** Unity = bit-exact PCM; <1 is explicitly non-bit-perfect attenuation. */
    std::atomic<float> digitalGain;
    float appliedGain;""")
])
native="libs/decent-usb-audio-driver/src/main/jni/usb-audio-output.cpp"
edit(native,[
("""#include <cmath>""","""#include <cmath>\n#include <algorithm>"""),
("""    ctx->running.store(false);
    ctx->transferBuffer = nullptr;""",
"""    ctx->running.store(false);
    ctx->digitalGain.store(1.0f);
    ctx->appliedGain=1.0f;
    ctx->transferBuffer = nullptr;"""),
("""JNIEXPORT void JNICALL
Java_com_decent_usbaudio_UsbAudioStream_nativeUsbAudioWriteRaw(""",
"""JNIEXPORT void JNICALL
Java_com_decent_usbaudio_UsbAudioStream_nativeSetDigitalGain(
        JNIEnv *, jobject, jlong h, jfloat gain) {
    auto *ctx=reinterpret_cast<UsbAudioContext *>(h);
    if(ctx)ctx->digitalGain.store(std::max(0.0f,std::min(1.0f,gain)));
}

/**
 * Smooth software attenuation for DACs lacking standard hardware control.
 * Unity path skips all processing, preserving source integer PCM exactly.
 * A ~20ms gain ramp avoids abrupt discontinuities when using volume keys.
 */
static void applyUsbDigitalGain(UsbAudioContext *ctx,uint8_t *bytes,int samples) {
    float target=ctx->digitalGain.load();
    if(target>=0.99999f && ctx->appliedGain>=0.99999f)return;
    int width=ctx->bytesPerSample;
    if(width!=2 && width!=3 && width!=4)return;
    double factor=1.0/(ctx->sampleRate*0.020);
    if(factor<0.00001)factor=0.00001;
    if(factor>1.0)factor=1.0;
    for(int i=0;i<samples;i++) {
        uint8_t *p=bytes+i*width;
        int64_t value=0;
        if(width==2) {
            value=(int16_t)((uint16_t)p[0]|((uint16_t)p[1]<<8));
        } else if(width==3) {
            int32_t v=(int32_t)p[0]|((int32_t)p[1]<<8)|((int32_t)p[2]<<16);
            value=(v & 0x800000)?(v | ~0xFFFFFF):v;
        } else {
            uint32_t v=(uint32_t)p[0]|((uint32_t)p[1]<<8)|
                ((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);
            value=(int32_t)v;
        }
        ctx->appliedGain+=(float)((target-ctx->appliedGain)*factor);
        int64_t scaled=llround((double)value*ctx->appliedGain);
        const int bits=ctx->bitDepth;
        const int64_t top=((int64_t)1<<(bits-1))-1;
        const int64_t bottom=-((int64_t)1<<(bits-1));
        scaled=std::max(bottom,std::min(top,scaled));
        for(int b=0;b<width;b++)p[b]=(uint8_t)((uint64_t)scaled>>(8*b));
    }
}

JNIEXPORT void JNICALL
Java_com_decent_usbaudio_UsbAudioStream_nativeUsbAudioWriteRaw("""
),
("""    // Submit to USB pipeline
    submitPcmToUrbs(ctx, ctx->transferBuffer, outputBytes);""",
"""    // Hardware DAC volume is bit-exact; software fallback is labelled
    // explicitly in the AUREL UI and never reported as bit-perfect.
    applyUsbDigitalGain(ctx,ctx->transferBuffer,totalSamples);

    // Submit to USB pipeline
    submitPcmToUrbs(ctx, ctx->transferBuffer, outputBytes);""")
])
sink="libs/decent-usb-audio-wrapper-media3/src/main/kotlin/com/decent/usbaudio/media3/UsbAudioSink.kt"
edit(sink,[
("""    private var pendingVolume: Float = 1f""",
"""    private var pendingVolume: Float = 1f
    // Independent USB volume; never routes through Android's muted delegate.
    // Conservative first-use output avoids sudden full-scale headphone audio.
    @Volatile private var usbUserLevel:Float = 0.35f
    @Volatile private var hardwareVolumeActive=false
    @Volatile private var softwareGainActive=true

    /** Hardware DAC gain preserves bit-perfect PCM. Software gain does not. */
    fun usbVolumeMode():String = when {
        usbAudioStream?.isAlive!=true -> "inactive"
        hardwareVolumeActive -> "hardware"
        softwareGainActive -> "digital"
        else -> "unity"
    }

    fun setUsbOutputLevel(level:Float) {
        val gain=level.coerceIn(0f,1f)
        usbUserLevel=gain
        val stream=usbAudioStream
        if(stream?.isAlive==true) {
            val hardware=gain>0f &&
                usbAudioDevice.setHardwareVolumePercent((gain*100).toInt())
            hardwareVolumeActive=hardware
            softwareGainActive=!hardware && gain<0.99999f
            stream.setDigitalGain(if(hardware)1f else gain)
        }
    }
"""),
("""        // Step 6: wait ~47ms — DAC PLL lock time
        Thread.sleep(50)

        if (!stream.start()) {""",
"""        // Set a non-dangerous output level BEFORE any USB PCM is submitted.
        // Prefer device hardware control; fall back to labelled digital gain.
        hardwareVolumeActive=usbUserLevel>0f &&
            usbAudioDevice.setHardwareVolumePercent((usbUserLevel*100).toInt())
        softwareGainActive=!hardwareVolumeActive && usbUserLevel<0.99999f
        stream.setDigitalGain(if(hardwareVolumeActive)1f else usbUserLevel)

        // Step 6: wait ~47ms — DAC PLL lock time
        Thread.sleep(50)

        if (!stream.start()) {""")
])
print("UAC2 Feature Unit hardware volume + safe digital fallback patched")
