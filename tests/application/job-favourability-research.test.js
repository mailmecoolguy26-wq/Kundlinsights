'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateRashiHouses } = require('../../src/bhava/calculate-rashi-houses');
const { HORIZON_IDS, buildJobFavourabilityCohort, buildTemporalControls } = require('../../src/application/research/job-favourability-cohort-builder');
const { extractJobFavourabilityFeatureRows } = require('../../src/application/research/job-favourability-feature-extractor');
const { MAX_INTERACTION_ORDER, CANDIDATE_INTERACTIONS, runJobFavourabilityBacktest } = require('../../src/application/research/job-favourability-backtest-runner');
const { privateDirectory, renderJobFavourabilityResearchReport } = require('../../src/application/research/job-favourability-report');

const iso = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000Z`;
const coverage = (year, month, day, precision = 'DAY') => ({ start: iso(year, month, day), end: precision === 'DAY' ? iso(year, month, day + 1) : precision === 'MONTH' ? iso(year, month + 1, 1) : iso(year + 1, 1, 1) });
const observation = (type, year, month, day, precision = 'DAY') => ({ type, date: { precision, year, month: precision === 'YEAR' ? null : month, day: precision === 'DAY' ? day : null }, temporalCoverage: coverage(year, month || 1, day || 1, precision) });
const longitude = (sign) => ((sign - 1) * 30) + 10;
function d1() { return calculateRashiHouses({ ascendantCanonicalSiderealLongitude: longitude(12), bodies: { Sun: longitude(5), Moon: longitude(2), Mars: longitude(3), Mercury: longitude(4), Jupiter: longitude(9), Venus: longitude(5), Saturn: longitude(6), Rahu: longitude(7), Ketu: longitude(8) } }); }
function profile(id = 'profile-a') {
  return {
    birthProfileId: id, d1Houses: d1(),
    astronomyProvenance: { engineProfileId: 'engine', ayanamshaSystem: 'LAHIRI', nodePolicy: 'MEAN_RAHU_PLUS_180_KETU', dashaRulesetId: 'solar-v2', transitBoundaryMethod: 'refined' },
    events: [
      { careerEventId: 'transition-a', eventType: 'JOB_SWITCH', observations: [observation('OFFER', 2024, 5, 5), observation('JOINING', 2024, 6, 5)] },
      { careerEventId: 'promotion-a', eventType: 'PROMOTION', observations: [observation('PROMOTION', 2025, 6, 5)] },
      { careerEventId: 'business-a', eventType: 'BUSINESS_STARTED', observations: [observation('BUSINESS_START', 2026, 8, 5)] },
      { careerEventId: 'context-a', eventType: 'JOB_LOSS', observations: [observation('TERMINATION', 2027, 10, 5)] },
    ],
    dashaIntervals: [{ start: iso(2024, 1, 1), end: iso(2028, 1, 1), activePeriods: [{ level: 'MD', lord: 'Jupiter' }, { level: 'AD', lord: 'Sun' }, { level: 'PD', lord: 'Mercury' }] }],
    planetaryStateFacts: { bodies: { Sun: { dignity: { isOwnSign: true, isExalted: false, isDebilitated: false, isMoolatrikona: true }, combustion: { isCombust: false }, motion: { providerState: 'direct', isRetrograde: false } } } },
    h6BeneficOccupancyFacts: { classificationRulesetId: 'research-natural-benefic-facts-v1', occupantBodies: ['Venus'] },
    transitIntervals: [
      { planet: 'Jupiter', sign: 5, start: iso(2024, 4, 1), end: iso(2024, 7, 1) },
      { planet: 'Saturn', sign: 10, start: iso(2024, 1, 1), end: iso(2025, 1, 1) },
      { planet: 'Rahu', sign: 3, start: iso(2024, 1, 1), end: iso(2025, 1, 1) },
      { planet: 'Ketu', sign: 9, start: iso(2024, 1, 1), end: iso(2025, 1, 1) },
    ],
    transitEvents: [{ body: 'Jupiter', eventType: 'rashiIngress', instant: iso(2024, 4, 1), fromRashi: 4, toRashi: 5 }, { body: 'Jupiter', eventType: 'rashiIngress', instant: iso(2024, 6, 1), fromRashi: 5, toRashi: 4 }],
    genericCareerSignals: [{ start: iso(2024, 4, 1), end: iso(2024, 7, 1), evidenceState: 'POSSIBLE_CAREER_ACTIVITY_SIGNAL' }],
    d10Facts: { state: 'FACTUAL' }, moonSupportFacts: { jupiterSupportive: true }, ashtakavargaFacts: { h10Sav: 28 },
    recurrenceEvidence: [{ unitId: 'event:transition-a', profileId: id, present: true, generatedAt: iso(2024, 5, 4), sourceTransitions: [{ completedAt: iso(2020, 1, 1) }] }],
  };
}
function setup() { const p = profile(); const cohort = buildJobFavourabilityCohort({ profiles: [p], cohortSalt: 'private-test-salt' }); return { p, cohort, rows: extractJobFavourabilityFeatureRows({ profile: p, cohort }) }; }

test('deduplicates OFFER/JOINING into one employment-transition unit while retaining both factual anchors', () => {
  const { cohort } = setup(); const units = cohort.units.filter((unit) => unit.unitKind === 'EMPLOYMENT_TRANSITION');
  assert.equal(units.length, 1); assert.equal(units[0].eventFamily, 'OFFER_JOINING'); assert.deepEqual(units[0].anchors.map((item) => item.observationType), ['OFFER', 'JOINING']);
});

test('isolates positive, non-employment Career-control, context-only, and deterministic temporal-control families', () => {
  const { cohort } = setup();
  assert.equal(cohort.units.filter((unit) => unit.unitKind === 'EMPLOYMENT_TRANSITION').length, 1);
  assert.deepEqual(cohort.units.filter((unit) => unit.unitKind === 'CAREER_CONTROL').map((unit) => unit.eventFamily).sort(), ['BUSINESS_STARTED', 'PROMOTION']);
  assert.equal(cohort.units.some((unit) => unit.eventFamily === 'JOB_LOSS'), false);
  assert.ok(cohort.units.some((unit) => unit.unitKind === 'TEMPORAL_CONTROL'));
});

test('temporal controls stay outside the pre-registered maximum event exclusion zone', () => {
  const p = profile(); const controls = buildTemporalControls({ profileId: p.birthProfileId, pseudonymousProfileId: 'p', events: p.events });
  for (const control of controls) for (const event of p.events) for (const anchor of event.observations) {
    const distance = Math.min(Math.abs(Date.parse(control.anchors[0].coverage.start) - Date.parse(anchor.temporalCoverage.start)), Math.abs(Date.parse(control.anchors[0].coverage.start) - Date.parse(anchor.temporalCoverage.end)));
    assert.ok(distance >= 90 * 24 * 60 * 60 * 1000);
  }
});

test('preserves DAY and MONTH/YEAR coverage without inventing an exact event day', () => {
  const p = profile(); p.events[0].observations = [observation('OFFER', 2024, 5, 1, 'MONTH'), observation('JOINING', 2024, 6, 1, 'YEAR')];
  const cohort = buildJobFavourabilityCohort({ profiles: [p], cohortSalt: 'precision-salt' }); const rows = extractJobFavourabilityFeatureRows({ profile: p, cohort });
  assert.ok(rows.some((row) => row.eventPrecision === 'MONTH' && row.horizon.horizonId === 'PRE_30'));
  assert.ok(rows.some((row) => row.eventPrecision === 'YEAR' && row.horizon.horizonId === 'SYMMETRIC_90'));
  assert.equal(rows.filter((row) => row.eventPrecision !== 'DAY').every((row) => row.dasha.identities.values.pdState === 'NOT_APPLICABLE' && row.dasha.identities.values.pd === null), true);
  assert.equal(rows.some((row) => Object.hasOwn(row, 'eventDate')), false);
});

test('keeps profile partitions disjoint and never exposes raw profile IDs in feature rows', () => {
  const first = profile('profile-a'); const second = profile('profile-b'); const cohort = buildJobFavourabilityCohort({ profiles: [first, second], cohortSalt: 'split-salt' });
  for (const pseudonymousId of new Set(cohort.units.map((unit) => unit.pseudonymousProfileId))) assert.equal(new Set(cohort.units.filter((unit) => unit.pseudonymousProfileId === pseudonymousId).map((unit) => unit.partition)).size, 1);
  const rows = [...extractJobFavourabilityFeatureRows({ profile: first, cohort }), ...extractJobFavourabilityFeatureRows({ profile: second, cohort })];
  assert.equal(JSON.stringify(rows).includes('profile-a'), false); assert.equal(JSON.stringify(rows).includes('profile-b'), false);
});

test('keeps recurrence strictly prior, same-profile, and unavailable when only future source transitions exist', () => {
  const { p, cohort } = setup(); p.recurrenceEvidence = [{ unitId: 'event:transition-a', profileId: p.birthProfileId, present: true, sourceTransitions: [{ completedAt: iso(2025, 1, 1) }] }];
  const row = extractJobFavourabilityFeatureRows({ profile: p, cohort }).find((item) => item.unitId === 'event:transition-a' && item.horizon.horizonId === 'PRE_30');
  assert.equal(row.historicalRecurrence.state, 'UNAVAILABLE');
});

test('retains AVAILABLE, UNAVAILABLE, and NOT_APPLICABLE separately for factual feature missingness', () => {
  const { p, cohort } = setup(); delete p.moonSupportFacts; p.d1Houses = { houses: p.d1Houses.houses.filter((house) => house.houseNumber !== 6) };
  const row = extractJobFavourabilityFeatureRows({ profile: p, cohort })[0];
  assert.equal(row.moon.state, 'UNAVAILABLE'); assert.equal(row.dasha.h6Lord.state, 'NOT_APPLICABLE'); assert.equal(row.dasha.identities.state, 'AVAILABLE');
});

test('extracts H6 research-only Dasha levels and natal factual contexts without an employment conclusion', () => {
  const { rows } = setup(); const row = rows.find((item) => item.unitId === 'event:transition-a' && item.horizon.horizonId === 'PRE_30');
  assert.equal(row.h6LordActiveAtMd.state, 'AVAILABLE'); assert.equal(row.h6LordActiveAtMd.values.active, false);
  assert.equal(row.h6LordActiveAtAd.state, 'AVAILABLE'); assert.equal(row.h6LordActiveAtAd.values.body, 'Sun'); assert.equal(row.h6LordActiveAtAd.values.active, true);
  assert.equal(row.h6LordActiveAtPd.state, 'AVAILABLE'); assert.equal(row.h6LordActiveAtPd.values.active, false);
  assert.deepEqual(row.h6LordStrengthContext.values.dignity, { isOwnSign: true, isExalted: false, isDebilitated: false, isMoolatrikona: true });
  assert.deepEqual(row.h2H6H10AxisContext.values.houseLords, { h2: 'Mars', h6: 'Sun', h10: 'Jupiter' });
  assert.deepEqual(row.h2H6H10AxisContext.values.occupants.h6, ['Sun', 'Venus']);
  assert.deepEqual(row.h6BeneficOccupancyContext.values, { classificationRulesetId: 'research-natural-benefic-facts-v1', occupantBodies: ['Venus'] });
  assert.equal(/employment|offer|joining|promotion|business/i.test(JSON.stringify(row.h6LordStrengthContext.values)), false);
});

test('keeps H6 research contexts unavailable or not-applicable rather than deriving missing source facts', () => {
  const { p, cohort } = setup(); delete p.planetaryStateFacts; delete p.h6BeneficOccupancyFacts;
  const row = extractJobFavourabilityFeatureRows({ profile: p, cohort })[0];
  assert.equal(row.h6LordStrengthContext.state, 'UNAVAILABLE'); assert.equal(row.h6BeneficOccupancyContext.state, 'UNAVAILABLE');
  p.d1Houses = { houses: p.d1Houses.houses.filter((house) => house.houseNumber !== 6), planetaryAssignments: p.d1Houses.planetaryAssignments };
  const missingH6 = extractJobFavourabilityFeatureRows({ profile: p, cohort })[0];
  assert.equal(missingH6.h6LordActiveAtMd.state, 'NOT_APPLICABLE'); assert.equal(missingH6.h6LordStrengthContext.state, 'NOT_APPLICABLE'); assert.equal(missingH6.h6BeneficOccupancyContext.state, 'NOT_APPLICABLE');
});

test('uses only order-two pre-registered interactions, creates no composite score, and remains offline research only', () => {
  const { rows } = setup(); const report = runJobFavourabilityBacktest({ featureRows: rows });
  assert.equal(MAX_INTERACTION_ORDER, 2); assert.ok(CANDIDATE_INTERACTIONS.every((item) => item.order <= 2));
  assert.deepEqual(CANDIDATE_INTERACTIONS.filter((item) => item.id.includes('H6') || item.id.includes('AXIS')).map((item) => item.id), [
    'CAREER_DASHA_X_H6_LORD_ACTIVE_AD',
    'CAREER_DASHA_X_H6_LORD_ACTIVE_PD',
    'GENERIC_CAREER_SIGNAL_X_H6_LORD_ACTIVATION',
    'H2_H6_H10_AXIS_CONTEXT_X_CAREER_LINKED_DASHA',
  ]);
  assert.equal(report.futureProjectionEnabled, false); assert.equal(report.researchOnly, true); assert.equal(report.conclusion, 'RESEARCH_SIGNAL_ONLY');
  assert.ok(report.h6FactualContext.h6LordActiveAtAd.factualValuePrevalence.denominator > 0);
  assert.ok(report.h6FactualContext.h6BeneficOccupancyContext.factualValuePrevalence.numerator > 0);
  assert.equal(/"(?:composite)?score"\s*:/i.test(JSON.stringify(report)), false);
  assert.ok(report.candidateAnalyses.every((item) => item.incrementalDiscriminationVsGenericCareerBaseline === null || typeof item.incrementalDiscriminationVsGenericCareerBaseline === 'object'));
  assert.match(renderJobFavourabilityResearchReport(report), /offline research only/i); assert.match(renderJobFavourabilityResearchReport(report), /h6LordActiveAtAd/);
  assert.throws(() => privateDirectory('/tmp/not-private-backtest'));
});

test('does not alter production Career Answer DTOs or activate JOB_FAVOURABILITY_TIMING', () => {
  const { CareerQuestionType, CareerAnswerService } = require('../../src/application/career-answers');
  assert.equal(CareerQuestionType.JOB_FAVOURABILITY_TIMING, 'JOB_FAVOURABILITY_TIMING');
  assert.equal(new CareerAnswerService({ secureReadingService: { getReadingEntitlementStatus: async () => ({ career: { eligible: false } }), listSecureReadings: async () => [], getSecureReadingDetail: async () => null } }).jobFavourabilityResearchEnabled, false);
});
