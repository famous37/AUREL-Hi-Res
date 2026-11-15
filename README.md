# AUREL Hi-Res v0.2.0 Alpha — Android Qobuz companion

An independent, unofficial Qobuz-inspired Android music client (not affiliated with Qobuz). Built as a compact, dark-themed WebView UI with a native Java HTTPS bridge, encrypted credentials, and Android MediaPlayer.

## What's new in v0.2

- Android edge-to-edge display corrected using native system/IME insets (including Android 15+).
- Album images propagated to tracks and a more robust domain-checked image handler; image fallbacks improved.
- Artist search opens actual artist details and discographies, with albums opening playable track lists.
- Compact, Qobuz-inspired full-screen player with cover art, clear stream format, basic queue controls.
- **Separate accounts:** streaming account via token or direct password login (if Qobuz permits), optional independent library account via token or password. The second account supplies favorites, artists and playlists. Music streaming is authorized separately through the streaming account; no cross-account subscription or rights transfer is performed.
- Playback info reflects actual API responses, not assumed bit-perfect output.

## Security and streaming limitations

Provide only app credentials you are authorized to use. Tokens and application secrets are encrypted at rest using Android Keystore; plaintext passwords are never saved. Do not commit tokens or app secrets to GitHub. If previously exposed, rotate them.

This build requests `track/getFileUrl` and `file/url`, checks Qobuz response, and plays **only direct HTTPS media URLs** with Android MediaPlayer. Current Qobuz content may be delivered as encrypted, segmented streams instead. **This build does not bypass encryption or include Qobuz's licensed playback modules**, and therefore many subscribed tracks may fail to play. A functional APK build is not a guarantee that Qobuz login and all music streams work. Password login may fail due to Qobuz CAPTCHA, OAuth or other account checks.

Qobuz API terms: https://static.qobuz.com/apps/api/QobuzAPI-TermsofUse.pdf

## Build

Android Studio: open project and build APK (`Build > Build APK(s)`).

CLI: JDK 17, Android SDK 35, Gradle 8.9: `gradle :app:assembleDebug`.

GitHub Actions: commits to `main` or manual **Run workflow** invoke `.github/workflows/android.yml` and upload a debug APK artifact.

This repository is standalone: it does not include source code or history from Mornye.

## Files

- `app/src/main/assets/{index.html,app.js,style.css}` — application user interface.
- `app/src/main/java/com/aurel/hires/MainActivity.java` — JS/native bridge, Android media playback, window handling.
- `app/src/main/java/com/aurel/hires/QobuzApi.java` — Qobuz JSON API calls, separated account sessions.
- `app/src/main/java/com/aurel/hires/SecureStore.java` — encrypted local storage.

The application includes no copyrighted album art, account credentials, tokens or access keys in source code.


## v0.3.0 Alpha

Original album-led Discover UI, Magazine entry, Qobuz-style four-tab navigation, improved library/sorting, search history, new artwork-driven player, queue editing, and detailed audio/credit panels. No proprietary code or Qobuz assets are copied. Protected segmented audio remains unsupported.
