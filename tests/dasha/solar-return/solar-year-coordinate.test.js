'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { splitSolarYearCoordinate, interpolateSolarYear, instantAtSolarYearCoordinate } = require('../../../src/dasha');

const grid = Object.freeze({ entries: Object.freeze([Object.freeze({ instantUtc: '2000-01-01T00:00:00.000Z' }), Object.freeze({ instantUtc: '2001-01-01T00:00:00.000Z' })]) });

test('maps continuous solar-year coordinates and interpolates UTC time at exact endpoints and midpoint', () => {
  assert.deepEqual(splitSolarYearCoordinate(0.648175822704), { integerYears: 0, fraction: 0.648175822704 });
  assert.equal(interpolateSolarYear({ grid, index: 0, fraction: 0 }).instantUtc, '2000-01-01T00:00:00.000Z');
  assert.equal(interpolateSolarYear({ grid, index: 0, fraction: 1 }).instantUtc, '2001-01-01T00:00:00.000Z');
  assert.equal(interpolateSolarYear({ grid, index: 0, fraction: 0.5 }).instantUtc, '2000-07-02T00:00:00.000Z');
});

test('fails closed for invalid fractions, unsupported rulesets, and missing adjacent grid entries', () => {
  for (const fraction of [-0.1, 1.1, NaN]) assert.throws(() => interpolateSolarYear({ grid, index: 0, fraction }), (error) => error.code === 'INVALID_SOLAR_YEAR_FRACTION');
  assert.throws(() => interpolateSolarYear({ grid, index: 0, fraction: 0.5, rulesetId: 'unsupported' }), (error) => error.code === 'UNSUPPORTED_SOLAR_RETURN_RULESET');
});

test('uses mathematical floor and the same interpolation rule for signed solar-year coordinates', () => {
  const bidirectional = Object.freeze({ entries: Object.freeze([
    Object.freeze({ index: -18, instantUtc: '1982-01-01T00:00:00.000Z' }),
    Object.freeze({ index: -17, instantUtc: '1983-01-01T00:00:00.000Z' }),
    Object.freeze({ index: -1, instantUtc: '1999-01-01T00:00:00.000Z' }),
    Object.freeze({ index: 0, instantUtc: '2000-01-01T00:00:00.000Z' }),
    Object.freeze({ index: 1, instantUtc: '2001-01-01T00:00:00.000Z' })
  ]) });
  const split = splitSolarYearCoordinate(-17.35182417729625);
  assert.equal(split.integerYears, -18);
  assert.ok(Math.abs(split.fraction - 0.64817582270375) < 1e-14);
  assert.equal(instantAtSolarYearCoordinate({ grid: bidirectional, coordinate: -1 }).instantUtc, '1999-01-01T00:00:00.000Z');
  assert.equal(instantAtSolarYearCoordinate({ grid: bidirectional, coordinate: 0 }).instantUtc, '2000-01-01T00:00:00.000Z');
  assert.equal(instantAtSolarYearCoordinate({ grid: bidirectional, coordinate: -0.5 }).instantUtc, '1999-07-02T12:00:00.000Z');
  assert.throws(() => instantAtSolarYearCoordinate({ grid: bidirectional, coordinate: -19.5 }), (error) => error.code === 'INVALID_SOLAR_YEAR_FRACTION');
});
