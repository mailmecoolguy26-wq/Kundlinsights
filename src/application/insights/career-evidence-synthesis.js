'use strict';

const { freeze } = require('../../synthesis/evidence-node');

// This is deliberately a presentation packet, not an astrology rule engine.
// It may only surface the availability/status of already-built Career insights.
const TIMING_FAMILIES = new Set([
  'ACTIVE_CAREER_DASHA',
  'CURRENT_CAREER_TRANSIT',
  'CONCURRENT_CAREER_TIMING',
]);
const LIMITING_STATUSES = new Set(['MIXED', 'INSUFFICIENT_EVIDENCE', 'CONTRADICTED']);

function supported(insights, family) {
  return Array.isArray(insights) && insights.some((item) => item && item.family === family && item.status === 'SUPPORTED');
}

function hasLimitingTiming(insights) {
  return Array.isArray(insights) && insights.some((item) => item && TIMING_FAMILIES.has(item.family) && LIMITING_STATUSES.has(item.status));
}

function validCorroboration(value) {
  const h10 = value && value.h10;
  return value && value.kind === 'H10_NATAL_CONTEXT' && value.chart === 'D1' &&
    value.corroborates === 'CAREER_FOUNDATION' &&
    value.limitation === 'NOT_STANDALONE_PREDICTION' &&
    h10 && h10.house === 10 && Number.isInteger(h10.sav) && h10.sav >= 0
    ? { h10: { house: 10, sav: h10.sav } }
    : null;
}

function validCalibration(value) {
  if (!value || !['NONE', 'LIMITED', 'CALIBRATED'].includes(value.calibrationLevel)) return null;
  return {
    calibrationLevel: value.calibrationLevel,
    ...(Number.isInteger(value.eventCount) && value.eventCount >= 0 ? { eventCount: value.eventCount } : {}),
  };
}

function buildCareerEvidenceSynthesis({ insights = [], careerAshtakavargaCorroboration = null, calibrationSummary = null } = {}) {
  // SAV never originates synthesis: the independently supported foundation is required.
  if (!supported(insights, 'CAREER_FOUNDATION')) return null;
  const corroboration = validCorroboration(careerAshtakavargaCorroboration);
  const calibration = validCalibration(calibrationSummary);
  const timing = {
    activeDasha: supported(insights, 'ACTIVE_CAREER_DASHA'),
    currentTransit: supported(insights, 'CURRENT_CAREER_TRANSIT'),
    concurrent: supported(insights, 'CONCURRENT_CAREER_TIMING'),
    limited: hasLimitingTiming(insights),
  };
  const output = {
    foundation: { family: 'CAREER_FOUNDATION' },
    timing,
    ...(corroboration ? { corroboration } : {}),
    ...(calibration ? { calibration } : {}),
    ...(supported(insights, 'FUTURE_RECURRENCE_WINDOW') ? { futureRecurrence: { family: 'FUTURE_RECURRENCE_WINDOW' } } : {}),
  };
  return freeze(output);
}

module.exports = { buildCareerEvidenceSynthesis };
