'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createConclusion, createRendererInput } = require('../../src/interpretation');
const { buildReading } = require('../../src/reading');

const START = { utc: '2024-01-01T00:00:00.000Z' };
const END = { utc: '2025-01-01T00:00:00.000Z' };
function deepFreeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(deepFreeze); } return value; }
function conclusion(topic, { status = 'SUPPORTED', classification = 'SOURCE_INTERPRETATION', temporalContext, contradictions = [], missingData = [] } = {}) {
  return createConclusion({ domain: 'CAREER', topic, rulesetId: 'career-test-v1', interpretiveRuleId: `rule:${topic}`, ruleClassification: classification, conclusionStatus: status, evidenceIds: [`e:${topic}`], rootSourceIds: [`root:${topic}`], evidenceFamilyIds: [`family:${topic}`], independentMechanismFamilies: ['NATAL_STRUCTURE'], sourceStrengths: ['CLASSICAL_TRANSLATION'], contradictions, unresolvedEvidenceIds: [], missingData, temporalContext: temporalContext || { dashaIntervals: [], gocharSnapshotInstant: null, transitEventIds: [] }, provenance: { analysisId: 'analysis:1', sourceRefs: [`source:${topic}`], sourcePredicateId: topic === 'CAREER_CLASSICAL_PROFESSIONAL_LOSS_PREDICATE_PRESENT' ? 'bphs-venus-saturn-professional-loss-natal-v1' : null } });
}
function item(reading, topic) { return reading.readingItems.find((value) => value.topic === topic); }

test('builds only a deterministic CAREER reading and rejects unsupported domains', () => {
  const reading = buildReading({ domain: 'CAREER', conclusions: [conclusion('CAREER_H10_SIGNIFICATION_SCOPE_PRESENT')] });
  assert.equal(reading.domain, 'CAREER'); assert.throws(() => buildReading({ domain: 'HEALTH', conclusions: [] }), /Unsupported/);
});

test('maps natal structure with controlled H10, H2 resource, and H11 gain template keys', () => {
  const reading = buildReading({ domain: 'CAREER', conclusions: [
    conclusion('CAREER_H10_SIGNIFICATION_SCOPE_PRESENT'), conclusion('CAREER_H10_LORD_NATAL_CONNECTION_PRESENT'), conclusion('CAREER_H10_OCCUPANT_CONNECTION_PRESENT'), conclusion('CAREER_H2_RESOURCE_CONTEXT_PRESENT'), conclusion('CAREER_H11_GAIN_CONTEXT_PRESENT')
  ] });
  for (const topic of ['CAREER_H10_SIGNIFICATION_SCOPE_PRESENT', 'CAREER_H10_LORD_NATAL_CONNECTION_PRESENT', 'CAREER_H10_OCCUPANT_CONNECTION_PRESENT', 'CAREER_H2_RESOURCE_CONTEXT_PRESENT', 'CAREER_H11_GAIN_CONTEXT_PRESENT']) {
    const value = item(reading, topic); assert.equal(value.section, 'CAREER_STRUCTURE'); assert.equal(value.templateKey, topic); assert.ok(value.disclosures.includes('STRUCTURAL_CONTEXT_ONLY'));
  }
});

test('maps Dasha, Gochar, transit, and co-activation as structural temporal context only', () => {
  const interval = { dashaIntervals: [{ level: 'MD', lord: 'Venus', startInstant: START, endInstant: END }], gocharSnapshotInstant: null, transitEventIds: [] };
  const point = { dashaIntervals: [], gocharSnapshotInstant: '2024-06-01T12:00:00.000Z', transitEventIds: ['event:1'] };
  const reading = buildReading({ domain: 'CAREER', conclusions: [
    conclusion('CAREER_H10_CONNECTED_DASHA_ACTIVATION_PRESENT', { temporalContext: interval }), conclusion('CAREER_GOCHAR_CONNECTION_PRESENT', { temporalContext: point }), conclusion('CAREER_TIMING_TRIGGER_CONTEXT_PRESENT', { temporalContext: point, classification: 'ENGINE_CONVENTION' }), conclusion('CAREER_TEMPORAL_COACTIVATION_PRESENT', { temporalContext: interval, classification: 'ENGINE_CONVENTION' })
  ] });
  assert.deepEqual(item(reading, 'CAREER_H10_CONNECTED_DASHA_ACTIVATION_PRESENT').temporalContext, interval);
  assert.equal(item(reading, 'CAREER_GOCHAR_CONNECTION_PRESENT').temporalContext.gocharSnapshotInstant, point.gocharSnapshotInstant);
  assert.equal(item(reading, 'CAREER_TIMING_TRIGGER_CONTEXT_PRESENT').temporalContext.transitEventIds[0], 'event:1');
  assert.ok(item(reading, 'CAREER_TEMPORAL_COACTIVATION_PRESENT').disclosures.includes('TEMPORAL_CONTEXT_ONLY'));
  assert.equal(JSON.stringify(reading).match(/confidence|strength|opportunity|obstruction/g), null);
});

test('renders the classical professional-loss predicate only as safe predicate satisfaction metadata', () => {
  const reading = buildReading({ domain: 'CAREER', conclusions: [conclusion('CAREER_CLASSICAL_PROFESSIONAL_LOSS_PREDICATE_PRESENT', { classification: 'CLASSICAL_RULE', temporalContext: { dashaIntervals: [{ level: 'AD', lord: 'Saturn', startInstant: START, endInstant: END }], gocharSnapshotInstant: null, transitEventIds: [] } })] });
  const value = reading.readingItems[0];
  assert.equal(value.status, 'SUPPORTED'); assert.ok(value.disclosures.includes('CLASSICAL_PREDICATE_NOT_EVENT_CERTAINTY'));
  assert.equal(value.sourceRuleRefs.classification, 'CLASSICAL_RULE'); assert.equal(value.provenance.conclusionProvenance.sourcePredicateId, 'bphs-venus-saturn-professional-loss-natal-v1');
  const text = JSON.stringify(value); for (const word of ['job loss', 'termination', 'unemployment', 'business failure', 'guaranteed', 'prediction']) assert.equal(text.includes(word), false, word);
});

test('preserves every Layer 13 status, contradictions, missing data, and source attribution unchanged', () => {
  const statuses = ['SUPPORTED', 'MIXED', 'INSUFFICIENT_EVIDENCE', 'CONTRADICTED', 'NOT_APPLICABLE'];
  const inputs = statuses.map((status) => conclusion('CAREER_H10_SIGNIFICATION_SCOPE_PRESENT', { status, contradictions: status === 'CONTRADICTED' ? ['contradiction:1'] : [], missingData: status === 'INSUFFICIENT_EVIDENCE' ? ['missing:1'] : [] }));
  const reading = buildReading({ domain: 'CAREER', conclusions: inputs });
  assert.deepEqual(reading.readingItems.map((value) => value.status).sort(), statuses.sort());
  const contradicted = reading.readingItems.find((value) => value.status === 'CONTRADICTED'); assert.deepEqual(contradicted.contradictionRefs, ['contradiction:1']); assert.ok(contradicted.disclosures.includes('CONTRADICTION_PRESENT'));
  const missing = reading.readingItems.find((value) => value.status === 'INSUFFICIENT_EVIDENCE'); assert.deepEqual(missing.missingDataRefs, ['missing:1']); assert.ok(missing.disclosures.includes('MISSING_DATA_NEUTRAL'));
  assert.equal(reading.readingItems[0].sourceRuleRefs.ruleId.startsWith('rule:'), true); assert.equal(reading.readingItems[0].sourceEvidenceRefs.rootSourceIds.length, 1);
});

test('preserves interval and point context exactly without fabricating temporal windows', () => {
  const context = { dashaIntervals: [{ level: 'AD', lord: 'Saturn', startInstant: START, endInstant: END }], gocharSnapshotInstant: '2024-08-01T00:00:00.000Z', transitEventIds: ['event:exact'] };
  const value = buildReading({ domain: 'CAREER', conclusions: [conclusion('CAREER_H10_CONNECTED_DASHA_ACTIVATION_PRESENT', { temporalContext: context })] }).readingItems[0];
  assert.deepEqual(value.temporalContext, context); assert.equal(Object.hasOwn(value.temporalContext, 'predictionWindow'), false); assert.equal(Object.hasOwn(value.temporalContext, 'range'), false);
});

test('deduplicates, orders deterministically, accepts frozen input, is deeply immutable, and composes the Layer 13 renderer contract', () => {
  const first = conclusion('CAREER_GOCHAR_CONNECTION_PRESENT', { temporalContext: { dashaIntervals: [], gocharSnapshotInstant: '2024-02-01T00:00:00.000Z', transitEventIds: [] } });
  const second = conclusion('CAREER_H10_SIGNIFICATION_SCOPE_PRESENT'); const source = deepFreeze([first, second, first]); const before = JSON.stringify(source);
  const left = buildReading({ domain: 'CAREER', conclusions: source }); const right = buildReading({ domain: 'CAREER', conclusions: [second, first] });
  assert.deepEqual(left, right); assert.equal(left.readingItems.length, 2); assert.equal(left.sections[0].section, 'CAREER_STRUCTURE'); assert.equal(Object.isFrozen(left), true); assert.equal(Object.isFrozen(left.readingItems[0]), true); assert.equal(JSON.stringify(source), before);
  assert.equal(createRendererInput(first).conclusionId, left.readingItems.find((value) => value.topic === first.topic).provenance.conclusionId);
});

test('does not expose provider payloads, raw astrology internals, scoring fields, or free-form paragraphs', () => {
  const value = buildReading({ domain: 'CAREER', conclusions: [conclusion('CAREER_H10_SIGNIFICATION_SCOPE_PRESENT')] }); const text = JSON.stringify(value);
  for (const forbidden of ['providerPayload', 'astronomy', 'ayanamsha', 'longitude', 'score', 'weight', 'confidence', 'probability', 'percentage', 'likelihood', 'recommendation', 'remedy', 'paragraph', 'expectedOutcome']) assert.equal(text.includes(`"${forbidden}"`), false, forbidden);
  assert.equal(value.provenance.freeFormProse, 'not-generated');
});
