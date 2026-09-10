'use strict';

const { immutableCopy } = require('../../persistence/contracts');

const STATUSES = new Set(['SUPPORTED', 'MIXED', 'CONTRADICTED', 'INSUFFICIENT_EVIDENCE']);
const TRANSITION_TYPES = new Set(['INGRESS', 'STATION_RETROGRADE', 'STATION_DIRECT', 'DRISHTI_CHANGE', 'ASSOCIATION_CHANGE', 'SADE_SATI_PHASE_CHANGE']);
const SPECIAL_TYPES = new Set(['RETROGRADE', 'SADE_SATI']);

function pairedCopy(value) {
  if (!value || typeof value.english !== 'string' || typeof value.hinglish !== 'string') throw new TypeError('Transit insight presentation requires paired copy.');
  return { english: value.english, hinglish: value.hinglish };
}
function career(item) {
  if (!item || typeof item.planet !== 'string' || !STATUSES.has(item.status)) throw new TypeError('Transit Career relevance is invalid.');
  const presentation = pairedCopy(item.presentation);
  return { planet: item.planet, status: item.status, summary: presentation.english, presentation, ...(item.timing ? { timing: item.timing } : {}) };
}
function special(item) {
  if (!item || !SPECIAL_TYPES.has(item.type) || typeof item.planet !== 'string' || typeof item.status !== 'string') throw new TypeError('Transit special state is invalid.');
  const presentation = pairedCopy(item.presentation);
  return { type: item.type, planet: item.planet, status: item.status, summary: presentation.english, presentation, ...(item.phase ? { phase: item.phase } : {}) };
}
function transition(item) {
  if (!item || !TRANSITION_TYPES.has(item.type) || typeof item.planet !== 'string' || typeof item.at !== 'string') throw new TypeError('Transit transition is invalid.');
  const optional = ['fromSign', 'toSign', 'motionBefore', 'motionAfter', 'targetPlanet', 'house', 'change'];
  return { type: item.type, planet: item.planet, at: item.at, ...Object.fromEntries(optional.filter((key) => item[key] !== undefined && item[key] !== null).map((key) => [key, item[key]])) };
}
function createTransitInsightContext({ activatedHouses = [], careerRelevance = [], specialStates = [], upcomingTransitions = [], horizon = null } = {}) {
  if (!Array.isArray(activatedHouses) || !activatedHouses.every((item) => item && Number.isInteger(item.house) && Array.isArray(item.planets) && item.planets.every((planet) => typeof planet === 'string'))) throw new TypeError('Transit activated houses are invalid.');
  if (!Array.isArray(careerRelevance) || !Array.isArray(specialStates) || !Array.isArray(upcomingTransitions)) throw new TypeError('Transit insight arrays are required.');
  if (horizon !== null && (!horizon || typeof horizon.from !== 'string' || typeof horizon.to !== 'string')) throw new TypeError('Transit insight horizon is invalid.');
  return immutableCopy({ activatedHouses, careerRelevance: careerRelevance.map(career), specialStates: specialStates.map(special), upcomingTransitions: upcomingTransitions.map(transition), ...(horizon ? { horizon: { from: horizon.from, to: horizon.to } } : {}) });
}

module.exports = { createTransitInsightContext, STATUSES };
