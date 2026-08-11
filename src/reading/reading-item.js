'use strict';

const { hash, freeze } = require('../synthesis/evidence-node');
const { createRendererInput } = require('../interpretation/renderer-contract');
const { CONCLUSION_STATUSES, RULE_CLASSIFICATIONS } = require('../interpretation/reference-data');
const { READING_RULESET_ID, DISCLOSURE_CODES, TOPIC_SECTIONS } = require('./reference-data');

function copy(value) { return value === undefined ? null : JSON.parse(JSON.stringify(value)); }
function disclosures(conclusion, section) {
  const values = ['NO_PROBABILITY_ASSESSMENT', 'NO_OUTCOME_GUARANTEE'];
  if (section === 'CAREER_STRUCTURE') values.push('STRUCTURAL_CONTEXT_ONLY');
  if (['CURRENT_DASHA_CONTEXT', 'GOCHAR_CONTEXT', 'TEMPORAL_COACTIVATION'].includes(section)) values.push('TEMPORAL_CONTEXT_ONLY');
  if (conclusion.topic === 'CAREER_CLASSICAL_PROFESSIONAL_LOSS_PREDICATE_PRESENT') values.push('CLASSICAL_PREDICATE_NOT_EVENT_CERTAINTY');
  if (conclusion.conclusionStatus === 'CONTRADICTED') values.push('CONTRADICTION_PRESENT');
  if (conclusion.conclusionStatus === 'INSUFFICIENT_EVIDENCE' || conclusion.missingData.length) values.push('MISSING_DATA_NEUTRAL');
  return values.sort().map((code) => { if (!DISCLOSURE_CODES.includes(code)) throw new RangeError(`Unsupported disclosure code: ${code}`); return code; });
}
function temporalIdentity(context) {
  const intervals = context && context.dashaIntervals || [];
  return intervals[0] && ((intervals[0].startInstant && (intervals[0].startInstant.utc || intervals[0].startInstant)) || '') || context && context.gocharSnapshotInstant || context && context.transitEventIds && context.transitEventIds[0] || '';
}
function createReadingItem(conclusion) {
  if (!conclusion || conclusion.domain !== 'CAREER' || typeof conclusion.conclusionId !== 'string' || !CONCLUSION_STATUSES.includes(conclusion.conclusionStatus) || !RULE_CLASSIFICATIONS.includes(conclusion.ruleClassification) || !Array.isArray(conclusion.evidenceIds) || !Array.isArray(conclusion.missingData) || !Array.isArray(conclusion.contradictions)) throw new TypeError('A valid Layer 13 CAREER conclusion is required.');
  const section = TOPIC_SECTIONS[conclusion.topic];
  if (!section) throw new RangeError(`Unsupported Career reading topic: ${conclusion.topic}`);
  const renderer = createRendererInput(conclusion);
  const templateKey = conclusion.topic;
  const identity = { rulesetId: READING_RULESET_ID, domain: conclusion.domain, section, conclusionId: conclusion.conclusionId, templateKey };
  const context = copy(renderer.temporalContext || { dashaIntervals: [], gocharSnapshotInstant: null, transitEventIds: [] });
  return freeze({
    readingItemId: `reading-item:${hash(identity)}`,
    domain: 'CAREER', section, topic: conclusion.topic, status: conclusion.conclusionStatus, templateKey,
    subject: context && context.careerSubject ? copy(context.careerSubject) : null,
    temporalContext: context,
    sourceRuleRefs: { ruleId: conclusion.interpretiveRuleId, rulesetId: conclusion.rulesetId, classification: conclusion.ruleClassification, sourceRefs: copy(conclusion.provenance && conclusion.provenance.sourceRefs || []) },
    sourceEvidenceRefs: { evidenceIds: [...new Set(conclusion.evidenceIds)].sort(), rootSourceIds: [...new Set(conclusion.rootSourceIds || [])].sort(), evidenceFamilyIds: [...new Set(conclusion.evidenceFamilyIds || [])].sort(), sourceStrengths: [...new Set(conclusion.sourceStrengths || [])].sort() },
    contradictionRefs: [...new Set(conclusion.contradictions)].sort(), missingDataRefs: [...new Set(conclusion.missingData)].sort(),
    disclosures: disclosures(conclusion, section),
    provenance: { readingRulesetId: READING_RULESET_ID, conclusionId: conclusion.conclusionId, rendererContract: 'Layer13-createRendererInput-composed', conclusionProvenance: { analysisId: conclusion.provenance && conclusion.provenance.analysisId || null, sourcePredicateId: conclusion.provenance && conclusion.provenance.sourcePredicateId || null }, astronomyCalculation: 'not-performed', providerDataExposure: 'none', proseGeneration: 'not-performed', llmGeneration: 'not-performed' }
  });
}

module.exports = { createReadingItem, temporalIdentity };
