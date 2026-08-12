'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { splitSolarYearCoordinate, interpolateSolarYear } = require('../../../src/dasha');

const grid = Object.freeze({ entries: Object.freeze([Object.freeze({ instantUtc: '2000-01-01T00:00:00.000Z' }), Object.freeze({ instantUtc: '2001-01-01T00:00:00.000Z' })]) });

test('maps continuous solar-year coordinates and interpolates UTC time at exact endpoints and midpoint', () => {
  assert.deepEqual(splitSolarYearCoordinate(0.648175822704), { integerYears: 0, fraction: 0.648175822704 });
  assert.equal(interpolateSolarYear({ grid, index: 0, fraction: 0 }).instantUtc, '2000-01-01T00:00:00.000Z');
  assert.equal(interpolateSolarYear({ grid, index: 0, fraction: 1 }).instantUtc, '2001-01-01T00:00:00.000Z');
  assert.equal(interpolateSolarYear({ grid, index: 0, fraction: 0.5 }).instantUtc, '2000-07-02T00:00:00.000Z');
});

test('fails closed for invalid fractions, unsupported rulesets, and missing adjacent grid entries', () => {
  for (const fraction of [-0.1, 1.1, NaN]) assert.throws(() => interpolateSolarYear({ grid, index: 0, fraction }), (error) => error.code === 'INVALID_SOLAR_YEAR_FRACTION');
  assert.throws(() => splitSolarYearCoordinate(-1), (error) => error.code === 'INVALID_SOLAR_YEAR_FRACTION');
  assert.throws(() => interpolateSolarYear({ grid, index: 0, fraction: 0.5, rulesetId: 'unsupported' }), (error) => error.code === 'UNSUPPORTED_SOLAR_RETURN_RULESET');
});
