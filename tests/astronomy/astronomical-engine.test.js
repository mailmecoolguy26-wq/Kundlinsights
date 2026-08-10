'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { AstronomicalEngine, AstronomyEngineProvider, SwissEphemerisProvider, InputValidationError, ProductionLicenseGateError, normalizeLongitude, interimLahiriAyanamsha } = require('../../src/astronomy');

const engine = new AstronomicalEngine(new AstronomyEngineProvider());
const base = { date: '1990-08-15', time: '14:30:00', timezone: 'Asia/Kolkata', latitude: 28.6139, longitude: 77.209 };
function calculate(overrides = {}) { return engine.calculate({ ...base, ...overrides }); }

test('calculates deterministic historical output with explicit tropical and sidereal fields', () => {
  const result = calculate();
  assert.equal(result.instant.utc, '1990-08-15T09:00:00.000Z');
  assert.deepEqual(Object.keys(result.bodies), ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu']);
  assert.ok(Math.abs(result.bodies.Sun.siderealLongitudeDegrees - 118.55969436738184) < 1e-10);
  for (const body of Object.values(result.bodies)) { assert.ok(body.tropicalLongitudeDegrees >= 0 && body.tropicalLongitudeDegrees < 360); assert.ok(body.siderealLongitudeDegrees >= 0 && body.siderealLongitudeDegrees < 360); assert.ok(Number.isFinite(body.longitudeSpeedDegreesPerDay)); assert.equal(Object.hasOwn(body, 'longitudeDegrees'), false); }
  assert.equal(result.provider.provider, 'Astronomy Engine'); assert.equal(result.provider.rawCoordinateSystem, 'apparent-geocentric-true-ecliptic-of-date'); assert.equal(result.calculationStatus, 'PROVISIONAL');
});

test('keeps precision near a 30-degree boundary without deriving a sign', () => { const result = calculate({ date: '2024-06-12', time: '13:00:00', timezone: 'UTC', latitude: 0, longitude: 0 }); assert.ok(Math.abs(result.bodies.Venus.siderealLongitudeDegrees - 60) < 0.001); assert.equal(Object.hasOwn(result.bodies.Venus, 'sign'), false); });
test('keeps precision near a 27-part boundary without deriving nakshatra data', () => { const result = calculate({ date: '2024-04-03', time: '04:00:00', timezone: 'UTC', latitude: 0, longitude: 0 }); assert.ok(Math.abs(result.bodies.Venus.siderealLongitudeDegrees - 25 * (360 / 27)) < 0.001); assert.equal(Object.hasOwn(result.bodies.Venus, 'nakshatra'), false); });
test('reports a retrograde planetary case using the signed longitude rate', () => { const result = calculate(); assert.equal(result.bodies.Saturn.motion, 'retrograde'); assert.ok(result.bodies.Saturn.longitudeSpeedDegreesPerDay < 0); });

test('keeps Rahu and Ketu exactly opposite in tropical and sidereal output', () => {
  const { Rahu, Ketu } = calculate().bodies;
  assert.ok(Math.abs(normalizeLongitude(Ketu.tropicalLongitudeDegrees - Rahu.tropicalLongitudeDegrees) - 180) < 1e-12);
  assert.ok(Math.abs(normalizeLongitude(Ketu.siderealLongitudeDegrees - Rahu.siderealLongitudeDegrees) - 180) < 1e-12);
  assert.equal(Rahu.coordinateSystem, 'mean-ascending-lunar-node; tropical-ecliptic-of-date'); assert.equal(Ketu.motion, 'retrograde');
});

test('normalizes UTC and non-UTC local time to the same instant', () => { const utc = calculate({ date: '1990-08-15', time: '09:00:00', timezone: 'UTC', latitude: 0, longitude: 0 }); const ist = calculate({ date: '1990-08-15', time: '14:30:00', timezone: 'Asia/Kolkata', latitude: 0, longitude: 0 }); assert.equal(utc.instant.utc, ist.instant.utc); assert.equal(utc.bodies.Moon.siderealLongitudeDegrees, ist.bodies.Moon.siderealLongitudeDegrees); });

test('uses interim Lahiri transform without internal display rounding', () => {
  const instant = new Date('2000-01-01T00:00:00.000Z'); assert.equal(interimLahiriAyanamsha(instant), 23.85648333333333);
  const result = calculate({ date: '2000-01-01', time: '00:00:00', timezone: 'UTC', latitude: 0, longitude: 0 }); const sun = result.bodies.Sun;
  assert.equal(sun.siderealLongitudeDegrees, normalizeLongitude(sun.tropicalLongitudeDegrees - sun.siderealMetadata.ayanamshaValueDegrees));
  assert.ok(String(sun.tropicalLongitudeDegrees).split('.')[1].length > 6); assert.equal(sun.siderealMetadata.implementation, 'interim-linear'); assert.equal(sun.siderealMetadata.provisional, true); assert.equal(sun.siderealMetadata.calculationStatus, 'PROVISIONAL');
});

test('rejects nonexistent and ambiguous local times at DST transitions', () => { assert.throws(() => calculate({ date: '2024-03-10', time: '02:30:00', timezone: 'America/New_York' }), (e) => e instanceof InputValidationError && e.code === 'NONEXISTENT_LOCAL_TIME'); assert.throws(() => calculate({ date: '2024-11-03', time: '01:30:00', timezone: 'America/New_York' }), (e) => e instanceof InputValidationError && e.code === 'AMBIGUOUS_LOCAL_TIME'); });
test('validates local input, IANA timezone, and WGS84 coordinates', () => { assert.throws(() => calculate({ date: '2024-02-30' }), InputValidationError); assert.throws(() => calculate({ timezone: 'IST' }), InputValidationError); assert.throws(() => calculate({ latitude: 90.00001 }), InputValidationError); assert.throws(() => calculate({ longitude: -180.00001 }), InputValidationError); });
test('uses runtime IANA historical offsets and preserves location as geocentric provenance', () => { const historical = calculate({ date: '1900-01-01', time: '12:00:00', timezone: 'Asia/Kolkata', latitude: 0, longitude: 0 }); assert.equal(historical.instant.utc, '1900-01-01T06:38:50.000Z'); const a = calculate({ latitude: 0, longitude: 0 }); const b = calculate({ latitude: 60, longitude: 120 }); assert.equal(a.bodies.Jupiter.tropicalLongitudeDegrees, b.bodies.Jupiter.tropicalLongitudeDegrees); assert.notDeepEqual(a.input, b.input); });
test('normalizes longitude wraparound at 0 and 360 degrees', () => { assert.equal(normalizeLongitude(360), 0); assert.equal(normalizeLongitude(-0.0000001), 359.9999999); assert.equal(normalizeLongitude(721.25), 1.25); });
test('blocks Swiss Ephemeris until the commercial-license release gate is completed', () => { assert.throws(() => new SwissEphemerisProvider(), ProductionLicenseGateError); });
