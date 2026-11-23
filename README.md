# AUREL Hi-Res

**AUREL Hi-Res** is an independent Android music player focused on lossless streaming, responsive browsing and a consistent, album-aware listening interface.

[![Latest stable release](https://img.shields.io/github/v/release/famous37/AUREL-Hi-Res?label=Stable&style=flat-square&color=222222)](https://github.com/famous37/AUREL-Hi-Res/releases/latest)
![Android](https://img.shields.io/badge/Android-10%2B-222222?style=flat-square)
![Developer](https://img.shields.io/badge/Developer-famous37-222222?style=flat-square)

**Developer:** famous37  
**Minimum Android:** 10 (API 29)  
**Application ID:** `com.aurel.hires`

### [Download the latest permanently signed APK](https://github.com/famous37/AUREL-Hi-Res/releases/latest)

> **Independent client.** AUREL is not affiliated with or endorsed by Qobuz. Catalogue, personal library and streaming access depend on the user's own valid subscription, session, permitted integration and the provider's current authorization policies. Server-side restrictions cannot be resolved by changing the app alone.

## What's new in v1.2.3

The player and library share a 24 × 24 icon set. Playback progress moves between Android updates, and large queues travel to the interface only when needed. Library playback follows the displayed sort order, and search results follow the latest query. [Full release notes in Ukrainian and English](docs/releases/v1.2.3.md)

## Library Import / Export Manager

The Android app includes a private, metadata-only **Library Import / Export Manager** under **Library** and **Settings**. Connect a *separate* authorized Qobuz account under **Settings → Personal Qobuz library**, then choose Artists, Albums, Tracks and Playlists to copy into AUREL's local library.

- Favorites and playlists are fetched page-by-page from the source account. The app preserves playlist track order and retains deliberate duplicate plays within a playlist.
- **Export JSON** saves a local copy using Android's document picker; **Import JSON** merges without losing existing saved entries. **Replace** and **Clear** require an additional confirmation.
- Android's transactional **AtomicFile** storage validates a versioned, allowlisted JSON schema and keeps the previous local library when downloading, importing or validating fails.
- The local browser shows saved artists, albums, tracks and playlists. Remote browsing and playback still require a permitted online streaming source; the metadata library is not an offline music download.
- **No session tokens, passwords, App Secrets or signed audio URLs** are included in the export, and transferring never changes Qobuz-managed favorites or playlists.
- Maximum transfer size 12 MB; collections and playlists have conservative safety caps. If an account exceeds a cap, AUREL reports it without overwriting previously saved data.

## What's new in v1.1.88

- Imported screenshot library entries can **open online** using the user's already authorized Qobuz catalogue search. Tap an artist, album, track or playlist in **Library → Library Import / Export → Browse local library**.
- A single exact, unambiguous Qobuz search match opens automatically. If the same name has multiple catalogue results, pick the correct one in the new in-app selector. Never guess provider IDs.
- Confirmed real Qobuz IDs persist in the private, versioned **AtomicFile** library JSON and survive export/import, app updates and device restarts. Existing offline IDs and their original names stay intact.
- Wrong matches can be changed or forgotten; available artist, album and playlist metadata can open through either the streaming or separately authorized personal-library session.
- Missing provider entitlements or incomplete search results are reported rather than silently bypassed. This feature does not write to the user's Qobuz favourites or playlists.



- Import screenshot-derived JSON files containing **offline local IDs** (`local_<32 hex digits>`) into the existing AUREL Library Import / Export Manager.
- Import preserves all names even without provider-supplied Qobuz identifiers. Offline records are clearly marked as *not linked to Qobuz* and **cannot** be opened/played as if they had authentic provider IDs.
- No server-side favorites are modified. The original signed app, playback engine, account settings, transactional import, backups and in-app updates are retained.

Screenshot-derived libraries are **personal files**, not bundled in public GitHub releases. In AUREL v1.1.88, use *Library → Library Import / Export → Import JSON · merge* to import a correctly formatted name-only JSON file.



- **More reliable artist discographies:** EPs and singles load independently from other artist sections. When a categorized Qobuz endpoint is unavailable, AUREL can inspect additional provider-supplied catalogue pages and offers a section-specific retry; it does not invent missing releases.
- **Less disruptive browsing:** similar-artist portraits fill in without reconstructing the entire page or resetting horizontal shelves.
- **Improved Home layout:** local Recently played items have room above the persistent mini-player and Android navigation bar.
- **Clear discovery states:** when Fresh releases require additional Qobuz authorization, the app offers Search and Library as alternatives rather than claiming that the catalogue is empty.
- **Signed in-app update checks:** once daily and when the app returns to the foreground. An update is **not** downloaded or installed without the user's choice.
- Includes the previous **Stage 1** cache, artwork and smooth-animation refinements, and **Stage 2** lyrics, history, local backup and palette features.

See the [v1.1.88 release and checksum](https://github.com/famous37/AUREL-Hi-Res/releases/tag/v1.1.88).

## Features

### Music and catalogue

- Explore tracks, albums, artists, artist discographies, related performers and playlists, subject to the connected provider's permissions.
- Optional separate Qobuz personal-library connection for account-managed favourites, saved music and playlists.
- Fast album-art loading, bounded metadata caches, coalesced duplicate catalogue requests and safe handling of stale or unauthorized responses.
- Private **Recently played** history (up to 80 tracks, recorded after playback begins), with replay and clear controls.
- User-requested **LRCLIB** synchronized lyrics: timed-line highlighting, tap to seek, plain-text fallback and an instrumental/unavailable state. Availability depends on LRCLIB.

### Player and interface

- Full Now Playing screen, mini-player, queue, seek, shuffle, repeat and Android notification/lock-screen transport controls.
- Unified dark, high-contrast interface with responsive portrait/landscape layout; optional artwork-derived palette and visual effects.
- State restoration for playback position, navigation and screen history.
- Audio-focus and output-disconnection handling.
- Source-format diagnostics distinguish the **requested quality tier**, provider/decoder-reported information and actual Android output. A Hi-Res label alone does not prove delivered PCM quality.

### Audio output

AUREL uses Android media playback and offers an experimental USB/audio-mixer preference on supported Android versions. **Do not interpret this preference as verified bit-perfect output**: unchanged PCM samples to a particular USB DAC require device-specific validation. Digital effects, normalization and the Android mixer may alter audio. Audio-source authorizations and USB DAC support can differ between devices.

### Data, privacy and updates

- Credentials and authorized session material are stored locally using Android Keystore where implemented; never publish tokens or App Secrets in issues, logs or screenshots.
- Local JSON export/restore covers an allow-list of application preferences, navigation/search metadata, artwork palettes and listening history. **It excludes passwords, authentication tokens and signed stream URLs** and does not export or change Qobuz-managed favourites/playlists.
- No music-download, ripping or offline audio-export feature is provided.
- Optional read-only audio visualization may request microphone/audio-capture permission; it is separate from playback authorization.
- In-app updates use GitHub Releases with SHA-256 integrity verification, the original pinned AUREL signing certificate, a matching package ID and a strictly increasing Android `versionCode`. Android shows an installation confirmation; AUREL does not silently install updates.

## Install or update

1. Open [GitHub Releases](https://github.com/famous37/AUREL-Hi-Res/releases/latest) and download the **AUREL-Hi-Res APK** attached to the latest release.
2. Install it on Android 10 or newer.
3. When upgrading a previously installed *production-signed* AUREL, install over the existing app **without uninstalling**, so its saved local data remains available.
4. To receive future versions, open **Settings → App updates**, enable automatic update **checks** and approve download/installation when prompted.

**Important:** `AUREL Preview` is a separate application (`com.aurel.hires.preview`). A production APK will not replace it or share its private settings. Debug builds may use another signing certificate and may not update an existing installation.

## Connect a music provider

AUREL can use an existing authorized streaming session and, optionally, a separate authorized Qobuz personal-library session. Use only your own valid credentials and an App ID permitted for the corresponding integration. A token saved in the app is not proof that provider catalogue access or audio streaming is authorized.

- Qobuz **401/403/405** and unavailable Fresh releases can reflect expired sessions, unsupported App IDs, restricted endpoints or missing permissions.
- Zarz/Mornye signed-session grants, streaming URLs and rate limits remain under the upstream provider's control.
- Search and playback may still work even if the personalized or featured catalogue is unavailable.
- The application cannot guarantee access to a feature the upstream service refuses.

## Build and development

The current source is maintained on `main`. Android source is in `app/src/main/java/com/aurel/hires/`; web UI assets are in `app/src/main/assets/`; automated regression tests are in `tests/`.

Requirements: **JDK 21**, compatible Android SDK (compile SDK 37), and Gradle matching the GitHub Actions configuration.

```bash
node test_ui.cjs
node tests/stage1-cache-frame-regression.test.cjs
node tests/stage2-lyrics-history-backup.test.cjs
node tests/stable-content-autoupdate.test.cjs
gradle --no-daemon :app:assembleDebug
```

Production APKs are built and signed by the dedicated GitHub Actions release workflow using private repository secrets. **Do not commit the signing keystore or passwords.** The release workflow validates the certificate identity before publication, and uploads an APK with `SHA256SUMS.txt`.

Automated tests verify supported UI, navigation, JavaScript, Android build and signing invariants; they do **not** prove live Qobuz entitlements, DAC bit transparency or visual performance on every physical device.

## Українською

**AUREL Hi-Res** — музичний програвач для Android 10+ із підтримкою авторизованого каталогу Qobuz, історією прослуховування, синхронізованими текстами пісень, кольоровими палітрами обкладинок і перевіркою підписаних оновлень.

**[Завантажити APK](https://github.com/famous37/AUREL-Hi-Res/releases/latest)** · **[Історія випусків](https://github.com/famous37/AUREL-Hi-Res/releases)**

---

© famous37 — AUREL Hi-Res. Independent Android music player. Qobuz is a trademark of its respective owner.
