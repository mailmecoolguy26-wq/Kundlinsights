'use strict';

const CAREER_TIMING_NO_INVENTION_RULE = 'Use only the supplied Career timing periods and dates. Do not create or infer additional timing windows.';

function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }
function period(value) { return value && typeof value.start === 'string' && typeof value.end === 'string' ? freeze({ start: value.start, end: value.end, ...(typeof value.classification === 'string' ? { classification: value.classification } : {}), ...(typeof value.label === 'string' ? { label: value.label } : {}) }) : null; }
function safeEvidence(value) {
  if (!value || typeof value !== 'object') return null;
  const allowed = ['primaryDashaConvergence', 'pdRefinement', 'd10Confirmation', 'transitConfirmation', 'pd', 'd10', 'jupiter', 'saturn', 'ashtakavarga'];
  const output = Object.fromEntries(allowed.filter((key) => typeof value[key] === 'string').map((key) => [key, value[key]]));
  return Object.keys(output).length ? freeze(output) : null;
}

function canonicalJobFavourabilityProjection(context) {
  if (!context || context.authority !== 'CANONICAL') throw new TypeError('CANONICAL_CAREER_TIMING_REQUIRED');
  const broadWindow = period(context.currentEligiblePeriod || context.nextEligiblePeriod);
  const strongestWindow = period(context.strongestCurrentRefinement || context.strongestUpcomingRefinement);
  const evidenceSummary = safeEvidence(context.evidenceSummary);
  const reasonCodes = [
    broadWindow ? 'CAREER_TIMING_ACTIVATED' : null,
    evidenceSummary && (evidenceSummary.jupiter === 'CONFIRMS' || evidenceSummary.saturn === 'CONFIRMS') ? 'MAJOR_CAREER_TRANSITS_ACTIVE' : null,
    evidenceSummary && evidenceSummary.d10 && evidenceSummary.d10 !== 'UNAVAILABLE' ? 'SUPPORTING_CHART_FACTORS_ALIGN' : null,
  ].filter(Boolean);
  return freeze({
    broadWindow,
    strongestWindow,
    strength: strongestWindow ? 'STRONGER' : broadWindow ? 'MODERATE' : null,
    evidenceAgreementCount: reasonCodes.length,
    evidenceReasonCodes: reasonCodes,
    currentPeriod: period(context.currentEligiblePeriod),
    nextPeriod: period(context.nextEligiblePeriod),
    productState: context.productState || null,
    evidenceSummary,
  });
}

function buildTaraCareerTimingContext(answer) {
  if (!answer || typeof answer !== 'object') return null;
  const context = answer.timingContext && typeof answer.timingContext === 'object' ? answer.timingContext : null;
  const broadWindow = period(answer.broadWindow || answer.answer && answer.answer.window);
  if (!context && !broadWindow) return null;
  return freeze({
    timingAuthority: answer.timingAuthority || context && context.authority || 'LEGACY',
    contractVersion: answer.contractVersion || context && context.contractVersion || null,
    timingEngineVersion: answer.timingEngineVersion || context && context.timingEngineVersion || null,
    currentPeriod: period(answer.currentPeriod || context && context.currentEligiblePeriod),
    nextPeriod: period(answer.nextPeriod || context && context.nextEligiblePeriod || !context && broadWindow),
    activeRefinement: period(context && context.activeRefinement),
    nextStrongestWindow: period(answer.strongestWindow || context && (context.strongestCurrentRefinement || context.strongestUpcomingRefinement)),
    productState: answer.productState || context && context.productState || null,
    evidenceSummary: safeEvidence(answer.timingEvidenceSummary || context && context.evidenceSummary),
    timingRule: CAREER_TIMING_NO_INVENTION_RULE,
  });
}

module.exports = { CAREER_TIMING_NO_INVENTION_RULE, canonicalJobFavourabilityProjection, buildTaraCareerTimingContext };
