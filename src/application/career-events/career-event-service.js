'use strict';

const { verifiedPrincipal } = require('../../security/auth');
const { repositoryError, immutableCopy } = require('../../persistence/contracts');

const EVENT_TYPES = Object.freeze(['FIRST_JOB', 'JOB_SWITCH', 'PROMOTION', 'ROLE_CHANGE', 'SALARY_GROWTH', 'JOB_LOSS', 'BUSINESS_STARTED', 'CAREER_BREAKTHROUGH', 'CAREER_SETBACK', 'OTHER']);
const DATE_PRECISIONS = Object.freeze(['DAY', 'MONTH', 'YEAR']);
const OBSERVATION_TYPES = Object.freeze(['OFFER', 'JOINING', 'PROMOTION', 'EXIT', 'TERMINATION', 'BUSINESS_START', 'ROLE_CHANGE', 'SALARY_CHANGE']);
const LEGACY_OBSERVATION_TYPE = 'EVENT_DATE';
const MAX_OBSERVATIONS = 8;

function fail(code) { throw repositoryError(code); }
function optionalText(value, name, maximum) { if (value === null || value === undefined) return null; if (typeof value !== 'string') fail(`INVALID_CAREER_EVENT_${name}`); const trimmed = value.trim(); if (trimmed.length > maximum) fail(`INVALID_CAREER_EVENT_${name}`); return trimmed || null; }
function hasOnly(object, allowed, code) { if (!object || typeof object !== 'object' || Array.isArray(object) || Object.keys(object).some((key) => !allowed.includes(key))) fail(code); }
function dateParts(value, clock) {
  hasOnly(value, ['precision', 'year', 'month', 'day'], 'INVALID_CAREER_EVENT_DATE');
  if (!DATE_PRECISIONS.includes(value.precision) || !Number.isInteger(value.year) || value.year < 1 || value.year > 9999) fail('INVALID_CAREER_EVENT_DATE');
  const { precision, year } = value; const month = value.month == null ? null : value.month; const day = value.day == null ? null : value.day;
  if ((precision === 'YEAR' && (month !== null || day !== null)) || (precision === 'MONTH' && (!Number.isInteger(month) || month < 1 || month > 12 || day !== null)) || (precision === 'DAY' && (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > 31))) fail('INVALID_CAREER_EVENT_DATE');
  if (precision === 'DAY' && new Date(Date.UTC(year, month - 1, day)).getUTCFullYear() !== year || precision === 'DAY' && new Date(Date.UTC(year, month - 1, day)).getUTCMonth() !== month - 1) fail('INVALID_CAREER_EVENT_DATE');
  const today = new Date(clock()); if (Number.isNaN(today.valueOf())) fail('INVALID_CAREER_EVENT_CLOCK'); const now = [today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate()]; const candidate = precision === 'YEAR' ? [year] : precision === 'MONTH' ? [year, month] : [year, month, day];
  for (let index = 0; index < candidate.length; index += 1) { if (candidate[index] > now[index]) fail('CAREER_EVENT_DATE_IN_FUTURE'); if (candidate[index] < now[index]) break; }
  return Object.freeze({ precision, year, month, day });
}
function dateKey(date) { return `${String(date.year).padStart(4, '0')}-${String(date.month || 0).padStart(2, '0')}-${String(date.day || 0).padStart(2, '0')}|${date.precision}`; }
function dateOrder(left, right) { return dateKey(left).localeCompare(dateKey(right)); }
function observation(value, clock) { hasOnly(value, ['type', 'date'], 'INVALID_CAREER_EVENT_OBSERVATION'); if (!OBSERVATION_TYPES.includes(value.type)) fail('INVALID_CAREER_EVENT_OBSERVATION_TYPE'); return Object.freeze({ type: value.type, date: dateParts(value.date, clock) }); }
function observations(value, clock) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_OBSERVATIONS) fail('INVALID_CAREER_EVENT_OBSERVATIONS');
  const out = value.map((item) => observation(item, clock)).sort((left, right) => dateOrder(left.date, right.date) || left.type.localeCompare(right.type));
  const keys = new Set(); for (const item of out) { const key = `${item.type}|${dateKey(item.date)}`; if (keys.has(key)) fail('INVALID_CAREER_EVENT_OBSERVATION'); keys.add(key); }
  return Object.freeze(out);
}
function input(value, clock, partial = false) {
  hasOnly(value, ['eventType', 'eventDate', 'observations', 'title', 'notes'], partial ? 'INVALID_CAREER_EVENT_UPDATE' : 'INVALID_CAREER_EVENT_INPUT');
  const keys = Object.keys(value); if (partial && keys.length === 0) fail('INVALID_CAREER_EVENT_UPDATE'); if (!partial && (!Object.hasOwn(value, 'eventType') || (!Object.hasOwn(value, 'eventDate') && !Object.hasOwn(value, 'observations')))) fail('INVALID_CAREER_EVENT_INPUT');
  const out = {};
  if (Object.hasOwn(value, 'eventType')) { if (!EVENT_TYPES.includes(value.eventType)) fail('INVALID_CAREER_EVENT_TYPE'); out.eventType = value.eventType; }
  if (Object.hasOwn(value, 'eventDate')) out.eventDate = dateParts(value.eventDate, clock);
  if (Object.hasOwn(value, 'observations')) out.observations = observations(value.observations, clock);
  if (Object.hasOwn(value, 'title')) out.title = optionalText(value.title, 'TITLE', 160);
  if (Object.hasOwn(value, 'notes')) out.notes = optionalText(value.notes, 'NOTES', 2000);
  return out;
}
function publicDate(value) { return { precision: value.precision, year: value.year, month: value.month, day: value.day }; }
function legacyObservation(row) { return { observationId: null, type: LEGACY_OBSERVATION_TYPE, date: publicDate({ precision: row.eventDatePrecision, year: row.eventYear, month: row.eventMonth, day: row.eventDay }), legacy: true }; }
function publicObservation(row) { return { observationId: row.id, type: row.observationType, date: publicDate({ precision: row.eventDatePrecision, year: row.eventYear, month: row.eventMonth, day: row.eventDay }) }; }
function dto(value, stored = []) { const valueObservations = stored.length ? stored.map(publicObservation) : [legacyObservation(value)]; return immutableCopy({ careerEventId: value.id, birthProfileId: value.birthProfileId, eventType: value.eventType, eventDate: publicDate({ precision: value.eventDatePrecision, year: value.eventYear, month: value.eventMonth, day: value.eventDay }), observations: valueObservations, title: value.title, notes: value.notes, createdAt: value.createdAt, updatedAt: value.updatedAt }); }
function primaryDate(value, fallback) { return value && value.length ? value[0].date : fallback; }
class CareerEventService {
  constructor({ authUserResolver, transactionExecutor, repositories, birthProfileService, idGenerator, clock } = {}) { this.auth = authUserResolver; this.tx = transactionExecutor; this.repos = repositories; this.profiles = birthProfileService; this.ids = idGenerator; this.clock = clock; if (!this.auth || !this.tx || !this.repos || !this.profiles || !this.ids || !this.clock) fail('INVALID_CAREER_EVENT_SERVICE'); }
  async user(principal) { const verified = verifiedPrincipal(principal); if (verified.isAnonymous) fail('ANONYMOUS_AUTH_NOT_ALLOWED'); const user = await this.auth(verified); if (!user || user.status !== 'active') fail('APP_USER_DISABLED'); return [verified, user]; }
  async runtime(principal, operation) { return this.tx.execute({ principal, role: 'app_runtime', operation: (context) => operation(this.repos(context)) }); }
  async ownedProfile(principal, birthProfileId) { try { return await this.profiles.get({ principal, birthProfileId }); } catch { fail('NOT_FOUND_OR_FORBIDDEN'); } }
  async stored(repos, userId, birthProfileId, careerEventId) { return repos.careerEventObservations && typeof repos.careerEventObservations.listForEvent === 'function' ? repos.careerEventObservations.listForEvent({ userId, birthProfileId, careerEventId }) : []; }
  async create({ principal, birthProfileId, body }) {
    const [verified, user] = await this.user(principal); await this.ownedProfile(verified, birthProfileId); const value = input(body, this.clock); const at = this.clock(); const id = this.ids(); const primary = primaryDate(value.observations, value.eventDate);
    try { return await this.runtime(verified, async (repos) => { if (value.observations && !repos.careerEventObservations) fail('INVALID_CAREER_EVENT_OBSERVATIONS'); const row = await repos.careerEvents.create({ id, userId: user.id, birthProfileId, eventType: value.eventType, eventDatePrecision: primary.precision, eventYear: primary.year, eventMonth: primary.month, eventDay: primary.day, title: value.title === undefined ? null : value.title, notes: value.notes === undefined ? null : value.notes, createdAt: at, updatedAt: at }); const stored = []; if (value.observations) for (const item of value.observations) stored.push(await repos.careerEventObservations.create({ id: this.ids(), userId: user.id, birthProfileId, careerEventId: id, observationType: item.type, eventDatePrecision: item.date.precision, eventYear: item.date.year, eventMonth: item.date.month, eventDay: item.date.day, createdAt: at, updatedAt: at })); return dto(row, stored); }); } catch (error) { if (error && /^(INVALID_CAREER_EVENT|CAREER_EVENT_DATE_IN_FUTURE)/.test(error.code)) throw error; fail('NOT_FOUND_OR_FORBIDDEN'); }
  }
  async list({ principal, birthProfileId }) { const [verified, user] = await this.user(principal); await this.ownedProfile(verified, birthProfileId); try { return await this.runtime(verified, async (repos) => Promise.all((await repos.careerEvents.listForProfile({ userId: user.id, birthProfileId })).map(async (value) => dto(value, await this.stored(repos, user.id, birthProfileId, value.id))))); } catch { fail('NOT_FOUND_OR_FORBIDDEN'); } }
  async get({ principal, birthProfileId, eventId }) { const [verified, user] = await this.user(principal); await this.ownedProfile(verified, birthProfileId); try { return await this.runtime(verified, async (repos) => { const value = await repos.careerEvents.getForProfile({ userId: user.id, birthProfileId, id: eventId }); return dto(value, await this.stored(repos, user.id, birthProfileId, value.id)); }); } catch { fail('NOT_FOUND_OR_FORBIDDEN'); } }
  async update({ principal, birthProfileId, eventId, body }) {
    const [verified, user] = await this.user(principal); await this.ownedProfile(verified, birthProfileId); const changes = input(body, this.clock, true); const at = this.clock();
    try { return await this.runtime(verified, async (repos) => { const prior = await repos.careerEvents.getForProfile({ userId: user.id, birthProfileId, id: eventId }); if (changes.observations && !repos.careerEventObservations) fail('INVALID_CAREER_EVENT_OBSERVATIONS'); const primary = primaryDate(changes.observations, changes.eventDate || { precision: prior.eventDatePrecision, year: prior.eventYear, month: prior.eventMonth, day: prior.eventDay }); const row = await repos.careerEvents.updateForProfile({ id: eventId, userId: user.id, birthProfileId, eventType: changes.eventType === undefined ? prior.eventType : changes.eventType, eventDatePrecision: primary.precision, eventYear: primary.year, eventMonth: primary.month, eventDay: primary.day, title: changes.title === undefined ? prior.title : changes.title, notes: changes.notes === undefined ? prior.notes : changes.notes, updatedAt: at }); let stored = await this.stored(repos, user.id, birthProfileId, eventId); if (changes.observations) stored = await repos.careerEventObservations.replaceForEvent({ userId: user.id, birthProfileId, careerEventId: eventId, observations: changes.observations.map((item) => ({ id: this.ids(), observationType: item.type, eventDatePrecision: item.date.precision, eventYear: item.date.year, eventMonth: item.date.month, eventDay: item.date.day, createdAt: at, updatedAt: at })) }); return dto(row, stored); }); } catch (error) { if (error && /^(INVALID_CAREER_EVENT|CAREER_EVENT_DATE_IN_FUTURE)/.test(error.code)) throw error; fail('NOT_FOUND_OR_FORBIDDEN'); }
  }
  async remove({ principal, birthProfileId, eventId }) { const [verified, user] = await this.user(principal); await this.ownedProfile(verified, birthProfileId); const at = this.clock(); try { return dto(await this.runtime(verified, (repos) => repos.careerEvents.softDeleteForProfile({ userId: user.id, birthProfileId, id: eventId, deletedAt: at, updatedAt: at }))); } catch { fail('NOT_FOUND_OR_FORBIDDEN'); } }
}
module.exports = { CareerEventService, EVENT_TYPES, DATE_PRECISIONS, OBSERVATION_TYPES, LEGACY_OBSERVATION_TYPE, MAX_OBSERVATIONS };
