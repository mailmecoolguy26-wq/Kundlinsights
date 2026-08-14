'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi } = require('../../src/api');
const { DivisionalChartService, GRAHAS } = require('../../src/application/divisional-charts');
const { createTestOnlyAuthVerifier } = require('../../src/api/test-only-auth-verifier');

const a = Object.freeze({ provider: 'supabase', subject: 'user-a', isAnonymous: false });
const b = Object.freeze({ provider: 'supabase', subject: 'user-b', isAnonymous: false });
const LONGITUDES = Object.freeze({
  Sun: 220.25,
  Moon: 319.519869761,
  Mars: 102.5,
  Mercury: 195.75,
  Jupiter: 75.125,
  Venus: 245.5,
  Saturn: 280.75,
  Rahu: 10.5,
  Ketu: 190.5,
  Ascendant: 331.208263794856,
});
const birthData = Object.freeze({
  localDate: '1990-11-26',
  localTime: '13:40:00',
  timezone: 'Asia/Kolkata',
  latitude: 17.385,
  longitude: 78.4867,
});

function engine() {
  const bodies = Object.freeze(
    Object.fromEntries(
      Object.entries(LONGITUDES).map(([body, siderealLongitudeDegrees]) => [
        body,
        Object.freeze({ body, siderealLongitudeDegrees }),
      ]),
    ),
  );
  return Object.freeze({
    calculate(input) {
      assert.deepEqual(input, {
        date: birthData.localDate,
        time: birthData.localTime,
        timezone: birthData.timezone,
        latitude: birthData.latitude,
        longitude: birthData.longitude,
      });
      return Object.freeze({ bodies });
    },
  });
}

function profiles() {
  return Object.freeze({
    async get({ principal, birthProfileId }) {
      if (principal.subject !== 'user-a' || birthProfileId !== 'profile-a') {
        const error = new Error();
        error.code = 'NOT_FOUND_OR_FORBIDDEN';
        throw error;
      }
      return Object.freeze({ id: 'profile-a', status: 'active', birthData });
    },
  });
}

function app(sideEffects) {
  const divisionalChartService = new DivisionalChartService({
    birthProfileService: profiles(),
    astronomicalEngine: engine(),
  });
  return createApi({
    authVerifier: createTestOnlyAuthVerifier({ a, b }),
    userResolver: { resolve: async () => ({ id: 'internal-user-id', status: 'active' }) },
    birthProfileService: { create: async () => null, list: async () => [], get: async () => null },
    divisionalChartService,
    secureReadingService: {
      async generateSecureReading() { sideEffects.readings += 1; },
    },
    requestIdGenerator: () => 'request-1',
  });
}

function assertSafe(value) {
  const text = JSON.stringify(value).toLowerCase();
  for (const prohibited of [
    'ciphertext',
    'encryptedbirthdata',
    'dek',
    'kms',
    'subject',
    'databaseurl',
    'connectionstring',
    'stack',
    'localdate',
    'localtime',
    'timezone',
    'latitude',
    'longitude',
  ]) {
    assert.equal(text.includes(prohibited), false, prohibited);
  }
}

function assertChart(chart, type) {
  assert.equal(chart.birthProfileId, 'profile-a');
  assert.equal(chart.chart, type);
  assert.deepEqual(chart.planets.map((planet) => planet.body), GRAHAS);
  assert.deepEqual(
    chart.houses.map((house) => house.house),
    Array.from({ length: 12 }, (_, index) => index + 1),
  );
  assert.equal(new Set(chart.houses.map((house) => house.house)).size, 12);
  assert.equal(new Set(chart.houses.map((house) => house.sign.rashiIndex)).size, 12);
  assert.deepEqual(chart.houses[0].sign, chart.ascendant.sign);
  assert.equal(chart.ascendant.house, 1);
  assert.equal(chart.planets.some((planet) => planet.body === 'Ascendant'), false);
  for (const planet of chart.planets) {
    assert.equal(typeof planet.degreeWithinSign, 'number');
    assert.equal(typeof planet.house, 'number');
    assert.deepEqual(planet.sign, chart.houses[planet.house - 1].sign);
    assert.equal(Object.hasOwn(planet, 'nakshatra'), false);
    assert.equal(Object.hasOwn(planet, 'retrograde'), false);
    assert.equal(Object.hasOwn(planet, 'motion'), false);
  }
  assert.equal(chart.calculation.zodiac, 'sidereal');
  assert.match(chart.calculation.degreeWithinSign, /Varga engine coordinate/);
  assertSafe(chart);
}

test('D9 and D10 expose owned, safe, chart-ready Varga projections without side effects', async () => {
  const sideEffects = { readings: 0 };
  const api = app(sideEffects);
  const d9Response = await api.inject({
    url: '/v1/birth-profiles/profile-a/divisional-charts/d9',
    headers: { authorization: 'Bearer a' },
  });
  const d10Response = await api.inject({
    url: '/v1/birth-profiles/profile-a/divisional-charts/d10',
    headers: { authorization: 'Bearer a' },
  });

  assert.equal(d9Response.statusCode, 200);
  assert.equal(d10Response.statusCode, 200);
  const d9 = d9Response.json().divisionalChart;
  const d10 = d10Response.json().divisionalChart;
  assertChart(d9, 'D9');
  assertChart(d10, 'D10');
  assert.notDeepEqual(d9.planets, d10.planets);
  assert.equal(sideEffects.readings, 0);
  await api.close();
});

test('divisional chart routes require authentication and preserve non-enumerating ownership', async () => {
  const api = app({ readings: 0 });
  assert.equal(
    (await api.inject('/v1/birth-profiles/profile-a/divisional-charts/d9')).statusCode,
    401,
  );
  const foreign = await api.inject({
    url: '/v1/birth-profiles/profile-a/divisional-charts/d10',
    headers: { authorization: 'Bearer b' },
  });
  assert.equal(foreign.statusCode, 404);
  assert.equal(JSON.stringify(foreign.json()).includes('profile-a'), false);
  assertSafe(foreign.json());
  assert.equal(
    (await api.inject({
      url: '/v1/birth-profiles/invalid.id/divisional-charts/d9',
      headers: { authorization: 'Bearer a' },
    })).statusCode,
    400,
  );
  await api.close();
});
