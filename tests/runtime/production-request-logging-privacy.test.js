'use strict';

const { Writable } = require('node:stream');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi } = require('../../src/api');
const { createTestOnlyAuthVerifier } = require('../../src/api/test-only-auth-verifier');
const { PlaceResolutionService } = require('../../src/api/place-resolution-service');
const { GoogleGeocodingProvider, BirthPlaceResolver } = require('../../src/place');
const { productionLogger } = require('../../src/runtime');
const pino = require('pino');

const principal = { provider: 'supabase', subject: 'logging-user', isAnonymous: false };
const key = 'TEST_GOOGLE_KEY_DO_NOT_LOG';

function capture() { let output = ''; const stream = new Writable({ write(chunk, encoding, callback) { output += chunk.toString(); callback(); } }); return { stream, output: () => output }; }
function response() { return { ok: true, json: async () => ({ status: 'OK', results: [{ place_id: 'google-hyd', formatted_address: 'Hyderabad, Telangana, India', geometry: { location: { lat: 17.385, lng: 78.4867 } } }] }) }; }
function api({ fetchImplementation }) {
  const provider = new GoogleGeocodingProvider({ apiKey: key, fetchImplementation });
  const resolver = new BirthPlaceResolver({ placeProvider: provider, timezoneResolver: { resolve: async () => ({ timezone: 'Asia/Kolkata', provenance: { provider: 'timezone-boundary-builder', datasetVersion: '2026c', datasetChecksum: 'a'.repeat(64) } }) } });
  const placeResolutionService = new PlaceResolutionService({ birthPlaceResolver: resolver });
  const logs = capture();
  const app = createApi({ authVerifier: createTestOnlyAuthVerifier({ token: principal }), userResolver: { resolve: async () => ({ id: 'user', status: 'active' }) }, birthProfileService: {}, secureReadingService: {}, placeResolutionService, requestIdGenerator: () => 'request-1', logger: { ...productionLogger('info'), stream: logs.stream } });
  return { app, logs };
}

test('production logs retain request observability but remove raw and encoded place-search query strings', async () => {
  const receivedQueries = []; const instance = api({ fetchImplementation: async (url) => { receivedQueries.push(new URL(url).searchParams.get('address')); return response(); } });
  const reply = await instance.app.inject({ url: '/v1/places/search?q=Hyderabad', headers: { authorization: 'Bearer token' } }); await instance.app.close();
  const output = instance.logs.output();
  assert.equal(reply.statusCode, 200); assert.deepEqual(receivedQueries, ['Hyderabad', null]);
  assert.match(output, /"method":"GET"/); assert.match(output, /"url":"\/v1\/places\/search"/); assert.match(output, /"reqId":"request-1"/); assert.match(output, /"statusCode":200/); assert.match(output, /"responseTime":/);
  for (const forbidden of ['Hyderabad', '?q=', 'q=Hyderabad', 'maps.googleapis.com', key]) assert.equal(output.includes(forbidden), false);
});

test('provider failures cannot leak encoded place text, Google URL, or key into production logs', async () => {
  const receivedQueries = []; const instance = api({ fetchImplementation: async (url) => { receivedQueries.push(new URL(url).searchParams.get('address')); throw new Error(String(url)); } });
  const reply = await instance.app.inject({ url: '/v1/places/search?q=New%20Delhi%2C%20India', headers: { authorization: 'Bearer token' } }); await instance.app.close();
  const output = instance.logs.output();
  assert.equal(reply.statusCode, 503); assert.equal(reply.json().error.code, 'PLACE_PROVIDER_UNAVAILABLE'); assert.deepEqual(receivedQueries, ['New Delhi, India']);
  for (const forbidden of ['New Delhi, India', 'New%20Delhi%2C%20India', 'New+Delhi%2C+India', '?q=', 'maps.googleapis.com', key]) assert.equal(output.includes(forbidden), false);
  assert.match(output, /"method":"GET"/); assert.match(output, /"url":"\/v1\/places\/search"/); assert.match(output, /"statusCode":503/);
});
test('production logger selectively redacts OpenAI and authorization secrets',()=>{const logs=capture();const logger=pino(productionLogger('info'),logs.stream);logger.info({OPENAI_API_KEY:'sk-test-openai-secret',openai:{apiKey:'sk-test-openai-secret'},headers:{authorization:'Bearer sk-test-openai-secret'},provider:'openai',model:'test-career-model',category:'timeout'},'safe');const output=logs.output();assert.equal(output.includes('sk-test-openai-secret'),false);assert.match(output,/test-career-model/);assert.match(output,/"provider":"openai"/);});
