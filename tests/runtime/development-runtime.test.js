'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createDevelopmentAstrology, loadDevelopmentConfig, DevelopmentLocalKms, createDevelopmentRuntime, startDevelopment } = require('../../src/runtime');

const localKey = Buffer.alloc(32, 7).toString('base64');
const env = () => ({ NODE_ENV: 'development', DEV_DATABASE_URL: 'postgresql://dev@example.test:5432/kundlinsights', DEV_SUPABASE_AUTH_ISSUER: 'https://project.supabase.co/auth/v1', DEV_SUPABASE_AUTH_JWKS_URL: 'https://project.supabase.co/auth/v1/.well-known/jwks.json', DEV_SUPABASE_AUTH_AUDIENCE: 'authenticated', DEV_LOCAL_KMS_KEY_BASE64: localKey });

test('creates the existing provisional reference engine and samples the Sun through that same engine', () => {
  const astrology = createDevelopmentAstrology(); assert.equal(astrology.productionAuthority, false); assert.equal(astrology.astronomicalEngine.provider.constructor.name, 'AstronomyEngineProvider');
  const natal = astrology.astronomicalEngine.calculate({ date: '1990-11-26', time: '13:40:00', timezone: 'Asia/Kolkata', latitude: 17.385, longitude: 78.4867 }); const sun = astrology.canonicalSiderealSunSampler.sampleCanonicalSiderealSun({ instantUtc: '1990-11-26T08:10:00.000Z' });
  assert.equal(natal.provider.calculationStatus, 'PROVISIONAL'); assert.equal(sun.provenance.productionAuthority, false); assert.equal(sun.canonicalSiderealLongitudeDegrees, natal.bodies.Sun.siderealLongitudeDegrees);
});

test('accepts only explicit local development configuration without AWS, Swiss, or OpenAI variables', () => {
  const config = loadDevelopmentConfig(env()); assert.equal(config.host, '0.0.0.0'); assert.equal(config.port, 3000); assert.equal(config.localKms.key.length, 32);
  for (const change of [{ NODE_ENV: 'production' }, { DEV_PORT: '0' }, { DEV_LOCAL_KMS_KEY_BASE64: 'invalid' }]) { const value = env(); Object.assign(value, change); assert.throws(() => loadDevelopmentConfig(value), (error) => error.code === 'INVALID_DEVELOPMENT_CONFIGURATION'); }
});

test('uses a local authenticated envelope adapter without AWS KMS', async () => {
  const kms = new DevelopmentLocalKms({ key: Buffer.alloc(32, 9) }); const dek = Buffer.alloc(32, 3); const keyVersion = kms.getCurrentKeyVersion(); const wrapped = await kms.wrapDek({ userId: 'user-a', keyVersion, dek }); const unwrapped = await kms.unwrapDek({ userId: 'user-a', keyVersion, ...kms.getWrappingMetadata({ keyVersion }), wrappedDek: wrapped }); assert.deepEqual(unwrapped, dek);
});

test('boots health and readiness with local KMS and no AWS, OpenAI, or Swiss dependencies', async () => {
  const events = []; const api = { async close() { events.push('close'); }, async listen(options) { events.push(['listen', options]); }, async inject(url) { return { statusCode: 200, json: () => ({ status: url === '/health' ? 'ok' : 'ready' }) }; } }; class Pool { async query() { events.push('db'); } async end() { events.push('end'); } } class Kms { constructor() {} async validateStartupKey() { events.push('local-kms'); } }
  const runtime = createDevelopmentRuntime({ env: env(), astronomicalEngine: {}, canonicalSiderealSunSampler: {}, dependencies: { Pool, DevelopmentLocalKms: Kms, createSupabaseAuthVerifier: () => ({}), createApiComposition: () => ({ api, services: {} }) } }); await runtime.initialize(); assert.equal((await runtime.api.inject('/health')).json().status, 'ok'); assert.equal((await runtime.api.inject('/ready')).json().status, 'ready'); await runtime.start(); await runtime.shutdown(); assert.deepEqual(events.slice(0, 4), ['db', 'local-kms', ['listen', { host: '0.0.0.0', port: 3000 }], 'close']);
});

test('starts through the development bootstrap only', async () => {
  const events = []; const runtime = { installSignalHandlers() { events.push('signals'); }, async start() { events.push('start'); } }; await startDevelopment({ dependencies: { createDevelopmentAstrology: () => ({ astronomicalEngine: {}, canonicalSiderealSunSampler: {} }), createDevelopmentRuntime: () => { events.push('runtime'); return runtime; } } }); assert.deepEqual(events, ['runtime', 'signals', 'start']);
});
