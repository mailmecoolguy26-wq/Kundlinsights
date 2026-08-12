'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { SwissCanonicalSiderealSunSampler } = require('../../src/astronomy');

function adapter(longitude = 220.07412509999472) {
  const calls = [];
  return Object.freeze({ calls, swissVersion: '2.10.03', requestedFlags: 65794, julianDayUt: (date) => { calls.push(['jd', date.toISOString()]); return 2448221.84; }, calculateBody: (jd, body) => { calls.push(['body', jd, body]); return Object.freeze({ longitude, speed: 1, returnedFlags: 65794 }); } });
}

test('samples only native Swiss Lahiri Sun coordinates with safe license-gated provenance', () => {
  const nativeAdapter = adapter();
  const sampler = new SwissCanonicalSiderealSunSampler({ nativeAdapter });
  const output = sampler.sampleCanonicalSiderealSun(Object.freeze({ instantUtc: '1990-11-26T08:10:00.000Z' }));
  assert.deepEqual(nativeAdapter.calls.map((entry) => entry[0]), ['jd', 'body']);
  assert.deepEqual(nativeAdapter.calls[1].slice(1), [2448221.84, 'Sun']);
  assert.equal(output.canonicalSiderealLongitudeDegrees, 220.07412509999472);
  assert.equal(output.provenance.siderealMode, 'SE_SIDM_LAHIRI');
  assert.equal(output.provenance.ephemerisMode, 'SWIEPH');
  assert.equal(output.provenance.calculationStatus, 'LICENSE_GATED_VALIDATION');
  assert.equal(output.provenance.productionAuthority, false);
  assert.equal(JSON.stringify(output).includes('/'), false);
});

test('fails closed when the Swiss native boundary returns a noncanonical Sun longitude', () => {
  assert.throws(() => new SwissCanonicalSiderealSunSampler({ nativeAdapter: adapter(360) }).sampleCanonicalSiderealSun({ instantUtc: '1990-11-26T08:10:00.000Z' }), (error) => error.code === 'INVALID_SUN_SAMPLE');
  assert.throws(() => new SwissCanonicalSiderealSunSampler({ nativeAdapter: {} }), /SwissNativeAdapter/);
  assert.throws(() => new SwissCanonicalSiderealSunSampler({ nativeAdapter: Object.freeze({ swissVersion: '2.10.03', requestedFlags: 1, julianDayUt: () => { throw new Error('Moshier fallback'); }, calculateBody: () => null }) }).sampleCanonicalSiderealSun({ instantUtc: '1990-11-26T08:10:00.000Z' }), (error) => error.code === 'INVALID_SUN_SAMPLE');
});
