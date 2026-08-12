'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { SwissNativeAdapter, SwissCanonicalSiderealSunSampler } = require('../../src/astronomy');
const { solveSolarReturn, solvePreviousSolarReturn, calculateVimshottariDasha, SOLAR_RETURN_VIMSHOTTARI_RULESET } = require('../../src/dasha');
const { SWISS_GOLDEN_PROVENANCE } = require('../astronomy/fixtures/swiss-golden-fixtures');
const { SWISS_C_SOLAR_RETURN_GOLDEN_PROVENANCE, HYDERABAD_SOLAR_RETURN_GOLDEN, SWISS_C_SOLAR_RETURN_MATRIX } = require('./fixtures/swiss-c-solar-return-golden-fixtures');

const ephemerisPath = process.env.KUNDLINSIGHTS_SWISS_REFERENCE_EPHEMERIS_PATH;
const delta = (actual, expected) => Math.abs(new Date(actual).getTime() - new Date(expected).getTime());

test('locks independently generated official Swiss-C solar-return fixture provenance and matrix without private data', () => {
  assert.equal(SWISS_C_SOLAR_RETURN_GOLDEN_PROVENANCE.fixtureStatus, 'INDEPENDENT_SWISS_C_GOLDEN');
  assert.equal(SWISS_C_SOLAR_RETURN_GOLDEN_PROVENANCE.swissVersion, '2.10.03');
  assert.equal(SWISS_C_SOLAR_RETURN_MATRIX.length, 12);
  assert.equal(Object.isFrozen(HYDERABAD_SOLAR_RETURN_GOLDEN), true);
  assert.equal(JSON.stringify(SWISS_C_SOLAR_RETURN_GOLDEN_PROVENANCE).includes('/Users/'), false);
});

test('Node P1/P2 match independent Swiss-C Hyderabad forward/backward and chronology goldens within one millisecond', { skip: !ephemerisPath }, () => {
  const fixture = HYDERABAD_SOLAR_RETURN_GOLDEN;
  const sampler = new SwissCanonicalSiderealSunSampler({ nativeAdapter: new SwissNativeAdapter({ ephemerisPath, manifest: SWISS_GOLDEN_PROVENANCE.manifest }) });
  const byIndex = Object.fromEntries(fixture.returns.map((item) => [item.index, item]));
  let prior = fixture.birthInstantUtc;
  for (const index of [1, 2, 3]) { const actual = solveSolarReturn({ sampler, priorInstantUtc: prior, targetLongitude: fixture.natalSunCanonicalSiderealLongitude }); assert.ok(delta(actual.instantUtc, byIndex[index].utc) <= 1); prior = actual.instantUtc; }
  let next = fixture.birthInstantUtc;
  for (const index of [-1, -2, -3]) { const actual = solvePreviousSolarReturn({ sampler, nextInstantUtc: next, targetLongitude: fixture.natalSunCanonicalSiderealLongitude }); assert.ok(delta(actual.instantUtc, byIndex[index].utc) <= 1); next = actual.instantUtc; }
  const result = calculateVimshottariDasha({ birthInstant: fixture.birthInstantUtc, moonCanonicalSiderealLongitude: fixture.moonCanonicalSiderealLongitude, rulesetId: SOLAR_RETURN_VIMSHOTTARI_RULESET.id, canonicalSiderealSunSampler: sampler, natalSunCanonicalSiderealLongitude: fixture.natalSunCanonicalSiderealLongitude });
  for (const lord of ['rahu', 'jupiter', 'saturn', 'mercury']) { const period = result.periods.find((item) => item.lord.id === lord); assert.ok(delta(period.startInstant.utc, fixture.chronology[lord].startUtc) <= 1); assert.ok(delta(period.endInstant.utc, fixture.chronology[lord].endUtc) <= 1); }
  const mercury = result.periods.find((item) => item.lord.id === 'mercury');
  assert.ok(delta(mercury.children[0].endInstant.utc, fixture.chronology.mercury.mercuryAntardashaEndUtc) <= 1);
  assert.ok(delta(mercury.children[0].children[0].endInstant.utc, fixture.chronology.mercury.mercuryPratyantardashaEndUtc) <= 1);
});
