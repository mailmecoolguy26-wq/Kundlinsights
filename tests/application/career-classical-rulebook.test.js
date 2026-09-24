'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CAREER_CLASSICAL_RULEBOOK_ID,
  APPROVED_RULES,
  APPROVED_RULE_IDS,
  PROPOSED_RULES,
  evaluateCareerClassicalEvaluation,
  buildCareerTemporalProjectionPlan,
} = require('../../src/application/insights');

function conclusion(ruleId, status = 'SUPPORTED') {
  const rule = APPROVED_RULES.find((item) => item.ruleId === ruleId);
  return { interpretiveRuleId: ruleId, conclusionStatus: status, evidenceIds: [`evidence:${ruleId}`], topic: rule && rule.topic };
}

test('every approved rule has deterministic provenance and contributes only to its declared evidence family', () => {
  assert.equal(APPROVED_RULE_IDS.length, APPROVED_RULES.length);
  for (const rule of APPROVED_RULES) {
    assert.ok(rule.ruleId); assert.ok(rule.family); assert.ok(rule.source); assert.ok(rule.provenance); assert.ok(rule.predicate); assert.ok(rule.effect); assert.ok(rule.predictiveAuthority);
    const value = evaluateCareerClassicalEvaluation({ conclusions: [conclusion(rule.ruleId)] });
    assert.ok(value.matchedRuleIds.includes(rule.ruleId));
    assert.ok(value.evidenceRefs.some((item) => item.ruleId === rule.ruleId));
    assert.equal(value.eligible, false);
  }
});

test('D1 facts, D10 facts, Dasha, and Gochar each remain insufficient on their own', () => {
  const d1 = evaluateCareerClassicalEvaluation({ conclusions: [conclusion('career-h10-signification-scope-v1')] });
  const d10 = evaluateCareerClassicalEvaluation({ d10Facts: ['fact:d10-tenth-house', 'fact:d10-lord'] });
  const dasha = evaluateCareerClassicalEvaluation({ conclusions: [conclusion('career-h10-connected-dasha-activation-v1')] });
  const gochar = evaluateCareerClassicalEvaluation({ conclusions: [conclusion('career-gochar-structural-connection-v1'), conclusion('career-temporal-coactivation-v1')] });
  assert.deepEqual(d1.dasha.matchedRuleIds, []);
  assert.equal(d10.d10.confirmationAvailable, false);
  assert.equal(d10.d10.role, 'APPROVED_FACTUAL_REFINEMENT_NO_ELIGIBILITY_EFFECT');
  assert.deepEqual(dasha.d1.matchedRuleIds, []);
  assert.equal(gochar.gochar.manifestationAvailable, false);
  for (const value of [d1, d10, dasha, gochar]) assert.equal(value.primaryEligibility, false);
});

test('unrelated Dasha, supplied Gochar, high SAV/BAV, and historical recurrence cannot create Career eligibility', () => {
  const value = evaluateCareerClassicalEvaluation({
    conclusions: [
      conclusion('career-h10-signification-scope-v1'),
      { interpretiveRuleId: 'unapproved-mars-dasha-v1', conclusionStatus: 'SUPPORTED', evidenceIds: ['evidence:unapproved'] },
      conclusion('career-gochar-structural-connection-v1'),
    ],
    ashtakavargaEvidence: ['fact:sav-99', 'fact:bav-99'],
    historicalRecurrenceEvidence: ['historical:9-of-9'],
  });
  assert.deepEqual(value.dasha.matchedRuleIds, []);
  assert.equal(value.ashtakavarga.affectsEligibility, false);
  assert.equal(value.historicalRecurrence.affectsEligibility, false);
  assert.equal(value.eligible, false);
  assert.equal(value.primaryEligibility, false);
});

test('the narrow Venus-MD/Saturn-AD predicate stays traceable but cannot become a future Career window', () => {
  const value = evaluateCareerClassicalEvaluation({ conclusions: [conclusion('career-venus-md-saturn-ad-professional-loss-predicate-v1')] });
  assert.deepEqual(value.auditedClassicalPredicates, [{ ruleId: 'career-venus-md-saturn-ad-professional-loss-predicate-v1', evidenceIds: ['evidence:career-venus-md-saturn-ad-professional-loss-predicate-v1'] }]);
  assert.equal(value.eligible, false);
  assert.equal(value.primaryEligibility, false);
});

test('proposed rules never execute and evaluation is deterministic and immutable', () => {
  const proposed = PROPOSED_RULES.map((rule) => ({ interpretiveRuleId: rule.ruleId, conclusionStatus: 'SUPPORTED', evidenceIds: [`evidence:${rule.ruleId}`] }));
  const input = { conclusions: [...proposed, conclusion('career-h10-signification-scope-v1')], d10Facts: ['fact:d10'], ashtakavargaEvidence: ['fact:sav'], historicalRecurrenceEvidence: ['historical:one'] };
  const first = evaluateCareerClassicalEvaluation(input);
  const second = evaluateCareerClassicalEvaluation(structuredClone(input));
  assert.deepEqual(first, second);
  assert.equal(first.matchedRuleIds.some((id) => id.startsWith('proposed-')), false);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(first.rulesetId, CAREER_CLASSICAL_RULEBOOK_ID);
});

test('the existing temporal projection integration gate remains disabled', () => {
  const plan = buildCareerTemporalProjectionPlan({
    domainGraph: { domain: 'CAREER', derivedRelations: [] },
    horizonStart: '2026-01-01T00:00:00.000Z', horizonEnd: '2027-01-01T00:00:00.000Z',
  });
  assert.equal(plan.integrationGate.enabled, false);
  assert.equal(evaluateCareerClassicalEvaluation({}).enabled, false);
});
