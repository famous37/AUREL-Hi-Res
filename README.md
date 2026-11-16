# AUREL Hi-Res · 1.0.2 Beta

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


## v1.0.1 — live account validation and 401 repair

- **Fix:** older AUREL builds saved an arbitrary session token and marked the account "connected" without asking Qobuz. On opening Discover, Qobuz could respond `401 User authentication is required` although the UI had appeared to sign in.
- AUREL now checks the token and chosen App ID using an authenticated Qobuz API call **before saving new account credentials**. A rejected pair does not overwrite the previous saved token or App Secret.
- Existing saved sessions are checked on startup. If Qobuz responds 401/403, the account screen shows a persistent explanation instead of a false logged-in catalogue; the App ID field opens automatically.
- **Important:** the previously user-supplied default App ID `312369995` is not guaranteed to match tokens issued by current Qobuz clients. A web-player token must be paired with the **X-App-Id from the same Qobuz session** (inspect the browser's Network tab for a `api.json` request). Tokens from other clients may have different app identity requirements.
- When the modern `discover/newReleases` endpoint is restricted, AUREL tries the documented `album/getFeatured?type=new-releases` alternative. Authentication failures still propagate if both require a valid session.
- The Settings screen has **Check Qobuz connection**. AUREL uses the existing Android encrypted credential store; never logs or displays the token.
- This update does not bundle other apps' App Secret credentials, bypass user authentication, or guarantee playback without a supported Qobuz integration. Automated test/build checks cannot validate a user's personal token.

## v1.0.2 — parallel token + email/password sign-in

The account screen now offers two separate sign-in methods both for the **streaming account** and for the independent **library account**:
- **Session token**: paste your official Qobuz token. Leave **App ID** empty to attempt to fetch the current **public** web client App ID from play.qobuz.com (no secret is extracted or bundled). Tokens from Murglar or another application might require the App ID of the application that issued them.
- **Email / password**: AUREL attempts Qobuz's legacy `user/login` endpoint via HTTPS. On API method incompatibility it also attempts the older HTTPS GET variant. This flow can fail if Qobuz requires CAPTCHA, OAuth, 2FA or browser verification; use **Official Qobuz login** and a session token in that case. The password is not saved; only the issued token and App ID are encrypted on-device. Note: legacy GET login sends password as an HTTPS query argument which Qobuz's server may log; token login avoids this legacy request.
- The **library account** independently accepts a token or password login and is used only for favourites, saved releases, artists and playlists. Playback always uses the streaming account.
- Every account is tested against an authenticated Qobuz user endpoint before the new credentials replace the previous encrypted session. The primary account also checks catalogue access. If credentials fail validation, AUREL preserves old credentials and displays a detailed error.
- All API calls include the `X-App-Id` header and `app_id` parameter for compatibility with client versions. The user can always enter their authorized App ID manually.
- No downloader or offline-export UI has been reintroduced.

**Limitations:** AUREL does not possess a Qobuz-issued developer App Secret, and thus signed audio URL requests may still require your own compatible secret. Password login and public web App ID discovery depend on Qobuz's currently supported infrastructure and are not guaranteed. Live authorization against your personal account cannot be performed during GitHub CI builds.
