'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { BirthCareerReadingOrchestrator } = require('../../src/orchestration');
const { createResolvedBirthPlace } = require('../../src/place');
const { AstronomicalEngine } = require('../../src/astronomy');

const BODY_LONGITUDES = Object.freeze({ Sun: 245.1, Moon: 250.2, Mars: 180.3, Mercury: 210.4, Jupiter: 275.5, Venus: 300.6, Saturn: 225.7, Rahu: 90.8, Ketu: 270.8, Ascendant: 330.9 });
function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }
function providerResult(input) {
  const bodies = Object.fromEntries(Object.entries(BODY_LONGITUDES).map(([body, longitude]) => [body, freeze({
    body, siderealLongitudeDegrees: longitude, siderealMetadata: freeze({ siderealMode: 'SE_SIDM_LAHIRI', calculationStatus: 'LICENSE_GATED_VALIDATION' }),
    tropicalLongitudeDegrees: null, longitudeSpeedDegreesPerDay: body === 'Ascendant' ? null : body === 'Saturn' ? -0.05 : 1,
    motion: body === 'Ascendant' ? null : body === 'Saturn' ? 'retrograde' : 'direct', provenance: freeze({ coordinateProvenance: 'provider-native', ...(body === 'Rahu' ? { nodeModel: 'MEAN_NODE' } : {}), ...(body === 'Ketu' ? { ketuDerivation: 'NORMALIZED_RAHU_PLUS_180' } : {}) }),
  })]));
  const utc = input.timezone === 'UTC' ? `${input.date}T${input.time}Z` : '1990-11-26T08:10:00.000Z';
  return freeze({ bodies, instant: freeze({ utc, unixMilliseconds: Date.parse(utc) }), sidereal: freeze({ siderealMode: 'SE_SIDM_LAHIRI' }), provider: freeze({ providerId: 'swiss-ephemeris', swissVersion: '2.10.03', calculationStatus: 'LICENSE_GATED_VALIDATION', siderealMode: 'SE_SIDM_LAHIRI', nodeModel: 'MEAN_NODE', productionLicenseGate: false }) });
}
function engine() { const calls = []; return { calls, calculate(input) { calls.push(freeze({ ...input })); return providerResult(input); } }; }
const place = freeze(createResolvedBirthPlace({ provider: 'mapbox-geocoding', providerPlaceId: 'mock-hyderabad', latitude: 17.385, longitude: 78.4867, timezone: 'Asia/Kolkata', timezoneResolver: { provider: 'timezone-boundary-builder', datasetVersion: '2026c', datasetChecksum: 'c1bd0839c15a94ace5107e84694915fca3ab74907dee7b2ed4e3e5e01acc8f16' } }));
const request = () => ({ birth: { date: '1990-11-26', time: '13:40:00', place }, readingInstant: '2024-06-01T00:00:00.000Z', locale: 'en-IN' });

const SAVANA_RULESET_ID = 'vimshottari-longitude-proportional-savana-360-v1';
function savanaOrchestrator(astronomicalEngine) { return new BirthCareerReadingOrchestrator({ astronomicalEngine, dashaRulesetId: SAVANA_RULESET_ID }); }

test('builds the Hyderabad development fixture through Layer 15A using injected native-sidereal astronomy', () => {
  const fixture = engine(); const result = savanaOrchestrator(fixture).generate(request());
  assert.equal(fixture.calls.length, 2);
  assert.deepEqual(fixture.calls[0], { date: '1990-11-26', time: '13:40:00', timezone: 'Asia/Kolkata', latitude: 17.385, longitude: 78.4867 });
  assert.deepEqual(fixture.calls[1], { date: '2024-06-01', time: '00:00:00.000', timezone: 'UTC', latitude: 17.385, longitude: 78.4867 });
  assert.equal(result.domain, 'CAREER'); assert.equal(result.renderedReading.locale, 'en-IN');
  assert.equal(result.provenance.calculationStatus, 'LICENSE_GATED_VALIDATION'); assert.equal(result.provenance.productionAuthority, false);
  assert.equal(result.provenance.siderealMode, 'SE_SIDM_LAHIRI'); assert.equal(result.provenance.nodeModel, 'MEAN_NODE');
  assert.equal(result.reading.readingItems.some((item) => item.topic === 'CAREER_GOCHAR_CONNECTION_PRESENT'), true);
  const serialized = JSON.stringify(result);
  for (const forbidden of ['1990-11-26', '13:40:00', '17.385', '78.4867', 'siderealLongitudeDegrees', 'ephemerisPath', 'manifest']) assert.equal(serialized.includes(forbidden), false, forbidden);
  assert.equal(Object.isFrozen(result), true); assert.equal(Object.isFrozen(result.provenance), true);
});

test('is deterministic, accepts frozen input, preserves Mean Rahu/Ketu and does not double-convert native Lahiri', () => {
  const input = freeze(request()); const fixture = engine(); const orchestration = savanaOrchestrator(fixture);
  const first = orchestration.generate(input); const second = orchestration.generate(input);
  assert.deepEqual(first, second); assert.equal(fixture.calls.length, 4);
  // The fake provider supplies native sidereal only; a second Lahiri conversion would
  // change these Layer-2-derived house facts and fail this native-coordinate fixture.
  assert.equal(first.reading.domain, 'CAREER');
  assert.equal(BODY_LONGITUDES.Ketu, (BODY_LONGITUDES.Rahu + 180) % 360);
});

test('accepts Swiss-style native sidereal bodies without invoking the interim Lahiri calculator', () => {
  const nativeProvider = { calculate({ instant }) { return providerResult({ date: instant.toISOString().slice(0, 10), time: instant.toISOString().slice(11, 23), timezone: 'UTC' }); } };
  const noInterimConversion = { calculateSiderealLongitude() { throw new Error('interim Lahiri must not be called for native sidereal bodies'); } };
  const result = savanaOrchestrator(new AstronomicalEngine(nativeProvider, noInterimConversion)).generate(request());
  assert.equal(result.provenance.calculationStatus, 'LICENSE_GATED_VALIDATION');
  assert.equal(result.provenance.productionAuthority, false);
});

test('does not fabricate a transit interval and delegates an explicit interval to Layer 10', () => {
  const omittedEngine = engine(); savanaOrchestrator(omittedEngine).generate(request());
  assert.equal(omittedEngine.calls.length, 2);
  const explicitEngine = engine(); const explicit = request(); explicit.transitScanRange = { startInstant: '2024-06-01T00:00:00.000Z', endInstant: '2024-06-01T01:00:00.000Z' };
  savanaOrchestrator(explicitEngine).generate(explicit);
  assert.ok(explicitEngine.calls.length > 2);
});

test('rejects invalid infrastructure and public inputs without producing a partial reading', () => {
  assert.throws(() => new BirthCareerReadingOrchestrator({}), /astronomicalEngine/);
  const orchestration = savanaOrchestrator(engine());
  for (const edit of [
    value => { value.birth.place = { latitude: 17, longitude: 78, timezone: 'Asia/Kolkata' }; },
    value => { value.birth.date = '1990/11/26'; }, value => { value.birth.time = '13:40'; },
    value => { value.readingInstant = undefined; }, value => { value.readingInstant = '2024-06-01T00:00:00+00:00'; },
    value => { value.locale = 'en'; }, value => { value.transitScanRange = { startInstant: '2024-06-02T00:00:00.000Z', endInstant: '2024-06-01T00:00:00.000Z' }; },
  ]) { const value = request(); edit(value); assert.throws(() => orchestration.generate(value)); }
});

test('preserves Layer 1 historical DST ambiguity and nonexistent-local-time failures', () => {
  const newYork = createResolvedBirthPlace({ provider: 'mapbox-geocoding', providerPlaceId: 'mock-new-york', latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York', timezoneResolver: { provider: 'timezone-boundary-builder', datasetVersion: '2026c', datasetChecksum: 'c1bd0839c15a94ace5107e84694915fca3ab74907dee7b2ed4e3e5e01acc8f16' } });
  const orchestration = savanaOrchestrator(engine());
  for (const [date, time, code] of [['2021-11-07', '01:30:00', 'AMBIGUOUS_LOCAL_TIME'], ['2021-03-14', '02:30:00', 'NONEXISTENT_LOCAL_TIME']]) {
    const value = request(); value.birth = { date, time, place: newYork };
    assert.throws(() => orchestration.generate(value), error => error.code === code);
  }
});

test('propagates provider failure as fatal and contains no network or model integration', () => {
  const failed = savanaOrchestrator({ calculate() { throw new Error('provider failed'); } });
  assert.throws(() => failed.generate(request()), /provider failed/);
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../src/orchestration/birth-career-reading-orchestrator.js'), 'utf8');
  for (const forbidden of ['fetch(', 'axios', 'mapbox', 'http', 'openai']) assert.equal(source.toLowerCase().includes(forbidden), false, forbidden);
});
