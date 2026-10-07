'use strict';

// Private curated-cohort intake only. This module validates curation input and
// transforms it into the factual shape consumed by the offline research
// pipeline. It is deliberately not imported by API or production services.
const { localDateTimeToUtc } = require('../../astronomy/time');

const PRIVATE_COHORT_SCHEMA_ID = 'taraverse-job-favourability-private-cohort-v1';
const POSITIVE_FAMILIES = Object.freeze(['FIRST_JOB', 'JOB_SWITCH', 'OFFER', 'JOINING']);
const CONTROL_FAMILIES = Object.freeze(['PROMOTION', 'ROLE_CHANGE', 'SALARY_GROWTH', 'BUSINESS_STARTED', 'CAREER_BREAKTHROUGH', 'CAREER_SETBACK']);
const EVENT_FAMILIES = Object.freeze([...POSITIVE_FAMILIES, ...CONTROL_FAMILIES]);
const PRECISIONS = Object.freeze(['DAY', 'MONTH', 'YEAR']);
const DATE_BY_PRECISION = Object.freeze({ DAY: /^\d{4}-\d{2}-\d{2}$/, MONTH: /^\d{4}-\d{2}$/, YEAR: /^\d{4}$/ });
const TIME = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }
function fail(label) { throw new TypeError(`Invalid private Job Favourability cohort: ${label}`); }
function text(value, label) { if (typeof value !== 'string' || !value.trim()) fail(label); return value.trim(); }
function validTimezone(value) { try { Intl.DateTimeFormat('en-US', { timeZone: value }).format(); return true; } catch { return false; } }
function daysInMonth(year, month) { return new Date(Date.UTC(year, month, 0)).getUTCDate(); }
function parseDate(value, precision) {
  if (!PRECISIONS.includes(precision) || typeof value !== 'string' || !DATE_BY_PRECISION[precision].test(value)) fail(`date/${precision}`);
  const [yearText, monthText, dayText] = value.split('-'); const year = Number(yearText); const month = monthText === undefined ? null : Number(monthText); const day = dayText === undefined ? null : Number(dayText);
  if (!Number.isInteger(year) || year < 1800 || year > 2200 || (month !== null && (month < 1 || month > 12)) || (day !== null && (day < 1 || day > daysInMonth(year, month)))) fail(`impossible date/${precision}`);
  return freeze({ precision, year, month, day, sourceValue: value });
}
function nextLocalDate(date) {
  if (date.precision === 'YEAR') return `${date.year + 1}-01-01`;
  if (date.precision === 'MONTH') return date.month === 12 ? `${date.year + 1}-01-01` : `${date.year}-${String(date.month + 1).padStart(2, '0')}-01`;
  return new Date(Date.UTC(date.year, date.month - 1, date.day + 1)).toISOString().slice(0, 10);
}
function startLocalDate(date) { return date.precision === 'YEAR' ? `${date.year}-01-01` : date.precision === 'MONTH' ? `${date.year}-${String(date.month).padStart(2, '0')}-01` : date.sourceValue; }
function coverageFor(date, birth) {
  const convert = (localDate) => localDateTimeToUtc({ date: localDate, time: '00:00:00.000', timezone: birth.timezone, latitude: birth.latitude, longitude: birth.longitude }).toISOString();
  return freeze({ start: convert(startLocalDate(date)), end: convert(nextLocalDate(date)) });
}
function normalizeBirth(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('birth');
  const localDate = parseDate(value.localDate, 'DAY').sourceValue;
  const localTime = text(value.localTime, 'birth.localTime'); if (!TIME.test(localTime)) fail('birth.localTime');
  const timezone = text(value.timezone, 'birth.timezone'); if (!validTimezone(timezone)) fail('birth.timezone');
  const latitude = value.latitude; const longitude = value.longitude;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) fail('birth.latitude');
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) fail('birth.longitude');
  return freeze({ localDate, localTime, timezone, latitude, longitude });
}
function normalizeMetadata(value) {
  if (value === undefined) return freeze({});
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('observation.metadata');
  const output = {};
  if (value.source !== undefined) output.source = text(value.source, 'observation.metadata.source');
  if (value.curationNote !== undefined) output.curationNote = text(value.curationNote, 'observation.metadata.curationNote');
  return freeze(output);
}
function normalizeObservation(value, birth, event) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('observation');
  const observationId = text(value.observationId, 'observation.observationId');
  const type = text(value.type, 'observation.type');
  const precision = text(value.precision, 'observation.precision');
  const date = parseDate(value.date, precision);
  if (event.eventFamily === 'OFFER' && type !== 'OFFER') fail('OFFER event observation.type');
  if (event.eventFamily === 'JOINING' && type !== 'JOINING') fail('JOINING event observation.type');
  if (!['OFFER', 'JOINING', 'EVENT_DATE', ...CONTROL_FAMILIES].includes(type)) fail('observation.type');
  const transitionId = value.transitionId === undefined ? event.transitionId : text(value.transitionId, 'observation.transitionId');
  if (type === 'OFFER' || type === 'JOINING') {
    if (!transitionId) fail('explicit transitionId for OFFER/JOINING');
    const transitionFamily = event.transitionFamily || (['FIRST_JOB', 'JOB_SWITCH'].includes(event.eventFamily) ? event.eventFamily : null);
    if (!transitionFamily || !['FIRST_JOB', 'JOB_SWITCH'].includes(transitionFamily)) fail('transitionFamily for OFFER/JOINING');
  }
  return freeze({ observationId, type, date: freeze({ precision: date.precision, year: date.year, month: date.month, day: date.day }), temporalCoverage: coverageFor(date, birth), transitionId: transitionId || null, metadata: normalizeMetadata(value.metadata) });
}
function normalizeEvent(value, birth) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('event');
  const eventId = text(value.eventId, 'event.eventId'); const eventFamily = text(value.eventFamily, 'event.eventFamily');
  if (!EVENT_FAMILIES.includes(eventFamily)) fail('event.eventFamily');
  const transitionId = value.transitionId === undefined ? null : text(value.transitionId, 'event.transitionId');
  const transitionFamily = value.transitionFamily === undefined ? null : text(value.transitionFamily, 'event.transitionFamily');
  if ((eventFamily === 'OFFER' || eventFamily === 'JOINING') && (!transitionId || !['FIRST_JOB', 'JOB_SWITCH'].includes(transitionFamily))) fail('explicit linkage for OFFER/JOINING');
  if (transitionFamily !== null && !['FIRST_JOB', 'JOB_SWITCH'].includes(transitionFamily)) fail('event.transitionFamily');
  if (CONTROL_FAMILIES.includes(eventFamily) && (transitionId || transitionFamily)) fail('control transition linkage');
  if (!Array.isArray(value.observations) || !value.observations.length) fail('event.observations');
  return freeze({ eventId, eventFamily, transitionId, transitionFamily, observations: freeze(value.observations.map((item) => normalizeObservation(item, birth, { eventFamily, transitionId, transitionFamily }))) });
}
function observationKey(event, observation) { return `${event.transitionId || event.eventId}|${observation.type}|${observation.date.precision}|${observation.temporalCoverage.start}|${observation.temporalCoverage.end}`; }
function canonicalEvents(events) {
  const seenEventIds = new Set(); const seenObservations = new Set(); const direct = []; const linked = new Map();
  for (const event of events) {
    if (seenEventIds.has(event.eventId)) fail('duplicate event.eventId'); seenEventIds.add(event.eventId);
    for (const observation of event.observations) {
      const key = observationKey(event, observation); if (seenObservations.has(key)) fail('duplicate observation'); seenObservations.add(key);
    }
    const hasLinkedObservation = event.observations.some((item) => item.type === 'OFFER' || item.type === 'JOINING');
    const explicitTransitionUnit = hasLinkedObservation || (event.transitionId && ['FIRST_JOB', 'JOB_SWITCH'].includes(event.eventFamily));
    if (!explicitTransitionUnit) { direct.push(freeze({ careerEventId: event.eventId, eventType: event.eventFamily, observations: event.observations.map(({ metadata, ...observation }) => observation) })); continue; }
    const transitionId = event.transitionId || event.observations.find((item) => item.transitionId)?.transitionId;
    const transitionFamily = event.transitionFamily || (['FIRST_JOB', 'JOB_SWITCH'].includes(event.eventFamily) ? event.eventFamily : null);
    if (!transitionId || !transitionFamily) fail('explicit OFFER/JOINING linkage');
    if (!linked.has(transitionId)) linked.set(transitionId, { careerEventId: `transition:${transitionId}`, eventType: transitionFamily, observations: [] });
    const group = linked.get(transitionId); if (group.eventType !== transitionFamily) fail('conflicting transitionFamily');
    group.observations.push(...event.observations.map(({ metadata, ...observation }) => observation));
  }
  const linkedEvents = [...linked.values()].map((event) => freeze({ ...event, observations: freeze(event.observations.sort((left, right) => `${left.temporalCoverage.start}|${left.type}|${left.observationId}`.localeCompare(`${right.temporalCoverage.start}|${right.type}|${right.observationId}`))) }));
  return freeze([...direct, ...linkedEvents].sort((left, right) => left.careerEventId.localeCompare(right.careerEventId)));
}
function normalizeJobFavourabilityPrivateCohort(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaId !== PRIVATE_COHORT_SCHEMA_ID) fail('schemaId');
  const cohortSalt = text(value.cohortSalt, 'cohortSalt');
  if (!Array.isArray(value.profiles) || !value.profiles.length) fail('profiles');
  const ids = new Set();
  const profiles = value.profiles.map((profile) => {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) fail('profile');
    const pseudonymousProfileId = text(profile.pseudonymousProfileId, 'profile.pseudonymousProfileId'); if (ids.has(pseudonymousProfileId)) fail('duplicate profile.pseudonymousProfileId'); ids.add(pseudonymousProfileId);
    const birth = normalizeBirth(profile.birth);
    if (!Array.isArray(profile.events) || !profile.events.length) fail('profile.events');
    const events = profile.events.map((event) => normalizeEvent(event, birth));
    return freeze({ pseudonymousProfileId, birth, events: freeze(events), canonicalEvents: canonicalEvents(events), factualInputs: profile.factualInputs && typeof profile.factualInputs === 'object' && !Array.isArray(profile.factualInputs) ? profile.factualInputs : freeze({}) });
  });
  return freeze({ schemaId: PRIVATE_COHORT_SCHEMA_ID, cohortSalt, profiles: freeze(profiles) });
}

module.exports = { PRIVATE_COHORT_SCHEMA_ID, POSITIVE_FAMILIES, CONTROL_FAMILIES, EVENT_FAMILIES, PRECISIONS, normalizeJobFavourabilityPrivateCohort };
