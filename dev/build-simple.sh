#!/usr/bin/env bash
# Assemble the minimal counter into a standalone tosu overlay + zip it.
# Reuses the full counter's JS (unchanged) and shared CSS; swaps in the minimal
# index.html + counter.css from dev/simple-overlay/. Output: decay-simple.zip
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/dev/simple-overlay"
OUT="$ROOT/build/decay-simple"

rm -rf "$OUT"
mkdir -p "$OUT/js" "$OUT/css"

# shared, unchanged from the full counter
cp "$ROOT"/js/*.js "$OUT/js/"
cp "$ROOT/css/theme.css" "$ROOT/css/odometr.css" "$ROOT/css/hit-judgements.css" "$OUT/css/"
cp "$ROOT/settings.json" "$OUT/settings.json"

# minimal-specific
cp "$SRC/counter.css" "$OUT/css/counter.css"
cp "$SRC/index.html" "$OUT/index.html"
cp "$SRC/metadata.txt" "$OUT/metadata.txt"
cp "$SRC/README.md" "$OUT/README.md"

( cd "$ROOT/build" && rm -f "$ROOT/decay-simple.zip" && zip -rq "$ROOT/decay-simple.zip" decay-simple )
echo "built: $ROOT/decay-simple.zip"
unzip -l "$ROOT/decay-simple.zip"
