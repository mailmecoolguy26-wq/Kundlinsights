'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CareerCalibrationAdapter, CAREER_CALIBRATION_ADAPTER_VERSION } = require('../../src/application/career-events');

const event = (id, type = 'JOB_SWITCH') => ({ careerEventId: id, eventType: type, eventDate: { precision: 'DAY', year: 2020, month: 2, day: 2 } });
const interval = { from: '2020-02-02T00:00:00.000Z', to: '2020-02-03T00:00:00.000Z', timezone: 'UTC' };
function fixture({ snapshot = null } = {}) {
  const calls = [];
  const adapter = new CareerCalibrationAdapter({
    careerEventAstrologyService: { get: async (input) => { calls.push(input); return snapshot || { natalCareerContext: { d10: { chartType: 'd10' } }, dashaIntervals: [{ mahadasha: { lord: 'Mercury' }, antardasha: { lord: 'Mercury' }, pratyantardasha: { lord: 'Venus' } }], transitCoverage: { bodies: [] }, ashtakavarga: {} }; } },
    birthProfileService: { get: async () => ({ birthData: { timezone: 'Asia/Kolkata' } }) },
  });
  return { adapter, calls };
}

test('maps supported canonical Career types into separate cohorts and excludes ambiguous OTHER', async () => {
  const { adapter } = fixture();
  assert.equal(adapter.supports(event('a')), true);
  assert.equal(adapter.cohortFor(event('a')), 'CAREER:JOB_SWITCH');
  assert.equal(adapter.cohortFor(event('p', 'PROMOTION')), 'CAREER:PROMOTION');
  assert.equal(adapter.supports(event('other', 'OTHER')), false);
  assert.equal(await adapter.resolveTimezone({ principal: {}, birthProfileId: 'profile-a' }), 'Asia/Kolkata');
  assert.equal(adapter.domainCalibrationVersion, CAREER_CALIBRATION_ADAPTER_VERSION);
});

test('reuses P3 retrospective analysis without recomputing astrology and preserves normalized families', async () => {
  const { adapter, calls } = fixture();
  const result = await adapter.extractRetrospectiveEvidence({ principal: {}, birthProfileId: 'profile-a', events: [{ event: event('a'), interval, calibrationCohort: 'CAREER:JOB_SWITCH' }], adapterContext: { patternComparison: { comparisonContexts: [{ contextKey: 'ctx', eventAnalyses: [{ careerEventId: 'a', commonFeatures: [{ id: 'DASHA_MD' }, { id: 'TRANSIT_NATAL_HOUSE' }, { id: 'ASHTAKAVARGA_SAV' }], changedFeatures: [{ id: 'CAREER_HOUSE' }] }] }] } } });
  assert.equal(calls.length, 0);
  assert.deepEqual(result.fingerprints[0].evidenceFamilies, ['ASHTAKAVARGA', 'DASHA', 'FOUNDATION', 'TRANSIT']);
  assert.deepEqual(result.fingerprints[0].qualityFlags, ['REUSED_EXISTING_CAREER_RETROSPECTIVE_EVIDENCE']);
});

test('uses the existing CareerEventAstrologyService only for unsampled canonical events', async () => {
  const { adapter, calls } = fixture();
  const result = await adapter.extractRetrospectiveEvidence({ principal: { id: 'u' }, birthProfileId: 'profile-a', events: [{ event: event('a'), interval, calibrationCohort: 'CAREER:JOB_SWITCH' }], adapterContext: { patternComparison: { comparisonContexts: [] } } });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { principal: { id: 'u' }, birthProfileId: 'profile-a', eventId: 'a' });
  assert.deepEqual(result.fingerprints[0].evidenceFamilies, ['ASHTAKAVARGA', 'DASHA', 'DIVISIONAL_CHART', 'FOUNDATION', 'TRANSIT']);
});

test('returns personalization-only annotations and marks materially varied patterns as limited', async () => {
  const { adapter } = fixture();
  const events = ['a', 'b', 'c'].map((id) => ({ event: event(id), interval, calibrationCohort: 'CAREER:JOB_SWITCH' }));
  const fingerprints = events.map((item) => ({ eventId: item.event.careerEventId, evidenceFamilies: ['DASHA'] }));
  const output = await adapter.annotateCandidates({ events, fingerprints, primaryCandidates: [{ candidateId: 'future', primaryRank: 0 }], adapterContext: { historicalEvidence: [{ patternKey: 'p', sourceEventIds: ['a'] }], futureOccurrences: [{ evidenceId: 'future', patternKey: 'p' }] } });
  assert.equal(output[0].patternStrength, 'LIMITED');
  assert.equal(output[0].historicalConsistency, 'LIMITED');
  assert.equal(output[0].tieBreakEligible, false);
  assert.deepEqual(output[0].contradictionFlags, ['MATERIAL_PATTERN_VARIATION']);
  assert.deepEqual([...output[0].qualityFlags].sort(), ['CUSTOMER_SUMMARY_DISABLED', 'PERSONALIZATION_ONLY']);
});

test('reports only candidate-comparable Career evidence families, including multi-family composites', async () => {
  const { adapter } = fixture();
  const events = ['a', 'b', 'c'].map((id) => ({ event: event(id), interval, calibrationCohort: 'CAREER:JOB_SWITCH' }));
  const fingerprints = events.map((item) => ({ eventId: item.event.careerEventId, evidenceFamilies: ['DASHA', 'TRANSIT'] }));
  const output = await adapter.annotateCandidates({ events, fingerprints, primaryCandidates: [{ candidateId: 'composite', primaryRank: 0 }], adapterContext: { composites: [{ evidenceId: 'composite', sourceEventIds: ['a', 'b', 'c'], mechanismFamilies: ['DASHA_RECURRENCE', 'TRANSIT_RECURRENCE'] }], historicalEvidence: [] } });
  assert.deepEqual(output[0].matchedEvidenceFamilies, ['DASHA', 'TRANSIT']);
  assert.deepEqual(output[0].unmatchedEvidenceFamilies, []);
});
