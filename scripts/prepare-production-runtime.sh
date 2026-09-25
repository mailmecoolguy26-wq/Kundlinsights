#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${RENDER_SOURCE_DIR:-$PWD}/.runtime/timezone-source"
RUNTIME_DIR="${RENDER_SOURCE_DIR:-$PWD}/.runtime/timezone"

ZIP_PATH="$SOURCE_DIR/timezones-1970.geojson.zip"
JSON_PATH="$SOURCE_DIR/combined-1970.json"

EXPECTED_ZIP_SHA256="c1bd0839c15a94ace5107e84694915fca3ab74907dee7b2ed4e3e5e01acc8f16"

mkdir -p "$SOURCE_DIR"
rm -rf "$RUNTIME_DIR"

curl -fL \
  -o "$ZIP_PATH" \
  "https://github.com/evansiroky/timezone-boundary-builder/releases/download/2026c/timezones-1970.geojson.zip"

if command -v sha256sum >/dev/null 2>&1; then
  ACTUAL_SHA256="$(sha256sum "$ZIP_PATH" | awk '{print $1}')"
else
  ACTUAL_SHA256="$(shasum -a 256 "$ZIP_PATH" | awk '{print $1}')"
fi

if [ "$ACTUAL_SHA256" != "$EXPECTED_ZIP_SHA256" ]; then
  echo "Timezone source checksum mismatch."
  exit 1
fi

unzip -o "$ZIP_PATH" -d "$SOURCE_DIR"

node scripts/build-timezone-runtime-artifact.js \
  "$JSON_PATH" \
  "$RUNTIME_DIR"

echo "Timezone production runtime prepared successfully."
