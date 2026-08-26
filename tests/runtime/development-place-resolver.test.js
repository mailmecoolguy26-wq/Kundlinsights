'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi } = require('../../src/api');
const { createDevelopmentPlaceResolver, loadDevelopmentConfig, createDevelopmentRuntime } = require('../../src/runtime');

const key = Buffer.alloc(32, 7).toString('base64');
const baseEnv = () => ({ NODE_ENV: 'development', DEV_DATABASE_URL: 'postgresql://dev@example.test:5432/kundlinsights', DEV_SUPABASE_AUTH_ISSUER: 'https://project.supabase.co/auth/v1', DEV_SUPABASE_AUTH_JWKS_URL: 'https://project.supabase.co/auth/v1/.well-known/jwks.json', DEV_SUPABASE_AUTH_AUDIENCE: 'authenticated', DEV_LOCAL_KMS_KEY_BASE64: key });
const resolverConfig = Object.freeze({ googleMapsApiKey: 'test-google-key', timeoutMilliseconds: 5000, manifestPath: '/safe/manifest.json', binaryPath: '/safe/timezones.bin' });

test('constructs the existing development place resolver stack and closes its timezone artifact resolver', () => {
  const calls = []; class Google { constructor(options) { calls.push(['google', options.timeoutMilliseconds]); } } class Timezone { constructor(options) { calls.push(['timezone', options.manifestPath, options.binaryPath]); } close() { calls.push(['close']); } } class Resolver { constructor(options) { calls.push(['resolver', Boolean(options.placeProvider), Boolean(options.timezoneResolver)]); } }
  const value = createDevelopmentPlaceResolver({ config: resolverConfig, dependencies: { GoogleGeocodingProvider: Google, TimezoneRuntimeArtifactResolver: Timezone, BirthPlaceResolver: Resolver } });
  assert.ok(value.resolver); value.close(); assert.deepEqual(calls, [['timezone', '/safe/manifest.json', '/safe/timezones.bin'], ['google', 5000], ['resolver', true, true], ['close']]);
});

test('fails closed for missing Google, manifest, or binary configuration and never includes a Google key in an error', () => {
  for (const supplied of [{ TIMEZONE_RUNTIME_MANIFEST_PATH: '/safe/manifest.json', TIMEZONE_RUNTIME_BINARY_PATH: '/safe/timezones.bin' }, { GOOGLE_MAPS_API_KEY: 'test-google-key', TIMEZONE_RUNTIME_BINARY_PATH: '/safe/timezones.bin' }, { GOOGLE_MAPS_API_KEY: 'test-google-key', TIMEZONE_RUNTIME_MANIFEST_PATH: '/safe/manifest.json' }]) { const env = baseEnv(); Object.assign(env, supplied); assert.throws(() => loadDevelopmentConfig(env), (error) => error.code === 'INVALID_DEVELOPMENT_CONFIGURATION'); }
  assert.throws(() => createDevelopmentPlaceResolver({ config: resolverConfig, dependencies: { GoogleGeocodingProvider: class {}, TimezoneRuntimeArtifactResolver: class { constructor() { throw new Error('test-google-key'); } }, BirthPlaceResolver: class {} } }), (error) => error.code === 'INVALID_DEVELOPMENT_CONFIGURATION' && !error.message.includes('test-google-key'));
});

test('passes a configured development resolver into composition and closes it at shutdown', async () => {
  const events = []; const api = { async close() {}, async listen() {} }; class Pool { async query() {} async end() {} } class Kms { async validateStartupKey() {} } class Fixture { constructor() {} }
  const config = { ...loadDevelopmentConfig(baseEnv()), placeResolver: resolverConfig }; let received;
  const runtime = createDevelopmentRuntime({ env: baseEnv(), astronomicalEngine: {}, canonicalSiderealSunSampler: {}, dependencies: { loadDevelopmentConfig: () => config, Pool, DevelopmentLocalKms: Kms, DevelopmentCareerEntitlementFixture: Fixture, createSupabaseAuthVerifier: () => ({}), createDevelopmentPlaceResolver: () => ({ resolver: { resolveSelection() {} }, close: () => events.push('resolver-close') }), createApiComposition: (args) => { received = args.placeResolver; return { api, services: {} }; } } });
  assert.ok(received); await runtime.shutdown(); assert.deepEqual(events, ['resolver-close']);
});

test('registers the existing resolution route when a resolver is supplied', async () => {
  const placeResolutionService = { search: async () => [], resolveBirthTime: async () => ({ localDate: '1990-01-01' }) };
  const api = createApi({ authVerifier: { verifyRequest: async () => ({ provider: 'supabase', subject: 'a', isAnonymous: false }) }, userResolver: { resolve: async () => ({ id: 'u', status: 'active' }) }, birthProfileService: { create: async () => ({}), list: async () => [], get: async () => ({}) }, secureReadingService: {}, placeResolutionService });
  const response = await api.inject({ method: 'POST', url: '/v1/places/resolve-birth-time', headers: { authorization: 'Bearer test' }, payload: { place: { id: 'p' }, localDate: '1990-01-01', localTime: '00:00' } });
  assert.equal(response.statusCode, 200); await api.close();
});
