'use strict';

const { hash, freeze, assertNoForbidden } = require('../../synthesis/evidence-node');
const { CONCLUSION_STATUSES } = require('../../interpretation/reference-data');
const { CAREER_INSIGHT_FAMILIES, CAREER_INSIGHT_ENGINE_RULESET_ID } = require('./career-insight-rulebook');

function required(value, name) { if (typeof value !== 'string' || !value) throw new TypeError(`${name} is required.`); return value; }
function array(value, name) { if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item)) throw new TypeError(`${name} must be a string array.`); return [...new Set(value)].sort(); }
function family(value) { if (!CAREER_INSIGHT_FAMILIES.includes(value)) throw new RangeError('Unsupported Career Insight family.'); return value; }
function status(value) { if (!CONCLUSION_STATUSES.includes(value)) throw new RangeError('Unsupported deterministic Insight status.'); return value; }
function copy(value) { return value === undefined ? null : JSON.parse(JSON.stringify(value)); }
function guard(value) { assertNoForbidden(value); return value; }
function evidence(input = {}) {
  guard(input); const out = { evidenceId: required(input.evidenceId, 'evidenceId'), domain: required(input.domain, 'domain'), family: family(input.family), sourceLayer: required(input.sourceLayer, 'sourceLayer'), sourceRulesetId: required(input.sourceRulesetId, 'sourceRulesetId'), sourceStrength: input.sourceStrength || null, subject: copy(input.subject), target: copy(input.target), chart: input.chart || null, temporalContext: copy(input.temporalContext || {}), rawFacts: copy(input.rawFacts), rootSourceIds: array(input.rootSourceIds || [], 'rootSourceIds'), evidenceFamilyIds: array(input.evidenceFamilyIds || [], 'evidenceFamilyIds'), lineage: copy(input.lineage || {}), status: status(input.status), explanationKey: required(input.explanationKey, 'explanationKey'), provenance: copy(input.provenance || {}) };
  if (out.domain !== 'CAREER') throw new RangeError('Insight evidence domain must be CAREER.'); return freeze(out);
}
function signal(input = {}) {
  guard(input); const out = { signalId: required(input.signalId, 'signalId'), domain: required(input.domain, 'domain'), family: family(input.family), ruleId: required(input.ruleId, 'ruleId'), status: status(input.status), supportiveEvidenceIds: array(input.supportiveEvidenceIds || [], 'supportiveEvidenceIds'), limitingEvidenceIds: array(input.limitingEvidenceIds || [], 'limitingEvidenceIds'), contradictoryEvidenceIds: array(input.contradictoryEvidenceIds || [], 'contradictoryEvidenceIds'), independentMechanismFamilies: array(input.independentMechanismFamilies || [], 'independentMechanismFamilies'), temporalContext: copy(input.temporalContext || {}), calibrationSupport: copy(input.calibrationSupport || null), explanationKey: required(input.explanationKey, 'explanationKey'), provenance: copy(input.provenance || {}) };
  if (out.domain !== 'CAREER') throw new RangeError('Insight signal domain must be CAREER.'); return freeze(out);
}
function insight(input = {}) {
  guard(input); if (!Number.isInteger(input.displayPriority) || input.displayPriority < 0) throw new TypeError('displayPriority must be a non-negative ordinal.');
  const out = { insightId: required(input.insightId, 'insightId'), domain: required(input.domain, 'domain'), family: family(input.family), titleKey: required(input.titleKey, 'titleKey'), summaryKey: required(input.summaryKey, 'summaryKey'), displayPriority: input.displayPriority, timing: copy(input.timing || {}), status: status(input.status), signals: array(input.signals || [], 'signals'), evidenceTrace: copy(input.evidenceTrace || {}), caveats: copy(input.caveats || []), calibrationContext: copy(input.calibrationContext || null), technicalDetails: copy(input.technicalDetails || {}), rulesetVersions: copy(input.rulesetVersions || {}) };
  if (out.domain !== 'CAREER') throw new RangeError('Insight domain must be CAREER.'); return freeze(out);
}
function deterministicId(kind, input) { return `${kind}:${hash({ rulesetId: CAREER_INSIGHT_ENGINE_RULESET_ID, ...input })}`; }
module.exports = { createInsightEvidence: evidence, createInsightSignal: signal, createInsight: insight, deterministicInsightId: deterministicId };
