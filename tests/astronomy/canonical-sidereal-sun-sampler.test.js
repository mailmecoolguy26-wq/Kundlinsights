'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CanonicalSiderealSunSampler, deepFreeze } = require('../../src/astronomy');

function result(longitude = 220.25) { return deepFreeze({ canonicalSiderealLongitudeDegrees: longitude, provenance: deepFreeze({ providerId: 'synthetic-sun', coordinateFrame: 'geocentric-native-sidereal' }) }); }

test('enforces the provider-independent canonical sidereal Sun sampler contract without mutating frozen input', () => {
  const sampler = new CanonicalSiderealSunSampler({ sample: ({ instantUtc }) => { assert.equal(instantUtc, '1990-11-26T08:10:00.000Z'); return result(); } });
  const input = Object.freeze({ instantUtc: '1990-11-26T08:10:00.000Z' });
  const sample = sampler.sampleCanonicalSiderealSun(input);
  assert.equal(sample.canonicalSiderealLongitudeDegrees, 220.25);
  assert.equal(Object.isFrozen(sample), true);
  assert.equal(Object.isFrozen(sample.provenance), true);
  assert.deepEqual(input, { instantUtc: '1990-11-26T08:10:00.000Z' });
});

test('fails closed for noncanonical UTC input, mutable output, missing provenance, and malformed longitude', () => {
  const valid = () => result();
  for (const instantUtc of ['1990-11-26T08:10:00Z', '1990-11-26T08:10:00.000+00:00', 'invalid']) assert.throws(() => new CanonicalSiderealSunSampler({ sample: valid }).sampleCanonicalSiderealSun({ instantUtc }), (error) => error.code === 'INVALID_SUN_SAMPLE');
  for (const output of [{ canonicalSiderealLongitudeDegrees: 1, provenance: {} }, deepFreeze({ canonicalSiderealLongitudeDegrees: 1 }), result(NaN), result(-0.001), result(360)]) {
    assert.throws(() => new CanonicalSiderealSunSampler({ sample: () => output }).sampleCanonicalSiderealSun({ instantUtc: '1990-11-26T08:10:00.000Z' }), (error) => error.code === 'INVALID_SUN_SAMPLE');
  }
  assert.throws(() => new CanonicalSiderealSunSampler({ sample: () => { throw new Error('provider failure'); } }).sampleCanonicalSiderealSun({ instantUtc: '1990-11-26T08:10:00.000Z' }), (error) => error.code === 'INVALID_SUN_SAMPLE');
});
