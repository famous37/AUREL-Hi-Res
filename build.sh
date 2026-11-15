#!/usr/bin/env bash
set -euo pipefail
if ! command -v gradle >/dev/null;then echo 'Gradle is missing. Open in Android Studio or use .github/workflows/android.yml.';exit 1;fi
if [ -z "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ];then echo 'Android SDK not configured. Set ANDROID_HOME or ANDROID_SDK_ROOT.';exit 1;fi
gradle --no-daemon :app:assembleDebug
echo 'APK: app/build/outputs/apk/debug/app-debug.apk'
