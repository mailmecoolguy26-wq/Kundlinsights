'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { deriveVargaFromSiderealLongitude, VARGA_DEFINITIONS, D60_RULESETS, deriveVargasForLayer1Bodies, deriveVargasForLayer2Bodies } = require('../../src/varga');
const { AstronomicalEngine, AstronomyEngineProvider } = require('../../src/astronomy');
const { classifyLayer1Bodies } = require('../../src/jyotish');

const NAMES = ['Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya', 'Tula', 'Vrishchika', 'Dhanu', 'Makara', 'Kumbha', 'Meena'];
const E = 1e-9;
const equal = { D2: ['parity', 2], D3: ['ordinal', 3], D4: ['ordinal', 4], D7: ['natalParity', 7], D12: ['natal', 12], D16: ['modality', 16], D20: ['modality', 20], D24: ['parityAnchor', 24], D27: ['element', 27], D40: ['parityAnchor', 40], D45: ['modality', 45] };
function name(i) { return NAMES[((i % 12) + 12) % 12]; }
function group(i, a) { return a.find(([key, values]) => values.includes(i))[0]; }
function expected(id, natal, part) {
  const parity = natal % 2 === 0 ? 'odd' : 'even'; const modality = group(natal + 1, [['movable', [1, 4, 7, 10]], ['fixed', [2, 5, 8, 11]], ['dual', [3, 6, 9, 12]]]); const element = group(natal + 1, [['fire', [1, 5, 9]], ['earth', [2, 6, 10]], ['air', [3, 7, 11]], ['water', [4, 8, 12]]]);
  if (id === 'D2') return parity === 'odd' ? name(part === 0 ? 4 : 3) : name(part === 0 ? 3 : 4);
  if (id === 'D3') return name(natal + [0, 4, 8][part]); if (id === 'D4') return name(natal + [0, 3, 6, 9][part]); if (id === 'D7') return name(natal + (parity === 'odd' ? 0 : 6) + part); if (id === 'D12') return name(natal + part);
  if (id === 'D16') return name({ movable: 0, fixed: 4, dual: 8 }[modality] + part); if (id === 'D20') return name({ movable: 0, fixed: 8, dual: 4 }[modality] + part); if (id === 'D24') return name((parity === 'odd' ? 4 : 3) + part); if (id === 'D27') return name({ fire: 0, earth: 3, air: 6, water: 9 }[element] + part); if (id === 'D40') return name((parity === 'odd' ? 0 : 6) + part); return name({ movable: 0, fixed: 4, dual: 8 }[modality] + part);
}

test('all newly supported equal Vargas map every part of all twelve natal Rashis', () => {
  for (const [id, [, divisor]] of Object.entries(equal)) for (let natal = 0; natal < 12; natal += 1) for (let part = 0; part < divisor; part += 1) {
    const result = deriveVargaFromSiderealLongitude(id, natal * 30 + part * (30 / divisor));
    assert.equal(result.resultingRashi.sanskritName, expected(id, natal, part), `${id} ${natal} ${part}`);
    assert.equal(result.subdivision.index, part + 1);
    assert.ok(Object.isFrozen(result)); assert.ok(result.varga.provenance.classicalPartRule.source.includes('Brihat Parashara'));
  }
});

test('all newly supported equal Vargas use exact half-open subdivision boundaries', () => {
  for (const [id, [, divisor]] of Object.entries(equal)) for (let natal = 0; natal < 12; natal += 1) for (let part = 0; part <= divisor; part += 1) {
    const b = natal * 30 + part * (30 / divisor); const at = deriveVargaFromSiderealLongitude(id, b); const below = deriveVargaFromSiderealLongitude(id, b - E); const above = deriveVargaFromSiderealLongitude(id, b + E);
    assert.equal(at.subdivision.index, part === divisor ? 1 : part + 1); assert.equal(above.subdivision.index, part === divisor ? 1 : part + 1); assert.equal(below.subdivision.index, part === 0 ? divisor : part);
  }
});

test('D30 preserves irregular classical intervals, lords, deities, projections, and coordinates', () => {
  const cases = [[1, 0, 5, 'Mars', 'Agni', 'Mesha'], [1, 5, 10, 'Saturn', 'Vayu', 'Kumbha'], [1, 10, 18, 'Jupiter', 'Indra', 'Dhanu'], [1, 18, 25, 'Mercury', 'Kubera', 'Mithuna'], [1, 25, 30, 'Venus', 'Varuna', 'Tula'], [2, 0, 5, 'Venus', 'Varuna', 'Vrishabha'], [2, 5, 12, 'Mercury', 'Kubera', 'Kanya'], [2, 12, 20, 'Jupiter', 'Indra', 'Meena'], [2, 20, 25, 'Saturn', 'Vayu', 'Makara'], [2, 25, 30, 'Mars', 'Agni', 'Vrishchika']];
  for (const [rashi, start, end, lord, deity, output] of cases) { const result = deriveVargaFromSiderealLongitude('D30', (rashi - 1) * 30 + start); assert.equal(result.classical.lord, lord); assert.equal(result.classical.deity, deity); assert.equal(result.resultingRashi.sanskritName, output); assert.equal(result.resultingRashi.degreesWithinResultingRashi, 0); assert.equal(result.varga.rulesetVersion, 'parashari-trimshamsha-projection-v1'); const below = deriveVargaFromSiderealLongitude('D30', (rashi - 1) * 30 + start - E); const above = deriveVargaFromSiderealLongitude('D30', (rashi - 1) * 30 + start + E); assert.notEqual(below.subdivision.index, result.subdivision.index); assert.equal(above.subdivision.index, result.subdivision.index); }
  const scaled = deriveVargaFromSiderealLongitude('D30', 10 + 4); assert.equal(scaled.resultingRashi.sanskritName, 'Dhanu'); assert.equal(scaled.resultingRashi.degreesWithinResultingRashi, 15);
});

test('D60 exposes both audited rulesets and their six fixtures', () => {
  const cases = [[0 + 10 / 60, 'Mesha', 'Mesha'], [30 + 10 / 60, 'Mesha', 'Vrishabha'], [60 + 40 / 60, 'Vrishabha', 'Karka'], [120 + 3 + 10 / 60, 'Tula', 'Kumbha'], [270 + 13 + 25 / 60, 'Mithuna', 'Meena'], [330 + 29 + 45 / 60, 'Meena', 'Kumbha']];
  for (const [longitude, absolute, santhanam] of cases) { assert.equal(deriveVargaFromSiderealLongitude('D60', longitude, { rulesetVersion: 'bphs-remainder-absolute-rashi-v1' }).resultingRashi.sanskritName, absolute); const result = deriveVargaFromSiderealLongitude('D60', longitude); assert.equal(result.resultingRashi.sanskritName, santhanam); assert.equal(result.varga.rulesetVersion, 'santhanam-natal-count-d60-v1'); }
  assert.deepEqual(Object.keys(D60_RULESETS), ['santhanam-natal-count-d60-v1', 'bphs-remainder-absolute-rashi-v1']);
  assert.equal(deriveVargaFromSiderealLongitude('D60', 0).classical.deity, 'Ghora'); assert.equal(deriveVargaFromSiderealLongitude('D60', 30).classical.deity, 'Chandrarekha');
});

test('new Vargas normalize canonical input and retain full precision', () => {
  for (const id of Object.keys(equal).concat(['D30', 'D60'])) { assert.deepEqual(deriveVargaFromSiderealLongitude(id, 360), deriveVargaFromSiderealLongitude(id, 0)); assert.equal(deriveVargaFromSiderealLongitude(id, -1).normalizedSiderealLongitudeDegrees, 359); assert.equal(deriveVargaFromSiderealLongitude(id, 721.25).normalizedSiderealLongitudeDegrees, 1.25); }
});

test('Layer adapters consume canonical sidereal longitude without provider or ayanamsha output', () => {
  const layer1 = new AstronomicalEngine(new AstronomyEngineProvider()).calculate({ date: '1990-08-15', time: '14:30:00', timezone: 'Asia/Kolkata', latitude: 28.6139, longitude: 77.209 }); const l1 = deriveVargasForLayer1Bodies(layer1); const l2 = deriveVargasForLayer2Bodies(classifyLayer1Bodies(layer1));
  assert.equal(l1.Sun.vargaCoordinates.D30.normalizedSiderealLongitudeDegrees, layer1.bodies.Sun.siderealLongitudeDegrees); assert.equal(l2.Sun.vargaCoordinates.D60.normalizedSiderealLongitudeDegrees, layer1.bodies.Sun.siderealLongitudeDegrees); assert.equal(Object.hasOwn(l1.Sun.vargaCoordinates.D30, 'ayanamsha'), false); assert.equal(Object.hasOwn(l2.Sun.vargaCoordinates.D60, 'provider'), false);
});
