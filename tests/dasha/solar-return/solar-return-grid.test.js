'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { deepFreeze } = require('../../../src/astronomy');
const { DAY_MS, MAX_SOLAR_RETURN_INTERVALS, MAX_BACKWARD_SOLAR_RETURN_INTERVALS, buildSolarReturnGrid, buildBidirectionalSolarReturnGrid } = require('../../../src/dasha');

const BIRTH = '2000-01-01T00:00:00.000Z'; const EPOCH = new Date(BIRTH).getTime();
function sampler() { return Object.freeze({ sampleCanonicalSiderealSun: ({ instantUtc }) => deepFreeze({ canonicalSiderealLongitudeDegrees: ((new Date(instantUtc).getTime() - EPOCH) * 360 / (365 * DAY_MS) % 360 + 360) % 360, provenance: deepFreeze({ providerId: 'synthetic' }) }) }); }

test('builds immutable sequential returns from R0 with a constant original target', () => {
  const grid = buildSolarReturnGrid({ sampler: sampler(), referenceInstantUtc: BIRTH, targetLongitude: 360, intervals: 3 });
  assert.equal(grid.entries.length, 4);
  assert.equal(grid.entries[0].instantUtc, BIRTH);
  assert.equal(grid.targetLongitude, 0);
  assert.deepEqual(grid.entries.slice(1).map((entry) => entry.returnResult.targetLongitude), [0, 0, 0]);
  assert.equal(Object.isFrozen(grid.entries[1].returnResult.provenance), true);
  assert.throws(() => { grid.entries.push('mutation'); }, TypeError);
});

test('accepts the R121 ceiling and rejects requests beyond it without an unbounded loop', () => {
  const minimal = buildSolarReturnGrid({ sampler: sampler(), referenceInstantUtc: BIRTH, targetLongitude: 0, intervals: 0 });
  assert.equal(minimal.maxIntervals, MAX_SOLAR_RETURN_INTERVALS);
  assert.throws(() => buildSolarReturnGrid({ sampler: sampler(), referenceInstantUtc: BIRTH, targetLongitude: 0, intervals: MAX_SOLAR_RETURN_INTERVALS + 1 }), (error) => error.code === 'SOLAR_RETURN_SOLVER_FAILED');
});

test('builds immutable actual R-negative through R-positive entries with one constant natal target', () => {
  const grid = buildBidirectionalSolarReturnGrid({ sampler: sampler(), referenceInstantUtc: BIRTH, targetLongitude: 360, backwardIntervals: 3, forwardIntervals: 3 });
  assert.deepEqual(grid.entries.map((entry) => entry.index), [-3, -2, -1, 0, 1, 2, 3]);
  assert.equal(grid.entries.find((entry) => entry.index === 0).instantUtc, BIRTH);
  assert.ok(new Date(grid.entries[0].instantUtc).getTime() < EPOCH);
  assert.ok(new Date(grid.entries.at(-1).instantUtc).getTime() > EPOCH);
  assert.deepEqual(grid.entries.filter((entry) => entry.returnResult).map((entry) => entry.returnResult.targetLongitude), Array(6).fill(0));
  assert.equal(Object.isFrozen(grid.entries), true);
  assert.throws(() => { grid.entries.push('mutation'); }, TypeError);
});

test('locks exactly twenty actual backward intervals and rejects larger backward grids', () => {
  assert.equal(MAX_BACKWARD_SOLAR_RETURN_INTERVALS, 20);
  const grid = buildBidirectionalSolarReturnGrid({ sampler: sampler(), referenceInstantUtc: BIRTH, targetLongitude: 0, backwardIntervals: 20, forwardIntervals: 0 });
  assert.equal(grid.entries[0].index, -20);
  assert.equal(grid.entries.at(-1).index, 0);
  assert.throws(() => buildBidirectionalSolarReturnGrid({ sampler: sampler(), referenceInstantUtc: BIRTH, targetLongitude: 0, backwardIntervals: 21, forwardIntervals: 0 }), (error) => error.code === 'SOLAR_RETURN_SOLVER_FAILED');
});
