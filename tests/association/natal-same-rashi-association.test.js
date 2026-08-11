'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { calculateNatalSameRashiAssociations, minimumCircularLongitudeSeparationDegrees, NATAL_SAME_RASHI_ASSOCIATION_RULESET_ID } = require('../../src/association');

function body(longitude, rashi) { return { canonicalSiderealLongitudeDegrees: longitude, ...(rashi === undefined ? {} : { rashi }) }; }
function calculate(bodies) { return calculateNatalSameRashiAssociations({ bodies }); }

test('emits canonical same-Rashi pairs only, including every unique pair in a group', () => {
  const result = calculate({ Saturn: body(25), Jupiter: body(10), Mars: body(20), Venus: body(35) });
  assert.equal(result.rulesetId, NATAL_SAME_RASHI_ASSOCIATION_RULESET_ID);
  assert.deepEqual(result.associations.map((item) => item.pair), [['Mars', 'Jupiter'], ['Mars', 'Saturn'], ['Jupiter', 'Saturn']]);
  assert.equal(result.associations.every((item) => item.rashi.rashiIndex === 1), true);
  assert.equal(result.associations.some((item) => item.pair.includes('Venus')), false);
  assert.equal(new Set(result.associations.map((item) => item.associationId)).size, 3);
});

test('uses Layer 2 half-open boundaries and canonical normalization without cross-Rashi association', () => {
  assert.equal(calculate({ Sun: body(29.999999), Moon: body(29) }).associations.length, 1);
  assert.equal(calculate({ Sun: body(29.999999), Moon: body(30) }).associations.length, 0);
  assert.equal(calculate({ Sun: body(0), Moon: body(360) }).associations.length, 1);
  assert.equal(calculate({ Sun: body(-1), Moon: body(719) }).associations.length, 1);
  assert.equal(calculate({ Sun: body(359), Moon: body(1) }).associations.length, 0);
  assert.equal(calculate({ Sun: body(359.999999), Moon: body(0), Mars: body(360), Mercury: body(0.000001) }).associations.length, 3);
});

test('preserves factual minimum circular distance without an orb decision', () => {
  assert.equal(minimumCircularLongitudeSeparationDegrees(10, 20), 10);
  assert.equal(minimumCircularLongitudeSeparationDegrees(359, 1), 2);
  const pair = calculate({ Sun: body(10), Moon: body(20) }).associations[0];
  assert.equal(pair.minimumCircularLongitudeSeparationDegrees, 10);
  assert.equal(Object.hasOwn(pair, 'orbDegrees'), false);
  assert.equal(Object.hasOwn(pair, 'conjunctionStrength'), false);
});

test('includes neutral nodes and excludes Ascendant', () => {
  const result = calculate({ Sun: body(10), Moon: body(11), Mars: body(12), Mercury: body(13), Jupiter: body(14), Venus: body(15), Saturn: body(16), Rahu: body(17), Ketu: body(18), Ascendant: body(19) });
  assert.equal(result.associations.length, 36);
  assert.equal(result.associations.some((item) => item.pair.includes('Rahu')), true);
  assert.equal(result.associations.some((item) => item.pair.includes('Ketu')), true);
  assert.equal(result.associations.some((item) => item.pair.includes('Ascendant')), false);
});

test('rejects contradictory or invalid inputs and unsupported participants', () => {
  assert.throws(() => calculate({ Sun: body(10, 2) }), /contradicts/);
  assert.throws(() => calculate({ Sun: body(NaN) }), /finite/);
  assert.throws(() => calculate({ Pluto: body(10) }), /Unsupported/);
  assert.throws(() => calculateNatalSameRashiAssociations({ bodies: {}, rulesetId: 'other' }), /Unsupported natal association ruleset/);
});

test('is deeply immutable, frozen-input safe, deterministic, and provider independent', () => {
  const bodies = Object.freeze({ Saturn: Object.freeze(body(25)), Jupiter: Object.freeze(body(10)), Mars: Object.freeze(body(20)) });
  const before = JSON.stringify(bodies); const first = calculate(bodies); const second = calculate({ Mars: body(20), Jupiter: body(10), Saturn: body(25) });
  assert.deepEqual(first, second); assert.equal(Object.isFrozen(first), true); assert.equal(Object.isFrozen(first.associations), true); assert.equal(Object.isFrozen(first.associations[0].pair), true); assert.equal(Object.isFrozen(first.associations[0].provenance), true); assert.equal(JSON.stringify(bodies), before);
  assert.equal(first.provenance.providerIndependent, true); assert.equal(first.provenance.astronomicalCalculation, 'not-performed'); assert.equal(first.provenance.ayanamshaCalculation, 'not-performed');
});

test('has no astronomy, Layer 9, combustion, orb, or Graha Yuddha dependency', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../src/association/natal-same-rashi-association.js'), 'utf8');
  assert.equal(source.includes("../astronomy"), false);
  assert.equal(source.includes("../gochar"), false);
  assert.equal(source.includes("../dignity"), false);
  assert.equal(source.includes('COMBUSTION_THRESHOLDS'), false);
  assert.equal(source.includes('orbDegrees'), false);
  assert.equal(source.includes('GrahaYuddha'), false);
});
