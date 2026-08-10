'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { AstronomicalEngine, AstronomyEngineProvider, validateProviderValidationFixture } = require('../../src/astronomy');
const { classifyLayer1Bodies } = require('../../src/jyotish');
const { deriveVargasForLayer1Bodies } = require('../../src/varga');
const experimentalFixture = require('./fixtures/experimental-provider-fixture.json');

const input = Object.freeze({ date: '1990-11-26', time: '13:40:00', timezone: 'Asia/Kolkata', latitude: 17.385, longitude: 78.4867 });

test('calculates a provisional eastern Ascendant and sends its canonical longitude through existing Layer 2 and Layer 3 adapters', () => {
  const engine = new AstronomicalEngine(new AstronomyEngineProvider());
  const result = engine.calculate(input);
  const ascendant = result.bodies.Ascendant;
  assert.ok(ascendant.tropicalLongitudeDegrees >= 0 && ascendant.tropicalLongitudeDegrees < 360);
  assert.ok(ascendant.siderealLongitudeDegrees >= 0 && ascendant.siderealLongitudeDegrees < 360);
  assert.equal(ascendant.provenance.intersection, 'eastern');
  assert.equal(ascendant.provenance.provisional, true);
  assert.equal(ascendant.siderealMetadata.calculationStatus, 'PROVISIONAL');
  assert.deepEqual(ascendant.longitudeProvenance, { tropical: 'provider-native', sidereal: 'derived-from-tropical' });
  const differentLocation = engine.calculate({ ...input, latitude: 28.6139, longitude: 77.209 });
  assert.notEqual(ascendant.tropicalLongitudeDegrees, differentLocation.bodies.Ascendant.tropicalLongitudeDegrees);
  const layer2 = classifyLayer1Bodies(result);
  const layer3 = deriveVargasForLayer1Bodies(result, ['D1', 'D9', 'D10']);
  assert.equal(layer2.Ascendant.jyotishCoordinates.normalizedLongitudeDegrees, ascendant.siderealLongitudeDegrees);
  assert.equal(layer3.Ascendant.vargaCoordinates.D1.normalizedSiderealLongitudeDegrees, ascendant.siderealLongitudeDegrees);
});

test('accepts provider-native canonical sidereal output without requiring a tropical longitude', () => {
  const nativeMetadata = Object.freeze({ system: 'Lahiri / Chitrapaksha', implementation: 'future-provider-native', calculationStatus: 'PROVISIONAL' });
  const provider = {
    calculate({ instant, observer }) {
      assert.ok(instant instanceof Date);
      assert.deepEqual(observer, { latitude: input.latitude, longitude: input.longitude, coordinateReference: 'WGS84' });
      return { provider: Object.freeze({ provider: 'test-native-provider' }), bodies: { Ascendant: { body: 'Ascendant', siderealLongitudeDegrees: 12.5, siderealMetadata: nativeMetadata, longitudeSpeedDegreesPerDay: null, motion: null, provenance: Object.freeze({ test: true }) } } };
    }
  };
  const siderealCalculator = { calculateSiderealLongitude() { throw new Error('Native sidereal output must not be recalculated.'); } };
  const result = new AstronomicalEngine(provider, siderealCalculator).calculate(input);
  assert.equal(result.bodies.Ascendant.siderealLongitudeDegrees, 12.5);
  assert.equal(result.bodies.Ascendant.tropicalLongitudeDegrees, undefined);
  assert.deepEqual(result.bodies.Ascendant.longitudeProvenance, { tropical: 'not-provided', sidereal: 'provider-native' });
});

test('validates the explicitly non-authoritative provider fixture format', () => {
  const fixture = validateProviderValidationFixture(experimentalFixture);
  assert.equal(fixture.authority, 'experimental-poc');
  assert.match(fixture.warning, /not a production golden reference/i);
  assert.equal(fixture.expected.Ascendant.siderealLongitudeDegrees, 331.2082637948555);
});
