'use strict';

const { immutableCopy } = require('../../persistence/contracts');
const STATUSES = new Set(['CURRENT', 'UPCOMING', 'PAST']);
const ROLES = new Set(['MAHADASHA', 'ANTARDASHA', 'PRATYANTAR']);

function requiredPeriod(value, includeStatus = false) {
  if (!value || typeof value.lord !== 'string' || typeof value.start !== 'string' || typeof value.end !== 'string') throw new TypeError('Dasha period insight requires complete canonical periods.');
  if (includeStatus && !STATUSES.has(value.status)) throw new TypeError('Dasha period insight has invalid status.');
  return includeStatus ? { lord: value.lord, start: value.start, end: value.end, status: value.status } : { lord: value.lord, start: value.start, end: value.end };
}
function copy(value) {
  if (!value || typeof value.english !== 'string' || typeof value.hinglish !== 'string') throw new TypeError('Dasha period insight requires safe paired presentation copy.');
  return { english: value.english, hinglish: value.hinglish };
}
function optionalArray(value, mapper) { return Array.isArray(value) ? value.map(mapper).filter(Boolean) : []; }
function natal(value) { return value && ROLES.has(value.role) && typeof value.planet === 'string' && typeof value.sign === 'string' && Number.isInteger(value.house) && Array.isArray(value.ownsHouses) ? { planet: value.planet, role: value.role, sign: value.sign, house: value.house, ownsHouses: value.ownsHouses.filter(Number.isInteger) } : null; }
function state(value) { return value && ROLES.has(value.role) && typeof value.planet === 'string' && Array.isArray(value.states) ? { planet: value.planet, role: value.role, states: value.states.filter((state) => typeof state === 'string') } : null; }
function relationship(value) { return value && typeof value.from === 'string' && typeof value.to === 'string' && typeof value.relationship === 'string' ? { from: value.from, to: value.to, relationship: value.relationship } : null; }
function d10(value) { return value && ROLES.has(value.role) && typeof value.planet === 'string' && typeof value.sign === 'string' && Number.isInteger(value.house) ? { planet: value.planet, role: value.role, sign: value.sign, house: value.house } : null; }
function optionalContext(value) { return value && typeof value.status === 'string' && value.presentation ? { status: value.status, presentation: copy(value.presentation) } : null; }

function createDashaPeriodInsight({ hierarchy, periodContext, natalFacts = [], stateFacts = [], relationshipFacts = [], d10Facts = [], careerRelevance = null, calibrationContext = null, classicalContext = null, nextPeriod = null } = {}) {
  if (!hierarchy || !periodContext || !STATUSES.has(periodContext.status)) throw new TypeError('Dasha period insight requires a canonical hierarchy and status.');
  const result = {
    hierarchy: {
      mahadasha: requiredPeriod(hierarchy.mahadasha),
      antardasha: requiredPeriod(hierarchy.antardasha),
      pratyantar: requiredPeriod(hierarchy.pratyantar, true),
    },
    periodContext: { status: periodContext.status, summary: copy(periodContext.presentation).english, presentation: copy(periodContext.presentation) },
    natalFacts: optionalArray(natalFacts, natal),
    stateFacts: optionalArray(stateFacts, state),
    relationshipFacts: optionalArray(relationshipFacts, relationship),
    d10Facts: optionalArray(d10Facts, d10),
    careerRelevance: optionalContext(careerRelevance),
    calibrationContext: optionalContext(calibrationContext),
    classicalContext: optionalContext(classicalContext),
    nextPeriod: nextPeriod === null ? null : requiredPeriod(nextPeriod),
  };
  return immutableCopy(result);
}

module.exports = { createDashaPeriodInsight, STATUSES, ROLES };
