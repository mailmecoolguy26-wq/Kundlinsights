'use strict';

// Private Phase 2I input validation only. The caller owns file access and must
// keep actual cohort JSON under tmp/private-backtest/ or another non-versioned
// location. This module never logs or persists private birth/event data.
const { freeze } = require('../../synthesis/evidence-node');

const OWNER_COHORT_SCHEMA_ID = 'taraverse-private-owner-career-cohort-v1';
const PRECISIONS = Object.freeze(['DAY', 'MONTH', 'APPROXIMATE']);
const DATE_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MONTH = /^\d{4}-\d{2}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
function fail(message) { throw new TypeError(`Invalid private Career cohort: ${message}`); }
function text(value, label) { if (typeof value !== 'string' || !value.trim()) fail(label); return value; }
function date(value, precision) {
  if (precision === 'DAY' && DATE_DAY.test(value)) { const [year, month, day] = value.split('-').map(Number); return freeze({ precision, year, month, day }); }
  if (precision === 'MONTH' && DATE_MONTH.test(value)) { const [year, month] = value.split('-').map(Number); return freeze({ precision, year, month, day: null }); }
  fail('date');
}
function normalizeObservation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !PRECISIONS.includes(value.precision)) fail('observation');
  const type = text(value.type, 'observation.type');
  if (value.precision === 'APPROXIMATE') {
    if (!ISO.test(value.from) || !ISO.test(value.to) || Date.parse(value.from) >= Date.parse(value.to)) fail('approximate observation range');
    return freeze({ type, date: freeze({ precision: 'APPROXIMATE', year: null, month: null, day: null }), temporalCoverage: freeze({ start: value.from, end: value.to }) });
  }
  const parsed = date(value.date, value.precision);
  return freeze({ type, date: parsed, temporalCoverage: null });
}
function normalizePrivateOwnerCohort(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaId !== OWNER_COHORT_SCHEMA_ID) fail('schemaId');
  const profile = value.profile;
  if (!profile || typeof profile !== 'object') fail('profile');
  // birthData is deliberately opaque to this validator; the local reconstructor
  // passes it to the existing deterministic astronomy engine only.
  if (!profile.birthData || typeof profile.birthData !== 'object') fail('profile.birthData');
  if (!Array.isArray(value.transitions) || value.transitions.length === 0) fail('transitions');
  const transitions = value.transitions.map((transition) => {
    if (!transition || typeof transition !== 'object' || !Array.isArray(transition.observations) || !transition.observations.length) fail('transition');
    return freeze({ id: text(transition.id, 'transition.id'), type: text(transition.type, 'transition.type'), observations: freeze(transition.observations.map(normalizeObservation)) });
  });
  return freeze({ schemaId: OWNER_COHORT_SCHEMA_ID, profile: freeze({ birthProfileId: text(profile.birthProfileId, 'profile.birthProfileId'), birthData: profile.birthData }), transitions: freeze(transitions) });
}
module.exports = { OWNER_COHORT_SCHEMA_ID, PRECISIONS, normalizePrivateOwnerCohort };
