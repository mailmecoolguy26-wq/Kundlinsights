'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { AstronomicalEngine, SwissEphemerisProvider, AstronomyEngineProvider, isProductionAstronomicalAuthority, ProductionLicenseGateError } = require('../../src/astronomy');
const { classifyLayer1Bodies } = require('../../src/jyotish');
const { calculateRashiHouses } = require('../../src/bhava');
const { calculateLongitudeProportionalBirthBalance } = require('../../src/dasha');
const { calculateGocharSnapshot } = require('../../src/gochar');
const { SWISS_AUTHORITY_GOLDEN_FIXTURE_SCHEMA } = require('./fixtures/swiss-golden-fixtures');

const FLAGS = 2 | 256 | 65536;
function fakeAdapter() {
  const calls = [];
  return Object.freeze({ calls, swissVersion: '2.10.03', requestedFlags: FLAGS, julianDayUt: (instant) => { if (!(instant instanceof Date) || !Number.isFinite(instant.getTime())) throw new TypeError('invalid instant'); return 2450000.5; }, calculateBody: (_jd, body) => { calls.push(body); const index = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu'].indexOf(body); return Object.freeze({ longitude: 10 + index * 30.125, speed: body === 'Rahu' ? -0.052 : body === 'Saturn' ? -0.1 : 1.25, returnedFlags: FLAGS }); }, calculateAscendant: (_jd, observer) => { if (!observer || observer.coordinateReference !== 'WGS84') throw new TypeError('observer'); return Object.freeze({ longitude: 331.2082637948555, api: 'houses_ex2', houseSystemCarrier: 'W' }); } });
}
function input() { return Object.freeze({ date: '1990-11-26', time: '13:40:00', timezone: 'Asia/Kolkata', latitude: 17.385, longitude: 78.4867 }); }
function calculate() { return new AstronomicalEngine(new SwissEphemerisProvider({ nativeAdapter: fakeAdapter() })).calculate(input()); }

test('retains the zero-argument license gate and has no automatic provisional fallback', () => {
  assert.throws(() => new SwissEphemerisProvider(), ProductionLicenseGateError);
  assert.throws(() => new SwissEphemerisProvider({ nativeAdapter: {} }), /SwissNativeAdapter/);
});

test('returns exactly ten immutable provider-native Swiss bodies with Mean Rahu, derived Ketu, and Swiss Ascendant', () => {
  const result = calculate();
  assert.deepEqual(Object.keys(result.bodies), ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu', 'Ascendant']);
  assert.equal(result.provider.calculationStatus, 'LICENSE_GATED_VALIDATION');
  assert.equal(result.provider.productionAuthority, false);
  assert.equal(result.bodies.Rahu.provenance.nodeModel, 'MEAN_NODE');
  assert.equal(result.bodies.Ketu.siderealLongitudeDegrees, (result.bodies.Rahu.siderealLongitudeDegrees + 180) % 360);
  assert.equal(result.bodies.Ketu.longitudeSpeedDegreesPerDay, result.bodies.Rahu.longitudeSpeedDegreesPerDay);
  assert.equal(result.bodies.Ascendant.provenance.api, 'houses_ex2');
  assert.equal(result.bodies.Ascendant.provenance.houseCuspsExposed, false);
  assert.equal(result.bodies.Sun.longitudeProvenance.sidereal, 'provider-native');
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.provider), true);
  assert.equal(Object.isFrozen(result.bodies.Sun.provenance), true);
});

test('is deterministic, accepts frozen input, preserves native speed/motion, and does not use an interim converter', () => {
  const first = calculate();
  const second = calculate();
  assert.deepEqual(first, second);
  assert.equal(first.bodies.Sun.longitudeSpeedDegreesPerDay, 1.25);
  assert.equal(first.bodies.Saturn.motion, 'retrograde');
  assert.equal(first.bodies.Rahu.motion, 'retrograde');
  assert.equal(first.bodies.Sun.siderealMetadata.calculationMethod, 'Swiss Ephemeris native sidereal calculation');
  assert.equal(first.bodies.Sun.tropicalLongitudeDegrees, null);
});

test('remains compatible with existing Layer 2 and Layer 5A Ascendant consumers without modifying them', () => {
  const result = calculate();
  const layer2 = classifyLayer1Bodies(result);
  assert.equal(layer2.Ascendant.jyotishCoordinates.normalizedLongitudeDegrees, result.bodies.Ascendant.siderealLongitudeDegrees);
  const houses = calculateRashiHouses({ ascendantCanonicalSiderealLongitude: result.bodies.Ascendant.siderealLongitudeDegrees, bodies: result.bodies });
  assert.equal(houses.ascendant.rashi.sanskritName, 'Meena');
  const balance = calculateLongitudeProportionalBirthBalance(result.bodies.Moon.siderealLongitudeDegrees);
  assert.equal(balance.moonCanonicalSiderealLongitude, result.bodies.Moon.siderealLongitudeDegrees);
  const gochar = calculateGocharSnapshot({ snapshotInstant: result.instant.utc, natalBodies: result.bodies, natalHouses: houses, transitBodies: result.bodies });
  assert.equal(gochar.transitBodies.Saturn.transitCanonicalSiderealLongitudeDegrees, result.bodies.Saturn.siderealLongitudeDegrees);
});

test('production authority remains false for validation, provisional, and incomplete provenance and true only for an explicit synthetic full gate', () => {
  const validation = calculate();
  assert.equal(isProductionAstronomicalAuthority(validation), false);
  const provisional = new AstronomicalEngine(new AstronomyEngineProvider()).calculate(input());
  assert.equal(isProductionAstronomicalAuthority(provisional), false);
  const synthetic = JSON.parse(JSON.stringify(validation));
  synthetic.provider.calculationStatus = 'PRODUCTION';
  synthetic.provider.productionLicenseGate = true;
  synthetic.provider.ephemerisManifestStatus = 'VERIFIED';
  assert.equal(isProductionAstronomicalAuthority(synthetic), true);
  for (const mutate of [(x) => { x.provider.swissVersion = 'wrong'; }, (x) => { x.provider.binding.version = 'wrong'; }, (x) => { x.provider.nodeModel = 'TRUE_NODE'; }, (x) => { x.provider.siderealMode = 'wrong'; }, (x) => { x.provider.ephemerisManifestStatus = 'UNVERIFIED'; }, (x) => { x.provider.returnedFlagsByBody.Sun = 4; }, (x) => { x.bodies.Ascendant.provenance.api = 'not-swiss'; }]) {
    const rejected = JSON.parse(JSON.stringify(synthetic)); mutate(rejected); assert.equal(isProductionAstronomicalAuthority(rejected), false);
  }
});

test('keeps Swiss authority golden fixtures explicitly license/data-gated rather than inventing numeric references', () => {
  assert.equal(SWISS_AUTHORITY_GOLDEN_FIXTURE_SCHEMA.fixtureStatus, 'LICENSE_AND_DATA_GATED');
  assert.equal(SWISS_AUTHORITY_GOLDEN_FIXTURE_SCHEMA.source, 'official-swiss-c-or-swetest');
});
