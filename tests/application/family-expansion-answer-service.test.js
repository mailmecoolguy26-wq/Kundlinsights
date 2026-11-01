'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { d1Evidence, parentEvidence, refinement, classify, coalesce, familyExpansionRankingGroup, familyExpansionCalibrationCandidates, familyExpansionWindowSelection, applyPersonalisedFamilyExpansionWindow } = require('../../src/application/family-expansion');
const { rankPersonalisedTiming } = require('../../src/application/life-event-calibration/personalised-timing-comparator');

function houses({ fifthLord = 'Jupiter', jupiter = 5, moon = 5, saturn = 8 } = {}) { return { houses: Array.from({ length: 12 }, (_, index) => ({ houseNumber: index + 1, rashiHouseLord: index + 1 === 5 ? fifthLord : index + 1 === 2 ? 'Moon' : index + 1 === 9 ? 'Jupiter' : index + 1 === 11 ? 'Venus' : index + 1 === 8 ? 'Saturn' : 'Sun' })), planetaryAssignments: [{ body: 'Jupiter', rashiHouseNumber: jupiter }, { body: 'Moon', rashiHouseNumber: moon }, { body: 'Saturn', rashiHouseNumber: saturn }] }; }
const neutralTransit = { jupiter: false, saturn: false, venus: false, caution: 0 };
test('Family Expansion D1 plus Dasha dominate D7, transit, and SAV context', () => { const d1 = d1Evidence(houses()), parent = parentEvidence(houses(), { md: 'jupiter', ad: 'moon' }); assert.equal(d1.state, 'CONSTRUCTIVE'); assert.equal(parent.eligible, true); assert.equal(classify({ d1, parent, pd: refinement(houses(), 'jupiter'), d7: { confirmation: 'Reinforcing' }, transit: neutralTransit }), 'Supportive'); assert.equal(classify({ d1: { ...d1, state: 'WEAK' }, parent: { ...parent, eligible: false }, pd: { state: 'Strengthening' }, d7: { confirmation: 'Reinforcing' }, transit: { ...neutralTransit, jupiter: true } }), 'Insufficient Evidence'); });
test('D7 can refine confidence but cannot create a supportive state alone', () => { const d1 = d1Evidence(houses()), irrelevant = parentEvidence(houses(), { md: 'saturn', ad: 'saturn' }); assert.equal(classify({ d1, parent: irrelevant, pd: { state: 'Strengthening' }, d7: { confirmation: 'Reinforcing' }, transit: { ...neutralTransit, jupiter: true } }), 'Insufficient Evidence'); assert.equal(classify({ d1, parent: parentEvidence(houses(), { md: 'jupiter', ad: 'moon' }), pd: { state: 'Neutral' }, d7: { confirmation: 'Conflicting' }, transit: neutralTransit }), 'Mixed'); });
test('PD, Jupiter, SAV context, and CHILD_BIRTH calibration cannot create relevance alone', () => { const d1 = d1Evidence(houses()), irrelevant = parentEvidence(houses(), { md: 'saturn', ad: 'saturn' }); assert.equal(refinement(houses(), 'jupiter').state, 'Strengthening'); assert.equal(classify({ d1, parent: irrelevant, pd: refinement(houses(), 'jupiter'), d7: { confirmation: 'Neutral' }, transit: { ...neutralTransit, jupiter: true } }), 'Insufficient Evidence'); });
test('Saturn supports constructive consolidation, while caution remains non-medical', () => { const d1 = d1Evidence(houses()), parent = parentEvidence(houses(), { md: 'jupiter', ad: 'moon' }); assert.equal(classify({ d1, parent, pd: { state: 'Neutral' }, d7: { confirmation: 'Neutral' }, transit: { ...neutralTransit, saturn: true } }), 'Consolidation'); assert.equal(classify({ d1, parent, pd: { state: 'Weakening' }, d7: { confirmation: 'Neutral' }, transit: neutralTransit }), 'Mixed'); });
test('coalescing stays inside an AD and preserves caution breaks', () => { const base = { state: 'Improving', direction: 'FAMILY_SUPPORT', cautionBreak: false, transit: { regime: 'JUPITER' }, parent: { adStart: '2027-01-01T00:00:00.000Z' } }; const first = { ...base, start: base.parent.adStart, end: '2027-02-01T00:00:00.000Z' }, second = { ...base, start: first.end, end: '2027-03-01T00:00:00.000Z' }; assert.equal(coalesce([first, second]).length, 1); assert.equal(coalesce([first, { ...second, cautionBreak: true }]).length, 2); });

const now = '2026-01-01T00:00:00.000Z';
function rankingCandidate(overrides = {}) {
  return {
    start: '2026-02-01T00:00:00.000Z', end: '2026-03-01T00:00:00.000Z', state: 'Supportive',
    d1: { state: 'CONSTRUCTIVE', constructiveSignals: ['jupiter', 'moon'], cautionSignals: [] },
    parent: { md: 'moon', ad: 'jupiter' }, parentEvidence: { state: 'FAMILY_RELEVANT', strength: 4, cautionCount: 0 },
    pd: { lord: 'venus' }, refinement: { state: 'Strengthening' }, d7: { confirmation: 'Reinforcing' },
    transit: { regime: 'JUPITER', caution: 0 }, sav: { confirmation: 'AVAILABLE_CONTEXT' }, ...overrides,
  };
}
function eligibleCalibration(candidates, preferredIndex = 1) {
  const annotations = candidates.map((candidate, index) => ({ candidateId: candidate.candidateId, tieBreakEligible: true, matchedEventIds: index === preferredIndex ? ['a', 'b', 'c', 'd'] : ['a', 'b', 'c'], matchedEvidenceFamilies: ['DASHA', 'TRANSIT'], patternStrength: index === preferredIndex ? 'STRONG' : 'MODERATE', contradictionFlags: [] }));
  const customerDisplayReadiness = annotations.map((annotation) => ({ candidateId: annotation.candidateId, customerDisplayEligible: true, matchedEventCount: annotation.matchedEventIds.length, highMediumMatchedEventCount: annotation.matchedEventIds.length, matchedEvidenceFamilies: annotation.matchedEvidenceFamilies }));
  return { annotations, customerDisplayReadiness };
}

test('Family Expansion V2 may select a better-matching primary-equivalent CHILD_BIRTH window only', () => {
  const first = rankingCandidate(), second = rankingCandidate({ start: '2026-04-01T00:00:00.000Z', end: '2026-04-29T00:00:00.000Z', pd: { lord: 'mars' } });
  const selection = familyExpansionWindowSelection([first, second], now), candidates = familyExpansionCalibrationCandidates(selection, { now });
  assert.equal(candidates[0].personalizationGroup, candidates[1].personalizationGroup);
  const personalisedTiming = rankPersonalisedTiming({ candidates, calibration: eligibleCalibration(candidates) });
  const output = applyPersonalisedFamilyExpansionWindow(selection, { personalisedTiming });
  assert.equal(output.start, second.start); assert.equal(output.personalizedTiming.applied, true);
  assert.match(output.personalizedTiming.summary, /recorded family milestones/);
  assert.doesNotMatch(JSON.stringify(output), /fertility|conception|pregnancy|delivery|child health|guarantee/i);
});

test('Family Expansion V2 equivalence includes temporal/state/D1/Dasha/PD/D7/transit/SAV/caution/duration boundaries', () => {
  const base = rankingCandidate();
  const changes = [
    { start: '2025-12-01T00:00:00.000Z', end: '2026-01-15T00:00:00.000Z' },
    { state: 'Improving' },
    { d1: { ...base.d1, state: 'LIMITED' } },
    { parent: { md: 'saturn', ad: 'jupiter' } },
    { parentEvidence: { ...base.parentEvidence, strength: 3 } },
    { refinement: { state: 'Neutral' } },
    { d7: { confirmation: 'Neutral' } },
    { transit: { ...base.transit, regime: 'SATURN' } },
    { sav: { confirmation: 'NEUTRAL' } },
    { transit: { ...base.transit, caution: 1 } },
    { end: '2026-03-02T00:00:00.000Z' },
  ];
  for (const change of changes) assert.notEqual(familyExpansionRankingGroup(base, { now }), familyExpansionRankingGroup(rankingCandidate(change), { now }));
});

test('Family Expansion V2 preserves deterministic selection when history is ineligible, equal, contradictory, or unavailable', () => {
  const first = rankingCandidate(), second = rankingCandidate({ start: '2026-04-01T00:00:00.000Z', end: '2026-04-29T00:00:00.000Z' });
  const before = JSON.stringify([first, second]);
  const selection = familyExpansionWindowSelection([first, second], now), candidates = familyExpansionCalibrationCandidates(selection, { now });
  for (const calibration of [null, { personalisedTiming: { applied: false, orderedCandidateIds: candidates.map((item) => item.candidateId) } }]) assert.equal(applyPersonalisedFamilyExpansionWindow(selection, calibration).start, first.start);
  const equal = eligibleCalibration(candidates, -1); equal.annotations.forEach((item) => { item.matchedEventIds = ['a', 'b', 'c']; item.patternStrength = 'MODERATE'; }); equal.customerDisplayReadiness.forEach((item) => { item.matchedEventCount = 3; item.highMediumMatchedEventCount = 3; });
  assert.equal(rankPersonalisedTiming({ candidates, calibration: equal }).applied, false);
  const contradictory = eligibleCalibration(candidates); contradictory.annotations[1].contradictionFlags = ['MATERIAL_FAMILY_TIMING_PATTERN_VARIATION'];
  assert.equal(rankPersonalisedTiming({ candidates, calibration: contradictory }).applied, false);
  assert.equal(JSON.stringify([first, second]), before);
});

test('Family Expansion V2 cannot bypass precision, evidence-family, or non-medical safety readiness', () => {
  const selection = familyExpansionWindowSelection([rankingCandidate(), rankingCandidate({ start: '2026-04-01T00:00:00.000Z', end: '2026-04-29T00:00:00.000Z' })], now);
  const candidates = familyExpansionCalibrationCandidates(selection, { now });
  for (const reasonCodes of [['INSUFFICIENT_PRECISE_MATCHES'], ['INSUFFICIENT_MATCHED_EVIDENCE_FAMILIES'], ['DOMAIN_SAFETY_RESTRICTION']]) {
    const calibration = eligibleCalibration(candidates);
    calibration.customerDisplayReadiness[1] = { ...calibration.customerDisplayReadiness[1], customerDisplayEligible: false, reasonCodes };
    assert.equal(rankPersonalisedTiming({ candidates, calibration }).applied, false);
  }
});
