'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { AstronomicalEngine } = require('../../src/astronomy');
const { DeterministicTransitProvider, BODIES } = require('./fixtures/deterministic-transit-provider');

const start = '2024-01-01T00:00:00.000Z';
const middle = '2024-01-02T00:00:00.000Z';
const end = '2024-01-03T00:00:00.000Z';

function provider(segments) {
  return new DeterministicTransitProvider({ trajectories: { Jupiter: segments } });
}

function at(transitProvider, instant) {
  return transitProvider.calculate({ instant: new Date(instant), observer: { latitude: 0, longitude: 0 } });
}

test('implements the Layer 1 calculate request/response shape and returns every required body', () => {
  const result = at(provider([{
    type: 'linear', startInstant: start, endInstant: end, startLongitudeDegrees: 29, longitudeRateDegreesPerDay: 1,
  }]), middle);

  assert.deepEqual(Object.keys(result.bodies), BODIES);
  assert.equal(result.provider.provider, 'deterministic-transit-test-provider');
  for (const body of BODIES) {
    assert.equal(result.bodies[body].body, body);
    assert.equal(result.bodies[body].siderealMetadata.calculationStatus, 'PROVISIONAL');
  }
});

test('is compatible with the existing Layer 1 astronomical-engine canonical-body pipeline', () => {
  const engine = new AstronomicalEngine(provider([{
    type: 'linear', startInstant: start, endInstant: end, startLongitudeDegrees: 29, longitudeRateDegreesPerDay: 1,
  }]));
  const result = engine.calculate({
    date: '2024-01-02', time: '00:00:00', timezone: 'UTC', latitude: 0, longitude: 0,
  });

  assert.equal(result.instant.utc, middle);
  assert.equal(result.bodies.Jupiter.siderealLongitudeDegrees, 30);
  assert.equal(result.bodies.Jupiter.longitudeProvenance.sidereal, 'provider-native');
  assert.equal(result.bodies.Ascendant.siderealLongitudeDegrees, 0);
});

test('interpolates direct and retrograde trajectories including zodiac wraparound', () => {
  const direct = at(provider([{
    type: 'linear', startInstant: start, endInstant: end, startLongitudeDegrees: 359, longitudeRateDegreesPerDay: 2,
  }]), middle).bodies.Jupiter;
  const retrograde = at(provider([{
    type: 'linear', startInstant: start, endInstant: end, startLongitudeDegrees: 1, longitudeRateDegreesPerDay: -2,
  }]), middle).bodies.Jupiter;

  assert.deepEqual(
    { longitude: direct.siderealLongitudeDegrees, motion: direct.motion, speed: direct.longitudeSpeedDegreesPerDay },
    { longitude: 1, motion: 'direct', speed: 2 },
  );
  assert.deepEqual(
    { longitude: retrograde.siderealLongitudeDegrees, motion: retrograde.motion, speed: retrograde.longitudeSpeedDegreesPerDay },
    { longitude: 359, motion: 'retrograde', speed: -2 },
  );
});

test('represents stationary windows and a repeated ingress/re-entry trajectory at exact segment times', () => {
  const transitProvider = provider([
    { type: 'linear', startInstant: start, endInstant: middle, startLongitudeDegrees: 29, longitudeRateDegreesPerDay: 2 },
    { type: 'stationary', startInstant: middle, endInstant: '2024-01-02T12:00:00.000Z', longitudeDegrees: 31 },
    { type: 'linear', startInstant: '2024-01-02T12:00:00.000Z', endInstant: end, startLongitudeDegrees: 31, longitudeRateDegreesPerDay: -2 },
  ]);

  assert.equal(at(transitProvider, '2024-01-01T12:00:00.000Z').bodies.Jupiter.siderealLongitudeDegrees, 30);
  assert.equal(at(transitProvider, middle).bodies.Jupiter.motion, 'stationary');
  assert.equal(at(transitProvider, '2024-01-02T06:00:00.000Z').bodies.Jupiter.motion, 'stationary');
  const reentry = at(transitProvider, '2024-01-02T18:00:00.000Z').bodies.Jupiter;
  assert.deepEqual({ longitude: reentry.siderealLongitudeDegrees, motion: reentry.motion }, { longitude: 30.5, motion: 'retrograde' });
});

test('is deterministic, does not mutate configuration, and supports explicit invalid output', () => {
  const config = {
    type: 'explicit-invalid',
    startInstant: start,
    endInstant: end,
    output: { body: 'Jupiter', siderealLongitudeDegrees: NaN, motion: 'direct', longitudeSpeedDegreesPerDay: 1 },
  };
  const transitProvider = provider([config]);
  const first = at(transitProvider, middle);
  const second = at(transitProvider, middle);

  assert.deepEqual(first, second);
  assert.ok(Number.isNaN(first.bodies.Jupiter.siderealLongitudeDegrees));
  assert.deepEqual(config, {
    type: 'explicit-invalid',
    startInstant: start,
    endInstant: end,
    output: { body: 'Jupiter', siderealLongitudeDegrees: NaN, motion: 'direct', longitudeSpeedDegreesPerDay: 1 },
  });
});
