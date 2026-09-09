'use strict';
const { freeze } = require('../../synthesis/evidence-node');
const COPY = freeze({ CAREER_FOUNDATION: 'Existing Career-model evidence describes the natal professional-activity context.', ACTIVE_CAREER_DASHA: 'Your current Vimshottari period activates career-related evidence in the existing Career model.', CURRENT_CAREER_TRANSIT: 'Current transit evidence is structurally connected with the existing Career context.', CONCURRENT_CAREER_TIMING: 'Career-related Dasha and transit evidence are active at the same time.', HISTORICAL_CALIBRATION_RECURRENCE: 'Similar deterministic timing patterns were found across multiple saved career events.', FUTURE_RECURRENCE_WINDOW: 'A future window matches deterministic patterns selected from saved career events.', AUDITED_CLASSICAL_PREDICATE: 'The supplied evidence satisfies the existing audited classical predicate; this does not establish an outcome.' });
function sentenceFor(insight) {
  const hasD10 = (insight.evidenceTrace && insight.evidenceTrace.signals || [])
    .flatMap((signal) => signal.evidence || [])
    .some((evidence) => evidence.chart === 'D10');
  const hasAshtakavarga = (insight.evidenceTrace && insight.evidenceTrace.signals || [])
    .flatMap((signal) => signal.evidence || [])
    .some((evidence) => (evidence.technicalContext || []).some((context) => context.sourceFamily === 'ASHTAKAVARGA'));
  if (insight.family === 'CAREER_FOUNDATION' && hasD10 && hasAshtakavarga) {
    return 'Your D10 career chart and Ashtakavarga provide additional structural context for the natal career pattern.';
  }
  if (insight.family === 'CAREER_FOUNDATION' && hasAshtakavarga) {
    return 'Ashtakavarga provides additional natal support context for the career houses used in this insight.';
  }
  if (insight.family === 'CAREER_FOUNDATION' && hasD10) {
    return 'Your D10 career chart adds supporting structural evidence to the natal career pattern.';
  }
  const timing = insight.timing || {};
  if (insight.family === 'CONCURRENT_CAREER_TIMING') {
    if (timing.timingWindow) return 'Career-related Dasha and transit evidence overlap during this period.';
    if (timing.lineageClassification === 'INDEPENDENT') return 'This timing signal is supported by two independent mechanisms.';
    if (timing.lineageClassification === 'PARTIALLY_OVERLAPPING') return 'Career-related Dasha and transit evidence are active with partially overlapping lineage.';
  }
  if (insight.family === 'ACTIVE_CAREER_DASHA' && Array.isArray(timing.dashaPeriods) && timing.dashaPeriods.length) {
    const levels = timing.dashaPeriods.map((period) => period.periodLevel).filter(Boolean);
    if (levels.length) return `Career-related evidence is active across the current ${levels.map((level) => level === 'MAHADASHA' ? 'Mahadasha' : level === 'ANTARDASHA' ? 'Antardasha' : 'Pratyantar Dasha').join(' and ')}.`;
  }
  if (insight.family === 'CURRENT_CAREER_TRANSIT' && Array.isArray(timing.transitContexts) && timing.transitContexts.length) {
    const transit = timing.transitContexts[0];
    if (transit.kind === 'TRANSIT_EVENT' && transit.eventType) return 'A supplied transit event is structurally connected with the existing Career context.';
  }
  return COPY[insight.family];
}
function renderCareerInsights({ insights = [] } = {}) { return freeze(insights.map((insight) => freeze({ insightId: insight.insightId, family: insight.family, status: insight.status, titleKey: insight.titleKey, summaryKey: insight.summaryKey, sentence: sentenceFor(insight), evidenceTrace: insight.evidenceTrace, caveats: insight.caveats }))); }
module.exports = { renderCareerInsights };
