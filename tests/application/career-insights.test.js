'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createInsightEvidence, createInsightSignal, createInsight,
  adaptCareerInsightEvidence, buildCareerInsightSignals, rankCareerInsightSignals,
  buildCareerInsights, buildCareerInsightTrace, renderCareerInsights,
} = require('../../src/application/insights');

function conclusion(topic, status = 'SUPPORTED', id = topic) { return { conclusionId: `conclusion:${id}`, domain: 'CAREER', topic, rulesetId: 'parashari-career-interpretation-foundation-v1', interpretiveRuleId: `rule:${id}`, conclusionStatus: status, evidenceIds: [`fact:${id}`], rootSourceIds: [`fact:${id}`], evidenceFamilyIds: [`family:${id}`], sourceStrengths: ['CLASSICAL_TRANSLATION'], contradictions: status === 'CONTRADICTED' ? [`contradiction:${id}`] : [], missingData: status === 'INSUFFICIENT_EVIDENCE' ? [`missing:${id}`] : [], temporalContext: { dashaIntervals: [], gocharSnapshotInstant: null, transitEventIds: [] }, provenance: { sourceRefs: ['fixture'] } }; }
function analysis() { return { nodeAnalysis: [
  { nodeId: 'fact:natal', mechanismFamilies: ['NATAL_STRUCTURE'] },
  { nodeId: 'fact:dasha', mechanismFamilies: ['DASHA'] },
  { nodeId: 'fact:transit', mechanismFamilies: ['GOCHAR_SNAPSHOT'] },
] }; }

test('Career Insight contracts validate deterministic immutable data and reject unsupported semantics', () => {
  const evidence = createInsightEvidence({ evidenceId: 'e1', domain: 'CAREER', family: 'CAREER_FOUNDATION', sourceLayer: '12B', sourceRulesetId: 'r1', subject: null, target: null, chart: 'D1', temporalContext: {}, rawFacts: {}, rootSourceIds: ['r'], evidenceFamilyIds: [], lineage: {}, status: 'SUPPORTED', explanationKey: 'key', provenance: {} });
  const signal = createInsightSignal({ signalId: 's1', domain: 'CAREER', family: 'CAREER_FOUNDATION', ruleId: 'r1', status: 'SUPPORTED', supportiveEvidenceIds: ['e1'], limitingEvidenceIds: [], contradictoryEvidenceIds: [], independentMechanismFamilies: [], temporalContext: {}, calibrationSupport: null, explanationKey: 'key', provenance: {} });
  const value = createInsight({ insightId: 'i1', domain: 'CAREER', family: 'CAREER_FOUNDATION', titleKey: 'title', summaryKey: 'summary', displayPriority: 0, timing: {}, status: 'SUPPORTED', signals: ['s1'], evidenceTrace: {}, caveats: [], calibrationContext: null, technicalDetails: {}, rulesetVersions: {} });
  assert.equal(Object.isFrozen(evidence), true); assert.equal(Object.isFrozen(signal), true); assert.equal(Object.isFrozen(value), true);
  assert.throws(() => createInsightEvidence({ ...evidence, status: 'POSITIVE' }), /status/);
  assert.throws(() => createInsightEvidence({ ...evidence, confidence: 0.9 }), /Forbidden/);
});

test('adapter maps only existing conclusion families and calibration artifacts', () => {
  const evidence = adaptCareerInsightEvidence({ conclusions: [conclusion('CAREER_H10_SIGNIFICATION_SCOPE_PRESENT', 'SUPPORTED', 'natal'), conclusion('CAREER_H10_CONNECTED_DASHA_ACTIVATION_PRESENT', 'SUPPORTED', 'dasha'), conclusion('CAREER_GOCHAR_CONNECTION_PRESENT', 'SUPPORTED', 'transit'), conclusion('UNSUPPORTED_TOPIC', 'SUPPORTED', 'ignored')], analysis: analysis(), calibrationContext: { calibrationLevel: 'CALIBRATED', historicalEvidence: [{ evidenceId: 'hist:1', contextKey: 'ctx', sourceEventIds: ['event:1'] }], futureOccurrences: [{ evidenceId: 'future:1', contextKey: 'ctx', occurrenceType: 'WINDOW', from: '2026-01-01T00:00:00.000Z', to: '2026-02-01T00:00:00.000Z' }], composites: [] } });
  assert.deepEqual([...new Set(evidence.map((item) => item.family))].sort(), ['ACTIVE_CAREER_DASHA', 'CAREER_FOUNDATION', 'CURRENT_CAREER_TRANSIT', 'FUTURE_RECURRENCE_WINDOW', 'HISTORICAL_CALIBRATION_RECURRENCE']);
  assert.equal(evidence.some((item) => item.rawFacts.topic === 'UNSUPPORTED_TOPIC'), false);
});

test('adapter normalizes factual MD AD PD and transit timing without internal identifiers', () => {
  const dasha = { ...conclusion('CAREER_H10_CONNECTED_DASHA_ACTIVATION_PRESENT', 'SUPPORTED', 'dasha-timing'), temporalContext: { readingInstant: '2026-09-09T00:00:00.000Z', dashaIntervals: [{ level: 'MD', lord: 'Saturn', start: '2026-01-01T00:00:00.000Z', end: '2028-01-01T00:00:00.000Z', temporalNodeId: 'private' }, { level: 'AD', lord: 'Mercury', start: '2026-08-01T00:00:00.000Z', end: '2027-01-01T00:00:00.000Z' }, { level: 'PD', lord: 'Venus', start: '2026-09-01T00:00:00.000Z', end: '2026-10-01T00:00:00.000Z' }], transitContexts: [], mechanismFamilies: ['DASHA'] } };
  const transit = { ...conclusion('CAREER_TIMING_TRIGGER_CONTEXT_PRESENT', 'SUPPORTED', 'transit-timing'), temporalContext: { readingInstant: '2026-09-09T00:00:00.000Z', dashaIntervals: [], transitContexts: [{ kind: 'TRANSIT_EVENT', instant: '2026-10-01T00:00:00.000Z', transitPlanet: 'Saturn', eventType: 'rashiIngress', natalHouseNumber: 10, privateNodeId: 'nope' }], mechanismFamilies: ['TRANSIT_EVENT'], timingState: 'UPCOMING' } };
  const evidence = adaptCareerInsightEvidence({ conclusions: [dasha, transit], analysis: analysis() });
  const dashaContext = evidence.find((item) => item.family === 'ACTIVE_CAREER_DASHA').temporalContext;
  assert.deepEqual(dashaContext.dashaPeriods.map((item) => [item.periodLevel, item.periodPlanet, item.isCurrent]), [['MAHADASHA', 'Saturn', true], ['ANTARDASHA', 'Mercury', true], ['PRATYANTAR_DASHA', 'Venus', true]]);
  const transitContext = evidence.find((item) => item.family === 'CURRENT_CAREER_TRANSIT').temporalContext;
  assert.deepEqual(transitContext.transitContexts, [{ kind: 'TRANSIT_EVENT', start: '2026-10-01T00:00:00.000Z', isCurrent: false, transitPlanet: 'Saturn', eventType: 'rashiIngress', natalHouseNumber: 10, source: 'TRANSIT_EVENT_SCANNER' }]);
  assert.equal(JSON.stringify(evidence).includes('privateNodeId'), false);
});

test('adapter retains supplied D10 Career structure as additive foundation evidence without inventing timing or outcome fields', () => {
  const domainGraph = { rulesetId: 'parashari-career-domain-evidence-v1', derivedRelations: [
    { id: 'career-relation:d10-house', relationType: 'CAREER_D10_TENTH_HOUSE', inputNodeIds: ['fact:d10'], fact: { chart: 'D10', houseNumber: 10, sign: { rashiIndex: 10 } } },
    { id: 'career-relation:d10-lord', relationType: 'CAREER_D10_TENTH_LORD', inputNodeIds: ['fact:d10'], fact: { chart: 'D10', houseNumber: 10, lord: 'Saturn' } },
  ] };
  const evidence = adaptCareerInsightEvidence({ conclusions: [conclusion('CAREER_H10_SIGNIFICATION_SCOPE_PRESENT', 'SUPPORTED', 'natal')], analysis: analysis(), domainGraph });
  const d10 = evidence.find((item) => item.chart === 'D10');
  assert.equal(d10.family, 'CAREER_FOUNDATION');
  assert.deepEqual(d10.rawFacts.map((item) => item.relationType), ['CAREER_D10_TENTH_HOUSE', 'CAREER_D10_TENTH_LORD']);
  assert.equal(JSON.stringify(d10).match(/strength|confidence|promotion|salary|leadership/), null);
  const signals = buildCareerInsightSignals({ evidence });
  assert.deepEqual([...signals.find((item) => item.family === 'CAREER_FOUNDATION').independentMechanismFamilies].sort(), ['D10_DIVISIONAL', 'NATAL_STRUCTURE']);
});

test('adapter exposes relevant D1 planetary states as factual Career Foundation context only', () => {
  const graph = { rulesetId: 'career', derivedRelations: [{ id: 'lord-state', relationType: 'CAREER_HOUSE_LORD_STATE', subject: { entityId: 'Saturn' }, inputNodeIds: ['state:saturn'], fact: { suppliedStateFlags: { retrograde: true, ownSign: true, exalted: false, debilitated: false, moolatrikona: false, combust: false } } }] };
  const evidence = adaptCareerInsightEvidence({ conclusions: [conclusion('CAREER_H10_SIGNIFICATION_SCOPE_PRESENT', 'SUPPORTED', 'natal')], analysis: analysis(), domainGraph: graph });
  const state = evidence.find((item) => item.evidenceId.startsWith('planetary-state:'));
  assert.deepEqual(state.provenance.publicContext, [{ planet: 'Saturn', state: 'OWN_SIGN', chart: 'D1' }, { planet: 'Saturn', state: 'RETROGRADE', chart: 'D1' }]);
  assert.equal(JSON.stringify(state).match(/\"(score|strength|confidence|probability|favorable|unfavorable|timing)\"/), null);
  assert.equal(adaptCareerInsightEvidence({ conclusions: [], analysis: analysis(), domainGraph: graph }).some((item) => item.evidenceId.startsWith('planetary-state:')), false);
});

test('adapter exposes only factual H10-lord to occupant Maitri context', () => {
  const graph = { rulesetId: 'career', derivedRelations: [{ id: 'lord-state', relationType: 'CAREER_HOUSE_LORD_STATE', subject: { entityId: 'Saturn' }, inputNodeIds: ['state:saturn'], fact: { relationships: [{ subjectPlanet: 'Saturn', targetPlanet: 'Mercury', chart: 'D1', natural: 'friend', temporary: 'enemy', panchadha: 'neutral' }] } }] };
  const evidence = adaptCareerInsightEvidence({ conclusions: [conclusion('CAREER_H10_SIGNIFICATION_SCOPE_PRESENT', 'SUPPORTED', 'natal')], analysis: analysis(), domainGraph: graph });
  const relationship = evidence.find((item) => item.evidenceId.startsWith('planetary-relationship:'));
  assert.deepEqual(relationship.provenance.publicContext, [{ sourceFamily: 'PLANETARY_RELATIONSHIP', subjectPlanet: 'Saturn', targetPlanet: 'Mercury', relationshipType: 'NATURAL', relationship: 'friend', chart: 'D1' }, { sourceFamily: 'PLANETARY_RELATIONSHIP', subjectPlanet: 'Saturn', targetPlanet: 'Mercury', relationshipType: 'PANCHADHA', relationship: 'neutral', chart: 'D1' }, { sourceFamily: 'PLANETARY_RELATIONSHIP', subjectPlanet: 'Saturn', targetPlanet: 'Mercury', relationshipType: 'TEMPORARY', relationship: 'enemy', chart: 'D1' }]);
  assert.equal(adaptCareerInsightEvidence({ conclusions: [], analysis: analysis(), domainGraph: graph }).some((item) => item.evidenceId.startsWith('planetary-relationship:')), false);
});

test('adapter exposes raw natal Ashtakavarga context only alongside an existing Career foundation', () => {
  const domainGraph = { rulesetId: 'parashari-career-domain-evidence-v1', derivedRelations: [{
    id: 'career-relation:ashtaka', relationType: 'CAREER_ASHTAKAVARGA_CONTEXT', inputNodeIds: ['fact:ashtaka'], fact: { selections: [
      { scoreType: 'SAV', houseNumber: 10, rashiIndex: 9, rawValue: 29 },
      { scoreType: 'BAV', houseNumber: 10, planet: 'Jupiter', rashiIndex: 4, rawValue: 6 },
      { scoreType: 'LAGNA_BAV', houseNumber: 11, rashiIndex: 10, rawValue: 4 },
    ], thresholdOrRanking: 'not-performed' },
  }] };
  const withFoundation = adaptCareerInsightEvidence({ conclusions: [conclusion('CAREER_H10_SIGNIFICATION_SCOPE_PRESENT', 'SUPPORTED', 'natal')], analysis: analysis(), domainGraph });
  const ashtaka = withFoundation.find((item) => item.evidenceId.startsWith('ashtakavarga:'));
  assert.equal(ashtaka.family, 'CAREER_FOUNDATION'); assert.equal(ashtaka.chart, 'D1');
  assert.deepEqual(ashtaka.provenance.publicContext, [
    { sourceFamily: 'ASHTAKAVARGA', scoreType: 'BAV', houseNumber: 10, rashiIndex: 4, value: 6, planet: 'Jupiter' },
    { sourceFamily: 'ASHTAKAVARGA', scoreType: 'LAGNA_BAV', houseNumber: 11, rashiIndex: 10, value: 4 },
    { sourceFamily: 'ASHTAKAVARGA', scoreType: 'SAV', houseNumber: 10, rashiIndex: 9, value: 29 },
  ]);
  assert.equal(JSON.stringify(ashtaka).match(/\"(score|strength|confidence|probability|timing|prediction)\"/), null);
  const traced = buildCareerInsights({ evidence: withFoundation, signals: buildCareerInsightSignals({ evidence: withFoundation }) });
  assert.deepEqual(traced[0].evidenceTrace.signals.flatMap((signal) => signal.evidence).find((item) => item.evidenceId === ashtaka.evidenceId).technicalContext, ashtaka.provenance.publicContext);
  const withoutFoundation = adaptCareerInsightEvidence({ conclusions: [], analysis: analysis(), domainGraph });
  assert.equal(withoutFoundation.some((item) => item.evidenceId.startsWith('ashtakavarga:')), false);
});

test('raw Ashtakavarga magnitude neither changes Career Foundation status nor its ordinal rank', () => {
  const evidenceFor = (value) => adaptCareerInsightEvidence({
    conclusions: [conclusion('CAREER_H10_SIGNIFICATION_SCOPE_PRESENT', 'SUPPORTED', 'natal')], analysis: analysis(),
    domainGraph: { rulesetId: 'parashari-career-domain-evidence-v1', derivedRelations: [{ id: 'career-relation:ashtaka', relationType: 'CAREER_ASHTAKAVARGA_CONTEXT', inputNodeIds: ['fact:ashtaka'], fact: { selections: [{ scoreType: 'SAV', houseNumber: 10, rashiIndex: 9, rawValue: value }] } }] },
  });
  const low = buildCareerInsightSignals({ evidence: evidenceFor(1) });
  const high = buildCareerInsightSignals({ evidence: evidenceFor(99) });
  assert.deepEqual(low.map((item) => [item.family, item.status, item.signalId]), high.map((item) => [item.family, item.status, item.signalId]));
  assert.deepEqual(rankCareerInsightSignals(low).map((item) => item.signalId), rankCareerInsightSignals(high).map((item) => item.signalId));
});

test('signal engine preserves supported, mixed, contradicted and insufficient evidence separately', () => {
  const evidence = adaptCareerInsightEvidence({ conclusions: [conclusion('CAREER_H10_SIGNIFICATION_SCOPE_PRESENT', 'SUPPORTED', 'natal'), conclusion('CAREER_H10_LORD_NATAL_CONNECTION_PRESENT', 'INSUFFICIENT_EVIDENCE', 'dasha'), conclusion('CAREER_GOCHAR_CONNECTION_PRESENT', 'CONTRADICTED', 'transit')], analysis: analysis() });
  const signals = buildCareerInsightSignals({ evidence });
  const foundation = signals.find((item) => item.family === 'CAREER_FOUNDATION'); const transit = signals.find((item) => item.family === 'CURRENT_CAREER_TRANSIT');
  assert.equal(foundation.status, 'MIXED'); assert.equal(foundation.supportiveEvidenceIds.length, 1); assert.equal(foundation.limitingEvidenceIds.length, 1);
  assert.equal(transit.status, 'CONTRADICTED'); assert.equal(transit.contradictoryEvidenceIds.length, 1);
});

test('ranking is ordinal: concurrent timing outranks natal foundation and calibration cannot invent astrology', () => {
  const signals = [
    createInsightSignal({ signalId: 'foundation', domain: 'CAREER', family: 'CAREER_FOUNDATION', ruleId: 'engine', status: 'SUPPORTED', supportiveEvidenceIds: ['e1'], limitingEvidenceIds: [], contradictoryEvidenceIds: [], independentMechanismFamilies: ['NATAL_STRUCTURE'], temporalContext: {}, calibrationSupport: null, explanationKey: 'x', provenance: {} }),
    createInsightSignal({ signalId: 'timing', domain: 'CAREER', family: 'CONCURRENT_CAREER_TIMING', ruleId: 'parashari', status: 'SUPPORTED', supportiveEvidenceIds: ['e2'], limitingEvidenceIds: [], contradictoryEvidenceIds: [], independentMechanismFamilies: ['DASHA', 'GOCHAR_SNAPSHOT'], temporalContext: {}, calibrationSupport: null, explanationKey: 'x', provenance: {} }),
  ];
  assert.deepEqual(rankCareerInsightSignals(signals).map((item) => item.signalId), ['timing', 'foundation']);
  assert.deepEqual(buildCareerInsightSignals({ evidence: [], calibrationContext: { calibrationLevel: 'CALIBRATED' } }), []);
});

test('ranking keeps current concurrent timing before upcoming and independent before partially overlapping', () => {
  const signal = (signalId, timingState, lineageClassification) => createInsightSignal({ signalId, domain: 'CAREER', family: 'CONCURRENT_CAREER_TIMING', ruleId: 'parashari', status: 'SUPPORTED', supportiveEvidenceIds: ['e'], limitingEvidenceIds: [], contradictoryEvidenceIds: [], independentMechanismFamilies: ['DASHA', 'TRANSIT_EVENT'], temporalContext: { timingState, lineageClassification }, calibrationSupport: null, explanationKey: 'x', provenance: {} });
  const active = createInsightSignal({ signalId: 'active', domain: 'CAREER', family: 'ACTIVE_CAREER_DASHA', ruleId: 'parashari', status: 'SUPPORTED', supportiveEvidenceIds: ['e'], limitingEvidenceIds: [], contradictoryEvidenceIds: [], independentMechanismFamilies: ['DASHA'], temporalContext: {}, calibrationSupport: null, explanationKey: 'x', provenance: {} });
  assert.deepEqual(rankCareerInsightSignals([active, signal('upcoming', 'UPCOMING', 'INDEPENDENT'), signal('partial', 'CURRENT', 'PARTIALLY_OVERLAPPING'), signal('current', 'CURRENT', 'INDEPENDENT')]).map((item) => item.signalId), ['current', 'partial', 'upcoming', 'active']);
});

test('builder is stable, traceable, and renderer stays deterministic without outcome prose', () => {
  const evidence = adaptCareerInsightEvidence({ conclusions: [conclusion('CAREER_H10_CONNECTED_DASHA_ACTIVATION_PRESENT', 'SUPPORTED', 'dasha')], analysis: analysis() });
  const signals = buildCareerInsightSignals({ evidence }); const first = buildCareerInsights({ evidence, signals }); const second = buildCareerInsights({ evidence, signals });
  assert.deepEqual(first, second); assert.equal(first.length, 1); assert.equal(first[0].evidenceTrace.signals[0].evidence[0].sourceConclusionId, 'conclusion:dasha');
  assert.throws(() => buildCareerInsightTrace({ insightId: 'orphan', signalIds: ['missing'], signals, evidence }), /Orphan/);
  const rendered = renderCareerInsights({ insights: first }); assert.equal(rendered[0].insightId, first[0].insightId); assert.equal(JSON.stringify(rendered).includes('promoted'), false);
});

test('timing renderer uses supplied timing facts without outcome language', () => {
  const rendered = renderCareerInsights({ insights: [{ insightId: 'timing', family: 'CONCURRENT_CAREER_TIMING', timing: { timingWindow: { kind: 'CAREER_TIMING_OVERLAP' } }, evidenceTrace: {}, caveats: [] }] });
  assert.equal(rendered[0].sentence, 'Career-related Dasha and transit evidence overlap during this period.');
  assert.equal(JSON.stringify(rendered).match(/promotion|salary|job-switch|success/i), null);
});
