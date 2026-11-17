#!/usr/bin/env python3
"""Fail-closed PCM/UAC2 compatibility fixes for the pinned Decent driver.

Applied to fetched upstream sources at build time. Do not silently patch a
different upstream revision; every replacement checks its anchor.
"""
from pathlib import Path
import sys

root = Path(sys.argv[1])

def fix(relative, changes):
    path = root / relative
    original = path.read_text()
    data = original
    for change in changes:
        before, after = change[:2]
        expected = change[2] if len(change) == 3 else 1
        if data.count(before) != expected:
            raise RuntimeError(f"{relative}: unexpected upstream match count {data.count(before)} (expected {expected}) for {before[:100]!r}")
        data = data.replace(before, after, expected)
    path.write_text(data)
    print(f"Hardened: {relative}")

device = "libs/decent-usb-audio-driver/src/main/kotlin/com/decent/usbaudio/UsbAudioDevice.kt"
fix(device, [
    (
        """        var bestAlt = 1
        var bestBits = 16""",
        """        var bestAlt = -1
        var bestBits = 0"""
    ),
    (
        """                    if (currentAlt > 0) {
                        altSettings.add(Pair(currentAlt, bBitResolution))
                    }
                    if (bBitResolution > bestBits && currentAlt > 0) {
                        bestBits = bBitResolution
                        bestAlt = currentAlt
                    }""",
        """                    // USB bSubslotSize is the PHYSICAL sample width on the
                    // wire; bBitResolution is merely the number of valid bits.
                    // 24 valid bits in 4-byte subslots require 32-bit transport.
                    val wireBits = bSubslotSize * 8
                    if (currentAlt > 0 && bSubslotSize in 2..4 &&
                        bBitResolution in 16..32 && bBitResolution <= wireBits) {
                        altSettings.add(Pair(currentAlt, wireBits))
                        if (wireBits > bestBits) {
                            bestBits = wireBits
                            bestAlt = currentAlt
                        }
                    }"""
    ),
    (
        """        val (bestAlt, bestBits) = parseBestAltSetting(conn)
        Log.i(TAG, "Auto-detected: clockSourceId=""",
        """        val (bestAlt, bestBits) = parseBestAltSetting(conn)
        Log.i(TAG, "Auto-detected: clockSourceId="""
    ),
    (
        """        val info = UsbAudioDeviceInfo(
                connection = conn,""",
        """        // Earlier versions mixed the endpoint of the FIRST alternate
        // setting with the bit depth of the BEST alternate setting. On many
        // DACs this sends PCM to a mismatched isochronous endpoint.
        val selectedAlt = (0 until device.interfaceCount)
            .map { device.getInterface(it) }
            .firstOrNull { it.interfaceClass == UsbConstants.USB_CLASS_AUDIO &&
                it.interfaceSubclass == 2 && it.id == interfaceId &&
                it.alternateSetting == bestAlt }
        val selectedOut = selectedAlt?.let { iface ->
            (0 until iface.endpointCount).map { iface.getEndpoint(it) }
                .firstOrNull { it.type == UsbConstants.USB_ENDPOINT_XFER_ISOC &&
                    it.direction == UsbConstants.USB_DIR_OUT }
        }
        val selectedFeedback = selectedAlt?.let { iface ->
            (0 until iface.endpointCount).map { iface.getEndpoint(it) }
                .firstOrNull { it.type == UsbConstants.USB_ENDPOINT_XFER_ISOC &&
                    it.direction == UsbConstants.USB_DIR_IN }
        }
        val asynchronous = selectedOut != null &&
            (selectedOut.attributes and 0x0C) == 0x04
        if (selectedOut == null || bestBits !in listOf(16, 24, 32) ||
            (asynchronous && selectedFeedback == null)) {
            Log.e(TAG, "Unsupported USB alternate setting / missing async feedback")
            closeDevice()
            return null
        }

        val info = UsbAudioDeviceInfo(
                connection = conn,"""
    ),
    (
        """                endpointOutAddress = endpointOut,
                endpointFeedbackAddress = endpointFeedback,
                maxPacketSize = maxPacketSize,""",
        """                endpointOutAddress = selectedOut.address,
                endpointFeedbackAddress = selectedFeedback?.address ?: -1,
                maxPacketSize = selectedOut.maxPacketSize,"""
    ),
    (
        """    fun setSampleRate(sampleRateHz: Int): Boolean {""",
        """    // The low byte of wIndex is the ACTUAL AudioControl interface ID,
    // not universally interface zero.
    private fun audioControlInterfaceId(): Int {
        val device = currentDevice ?: return 0
        for (i in 0 until device.interfaceCount) {
            val iface = device.getInterface(i)
            if (iface.interfaceClass == UsbConstants.USB_CLASS_AUDIO &&
                iface.interfaceSubclass == 1) return iface.id
        }
        return 0
    }

    fun setSampleRate(sampleRateHz: Int): Boolean {"""
    ),
    (
        """val wIndex = (csId shl 8) or 0  // entityId << 8 | audioControlInterface(0)""",
        """val wIndex = (csId shl 8) or audioControlInterfaceId()"""
    ),
    (
        """val wIndex = (csId shl 8) or 0
            val ret = conn.controlTransfer(""",
        """val wIndex = (csId shl 8) or audioControlInterfaceId()
            val ret = conn.controlTransfer(""",
        2
    ),
    (
        """if (ret >= 0) {
                Log.i(TAG, "setSampleRate""",
        """if (ret == 4) {
                Log.i(TAG, "setSampleRate"""
    )
])

sink = "libs/decent-usb-audio-wrapper-media3/src/main/kotlin/com/decent/usbaudio/media3/UsbAudioSink.kt"
fix(sink, [
    (
        """    private val QUEUE_BACKPRESSURE_THRESHOLD = 16""",
        """    // More decoded PCM must be queued for high-rate Qobuz streaming.
    // 16 buffers at 192 kHz can exhaust in a few milliseconds.
    private val queueBackpressureThreshold: Int
        get() = when {
            currentSampleRate >= 176400 -> 64
            currentSampleRate >= 88200 -> 48
            else -> 24
        }"""
    ),
    (
        """if (thread.queueSize() >= QUEUE_BACKPRESSURE_THRESHOLD) {""",
        """if (thread.queueSize() >= queueBackpressureThreshold) {"""
    ),
    (
        """        if (config.bitPerfectEnabled && sr != null && ch != null) {""",
        """        // Float PCM cannot be bit-identical to integer FLAC samples.
        // Unsupported PCM must use Android's decoder/output fallback.
        val integerPcm = enc == C.ENCODING_PCM_16BIT ||
            enc == C.ENCODING_PCM_24BIT || enc == C.ENCODING_PCM_32BIT
        if (config.bitPerfectEnabled && integerPcm && sr != null &&
            ch != null && ch in 1..2 && sr in 8000..384000) {"""
    ),
    (
        """        usbAudioDevice.setSampleRate(sampleRate)

        // Step 3: GET_CUR(CLOCK_VALID_CONTROL) — verify clock is locked""",
        """        val rateSet = usbAudioDevice.setSampleRate(sampleRate)
        val rateReadback = usbAudioDevice.readSampleRate()
        // Never stream with an unverified or wrong DAC clock. The original
        // code ignored SET_CUR failures and played distorted audio anyway.
        if (!rateSet || rateReadback != sampleRate) {
            Log.e(TAG, "USB clock negotiation failed: requested=$sampleRate read=$rateReadback set=$rateSet")
            stream.release()
            usbAudioDevice.closeDevice()
            return
        }

        // Step 3: GET_CUR(CLOCK_VALID_CONTROL) — verify clock is locked"""
    ),
    (
        """        val altResult = usbAudioDevice.setAltSetting(altSetting)
        Log.i(TAG, "Step 5: setAlt($altSetting): $altResult — new ISO ring allocated")

        // Step 6: wait ~47ms""",
        """        val altResult = usbAudioDevice.setAltSetting(altSetting)
        Log.i(TAG, "Step 5: setAlt($altSetting): $altResult — new ISO ring allocated")
        if (!altResult) {
            Log.e(TAG, "USB alternate-setting activation failed; refusing distorted output")
            stream.release()
            usbAudioDevice.closeDevice()
            return
        }

        // Step 6: wait ~47ms"""
    ),
    (
        """        // Keep device connection open between tracks (standard practice)
        clearForcedRouting()""",
        """        // Reclaim the interface cleanly at the next track/rate. Cached
        // endpoints across DAC clock changes can become invalid.
        usbAudioDevice.closeDevice()
        clearForcedRouting()"""
    )
])

driver = "libs/decent-usb-audio-driver/src/main/kotlin/com/decent/usbaudio/UsbAudioStream.kt"
fix(driver, [
    ("    fun start(): Boolean {", "    @Synchronized\n    fun start(): Boolean {"),
    ("    fun write(pcmBuffer: FloatArray) {", "    @Synchronized\n    fun write(pcmBuffer: FloatArray) {"),
    ("    fun writeRaw(pcmBuffer: ByteArray, encoding: Int) {", "    @Synchronized\n    fun writeRaw(pcmBuffer: ByteArray, encoding: Int) {"),
    ("    fun stop() {", "    @Synchronized\n    fun stop() {"),
    ("    fun flush() {", "    @Synchronized\n    fun flush() {"),
    ("    fun drainUrbs(): Int {", "    @Synchronized\n    fun drainUrbs(): Int {"),
    ("    fun release() {", "    @Synchronized\n    fun release() {")
])

cpp = "libs/decent-usb-audio-driver/src/main/jni/usb-audio-output.cpp"
fix(cpp, [
    (
        """    // Use calibrated fpmf from DAC's async feedback endpoint (read at start).
    // This matches the DAC's actual hardware clock instead of the nominal rate.
    double fpmf = ctx->calibratedFpmf;

    while (offset < dataLen && ctx->running.load()) {
        int pktSizes[USB_AUDIO_PACKETS_PER_URB];""",
        """    // Feedback rate can change while streaming. Sample it for each URB.
    while (offset < dataLen && ctx->running.load()) {
        double fpmf = ctx->calibratedFpmf;
        const double accumulatorBeforeUrb = ctx->frameAccumulator;
        int pktSizes[USB_AUDIO_PACKETS_PER_URB];"""
    ),
    (
        """        if (numPackets < USB_AUDIO_PACKETS_PER_URB) {
            int leftover = dataLen - offset;""",
        """        if (numPackets < USB_AUDIO_PACKETS_PER_URB) {
            // No URB was submitted. Revert the fractional USB packet clock
            // advancement, or every small decoded chunk loses frames.
            ctx->frameAccumulator = accumulatorBeforeUrb;
            int leftover = dataLen - offset;"""
    ),
    (
        """    } else if (inputBitDepth == 16 && ctx->bitDepth == 32) {
        padInt16ToInt32""",
        """    } else if (inputBitDepth == 16 && ctx->bitDepth == 24) {
        // Lossless 16-bit stereo/mono PCM in packed 3-byte UAC2 slots.
        const uint8_t *bytes = reinterpret_cast<const uint8_t *>(rawData);
        for (int i = 0; i < totalSamples; ++i) {
            ctx->transferBuffer[i * 3] = 0;
            ctx->transferBuffer[i * 3 + 1] = bytes[i * 2];
            ctx->transferBuffer[i * 3 + 2] = bytes[i * 2 + 1];
        }
    } else if (inputBitDepth == 16 && ctx->bitDepth == 32) {
        padInt16ToInt32"""
    ),
    (
        """        if (numPackets <= 0 || urbBytes <= 0) break;""",
        """        if (numPackets <= 0 || urbBytes <= 0) {
            ctx->frameAccumulator = accumulatorBeforeUrb;
            break;
        }"""
    )
])

print("Hardened PCM transport, USB format matching and clock validation")
