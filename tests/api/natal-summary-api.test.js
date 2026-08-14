'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi } = require('../../src/api');
const { NatalSummaryService, GRAHAS } = require('../../src/application/natal-summary');
const { classifySiderealLongitude } = require('../../src/jyotish');
const { calculateRashiHouses } = require('../../src/bhava');
const { createTestOnlyAuthVerifier } = require('../../src/api/test-only-auth-verifier');

const a = Object.freeze({ provider: 'supabase', subject: 'user-a', isAnonymous: false });
const b = Object.freeze({ provider: 'supabase', subject: 'user-b', isAnonymous: false });
const LONGITUDES = Object.freeze({ Sun: 220.25, Moon: 319.519869761, Mars: 102.5, Mercury: 195.75, Jupiter: 75.125, Venus: 245.5, Saturn: 280.75, Rahu: 10.5, Ketu: 190.5, Ascendant: 331.208263794856 });
const birthData = Object.freeze({ localDate: '1990-11-26', localTime: '13:40:00', timezone: 'Asia/Kolkata', utc: '1990-11-26T08:10:00.000Z', latitude: 17.385, longitude: 78.4867, timezoneProvenance: Object.freeze({ provider: 'test', datasetVersion: '2026c' }) });

function body(name, longitude) {
  const speed = name === 'Ascendant' ? null : name === 'Saturn' || name === 'Rahu' || name === 'Ketu' ? -0.1 : 1;
  return Object.freeze({ body: name, siderealLongitudeDegrees: longitude, longitudeSpeedDegreesPerDay: speed, motion: speed === null ? null : speed < 0 ? 'retrograde' : 'direct' });
}

function engine() {
  const bodies = Object.freeze(Object.fromEntries(Object.entries(LONGITUDES).map(([name, longitude]) => [name, body(name, longitude)])));
  return Object.freeze({
    calculate(input) {
      assert.deepEqual(input, { date: birthData.localDate, time: birthData.localTime, timezone: birthData.timezone, latitude: birthData.latitude, longitude: birthData.longitude });
      return Object.freeze({
        bodies,
        sidereal: Object.freeze({ ayanamshaSystem: 'Lahiri / Chitrapaksha', siderealMode: 'SE_SIDM_LAHIRI' }),
        provider: Object.freeze({ nodeModel: 'MEAN_NODE', calculationStatus: 'LICENSE_GATED_VALIDATION' }),
        calculationStatus: 'LICENSE_GATED_VALIDATION',
      });
    },
  });
}

function profiles() {
  return Object.freeze({
    async get({ principal, birthProfileId }) {
      if (principal.subject !== 'user-a' || birthProfileId !== 'profile-a') {
        const error = new Error(); error.code = 'NOT_FOUND_OR_FORBIDDEN'; throw error;
      }
      return Object.freeze({ id: 'profile-a', status: 'active', birthData });
    },
  });
}

function app() {
  const natalSummaryService = new NatalSummaryService({ birthProfileService: profiles(), astronomicalEngine: engine() });
  return createApi({
    authVerifier: createTestOnlyAuthVerifier({ a, b }),
    userResolver: { resolve: async () => ({ id: 'internal-user-id', status: 'active' }) },
    birthProfileService: { create: async () => null, list: async () => [], get: async () => null },
    natalSummaryService,
    secureReadingService: {},
    requestIdGenerator: () => 'request-1',
  });
}

function assertSafe(value) {
  const text = JSON.stringify(value).toLowerCase();
  for (const prohibited of ['ciphertext', 'encryptedbirthdata', 'dek', 'kms', 'subject', 'databaseurl', 'connectionstring', 'stack', 'localdate', 'localtime', 'timezoneprovenance']) {
    assert.equal(text.includes(prohibited), false, prohibited);
  }
}

test('GET natal summary maps existing Layer 1/2 and Rashi-house authority into a minimal safe DTO', async () => {
  const api = app();
  const response = await api.inject({ url: '/v1/birth-profiles/profile-a/natal-summary', headers: { authorization: 'Bearer a' } });
  assert.equal(response.statusCode, 200);
  const result = response.json().natalSummary;
  assert.equal(result.birthProfileId, 'profile-a');
  assert.deepEqual(result.planets.map((item) => item.body), GRAHAS);
  assert.equal(result.planets.some((item) => item.body === 'Ascendant'), false);
  assert.equal(result.ascendant, undefined);
  assert.equal(result.summary.ascendant.body, 'Ascendant');
  assert.equal(result.summary.ascendant.longitude, LONGITUDES.Ascendant);
  assert.equal(result.summary.ascendant.sign.rashiIndex, classifySiderealLongitude(LONGITUDES.Ascendant).rashi.rashiIndex);
  const moon = result.planets.find((item) => item.body === 'Moon');
  const sun = result.planets.find((item) => item.body === 'Sun');
  assert.equal(result.summary.moon.sign.rashiIndex, classifySiderealLongitude(LONGITUDES.Moon).rashi.rashiIndex);
  assert.equal(result.summary.moon.nakshatra.name, classifySiderealLongitude(LONGITUDES.Moon).nakshatra.name);
  assert.equal(result.summary.moon.pada, classifySiderealLongitude(LONGITUDES.Moon).pada.pada);
  assert.equal(result.summary.sun.sign.rashiIndex, classifySiderealLongitude(LONGITUDES.Sun).rashi.rashiIndex);
  assert.deepEqual(result.summary.moon, { sign: moon.sign, nakshatra: moon.nakshatra, pada: moon.pada });
  assert.deepEqual(result.summary.sun, { sign: sun.sign });
  const saturn = result.planets.find((item) => item.body === 'Saturn');
  assert.equal(saturn.motion, 'retrograde');
  assert.equal(saturn.retrograde, true);
  assert.equal(saturn.speed, -0.1);
  const expectedHouses = calculateRashiHouses({
    ascendantCanonicalSiderealLongitude: LONGITUDES.Ascendant,
    bodies: Object.fromEntries(Object.entries(LONGITUDES).map(([name, longitude]) => [name, body(name, longitude)])),
  });
  assert.equal(saturn.house, expectedHouses.planetaryAssignments.find((item) => item.body === 'Saturn').rashiHouseNumber);
  assert.deepEqual(result.calculation, { zodiac: 'sidereal', ayanamsha: 'Lahiri / Chitrapaksha', siderealMode: 'SE_SIDM_LAHIRI', nodeModel: 'MEAN_NODE', calculationStatus: 'LICENSE_GATED_VALIDATION' });
  for (const planet of result.planets) {
    assert.equal(typeof planet.longitude, 'number');
    assert.equal(typeof planet.sign.rashiIndex, 'number');
    assert.equal(typeof planet.degreeWithinSign, 'number');
    assert.equal(typeof planet.house, 'number');
    assert.equal(typeof planet.nakshatra.nakshatraIndex, 'number');
    assert.equal(Number.isInteger(planet.pada), true);
    assert.equal(typeof planet.speed, 'number');
    assert.equal(['direct', 'retrograde'].includes(planet.motion), true);
  }
  assertSafe(response.json());
  await api.close();
});

test('natal summary requires authentication and never enumerates another user profile', async () => {
  const api = app();
  assert.equal((await api.inject('/v1/birth-profiles/profile-a/natal-summary')).statusCode, 401);
  const forbidden = await api.inject({ url: '/v1/birth-profiles/profile-a/natal-summary', headers: { authorization: 'Bearer b' } });
  assert.equal(forbidden.statusCode, 404);
  assert.equal(JSON.stringify(forbidden.json()).includes('profile-a'), false);
  assertSafe(forbidden.json());
  assert.equal((await api.inject({ url: '/v1/birth-profiles/invalid.id/natal-summary', headers: { authorization: 'Bearer a' } })).statusCode, 400);
  await api.close();
});
