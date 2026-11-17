# AUREL USB Lab — private Superpowered experiment

This is a **separate, side-by-side installed Android application** (package
`com.aurel.usblab`). It does **not** modify AUREL Hi-Res, its installed signing
key, Qobuz credentials, playback history, or the stable Android AudioFlinger
output. Production `:app` builds and workflows remain untouched.

It uses the **real Superpowered AndroidUSB / AndroidUSBAudio C++ API** and
the official, privately checked-out Superpowered static archive, not
`libusbdac` or an Android bit-perfect mixer preference.

## Licensing and sunset

Superpowered's evaluation key supports *private/internal* tests only, not
public releases. Official information:
- https://superpowered.com/licensing
- https://docs.superpowered.com/getting-started/licensing/
- https://superpowered.com/superpowered-farewell

Superpowered announced that it **stops operations on July 31, 2027** and has
stopped issuing new commercial licenses. Treat this as a short-lived test
bench, not a production dependency. **Never commit vendor SDK libraries,
keys, or upload the evaluation APK to public Releases/Actions artifacts.**
The repo contains only our lab source; the SDK stays in an ignored local
directory.

## Build (own Windows/Linux/macOS computer)

Requirements: JDK 21, Android SDK platform API 37, Android NDK 29,
CMake 3.22.1, Gradle 9.5.0 and Android Gradle Plugin as configured at root,
and Git. Downloading/updating the SDK requires Internet access.

```bash
bash scripts/setup-superpowered-lab.sh
gradle :superpoweredUsbLab:assembleDebug -PaurelSuperpoweredLab
```

APK: `superpoweredUsbLab/build/outputs/apk/debug/superpoweredUsbLab-debug.apk`.
Install with `adb install -r` or Android's package installer. This is a debug
build, with a different application ID, for personal experiments only.

### Windows PowerShell

```powershell
.\\scripts\\setup-superpowered-lab.ps1
gradle :superpoweredUsbLab:assembleDebug -PaurelSuperpoweredLab
```

Install `superpoweredUsbLab\\build\\outputs\\apk\\debug\\superpoweredUsbLab-debug.apk`
privately on your Android device. The application ID differs from AUREL
Hi-Res, so both apps can stay installed. Keep the APK for your own evaluation.

Alternative: use an SDK you downloaded through Superpowered's own download
page and set `AUREL_SUPERPOWERED_DIR` to its `Superpowered` directory.
The build fails closed when SDK headers/arm64-v8a archive are missing.

## On-device experiment

1. Plug in a USB Audio Class DAC (e.g. iBasso DC05).
2. Open **AUREL USB Lab**; choose 44,100 Hz / 16-bit first.
3. Tap **Connect DAC** and grant Android's explicit USB permission.
4. Start the **quiet 440 Hz test tone** (about -36 dBFS), or choose a local
   **WAV / AIFF / MP3 / AAC** audio file from Android's document picker.
5. Test play/pause, stop, detach/reconnect, 48 kHz and 96 kHz, and observe
   native output callback frame counts.
6. Tapping **Stop & Release** or backgrounding the lab releases native audio.

**Warning:** Start with headphones unplugged or at safe analog volume;
USB DACs lacking hardware volume control may output at full scale.

The official Superpowered `AdvancedAudioPlayer` header **does not list
FLAC among supported file formats**. FLAC/Qobuz playback requires a separate
FLAC decoder feeding the USB callback. Do not label this experiment as
bit-perfect: Superpowered's USB callback transports 32-bit float samples,
and neither end-to-end sample identity nor the DAC's actual output is verified.

## Hardware-qualification checklist

- Native USB permission explicitly granted; no claim occurs on app startup
- Callback frame counter advances while playing; stops when stream stops
- Audio disappears on Pause and resumes on Play
- Matching 44.1/48/96 kHz output reported; no spurious routing to Android
- Detach, reconnect, background, foreground, orientation and device errors
- Compare audible behavior with standard AUREL's Android AudioFlinger route
- Capture Android `adb logcat -b crash` if the SDK causes a native crash

This experimental APK is **not** the next signed public AUREL release.
