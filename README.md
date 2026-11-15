# AUREL Hi-Res — 0.7.0 Alpha

**Developer: famous37**

An independent Android music player focused on legible, elegant lossless listening. The design follows familiar streaming-app navigation patterns and the supplied Qobuz 10.2.0.0 APK as a visual/interaction reference; **AUREL is neither Qobuz's app nor affiliated with Qobuz**. No Qobuz proprietary code, assets, or music have been copied into this project.

## 0.5 — Playback and artist focus

- Refined high-contrast now-playing screen, larger coherent typography, artwork-first layout, touch-friendly SVG transport buttons, and responsive margins for Android devices.
- **Tap the artist name in Now Playing** to open their discography. AUREL uses artist IDs from metadata, tries `track/get` and `album/get`, then an exact-name `artist/search` match, avoiding unrelated search results.
- Normalizes artist names across `artist`, `artists`, `performer`, `album.artist`, nested `display` fields and common variant payloads. Missing artist metadata is hydrated in the background during playback when `track/get` is available.
- Artist pages display releases from `artist/get?extra=albums`; `artist/getReleasesList` is used as a compatible fallback. More releases can be requested if the catalogue reports additional pages.
- Album-artist labels are also actionable, and the album name in Now Playing opens the album where an ID is provided.
- **Downloads are restricted to independently authorized purchased-file URLs.** The player never exports a streaming URL, decrypts protected segmented streams or treats a subscription as ownership. Album and discography batches, progress, cancellation and retries are supported where the account/API grants purchased-file downloads.
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


## v0.6.0 visual and audio integrity update

- Full-bleed cover-art player using the user-provided reference layout (original implementation).
- Large artist/title labels, high-contrast controls and wide previous/play/next buttons.
- Discrete bottom queue, shuffle, repeat and information controls.
- The Qobuz API-provided bit depth/rate is labelled as **reported metadata**.
- Android MediaPlayer track information is separately exposed, when the platform makes it available; mixer property is **not** a DAC measurement.
- Source formatting is never inferred solely from the selected streaming quality setting.
- No DSP/equalizer controls; separately authorized purchased downloads only.

Note: This alpha still needs on-device playback and interface verification; secure Qobuz streams require official authorization/integration.

## v0.7.0 — adaptive interface and purchased-file download queue

- Responsive layouts for compact smartphones, tall phones, landscape, tablets and foldable widths; motion-reduction support and fewer unnecessary mini-player DOM rebuilds.
- Persistent mini-player above mobile navigation with album art, track and artist, previous / pause-play / next, progress and swipe-up-to-expand.
- Five mobile destinations: Home, Search, Library, Downloads and Settings.
- Per-track downloads from lists and Now Playing, album batch downloads and artist discography download preparation (all, albums or singles).
- An Android background transfer worker queues tasks, exposes byte progress, cancellation, retry and history, and saves music via MediaStore to `Music/AUREL/Artist/Album` on Android 10+. Android 8–9 use the app-specific Music folder.
- **Important limitation:** Only an explicitly requested `intent=download` purchased-file URL may be stored. Streaming URLs are never saved, nor are DRM-protected streams decoded. Qobuz may reject this endpoint for many third-party app credentials or tracks, including ordinary subscriptions, and Android-device testing with licensed accounts is still required.
- Download quality is only a requested ceiling and may differ from the authorized file actually supplied. MediaStore entries include title/artist/album where possible; embedded FLAC tags and artwork are not yet written.
- Batch preparation supports up to 150 artist releases and 500 tracks per album, and queued items cap at 3000. Closing the activity interrupts queued/in-flight transfers; saved entries and retry actions persist.

### Implementation
- `app/src/main/assets/responsive.js` — mini-player, navigation, download action UI
- `app/src/main/assets/responsive.css` — breakpoint and accessibility refinements
- `AuthorizedDownloadManager.java` — purchased-file export, MediaStore saving, queue and progress
- `QobuzApi.purchasedFileInfo` — asks for a distinct download entitlement; never falls back to `intent=stream`

Mornye is used for feature and UX research only. No Mornye or Murglar source code, assets or brand UI were copied.
