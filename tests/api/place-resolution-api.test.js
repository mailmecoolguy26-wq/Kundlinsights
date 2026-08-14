'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi } = require('../../src/api');
const { createTestOnlyAuthVerifier } = require('../../src/api/test-only-auth-verifier');
const { PlaceResolutionService } = require('../../src/api/place-resolution-service');

const principal = { provider: 'supabase', subject: 'a', isAnonymous: false };
const provenance = { provider: 'timezone-boundary-builder', datasetVersion: '2026c', datasetChecksum: 'a'.repeat(64) };
const places = Object.freeze({
  'google-hyd': Object.freeze({ provider: 'google-geocoding', providerPlaceId: 'google-hyd', displayName: 'Hyderabad, Telangana, India', latitude: 17.385, longitude: 78.4867, timezone: 'Asia/Kolkata', timezoneResolver: provenance }),
  'google-ny': Object.freeze({ provider: 'google-geocoding', providerPlaceId: 'google-ny', displayName: 'New York, New York, United States', latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York', timezoneResolver: provenance }),
});

function resolver() {
  return {
    autocomplete: async ({ query }) => query === 'Hyderabad' ? Array.from({ length: 6 }, () => ({ providerPlaceId: 'google-hyd' })) : [],
    resolveSelection: async ({ providerPlaceId }) => {
      if (!places[providerPlaceId]) { const error = new Error(); error.code = 'PLACE_NOT_FOUND'; throw error; }
      return places[providerPlaceId];
    },
  };
}

function app() {
  const placeResolutionService = new PlaceResolutionService({ birthPlaceResolver: resolver() });
  return createApi({ authVerifier: createTestOnlyAuthVerifier({ a: principal }), userResolver: { resolve: async () => ({ id: 'u', status: 'active' }) }, birthProfileService: { create: async ({ birthData }) => ({ id: 'p', displayLabel: null, birthData, status: 'active', createdAt: 'x', updatedAt: 'x' }), list: async () => [], get: async () => null }, secureReadingService: {}, placeResolutionService, requestIdGenerator: () => 'request-1' });
}

async function resolve(api, payload) {
  return api.inject({ method: 'POST', url: '/v1/places/resolve-birth-time', headers: { authorization: 'Bearer a' }, payload });
}

test('authenticated place search and resolution return safe, bounded TBB-authoritative birth data accepted unchanged by profile create', async () => {
  const api = app();
  assert.equal((await api.inject('/v1/places/search?q=Hyderabad')).statusCode, 401);
  const search = await api.inject({ url: '/v1/places/search?q=Hyderabad', headers: { authorization: 'Bearer a' } });
  assert.equal(search.statusCode, 200); assert.equal(search.json().results.length, 5);
  assert.deepEqual(Object.keys(search.json().results[0]).sort(), ['id', 'label', 'latitude', 'longitude', 'timezone', 'timezoneProvenance'].sort());
  const resolved = await resolve(api, { place: { id: 'google-hyd', label: 'untrusted', latitude: 0, longitude: 0, timezone: 'Etc/UTC' }, localDate: '1990-11-26', localTime: '13:40' });
  assert.equal(resolved.statusCode, 200); assert.equal(resolved.json().birthData.utc, '1990-11-26T08:10:00.000Z'); assert.equal(resolved.json().birthData.timezone, 'Asia/Kolkata'); assert.equal(resolved.json().birthData.latitude, 17.385);
  const created = await api.inject({ method: 'POST', url: '/v1/birth-profiles', headers: { authorization: 'Bearer a' }, payload: { birthData: resolved.json().birthData } });
  assert.equal(created.statusCode, 201); await api.close();
});

test('rejects invalid place/date/time input and fails closed for historical DST gaps and overlaps', async () => {
  const api = app();
  for (const url of ['/v1/places/search?q=', '/v1/places/search?q=x', `/v1/places/search?q=${'a'.repeat(121)}`]) assert.equal((await api.inject({ url, headers: { authorization: 'Bearer a' } })).statusCode, 400);
  assert.equal((await resolve(api, { place: { id: 'x' }, localDate: '1990-01-01', localTime: '00:00' })).statusCode, 404);
  for (const payload of [{ place: { id: 'google-hyd' }, localDate: '1990-02-30', localTime: '13:40' }, { place: { id: 'google-hyd' }, localDate: '1990-01-01', localTime: '25:00' }]) assert.equal((await resolve(api, payload)).statusCode, 400);
  const overlap = await resolve(api, { place: { id: 'google-ny' }, localDate: '2024-11-03', localTime: '01:30' });
  const gap = await resolve(api, { place: { id: 'google-ny' }, localDate: '2024-03-10', localTime: '02:30' });
  assert.equal(overlap.statusCode, 400); assert.equal(overlap.json().error.code, 'LOCAL_TIME_AMBIGUOUS');
  assert.equal(gap.statusCode, 400); assert.equal(gap.json().error.code, 'LOCAL_TIME_NONEXISTENT');
  await api.close();
});
