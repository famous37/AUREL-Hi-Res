# AUREL Hi-Res · 1.0.0 Beta

**Developer: famous37** · Independent Android music player using the Qobuz catalogue where the user's own session and integration are authorized.

## Interface

- High-contrast dark theme with lavender controls, large readable text, and adaptive layouts from compact phones through landscape to tablets.
- Four mobile destinations: Discover, Search, Library, Settings. A persistent mini-player has cover art, title/artist, previous, play/pause, next and progress.
- The full player includes responsive album art, interactive seeking, shuffle/repeat, Queue, Info, Audio and Favourites. Artist names open discographies. Android MediaSession supports lock-screen and notification controls.
- **No downloads, saving, folder importer, purchased-file manager or export controls.** AUREL is streaming-focused. Legacy files previously copied by older versions are not deleted.

## Murglar-inspired token-first sign-in

1. In AUREL, enter your existing **Qobuz session token**. This does not require email/password sign-in or a user/profile/favourites API preflight.
2. Expand **Advanced · App ID & App Secret** only if your account uses different integration credentials. The default App ID is `312369995`, from the user's previously supplied AUREL configuration; it may not be valid for every token or environment.
3. To play signed direct Qobuz audio URLs, a compatible **App Secret is still required** when none is stored. The login form's optional secret refers only to the act of saving the token, not to bypassing Qobuz playback requirements.
4. Qobuz may reject an invalid/expired token, an unsupported App ID, or a stream request even when the token has been saved. **Saved is not the same as verified.** The app marks the session as playback-confirmed only after an actual stream begins.
5. The optional **separate library account**, available in Settings, uses its own token and App ID for favourites, artists, saved albums and playlists. Playback is always authorized by the primary streaming account.

This is an independent interface inspired by publicly visible Murglar UX patterns, not a copy of private Murglar or Qobuz authentication keys or proprietary modules. No tokens, passwords or App Secrets are embedded in the APK. The Android Keystore encrypts credentials saved on each installation.

## Build and checks

```bash
node test_ui.cjs
./gradlew :app:assembleDebug
```

Android 8+ (minSdk 26). APKs built by separate GitHub Actions runs may use different debug signing keys; updating a previously installed debug APK can fail for signature mismatch. Test preview variants have their own application IDs and therefore **do not inherit credentials** from the original installation.

**Validation:** automated JavaScript and Android build checks are not a substitute for live Qobuz token and playback verification on a real device.
