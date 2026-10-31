'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { CareerEventService } = require('../../src/application/career-events');
const { LifeEventService } = require('../../src/application/life-events');

const principal = { provider: 'supabase', subject: 'subject-a', isAnonymous: false };
const now = '2026-10-31T00:00:00.000Z';

function fixture() {
  const rows = []; const observations = []; let sequence = 0;
  const lifeEvents = {
    async create(value) { const row = { ...value, deletedAt: null, legacySourceType: null, legacySourceId: null }; rows.push(row); return row; },
    async listForProfile({ userId, birthProfileId, categories }) { return rows.filter((row) => row.userId === userId && row.birthProfileId === birthProfileId && row.deletedAt == null && (!categories || categories.includes(row.category))); },
    async getForProfile({ userId, birthProfileId, id }) { const row = rows.find((item) => item.id === id && item.userId === userId && item.birthProfileId === birthProfileId && item.deletedAt == null); if (!row) throw Object.assign(new Error('not found'), { code: 'LIFE_EVENT_NOT_FOUND' }); return row; },
    async updateForProfile(value) { const row = await this.getForProfile(value); Object.assign(row, value); return row; },
    async softDeleteForProfile(value) { const row = await this.getForProfile(value); row.deletedAt = value.deletedAt; row.updatedAt = value.updatedAt; return row; },
  };
  const lifeEventObservations = {
    async create(value) { const row = { ...value }; observations.push(row); return row; },
    async listForEvent({ userId, birthProfileId, lifeEventId }) { return observations.filter((row) => row.userId === userId && row.birthProfileId === birthProfileId && row.lifeEventId === lifeEventId); },
    async replaceForEvent({ userId, birthProfileId, lifeEventId, observations: next }) { for (let i = observations.length - 1; i >= 0; i -= 1) if (observations[i].userId === userId && observations[i].birthProfileId === birthProfileId && observations[i].lifeEventId === lifeEventId) observations.splice(i, 1); return Promise.all(next.map((row) => this.create({ ...row, userId, birthProfileId, lifeEventId }))); },
  };
  const service = new CareerEventService({ authUserResolver: async () => ({ id: 'user-a', status: 'active' }), transactionExecutor: { execute: async ({ operation }) => operation({}) }, repositories: () => ({ lifeEvents, lifeEventObservations }), birthProfileService: { get: async ({ birthProfileId }) => { if (birthProfileId !== 'profile-a') throw Object.assign(new Error('forbidden'), { code: 'NOT_FOUND_OR_FORBIDDEN' }); return { id: birthProfileId }; } }, idGenerator: () => `id-${++sequence}`, clock: () => now });
  const lifeService = new LifeEventService({ authUserResolver: async () => ({ id: 'user-a', status: 'active' }), transactionExecutor: { execute: async ({ operation }) => operation({}) }, repositories: () => ({ lifeEvents }), birthProfileService: { get: async ({ birthProfileId }) => { if (birthProfileId !== 'profile-a') throw Object.assign(new Error('forbidden'), { code: 'NOT_FOUND_OR_FORBIDDEN' }); return { id: birthProfileId }; } }, idGenerator: () => `life-${++sequence}`, clock: () => now });
  return { service, lifeService, rows, observations };
}

test('canonical Career adapter consumes generic Career Life Events and preserves their date precision', async () => {
  const { service, rows } = fixture();
  rows.push({ id: 'generic-month', userId: 'user-a', birthProfileId: 'profile-a', category: 'CAREER_BUSINESS', eventType: 'JOB_CHANGED', eventDatePrecision: 'MONTH', eventYear: 2024, eventMonth: 3, eventDay: null, title: null, note: null, createdAt: now, updatedAt: now, deletedAt: null, legacySourceType: null, legacySourceId: null });
  const all = await service.list({ principal, birthProfileId: 'profile-a' });
  const eligible = await service.listForCalibration({ principal, birthProfileId: 'profile-a' });
  assert.equal(all[0].eventType, 'JOB_SWITCH');
  assert.deepEqual(all[0].eventDate, { precision: 'MONTH', year: 2024, month: 3, day: null });
  assert.equal(eligible.length, 1);
});

test('canonical Career adapter maps create, edit, and soft delete to one generic parent record', async () => {
  const { service, rows } = fixture();
  const created = await service.create({ principal, birthProfileId: 'profile-a', body: { eventType: 'JOB_SWITCH', eventDate: { precision: 'DAY', year: 2024, month: 3, day: 2 } } });
  assert.equal(rows.length, 1); assert.equal(rows[0].eventType, 'JOB_CHANGED');
  await service.update({ principal, birthProfileId: 'profile-a', eventId: created.careerEventId, body: { eventType: 'PROMOTION', eventDate: { precision: 'YEAR', year: 2025 } } });
  assert.equal(rows[0].eventType, 'PROMOTION'); assert.equal(rows[0].eventDatePrecision, 'YEAR'); assert.equal(rows[0].eventMonth, null);
  await service.remove({ principal, birthProfileId: 'profile-a', eventId: created.careerEventId });
  assert.equal((await service.listForCalibration({ principal, birthProfileId: 'profile-a' })).length, 0);
});

test('generic Life Event mutations are immediately reflected by Career calibration input', async () => {
  const { service, lifeService } = fixture();
  const created = await lifeService.create({ principal, birthProfileId: 'profile-a', body: { category: 'CAREER_BUSINESS', eventType: 'JOB_CHANGED', eventDate: { precision: 'DAY', year: 2024, month: 3, day: 2 } } });
  assert.equal((await service.listForCalibration({ principal, birthProfileId: 'profile-a' }))[0].eventType, 'JOB_SWITCH');
  await lifeService.update({ principal, birthProfileId: 'profile-a', eventId: created.lifeEventId, body: { eventType: 'PROMOTION', eventDate: { precision: 'YEAR', year: 2025 } } });
  const updated = await service.listForCalibration({ principal, birthProfileId: 'profile-a' });
  assert.equal(updated[0].eventType, 'PROMOTION'); assert.equal(updated[0].eventDate.precision, 'YEAR');
  await lifeService.remove({ principal, birthProfileId: 'profile-a', eventId: created.lifeEventId });
  assert.equal((await service.listForCalibration({ principal, birthProfileId: 'profile-a' })).length, 0);
});

test('legacy Career API observations remain attached to the canonical generic parent', async () => {
  const { service, rows, observations } = fixture();
  const event = await service.create({ principal, birthProfileId: 'profile-a', body: { eventType: 'JOB_SWITCH', observations: [{ type: 'OFFER', date: { precision: 'MONTH', year: 2024, month: 2 } }, { type: 'JOINING', date: { precision: 'MONTH', year: 2024, month: 3 } }] } });
  assert.equal(rows.length, 1); assert.equal(rows[0].eventType, 'JOB_CHANGED');
  assert.equal(observations.length, 2); assert.ok(observations.every((row) => row.lifeEventId === event.careerEventId));
  assert.deepEqual(event.observations.map((item) => item.type), ['OFFER', 'JOINING']);
});

test('ambiguous new generic Career OTHER remains visible but is excluded from calibration', async () => {
  const { service, rows } = fixture();
  rows.push({ id: 'other', userId: 'user-a', birthProfileId: 'profile-a', category: 'CAREER_BUSINESS', eventType: 'OTHER', eventDatePrecision: 'YEAR', eventYear: 2020, eventMonth: null, eventDay: null, title: null, note: null, createdAt: now, updatedAt: now, deletedAt: null, legacySourceType: null, legacySourceId: null });
  const all = await service.list({ principal, birthProfileId: 'profile-a' });
  assert.equal(all[0].calibrationEligible, false);
  assert.equal(all[0].calibrationExclusionReason, 'AMBIGUOUS_GENERIC_CAREER_EVENT');
  assert.equal((await service.listForCalibration({ principal, birthProfileId: 'profile-a' })).length, 0);
});

test('canonical Career adapter cannot read another profile', async () => {
  const { service } = fixture();
  await assert.rejects(() => service.list({ principal, birthProfileId: 'profile-b' }), /NOT_FOUND_OR_FORBIDDEN/);
});
