#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${RENDER_SOURCE_DIR:-$PWD}/.runtime/timezone-source"
RUNTIME_DIR="${RENDER_SOURCE_DIR:-$PWD}/.runtime/timezone"

ZIP_PATH="$SOURCE_DIR/timezones-1970.geojson.zip"
JSON_PATH="$SOURCE_DIR/combined-1970.json"

EXPECTED_ZIP_SHA256="c1bd0839c15a94ace5107e84694915fca3ab74907dee7b2ed4e3e5e01acc8f16"
SOURCE_URL="https://github.com/evansiroky/timezone-boundary-builder/releases/download/2026c/timezones-1970.geojson.zip"
BUILD_MAX_OLD_SPACE_MB="${TIMEZONE_RUNTIME_BUILD_MAX_OLD_SPACE_MB:-1024}"

case "$BUILD_MAX_OLD_SPACE_MB" in
  ''|*[!0-9]*)
    echo "TIMEZONE_RUNTIME_BUILD_MAX_OLD_SPACE_MB must be a positive integer."
    exit 1
    ;;
esac
if [ "$BUILD_MAX_OLD_SPACE_MB" -lt 1 ]; then
  echo "TIMEZONE_RUNTIME_BUILD_MAX_OLD_SPACE_MB must be a positive integer."
  exit 1
fi

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

if command -v unzip >/dev/null 2>&1; then
  unzip -o "$ZIP_PATH" -d "$SOURCE_DIR"
else
  node - "$ZIP_PATH" "$JSON_PATH" <<'NODE'
const fs = require('node:fs');
const zlib = require('node:zlib');

const [zipPath, destination] = process.argv.slice(2);
const expectedEntry = 'combined-1970.json';
const archive = fs.readFileSync(zipPath);

function fail(message) {
  throw new Error(`Timezone ZIP extraction failed: ${message}`);
}

function safeArchivePath(name) {
  return name.length > 0
    && !name.includes('\0')
    && !name.includes('\\')
    && !name.startsWith('/')
    && !/^[A-Za-z]:/.test(name)
    && !name.split('/').some((part) => part === '' || part === '.' || part === '..');
}

let eocd = -1;
for (let offset = Math.max(0, archive.length - 0xffff - 22); offset <= archive.length - 22; offset += 1) {
  if (archive.readUInt32LE(offset) === 0x06054b50
    && offset + 22 + archive.readUInt16LE(offset + 20) === archive.length) eocd = offset;
}
if (eocd < 0) fail('end-of-central-directory record is missing');
if (archive.readUInt16LE(eocd + 4) !== 0 || archive.readUInt16LE(eocd + 6) !== 0) {
  fail('multi-disk archives are not supported');
}

const entryCount = archive.readUInt16LE(eocd + 10);
const centralDirectorySize = archive.readUInt32LE(eocd + 12);
let offset = archive.readUInt32LE(eocd + 16);
const centralDirectoryEnd = offset + centralDirectorySize;
if (centralDirectoryEnd > archive.length) fail('central directory is truncated');

let selected = null;
for (let index = 0; index < entryCount; index += 1) {
  if (offset + 46 > centralDirectoryEnd || archive.readUInt32LE(offset) !== 0x02014b50) {
    fail('central directory entry is invalid');
  }
  const flags = archive.readUInt16LE(offset + 8);
  const compression = archive.readUInt16LE(offset + 10);
  const compressedSize = archive.readUInt32LE(offset + 20);
  const uncompressedSize = archive.readUInt32LE(offset + 24);
  const nameLength = archive.readUInt16LE(offset + 28);
  const extraLength = archive.readUInt16LE(offset + 30);
  const commentLength = archive.readUInt16LE(offset + 32);
  const localHeaderOffset = archive.readUInt32LE(offset + 42);
  const entryEnd = offset + 46 + nameLength + extraLength + commentLength;
  if (entryEnd > centralDirectoryEnd || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff
    || localHeaderOffset === 0xffffffff) fail('unsupported ZIP64 archive entry');
  const name = archive.toString('utf8', offset + 46, offset + 46 + nameLength);
  if (!safeArchivePath(name)) fail('unsafe archive path');
  if (name === expectedEntry) {
    if (selected) fail('expected GeoJSON file appears more than once');
    selected = { flags, compression, compressedSize, uncompressedSize, localHeaderOffset };
  }
  offset = entryEnd;
}

if (offset !== centralDirectoryEnd) fail('central directory length is invalid');
if (!selected) fail('expected GeoJSON file is missing');
if ((selected.flags & 0x1) !== 0) fail('encrypted archive entries are not supported');
if (selected.compression !== 0 && selected.compression !== 8) fail('unsupported compression method');

const local = selected.localHeaderOffset;
if (local + 30 > archive.length || archive.readUInt32LE(local) !== 0x04034b50) {
  fail('local file header is invalid');
}
const localNameLength = archive.readUInt16LE(local + 26);
const localExtraLength = archive.readUInt16LE(local + 28);
const payloadStart = local + 30 + localNameLength + localExtraLength;
const payloadEnd = payloadStart + selected.compressedSize;
if (payloadEnd > archive.length) fail('compressed GeoJSON payload is truncated');

const compressed = archive.subarray(payloadStart, payloadEnd);
const payload = selected.compression === 0 ? Buffer.from(compressed) : zlib.inflateRawSync(compressed);
if (payload.length !== selected.uncompressedSize) fail('GeoJSON payload length is invalid');

const temporary = `${destination}.partial-${process.pid}`;
try {
  fs.writeFileSync(temporary, payload, { mode: 0o600 });
  fs.renameSync(temporary, destination);
} finally {
  fs.rmSync(temporary, { force: true });
}
NODE
fi

node --max-old-space-size="$BUILD_MAX_OLD_SPACE_MB" scripts/build-timezone-runtime-artifact.js \
  "$JSON_PATH" \
  "$RUNTIME_DIR"

echo "Timezone production runtime prepared successfully."
