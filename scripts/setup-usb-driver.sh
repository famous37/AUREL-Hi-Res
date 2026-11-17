#!/usr/bin/env bash
# MIT-licensed direct USB UAC2 driver. Never update the revision implicitly.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
URL="https://github.com/Ma145/decent-player.git"
REV="d039f9d6b1ec30901a5cd6edf72c29cde362a549"
DEST="$ROOT/vendor/decent-player"
mkdir -p "$ROOT/vendor"
if [[ ! -d "$DEST/.git" ]]; then
  git clone --no-checkout "$URL" "$DEST"
fi
git -C "$DEST" fetch --depth 1 origin "$REV"
git -C "$DEST" checkout --detach "$REV"
test "$(git -C "$DEST" rev-parse HEAD)" = "$REV"
printf 'Using Decent USB Audio %s (MIT libs only)\n' "$REV"

# Both the native UAC2 driver and decoder JNI compile upstream libFLAC.
FLAC_REV="1507800de4b70e21be71f38caa0d9079d0bc6e45"
FLAC_DIR="$DEST/libs/decent-media3-decoder-flac/src/main/jni/libflac"
if [[ ! -d "$FLAC_DIR/.git" ]]; then
  git clone --no-checkout https://github.com/xiph/flac.git "$FLAC_DIR"
fi
git -C "$FLAC_DIR" fetch --depth 1 origin "$FLAC_REV"
git -C "$FLAC_DIR" checkout --detach "$FLAC_REV"
test "$(git -C "$FLAC_DIR" rev-parse HEAD)" = "$FLAC_REV"
printf 'Using libFLAC %s (BSD license)\n' "$FLAC_REV"
