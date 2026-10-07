'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startProduction } = require('../../src/runtime/start-production');

test('production bootstrap obtains astronomy through its production factory seam', async () => {
  const events = [];
  const astrology = { astronomicalEngine: { id: 'engine' }, canonicalSiderealSunSampler: { id: 'sampler' } };
  const runtime = { installSignalHandlers() { events.push('signals'); }, async start() { events.push('start'); } };
  await startProduction({
    env: { NODE_ENV: 'production' },
    dependencies: {
      createAstrology({ env }) { events.push(env.NODE_ENV); return astrology; },
      createProductionRuntime(input) { assert.equal(input.astronomicalEngine, astrology.astronomicalEngine); assert.equal(input.canonicalSiderealSunSampler, astrology.canonicalSiderealSunSampler); return runtime; },
    },
  });
  assert.deepEqual(events, ['production', 'signals', 'start']);
});
