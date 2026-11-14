'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createDevelopmentAstrology } = require('../../src/runtime/create-development-astrology');
const { calculateVimshottariDasha, SOLAR_RETURN_VIMSHOTTARI_RULESET } = require('../../src/dasha');
const { calculateRashiHouses } = require('../../src/bhava');
const { buildCareerD10Structure } = require('../../src/application/divisional-charts');
const { d10CareerStructure, futureMajorTransitIntervals, CAREER_TRANSIT_BOUNDARY_METHOD } = require('../../src/orchestration/birth-career-reading-orchestrator');
const { CareerV2LocalEvidenceProvider, dashaIntervals, createProductionCompatibleLocalCareerV2EvidenceProvider } = require('../../src/development/career-v2-local-evidence-provider');

const birthData = Object.freeze({ date: '1990-11-26', time: '13:40:00', timezone: 'Asia/Kolkata', latitude: 17.385, longitude: 78.4867 });
const historical = Object.freeze({ profileId: 'PROFILE_001', birthData, evaluationInstant: '2024-01-15T00:00:00.000Z', rangeStart: '2024-01-01T00:00:00.000Z', rangeEnd: '2024-02-01T00:00:00.000Z' });
const future = Object.freeze({ ...historical, evaluationInstant: '2026-01-15T00:00:00.000Z', rangeStart: '2026-01-01T00:00:00.000Z', rangeEnd: '2026-02-01T00:00:00.000Z' });

function setup() {
  const astrology = createDevelopmentAstrology();
  return { astrology, provider: new CareerV2LocalEvidenceProvider({ astronomicalEngine: astrology.astronomicalEngine, canonicalSiderealSunSampler: astrology.canonicalSiderealSunSampler }) };
}

test('same birth/range produces deterministic D1, Dasha, D10 and transit evidence', async () => {
  const { provider } = setup();
  const left = await provider.provide(historical); const right = await provider.provide(historical);
  assert.deepEqual(left, right);
  assert.equal(left.d1Houses.houses.length, 12);
  assert.equal(left.dashaIntervals.every((item) => item.activePeriods.map((period) => period.level).join('/') === 'MD/AD/PD'), true);
  assert.equal(left.transitIntervals.every((item) => ['Jupiter', 'Saturn'].includes(item.planet) && item.boundaryMethod === CAREER_TRANSIT_BOUNDARY_METHOD), true);
  assert.equal(left.d10Structure.chart, 'D10');
  assert.equal(left.provenance.databaseAccess, 'NONE');
  assert.equal(left.provenance.networkAccess, 'NONE');
});

test('Dasha PD boundaries exactly match the production solar-return Vimshottari engine', async () => {
  const { astrology, provider } = setup(); const actual = await provider.provide(historical);
  const natal = astrology.astronomicalEngine.calculate(birthData);
  const tree = calculateVimshottariDasha({ birthInstant: natal.instant.utc, moonCanonicalSiderealLongitude: natal.bodies.Moon.siderealLongitudeDegrees, natalSunCanonicalSiderealLongitude: natal.bodies.Sun.siderealLongitudeDegrees, canonicalSiderealSunSampler: astrology.canonicalSiderealSunSampler, rulesetId: SOLAR_RETURN_VIMSHOTTARI_RULESET.id });
  assert.deepEqual(actual.dashaIntervals, dashaIntervals(tree, historical.rangeStart, historical.rangeEnd));
  assert.equal(actual.provenance.dashaRulesetId, SOLAR_RETURN_VIMSHOTTARI_RULESET.id);
});

test('D10 structure and refined Jupiter/Saturn intervals match production Career helpers', async () => {
  const { astrology, provider } = setup(); const actual = await provider.provide(historical);
  const natal = astrology.astronomicalEngine.calculate(birthData);
  const houses = calculateRashiHouses({ ascendantCanonicalSiderealLongitude: natal.bodies.Ascendant.siderealLongitudeDegrees, bodies: natal.bodies });
  assert.deepEqual(actual.d10Structure, buildCareerD10Structure({ d10: d10CareerStructure(natal) }));
  assert.deepEqual(actual.transitIntervals, futureMajorTransitIntervals({ astronomicalEngine: astrology.astronomicalEngine, start: historical.rangeStart, end: historical.rangeEnd, place: birthData, natalBodies: natal.bodies, natalHouses: houses }));
});

test('historical and future ranges change temporal coverage without changing natal evidence', async () => {
  const { provider } = setup();
  const past = await provider.provide(historical); const next = await provider.provide(future);
  assert.deepEqual(past.d1Houses, next.d1Houses);
  assert.deepEqual(past.d10Structure, next.d10Structure);
  assert.equal(past.forecastStart, historical.rangeStart);
  assert.equal(next.forecastStart, future.rangeStart);
  assert.notDeepEqual(past.dashaIntervals, next.dashaIntervals);
  assert.notDeepEqual(past.transitIntervals, next.transitIntervals);
});

test('built-in local selector reuses the production provisional astronomy selection without database access', async () => {
  const evidenceProvider = createProductionCompatibleLocalCareerV2EvidenceProvider({ env: {} });
  const result = await evidenceProvider(historical);
  assert.equal(result.provenance.calculationStatus, 'PROVISIONAL');
  assert.equal(result.provenance.databaseAccess, 'NONE');
  assert.equal(JSON.stringify(result).includes('birthData'), false);
});

test('provider rejects identity fields and unbounded or invalid requests before calculation', async () => {
  const { provider } = setup();
  await assert.rejects(() => provider.provide({ ...historical, userId: 'user-a' }), /unsupported fields/i);
  await assert.rejects(() => provider.provide({ ...historical, profileId: 'real-database-id' }), /anonymized/i);
  await assert.rejects(() => provider.provide({ ...historical, rangeEnd: historical.rangeStart }), /bounded UTC range/i);
});
