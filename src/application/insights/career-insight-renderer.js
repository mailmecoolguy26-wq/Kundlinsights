'use strict';
const { freeze } = require('../../synthesis/evidence-node');
const COPY = freeze({ CAREER_FOUNDATION: 'Existing Career-model evidence describes the natal professional-activity context.', ACTIVE_CAREER_DASHA: 'Your current Vimshottari period activates career-related evidence in the existing Career model.', CURRENT_CAREER_TRANSIT: 'Current transit evidence is structurally connected with the existing Career context.', CONCURRENT_CAREER_TIMING: 'Career-related Dasha and transit evidence are active at the same time.', HISTORICAL_CALIBRATION_RECURRENCE: 'Similar deterministic timing patterns were found across multiple saved career events.', FUTURE_RECURRENCE_WINDOW: 'A future window matches deterministic patterns selected from saved career events.', AUDITED_CLASSICAL_PREDICATE: 'The supplied evidence satisfies the existing audited classical predicate; this does not establish an outcome.' });
function sentenceFor(insight) {
  const hasD10 = (insight.evidenceTrace && insight.evidenceTrace.signals || [])
    .flatMap((signal) => signal.evidence || [])
    .some((evidence) => evidence.chart === 'D10');
  if (insight.family === 'CAREER_FOUNDATION' && hasD10) {
    return 'Your D10 career chart adds supporting structural evidence to the natal career pattern.';
  }
  return COPY[insight.family];
}
function renderCareerInsights({ insights = [] } = {}) { return freeze(insights.map((insight) => freeze({ insightId: insight.insightId, family: insight.family, status: insight.status, titleKey: insight.titleKey, summaryKey: insight.summaryKey, sentence: sentenceFor(insight), evidenceTrace: insight.evidenceTrace, caveats: insight.caveats }))); }
module.exports = { renderCareerInsights };
