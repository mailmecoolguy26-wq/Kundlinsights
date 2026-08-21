'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startProduction } = require('../../src/runtime');

test('constructs Swiss astrology before starting the production runtime', async () => {
  const events = [];
  const runtime = { installSignalHandlers() { events.push('signals'); }, async start() { events.push('start'); } };
  const result = await startProduction({ dependencies: {
    loadProductionConfig: () => ({ swissEphemeris: Object.freeze({ licenseConfirmed: true }) }),
    createProductionAstrology: ({ swissEphemeris }) => { events.push(swissEphemeris.licenseConfirmed ? 'astrology' : 'bad'); return Object.freeze({ astronomicalEngine: {}, canonicalSiderealSunSampler: {} }); },
    createProductionRuntime: ({ astronomicalEngine, canonicalSiderealSunSampler }) => { assert.deepEqual(astronomicalEngine, {}); assert.deepEqual(canonicalSiderealSunSampler, {}); events.push('runtime'); return runtime; }
  } });
  assert.equal(result, runtime);
  assert.deepEqual(events, ['astrology', 'runtime', 'signals', 'start']);
});
