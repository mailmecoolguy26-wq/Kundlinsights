'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { BirthCareerReadingOrchestrator } = require('../../src/orchestration');
const { createResolvedBirthPlace } = require('../../src/place');
const { deepFreeze } = require('../../src/astronomy');
const { createReadingRecord, replayPersistedReading } = require('../../src/readings');

const BIRTH = '1990-11-26T08:10:00.000Z'; const READING = '2026-08-12T00:00:00.000Z'; const DAY = 86400000;
const SAVANA = 'vimshottari-longitude-proportional-savana-360-v1'; const SOLAR = 'vimshottari-longitude-proportional-solar-return-v1';
const L = Object.freeze({ Sun: 220.07412509999472, Moon: 319.51986976098, Mars: 180.3, Mercury: 210.4, Jupiter: 275.5, Venus: 300.6, Saturn: 225.7, Rahu: 90.8, Ketu: 270.8, Ascendant: 330.9 });
const place = deepFreeze(createResolvedBirthPlace({ provider: 'mapbox-geocoding', providerPlaceId: 'replay-hyd', latitude: 17.385, longitude: 78.4867, timezone: 'Asia/Kolkata', timezoneResolver: { provider: 'timezone-boundary-builder', datasetVersion: '2026c', datasetChecksum: 'c1bd0839c15a94ace5107e84694915fca3ab74907dee7b2ed4e3e5e01acc8f16' } }));
const canonical = value => ((value % 360) + 360) % 360;
function engine(providerId = 'synthetic-replay') { const bodies = deepFreeze(Object.fromEntries(Object.entries(L).map(([body, siderealLongitudeDegrees]) => [body, deepFreeze({ body, siderealLongitudeDegrees, tropicalLongitudeDegrees: null, longitudeSpeedDegreesPerDay: body === 'Ascendant' ? null : 1, motion: body === 'Ascendant' ? null : 'direct', siderealMetadata: deepFreeze({ siderealMode: 'SE_SIDM_LAHIRI', calculationStatus: 'LICENSE_GATED_VALIDATION' }), provenance: deepFreeze({ coordinateProvenance: 'provider-native' }) })]))); return { calculate(input) { const utc = input.timezone === 'UTC' ? `${input.date}T${input.time}Z` : BIRTH; return deepFreeze({ bodies, instant: deepFreeze({ utc, unixMilliseconds: Date.parse(utc) }), sidereal: deepFreeze({ siderealMode: 'SE_SIDM_LAHIRI' }), provider: deepFreeze({ providerId, swissVersion: 'test', calculationStatus: 'LICENSE_GATED_VALIDATION', siderealMode: 'SE_SIDM_LAHIRI', nodeModel: 'MEAN_NODE', productionLicenseGate: false }) }); } }; }
function sampler() { return deepFreeze({ sampleCanonicalSiderealSun({ instantUtc }) { return deepFreeze({ canonicalSiderealLongitudeDegrees: canonical(L.Sun + (Date.parse(instantUtc) - Date.parse(BIRTH)) * 360 / (365 * DAY)), provenance: deepFreeze({ providerId: 'synthetic-replay', swissVersion: 'test', calculationStatus: 'LICENSE_GATED_VALIDATION', siderealMode: 'SE_SIDM_LAHIRI', coordinateProvenance: 'provider-native', productionAuthority: false }) }); } }); }
function input() { return { birth: { localDate: '1990-11-26', localTime: '13:40:00', timezone: 'Asia/Kolkata', utc: BIRTH, latitude: 17.385, longitude: 78.4867, placeResolution: { resolutionVersion: place.resolutionVersion, timezoneResolver: place.timezoneResolver }, display: { label: 'Hyderabad' } }, readingInstant: READING, transitScanRange: null, locale: 'en-IN' }; }
function record(ruleset = SOLAR) { const result = new BirthCareerReadingOrchestrator({ astronomicalEngine: engine(), dashaRulesetId: ruleset, ...(ruleset === SOLAR ? { canonicalSiderealSunSampler: sampler() } : {}) }).generate({ birth: { date: '1990-11-26', time: '13:40:00', place }, readingInstant: READING, locale: 'en-IN' }); return createReadingRecord({ readingId: ruleset === SOLAR ? 'solar_reading_001' : 'savana_reading_001', createdAt: READING, input: input(), result }); }
function runtime(options = {}) { return { astronomicalEngine: engine(options.providerId), ...(options.sampler === false ? {} : { canonicalSiderealSunSampler: sampler() }), ...(options.timezoneConverter ? { timezoneConverter: options.timezoneConverter } : {}) }; }

test('replays v1 Savana without a Solar sampler and v2 Solar with a sampler, independent of the current default', () => {
  const savana = replayPersistedReading({ record: record(SAVANA), astronomicalRuntime: runtime({ sampler: false }) });
  const solar = replayPersistedReading({ record: record(SOLAR), astronomicalRuntime: runtime() });
  assert.equal(savana.verification.engineProfileId, 'kundlinsights-vedic-engine-profile-v1');
  assert.equal(solar.verification.engineProfileId, 'kundlinsights-vedic-engine-profile-v2');
  assert.equal(savana.result.provenance.dashaRulesetId, SAVANA);
  assert.equal(solar.result.provenance.dashaRulesetId, SOLAR);
  assert.equal(savana.verification.networkAccess, 'not-performed');
  assert.equal(solar.verification.geocoding, 'not-performed');
  assert.equal(Object.isFrozen(solar), true);
});

test('fails closed for unknown/missing profile, missing Solar sampler, timezone drift, and provider mismatch', () => {
  const solar = record(SOLAR);
  assert.throws(() => replayPersistedReading({ record: { ...solar, engineProfileId: 'unknown' }, astronomicalRuntime: runtime() }), e => e.code === 'UNKNOWN_REPLAY_ENGINE_PROFILE');
  assert.throws(() => replayPersistedReading({ record: { ...solar, engineProfileId: null }, astronomicalRuntime: runtime() }), e => e.code === 'MISSING_REPLAY_ENGINE_PROFILE');
  assert.throws(() => replayPersistedReading({ record: solar, astronomicalRuntime: runtime({ sampler: false }) }), e => e.code === 'MISSING_REPLAY_SOLAR_DASHA_SAMPLER');
  assert.throws(() => replayPersistedReading({ record: solar, astronomicalRuntime: runtime({ timezoneConverter: () => '1990-11-26T08:11:00.000Z' }) }), e => e.code === 'TIMEZONE_REPLAY_DRIFT');
  assert.throws(() => replayPersistedReading({ record: solar, astronomicalRuntime: runtime({ providerId: 'different-provider' }) }), e => e.code === 'REPLAY_PROVIDER_INCOMPATIBLE');
});

test('never infers a legacy profile from incomplete historical records', () => {
  const legacy = record(SAVANA);
  assert.throws(() => replayPersistedReading({ record: { ...legacy, engineProfileId: undefined }, astronomicalRuntime: runtime({ sampler: false }) }), e => e.code === 'MISSING_REPLAY_ENGINE_PROFILE');
});
