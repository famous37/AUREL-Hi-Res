# AUREL Hi-Res · 1.1.7 Beta

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

## v1.0.3 — Interactive Qobuz Web / CAPTCHA and Mornye compatibility monitor

The sign-in screen offers **three methods** for both the streaming and optional library account: Session token, Email/password, and Web/CAPTCHA.

**Web/CAPTCHA** opens the **official** `https://play.qobuz.com/login` page in a separate Android WebView. The user completes the provider's login and any presented CAPTCHA. When the user explicitly presses **Use this session**, AUREL reads only known Qobuz token fields from that page's own localStorage; the app never intercepts or saves the user's password or CAPTCHA answer. When possible AUREL also observes the public `X-App-Id` supplied by the *same browser session*, reducing token/App-ID mismatches. The resulting token is revalidated with Qobuz before being saved by Android Keystore. No JavaScript interface is injected into the remote web page. The browser may not succeed if Qobuz prohibits embedded WebViews, uses an unsupported identity-provider redirect, or changes its local storage format. In that case use a supported external browser and manually paste the session token.

If the direct email/password API indicates CAPTCHA/browser verification, AUREL switches to the interactive Web/CAPTCHA method instead of silently retrying passwords. The native browser offers a link to the official external browser as a fallback.

**Mornye extension compatibility:** The upstream open-source Qobuz Web extension is a metadata/download provider, *not* a standalone login implementation. Its manifest requires `signedSession@3` and `sessionGrant@1` supplied by the Mornye host and Zarz gateway. AUREL does **not** have those runtime features. AUREL automatically checks the official Mornye Extension Registry when launched (at most once per 24 h) and shows the current `qobuz-web` version in the Web/CAPTCHA tab; **it does not install or execute downloaded extension code**. Running that extension inside AUREL or automatically updating its executable code is **not implemented** and must not be confused with the implemented, independent Qobuz Web login.

Upstream sources:
- [Qobuz Web extension manifest and source](https://github.com/mornyeapp/Mornye-Extension/tree/main/sources/qobuz-web) (LGPL-3.0-only)
- [Mornye extension registry](https://github.com/mornyeapp/Mornye-Extension/blob/main/registry.json)
- [Mornye signed-session host implementation](https://github.com/mornyeapp/Mornye/tree/main/rust_backend/crates/extensions/src)

No music-download features have been restored to AUREL. A real-device Qobuz login and CAPTCHA check remains necessary; CI cannot simulate the external website.

## v1.0.4 — Qobuz Web/CAPTCHA session import repair

- Fixed a sign-in failure caused by handing HTTPS identity-provider redirects off to an external browser (whose cookies are isolated from the AUREL WebView).
- While the user signs in, the isolated WebView can capture the issued `X-User-Auth-Token` and public `X-App-Id` from requests to Qobuz's HTTPS API; credentials are never collected from external sites or logged. AUREL still requires explicit **Use this session** and validates the token with Qobuz before saving it.
- Retained the existing on-demand first-party localStorage extraction fallback. This is **not** an implementation of Mornye's signed-session host, and is not a promise that Qobuz will permit Android WebView authentication.
- The old Mornye version-only status panel was misleading and has been replaced with an explanation. No executable third-party extension code or music-download capabilities have been added.
- **Real-account verification required:** Qobuz may change its login flow or reject WebView, and a usable Qobuz account token is different from a Mornye/Zarz signed gateway session.

## v1.0.5 — Native Mornye protocol, no Qobuz browser login

- Removed the unusable mobile Qobuz Web/CAPTCHA sign-in and its manifest activity.
- Third sign-in tab now establishes a native `signedSession@3` session using Mornye's published Zarz gateway protocol (`/bootstrap`, HMAC-signed metadata, one-time audio tickets). It checks a real signed catalogue response before marking the session connected.
- This is **Mornye gateway access, not a Qobuz account login**. Its grant and gateway availability are controlled by Zarz: if the server returns a required session grant, AUREL reports that access is pending and does not impersonate a working session. This behavior has not yet been tested with the live service.
- The legacy **Token** and **Password** methods and independent personal Qobuz **Library** account remain. Mornye gateway mode cannot supply a user's favourites or playlists without that separate account.
- Gateway audio URLs are passed to Android MediaPlayer for online playback only; AUREL has no audio download/export features. A gateway returning a URL does not guarantee it will play or be allowed for the user's account.
- No automatic extension installation or execution is attempted. The gateway session keys are encrypted using Android Keystore.

Reference: https://github.com/mornyeapp/Mornye/tree/main/rust_backend/crates/extensions/src/signed_session (LGPL-3.0-only), https://github.com/mornyeapp/Mornye-Extension/tree/main/sources/qobuz-web .

## v1.0.6 — Complete Mornye session-grant handshake

- Fixed v1.0.5 stopping on `verificationRequired` after `GET /bootstrap`.
- Implemented Mornye-compatible one-time Zarz verification in a **private in-app window** (not the Qobuz desktop Web Player), with a `mornye://session-grant?state=...&grant=...` callback.
- Verified callback `state` and enforced a 180-second one-time challenge window. Exchange the grant using `POST /session/exchange` (install ID and extension protocol scope).
- Save the signed session only after successful exchange, then check a signed `track/search` request. Report server errors or an expired grant explicitly; never mark an unverified connection as connected.
- Removed the obsolete Android Qobuz WebView sign-in activity and the misleading extension version-only checker. Token and Password logins remain; personal Qobuz favourites/playlists still require a separate library account.
- Integration tests check JavaScript, Android compilation, callback routing and source protocol. **Server-side grant/CAPTCHA completion and real playback have not been verified on a device.** The gateway can still refuse verification; server restrictions cannot be bypassed by the client.

Protocol reference: https://github.com/mornyeapp/Mornye/tree/main/rust_backend/crates/extensions/src/signed_session

## v1.0.7 — HTTP 403 / 429 handling and audio source metadata

- **403 on new releases:** The Mornye/Zarz metadata gateway does not necessarily authorize `album/getFeatured`. In Mornye mode AUREL now uses the Qobuz public featured-albums API (public widget App ID from upstream Mornye) and, only when an authorized Qobuz account is already configured, can fall back to that user's official account. If the public endpoint is also refused, AUREL reports the failure rather than inventing albums.
- **429 when starting playback:** Zarz `DOWNLOAD_RATE_LIMITED` is a server restriction. AUREL respects HTTP `Retry-After` (numeric seconds or HTTP date), accepts JSON `retry_after_seconds`, and persists a streaming cooldown in Android encrypted storage. When no timing is given, it uses a conservative 120-second pause. There is **no attempt to bypass the provider's limit**. Subsequent play presses during the cooldown do not mint fresh tickets or reattempt the stream.
- Aborts all automatic audio-quality fallback attempts on Zarz 401, 403 or 429. 400-quality failures may still use another authorized quality tier. The Mornye gateway's CD tier is not mislabeled MP3.
- Fixed gateway response parsing to provide the player's real `bits_depth` and `sample_rate_hz` fields; these values are displayed as source metadata only when supplied and consistent. Real playback and decoder support still need verification on-device.
- The Settings screen now distinguishes verified **catalogue** access from working **audio playback**.
- Token / Password / Mornye and separate account library remain unchanged.

A successful Android build **does not** prove the public Qobuz API will grant new-release access or that Zarz's rate limit has expired. Both are remote server policies.

## v1.0.8 — Qobuz track details, independent library account and mobile layout

- Playing track info is enriched asynchronously from Qobuz's public track widget, or preferably from the **separately authorized library account** for richer credits such as ISRC, release dates, copyright and composers. Mornye catalogue metadata remains an additional fallback. Metadata errors never stop a working stream.
- **Source quality is not guessed.** Audio page distinguishes actual provider-reported bit depth/sample rate, Android parsed track parameters, and the maximum quality listed in the Qobuz catalogue. A catalogue maximum is never claimed to be the playing FLAC format or DAC bit-perfect output.
- The separate library login now defaults to **Qobuz email or username + password**, with **no App ID input**; AUREL reuses a saved Qobuz App ID or resolves an appropriate public client ID. This secondary account stores only an encrypted issued token, never the password, and does not replace the Mornye stream session. Token login remains an alternative.
- Password sign-in uses a POST body (including a bounded legacy username POST variant); no password is placed in a URL.
- A final responsive stylesheet fixes overflows in auth, settings, small-screen tabs, the mini-player and full-player info/audio sheets. The full-player detail sheet remains scrollable independently above the navigation bar.
- **Provider limitation:** Qobuz may reject third-party password authentication or require CAPTCHA. No client change can guarantee it, and a registered/authorized App ID is still required by Qobuz at the API level; the user simply no longer has to type one. Exact stream bit depth is shown only if the server supplies it.

## v1.0.9 — Qobuz authentication and safe mobile UI

- Qobuz password API requests now use the legacy MD5 representation rather than sending a raw password, and no redundant login requests are made after HTTP 401. The Qobuz server can continue rejecting direct third-party password sign-in, as widely reported since April 2026. AUREL does NOT bypass that restriction. For a personal library, an independent Session Token remains available without changing the Mornye streaming session.
- An App ID is selected automatically for library password authentication. In separate library token mode, a user may optionally override the App ID for tokens originating from another Qobuz integration; no silent hardcoded ID is substituted.
- Zarz in-app verification now has Android status/navigation/IME insets and stable WebView settings for Cloudflare. The browser fallback is for the Zarz challenge ONLY, never the Qobuz desktop player. Returned one-time grants are checked against encrypted short-lived state before exchange.
- Corrected double safe-area handling: the native Android root already consumes system-bar insets; the web bottom bar now uses a fixed 70 px height and four full-width cells without an additional CSS inset. Horizontal panning from keyboard focus is reset after navigating.
- Both regular and independent AUREL Preview APKs are produced. Installing Preview does not replace a previously working player.
- Tests cover source-level behavior and Android compilation. Qobuz and Zarz server authorization and specific-device display remain unverified until an actual phone test.

References: https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/ ; https://github.com/nathom/streamrip/issues/956

## v1.1.0 — Stable navigation, album art, early quality/bitrate

- The same persistent **Discover / Search / Library / Settings** bottom navigation is used in all screens, including Now Playing. There is no separately rendered full-player nav with different height, order or route handlers. The full-player content stops above the 70 px shared footer.
- Stronger, consistent foreground/background and selected-tab contrast; the mini-player stays a fixed 72 px and displays the current album cover, title, artist, and previous/play/next controls. Artwork is requested eagerly and displayed as a 31 px thumbnail beside the full-player heading.
- Existing track/album catalogue information is displayed immediately when playback begins. A bounded in-memory cache (128 tracks) serves repeated/revisited tracks without refetching; the next track's catalogue metadata may be prefetched after successful playback starts. It **does not** request future audio tickets or stream URLs, respecting Zarz's rate limits.
- When an audio URL is resolved, stream metadata is emitted before waiting for Android MediaPlayer.prepareAsync. If present, source-reported bitrate/size are exposed, Android's parsed track bitrate may be shown after prepare, and file-size/duration can provide a clearly marked **estimated average bitrate** for VBR audio. If no credible source is available, bitrate remains unknown. Quality presets and Qobuz catalogue maximum never masquerade as measured stream bitrate.
- No changes to the existing Mornye authentication, personal library credentials, or streaming protocol. Playback availability remains subject to Zarz/Qobuz; catalogue calls and bitrates may still take network time and cannot be guaranteed instant by the Android UI.
- Run JavaScript regression checks, Gradle debug builds, and small-screen layout checks. Testing on the user's handset remains the final verification.

## v1.1.7 — Artist catalogue recovery

- Restores direct Qobuz metadata lookups for **Most popular** and **Similar artists** when the Mornye/Zarz metadata gateway does not expose `artist/page` or `artist/getSimilarArtists`.
- Prefers the separately connected, authorized Qobuz library account for richer artist metadata and release lists; otherwise tries only public artist metadata endpoints or the current gateway.
- Loads **EPs & Singles** and compilations with Qobuz `artist/getReleasesList` when authorized; falls back to the limited, explicitly typed `artist/page` release preview where available.
- Clearly distinguishes API loading failures from a genuine empty result. Failed sections provide a **Retry** action without disrupting the mini-player, full-player, album-adaptive theme or bottom navigation.
- Qobuz can require user authentication for the complete release-list endpoint. An APK build alone cannot verify your account's access, guarantee all sections will be returned, or bypass Qobuz restrictions. No music download functionality was added.

References: [Qobuz artist API documentation](https://minim.readthedocs.io/en/dev/api-ref/minim.api.qobuz.PrivateArtistsAPI.html) and [Qobuz artist-page schema](https://github.com/arthursoares/qobuz_tidal_api_client/blob/main/docs/api-spec.md).
