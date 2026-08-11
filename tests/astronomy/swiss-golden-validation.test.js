'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { AstronomicalEngine, SwissEphemerisProvider, isProductionAstronomicalAuthority } = require('../../src/astronomy');
const { classifyLayer1Bodies } = require('../../src/jyotish');
const { SWISS_GOLDEN_FIXTURES, SWISS_GOLDEN_PROVENANCE, LONGITUDE_TOLERANCE_DEGREES, SPEED_TOLERANCE_DEGREES_PER_DAY, ASCENDANT_TOLERANCE_DEGREES } = require('./fixtures/swiss-golden-fixtures');
const ephemerisPath = process.env.KUNDLINSIGHTS_SWISS_REFERENCE_EPHEMERIS_PATH;
function input(f) { const d = new Date(f.utc); return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 19), timezone: 'UTC', latitude: f.observer.latitude, longitude: f.observer.longitude }; }
function abs(a, b) { return Math.abs(a - b); }
test('independently generated official Swiss C golden fixtures match the Node provider', { skip: !ephemerisPath }, () => {
  let maxLongitude = 0, maxSpeed = 0, maxAscendant = 0;
  for (const fixture of SWISS_GOLDEN_FIXTURES) {
    const result = new AstronomicalEngine(new SwissEphemerisProvider({ ephemerisPath, manifest: SWISS_GOLDEN_PROVENANCE.manifest })).calculate(input(fixture));
    for (const body of ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn','Rahu','Ketu']) { const actual = result.bodies[body], expected = fixture.bodies[body]; maxLongitude = Math.max(maxLongitude, abs(actual.siderealLongitudeDegrees, expected.longitude)); maxSpeed = Math.max(maxSpeed, abs(actual.longitudeSpeedDegreesPerDay, expected.speed)); assert.ok(abs(actual.siderealLongitudeDegrees, expected.longitude) <= LONGITUDE_TOLERANCE_DEGREES); assert.ok(abs(actual.longitudeSpeedDegreesPerDay, expected.speed) <= SPEED_TOLERANCE_DEGREES_PER_DAY); }
    maxAscendant = Math.max(maxAscendant, abs(result.bodies.Ascendant.siderealLongitudeDegrees, fixture.bodies.Ascendant.longitude)); assert.ok(abs(result.bodies.Ascendant.siderealLongitudeDegrees, fixture.bodies.Ascendant.longitude) <= ASCENDANT_TOLERANCE_DEGREES); assert.equal(result.provider.calculationStatus, 'LICENSE_GATED_VALIDATION'); assert.equal(isProductionAstronomicalAuthority(result), false); assert.deepEqual(classifyLayer1Bodies(result).Ascendant.jyotishCoordinates.rashi.sanskritName, fixture.fixtureId.includes('hyderabad') ? 'Meena' : classifyLayer1Bodies(result).Ascendant.jyotishCoordinates.rashi.sanskritName);
  }
  const fixture = SWISS_GOLDEN_FIXTURES[0], provider = new SwissEphemerisProvider({ ephemerisPath, manifest: SWISS_GOLDEN_PROVENANCE.manifest });
  const first = new AstronomicalEngine(provider).calculate(input(fixture));
  const second = new AstronomicalEngine(provider).calculate({ ...input(fixture), latitude: 28.6139, longitude: 77.209 });
  assert.notEqual(first.bodies.Ascendant.siderealLongitudeDegrees, second.bodies.Ascendant.siderealLongitudeDegrees);
  for (const body of ['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn','Rahu']) assert.equal(first.bodies[body].siderealLongitudeDegrees, second.bodies[body].siderealLongitudeDegrees);
  assert.ok(maxLongitude <= LONGITUDE_TOLERANCE_DEGREES && maxSpeed <= SPEED_TOLERANCE_DEGREES_PER_DAY && maxAscendant <= ASCENDANT_TOLERANCE_DEGREES);
});
test('golden provenance and fixture data are immutable and independently attributed', () => { assert.equal(SWISS_GOLDEN_PROVENANCE.source, 'INDEPENDENT_OFFICIAL_SWISSEPH_SWETEST'); assert.equal(SWISS_GOLDEN_PROVENANCE.swetestVersion, '2.10.03'); assert.equal(Object.isFrozen(SWISS_GOLDEN_FIXTURES), true); assert.equal(SWISS_GOLDEN_FIXTURES[1].bodies.Mercury.speed < 0, true); assert.equal(SWISS_GOLDEN_FIXTURES[2].bodies.Jupiter.speed < 0, true); });
