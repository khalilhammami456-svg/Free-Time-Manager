#!/bin/sh
# Download the background-removal ONNX models from the upstream rembg GitHub release and VERIFY SHA-256.
# @bunnio/rembg-web does not validate model hashes itself (it logs "No hash available"), so we pin them here.
# Usage: tools/fetch_models.sh [dest-dir]            (default: models/)   -- add FULL=1 to include the 176 MB human_seg model
set -eu
DEST="${1:-$(dirname "$0")/../models}"; mkdir -p "$DEST"
BASE="https://github.com/danielgatis/rembg/releases/download/v0.0.0"
# name  sha256 (computed 2026-10-04 from the files served by the release)
LIST="u2netp 309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8
silueta 75da6c8d2f8096ec743d071951be73b4a8bc7b3e51d9a6625d63644f90ffeedb"
[ "${FULL:-0}" = 1 ] && LIST="$LIST
u2net_human_seg 01eb6a29a5c4d8edb30b56adad9bb3a2a0535338e480724a213e0acfd2d1c73c"
echo "$LIST" | while read -r name sum; do
  f="$DEST/$name.onnx"
  [ -f "$f" ] && echo "$sum  $f" | sha256sum -c --quiet - 2>/dev/null && { echo "ok (cached) $name"; continue; }
  curl -fsSL -o "$f.part" "$BASE/$name.onnx"
  echo "$sum  $f.part" | sha256sum -c --quiet - || { echo "HASH MISMATCH for $name - refusing to use it" >&2; rm -f "$f.part"; exit 1; }
  mv "$f.part" "$f"; echo "ok $name ($(wc -c <"$f") bytes)"
done
