'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createDevelopmentAstrology, createDevelopmentRuntime, startDevelopment } = require('../../src/runtime');

test('uses the existing provisional reference engine and samples the Sun through that same engine', () => {
  const astrology = createDevelopmentAstrology();
  assert.equal(astrology.productionAuthority, false);
  assert.equal(astrology.astronomicalEngine.provider.constructor.name, 'AstronomyEngineProvider');
  const natal = astrology.astronomicalEngine.calculate({ date: '1990-11-26', time: '13:40:00', timezone: 'Asia/Kolkata', latitude: 17.385, longitude: 78.4867 });
  assert.equal(natal.provider.calculationStatus, 'PROVISIONAL');
  assert.equal(natal.provider.productionAuthority, undefined);
  const sun = astrology.canonicalSiderealSunSampler.sampleCanonicalSiderealSun({ instantUtc: '1990-11-26T08:10:00.000Z' });
  assert.equal(sun.provenance.productionAuthority, false);
  assert.equal(sun.canonicalSiderealLongitudeDegrees, natal.bodies.Sun.siderealLongitudeDegrees);
});

test('development runtime exposes health and readiness without Swiss or OpenAI configuration', async () => {
  const events = []; const api = { async close() { events.push('close'); }, async listen(options) { events.push(['listen', options]); }, async inject(url) { return url === '/health' ? { statusCode: 200, json: () => ({ status: 'ok' }) } : { statusCode: 200, json: () => ({ status: 'ready' }) }; } };
  class Pool { async query() { events.push('db'); } async end() { events.push('end'); } }
  class KMSClient { destroy() { events.push('destroy'); } }
  class Kms { async validateStartupKey() { events.push('kms'); } }
  const runtime = createDevelopmentRuntime({ env: {}, astronomicalEngine: {}, canonicalSiderealSunSampler: {}, dependencies: { loadDevelopmentConfig: () => ({ host: '0.0.0.0', port: 3000, databaseUrl: 'postgresql://dev', auth: {}, aws: { region: 'ap-south-1', kmsKeyArn: 'arn' }, corsOrigins: [], bodyLimitBytes: 16384 }), Pool, KMSClient, AwsKmsProvider: Kms, createSupabaseAuthVerifier: () => ({}), createApiComposition: () => ({ api, services: {} }) } });
  await runtime.initialize();
  assert.equal((await runtime.api.inject('/health')).json().status, 'ok'); assert.equal((await runtime.api.inject('/ready')).json().status, 'ready');
  await runtime.start(); assert.deepEqual(events.slice(0, 3), ['db', 'kms', ['listen', { host: '0.0.0.0', port: 3000 }]]); await runtime.shutdown();
});

test('development bootstrap injects only provisional development astronomy', async () => {
  const events = []; const runtime = { installSignalHandlers() { events.push('signals'); }, async start() { events.push('start'); } };
  await startDevelopment({ dependencies: { createDevelopmentAstrology: () => ({ astronomicalEngine: { provider: { constructor: { name: 'AstronomyEngineProvider' } } }, canonicalSiderealSunSampler: {}, productionAuthority: false }), createDevelopmentRuntime: ({ astronomicalEngine }) => { assert.equal(astronomicalEngine.provider.constructor.name, 'AstronomyEngineProvider'); events.push('runtime'); return runtime; } } });
  assert.deepEqual(events, ['runtime', 'signals', 'start']);
});
