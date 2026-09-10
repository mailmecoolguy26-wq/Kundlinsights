'use strict';

const { immutableCopy } = require('../../persistence/contracts');
const STATUSES = new Set(['SUPPORTED', 'MIXED', 'CONTRADICTED', 'INSUFFICIENT_EVIDENCE']);
const LEVELS = new Set(['MAHADASHA', 'ANTARDASHA', 'PRATYANTAR']);

function period(value) {
  if (!value || typeof value.lord !== 'string' || typeof value.start !== 'string' || typeof value.end !== 'string') throw new TypeError('Dasha Insight periods must be complete factual periods.');
  return { lord: value.lord, start: value.start, end: value.end, isCurrent: true };
}
function presentation(value) {
  if (!value || typeof value.english !== 'string' || typeof value.hinglish !== 'string') throw new TypeError('Dasha Insight presentation requires paired copy.');
  return { english: value.english, hinglish: value.hinglish };
}
function currentPhase(value) {
  if (value === null) return null;
  if (!value || !STATUSES.has(value.status) || !LEVELS.has(value.timingLevel) || typeof value.lord !== 'string') throw new TypeError('Dasha current phase is invalid.');
  const copy = presentation(value.presentation);
  return { status: value.status, summary: copy.english, timingLevel: value.timingLevel, lord: value.lord, presentation: copy };
}
function careerRelevance(value) {
  if (value === null) return null;
  if (!value || typeof value.active !== 'boolean' || !STATUSES.has(value.status)) throw new TypeError('Dasha Career relevance is invalid.');
  const copy = presentation(value.presentation);
  return { active: value.active, status: value.status, summary: copy.english, presentation: copy };
}
function nextTransition(value) {
  if (value === null) return null;
  if (!value || !LEVELS.has(value.level) || typeof value.lord !== 'string' || typeof value.starts !== 'string') throw new TypeError('Dasha next transition is invalid.');
  return { level: value.level, lord: value.lord, starts: value.starts };
}
function classicalContext(value) {
  if (value === null) return null;
  if (!value || typeof value.active !== 'boolean' || !STATUSES.has(value.status)) throw new TypeError('Dasha classical context is invalid.');
  const copy = presentation(value.presentation); const cautionCopy = presentation(value.caution);
  return { active: value.active, status: value.status, summary: copy.english, presentation: copy, caution: cautionCopy.english, cautionPresentation: cautionCopy };
}
function createDashaInsightContext({ currentPeriods, currentPhase: phase = null, careerRelevance: relevance = null, nextTransition: next = null, classicalContext: classical = null } = {}) {
  if (!currentPeriods || !currentPeriods.mahadasha || !currentPeriods.antardasha || !currentPeriods.pratyantardasha) throw new TypeError('Dasha Insight context requires current MD, AD, and PD.');
  return immutableCopy({ currentPeriods: { mahadasha: period(currentPeriods.mahadasha), antardasha: period(currentPeriods.antardasha), pratyantardasha: period(currentPeriods.pratyantardasha) }, currentPhase: currentPhase(phase), careerRelevance: careerRelevance(relevance), nextTransition: nextTransition(next), classicalContext: classicalContext(classical) });
}
module.exports = { createDashaInsightContext, STATUSES, LEVELS };
