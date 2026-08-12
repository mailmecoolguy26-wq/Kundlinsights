'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE_GEOMETRY_SHA256 = '3ccc7784a2ec07b132db7e27e837a156bc7e100ab93d9fa062bd74f79f9a40bb';
const SOURCE_GEOMETRY_BYTES = 149581087;
const SOURCE_ZIP_SHA256 = 'c1bd0839c15a94ace5107e84694915fca3ab74907dee7b2ed4e3e5e01acc8f16';
const FORMAT = 'kundlinsights-tbb-binary-v1';
const BUILD_RULESET = 'timezone-runtime-artifact-build-v1';
const BINARY_FILE_NAME = 'tbb-2026c-1970.bin';
const MANIFEST_FILE_NAME = 'tbb-2026c-1970.manifest.json';

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function polygonsFor(geometry) {
  if (geometry && geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry && geometry.type === 'MultiPolygon') return geometry.coordinates;
  throw new Error('Only Polygon and MultiPolygon geometries are supported.');
}

function encodeGeometry(polygons) {
  let size = 4;
  for (const polygon of polygons) {
    size += 4;
    for (const ring of polygon) size += 4 + ring.length * 16;
  }
  const buffer = Buffer.allocUnsafe(size);
  let offset = 0;
  buffer.writeUInt32LE(polygons.length, offset); offset += 4;
  for (const polygon of polygons) {
    buffer.writeUInt32LE(polygon.length, offset); offset += 4;
    for (const ring of polygon) {
      buffer.writeUInt32LE(ring.length, offset); offset += 4;
      for (const [longitude, latitude] of ring) {
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) throw new Error('Coordinates must be finite Float64 values.');
        buffer.writeDoubleLE(longitude, offset); offset += 8;
        buffer.writeDoubleLE(latitude, offset); offset += 8;
      }
    }
  }
  return buffer;
}

function bboxFor(polygons) {
  const bbox = [Infinity, Infinity, -Infinity, -Infinity];
  for (const polygon of polygons) for (const ring of polygon) for (const [longitude, latitude] of ring) {
    bbox[0] = Math.min(bbox[0], longitude); bbox[1] = Math.min(bbox[1], latitude);
    bbox[2] = Math.max(bbox[2], longitude); bbox[3] = Math.max(bbox[3], latitude);
  }
  if (!bbox.every(Number.isFinite)) throw new Error('Geometry contains no coordinates.');
  return bbox;
}

function buildRuntimeArtifact({ sourcePath, outputDirectory }) {
  const source = fs.readFileSync(sourcePath);
  if (source.length !== SOURCE_GEOMETRY_BYTES || sha256(source) !== SOURCE_GEOMETRY_SHA256) {
    throw new Error('Source geometry does not match the approved TBB 2026c/1970 source.');
  }
  if (fs.existsSync(outputDirectory)) throw new Error('Output directory already exists.');
  const collection = JSON.parse(source);
  if (collection.type !== 'FeatureCollection' || !Array.isArray(collection.features) || collection.features.length !== 301) {
    throw new Error('Expected the approved 301-feature TBB 2026c/1970 FeatureCollection.');
  }
  const features = [];
  const chunks = [];
  let byteOffset = 0;
  const names = new Set();
  for (const feature of [...collection.features].sort((left, right) => left.properties.tzid.localeCompare(right.properties.tzid))) {
    const tzid = feature.properties && feature.properties.tzid;
    if (typeof tzid !== 'string' || !tzid || names.has(tzid)) throw new Error('Every source feature must have a unique tzid.');
    names.add(tzid);
    const geometry = encodeGeometry(polygonsFor(feature.geometry));
    features.push({ tzid, bbox: bboxFor(polygonsFor(feature.geometry)), byteOffset, byteLength: geometry.length });
    chunks.push(geometry);
    byteOffset += geometry.length;
  }
  fs.mkdirSync(outputDirectory, { recursive: true });
  const binaryPath = path.join(outputDirectory, BINARY_FILE_NAME);
  fs.writeFileSync(binaryPath, Buffer.concat(chunks));
  const binary = fs.readFileSync(binaryPath);
  const manifest = {
    formatId: FORMAT,
    buildRuleset: BUILD_RULESET,
    source: {
      provider: 'timezone-boundary-builder', family: '1970', version: '2026c',
      sourceZipSha256: SOURCE_ZIP_SHA256, sourceGeometrySha256: SOURCE_GEOMETRY_SHA256,
    },
    binary: { fileName: BINARY_FILE_NAME, byteLength, sha256: sha256(binary) },
    features,
  };
  fs.writeFileSync(path.join(outputDirectory, MANIFEST_FILE_NAME), `${JSON.stringify(manifest, null, 2)}\n`);
  return Object.freeze({ binaryPath, manifestPath: path.join(outputDirectory, MANIFEST_FILE_NAME), manifest });
}

if (require.main === module) {
  const [sourcePath, outputDirectory] = process.argv.slice(2);
  if (!sourcePath || !outputDirectory) throw new Error('Usage: node scripts/build-timezone-runtime-artifact.js <source-json> <external-output-directory>');
  buildRuntimeArtifact({ sourcePath, outputDirectory });
}

module.exports = { buildRuntimeArtifact, encodeGeometry, polygonsFor, bboxFor, FORMAT, BUILD_RULESET };
