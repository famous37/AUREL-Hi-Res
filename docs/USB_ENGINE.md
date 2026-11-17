# AUREL 1.1.48 — independent Android and direct USB audio engines

## Audio routing

- **Bit-perfect OFF**: Qobuz stream -> Android `MediaPlayer` ->
  Android `AudioFlinger` (system mixer / volume / resampling as configured
  by the device) -> Android-selected speaker, Bluetooth, or USB DAC.
  AUREL does not claim USB interfaces or set preferred mixer attributes.
- **Bit-perfect ON** (compatible FLAC and authorized USB Audio Class device):
  Qobuz stream -> Media3 decoder -> `libusbdac` v0.2.0 `RoutingAudioSink`
  -> direct native USB isochronous PCM. No `AudioTrack` for the actual
  direct PCM samples. USB permission is required.
- **Unsupported mode / USB permission missing / direct engine failure**:
  explicitly identified Android fallback, never called bit-perfect. The
  previously used `decent-player` USB transport has been removed;
  its separately built native FLAC decoder is retained.

## Verification status

A passing CI build verifies build integration, static routing separation and
signed-release integrity. It cannot establish a working DAC output, supported
sample rate or bit-identical PCM on a specific Android model.

For hardware qualification, test iBasso DC05 on the target phone at:
1. OFF: 16-bit / 44.1 kHz and 24-bit / 96 kHz, confirm actual USB routing.
2. ON: permit USB access, test playback, pause, seek, track transitions,
   DAC sample-rate changes, disconnect/reconnect, background controls.
3. Check native diagnostics: `directUsbRoute`, `directUsbActive`,
   increasing `urbsSubmitted`, `reapErrors`, `underrunCount`,
   `badPacketCount`; ensure volume control uses the DAC Feature Unit.
4. Repeat for Qobuz lossless URLs issued after authentication. Never reuse
   temporary signed stream tickets on engine switches.

## License attribution

The **libusbdac** USB Audio Class engine is copyright its respective authors,
distributed under **GPL-3.0-or-later**, project source:
https://github.com/ostrichbat2k/libusbdac/tree/v0.2.0

This dependency imposes GNU GPL obligations on distribution of a combined
application. The AUREL source and complete reproducible build scripts for
this integration are maintained in the public AUREL GitHub repository,
including the exact library dependency pin. Preserve the original upstream
copyright notices and source/license availability in redistributed builds.
The app does not implement or redistribute proprietary UAPP/HiBy drivers.
