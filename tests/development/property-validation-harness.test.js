'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { AstronomicalEngine } = require('../../src/astronomy');
const { DeterministicTransitProvider } = require('../transit-events/fixtures/deterministic-transit-provider');
const { PropertyValidationHarness, GOLDEN_FIXTURE_SCHEMA } = require('../../src/development');
const { deriveVargaFromSiderealLongitude } = require('../../src/varga');

const BIRTH = Object.freeze({ localDate: '2000-01-01', localTime: '00:00:00', timezone: 'UTC', latitude: 17.385, longitude: 78.4867 });
const LONGITUDES = Object.freeze({ Sun: 220, Moon: 319.5, Mars: 40, Mercury: 70, Jupiter: 100, Venus: 130, Saturn: 160, Rahu: 190, Ketu: 10, Ascendant: 20 });
const SOLAR_START = Date.parse('1900-01-01T00:00:00.000Z');
const SOLAR_RATE = 360 / 365.25;
function solarLongitude(instant) { return ((Date.parse(instant) - SOLAR_START) / 86_400_000 * SOLAR_RATE) % 360; }
function engine() {
  const trajectories = Object.fromEntries(Object.entries(LONGITUDES).map(([body, longitudeDegrees]) => [body, [{ type: 'stationary', startInstant: '1900-01-01T00:00:00.000Z', endInstant: '2100-01-01T00:00:00.000Z', longitudeDegrees }]]));
  trajectories.Sun = [{ type: 'linear', startInstant: '1900-01-01T00:00:00.000Z', endInstant: '2100-01-01T00:00:00.000Z', startLongitudeDegrees: 0, longitudeRateDegreesPerDay: SOLAR_RATE }];
  const provider = new DeterministicTransitProvider({ trajectories });
  return new AstronomicalEngine(provider);
}
function sampler() { return Object.freeze({ sampleCanonicalSiderealSun: ({ instantUtc }) => Object.freeze({ canonicalSiderealLongitudeDegrees: solarLongitude(instantUtc), provenance: Object.freeze({ provider: 'test' }), instantUtc }) }); }

test('Property validation harness reports deterministic factual layers without becoming a Property window selector', () => {
  const harness = new PropertyValidationHarness({ astronomicalEngine: engine(), canonicalSiderealSunSampler: sampler(), clock: () => '2026-01-01T00:00:00.000Z' });
  const first = harness.generate({ birthProfileId: 'opaque-profile', birthData: BIRTH, transitHorizonDays: 1 });
  const second = harness.generate({ birthProfileId: 'opaque-profile', birthData: BIRTH, transitHorizonDays: 1 });
  assert.deepEqual(first, second);
  assert.deepEqual(Object.keys(first.vargas).sort(), ['D10', 'D16', 'D4', 'D9']);
  assert.equal(first.propertyWindows.length, 0);
  assert.deepEqual(first.checks.filter((item) => item.status === 'FAIL'), []);
  assert.equal(typeof first.dasha.currentMD.lord, 'string');
  assert.equal(first.dasha.timeline.every((md) => md.antardashas.length === 9 && md.antardashas.every((ad) => ad.pratyantardashas.length === 9)), true);
  assert.equal(JSON.stringify(first).includes('2000-01-01'), false);
});

test('golden fixture framework contains no claimed external values', () => {
  assert.deepEqual(GOLDEN_FIXTURE_SCHEMA.expected, { astronomy: {}, d1: {}, d4: {}, d9: {}, d10: {}, d16: {}, dasha: {}, transits: {}, ashtakavarga: {} });
  assert.deepEqual(GOLDEN_FIXTURE_SCHEMA.tolerances, { longitudeDegrees: null, timestampSeconds: null });
});

test('Varga projection remains deterministic at and around equal-part boundaries', () => {
  for (const id of ['D4', 'D9', 'D10', 'D16']) {
    const span = 30 / Number(id.slice(1));
    for (const longitude of [span - Number.EPSILON * 32, span, span + Number.EPSILON * 32, 30 - Number.EPSILON * 32, 30, 30 + Number.EPSILON * 32]) {
      const first = deriveVargaFromSiderealLongitude(id, longitude);
      const second = deriveVargaFromSiderealLongitude(id, longitude);
      assert.deepEqual(first, second, id);
      assert.ok(first.derivedVargaRashi.rashiIndex >= 1 && first.derivedVargaRashi.rashiIndex <= 12, id);
    }
  }
});
