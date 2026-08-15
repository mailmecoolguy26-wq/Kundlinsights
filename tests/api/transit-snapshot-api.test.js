'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi } = require('../../src/api');
const { TransitSnapshotService } = require('../../src/application/transit-snapshot');
const { calculateGocharSnapshot } = require('../../src/gochar');
const { calculateRashiHouses } = require('../../src/bhava');
const { createTestOnlyAuthVerifier } = require('../../src/api/test-only-auth-verifier');

const a = Object.freeze({ provider: 'supabase', subject: 'user-a', isAnonymous: false });
const b = Object.freeze({ provider: 'supabase', subject: 'user-b', isAnonymous: false });
const BIRTH = Object.freeze({ Sun: 220.25, Moon: 319.519869761, Mars: 102.5, Mercury: 195.75, Jupiter: 75.125, Venus: 245.5, Saturn: 280.75, Rahu: 10.5, Ketu: 190.5, Ascendant: 331.208263794856 });
const TRANSIT = Object.freeze({ Sun: 20.25, Moon: 350.5, Mars: 102.25, Mercury: 197.75, Jupiter: 75.625, Venus: 246.5, Saturn: 280.5, Rahu: 10.25, Ketu: 190.25, Ascendant: 330.5 });
const AT = '2026-08-15T12:34:56.789Z';
const birthData = Object.freeze({ localDate: '1990-11-26', localTime: '13:40:00', timezone: 'Asia/Kolkata', latitude: 17.385, longitude: 78.4867 });

function body(name, longitude) {
  const speed = name === 'Ascendant' ? null : name === 'Saturn' || name === 'Rahu' || name === 'Ketu' ? -0.1 : 1;
  return Object.freeze({ body: name, siderealLongitudeDegrees: longitude, longitudeSpeedDegreesPerDay: speed, motion: speed === null ? null : speed < 0 ? 'retrograde' : 'direct' });
}

function layer1(longitudes) {
  return Object.freeze({ bodies: Object.freeze(Object.fromEntries(Object.entries(longitudes).map(([name, longitude]) => [name, body(name, longitude)]))) });
}

function engine() {
  const expectedBirth = { date: birthData.localDate, time: birthData.localTime, timezone: birthData.timezone, latitude: birthData.latitude, longitude: birthData.longitude };
  const expectedTransit = { date: '2026-08-15', time: '12:34:56.789', timezone: 'UTC', latitude: birthData.latitude, longitude: birthData.longitude };
  return Object.freeze({
    calculate(input) {
      if (JSON.stringify(input) === JSON.stringify(expectedBirth)) return layer1(BIRTH);
      if (JSON.stringify(input) === JSON.stringify(expectedTransit)) return layer1(TRANSIT);
      throw new Error('Unexpected astronomical input.');
    },
  });
}

function profiles(counter) {
  return Object.freeze({
    async get({ principal, birthProfileId }) {
      counter.gets += 1;
      if (principal.subject !== 'user-a' || birthProfileId !== 'profile-a') {
        const error = new Error(); error.code = 'NOT_FOUND_OR_FORBIDDEN'; throw error;
      }
      return Object.freeze({ id: 'profile-a', status: 'active', birthData });
    },
  });
}

function app(counter = { gets: 0 }, astronomicalEngine = engine()) {
  const transitSnapshotService = new TransitSnapshotService({ birthProfileService: profiles(counter), astronomicalEngine });
  return createApi({
    authVerifier: createTestOnlyAuthVerifier({ a, b }),
    userResolver: { resolve: async () => ({ id: 'internal-user-id', status: 'active' }) },
    birthProfileService: { create: async () => null, list: async () => [], get: async () => null },
    transitSnapshotService,
    secureReadingService: {},
    requestIdGenerator: () => 'request-1',
  });
}

function assertSafe(value) {
  const text = JSON.stringify(value).toLowerCase();
  for (const prohibited of ['ciphertext', 'encryptedbirthdata', 'dek', 'kms', 'subject', 'databaseurl', 'connectionstring', 'stack', 'localdate', 'localtime', 'timezoneprovenance', 'association', 'aspect', 'drishti', 'event']) {
    assert.equal(text.includes(prohibited), false, prohibited);
  }
}

test('GET transit snapshot maps the existing Gochar authority into a safe factual DTO', async () => {
  const api = app();
  const response = await api.inject({ url: `/v1/birth-profiles/profile-a/transits?at=${encodeURIComponent(AT)}`, headers: { authorization: 'Bearer a' } });
  assert.equal(response.statusCode, 200);
  const result = response.json().transitSnapshot;
  assert.equal(result.birthProfileId, 'profile-a');
  assert.equal(result.at, AT);
  assert.deepEqual(result.planets.map((item) => item.planet), ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu']);
  assert.equal(new Set(result.planets.map((item) => item.planet)).size, 9);
  const expected = calculateGocharSnapshot({
    snapshotInstant: AT,
    natalBodies: layer1(BIRTH).bodies,
    natalHouses: calculateRashiHouses({ ascendantCanonicalSiderealLongitude: BIRTH.Ascendant, bodies: layer1(BIRTH).bodies }),
    transitBodies: layer1(TRANSIT).bodies,
  });
  for (const item of result.planets) {
    const source = expected.transitBodies[item.planet];
    assert.equal(item.longitude, source.transitCanonicalSiderealLongitudeDegrees);
    assert.deepEqual(item.sign, {
      rashiIndex: source.transitRashi.rashiIndex,
      sanskritName: source.transitRashi.sanskritName,
      englishName: source.transitRashi.englishName,
    });
    assert.equal(item.degreeWithinSign, source.transitDegreeWithinRashi);
    assert.equal(item.natalHouse, source.transitNatalHouseNumber);
    assert.equal(item.motion, source.motion);
    assert.equal(item.retrograde, source.motion === 'retrograde');
  }
  assert.deepEqual(result.sadeSati, { active: true, phase: 'rising', houseFromNatalMoon: 12 });
  assertSafe(response.json());
  await api.close();
});

test('transit snapshot requires authentication, UTC RFC3339 at, and safe owned-profile access', async () => {
  const api = app();
  assert.equal((await api.inject(`/v1/birth-profiles/profile-a/transits?at=${AT}`)).statusCode, 401);
  for (const at of [undefined, '2026-08-15T12:34:56', '2026-08-15T12:34:56+00:00', 'not-an-instant']) {
    const suffix = at === undefined ? '' : `?at=${encodeURIComponent(at)}`;
    const response = await api.inject({ url: `/v1/birth-profiles/profile-a/transits${suffix}`, headers: { authorization: 'Bearer a' } });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error.code, 'INVALID_TRANSIT_INSTANT');
    assertSafe(response.json());
  }
  const forbidden = await api.inject({ url: `/v1/birth-profiles/profile-a/transits?at=${AT}`, headers: { authorization: 'Bearer b' } });
  assert.equal(forbidden.statusCode, 404);
  assert.equal(JSON.stringify(forbidden.json()).includes('profile-a'), false);
  assertSafe(forbidden.json());
  const invalidProfile = await api.inject({ url: `/v1/birth-profiles/invalid.id/transits?at=${AT}`, headers: { authorization: 'Bearer a' } });
  assert.equal(invalidProfile.statusCode, 400);
  assertSafe(invalidProfile.json());
  await api.close();
});

test('transit snapshots are on-demand reads with no reading, entitlement, or persistence side effects', async () => {
  const counter = { gets: 0 };
  const api = app(counter);
  const response = await api.inject({ url: `/v1/birth-profiles/profile-a/transits?at=${AT}`, headers: { authorization: 'Bearer a' } });
  assert.equal(response.statusCode, 200);
  assert.equal(counter.gets, 1);
  await api.close();
});

test('transit snapshot calculation failures retain the safe API error envelope', async () => {
  const api = app({ gets: 0 }, Object.freeze({
    calculate() { throw new Error('Sensitive astronomical provider detail.'); },
  }));
  const response = await api.inject({ url: `/v1/birth-profiles/profile-a/transits?at=${AT}`, headers: { authorization: 'Bearer a' } });
  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.json().error, {
    code: 'TRANSIT_SNAPSHOT_CALCULATION_FAILED',
    message: 'Internal server error.',
  });
  assertSafe(response.json());
  await api.close();
});
