'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CAREER_D10_CONFIRMATION_CONTRACT_ID,
  D10_CONFIRMED_RULES,
  D10_THEME_REGISTRY,
  D10_DIGNITY_ALLOWLIST,
  SOURCE_REFS,
  evaluateCareerD10Confirmation,
} = require('../../src/application/insights');

function d10() {
  return {
    chart: 'D10',
    lagna: { house: 1, sign: { rashiIndex: 1, englishName: 'Mesha' }, lord: 'Mars', lordHouse: 10 },
    tenthHouse: { house: 10, sign: { rashiIndex: 10, englishName: 'Makara' }, lord: 'Saturn', lordHouse: 7, occupants: [{ planet: 'Mercury', house: 10 }] },
  };
}

test('Phase 2E pins deterministic D10 H10, H10-lord, and Lagna evidence with timestamped source references', () => {
  const value = evaluateCareerD10Confirmation({ careerD10Structure: d10() });
  assert.equal(value.contractId, CAREER_D10_CONFIRMATION_CONTRACT_ID);
  assert.equal(value.executionEvidence.ruleId, 'D10_CONFIRM_PROPOSED_002');
  assert.equal(value.tenthLordEvidence.ruleId, 'D10_CONFIRM_PROPOSED_003');
  assert.equal(value.profileEvidence.ruleId, 'D10_CONFIRM_PROPOSED_004');
  assert.deepEqual(D10_CONFIRMED_RULES, ['D10_CONFIRM_PROPOSED_002', 'D10_CONFIRM_PROPOSED_003', 'D10_CONFIRM_PROPOSED_004']);
  for (const ref of Object.values(SOURCE_REFS)) {
    assert.match(ref.file, /^docs\/sources\/career\/d10\//);
    assert.match(ref.from, /^00:/); assert.match(ref.to, /^00:/); assert.ok(ref.paraphrase);
  }
});

test('a supported D1 structural theme and matching D10 structural theme create only confirmation/refinement', () => {
  const value = evaluateCareerD10Confirmation({
    d1CareerRelevant: true,
    d1Themes: ['PROFESSIONAL_EXECUTION'],
    careerD10Structure: d10(),
  });
  assert.deepEqual(value.sharedThemesWithD1, ['PROFESSIONAL_EXECUTION']);
  assert.equal(value.confirmationPresent, true);
  assert.ok(value.matchedRuleIds.includes('D10_CONFIRM_PROPOSED_001'));
  assert.equal(value.eligibilityCreated, false);
  assert.equal(value.timingCreated, false);
  assert.equal(value.futureWindowCreated, false);
  assert.equal(value.projectionGateChanged, false);
});

test('unrelated D1 themes and D10 themes do not create thematic confirmation', () => {
  const value = evaluateCareerD10Confirmation({ d1CareerRelevant: true, d1Themes: ['PROFESSIONAL_PROFILE'], careerD10Structure: { chart: 'D10', tenthHouse: d10().tenthHouse } });
  assert.deepEqual(value.themes, ['PROFESSIONAL_EXECUTION', 'TENTH_LORD_REFINEMENT']);
  assert.deepEqual(value.sharedThemesWithD1, []);
  assert.equal(value.confirmationPresent, false);
});

test('D10 cannot create Career relevance or eligibility without independently supplied D1 relevance', () => {
  const value = evaluateCareerD10Confirmation({ d1CareerRelevant: false, d1Themes: ['PROFESSIONAL_EXECUTION'], careerD10Structure: d10() });
  assert.deepEqual(value.sharedThemesWithD1, []);
  assert.equal(value.confirmationPresent, false);
  assert.equal(value.eligibilityCreated, false);
});

test('the narrow dignity allowlist refines only an already relevant D10 planet', () => {
  assert.deepEqual(D10_DIGNITY_ALLOWLIST, ['OWN_SIGN', 'EXALTED', 'DEBILITATED']);
  const irrelevant = evaluateCareerD10Confirmation({ careerD10Structure: d10(), d10Dignity: [{ planet: 'Jupiter', state: 'EXALTED' }] });
  assert.deepEqual(irrelevant.relevantPlanetDignity, []);
  const relevant = evaluateCareerD10Confirmation({ careerD10Structure: d10(), relevantD10Planets: ['Mercury'], d10Dignity: [{ planet: 'Mercury', state: 'OWN_SIGN' }, { planet: 'Saturn', state: 'RETROGRADE' }] });
  assert.deepEqual(relevant.relevantPlanetDignity, [{ planet: 'Mercury', state: 'OWN_SIGN' }]);
  assert.deepEqual(relevant.refinementNotes, [{ planet: 'Mercury', state: 'OWN_SIGN', role: 'ALREADY_RELEVANT_FACTOR_ONLY' }]);
  assert.equal(relevant.confirmationPresent, false);
});

test('the registry is finite, structural, deterministic, and free of profession or outcome claims', () => {
  assert.deepEqual(Object.keys(D10_THEME_REGISTRY).sort(), ['PROFESSIONAL_EXECUTION', 'PROFESSIONAL_PROFILE', 'TENTH_LORD_REFINEMENT']);
  const text = JSON.stringify(D10_THEME_REGISTRY);
  assert.equal(text.match(/job|business|promotion|salary|success|failure|timing|probability|confidence/i), null);
  const input = { d1CareerRelevant: true, d1Themes: ['PROFESSIONAL_EXECUTION'], careerD10Structure: d10() };
  assert.deepEqual(evaluateCareerD10Confirmation(input), evaluateCareerD10Confirmation(structuredClone(input)));
});
