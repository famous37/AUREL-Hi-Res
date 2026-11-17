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
