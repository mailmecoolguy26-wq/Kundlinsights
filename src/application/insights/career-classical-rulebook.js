'use strict';

// This contract is intentionally not wired into reading generation or future
// scanning. It records the approved evidence boundary a later window engine
// must satisfy; it does not authorize Career prediction.
const { freeze } = require('../../synthesis/evidence-node');

const CAREER_CLASSICAL_RULEBOOK_ID = 'taraverse-career-classical-rulebook-v1';

const APPROVED_RULES = freeze([
  {
    ruleId: 'career-h10-signification-scope-v1', family: 'D1_CAREER_STRUCTURE',
    source: 'BPHS:tenth-house-significations', provenance: 'ALREADY_APPROVED_REPOSITORY_RULE',
    predicate: 'A supplied Career conclusion records the H10 professional-activity scope.',
    effect: 'FACTUAL_D1_CAREER_RELEVANCE', predictiveAuthority: 'DESCRIPTIVE_ONLY',
  },
  {
    ruleId: 'career-h10-lord-natal-connection-v1', family: 'D1_CAREER_STRUCTURE',
    source: 'BPHS:tenth-house-lord-relationship', provenance: 'ALREADY_APPROVED_REPOSITORY_RULE',
    predicate: 'A supplied Career conclusion records the supplied H10-lord natal relation.',
    effect: 'FACTUAL_D1_CAREER_RELEVANCE', predictiveAuthority: 'DESCRIPTIVE_ONLY',
  },
  {
    ruleId: 'career-h10-occupant-connection-v1', family: 'D1_CAREER_STRUCTURE',
    source: 'BPHS:tenth-house-significations', provenance: 'ALREADY_APPROVED_REPOSITORY_RULE',
    predicate: 'A supplied Career conclusion records one supplied H10 occupant relation.',
    effect: 'FACTUAL_D1_CAREER_RELEVANCE', predictiveAuthority: 'DESCRIPTIVE_ONLY',
  },
  {
    ruleId: 'career-h10-connected-dasha-activation-v1', family: 'DASHA_CAREER_ACTIVATION',
    source: 'BPHS:vimshottari-dasha-placement-state-relationships', provenance: 'ALREADY_APPROVED_REPOSITORY_RULE',
    predicate: 'A supplied active MD, AD, or PD is structurally linked to an existing H10 Career relation.',
    effect: 'FACTUAL_DASHA_ACTIVATION', predictiveAuthority: 'DESCRIPTIVE_ONLY',
  },
  {
    ruleId: 'career-gochar-structural-connection-v1', family: 'GOCHAR_CAREER_CONTEXT',
    source: 'Layer9-Layer12C-supplied-structural-gochar', provenance: 'ALREADY_APPROVED_REPOSITORY_RULE',
    predicate: 'A supplied current Gochar snapshot is structurally linked to existing Career evidence.',
    effect: 'FACTUAL_GOCHAR_CONTEXT', predictiveAuthority: 'DESCRIPTIVE_ONLY',
  },
  {
    ruleId: 'career-transit-event-timing-context-v1', family: 'GOCHAR_CAREER_CONTEXT',
    source: 'Layer10-refined-event-Layer12C-structural-link', provenance: 'ALREADY_APPROVED_ENGINE_CONVENTION',
    predicate: 'A supplied non-Sade-Sati refined transit event is structurally linked to existing Career evidence.',
    effect: 'FACTUAL_TRANSIT_EVENT_CONTEXT', predictiveAuthority: 'DESCRIPTIVE_ONLY',
  },
  {
    ruleId: 'career-temporal-coactivation-v1', family: 'GOCHAR_CAREER_CONTEXT',
    source: 'KundlInsights:Layer12D-independent-temporal-lineage-policy', provenance: 'ALREADY_APPROVED_ENGINE_CONVENTION',
    predicate: 'Independent supplied Dasha and Gochar/transit mechanisms activate the same Career subject at the supplied instant.',
    effect: 'FACTUAL_COACTIVATION_CONTEXT', predictiveAuthority: 'DESCRIPTIVE_ONLY',
  },
  {
    ruleId: 'career-venus-md-saturn-ad-professional-loss-predicate-v1', family: 'AUDITED_CLASSICAL_PREDICATE',
    source: 'BPHS:Chapter-60:Venus-Dasha/Saturn-Antardasha:verses-55-57', provenance: 'ALREADY_APPROVED_REPOSITORY_RULE',
    predicate: 'One approved Saturn natal branch is supplied while Saturn AD is within Venus MD at the supplied instant.',
    effect: 'SOURCE_DEFINED_PREDICATE_SATISFACTION_ONLY', predictiveAuthority: 'NOT_AN_EVENT_FORECAST',
  },
]);

const PROPOSED_RULES = freeze([
  {
    ruleId: 'proposed-d10-career-confirmation-v1', family: 'D10_CAREER_CONFIRMATION',
    source: 'docs/sources/career/d10/D10-Career-Masterclass-Transcript.txt', provenance: 'APPROVED_FACTUAL_REFINEMENT_ONLY',
    predicate: 'Pinned D10 Lagna, H10, and H10-lord facts may refine an independently established D1 theme; no D10 predicate has an eligibility or timing effect.',
    approvalRequired: 'Any future D10 eligibility, timing, blocking, scoring, or outcome effect requires separate source and product approval.',
  },
  {
    ruleId: 'proposed-gochar-career-manifestation-v1', family: 'GOCHAR_CAREER_MANIFESTATION',
    source: 'career-gochar-dependencies:dependency-unspecified', provenance: 'RULEBOOK_GAP',
    predicate: 'No executable predicate: current Gochar has no approved Career-specific planet, target, and duration restriction.',
    approvalRequired: 'A source-audited planet/target/relationship/window rule plus a safety review for future projection.',
  },
  {
    ruleId: 'proposed-sav-bav-career-window-modifier-v1', family: 'ASHTAKAVARGA_SUPPORT',
    source: 'CAREER-ASHTAKAVARGA-INTERPRETATION-POLICY:CAV-I08,CAV-09', provenance: 'RULEBOOK_GAP',
    predicate: 'No executable threshold, ranking, or transit-SAV/BAV Career modifier exists.',
    approvalRequired: 'A separately audited, exact BAV/Pinda/Kakshya rule and explicit non-predictive product policy.',
  },
]);

const APPROVED_RULE_IDS = freeze(APPROVED_RULES.map((rule) => rule.ruleId));
const APPROVED_BY_ID = new Map(APPROVED_RULES.map((rule) => [rule.ruleId, rule]));
const D1_RULE_IDS = new Set(APPROVED_RULES.filter((rule) => rule.family === 'D1_CAREER_STRUCTURE').map((rule) => rule.ruleId));
const DASHA_RULE_IDS = new Set(['career-h10-connected-dasha-activation-v1']);
const GOCHAR_RULE_IDS = new Set(['career-gochar-structural-connection-v1', 'career-transit-event-timing-context-v1', 'career-temporal-coactivation-v1']);

function array(value, name) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array.`);
  return value;
}

function evidenceFor(rule, conclusion) {
  const evidenceIds = array(conclusion.evidenceIds, 'conclusion.evidenceIds').filter((id) => typeof id === 'string').sort();
  return { ruleId: rule.ruleId, evidenceIds };
}

function supportedApprovedConclusions(conclusions) {
  return conclusions
    .filter((conclusion) => conclusion && conclusion.conclusionStatus === 'SUPPORTED' && APPROVED_BY_ID.has(conclusion.interpretiveRuleId))
    .map((conclusion) => ({ rule: APPROVED_BY_ID.get(conclusion.interpretiveRuleId), conclusion }))
    .sort((left, right) => left.rule.ruleId.localeCompare(right.rule.ruleId));
}

function suppliedReferences(values, name) {
  return array(values, name)
    .map((value) => typeof value === 'string' ? value : value && value.evidenceId)
    .filter((value) => typeof value === 'string' && value)
    .sort();
}

function evaluateCareerClassicalEvaluation({ conclusions = [], d10Facts = [], ashtakavargaEvidence = [], historicalRecurrenceEvidence = [] } = {}) {
  const matched = supportedApprovedConclusions(array(conclusions, 'conclusions'));
  const byFamily = (ids) => matched.filter(({ rule }) => ids.has(rule.ruleId));
  const d1 = byFamily(D1_RULE_IDS);
  const dasha = byFamily(DASHA_RULE_IDS);
  const gochar = byFamily(GOCHAR_RULE_IDS);
  const factualD10EvidenceRefs = suppliedReferences(d10Facts, 'd10Facts');
  const ashtakavargaRefs = suppliedReferences(ashtakavargaEvidence, 'ashtakavargaEvidence');
  const historicalRefs = suppliedReferences(historicalRecurrenceEvidence, 'historicalRecurrenceEvidence');
  const matchedRuleIds = matched.map(({ rule }) => rule.ruleId);
  const evidenceRefs = matched.map(({ rule, conclusion }) => evidenceFor(rule, conclusion));

  // D10 factual refinement is deliberately non-creating. There is still no
  // approved Career-specific Gochar manifestation predicate, so this evaluator
  // cannot make a future candidate eligible in Phase 2.
  const d10Confirmation = false;
  const qualifyingGocharManifestation = false;
  const primaryEligibility = d1.length > 0 && dasha.length > 0 && d10Confirmation && qualifyingGocharManifestation;

  return freeze({
    rulesetId: CAREER_CLASSICAL_RULEBOOK_ID,
    enabled: false,
    eligible: false,
    primaryEligibility,
    d1: { matchedRuleIds: d1.map(({ rule }) => rule.ruleId), evidenceRefs: d1.map(({ rule, conclusion }) => evidenceFor(rule, conclusion)), role: 'PRIMARY_STRUCTURE' },
    d10: { matchedRuleIds: [], evidenceRefs: factualD10EvidenceRefs, confirmationAvailable: false, role: 'APPROVED_FACTUAL_REFINEMENT_NO_ELIGIBILITY_EFFECT' },
    dasha: { matchedRuleIds: dasha.map(({ rule }) => rule.ruleId), evidenceRefs: dasha.map(({ rule, conclusion }) => evidenceFor(rule, conclusion)), role: 'PRIMARY_ACTIVATION_CONTEXT' },
    gochar: { matchedRuleIds: gochar.map(({ rule }) => rule.ruleId), evidenceRefs: gochar.map(({ rule, conclusion }) => evidenceFor(rule, conclusion)), manifestationAvailable: false, role: 'FACTUAL_MANIFESTATION_CONTEXT_ONLY' },
    ashtakavarga: { matchedRuleIds: [], evidenceRefs: ashtakavargaRefs, role: 'SUPPORT_ONLY', affectsEligibility: false },
    historicalRecurrence: { matchedRuleIds: [], evidenceRefs: historicalRefs, role: 'PERSONALIZATION_ONLY', affectsEligibility: false },
    auditedClassicalPredicates: matched.filter(({ rule }) => rule.family === 'AUDITED_CLASSICAL_PREDICATE').map(({ rule, conclusion }) => evidenceFor(rule, conclusion)),
    matchedRuleIds,
    evidenceRefs,
    limitations: [
      'D10_CANNOT_CREATE_CAREER_ELIGIBILITY_OR_TIMING',
      'NO_APPROVED_GOCHAR_CAREER_MANIFESTATION_PREDICATE',
      'SAV_BAV_CANNOT_CREATE_CAREER_ELIGIBILITY',
      'HISTORICAL_RECURRENCE_CANNOT_CREATE_CAREER_ELIGIBILITY',
      'TEMPORAL_PROJECTION_INTEGRATION_DISABLED',
    ],
    provenance: { predictiveAuthority: 'DISABLED', rulebookOnly: true },
  });
}

module.exports = {
  CAREER_CLASSICAL_RULEBOOK_ID,
  APPROVED_RULES,
  APPROVED_RULE_IDS,
  PROPOSED_RULES,
  evaluateCareerClassicalEvaluation,
};
