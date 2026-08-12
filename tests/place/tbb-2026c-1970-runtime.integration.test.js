'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  BirthPlaceResolver,
  OfflineIanaTimezoneResolver,
  TimezoneRuntimeArtifactResolver,
  TBB_2026C_1970_MANIFEST,
} = require('../../src/place');

const datasetPath = process.env.KUNDLINSIGHTS_TZ_DATASET_PATH;
const manifestPath = process.env.KUNDLINSIGHTS_TZ_RUNTIME_MANIFEST_PATH;
const binaryPath = process.env.KUNDLINSIGHTS_TZ_RUNTIME_BINARY_PATH;
const realDatasetTest = datasetPath && manifestPath && binaryPath ? test : test.skip;
const GOLDEN_COORDINATES = Object.freeze([
  ['Hyderabad', 17.3850, 78.4867, 'Asia/Kolkata'], ['Ludhiana', 30.9010, 75.8573, 'Asia/Kolkata'],
  ['Delhi', 28.6139, 77.2090, 'Asia/Kolkata'], ['Mumbai', 19.0760, 72.8777, 'Asia/Kolkata'],
  ['Bengaluru', 12.9716, 77.5946, 'Asia/Kolkata'], ['London', 51.5074, -0.1278, 'Europe/London'],
  ['New York', 40.7128, -74.0060, 'America/New_York'], ['Los Angeles', 34.0522, -118.2437, 'America/Los_Angeles'],
  ['Sydney', -33.8688, 151.2093, 'Australia/Sydney'], ['Kathmandu', 27.7172, 85.3240, 'Asia/Kathmandu'],
  ['Dubai', 25.2048, 55.2708, 'Asia/Dubai'],
]);

realDatasetTest('matches the legacy exact GeoJSON resolver for approved TBB golden locations, ocean, and A1 flow', async () => {
  const legacy = new OfflineIanaTimezoneResolver({ datasetPath, manifest: TBB_2026C_1970_MANIFEST });
  const optimized = new TimezoneRuntimeArtifactResolver({ manifestPath, binaryPath });
  const results = new Map();
  for (const [name, latitude, longitude, expected] of GOLDEN_COORDINATES) {
    const input = Object.freeze({ latitude, longitude });
    const legacyResult = legacy.resolve(input);
    const optimizedResult = optimized.resolve(input);
    assert.equal(legacyResult.timezone, expected);
    assert.equal(optimizedResult.timezone, legacyResult.timezone);
    assert.equal(optimizedResult.provenance.datasetVersion, '2026c');
    assert.equal(optimizedResult.provenance.datasetChecksum, TBB_2026C_1970_MANIFEST.datasetChecksum);
    assert.equal(JSON.stringify(optimizedResult).includes(binaryPath), false);
    results.set(name, optimizedResult.timezone);
  }
  assert.notEqual(results.get('New York'), results.get('Los Angeles'));
  for (const resolver of [legacy, optimized]) {
    assert.throws(() => resolver.resolve({ latitude: 0, longitude: 0 }), error => error.code === 'UNRESOLVED_TIMEZONE');
  }
  const birthPlaceResolver = new BirthPlaceResolver({
    placeProvider: { suggest: async () => [], resolve: async () => ({ provider: 'mapbox-geocoding', providerPlaceId: 'mock-hyderabad', latitude: 17.385, longitude: 78.4867 }) },
    timezoneResolver: optimized,
  });
  const resolved = await birthPlaceResolver.resolveSelection({ providerPlaceId: 'mock-hyderabad' });
  assert.equal(resolved.timezone, 'Asia/Kolkata');
  assert.deepEqual(resolved.timezoneResolver, {
    provider: 'timezone-boundary-builder', datasetVersion: '2026c', datasetChecksum: TBB_2026C_1970_MANIFEST.datasetChecksum,
  });
  optimized.close();
});
