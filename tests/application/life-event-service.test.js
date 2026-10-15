'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { LifeEventService } = require('../../src/application/life-events');

const principal = { provider: 'supabase', subject: 'subject-a', isAnonymous: false };
function fixture() {
  const rows = []; let count = 0;
  const lifeEvents = {
    async create(value) { const row = { ...value, deletedAt: null }; rows.push(row); return row; },
    async listForProfile({ userId, birthProfileId, categories, eventTypes }) { return rows.filter((row) => row.userId === userId && row.birthProfileId === birthProfileId && row.deletedAt == null && (!categories || categories.includes(row.category)) && (!eventTypes || eventTypes.includes(row.eventType))); },
    async getForProfile({ userId, birthProfileId, id }) { const row = rows.find((item) => item.id === id && item.userId === userId && item.birthProfileId === birthProfileId && item.deletedAt == null); if (!row) throw Object.assign(new Error('not found'), { code: 'LIFE_EVENT_NOT_FOUND' }); return row; },
    async updateForProfile(value) { const row = await this.getForProfile(value); Object.assign(row, value); return row; },
    async softDeleteForProfile(value) { const row = await this.getForProfile(value); row.deletedAt = value.deletedAt; row.updatedAt = value.updatedAt; return row; },
  };
  const service = new LifeEventService({ authUserResolver: async () => ({ id: 'user-a', status: 'active' }), transactionExecutor: { execute: async ({ operation }) => operation({}) }, repositories: () => ({ lifeEvents }), birthProfileService: { get: async ({ birthProfileId }) => { if (birthProfileId !== 'profile-a') throw new Error('forbidden'); return { id: birthProfileId }; } }, idGenerator: () => `life-${++count}`, clock: () => '2026-10-15T00:00:00.000Z' });
  return { service, rows };
}
test('Life Events preserves DAY/MONTH/YEAR precision, category filtering, and profile ownership', async () => {
  const { service } = fixture();
  const create = (category, eventType, eventDate) => service.create({ principal, birthProfileId: 'profile-a', body: { category, eventType, eventDate } });
  await create('CAREER_BUSINESS', 'JOB_CHANGED', { precision: 'DAY', year: 2020, month: 2, day: 2 });
  await create('VEHICLE', 'VEHICLE_PURCHASE', { precision: 'MONTH', year: 2021, month: 3 });
  await create('PROPERTY', 'PROPERTY_PURCHASE', { precision: 'YEAR', year: 2022 });
  const career = await service.getRelevantLifeEvents({ principal, birthProfileId: 'profile-a', categories: ['CAREER_BUSINESS'] });
  assert.equal(career.length, 1); assert.equal(career[0].eventDate.precision, 'DAY');
  const all = await service.list({ principal, birthProfileId: 'profile-a' });
  assert.deepEqual(all.map((event) => event.eventDate.precision), ['DAY', 'MONTH', 'YEAR']);
  await assert.rejects(() => create('PROPERTY', 'JOB_CHANGED', { precision: 'YEAR', year: 2020 }), /INVALID_LIFE_EVENT_CATEGORY_TYPE/);
  await assert.rejects(() => service.list({ principal, birthProfileId: 'profile-b' }), /NOT_FOUND_OR_FORBIDDEN/);
});
