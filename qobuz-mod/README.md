# Qobuz 10.2.0.0 — token-auth modification (WORK IN PROGRESS)

This is an **isolated investigation branch**, NOT the AUREL app and NOT a completed modified Qobuz APK.

Source APK: Qobuz 10.2.0.0, versionCode 26110610, 40,106,588 bytes.
Expected SHA-256: `1edc1577006a7fe07f17ee4fdeac2a6bc2109688cae61aa0448813a0b57c0529`.

## Objective
- Keep the original Qobuz UI, playback engine, libraries and official sign-in.
- Add a separate user-supplied `user_auth_token` + `user_id` + `app_id` + `app_secret` input.
- Validate credentials with the matching API client, bind the new authentication mode to the original application's personal-library and playback data flow, and restore it securely.
- Do not confuse legacy Qobuz API session tokens with OAuth/QWS JWTs.
- Do not embed secrets or tokens in GitHub source or Actions logs.
- Do not claim playback works until tested on a device with a subscribed account.

## Current verified state
- The original APK hash matches the published APKMirror 10.2.0.0 upload.
- Four DEX files contain both OAuth and QWS models, including `OAuthLoginDto`, `OAuthDto`, `QWSAuthDto`, `QWSAuthTokenDto`.
- Actual session/persistence interception points and server interoperability have not yet been identified.
- No functional Smali integration has been written, so **there is NO completed MOD APK**.

## Workflow
The `qobuz-mod-analysis.yml` workflow verifies exact source APK identity and gathers basic structural evidence. It does not distribute decompiled proprietary code or publish an APK. A real release pipeline must be added only when the token-auth patch exists, builds and passes real-device login/playback tests.

## Original vs mod signatures
Re-signing changes the certificate. A modified APK cannot upgrade the official installed package unless signed with Qobuz's signing key. A side-by-side clone requires consistent manifest/provider/deep-link adjustments and must be separately tested.

## Security
Never submit `user_auth_token`, `app_secret`, passwords, subscription identifiers, or other account secrets to a GitHub issue/commit or CI variable visible in logs.
