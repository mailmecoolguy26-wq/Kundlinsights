'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  BirthPlaceResolutionError,
  BirthPlaceResolver,
  OfflineIanaTimezoneResolver,
  TBB_2026C_1970_MANIFEST,
} = require('../../src/place');

const datasetPath = process.env.KUNDLINSIGHTS_TZ_DATASET_PATH;
const realDatasetTest = datasetPath ? test : test.skip;

const GOLDEN_COORDINATES = Object.freeze([
  ['Hyderabad', 17.3850, 78.4867, 'Asia/Kolkata'],
  ['Ludhiana', 30.9010, 75.8573, 'Asia/Kolkata'],
  ['Delhi', 28.6139, 77.2090, 'Asia/Kolkata'],
  ['Mumbai', 19.0760, 72.8777, 'Asia/Kolkata'],
  ['Bengaluru', 12.9716, 77.5946, 'Asia/Kolkata'],
  ['London', 51.5074, -0.1278, 'Europe/London'],
  ['New York', 40.7128, -74.0060, 'America/New_York'],
  ['Los Angeles', 34.0522, -118.2437, 'America/Los_Angeles'],
  ['Sydney', -33.8688, 151.2093, 'Australia/Sydney'],
  ['Kathmandu', 27.7172, 85.3240, 'Asia/Kathmandu'],
  ['Dubai', 25.2048, 55.2708, 'Asia/Dubai'],
]);

realDatasetTest('resolves approved TBB 2026c 1970 golden coordinates and A1 integration from local geometry only', async () => {
  const resolver = new OfflineIanaTimezoneResolver({ datasetPath, manifest: TBB_2026C_1970_MANIFEST });
  assert.equal(resolver.index.length, 301);
  const results = new Map();
  for (const [name, latitude, longitude, timezone] of GOLDEN_COORDINATES) {
    const result = resolver.resolve(Object.freeze({ latitude, longitude }));
    results.set(name, result);
    assert.equal(result.timezone, timezone);
    assert.deepEqual(result.provenance, {
      provider: 'timezone-boundary-builder',
      resolver: 'offline-iana-timezone-resolver',
      ruleset: 'birth-place-timezone-resolution-v1',
      datasetFamily: '1970',
      datasetVersion: '2026c',
      datasetChecksum: TBB_2026C_1970_MANIFEST.datasetChecksum,
    });
    assert.equal(Object.isFrozen(result), true);
    assert.equal(JSON.stringify(result).includes(datasetPath), false);
    assert.deepEqual(resolver.resolve({ latitude, longitude }), result);
  }
  assert.notEqual(results.get('New York').timezone, results.get('Los Angeles').timezone);

  const placeResolver = new BirthPlaceResolver({
    placeProvider: {
      suggest: async () => [],
      resolve: async () => ({ provider: 'mapbox-geocoding', providerPlaceId: 'mock-hyderabad', latitude: 17.3850, longitude: 78.4867 }),
    },
    timezoneResolver: resolver,
  });
  const resolvedBirthPlace = await placeResolver.resolveSelection({ providerPlaceId: 'mock-hyderabad' });
  assert.equal(resolvedBirthPlace.timezone, 'Asia/Kolkata');
  assert.equal(Object.isFrozen(resolvedBirthPlace), true);
  assert.deepEqual(resolvedBirthPlace.timezoneResolver, {
    provider: 'timezone-boundary-builder',
    datasetVersion: '2026c',
    datasetChecksum: TBB_2026C_1970_MANIFEST.datasetChecksum,
  });
  assert.throws(() => new OfflineIanaTimezoneResolver({
    datasetPath,
    manifest: { ...TBB_2026C_1970_MANIFEST, geometryChecksum: '0'.repeat(64) },
  }), (error) => error instanceof BirthPlaceResolutionError && error.code === 'DATASET_CHECKSUM_MISMATCH');
  assert.throws(() => new OfflineIanaTimezoneResolver({
    datasetPath,
    manifest: { ...TBB_2026C_1970_MANIFEST, datasetFamily: 'now' },
  }), (error) => error instanceof BirthPlaceResolutionError && error.code === 'DATASET_GATED');
  assert.throws(() => new OfflineIanaTimezoneResolver({
    datasetPath,
    manifest: { ...TBB_2026C_1970_MANIFEST, datasetVersion: '2026d' },
  }), (error) => error instanceof BirthPlaceResolutionError && error.code === 'DATASET_MANIFEST_MISMATCH');
  assert.throws(() => new OfflineIanaTimezoneResolver({
    datasetPath,
    manifest: { ...TBB_2026C_1970_MANIFEST, geometryByteLength: 1 },
  }), (error) => error instanceof BirthPlaceResolutionError && error.code === 'DATASET_SIZE_MISMATCH');
});
