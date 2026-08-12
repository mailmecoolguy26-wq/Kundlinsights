'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { BirthPlaceResolutionError } = require('./errors');
const { validZone, freeze } = require('./resolved-birth-place');
const { ringState } = require('./offline-iana-timezone-resolver');

const FORMAT = 'kundlinsights-tbb-binary-v1';
const BUILD_RULESET = 'timezone-runtime-artifact-build-v1';
const RULESET = 'birth-place-timezone-resolution-v1';
const CHUNK_SIZE = 64 * 1024;

function fail(code, message) {
  throw new BirthPlaceResolutionError(code, message);
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const descriptor = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(CHUNK_SIZE);
  try {
    for (let read; (read = fs.readSync(descriptor, buffer, 0, buffer.length, null));) {
      hash.update(buffer.subarray(0, read));
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest('hex');
}

function validBbox(bbox) {
  return Array.isArray(bbox) && bbox.length === 4
    && bbox.every(Number.isFinite)
    && bbox[0] <= bbox[2] && bbox[1] <= bbox[3];
}

function validateManifest(manifest, binaryPath) {
  if (!manifest || manifest.formatId !== FORMAT || manifest.buildRuleset !== BUILD_RULESET
    || !manifest.source || manifest.source.provider !== 'timezone-boundary-builder'
    || manifest.source.family !== '1970' || manifest.source.version !== '2026c'
    || !Array.isArray(manifest.features) || !manifest.binary) {
    fail('DATASET_GATED', 'An approved Time Zone Boundary Builder runtime manifest is required.');
  }
  if (path.basename(binaryPath) !== manifest.binary.fileName) {
    fail('DATASET_MANIFEST_MISMATCH', 'Binary filename differs from the runtime manifest.');
  }
  if (!Number.isSafeInteger(manifest.binary.byteLength) || manifest.binary.byteLength < 1) {
    fail('INVALID_DATASET', 'Runtime binary length is invalid.');
  }
  if (typeof manifest.binary.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(manifest.binary.sha256)) {
    fail('INVALID_DATASET', 'Runtime binary checksum is invalid.');
  }
  const binaryStat = fs.statSync(binaryPath);
  if (binaryStat.size !== manifest.binary.byteLength) {
    fail('DATASET_SIZE_MISMATCH', 'Binary byte length differs from the runtime manifest.');
  }
  if (sha256File(binaryPath) !== manifest.binary.sha256) {
    fail('DATASET_CHECKSUM_MISMATCH', 'Binary checksum differs from the runtime manifest.');
  }
  const seenTimezones = new Set();
  for (const feature of manifest.features) {
    if (!feature || !validZone(feature.tzid) || seenTimezones.has(feature.tzid)
      || !validBbox(feature.bbox) || !Number.isSafeInteger(feature.byteOffset)
      || !Number.isSafeInteger(feature.byteLength) || feature.byteOffset < 0 || feature.byteLength < 4
      || feature.byteOffset + feature.byteLength > binaryStat.size) {
      fail('INVALID_DATASET', 'Runtime feature index is invalid.');
    }
    seenTimezones.add(feature.tzid);
  }
  return freeze(manifest);
}

function decodeGeometry(buffer) {
  let offset = 0;
  const readUint32 = () => {
    if (offset + 4 > buffer.length) fail('INVALID_DATASET_GEOMETRY', 'Truncated binary geometry.');
    const value = buffer.readUInt32LE(offset);
    offset += 4;
    return value;
  };
  const readFloat64 = () => {
    if (offset + 8 > buffer.length) fail('INVALID_DATASET_GEOMETRY', 'Truncated binary geometry.');
    const value = buffer.readDoubleLE(offset);
    offset += 8;
    return value;
  };
  const polygons = [];
  const polygonCount = readUint32();
  for (let polygonIndex = 0; polygonIndex < polygonCount; polygonIndex += 1) {
    const rings = [];
    const ringCount = readUint32();
    if (ringCount < 1) fail('INVALID_DATASET_GEOMETRY', 'A polygon must have an outer ring.');
    for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
      const points = [];
      const pointCount = readUint32();
      if (pointCount < 4) fail('INVALID_DATASET_GEOMETRY', 'A ring must contain at least four points.');
      for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
        const longitude = readFloat64();
        const latitude = readFloat64();
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
          fail('INVALID_DATASET_GEOMETRY', 'Binary geometry contains a non-finite coordinate.');
        }
        points.push([longitude, latitude]);
      }
      rings.push(points);
    }
    polygons.push(rings);
  }
  if (offset !== buffer.length) fail('INVALID_DATASET_GEOMETRY', 'Invalid binary geometry length.');
  return polygons;
}

function geometryState(point, polygons) {
  let found = false;
  for (const polygon of polygons) {
    const outerState = ringState(point, polygon[0]);
    if (outerState === 'boundary') return outerState;
    if (outerState !== 'inside') continue;
    let inHole = false;
    for (const hole of polygon.slice(1)) {
      const holeState = ringState(point, hole);
      if (holeState === 'boundary') return holeState;
      if (holeState === 'inside') inHole = true;
    }
    if (!inHole) found = true;
  }
  return found ? 'inside' : 'outside';
}

function binaryRingState(point, buffer, ringOffset, pointCount) {
  const coordinateAt = index => {
    const offset = ringOffset + index * 16;
    if (offset + 16 > buffer.length) fail('INVALID_DATASET_GEOMETRY', 'Truncated binary geometry.');
    const longitude = buffer.readDoubleLE(offset);
    const latitude = buffer.readDoubleLE(offset + 8);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      fail('INVALID_DATASET_GEOMETRY', 'Binary geometry contains a non-finite coordinate.');
    }
    return [longitude, latitude];
  };
  const [x, y] = point;
  let inside = false;
  let [endX, endY] = coordinateAt(pointCount - 1);
  for (let index = 0; index < pointCount; index += 1) {
    const [startX, startY] = coordinateAt(index);
    const crosses = (startY > y) !== (endY > y)
      && x < (endX - startX) * (y - startY) / (endY - startY) + startX;
    if ((x - startX) * (endY - startY) === (y - startY) * (endX - startX)
      && x >= Math.min(startX, endX) && x <= Math.max(startX, endX)
      && y >= Math.min(startY, endY) && y <= Math.max(startY, endY)) {
      return 'boundary';
    }
    if (crosses) inside = !inside;
    endX = startX;
    endY = startY;
  }
  return inside ? 'inside' : 'outside';
}

function binaryGeometryState(point, buffer) {
  let offset = 0;
  const readUint32 = () => {
    if (offset + 4 > buffer.length) fail('INVALID_DATASET_GEOMETRY', 'Truncated binary geometry.');
    const value = buffer.readUInt32LE(offset);
    offset += 4;
    return value;
  };
  let found = false;
  const polygonCount = readUint32();
  for (let polygonIndex = 0; polygonIndex < polygonCount; polygonIndex += 1) {
    const ringCount = readUint32();
    if (ringCount < 1) fail('INVALID_DATASET_GEOMETRY', 'A polygon must have an outer ring.');
    let polygonInside = false;
    for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
      const pointCount = readUint32();
      if (pointCount < 4 || offset + pointCount * 16 > buffer.length) {
        fail('INVALID_DATASET_GEOMETRY', 'Invalid binary ring geometry.');
      }
      const ringState = binaryRingState(point, buffer, offset, pointCount);
      offset += pointCount * 16;
      if (ringState === 'boundary') return 'boundary';
      if (ringIndex === 0) polygonInside = ringState === 'inside';
      else if (ringState === 'inside') polygonInside = false;
    }
    if (polygonInside) found = true;
  }
  if (offset !== buffer.length) fail('INVALID_DATASET_GEOMETRY', 'Invalid binary geometry length.');
  return found ? 'inside' : 'outside';
}

function validateCoordinate(value, minimum, maximum, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    fail('INVALID_COORDINATES', `${name} must be finite and in range.`);
  }
}

class TimezoneRuntimeArtifactResolver {
  constructor({ manifestPath, binaryPath } = {}) {
    if (typeof manifestPath !== 'string' || typeof binaryPath !== 'string') {
      fail('DATASET_GATED', 'Runtime manifest and binary paths are required.');
    }
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath));
    } catch {
      fail('INVALID_DATASET', 'Runtime manifest is not valid JSON.');
    }
    this.manifest = validateManifest(manifest, binaryPath);
    this.descriptor = fs.openSync(binaryPath, 'r');
    Object.freeze(this);
  }

  resolve({ latitude, longitude } = {}) {
    validateCoordinate(latitude, -90, 90, 'latitude');
    validateCoordinate(longitude, -180, 180, 'longitude');
    const matches = [];
    for (const feature of this.manifest.features) {
      const [minimumLongitude, minimumLatitude, maximumLongitude, maximumLatitude] = feature.bbox;
      if (longitude < minimumLongitude || longitude > maximumLongitude
        || latitude < minimumLatitude || latitude > maximumLatitude) continue;
      const buffer = Buffer.allocUnsafe(feature.byteLength);
      const bytesRead = fs.readSync(this.descriptor, buffer, 0, buffer.length, feature.byteOffset);
      if (bytesRead !== buffer.length) fail('INVALID_DATASET', 'Unable to range-read binary geometry.');
      const state = binaryGeometryState([longitude, latitude], buffer);
      if (state === 'boundary') {
        fail('AMBIGUOUS_TIMEZONE_BOUNDARY', 'Coordinate lies on a timezone boundary.');
      }
      if (state === 'inside') matches.push(feature);
    }
    if (matches.length !== 1) {
      fail(matches.length ? 'AMBIGUOUS_TIMEZONE' : 'UNRESOLVED_TIMEZONE', 'Timezone geometry did not uniquely resolve the coordinate.');
    }
    return freeze({
      timezone: matches[0].tzid,
      provenance: {
        provider: 'timezone-boundary-builder',
        resolver: 'timezone-runtime-artifact-resolver',
        ruleset: RULESET,
        datasetFamily: '1970',
        datasetVersion: '2026c',
        datasetChecksum: this.manifest.source.sourceZipSha256,
        runtimeFormat: FORMAT,
        runtimeArtifactChecksum: this.manifest.binary.sha256,
      },
    });
  }

  close() {
    fs.closeSync(this.descriptor);
  }
}

module.exports = { TimezoneRuntimeArtifactResolver, FORMAT, BUILD_RULESET, decodeGeometry, geometryState, binaryGeometryState };
