#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/vendor/superpowered-sdk"
REPO="https://github.com/superpoweredSDK/Low-Latency-Android-iOS-Linux-Windows-tvOS-macOS-Interactive-Audio-Platform.git"
PIN="6198239d1e96c18c87c40dd7236d70d41c21921c"
if [[ ! -d "$DEST/.git" ]]; then
  mkdir -p "$(dirname "$DEST")"
  git clone --filter=blob:none --sparse --no-checkout "$REPO" "$DEST"
fi
git -C "$DEST" sparse-checkout set Superpowered
git -C "$DEST" fetch --depth=1 origin "$PIN"
git -C "$DEST" checkout --detach "$PIN"
test -s "$DEST/Superpowered/SuperpoweredAndroidUSB.h"
test -s "$DEST/Superpowered/libSuperpoweredAndroidarm64-v8a.a"
echo "Official Superpowered SDK ready locally under vendor/superpowered-sdk/Superpowered."
echo "Evaluation license: private R&D only. Do not publish the compiled APK or SDK."
echo "Build privately: gradle :superpoweredUsbLab:assembleDebug -PaurelSuperpoweredLab"
