'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { deepFreeze } = require('../../../src/astronomy');
const { DAY_MS, MAX_SOLAR_RETURN_INTERVALS, buildSolarReturnGrid } = require('../../../src/dasha');

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
