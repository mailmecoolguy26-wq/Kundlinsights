'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { BirthCareerReadingOrchestrator } = require('../../src/orchestration');
const { createResolvedBirthPlace } = require('../../src/place');
const { deepFreeze } = require('../../src/astronomy');
const { createReadingRecord, canonicalSerialize, sha256 } = require('../../src/readings');

const BIRTH = '1990-11-26T08:10:00.000Z'; const READING = '2026-08-12T00:00:00.000Z'; const DAY = 86400000;
const LONGITUDES = Object.freeze({ Sun: 220.07412509999472, Moon: 319.51986976098, Mars: 180.3, Mercury: 210.4, Jupiter: 275.5, Venus: 300.6, Saturn: 225.7, Rahu: 90.8, Ketu: 270.8, Ascendant: 330.9 });
const place = deepFreeze(createResolvedBirthPlace({ provider: 'mapbox-geocoding', providerPlaceId: 'record-hyd', latitude: 17.385, longitude: 78.4867, timezone: 'Asia/Kolkata', timezoneResolver: { provider: 'timezone-boundary-builder', datasetVersion: '2026c', datasetChecksum: 'c1bd0839c15a94ace5107e84694915fca3ab74907dee7b2ed4e3e5e01acc8f16' } }));
const canonical = value => ((value % 360) + 360) % 360;
function engine() { const bodies = deepFreeze(Object.fromEntries(Object.entries(LONGITUDES).map(([body, siderealLongitudeDegrees]) => [body, deepFreeze({ body, siderealLongitudeDegrees, tropicalLongitudeDegrees: null, longitudeSpeedDegreesPerDay: body === 'Ascendant' ? null : 1, motion: body === 'Ascendant' ? null : 'direct', siderealMetadata: deepFreeze({ siderealMode: 'SE_SIDM_LAHIRI', calculationStatus: 'LICENSE_GATED_VALIDATION' }), provenance: deepFreeze({ coordinateProvenance: 'provider-native' }) })]))); return { calculate(input) { const utc = input.timezone === 'UTC' ? `${input.date}T${input.time}Z` : BIRTH; return deepFreeze({ bodies, instant: deepFreeze({ utc, unixMilliseconds: Date.parse(utc) }), sidereal: deepFreeze({ siderealMode: 'SE_SIDM_LAHIRI' }), provider: deepFreeze({ providerId: 'synthetic-reading-record', swissVersion: 'test', calculationStatus: 'LICENSE_GATED_VALIDATION', siderealMode: 'SE_SIDM_LAHIRI', nodeModel: 'MEAN_NODE', productionLicenseGate: false }) }); } }; }
function sampler() { return deepFreeze({ sampleCanonicalSiderealSun({ instantUtc }) { return deepFreeze({ canonicalSiderealLongitudeDegrees: canonical(LONGITUDES.Sun + (Date.parse(instantUtc) - Date.parse(BIRTH)) * 360 / (365 * DAY)), provenance: deepFreeze({ providerId: 'synthetic-reading-record', swissVersion: 'test', calculationStatus: 'LICENSE_GATED_VALIDATION', siderealMode: 'SE_SIDM_LAHIRI', coordinateProvenance: 'provider-native', productionAuthority: false, localPath: '/private/no-leak' }) }); } }); }
function recordInput(display = 'Hyderabad') { return { birth: { localDate: '1990-11-26', localTime: '13:40:00', timezone: 'Asia/Kolkata', utc: BIRTH, latitude: 17.385, longitude: 78.4867, placeResolution: { resolutionVersion: place.resolutionVersion, timezoneResolver: place.timezoneResolver }, display: { label: display } }, readingInstant: READING, transitScanRange: null, locale: 'en-IN' }; }
function result() { return new BirthCareerReadingOrchestrator({ astronomicalEngine: engine(), canonicalSiderealSunSampler: sampler() }).generate({ birth: { date: '1990-11-26', time: '13:40:00', place }, readingInstant: READING, locale: 'en-IN' }); }

test('builds an immutable, minimal v2 record with separate calculation and output digests', () => {
  const input = deepFreeze(recordInput()); const output = result();
  const record = createReadingRecord({ readingId: 'reading_0001', createdAt: '2026-08-12T00:00:00Z', input, result: output });
  assert.equal(record.engineProfileId, 'kundlinsights-vedic-engine-profile-v2');
  assert.equal(record.provenance.dasha.dashaRulesetId, 'vimshottari-longitude-proportional-solar-return-v1');
  assert.equal(record.provenance.dasha.solarReturnSolverId, 'solar-return-lahiri-bisection-v1');
  assert.equal(Object.isFrozen(record), true); assert.equal(Object.isFrozen(record.input.birth), true); assert.equal(Object.isFrozen(record.integrity), true);
  assert.equal(JSON.stringify(record).includes('/private/'), false);
  assert.equal(JSON.stringify(record).includes('siderealLongitudeDegrees'), false);
});

test('calculation identity excludes record identity, created time, display metadata, and renderer presentation', () => {
  const output = result();
  const first = createReadingRecord({ readingId: 'reading_0001', createdAt: '2026-08-12T00:00:00.000Z', input: recordInput('Hyderabad'), result: output });
  const second = createReadingRecord({ readingId: 'reading_0002', createdAt: '2026-08-13T00:00:00.000Z', input: recordInput('Hyderabad, India'), result: output });
  assert.equal(first.integrity.calculation.digest, second.integrity.calculation.digest);
  const changed = recordInput(); changed.birth.latitude = 17.386;
  const changedRecord = createReadingRecord({ readingId: 'reading_0003', createdAt: '2026-08-12T00:00:00.000Z', input: changed, result: output });
  assert.notEqual(first.integrity.calculation.digest, changedRecord.integrity.calculation.digest);
  assert.notEqual(first.integrity.output.digest, first.integrity.rendered.digest);
});

test('canonical serialization is deterministic and fails closed for invalid values and cycles', () => {
  assert.equal(canonicalSerialize({ b: 2, a: ['x', null] }), '{"a":["x",null],"b":2}');
  assert.equal(sha256({ a: 1, b: 2 }), sha256({ b: 2, a: 1 }));
  assert.throws(() => canonicalSerialize({ value: undefined }), /UNSUPPORTED_CANONICAL_VALUE/);
  const cyclic = {}; cyclic.self = cyclic;
  assert.throws(() => canonicalSerialize(cyclic), /CYCLIC_CANONICAL_VALUE/);
});
