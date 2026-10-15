'use strict';

const { verifiedPrincipal } = require('../../security/auth');
const { repositoryError, immutableCopy } = require('../../persistence/contracts');

const CATEGORIES = Object.freeze(['CAREER_BUSINESS', 'PROPERTY', 'VEHICLE', 'RELATIONSHIPS_FAMILY']);
const EVENT_TYPES = Object.freeze(['JOB_JOINED', 'JOB_CHANGED', 'PROMOTION', 'ROLE_CHANGED', 'SALARY_CHANGED', 'JOB_LOSS', 'BUSINESS_STARTED', 'CAREER_BREAKTHROUGH', 'CAREER_SETBACK', 'OTHER', 'PROPERTY_PURCHASE', 'PROPERTY_SALE', 'VEHICLE_PURCHASE', 'VEHICLE_SALE', 'MARRIAGE', 'ENGAGEMENT', 'CHILD_BIRTH']);
const CATEGORY_TYPES = Object.freeze({ CAREER_BUSINESS: new Set(EVENT_TYPES.slice(0, 9)), PROPERTY: new Set(['PROPERTY_PURCHASE', 'PROPERTY_SALE']), VEHICLE: new Set(['VEHICLE_PURCHASE', 'VEHICLE_SALE']), RELATIONSHIPS_FAMILY: new Set(['MARRIAGE', 'ENGAGEMENT', 'CHILD_BIRTH']) });
const DATE_PRECISIONS = Object.freeze(['DAY', 'MONTH', 'YEAR']);
function fail(code) { throw repositoryError(code); }
function safeErrorCode(error) { return error && typeof error.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'UNKNOWN_ERROR'; }
function diagnostic(log, stage, state, birthProfileId, error) {
  if (typeof log !== 'function') return;
  log(Object.freeze({ event: `LIFE_EVENT_${stage}`, stage, state, birthProfileId, ...(error ? { safeErrorCode: safeErrorCode(error) } : {}) }));
}
function date(value, clock) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !['precision', 'year', 'month', 'day'].includes(key))) fail('INVALID_LIFE_EVENT_DATE');
  const { precision, year } = value; const month = value.month == null ? null : value.month; const day = value.day == null ? null : value.day;
  if (!DATE_PRECISIONS.includes(precision) || !Number.isInteger(year) || year < 1 || year > 9999 || (precision === 'YEAR' && (month != null || day != null)) || (precision === 'MONTH' && (!Number.isInteger(month) || month < 1 || month > 12 || day != null)) || (precision === 'DAY' && (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31))) fail('INVALID_LIFE_EVENT_DATE');
  if (precision === 'DAY' && (new Date(Date.UTC(year, month - 1, day)).getUTCMonth() !== month - 1 || new Date(Date.UTC(year, month - 1, day)).getUTCDate() !== day)) fail('INVALID_LIFE_EVENT_DATE');
  const now = new Date(clock()); const current = [now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate()]; const candidate = precision === 'YEAR' ? [year] : precision === 'MONTH' ? [year, month] : [year, month, day];
  for (let i = 0; i < candidate.length; i += 1) { if (candidate[i] > current[i]) fail('LIFE_EVENT_DATE_IN_FUTURE'); if (candidate[i] < current[i]) break; }
  return Object.freeze({ precision, year, month, day });
}
function text(value, key, max) { if (value == null) return null; if (typeof value !== 'string' || value.trim().length > max) fail(`INVALID_LIFE_EVENT_${key}`); return value.trim() || null; }
function input(body, clock, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !['category', 'eventType', 'eventDate', 'title', 'note'].includes(key))) fail(partial ? 'INVALID_LIFE_EVENT_UPDATE' : 'INVALID_LIFE_EVENT_INPUT');
  if (!partial && (!Object.hasOwn(body, 'category') || !Object.hasOwn(body, 'eventType') || !Object.hasOwn(body, 'eventDate'))) fail('INVALID_LIFE_EVENT_INPUT');
  const out = {};
  if (Object.hasOwn(body, 'category')) { if (!CATEGORIES.includes(body.category)) fail('INVALID_LIFE_EVENT_CATEGORY'); out.category = body.category; }
  if (Object.hasOwn(body, 'eventType')) { if (!EVENT_TYPES.includes(body.eventType)) fail('INVALID_LIFE_EVENT_TYPE'); out.eventType = body.eventType; }
  if (out.category && out.eventType && !CATEGORY_TYPES[out.category].has(out.eventType)) fail('INVALID_LIFE_EVENT_CATEGORY_TYPE');
  if (Object.hasOwn(body, 'eventDate')) out.eventDate = date(body.eventDate, clock);
  if (Object.hasOwn(body, 'title')) out.title = text(body.title, 'TITLE', 160);
  if (Object.hasOwn(body, 'note')) out.note = text(body.note, 'NOTE', 2000);
  return out;
}
function dto(row) { return immutableCopy({ lifeEventId: row.id, birthProfileId: row.birthProfileId, category: row.category, eventType: row.eventType, eventDate: { precision: row.eventDatePrecision, year: row.eventYear, month: row.eventMonth, day: row.eventDay }, title: row.title, note: row.note, createdAt: row.createdAt, updatedAt: row.updatedAt }); }
class LifeEventService {
  constructor({ authUserResolver, transactionExecutor, repositories, birthProfileService, idGenerator, clock } = {}) { if (!authUserResolver || !transactionExecutor || !repositories || !birthProfileService || !idGenerator || !clock) fail('INVALID_LIFE_EVENT_SERVICE'); Object.assign(this, { auth: authUserResolver, tx: transactionExecutor, repos: repositories, profiles: birthProfileService, ids: idGenerator, clock }); }
  async user(principal) { const verified = verifiedPrincipal(principal); if (verified.isAnonymous) fail('ANONYMOUS_AUTH_NOT_ALLOWED'); const user = await this.auth(verified); if (!user || user.status !== 'active') fail('APP_USER_DISABLED'); return [verified, user]; }
  async owned(principal, birthProfileId, diagnosticLog = null) {
    diagnostic(diagnosticLog, 'PROFILE_LOOKUP', 'STARTED', birthProfileId);
    try {
      await this.profiles.get({ principal, birthProfileId });
      diagnostic(diagnosticLog, 'PROFILE_LOOKUP', 'SUCCEEDED', birthProfileId);
      diagnostic(diagnosticLog, 'OWNERSHIP', 'SUCCEEDED', birthProfileId);
    } catch (error) {
      diagnostic(diagnosticLog, 'PROFILE_LOOKUP', 'FAILED', birthProfileId, error);
      diagnostic(diagnosticLog, 'OWNERSHIP', 'FAILED', birthProfileId, error);
      fail('NOT_FOUND_OR_FORBIDDEN');
    }
  }
  async runtime(principal, operation) { return this.tx.execute({ principal, role: 'app_runtime', operation: (context) => operation(this.repos(context)) }); }
  async list({ principal, birthProfileId, categories = null, eventTypes = null, diagnosticLog = null }) { const [verified, user] = await this.user(principal); await this.owned(verified, birthProfileId, diagnosticLog); if (categories && (!Array.isArray(categories) || categories.some((x) => !CATEGORIES.includes(x)))) fail('INVALID_LIFE_EVENT_CATEGORY'); if (eventTypes && (!Array.isArray(eventTypes) || eventTypes.some((x) => !EVENT_TYPES.includes(x)))) fail('INVALID_LIFE_EVENT_TYPE'); try { return await this.runtime(verified, async (repos) => (await repos.lifeEvents.listForProfile({ userId: user.id, birthProfileId, categories, eventTypes })).map(dto)); } catch (error) { diagnostic(diagnosticLog, 'RESPONSE', 'FAILED', birthProfileId, error); fail('NOT_FOUND_OR_FORBIDDEN'); } }
  async getRelevantLifeEvents({ principal, birthProfileId, categories = null, eventTypes = null }) { return this.list({ principal, birthProfileId, categories, eventTypes }); }
  async create({ principal, birthProfileId, body, diagnosticLog = null }) {
    const [verified, user] = await this.user(principal);
    await this.owned(verified, birthProfileId, diagnosticLog);
    const value = input(body, this.clock);
    const at = this.clock();
    diagnostic(diagnosticLog, 'INSERT', 'STARTED', birthProfileId);
    try {
      const created = await this.runtime(verified, async (repos) => dto(await repos.lifeEvents.create({ id: this.ids(), userId: user.id, birthProfileId, category: value.category, eventType: value.eventType, eventDatePrecision: value.eventDate.precision, eventYear: value.eventDate.year, eventMonth: value.eventDate.month, eventDay: value.eventDate.day, title: value.title || null, note: value.note || null, createdAt: at, updatedAt: at })));
      diagnostic(diagnosticLog, 'INSERT', 'SUCCEEDED', birthProfileId);
      return created;
    } catch (error) {
      diagnostic(diagnosticLog, 'INSERT', 'FAILED', birthProfileId, error);
      if (error && /^INVALID_LIFE_EVENT|LIFE_EVENT_DATE_IN_FUTURE/.test(error.code)) throw error;
      fail('NOT_FOUND_OR_FORBIDDEN');
    }
  }
  async update({ principal, birthProfileId, eventId, body }) { const [verified, user] = await this.user(principal); await this.owned(verified, birthProfileId); const changes = input(body, this.clock, true); const at = this.clock(); try { return await this.runtime(verified, async (repos) => { const prior = await repos.lifeEvents.getForProfile({ userId: user.id, birthProfileId, id: eventId }); const category = changes.category || prior.category; const eventType = changes.eventType || prior.eventType; if (!CATEGORY_TYPES[category].has(eventType)) fail('INVALID_LIFE_EVENT_CATEGORY_TYPE'); const value = changes.eventDate || { precision: prior.eventDatePrecision, year: prior.eventYear, month: prior.eventMonth, day: prior.eventDay }; return dto(await repos.lifeEvents.updateForProfile({ id: eventId, userId: user.id, birthProfileId, category, eventType, eventDatePrecision: value.precision, eventYear: value.year, eventMonth: value.month, eventDay: value.day, title: changes.title === undefined ? prior.title : changes.title, note: changes.note === undefined ? prior.note : changes.note, updatedAt: at })); }); } catch (error) { if (error && /^INVALID_LIFE_EVENT|LIFE_EVENT_DATE_IN_FUTURE/.test(error.code)) throw error; fail('NOT_FOUND_OR_FORBIDDEN'); } }
  async remove({ principal, birthProfileId, eventId }) { const [verified, user] = await this.user(principal); await this.owned(verified, birthProfileId); try { return await this.runtime(verified, async (repos) => dto(await repos.lifeEvents.softDeleteForProfile({ userId: user.id, birthProfileId, id: eventId, deletedAt: this.clock(), updatedAt: this.clock() }))); } catch { fail('NOT_FOUND_OR_FORBIDDEN'); } }
}
module.exports = { LifeEventService, CATEGORIES, EVENT_TYPES, DATE_PRECISIONS, CATEGORY_TYPES };
