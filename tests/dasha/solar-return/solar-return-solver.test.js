'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { deepFreeze } = require('../../../src/astronomy');
const { DAY_MS, MAX_ITERATIONS, normalizeSolarReturnTarget, signedSolarResidual, solveSolarReturn, calculateVimshottariDasha } = require('../../../src/dasha');

const BIRTH = '2000-01-01T00:00:00.000Z';
const BIRTH_EPOCH = new Date(BIRTH).getTime();
const YEAR_MS = 365 * DAY_MS;

function canonical(value) { return ((value % 360) + 360) % 360; }
function syntheticSampler(longitudeAtEpoch = (epoch) => canonical((epoch - BIRTH_EPOCH) * 360 / YEAR_MS)) {
  return Object.freeze({ sampleCanonicalSiderealSun: ({ instantUtc }) => deepFreeze({ canonicalSiderealLongitudeDegrees: longitudeAtEpoch(new Date(instantUtc).getTime()), provenance: deepFreeze({ providerId: 'synthetic', coordinateFrame: 'geocentric-native-sidereal' }) }) });
}
function expectCode(fn, code) { assert.throws(fn, (error) => error && error.code === code); }

test('solves ordinary, zero-target, near-360, and wraparound solar returns by high-endpoint bisection', () => {
  const sampler = syntheticSampler();
  for (const targetLongitude of [0, 0.001, 359.999, 360, -1, 721]) {
    const result = solveSolarReturn({ sampler, priorInstantUtc: BIRTH, targetLongitude });
    assert.ok(new Date(result.instantUtc).getTime() > BIRTH_EPOCH);
    assert.ok(new Date(result.bracketHighUtc).getTime() - new Date(result.bracketLowUtc).getTime() <= 1);
    assert.equal(result.instantUtc, result.bracketHighUtc);
    assert.ok(result.iterations <= MAX_ITERATIONS);
    assert.equal(Object.isFrozen(result), true);
  }
  assert.equal(normalizeSolarReturnTarget(360), 0);
  assert.equal(normalizeSolarReturnTarget(-1), 359);
  assert.equal(normalizeSolarReturnTarget(721), 1);
  assert.ok(Math.abs(signedSolarResidual(0.001, 359.999) - 0.002) < 1e-12);
  assert.ok(Math.abs(signedSolarResidual(359.999, 0) + 0.001) < 1e-12);
});

test('does not return the prior epoch even if it is exactly on the natal target, including leap-year windows', () => {
  const result = solveSolarReturn({ sampler: syntheticSampler(), priorInstantUtc: BIRTH, targetLongitude: 0 });
  assert.equal(result.instantUtc, '2000-12-31T00:00:00.000Z');
  assert.notEqual(result.instantUtc, BIRTH);
});

test('fails closed for invalid target or sampler data, no crossing, observed multiple crossings, and pathological movement', () => {
  const sampler = syntheticSampler();
  expectCode(() => solveSolarReturn({ sampler, priorInstantUtc: BIRTH, targetLongitude: NaN }), 'INVALID_SOLAR_RETURN_TARGET');
  for (const value of [NaN, -1, 360]) expectCode(() => solveSolarReturn({ sampler: syntheticSampler(() => value), priorInstantUtc: BIRTH, targetLongitude: 0 }), 'INVALID_SUN_SAMPLE');
  expectCode(() => solveSolarReturn({ sampler: syntheticSampler(() => 10), priorInstantUtc: BIRTH, targetLongitude: 0 }), 'SOLAR_RETURN_BRACKET_NOT_FOUND');
  const oscillating = syntheticSampler((epoch) => {
    const day = Math.floor((epoch - BIRTH_EPOCH) / DAY_MS);
    return canonical(day === 350 ? 359 : day === 351 ? 1 : day === 352 ? 359 : 10);
  });
  expectCode(() => solveSolarReturn({ sampler: oscillating, priorInstantUtc: BIRTH, targetLongitude: 0 }), 'SOLAR_RETURN_SOLVER_FAILED');
  expectCode(() => solveSolarReturn({ sampler, priorInstantUtc: BIRTH, targetLongitude: 0, rulesetId: 'unsupported' }), 'UNSUPPORTED_SOLAR_RETURN_RULESET');
});

test('is deterministic and locks the 32-iteration global safety cap for a 30-day window', () => {
  const sampler = syntheticSampler();
  assert.equal(MAX_ITERATIONS, 32);
  const first = solveSolarReturn({ sampler, priorInstantUtc: BIRTH, targetLongitude: 0 });
  const second = solveSolarReturn({ sampler, priorInstantUtc: BIRTH, targetLongitude: 0 });
  assert.deepEqual(first, second);
  assert.equal(Math.ceil(Math.log2(30 * DAY_MS)), 32);
});

test('returns only safe allowlisted sampler provenance rather than arbitrary provider payload', () => {
  const sampler = Object.freeze({ sampleCanonicalSiderealSun: ({ instantUtc }) => deepFreeze({ canonicalSiderealLongitudeDegrees: canonical((new Date(instantUtc).getTime() - BIRTH_EPOCH) * 360 / YEAR_MS), provenance: deepFreeze({ providerId: 'synthetic', coordinateFrame: 'geocentric', localPath: '/private/ephemeris' }) }) });
  const result = solveSolarReturn({ sampler, priorInstantUtc: BIRTH, targetLongitude: 0 });
  assert.deepEqual(result.provenance.sampler, { providerId: 'synthetic', coordinateFrame: 'geocentric' });
  assert.equal(JSON.stringify(result).includes('/private/ephemeris'), false);
});

test('leaves the locked current Savana chronology and default ruleset untouched', () => {
  const current = calculateVimshottariDasha({ birthInstant: '1990-11-26T08:10:00.000Z', moonCanonicalSiderealLongitude: 319.51986976098 });
  const mercury = current.periods.find((period) => period.lord.id === 'mercury');
  assert.equal(current.ruleset.timeConventionId, 'savana-360-day-v1');
  assert.equal(mercury.startInstant.utc, '2026-01-14T16:24:20.789Z');
  assert.equal(mercury.endInstant.utc, '2042-10-17T16:24:20.789Z');
});
