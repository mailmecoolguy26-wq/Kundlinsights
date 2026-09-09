'use strict';
const { freeze } = require('../../synthesis/evidence-node');
const COPY = freeze({ CAREER_FOUNDATION: 'Your natal Career structure is centered on the 10th-house factors identified in your chart.', ACTIVE_CAREER_DASHA: 'Your current Dasha timing connects to Career-related factors in the natal chart.', CURRENT_CAREER_TRANSIT: 'A current transit is activating a Career-related natal factor used by this reading.', CONCURRENT_CAREER_TIMING: 'Career-related Dasha and transit evidence currently overlap.', HISTORICAL_CALIBRATION_RECURRENCE: 'Similar timing appeared across your saved Career events.', FUTURE_RECURRENCE_WINDOW: 'An upcoming period matches a timing pattern seen in your saved Career history.', AUDITED_CLASSICAL_PREDICATE: 'An audited classical Career rule is active in the current period. This is not a guaranteed Career outcome.' });
function sentenceFor(insight) {
  if (insight.status === 'MIXED') return 'The timing evidence is mixed; some indicators are active while other evidence does not fully align.';
  if (insight.status === 'CONTRADICTED') return 'Current evidence does not consistently support this signal.';
  if (insight.status === 'INSUFFICIENT_EVIDENCE') return 'There is not enough deterministic evidence to make this a primary Career insight.';
  const hasD10 = (insight.evidenceTrace && insight.evidenceTrace.signals || [])
    .flatMap((signal) => signal.evidence || [])
    .some((evidence) => evidence.chart === 'D10');
  const hasAshtakavarga = (insight.evidenceTrace && insight.evidenceTrace.signals || [])
    .flatMap((signal) => signal.evidence || [])
    .some((evidence) => (evidence.technicalContext || []).some((context) => context.sourceFamily === 'ASHTAKAVARGA'));
  if (insight.family === 'CAREER_FOUNDATION' && hasD10 && hasAshtakavarga) {
    return 'Your D10 Career Chart and Ashtakavarga provide additional structural context for the natal pattern.';
  }
  if (insight.family === 'CAREER_FOUNDATION' && hasAshtakavarga) {
    return 'Ashtakavarga is included as factual supporting context for the Career houses used here.';
  }
  if (insight.family === 'CAREER_FOUNDATION' && hasD10) {
    return 'Your D10 career chart adds supporting structural evidence to the natal career pattern.';
  }
  const timing = insight.timing || {};
  if (insight.family === 'CONCURRENT_CAREER_TIMING') {
    if (timing.timingWindow) return 'Career-related Dasha and transit evidence overlap during this period.';
    if (timing.lineageClassification === 'INDEPENDENT') return 'Two separate timing mechanisms are active at the same time.';
    if (timing.lineageClassification === 'PARTIALLY_OVERLAPPING') return 'Two timing mechanisms point to the same Career area, though some evidence overlaps.';
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
module.exports = { renderCareerInsights, sentenceFor };
