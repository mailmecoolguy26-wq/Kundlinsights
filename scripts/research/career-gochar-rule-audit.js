'use strict';

// Research-only repository provenance audit.  This module deliberately does
// not calculate charts, scan transits, or import production interpretation.
const fs = require('node:fs');
const path = require('node:path');

const SOURCE_INVENTORY = Object.freeze([
  { path: 'docs/LAYER-9-GOCHAR-TRANSIT-FOUNDATION.md', source: 'KundlInsights Layer 9 engineering documentation', topic: 'Generic factual Gochar snapshot: nine bodies, natal houses, same-Rashi, Drishti, and Sade Sati mechanics.', deterministicRuleDetail: false },
  { path: 'docs/LAYER-10-TRANSIT-EVENT-SCANNER.md', source: 'KundlInsights Layer 10 engineering documentation', topic: 'Refined ingress, station, same-Rashi, Drishti, and Sade Sati transition mechanics.', deterministicRuleDetail: false },
  { path: 'docs/LAYER-12B-CAREER-DOMAIN-EVIDENCE.md', source: 'BPHS references plus KundlInsights Career evidence documentation', topic: 'H10, H10 lord, occupants, neutral H2/H11 context, and supplied natal relations.', deterministicRuleDetail: false },
  { path: 'docs/LAYER-12B3-CAREER-STATUS-PREDICATE-EVIDENCE.md', source: 'Brihat Parashara Hora Shastra, Chapter 21 verses 8–10; Chapter 60 verses 55–57', topic: 'Audited natal Career-status components and Venus-MD/Saturn-AD prerequisite evidence.', deterministicRuleDetail: false },
  { path: 'docs/LAYER-13B2-CAREER-DASHA-ACTIVATION.md', source: 'BPHS Vimshottari reference via existing rulebook', topic: 'Active MD/AD/PD activation of supplied Career relations.', deterministicRuleDetail: false },
  { path: 'docs/LAYER-13B3-CAREER-GOCHAR-TIMING.md', source: 'KundlInsights engine convention', topic: 'Neutral supplied Gochar and Layer-10 timing context only; explicitly no Career outcome.', deterministicRuleDetail: false },
  { path: 'docs/LAYER-13B4-CAREER-TEMPORAL-COACTIVATION.md', source: 'KundlInsights engine convention', topic: 'Independent same-subject Dasha and supplied Gochar/transit evidence coactivation.', deterministicRuleDetail: false },
  { path: 'docs/LAYER-13C2-CLASSICAL-CAREER-EVENT-PREDICATES.md', source: 'Brihat Parashara Hora Shastra, Chapter 60, Venus Dasha / Saturn Antardasha, verses 55–57', topic: 'One source-audited Dasha-only professional-loss predicate; explicitly does not consume Gochar.', deterministicRuleDetail: true },
]);

const EXISTING_CAREER_PROVENANCE = Object.freeze([
  { ruleId: 'career-h10-signification-scope-v1', provenance: 'DIRECT_CLASSICAL', source: 'BPHS:tenth-house-significations', transitSpecific: false, projectionDependencyReady: false },
  { ruleId: 'career-h10-lord-natal-connection-v1', provenance: 'DERIVED_CLASSICAL', source: 'BPHS:tenth-house-lord-relationship', transitSpecific: false, projectionDependencyReady: false },
  { ruleId: 'career-h10-occupant-connection-v1', provenance: 'DERIVED_CLASSICAL', source: 'BPHS:tenth-house-significations', transitSpecific: false, projectionDependencyReady: false },
  { ruleId: 'career-h10-connected-dasha-activation-v1', provenance: 'DERIVED_CLASSICAL', source: 'BPHS:vimshottari-dasha-placement-state-relationships', transitSpecific: false, projectionDependencyReady: false },
  { ruleId: 'career-gochar-structural-connection-v1', provenance: 'UNSPECIFIED', source: 'Layer9-Layer12C-supplied-structural-gochar', transitSpecific: true, projectionDependencyReady: false },
  { ruleId: 'career-transit-event-timing-context-v1', provenance: 'ENGINE_CONVENTION', source: 'Layer10-refined-event-Layer12C-structural-link', transitSpecific: true, projectionDependencyReady: false },
  { ruleId: 'career-temporal-coactivation-v1', provenance: 'ENGINE_CONVENTION', source: 'KundlInsights:Layer12D-independent-temporal-lineage-policy', transitSpecific: true, projectionDependencyReady: false },
  { ruleId: 'career-venus-md-saturn-ad-professional-loss-predicate-v1', provenance: 'DIRECT_CLASSICAL', source: 'BPHS:Chapter-60:Venus-Dasha/Saturn-Antardasha:verses-55-57', transitSpecific: false, projectionDependencyReady: false },
]);

const CANDIDATES = Object.freeze([
  {
    candidateRuleId: 'career-gochar-structural-context-existing-v1',
    source: 'Layer9-Layer12C-supplied-structural-gochar',
    provenance: 'UNSPECIFIED',
    transitPlanets: { scope: 'UNSPECIFIED', values: null },
    natalTargets: { scope: 'UNSPECIFIED', values: null },
    relationTypes: { scope: 'UNSPECIFIED', values: null },
    eventTypes: { scope: 'UNSPECIFIED', values: null },
    prerequisites: ['supplied Layer 9 Gochar activation'],
    exactPredicate: 'No Career-specific classical predicate is recorded.',
    claimedDomainMeaning: 'Structural connection only; no Career outcome.',
    temporalSemantics: 'GENERAL_TRANSIT_CONTEXT',
    outcomeSemantics: 'UNSAFE_TO_PRODUCTIZE',
    inputReadiness: 'INPUT_READY',
    implementationReady: 'REJECT',
    rejectionReason: 'No repository source defines a narrower Career-specific transit dependency.',
  },
  {
    candidateRuleId: 'career-layer10-event-timing-context-existing-v1',
    source: 'Layer10-refined-event-Layer12C-structural-link',
    provenance: 'ENGINE_CONVENTION',
    transitPlanets: { scope: 'EXPLICIT', values: 'ALL_SUPPORTED_GRAHAS' },
    natalTargets: { scope: 'EXPLICIT', values: 'ALL_EXISTING_CAREER_RELATIONS' },
    relationTypes: { scope: 'EXPLICIT', values: ['TEMPORALLY_ACTIVATES'] },
    eventTypes: { scope: 'EXPLICIT', values: 'ALL_LAYER10_EVENTS_EXCEPT_SADE_SATI' },
    prerequisites: ['supplied Layer 10 activation', 'event type is not Sade Sati'],
    exactPredicate: 'Existing engine convention accepts any non-Sade-Sati Layer 10 Career activation.',
    claimedDomainMeaning: 'Timing context only; no Career outcome.',
    temporalSemantics: 'POINT_EVENT',
    outcomeSemantics: 'UNSAFE_TO_PRODUCTIZE',
    inputReadiness: 'INPUT_READY',
    implementationReady: 'NEEDS_MORE_SOURCE_RESEARCH',
    rejectionReason: 'Dependencies are universal and engine-conventional, so they cannot provide a materially filtered future Career projection.',
  },
]);

function artifact() {
  return {
    auditVersion: 'career-gochar-source-audit-v1',
    repositoryOnly: true,
    sourceInventory: SOURCE_INVENTORY,
    existingCareerProvenance: EXISTING_CAREER_PROVENANCE,
    candidates: CANDIDATES,
    readyForRulebook: [],
    needsMoreSourceResearch: CANDIDATES.filter((candidate) => candidate.implementationReady === 'NEEDS_MORE_SOURCE_RESEARCH').map((candidate) => candidate.candidateRuleId),
    rejected: CANDIDATES.filter((candidate) => candidate.implementationReady === 'REJECT').map((candidate) => candidate.candidateRuleId),
    dashaTransitCombinedRules: [],
    projectionFilteringValue: {
      safeCandidateCount: 0,
      rationale: 'No source-backed narrow Career Gochar rule specifies a smaller transit-planet, target, and relation set than the generic current engine.',
    },
    decision: 'NOT_READY',
    rationale: 'Repository sources provide Gochar mechanics and neutral current context, but no source-backed Career transit predicate with explicit admissible planet, target, and sustained relation dependencies.',
  };
}

function run({ outputPath = path.join(process.cwd(), 'tmp', 'career-gochar-rule-audit.json') } = {}) {
  const result = artifact();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  return { outputPath, result };
}

if (require.main === module) console.log(JSON.stringify(run(), null, 2));
module.exports = { SOURCE_INVENTORY, EXISTING_CAREER_PROVENANCE, CANDIDATES, artifact, run };
