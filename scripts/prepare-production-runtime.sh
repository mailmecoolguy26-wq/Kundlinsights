#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${RENDER_SOURCE_DIR:-$PWD}/.runtime/timezone-source"
RUNTIME_DIR="${RENDER_SOURCE_DIR:-$PWD}/.runtime/timezone"

ZIP_PATH="$SOURCE_DIR/timezones-1970.geojson.zip"
JSON_PATH="$SOURCE_DIR/combined-1970.json"

EXPECTED_ZIP_SHA256="c1bd0839c15a94ace5107e84694915fca3ab74907dee7b2ed4e3e5e01acc8f16"
SOURCE_URL="https://github.com/evansiroky/timezone-boundary-builder/releases/download/2026c/timezones-1970.geojson.zip"

mkdir -p "$SOURCE_DIR"
rm -rf "$RUNTIME_DIR"

if command -v curl >/dev/null 2>&1; then
  curl -fL -o "$ZIP_PATH" "$SOURCE_URL"
elif command -v wget >/dev/null 2>&1; then
  wget -O "$ZIP_PATH" "$SOURCE_URL"
else
  node - "$SOURCE_URL" "$ZIP_PATH" <<'NODE'
const fs = require('node:fs');
const https = require('node:https');

const [url, destination] = process.argv.slice(2);
const temporary = `${destination}.partial-${process.pid}`;

function fail(error) {
  fs.rmSync(temporary, { force: true });
  console.error(`Timezone source download failed: ${error.message}`);
  process.exitCode = 1;
}

function download(currentUrl, redirects = 0) {
  if (redirects > 5) return fail(new Error('too many redirects'));
  const request = https.get(currentUrl, (response) => {
    const { statusCode = 0, headers } = response;
    if (statusCode >= 300 && statusCode < 400 && headers.location) {
      response.resume();
      return download(new URL(headers.location, currentUrl), redirects + 1);
    }
    if (statusCode < 200 || statusCode >= 300) {
      response.resume();
      return fail(new Error(`HTTP ${statusCode}`));
    }
    const output = fs.createWriteStream(temporary, { flags: 'w' });
    response.pipe(output);
    response.on('error', fail);
    output.on('error', fail);
    output.on('finish', () => output.close((error) => {
      if (error) return fail(error);
      fs.renameSync(temporary, destination);
    }));
  });
  request.on('error', fail);
}

download(url);
NODE
fi

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
