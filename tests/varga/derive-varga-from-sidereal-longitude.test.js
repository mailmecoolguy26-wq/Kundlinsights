'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { deriveVargaFromSiderealLongitude, normalizeSiderealLongitude, VARGA_DEFINITIONS, ENGINE_COORDINATE_PROVENANCE, deriveVargasForLayer1Bodies, deriveVargasForLayer2Bodies } = require('../../src/varga');
const { AstronomicalEngine, AstronomyEngineProvider } = require('../../src/astronomy');
const { classifyLayer1Bodies } = require('../../src/jyotish');

const RASHIS = ['Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya', 'Tula', 'Vrishchika', 'Dhanu', 'Makara', 'Kumbha', 'Meena'];
const D9_STARTS = ['Mesha', 'Makara', 'Tula', 'Karka', 'Mesha', 'Makara', 'Tula', 'Karka', 'Mesha', 'Makara', 'Tula', 'Karka'];
const D10_STARTS = ['Mesha', 'Makara', 'Mithuna', 'Meena', 'Simha', 'Vrishabha', 'Tula', 'Karka', 'Dhanu', 'Kanya', 'Kumbha', 'Vrishchika'];
const EPSILON = 1e-10;

function rashiName(index) { return RASHIS[((index % 12) + 12) % 12]; }

test('D1 is an identity mapping across all Rashis and sign boundaries', () => {
  RASHIS.forEach((name, index) => {
    const start = index * 30;
    const at = deriveVargaFromSiderealLongitude('D1', start);
    const below = deriveVargaFromSiderealLongitude('D1', start - EPSILON);
    const above = deriveVargaFromSiderealLongitude('D1', start + EPSILON);
    assert.equal(at.natalRashi.sanskritName, name);
    assert.equal(at.resultingRashi.sanskritName, name);
    assert.equal(at.resultingRashi.degreesWithinResultingRashi, 0);
    assert.equal(above.resultingRashi.sanskritName, name);
    assert.equal(below.resultingRashi.sanskritName, rashiName(index - 1));
  });
});

test('D9 maps every subdivision of every natal Rashi using BPHS modality starts', () => {
  RASHIS.forEach((natalName, natalIndex) => {
    for (let subdivision = 0; subdivision < 9; subdivision += 1) {
      const result = deriveVargaFromSiderealLongitude('D9', natalIndex * 30 + subdivision * (30 / 9));
      assert.equal(result.natalRashi.sanskritName, natalName);
      assert.equal(result.subdivision.index, subdivision + 1);
      assert.equal(result.resultingRashi.sanskritName, rashiName(RASHIS.indexOf(D9_STARTS[natalIndex]) + subdivision));
      assert.equal(result.resultingRashi.degreesWithinResultingRashi, 0);
    }
  });
});

test('D9 handles exact, below, and above every subdivision boundary', () => {
  RASHIS.forEach((_, natalIndex) => {
    for (let subdivision = 0; subdivision <= 9; subdivision += 1) {
      const boundary = natalIndex * 30 + subdivision * (30 / 9);
      const at = deriveVargaFromSiderealLongitude('D9', boundary);
      const below = deriveVargaFromSiderealLongitude('D9', boundary - EPSILON);
      const above = deriveVargaFromSiderealLongitude('D9', boundary + EPSILON);
      const expectedSubdivision = subdivision === 9 ? 1 : subdivision + 1;
      assert.equal(at.subdivision.index, expectedSubdivision);
      assert.equal(above.subdivision.index, expectedSubdivision);
      assert.equal(below.subdivision.index, subdivision === 0 ? 9 : subdivision);
    }
  });
});

test('D9 exposes the documented movable, fixed, and dual starting signs', () => {
  RASHIS.forEach((_, index) => assert.equal(deriveVargaFromSiderealLongitude('D9', index * 30).resultingRashi.sanskritName, D9_STARTS[index]));
});

test('D10 maps every subdivision of every natal Rashi using BPHS odd/even starts', () => {
  RASHIS.forEach((natalName, natalIndex) => {
    for (let subdivision = 0; subdivision < 10; subdivision += 1) {
      const result = deriveVargaFromSiderealLongitude('D10', natalIndex * 30 + subdivision * 3);
      assert.equal(result.natalRashi.sanskritName, natalName);
      assert.equal(result.subdivision.index, subdivision + 1);
      assert.equal(result.resultingRashi.sanskritName, rashiName(RASHIS.indexOf(D10_STARTS[natalIndex]) + subdivision));
      assert.equal(result.resultingRashi.degreesWithinResultingRashi, 0);
    }
  });
});

test('D10 handles exact, below, and above every subdivision boundary', () => {
  RASHIS.forEach((_, natalIndex) => {
    for (let subdivision = 0; subdivision <= 10; subdivision += 1) {
      const boundary = natalIndex * 30 + subdivision * 3;
      const at = deriveVargaFromSiderealLongitude('D10', boundary);
      const below = deriveVargaFromSiderealLongitude('D10', boundary - EPSILON);
      const above = deriveVargaFromSiderealLongitude('D10', boundary + EPSILON);
      const expectedSubdivision = subdivision === 10 ? 1 : subdivision + 1;
      assert.equal(at.subdivision.index, expectedSubdivision);
      assert.equal(above.subdivision.index, expectedSubdivision);
      assert.equal(below.subdivision.index, subdivision === 0 ? 10 : subdivision);
    }
  });
});

test('D10 exposes the documented odd and even starting signs', () => {
  RASHIS.forEach((_, index) => assert.equal(deriveVargaFromSiderealLongitude('D10', index * 30).resultingRashi.sanskritName, D10_STARTS[index]));
});

test('normalizes negative, oversized, zero, and 360-degree sidereal longitudes', () => {
  assert.equal(normalizeSiderealLongitude(-1), 359);
  assert.equal(normalizeSiderealLongitude(721.25), 1.25);
  assert.equal(deriveVargaFromSiderealLongitude('D9', 0).resultingRashi.sanskritName, 'Mesha');
  assert.deepEqual(deriveVargaFromSiderealLongitude('D10', 360), deriveVargaFromSiderealLongitude('D10', 0));
});

test('preserves full precision using the KundlInsights engine coordinate convention', () => {
  const longitude = 30 + (30 / 9) * 2 + 1.234567890123;
  const result = deriveVargaFromSiderealLongitude('D9', longitude);
  assert.ok(Math.abs(result.resultingRashi.degreesWithinResultingRashi - (1.234567890123 * 9)) < 1e-12);
  assert.equal(result.varga.engineCoordinateProvenance, ENGINE_COORDINATE_PROVENANCE);
  assert.notEqual(result.varga.classicalMappingProvenance, ENGINE_COORDINATE_PROVENANCE);
});

test('returns immutable results and keeps classical and engine provenance distinct', () => {
  const result = deriveVargaFromSiderealLongitude('D10', 17.125);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.varga));
  assert.ok(Object.isFrozen(result.resultingRashi));
  assert.match(result.varga.classicalMappingProvenance.source, /Brihat Parashara/);
  assert.match(result.varga.engineCoordinateProvenance.source, /KundlInsights/);
  assert.equal(Object.hasOwn(result, 'ayanamsha'), false);
  assert.equal(Object.hasOwn(result, 'provider'), false);
});

test('Layer 1 adapter consumes only each canonical sidereal longitude', () => {
  const layer1 = new AstronomicalEngine(new AstronomyEngineProvider()).calculate({ date: '1990-08-15', time: '14:30:00', timezone: 'Asia/Kolkata', latitude: 28.6139, longitude: 77.209 });
  const derived = deriveVargasForLayer1Bodies(layer1);
  assert.equal(derived.Sun.vargaCoordinates.D9.normalizedSiderealLongitudeDegrees, layer1.bodies.Sun.siderealLongitudeDegrees);
  assert.equal(Object.hasOwn(derived.Sun.vargaCoordinates.D9, 'provider'), false);
  assert.equal(Object.hasOwn(derived.Sun.vargaCoordinates.D9, 'ayanamsha'), false);
});

test('Layer 2 adapter reuses its normalized canonical sidereal longitude', () => {
  const layer1 = new AstronomicalEngine(new AstronomyEngineProvider()).calculate({ date: '1990-08-15', time: '14:30:00', timezone: 'Asia/Kolkata', latitude: 28.6139, longitude: 77.209 });
  const layer2Bodies = classifyLayer1Bodies(layer1);
  const derived = deriveVargasForLayer2Bodies(layer2Bodies);
  assert.equal(derived.Sun.vargaCoordinates.D10.normalizedSiderealLongitudeDegrees, layer2Bodies.Sun.jyotishCoordinates.normalizedLongitudeDegrees);
  assert.equal(Object.hasOwn(derived.Sun.vargaCoordinates.D10, 'provider'), false);
  assert.equal(Object.hasOwn(derived.Sun.vargaCoordinates.D10, 'ayanamsha'), false);
});

test('rejects unsupported Vargas and non-finite canonical sidereal longitudes', () => {
  assert.throws(() => deriveVargaFromSiderealLongitude('D30', 1), /Unsupported Varga/);
  assert.throws(() => deriveVargaFromSiderealLongitude('D9', Number.NaN), /finite/);
  assert.deepEqual(Object.keys(VARGA_DEFINITIONS), ['D1', 'D9', 'D10']);
});
