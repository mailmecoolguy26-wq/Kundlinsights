'use strict';

const { freeze } = require('../../synthesis/evidence-node');

const CAREER_INSIGHT_ENGINE_RULESET_ID = 'kundlinsights-career-insight-engine-v1';
const CAREER_INSIGHT_ENGINE_VERSION = 'v1';
const CAREER_INSIGHT_FAMILIES = freeze([
  'CAREER_FOUNDATION', 'ACTIVE_CAREER_DASHA', 'CURRENT_CAREER_TRANSIT',
  'CONCURRENT_CAREER_TIMING', 'HISTORICAL_CALIBRATION_RECURRENCE',
  'FUTURE_RECURRENCE_WINDOW', 'AUDITED_CLASSICAL_PREDICATE',
]);
const FAMILY_METADATA = freeze({
  CAREER_FOUNDATION: { titleKey: 'career.foundation.title', summaryKey: 'career.foundation.summary', conclusionTopics: ['CAREER_H10_SIGNIFICATION_SCOPE_PRESENT', 'CAREER_H10_LORD_NATAL_CONNECTION_PRESENT', 'CAREER_H10_OCCUPANT_CONNECTION_PRESENT'] },
  ACTIVE_CAREER_DASHA: { titleKey: 'career.dasha.active.title', summaryKey: 'career.dasha.active.summary', conclusionTopics: ['CAREER_H10_CONNECTED_DASHA_ACTIVATION_PRESENT'] },
  CURRENT_CAREER_TRANSIT: { titleKey: 'career.transit.current.title', summaryKey: 'career.transit.current.summary', conclusionTopics: ['CAREER_GOCHAR_CONNECTION_PRESENT', 'CAREER_TIMING_TRIGGER_CONTEXT_PRESENT'] },
  CONCURRENT_CAREER_TIMING: { titleKey: 'career.timing.concurrent.title', summaryKey: 'career.timing.concurrent.summary', conclusionTopics: ['CAREER_TEMPORAL_COACTIVATION_PRESENT'] },
  HISTORICAL_CALIBRATION_RECURRENCE: { titleKey: 'career.calibration.recurrence.title', summaryKey: 'career.calibration.recurrence.summary', conclusionTopics: [] },
  FUTURE_RECURRENCE_WINDOW: { titleKey: 'career.recurrence.future.title', summaryKey: 'career.recurrence.future.summary', conclusionTopics: [] },
  AUDITED_CLASSICAL_PREDICATE: { titleKey: 'career.classical.predicate.title', summaryKey: 'career.classical.predicate.summary', conclusionTopics: ['CAREER_CLASSICAL_PROFESSIONAL_LOSS_PREDICATE_PRESENT'] },
});

module.exports = { CAREER_INSIGHT_ENGINE_RULESET_ID, CAREER_INSIGHT_ENGINE_VERSION, CAREER_INSIGHT_FAMILIES, FAMILY_METADATA };
