'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { FamilyExpansionCalibrationAdapter, FAMILY_EXPANSION_CALIBRATION_ADAPTER_VERSION, REPRODUCTIVE_SAFETY_POLICY, retrospectiveSampleInstants, familyExpansionCalibrationCandidates } = require('../../src/application/family-expansion');
const { LifeEventCalibrationCoordinator } = require('../../src/application/life-event-calibration');

const interval = (from, to) => ({ from, to, timezone: 'UTC' });
const event = (id, eventType = 'CHILD_BIRTH', precision = 'DAY') => ({ lifeEventId: id, category: 'RELATIONSHIPS_FAMILY', eventType, eventDate: precision === 'DAY' ? { precision, year: 2020, month: 2, day: 2 } : precision === 'MONTH' ? { precision, year: 2020, month: 2 } : { precision, year: 2020 } });
const evidence = (precision) => ({ foundation: { state: 'CONSTRUCTIVE', constructiveSignals: ['jupiter'], cautionSignals: [], fifthLord: 'moon' }, d7: { available: true, validated: true, confirmation: 'Reinforcing', rulesetId: 'parashari-saptamsha-v1' }, dasha: [{ state: 'FAMILY_RELEVANT', eligible: true, md: 'moon', ad: 'jupiter', pd: 'venus', pdRefinement: 'Strengthening' }], transit: [{ jupiter: true, saturn: false, venus: true, caution: 0 }], ashtakavarga: { confirmation: 'AVAILABLE_CONTEXT', policy: 'CONFIRMATION_ONLY' }, intervalSummary: { policy: precision === 'DAY' ? 'EXACT_DAY' : precision === 'MONTH' ? 'INTERVAL_START_MIDPOINT_END_MINUS_ONE' : 'BROAD_INTERVAL_START_MIDPOINT_END_MINUS_ONE', sampleInstants: [] } });
function fixture({ extractor = null } = {}) { const calls = []; const adapter = new FamilyExpansionCalibrationAdapter({ birthProfileService: { get: async () => ({ birthData: { timezone: 'Asia/Kolkata' } }) }, astronomicalEngine: { calculate: () => ({}) }, canonicalSiderealSunSampler: () => 0, retrospectiveEvidenceExtractor: extractor || (async (input) => { calls.push(input); return evidence(input.datePrecision); }) }); return { adapter, calls }; }

test('supports only CHILD_BIRTH as one family-milestone cohort', async () => {
  const { adapter } = fixture();
  assert.equal(adapter.domainCalibrationVersion, FAMILY_EXPANSION_CALIBRATION_ADAPTER_VERSION);
  assert.equal(adapter.supports(event('child')), true); assert.equal(adapter.cohortFor(event('child')), 'CHILD_BIRTH');
  assert.equal(adapter.supports(event('marriage', 'MARRIAGE')), false); assert.equal(adapter.supports(event('engagement', 'ENGAGEMENT')), false);
  assert.equal(await adapter.resolveTimezone({ principal: {}, birthProfileId: 'profile-a' }), 'Asia/Kolkata');
});

test('passes exact DAY and full MONTH/YEAR intervals to existing family evidence extraction', async () => {
  const { adapter, calls } = fixture();
  const events = [['DAY', '2020-02-02T00:00:00.000Z', '2020-02-03T00:00:00.000Z'], ['MONTH', '2020-02-01T00:00:00.000Z', '2020-03-01T00:00:00.000Z'], ['YEAR', '2020-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z']].map(([precision, from, to]) => ({ event: event(precision.toLowerCase(), 'CHILD_BIRTH', precision), interval: interval(from, to), calibrationCohort: 'CHILD_BIRTH' }));
  const output = await adapter.extractRetrospectiveEvidence({ principal: {}, birthProfileId: 'profile-a', events });
  assert.deepEqual(calls.map((item) => [item.datePrecision, item.interval.from, item.interval.to]), [['DAY', '2020-02-02T00:00:00.000Z', '2020-02-03T00:00:00.000Z'], ['MONTH', '2020-02-01T00:00:00.000Z', '2020-03-01T00:00:00.000Z'], ['YEAR', '2020-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z']]);
  assert.deepEqual(output.fingerprints.map((item) => item.qualityFlags.at(-1)), ['EXACT_DAY_INTERVAL', 'MONTH_INTERVAL_SUMMARIZED', 'YEAR_INTERVAL_SUMMARIZED']);
  assert.deepEqual(output.fingerprints[0].evidenceFamilies, ['FOUNDATION', 'DIVISIONAL_CHART', 'DASHA', 'TRANSIT', 'ASHTAKAVARGA']);
});

test('uses full-interval MONTH/YEAR samples without inventing a milestone day', () => {
  assert.deepEqual(retrospectiveSampleInstants(interval('2020-02-02T00:00:00.000Z', '2020-02-03T00:00:00.000Z'), 'DAY'), ['2020-02-02T00:00:00.000Z']);
  const month = retrospectiveSampleInstants(interval('2020-02-01T00:00:00.000Z', '2020-03-01T00:00:00.000Z'), 'MONTH'); const year = retrospectiveSampleInstants(interval('2020-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z'), 'YEAR');
  assert.equal(month.length, 3); assert.notEqual(month[1], month[0]); assert.match(month.at(-1), /^2020-02-29T23:59:59\.999Z$/);
  assert.equal(year.length, 3); assert.notEqual(year[1], year[0]); assert.match(year.at(-1), /^2020-12-31T23:59:59\.999Z$/);
});

test('matches only structured approved family evidence and limits contradictory history', async () => {
  const { adapter } = fixture(); const entries = ['a', 'b', 'c'].map((id) => ({ event: event(id), interval: interval('2020-02-02T00:00:00.000Z', '2020-02-03T00:00:00.000Z'), calibrationCohort: 'CHILD_BIRTH' }));
  const fingerprints = (await adapter.extractRetrospectiveEvidence({ principal: {}, birthProfileId: 'profile-a', events: entries })).fingerprints;
  const candidate = [{ candidateId: 'family', primaryEvidenceFingerprint: { pd: 'venus', transitRegime: 'JUPITER' } }]; const context = { primaryFamilyEvidence: { d1: { state: 'CONSTRUCTIVE' }, d7: { confirmation: 'Reinforcing' } } };
  const matched = await adapter.annotateCandidates({ events: entries, fingerprints, primaryCandidates: candidate, adapterContext: context }); assert.equal(matched[0].matchedEventIds.length, 3); assert.equal(matched[0].tieBreakEligible, true);
  const contradictory = structuredClone(fingerprints); contradictory.forEach((item) => { item.evidenceFingerprint.dasha[0].pd = 'saturn'; });
  const noMatch = await adapter.annotateCandidates({ events: entries, fingerprints: contradictory, primaryCandidates: candidate, adapterContext: context }); assert.equal(noMatch[0].matchedEventIds.length, 0); assert.deepEqual(noMatch[0].contradictionFlags, ['MATERIAL_FAMILY_TIMING_PATTERN_VARIATION']);
});

test('applies one/two/three event thresholds, mutations, deletion, and profile isolation dynamically', async () => {
  const { adapter, calls } = fixture(); let ownEvents = [event('one')];
  const coordinator = new LifeEventCalibrationCoordinator({ canonicalEventLoader: async ({ birthProfileId }) => birthProfileId === 'profile-a' ? ownEvents : [event('foreign')], clock: () => '2026-01-01T00:00:00.000Z' });
  const options = { principal: { subject: 'user-a' }, birthProfileId: 'profile-a', adapter, primaryCandidates: [{ candidateId: 'family-candidate', primaryRank: 0, primaryState: 'Supportive', primaryStrength: 'Supportive', start: '2026-02-01T00:00:00.000Z', end: '2026-03-01T00:00:00.000Z', primaryEvidenceFingerprint: { pd: 'venus', transitRegime: 'JUPITER' } }], primaryDomainRulesVersion: 'family-expansion-rules-v1', adapterContext: { primaryFamilyEvidence: { d1: { state: 'CONSTRUCTIVE' }, d7: { confirmation: 'Reinforcing' } } } };
  assert.equal((await coordinator.calibrate(options)).thresholdLevel, 'CONTEXT_ONLY'); ownEvents = [event('one'), event('two')]; assert.equal((await coordinator.calibrate(options)).thresholdLevel, 'WEAK_PATTERN'); ownEvents = [event('one'), event('two'), event('three')]; assert.equal((await coordinator.calibrate(options)).thresholdLevel, 'PATTERN_ELIGIBLE');
  ownEvents = [event('one'), event('two', 'CHILD_BIRTH', 'MONTH'), event('three', 'MARRIAGE')]; const edited = await coordinator.calibrate(options); assert.equal(edited.thresholdLevel, 'WEAK_PATTERN'); assert.equal(calls.some((call) => call.datePrecision === 'MONTH'), true);
  ownEvents = [{ ...event('one'), deletedAt: '2025-01-01T00:00:00.000Z' }]; assert.equal((await coordinator.calibrate(options)).status, 'NO_EVENTS');
});

test('never reads title/note medical or child-detail free text and emits no reproductive prediction fields', async () => {
  const { adapter } = fixture(); const input = { event: { ...event('child'), title: 'boy', note: 'IVF conceived pregnancy complication miscarriage fertility treatment' }, interval: interval('2020-02-02T00:00:00.000Z', '2020-02-03T00:00:00.000Z'), calibrationCohort: 'CHILD_BIRTH' };
  const fingerprints = (await adapter.extractRetrospectiveEvidence({ principal: {}, birthProfileId: 'profile-a', events: [input] })).fingerprints;
  const serialized = JSON.stringify(fingerprints[0].evidenceFingerprint);
  assert.doesNotMatch(serialized, /ivf|conceived|pregnancy|miscarriage|fertility|boy/i);
  assert.equal(fingerprints[0].qualityFlags.includes(REPRODUCTIVE_SAFETY_POLICY), true);
  for (const forbidden of ['fertilityScore', 'conceptionProbability', 'pregnancyProbability', 'miscarriageRisk', 'deliveryPrediction', 'childGender', 'futureChildCount', 'childHealth', 'medicalDiagnosis']) assert.equal(Object.hasOwn(fingerprints[0].evidenceFingerprint, forbidden), false);
});

test('is non-fatal when optional family retrospective extraction is unavailable', async () => {
  const { adapter } = fixture({ extractor: async () => { throw Object.assign(new Error('unavailable'), { code: 'FAMILY_RETROSPECTIVE_UNAVAILABLE' }); } }); const coordinator = new LifeEventCalibrationCoordinator({ canonicalEventLoader: async () => [event('one'), event('two'), event('three')], clock: () => '2026-01-01T00:00:00.000Z' }); const candidate = { candidateId: 'unchanged-primary', primaryRank: 0, primaryState: 'Supportive', primaryStrength: 'Supportive', start: '2026-02-01T00:00:00.000Z', end: '2026-03-01T00:00:00.000Z', primaryEvidenceFingerprint: { pd: 'venus' } };
  const result = await coordinator.calibrate({ principal: { subject: 'user-a' }, birthProfileId: 'profile-a', adapter, primaryCandidates: [candidate], primaryDomainRulesVersion: 'family-expansion-rules-v1' }); assert.equal(result.status, 'CALIBRATION_UNAVAILABLE'); assert.equal(result.audit.safeFailureCode, 'FAMILY_RETROSPECTIVE_UNAVAILABLE'); assert.equal(candidate.primaryState, 'Supportive');
});

test('converts existing primary family candidates into immutable annotation targets only', () => {
  const candidates = familyExpansionCalibrationCandidates([{ start: '2026-11-01T00:00:00.000Z', end: '2026-12-01T00:00:00.000Z', state: 'Supportive', parent: { md: 'moon', ad: 'jupiter' }, pd: { lord: 'venus' }, d7: { confirmation: 'Reinforcing' }, transit: { regime: 'JUPITER' } }]); assert.equal(candidates.length, 1); assert.equal(candidates[0].primaryState, 'Supportive'); assert.equal(candidates[0].start, '2026-11-01T00:00:00.000Z');
});

test('requires the stricter Family safety marker and three HIGH/MEDIUM matches for future display readiness', async () => {
  const { adapter } = fixture();
  assert.deepEqual(adapter.customerDisplaySafety(), { permitted: true, policy: REPRODUCTIVE_SAFETY_POLICY, minimumHighMediumMatches: 3 });
});
