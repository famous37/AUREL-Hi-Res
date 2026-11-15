# AUREL Hi-Res — 0.5.0 Alpha

**Developer: famous37**

An independent Android music player focused on legible, elegant lossless listening. The design follows familiar streaming-app navigation patterns and the supplied Qobuz 10.2.0.0 APK as a visual/interaction reference; **AUREL is neither Qobuz's app nor affiliated with Qobuz**. No Qobuz proprietary code, assets, or music have been copied into this project.

## 0.5 — Playback and artist focus

- Refined high-contrast now-playing screen, larger coherent typography, artwork-first layout, touch-friendly SVG transport buttons, and responsive margins for Android devices.
- **Tap the artist name in Now Playing** to open their discography. AUREL uses artist IDs from metadata, tries `track/get` and `album/get`, then an exact-name `artist/search` match, avoiding unrelated search results.
- Normalizes artist names across `artist`, `artists`, `performer`, `album.artist`, nested `display` fields and common variant payloads. Missing artist metadata is hydrated in the background during playback when `track/get` is available.
- Artist pages display releases from `artist/get?extra=albums`; `artist/getReleasesList` is used as a compatible fallback. More releases can be requested if the catalogue reports additional pages.
- Album-artist labels are also actionable, and the album name in Now Playing opens the album where an ID is provided.
- **All audio download/export features removed**, including native download handlers, purchase download requests, download queue, downloaded-files UI and associated code. Offline content is not exported by AUREL.
- **No EQ, no DSP.** Source quality is displayed only when verified metadata is supplied by Qobuz. Android's audio mixer may resample and bit-perfect output is not claimed.
- Independent optional credentials for streaming and the collection library remain supported; credentials are stored securely by Android and passwords are not retained.

## Limitations

Playback needs API-authorized Qobuz access and compatible direct HTTPS stream URLs. Protected segmented audio is not decoded, decrypted, or bypassed in this client. Password login may fail if Qobuz requires OAuth or verification. On-device validation with authorized Qobuz accounts is still needed for exact endpoint compatibility and streaming.

## Build

Use Android Studio with JDK 17 and Android SDK 35; build with `gradle :app:assembleDebug`. GitHub Actions builds a debug APK after commits to `main`. A reproducible `node test_ui.cjs` suite checks artist rendering, player controls, discography and removal of download actions.

## Project files

- `app/src/main/assets/app.js` — account, catalogue, artist identity and navigation
- `app/src/main/assets/modern.js` — now-playing UI, library and modern controls
- `app/src/main/assets/style.css` — visual system and Android layout
- `app/src/main/java/com/aurel/hires/MainActivity.java` — native streaming playback, metadata enrichment and bridge
- `app/src/main/java/com/aurel/hires/QobuzApi.java` — authenticated Qobuz API client

## Related APIs

- https://www.qobuz.com/us-en/legal/terms
- https://static.qobuz.com/apps/api/QobuzAPI-TermsofUse.pdf
