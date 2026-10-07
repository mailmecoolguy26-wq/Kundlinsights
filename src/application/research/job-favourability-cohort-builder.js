'use strict';

// Offline-only cohort normalization for the Job Favourability research study.
// This module deliberately consumes supplied, owner-authorized historical data;
// it never reads production repositories and never produces a prediction.
const crypto = require('node:crypto');

const POSITIVE_EVENT_TYPES = Object.freeze(['FIRST_JOB', 'JOB_SWITCH']);
const CONTROL_EVENT_TYPES = Object.freeze(['PROMOTION', 'ROLE_CHANGE', 'SALARY_GROWTH', 'BUSINESS_STARTED', 'CAREER_BREAKTHROUGH', 'CAREER_SETBACK']);
const EMPLOYMENT_OBSERVATIONS = new Set(['OFFER', 'JOINING']);
const HORIZON_IDS = Object.freeze(['PRE_30', 'PRE_60', 'PRE_90', 'POST_30', 'SYMMETRIC_30', 'SYMMETRIC_60', 'SYMMETRIC_90']);
const CONTROL_EXCLUSION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }
function iso(value) { return typeof value === 'string' && !Number.isNaN(Date.parse(value)); }
function validCoverage(value) { return value && iso(value.start) && iso(value.end) && Date.parse(value.start) < Date.parse(value.end); }
function addDays(value, days) { return new Date(Date.parse(value) + (days * DAY_MS)).toISOString(); }
function pseudonymizeProfileId(profileId, cohortSalt) {
  if (typeof profileId !== 'string' || !profileId || typeof cohortSalt !== 'string' || !cohortSalt) throw new TypeError('Research cohort requires a profile ID and non-empty private cohort salt.');
  return `p_${crypto.createHash('sha256').update(`${cohortSalt}:${profileId}`).digest('hex').slice(0, 20)}`;
}

function eventObservations(event) {
  const values = Array.isArray(event && event.observations) && event.observations.length ? event.observations : [];
  return values.map((value) => {
    const coverage = value && (value.temporalCoverage || value.coverage);
    const date = value && (value.date || value.eventDate);
    if (!validCoverage(coverage) || !date || !['DAY', 'MONTH', 'YEAR'].includes(date.precision)) return null;
    return freeze({ observationType: typeof value.type === 'string' ? value.type : typeof value.observationType === 'string' ? value.observationType : 'EVENT_DATE', precision: date.precision, coverage: freeze({ start: coverage.start, end: coverage.end }) });
  }).filter(Boolean).sort((left, right) => `${left.coverage.start}|${left.observationType}`.localeCompare(`${right.coverage.start}|${right.observationType}`));
}

function classifyEvent(event, observations) {
  if (CONTROL_EVENT_TYPES.includes(event.eventType)) return 'CAREER_CONTROL';
  if (POSITIVE_EVENT_TYPES.includes(event.eventType) || observations.some((item) => EMPLOYMENT_OBSERVATIONS.has(item.observationType))) return 'EMPLOYMENT_TRANSITION';
  return 'CONTEXT_ONLY';
}

function buildEventUnits({ profileId, pseudonymousProfileId, events = [] } = {}) {
  const units = [];
  for (const event of events) {
    if (!event || typeof event.careerEventId !== 'string') continue;
    const observations = eventObservations(event); if (!observations.length) continue;
    const unitKind = classifyEvent(event, observations); if (unitKind === 'CONTEXT_ONLY') continue;
    const family = unitKind === 'EMPLOYMENT_TRANSITION'
      ? observations.some((item) => EMPLOYMENT_OBSERVATIONS.has(item.observationType)) ? 'OFFER_JOINING' : event.eventType
      : event.eventType;
    // One stored Career event remains one unit even when it contains both OFFER
    // and JOINING. Its anchors are preserved for horizon extraction, while the
    // runner evaluates the unit once.
    units.push(freeze({
      unitId: `event:${event.careerEventId}`,
      sourceEventIds: freeze([event.careerEventId]),
      profileId,
      pseudonymousProfileId,
      unitKind,
      eventFamily: family,
      anchors: freeze(observations),
    }));
  }
  return units.sort((left, right) => `${left.pseudonymousProfileId}|${left.unitId}`.localeCompare(`${right.pseudonymousProfileId}|${right.unitId}`));
}

function overlapsExclusion(instant, observations, days) {
  const point = Date.parse(instant); const radius = days * DAY_MS;
  return observations.some((item) => point >= Date.parse(item.coverage.start) - radius && point <= Date.parse(item.coverage.end) + radius);
}

function buildTemporalControls({ profileId, pseudonymousProfileId, events = [], exclusionDays = CONTROL_EXCLUSION_DAYS } = {}) {
  const observations = events.flatMap(eventObservations).sort((left, right) => left.coverage.start.localeCompare(right.coverage.start));
  const controls = [];
  for (let index = 1; index < observations.length; index += 1) {
    const left = Date.parse(observations[index - 1].coverage.end); const right = Date.parse(observations[index].coverage.start);
    if (right - left < exclusionDays * 2 * DAY_MS) continue;
    const instant = new Date(left + Math.floor((right - left) / 2)).toISOString();
    if (overlapsExclusion(instant, observations, exclusionDays)) continue;
    controls.push(freeze({
      unitId: `temporal:${index}:${instant}`,
      sourceEventIds: freeze([]),
      profileId,
      pseudonymousProfileId,
      unitKind: 'TEMPORAL_CONTROL',
      eventFamily: 'TEMPORAL_NON_EVENT',
      anchors: freeze([freeze({ observationType: 'TEMPORAL_CONTROL', precision: 'DAY', coverage: freeze({ start: instant, end: addDays(instant, 1) }) })]),
    }));
  }
  return controls;
}

function partitionFor(pseudonymousProfileId) {
  const bucket = Number.parseInt(crypto.createHash('sha256').update(pseudonymousProfileId).digest('hex').slice(0, 8), 16) % 10;
  return bucket < 2 ? 'HOLDOUT' : bucket < 4 ? 'VALIDATION' : 'TRAIN';
}

function buildJobFavourabilityCohort({ profiles = [], cohortSalt, horizons = HORIZON_IDS, controlExclusionDays = CONTROL_EXCLUSION_DAYS } = {}) {
  if (!Array.isArray(profiles)) throw new TypeError('Research cohort profiles must be an array.');
  if (!Array.isArray(horizons) || horizons.length !== HORIZON_IDS.length || horizons.some((item) => !HORIZON_IDS.includes(item))) throw new TypeError('Research cohort horizons must use the pre-registered horizon set.');
  const profileRows = profiles.filter((profile) => profile && typeof profile.birthProfileId === 'string').map((profile) => {
    const pseudonymousProfileId = pseudonymizeProfileId(profile.birthProfileId, cohortSalt);
    const events = Array.isArray(profile.events) ? profile.events : [];
    const units = [...buildEventUnits({ profileId: profile.birthProfileId, pseudonymousProfileId, events }), ...buildTemporalControls({ profileId: profile.birthProfileId, pseudonymousProfileId, events, exclusionDays: controlExclusionDays })];
    // Do not retain or freeze the caller's supplied profile object. The cohort
    // only needs its private ID internally to join supplied factual snapshots.
    return freeze({ profileId: profile.birthProfileId, pseudonymousProfileId, partition: partitionFor(pseudonymousProfileId), units: freeze(units) });
  }).sort((left, right) => left.pseudonymousProfileId.localeCompare(right.pseudonymousProfileId));
  const units = profileRows.flatMap((profile) => profile.units.map((unit) => freeze({ ...unit, partition: profile.partition }))).sort((left, right) => `${left.pseudonymousProfileId}|${left.unitId}`.localeCompare(`${right.pseudonymousProfileId}|${right.unitId}`));
  return freeze({
    schemaId: 'taraverse-job-favourability-research-cohort-v1',
    horizons: freeze([...horizons]), controlExclusionDays, profiles: freeze(profileRows.map(({ profileId, pseudonymousProfileId, partition, units: unitRows }) => freeze({ profileId, pseudonymousProfileId, partition, unitCount: unitRows.length }))),
    units: freeze(units),
    milestones: freeze({ feasibility: freeze({ transitions: 30, profiles: 15 }), preliminaryResearch: freeze({ transitions: 75, profiles: 30 }), strongerReplication: freeze({ transitions: 150, profiles: 60 }) }),
    limitations: freeze(['OFFLINE_RESEARCH_ONLY', 'NO_PRODUCTION_RULE', 'NO_FUTURE_PROJECTION', 'NO_EVENT_PREDICTION']),
  });
}

module.exports = { POSITIVE_EVENT_TYPES, CONTROL_EVENT_TYPES, HORIZON_IDS, CONTROL_EXCLUSION_DAYS, pseudonymizeProfileId, eventObservations, buildEventUnits, buildTemporalControls, partitionFor, buildJobFavourabilityCohort };
