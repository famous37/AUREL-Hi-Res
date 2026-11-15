# AUREL Hi-Res — 0.4.0 Alpha

**Developer: famous37**

Independent Android player inspired by the usability of contemporary lossless services. It is not made by or affiliated with Qobuz and does not contain Qobuz proprietary code, branding or bundled music.

## Audiophile edition (0.4)

- Larger consistent, high-contrast typography; artwork-first dark burgundy listening view and Qobuz-like navigation hierarchy.
- High-contrast custom AUREL launcher icon in all standard Android density buckets.
- **No equalizer or software DSP**; AUREL does not claim bit-perfect output. Android MediaPlayer and the device mixer can resample audio.
- Source-quality chip shows verified bit depth and sample rate **only when an authorized direct stream or FLAC header provides this information**. Unknown source quality stays explicitly unverified. Source sample rate is normalized to Hz then displayed in kHz. Audio panel distinguishes source from Android mixer.
- Download commands for purchased tracks, albums, and artist discography. The download endpoint uses `intent=download` and **must return a Qobuz-authorized direct file URL** for every track; streaming-only URLs are never saved. Artist batch supports up to 400 tracks in this alpha build; individual unavailable or non-purchased tracks are skipped. Downloads live in app-specific private storage and disappear on uninstall.
- Locally saved purchased files can be played in the Downloads screen. Actual FLAC source sample rate and bit depth are parsed from the file header when valid.
- Two optional Qobuz credentials roles: one for streaming rights and one for displaying a separate library. Tokens stored in Android Keystore-backed encrypted storage; passwords never stored.

## Limitations and safety

Qobuz access requires valid credentials and server-authorized API access. The legacy account-password endpoint may not work if Qobuz requires CAPTCHA/OAuth. The direct URL audio engine does not decode licensed encrypted segmented streams and does not circumvent DRM. **A Studio subscription does not entitle an application to export all streaming tracks as DRM-free files**. Subscription offline listening is available through Qobuz's official app; AUREL only attempts server-authorized purchased-file downloads. No credentials are committed to Git.

Download outcomes and streaming features need on-device verification using an account with rights. This repository does not include or imply an official API authorization.

## Build

Open in Android Studio or use `gradle :app:assembleDebug` with JDK 17 and Android SDK 35 installed. GitHub Actions builds debug APK automatically on commits to `main`.

## Key files

- `app/src/main/assets/app.js` — Android bridge, account, catalogue and collection UI
- `app/src/main/assets/modern.js` — contemporary library, Qobuz-inspired now-playing UI, quality panel, downloads UI
- `app/src/main/assets/style.css` — adaptive, high-contrast UI
- `app/src/main/java/com/aurel/hires/MainActivity.java` — native MediaPlayer, downloads, local FLAC header verification
- `app/src/main/java/com/aurel/hires/QobuzApi.java` — API requests and purchase download authorization
- `app/src/main/res/mipmap-*/ic_launcher.png` — AUREL original high-contrast mark

### Rights and provider sources

- Qobuz terms: https://www.qobuz.com/us-en/legal/terms
- Qobuz API conditions: https://static.qobuz.com/apps/api/QobuzAPI-TermsofUse.pdf
- Qobuz purchased downloads help: https://help.qobuz.com/en/articles/10168-how-to-download-albums-tracks-collections-or-complete-works
