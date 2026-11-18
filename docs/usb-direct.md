# AUREL Direct USB Audio (experimental)

This preview branch adds a **real USB Audio Class 2.0 userspace transport**, not merely an Android `AudioManager` mixer toggle. The MIT-licensed [Decent USB Audio](https://github.com/Ma145/decent-player) driver is pinned to `d039f9d6b1ec30901a5cd6edf72c29cde362a549`. The upstream libFLAC source is pinned to `1507800de4b70e21be71f38caa0d9079d0bc6e45` (1.5.0).

## Build

1. Install JDK 21, Android SDK 36, NDK 29.0.14206865, CMake 3.22.1 and Gradle 9.3.1.
2. Run `bash scripts/setup-usb-driver.sh`.
3. Build `gradle :app:assembleDebug -PaurelPreview`.

Upstream `libs/` are MIT; bundled FLAC remains under its own BSD-style license. The upstream `driver/Felicity` example is AGPL and **not copied or linked**.

## Playback

- Android 10+ with a compatible USB Audio Class 2.0 DAC and user-granted USB host permission: signed HTTPS lossless track → Media3/FFmpeg (or libFLAC) → `UsbAudioSink` → native isochronous USB transfers; ordinary Android mixer is bypassed when the native stream actually opens.
- Android mixer mode remains the existing fallback when a direct stream cannot be used.
- Standard MediaPlayer playback is preserved for non-USB, MP3 and unsupported/policy-restricted paths.
- Changing mode releases the old decoder and obtains a **fresh signed stream URL**, preserving the track and playback offset.
- Digital headroom is disabled in USB mode. A direct USB stream must not be scaled or passed through Android EQ.
- Stream authorisation, the separate Qobuz library and Mornye's account logic have not been replaced.

## Status and testing

`direct_usb_preparing` and `direct_usb_playback` **do not mean measured end-to-end bit identity**. The driver may fall back internally if USB permission, UAC descriptors, or native clock negotiation fail. Inspect Logcat tags `UsbAudioSink`, `UsbAudioDevice` and `UsbAudioStream`, and verify the DAC's sample-rate indication.

Run real-device tests at 16-bit/44.1 kHz, 24-bit/96 kHz and 24-bit/192 kHz, including seek, pause/resume, cable removal, audio focus loss and an incompatible USB DAC. Compare samples by USB capture or a suitable loopback where possible. Do not publish as a verified bit-perfect release before USB/DAC tests pass.

## Limitations

- Upstream native UAC2 implementation is an early release; broad DAC compatibility has not been established.
- Third-party driver build requires newer toolchain than the stable AUREL 1.1.43 source.
- The Android Media3 input format is *not* an independent decoder-output or DAC measurement.
- `sourceVerified` and FLAC STREAMINFO refer to the source file, not confirmed end-to-end DAC PCM.
- DSD/DoP has not been enabled.
- Current branch is a development preview; do not merge to `main` before CI and hardware verification.
