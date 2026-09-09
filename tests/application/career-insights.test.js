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

test('builder is stable, traceable, and renderer stays deterministic without outcome prose', () => {
  const evidence = adaptCareerInsightEvidence({ conclusions: [conclusion('CAREER_H10_CONNECTED_DASHA_ACTIVATION_PRESENT', 'SUPPORTED', 'dasha')], analysis: analysis() });
  const signals = buildCareerInsightSignals({ evidence }); const first = buildCareerInsights({ evidence, signals }); const second = buildCareerInsights({ evidence, signals });
  assert.deepEqual(first, second); assert.equal(first.length, 1); assert.equal(first[0].evidenceTrace.signals[0].evidence[0].sourceConclusionId, 'conclusion:dasha');
  assert.throws(() => buildCareerInsightTrace({ insightId: 'orphan', signalIds: ['missing'], signals, evidence }), /Orphan/);
  const rendered = renderCareerInsights({ insights: first }); assert.equal(rendered[0].insightId, first[0].insightId); assert.equal(JSON.stringify(rendered).includes('promoted'), false);
});
