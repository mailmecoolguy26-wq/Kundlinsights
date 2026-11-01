'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateRashiHouses } = require('../../src/bhava');
const { RelationshipAnswerService, d1Evidence, parentEvidence, refinement, transitEvidence, state, marriageOutlook, coalesce, rank, relationshipCalibrationCandidates, relationshipWindowSelection, applyPersonalisedRelationshipWindow } = require('../../src/application/relationships');
const { rankPersonalisedTiming } = require('../../src/application/life-event-calibration');

function houses({ seventhLord = 'Venus', venus = 7, jupiter = 7, saturn = 8 } = {}) {
  return { houses: Array.from({ length: 12 }, (_, index) => ({ houseNumber: index + 1, rashiHouseLord: index + 1 === 7 ? seventhLord : index + 1 === 2 ? 'Moon' : index + 1 === 5 ? 'Mercury' : index + 1 === 11 ? 'Jupiter' : index + 1 === 8 ? 'Saturn' : 'Sun' })), planetaryAssignments: [{ body: 'Venus', rashiHouseNumber: venus }, { body: 'Jupiter', rashiHouseNumber: jupiter }, { body: 'Saturn', rashiHouseNumber: saturn }, { body: 'Moon', rashiHouseNumber: 2 }] };
}
const relevant = { md: 'venus', ad: 'jupiter', pd: 'venus' };
const neutralTransit = { jupiter: false, saturn: false, venus: false, caution: 0 };
const neutralSav = { confirmation: 'NEUTRAL' };

test('Relationship Rules v1 keeps D1 and qualifying MD/AD dominant over D9 and transit confirmation', () => {
  const d1 = d1Evidence(houses()), parent = parentEvidence(houses(), relevant);
  assert.equal(d1.state, 'CONSTRUCTIVE'); assert.equal(parent.eligible, true);
  assert.equal(state({ d1, parent, pd: refinement(houses(), 'venus'), d9: { confirmation: 'Reinforcing' }, transit: neutralTransit, sav: neutralSav }), 'Supportive');
  assert.equal(state({ d1: { ...d1, state: 'WEAK' }, parent: { ...parent, eligible: false }, pd: refinement(houses(), 'venus'), d9: { confirmation: 'Reinforcing' }, transit: { ...neutralTransit, jupiter: true }, sav: { confirmation: 'AVAILABLE_CONTEXT' } }), 'Insufficient Evidence');
});

test('D1 preserves only existing deterministic association, aspect, and planetary-state facts', () => {
  const bodies = {
    Ascendant: { siderealLongitudeDegrees: 0 }, Sun: { siderealLongitudeDegrees: 10 }, Moon: { siderealLongitudeDegrees: 40 },
    Mars: { siderealLongitudeDegrees: 70 }, Mercury: { siderealLongitudeDegrees: 100 }, Jupiter: { siderealLongitudeDegrees: 130 },
    Venus: { siderealLongitudeDegrees: 160 }, Saturn: { siderealLongitudeDegrees: 190 }, Rahu: { siderealLongitudeDegrees: 220 }, Ketu: { siderealLongitudeDegrees: 40 },
  };
  const layer5 = calculateRashiHouses({ ascendantCanonicalSiderealLongitude: 0, bodies });
  const d1 = d1Evidence(layer5, bodies);
  assert.ok(Array.isArray(d1.associations)); assert.ok(Array.isArray(d1.aspects));
  assert.deepEqual(Object.keys(d1.planetaryState).sort(), ['Jupiter', 'Venus']);
});

test('Relationship Rules v1 exposes the six states without outcome claims', () => {
  const d1 = d1Evidence(houses()), parent = parentEvidence(houses(), relevant), pd = refinement(houses(), 'venus');
  assert.equal(state({ d1, parent, pd, d9: { confirmation: 'Reinforcing' }, transit: neutralTransit, sav: neutralSav }), 'Supportive');
  assert.equal(state({ d1, parent, pd: { state: 'Neutral' }, d9: { confirmation: 'Neutral' }, transit: neutralTransit, sav: neutralSav }), 'Improving');
  assert.equal(state({ d1, parent: { ...parent, state: 'MIXED_RELEVANCE' }, pd, d9: { confirmation: 'Neutral' }, transit: neutralTransit, sav: neutralSav }), 'Mixed');
  assert.equal(state({ d1, parent, pd: { state: 'Neutral' }, d9: { confirmation: 'Neutral' }, transit: { ...neutralTransit, saturn: true }, sav: neutralSav }), 'Consolidation');
  assert.equal(state({ d1: { ...d1, constructiveSignals: ['venus'] }, parent: { ...parent, state: 'MIXED_RELEVANCE' }, pd: { state: 'Weakening' }, d9: { confirmation: 'Neutral' }, transit: { ...neutralTransit, caution: 2 }, sav: neutralSav }), 'Cautious');
  assert.equal(state({ d1, parent: { ...parent, eligible: false }, pd, d9: { confirmation: 'Neutral' }, transit: neutralTransit, sav: neutralSav }), 'Insufficient Evidence');
});

test('PD and confirmation layers cannot manufacture eligibility or a marriage outlook', () => {
  const d1 = d1Evidence(houses()), irrelevant = parentEvidence(houses(), { md: 'saturn', ad: 'saturn' });
  assert.equal(irrelevant.eligible, false); assert.equal(refinement(houses(), 'venus').state, 'Strengthening');
  assert.equal(state({ d1, parent: irrelevant, pd: refinement(houses(), 'venus'), d9: { confirmation: 'Reinforcing' }, transit: { ...neutralTransit, jupiter: true }, sav: { confirmation: 'AVAILABLE_CONTEXT' } }), 'Insufficient Evidence');
  assert.equal(marriageOutlook({ d1, parent: irrelevant, d9: { confirmation: 'Reinforcing' }, transit: { major: true }, selected: { start: '2027-01-01T00:00:00.000Z', end: '2027-02-01T00:00:00.000Z' } }), null);
});

test('D9, transits, and SAV/BAV confirm but cannot manufacture a relationship verdict', () => {
  const d1 = d1Evidence(houses()), parent = parentEvidence(houses(), relevant), pd = refinement(houses(), 'venus');
  assert.equal(state({ d1: { ...d1, state: 'WEAK' }, parent, pd, d9: { confirmation: 'Reinforcing' }, transit: { ...neutralTransit, jupiter: true }, sav: { confirmation: 'AVAILABLE_CONTEXT' } }), 'Insufficient Evidence');
  assert.equal(state({ d1, parent, pd, d9: { confirmation: 'Conflicting' }, transit: neutralTransit, sav: neutralSav }), 'Mixed');
  assert.equal(state({ d1, parent, pd: { state: 'Neutral' }, d9: { confirmation: 'Neutral' }, transit: neutralTransit, sav: { confirmation: 'AVAILABLE_CONTEXT' } }), 'Improving');
});

test('Jupiter and Saturn are major relationship confirmation only with D1/Dasha, while Venus and nodes remain non-major context', () => {
  const snapshot = (values) => ({ transitBodies: Object.fromEntries(Object.entries(values).map(([planet, house]) => [planet, { transitNatalHouseNumber: house, aspectsNatalHouses: [], aspectsNatalBodies: [], sameRashiNatalBodies: [] }])) });
  assert.equal(transitEvidence(snapshot({ Jupiter: 7 })).jupiter, true);
  assert.equal(transitEvidence(snapshot({ Saturn: 7 })).saturn, true);
  const supporting = transitEvidence(snapshot({ Venus: 7, Mars: 8, Rahu: 12, Ketu: 8 }));
  assert.equal(supporting.jupiter, false); assert.equal(supporting.saturn, false); assert.equal(supporting.venus, true); assert.equal(supporting.caution, 3);
});

test('Marriage Outlook is conditional and never makes a guaranteed marriage or date claim', () => {
  const d1 = d1Evidence(houses()), parent = parentEvidence(houses(), relevant);
  const outlook = marriageOutlook({ d1, parent, d9: { confirmation: 'Reinforcing' }, transit: { major: true }, selected: { start: '2027-01-01T00:00:00.000Z', end: '2027-02-01T00:00:00.000Z' } });
  assert.equal(outlook.state, 'COMMITMENT_SUPPORTIVE'); assert.doesNotMatch(outlook.message, /guarantee|will marry|exact/i);
  assert.deepEqual(outlook.limitations, ['NO_GUARANTEED_MARRIAGE', 'NO_EXACT_MARRIAGE_DATE']);
});

test('Relationship service gates a locked profile before reading profile, life events, or astrology', async () => {
  let profileRead = false;
  const service = new RelationshipAnswerService({
    birthProfileService: { get: async () => { profileRead = true; throw new Error('MUST_NOT_CALCULATE'); } },
    lifeEventService: { getRelevantLifeEvents: async () => [] },
    astronomicalEngine: { calculate: () => { throw new Error('MUST_NOT_CALCULATE'); } },
    canonicalSiderealSunSampler: {},
    entitlementService: { getReadingEntitlementStatus: async () => ({ profilePremium: { eligible: false } }) },
  });
  const result = await service.answer({ principal: {}, birthProfileId: 'profile-locked' });
  assert.equal(profileRead, false); assert.equal(result.answerability, 'PREMIUM_REQUIRED'); assert.equal(result.evidence, null);
});

test('coalescing does not cross an AD boundary and ranking stays lexicographic', () => {
  const base = { state: 'Supportive', direction: 'PROGRESSION', cautionBreak: false, transit: { major: true }, parent: { adStart: '2027-01-01T00:00:00.000Z' }, d1: { constructiveSignals: ['venus', 'jupiter'] }, parentEvidence: { strength: 4 }, refinement: { state: 'Strengthening' }, d9: { confirmation: 'Reinforcing' } };
  const first = { ...base, start: '2027-01-01T00:00:00.000Z', end: '2027-02-01T00:00:00.000Z' }, second = { ...base, start: first.end, end: '2027-03-01T00:00:00.000Z' };
  assert.equal(coalesce([first, second]).length, 1);
  assert.equal(coalesce([first, { ...second, parent: { adStart: second.start } }]).length, 2);
  assert.ok(rank(first, { ...first, state: 'Improving' }) < 0);
});

function relationshipCandidate({ start, end, state = 'Supportive', d9 = 'Reinforcing', parentStrength = 4, parentState = 'RELATIONSHIP_RELEVANT', pd = 'jupiter', refinementState = 'Strengthening', majorRegime = 'JUPITER', caution = 0, sav = 'AVAILABLE_CONTEXT' } = {}) {
  return Object.freeze({
    start, end, state, direction: state === 'Consolidation' ? 'CONSOLIDATION' : state === 'Supportive' ? 'PROGRESSION' : 'IMPROVING', cautionBreak: false,
    d1: Object.freeze({ state: 'CONSTRUCTIVE', constructiveSignals: Object.freeze(['venus', 'jupiter']), cautionSignals: Object.freeze([]) }),
    parent: Object.freeze({ md: 'moon', ad: 'venus', adStart: '2026-01-01T00:00:00.000Z' }),
    parentEvidence: Object.freeze({ state: parentState, strength: parentStrength, cautionCount: 0 }),
    pd: Object.freeze({ lord: pd }), refinement: Object.freeze({ state: refinementState }), d9: Object.freeze({ confirmation: d9 }),
    transit: Object.freeze({ major: majorRegime !== 'NONE', majorRegime, caution }), sav: Object.freeze({ confirmation: sav }),
  });
}
function eligibleRelationshipCalibration(candidates, matches) {
  const annotations = candidates.map((candidate, index) => ({ candidateId: candidate.candidateId, tieBreakEligible: true, patternStrength: matches[index] >= 3 ? 'STRONG' : 'MODERATE', contradictionFlags: [] }));
  const customerDisplayReadiness = candidates.map((candidate, index) => ({ candidateId: candidate.candidateId, customerDisplayEligible: true, matchedEventCount: matches[index], highMediumMatchedEventCount: matches[index], matchedEvidenceFamilies: ['DIVISIONAL_CHART', 'DASHA', 'TRANSIT'] }));
  return { annotations, customerDisplayReadiness };
}
test('Relationship V2 selects a materially stronger eligible marriage-history match only inside an equivalent cohort and tier', () => {
  const now = '2026-11-01T00:00:00.000Z';
  const first = relationshipCandidate({ start: '2027-01-01T00:00:00.000Z', end: '2027-02-01T00:00:00.000Z', pd: 'jupiter' });
  const second = relationshipCandidate({ start: '2027-03-01T00:00:00.000Z', end: '2027-04-01T00:00:00.000Z', pd: 'venus' });
  const window = relationshipWindowSelection([first, second], now);
  const candidates = relationshipCalibrationCandidates(window, { now, intent: 'MARRIAGE_OUTLOOK' });
  const calibration = eligibleRelationshipCalibration(candidates, [2, 3]);
  calibration.personalisedTiming = rankPersonalisedTiming({ candidates, calibration });
  const result = applyPersonalisedRelationshipWindow(window, calibration);
  assert.equal(result.start, second.start);
  assert.equal(result.end, second.end);
  assert.equal(result.personalizedTiming.applied, true);
  assert.equal(JSON.stringify(result).includes('_rankingCandidates'), false);
});
test('Relationship V2 treats generic relationship candidates as cohort-ambiguous and non-applicable', () => {
  const now = '2026-11-01T00:00:00.000Z';
  const windows = [
    relationshipCandidate({ start: '2027-01-01T00:00:00.000Z', end: '2027-02-01T00:00:00.000Z' }),
    relationshipCandidate({ start: '2027-03-01T00:00:00.000Z', end: '2027-04-01T00:00:00.000Z' }),
  ];
  const window = relationshipWindowSelection(windows, now);
  const candidates = relationshipCalibrationCandidates(window, { now, intent: 'RELATIONSHIP_OUTLOOK' });
  assert.deepEqual(candidates.map((candidate) => candidate.personalizationGroup), [null, null]);
  const calibration = eligibleRelationshipCalibration(candidates, [2, 9]);
  calibration.personalisedTiming = rankPersonalisedTiming({ candidates, calibration });
  assert.equal(calibration.personalisedTiming.applied, false);
  assert.equal(applyPersonalisedRelationshipWindow(window, calibration), window);
});
test('Relationship V2 cannot override state, D9, Dasha, PD, transit, SAV, caution, or duration boundaries', () => {
  const now = '2026-11-01T00:00:00.000Z';
  const base = relationshipCandidate({ start: '2027-01-01T00:00:00.000Z', end: '2027-02-01T00:00:00.000Z' });
  const variants = [
    relationshipCandidate({ start: '2027-03-01T00:00:00.000Z', end: '2027-04-01T00:00:00.000Z', state: 'Improving' }),
    relationshipCandidate({ start: '2027-03-01T00:00:00.000Z', end: '2027-04-01T00:00:00.000Z', d9: 'Neutral' }),
    relationshipCandidate({ start: '2027-03-01T00:00:00.000Z', end: '2027-04-01T00:00:00.000Z', parentStrength: 3 }),
    relationshipCandidate({ start: '2027-03-01T00:00:00.000Z', end: '2027-04-01T00:00:00.000Z', refinementState: 'Neutral' }),
    relationshipCandidate({ start: '2027-03-01T00:00:00.000Z', end: '2027-04-01T00:00:00.000Z', majorRegime: 'SATURN' }),
    relationshipCandidate({ start: '2027-03-01T00:00:00.000Z', end: '2027-04-01T00:00:00.000Z', sav: 'NEUTRAL' }),
    relationshipCandidate({ start: '2027-03-01T00:00:00.000Z', end: '2027-04-01T00:00:00.000Z', caution: 1 }),
    relationshipCandidate({ start: '2027-03-01T00:00:00.000Z', end: '2027-04-02T00:00:00.000Z' }),
  ];
  for (const variant of variants) {
    const window = relationshipWindowSelection([base, variant], now);
    const candidates = relationshipCalibrationCandidates(window, { now, intent: 'MARRIAGE_OUTLOOK' });
    const calibration = eligibleRelationshipCalibration(candidates, [2, 9]);
    calibration.personalisedTiming = rankPersonalisedTiming({ candidates, calibration });
    assert.equal(calibration.personalisedTiming.applied, false);
    assert.equal(applyPersonalisedRelationshipWindow(window, calibration), window);
  }
});
test('Relationship V2 selection leaves the primary Marriage Outlook object unchanged', () => {
  const d1 = d1Evidence(houses()), parent = parentEvidence(houses(), relevant);
  const originalSelected = { start: '2027-01-01T00:00:00.000Z', end: '2027-02-01T00:00:00.000Z' };
  const outlook = marriageOutlook({ d1, parent, d9: { confirmation: 'Reinforcing' }, transit: { major: true }, selected: originalSelected });
  const window = relationshipWindowSelection([
    relationshipCandidate(originalSelected),
    relationshipCandidate({ start: '2027-03-01T00:00:00.000Z', end: '2027-04-01T00:00:00.000Z' }),
  ], '2026-11-01T00:00:00.000Z');
  const candidates = relationshipCalibrationCandidates(window, { now: '2026-11-01T00:00:00.000Z', intent: 'MARRIAGE_OUTLOOK' });
  const calibration = eligibleRelationshipCalibration(candidates, [2, 3]);
  calibration.personalisedTiming = rankPersonalisedTiming({ candidates, calibration });
  applyPersonalisedRelationshipWindow(window, calibration);
  assert.deepEqual(outlook.window, originalSelected);
  assert.equal(outlook.message, 'This period is relatively supportive for commitment or marriage-related developments.');
});
