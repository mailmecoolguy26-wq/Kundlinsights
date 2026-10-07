'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createProductionAstrology } = require('../../src/runtime/create-production-astrology');

test('uses the explicitly tagged provisional factory by default', () => {
  const provisional = Object.freeze({ astronomicalEngine: {}, canonicalSiderealSunSampler: {} });
  const result = createProductionAstrology({
    config: { astronomy: { authority: 'provisional' } },
    dependencies: { createDevelopmentAstrology: () => provisional },
  });
  assert.equal(result.authorityMode, 'provisional');
  assert.equal(result.productionAuthority, false);
  assert.equal(result.astronomicalEngine, provisional.astronomicalEngine);
});

test('Swiss authority mode fails closed and never falls back to provisional astronomy', () => {
  let provisionalCalls = 0;
  class MissingSwissArtifacts {
    constructor() { throw new Error('manifest verification failed'); }
  }
  assert.throws(() => createProductionAstrology({
    config: { astronomy: { authority: 'swiss', ephemerisPath: '/private/swiss', manifest: {}, productionLicenseGate: true } },
    dependencies: {
      SwissNativeAdapter: MissingSwissArtifacts,
      createDevelopmentAstrology: () => { provisionalCalls += 1; return {}; },
    },
  }), (error) => error.code === 'PRODUCTION_ASTRONOMY_UNAVAILABLE');
  assert.equal(provisionalCalls, 0);
});
