# AUREL Hi-Res — permanent APK signing

AUREL uses one **RSA 4096 / SHA-256** app-signing certificate for all future
direct-download GitHub APK releases. The private key and password must **never**
be committed to GitHub or printed in Actions logs.

## Public certificate identity

- Alias: `aurel-release`
- Certificate fingerprint (SHA-256): `C9F57989C6622A55440F35CD426A5DC6830161EEB5AEAB299FDB3E69F94ED3CA`
- Validity: November 2026 – November 2066
- Main application ID: `com.aurel.hires`
- First planned permanently signed version: `v1.1.19`

## Configure repository secrets (required once)

Open the repository Settings → Secrets and variables → Actions → New repository secret
or navigate to https://github.com/famous37/AUREL-Hi-Res/settings/secrets/actions

| Secret | Value |
| --- | --- |
| `AUREL_RELEASE_KEYSTORE_BASE64` | Complete one-line Base64 encoding of the developer's private `aurel-release.keystore` (PKCS12). Generate with `base64 -w 0 aurel-release.keystore` on Linux. |
| `AUREL_RELEASE_PASSWORD` | Password protecting the private keystore/key; same password for both. |

**Do not put the key or secrets in this repository.** Preserve at least two
offline backups of the keystore and password. If this signing key is lost,
new standalone APK releases will no longer update the existing app.

## Publishing

After both secrets are saved, open **Actions → Publish permanently signed
AUREL release → Run workflow** on `main`.

The workflow fails closed when signing secrets are missing, when the wrong
certificate is provided, when Gradle builds an unsigned APK, if the APK's
signature is invalid, or if the release version already exists. It verifies
the exact signing fingerprint and `com.aurel.hires` before uploading an
immutable GitHub prerelease with `SHA256SUMS.txt`.

The routine **Build Android APK** workflow still generates *debug and preview
builds for testing only*. Never distribute those as updateable signed releases.

## Updating the version

Before each new release, increase `versionCode` and `versionName` in
`app/build.gradle`, and update the About version in the UI. Keep the
application ID, `aurel-release` alias, and signing certificate unchanged.

## One-time migration from 1.1.18 or earlier

Previous GitHub releases were built using the Android debug signing
certificate from an ephemeral CI runner, so they are *not guaranteed* to
be upgrade-compatible. The first permanently signed release may require
uninstalling the old build. Current Android manifest sets
`android:allowBackup="false"`; record important settings and be ready to
reconnect Qobuz/Mornye before uninstalling.

Once permanently signed AUREL is installed, future releases using this
same signing key will update in place, keeping application data.

Reference: https://developer.android.com/studio/publish/app-signing
