'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { BirthPlaceResolutionError } = require('./errors');
const { validZone, freeze } = require('./resolved-birth-place');

const RULESET = 'birth-place-timezone-resolution-v1';

function validateNumber(value, minimum, maximum, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new BirthPlaceResolutionError('INVALID_COORDINATES', `${name} must be finite and in range.`);
  }
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function validateOptionalPositiveInteger(value, name) {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 1)) {
    throw new BirthPlaceResolutionError('DATASET_GATED', `${name} must be a positive integer when supplied.`);
  }
}

function validateManifest(input) {
  if (!input
    || input.sourceStatus !== 'APPROVED_OFFLINE_DATASET'
    || input.datasetProvider !== 'timezone-boundary-builder'
    || input.datasetFamily !== '1970'
    || typeof input.datasetVersion !== 'string' || !input.datasetVersion
    || !isSha256(input.datasetChecksum)
    || input.geometryFormat !== 'GeoJSON') {
    throw new BirthPlaceResolutionError('DATASET_GATED', 'An approved Time Zone Boundary Builder 1970 manifest is required.');
  }

  for (const field of ['artifactChecksum', 'geometryChecksum']) {
    if (input[field] !== undefined && !isSha256(input[field])) {
      throw new BirthPlaceResolutionError('DATASET_GATED', `${field} must be a SHA-256 value when supplied.`);
    }
  }
  for (const field of ['artifactFileName', 'extractedGeometryFileName', 'sourceReleaseId']) {
    if (input[field] !== undefined && (typeof input[field] !== 'string' || !input[field])) {
      throw new BirthPlaceResolutionError('DATASET_GATED', `${field} must be a non-empty string when supplied.`);
    }
  }
  validateOptionalPositiveInteger(input.artifactByteLength, 'artifactByteLength');
  validateOptionalPositiveInteger(input.geometryByteLength, 'geometryByteLength');
  if (input.artifactChecksum !== undefined && input.artifactChecksum !== input.datasetChecksum) {
    throw new BirthPlaceResolutionError('DATASET_MANIFEST_MISMATCH', 'Artifact checksum differs from dataset provenance.');
  }
  if (input.sourceReleaseId !== undefined && input.sourceReleaseId !== input.datasetVersion) {
    throw new BirthPlaceResolutionError('DATASET_MANIFEST_MISMATCH', 'Source release differs from dataset version.');
  }
  return freeze({ ...input });
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function loadDataset(datasetPath, manifest) {
  if (!datasetPath) {
    throw new BirthPlaceResolutionError('DATASET_GATED', 'No approved timezone dataset is configured.');
  }
  if (manifest.extractedGeometryFileName && path.basename(datasetPath) !== manifest.extractedGeometryFileName) {
    throw new BirthPlaceResolutionError('DATASET_MANIFEST_MISMATCH', 'Configured timezone geometry filename differs from the manifest.');
  }
  const data = fs.readFileSync(datasetPath);
  if (manifest.geometryByteLength !== undefined && data.length !== manifest.geometryByteLength) {
    throw new BirthPlaceResolutionError('DATASET_SIZE_MISMATCH', 'Timezone geometry byte length differs from the manifest.');
  }
  const expectedChecksum = manifest.geometryChecksum || manifest.datasetChecksum;
  if (sha256(data) !== expectedChecksum) {
    throw new BirthPlaceResolutionError('DATASET_CHECKSUM_MISMATCH', 'Timezone geometry checksum differs from the manifest.');
  }
  try {
    return JSON.parse(data);
  } catch {
    throw new BirthPlaceResolutionError('INVALID_DATASET', 'Timezone dataset is not valid JSON.');
  }
}

function ringState([x, y], ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [startX, startY] = ring[index];
    const [endX, endY] = ring[previous];
    const crosses = (startY > y) !== (endY > y)
      && x < (endX - startX) * (y - startY) / (endY - startY) + startX;
    if ((x - startX) * (endY - startY) === (y - startY) * (endX - startX)
      && x >= Math.min(startX, endX) && x <= Math.max(startX, endX)
      && y >= Math.min(startY, endY) && y <= Math.max(startY, endY)) {
      return 'boundary';
    }
    if (crosses) inside = !inside;
  }
  return inside ? 'inside' : 'outside';
}

function polygonState(point, polygon) {
  const outer = ringState(point, polygon[0]);
  if (outer !== 'inside') return outer;
  for (const hole of polygon.slice(1)) {
    const state = ringState(point, hole);
    if (state === 'boundary') return state;
    if (state === 'inside') return 'outside';
  }
  return 'inside';
}

function geometryState(point, geometry) {
  const polygons = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.type === 'MultiPolygon' ? geometry.coordinates : null;
  if (!polygons) {
    throw new BirthPlaceResolutionError('INVALID_DATASET_GEOMETRY', 'Only Polygon and MultiPolygon are supported.');
  }
  let found = false;
  for (const polygon of polygons) {
    const state = polygonState(point, polygon);
    if (state === 'boundary') return state;
    if (state === 'inside') found = true;
  }
  return found ? 'inside' : 'outside';
}

function boundingBox(geometry) {
  const points = (geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat()).flat();
  return points.reduce((box, [x, y]) => ({
    minX: Math.min(box.minX, x), maxX: Math.max(box.maxX, x),
    minY: Math.min(box.minY, y), maxY: Math.max(box.maxY, y),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
}

class OfflineIanaTimezoneResolver {
  constructor({ dataset, manifest: manifestInput, datasetPath } = {}) {
    this.manifest = validateManifest(manifestInput);
    const raw = dataset || loadDataset(datasetPath, this.manifest);
    if (!raw || raw.type !== 'FeatureCollection' || !Array.isArray(raw.features)) {
      throw new BirthPlaceResolutionError('INVALID_DATASET', 'GeoJSON FeatureCollection features are required.');
    }
    this.index = freeze(raw.features.map((feature) => {
      const timezone = feature.properties && feature.properties.tzid;
      if (!validZone(timezone)) {
        throw new BirthPlaceResolutionError('INVALID_IANA_TIMEZONE', 'Dataset feature has invalid IANA timezone.');
      }
      const geometry = dataset ? structuredClone(feature.geometry) : feature.geometry;
      return freeze({ timezone, geometry, bbox: boundingBox(geometry) });
    }));
    Object.freeze(this);
  }

  resolve({ latitude, longitude } = {}) {
    validateNumber(latitude, -90, 90, 'latitude');
    validateNumber(longitude, -180, 180, 'longitude');
    const matches = [];
    for (const entry of this.index) {
      const box = entry.bbox;
      if (longitude < box.minX || longitude > box.maxX || latitude < box.minY || latitude > box.maxY) continue;
      const state = geometryState([longitude, latitude], entry.geometry);
      if (state === 'boundary') {
        throw new BirthPlaceResolutionError('AMBIGUOUS_TIMEZONE_BOUNDARY', 'Coordinate lies on a timezone boundary.');
      }
      if (state === 'inside') matches.push(entry);
    }
    if (matches.length !== 1) {
      throw new BirthPlaceResolutionError(matches.length ? 'AMBIGUOUS_TIMEZONE' : 'UNRESOLVED_TIMEZONE', 'Timezone geometry did not uniquely resolve the coordinate.');
    }
    return freeze({
      timezone: matches[0].timezone,
      provenance: {
        provider: this.manifest.datasetProvider,
        resolver: 'offline-iana-timezone-resolver',
        ruleset: RULESET,
        datasetFamily: this.manifest.datasetFamily,
        datasetVersion: this.manifest.datasetVersion,
        datasetChecksum: this.manifest.datasetChecksum,
      },
    });
  }
}

module.exports = { OfflineIanaTimezoneResolver, geometryState, ringState };
