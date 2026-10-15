'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi } = require('../../src/api');
const { createTestOnlyAuthVerifier } = require('../../src/api/test-only-auth-verifier');
const { LifeEventService } = require('../../src/application/life-events');

const principalA = { provider: 'supabase', subject: 'subject-a', isAnonymous: false };
const principalB = { provider: 'supabase', subject: 'subject-b', isAnonymous: false };

function fixture() {
  const rows = [];
  let sequence = 0;
  const owners = Object.freeze({ 'profile-a': 'subject-a', 'profile-b': 'subject-b' });
  const lifeEvents = {
    async create(value) {
      const row = Object.freeze({ ...value, deletedAt: null });
      rows.push(row);
      return row;
    },
    async listForProfile({ userId, birthProfileId, categories, eventTypes }) {
      return rows.filter((row) => row.userId === userId
        && row.birthProfileId === birthProfileId
        && row.deletedAt == null
        && (!categories || categories.includes(row.category))
        && (!eventTypes || eventTypes.includes(row.eventType)));
    },
    async getForProfile() { throw Object.assign(new Error('not used'), { code: 'LIFE_EVENT_NOT_FOUND' }); },
    async updateForProfile() { throw Object.assign(new Error('not used'), { code: 'LIFE_EVENT_NOT_FOUND' }); },
    async softDeleteForProfile() { throw Object.assign(new Error('not used'), { code: 'LIFE_EVENT_NOT_FOUND' }); },
  };
  const service = new LifeEventService({
    authUserResolver: async (principal) => ({ id: principal.subject === 'subject-a' ? 'user-a' : 'user-b', status: 'active' }),
    transactionExecutor: { execute: async ({ operation }) => operation({}) },
    repositories: () => ({ lifeEvents }),
    birthProfileService: {
      get: async ({ principal, birthProfileId }) => {
        if (owners[birthProfileId] !== principal.subject) throw Object.assign(new Error('forbidden'), { code: 'NOT_FOUND_OR_FORBIDDEN' });
        return { id: birthProfileId };
      },
    },
    idGenerator: () => `life-event-${++sequence}`,
    clock: () => '2026-10-15T00:00:00.000Z',
  });
  const api = createApi({
    authVerifier: createTestOnlyAuthVerifier({ a: principalA, b: principalB }),
    userResolver: { resolve: async () => ({ id: 'unused', status: 'active' }) },
    birthProfileService: { create: async () => null, list: async () => [], get: async () => null },
    lifeEventService: service,
    secureReadingService: {},
    requestIdGenerator: () => 'request-life-event',
  });
  return { api, rows };
}

function request(api, method, url, subject = 'a', payload) {
  return api.inject({ method, url, headers: { authorization: `Bearer ${subject}` }, payload });
}

test('Life Events Fastify composition creates and lists an owned profile event', async () => {
  const { api } = fixture();
  const created = await request(api, 'POST', '/v1/birth-profiles/profile-a/life-events', 'a', {
    category: 'PROPERTY',
    eventType: 'PROPERTY_PURCHASE',
    eventDate: { precision: 'MONTH', year: 2024, month: 6 },
  });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().lifeEvent.birthProfileId, 'profile-a');
  assert.deepEqual(created.json().lifeEvent.eventDate, { precision: 'MONTH', year: 2024, month: 6, day: null });

  const listed = await request(api, 'GET', '/v1/birth-profiles/profile-a/life-events', 'a');
  assert.equal(listed.statusCode, 200);
  assert.deepEqual(listed.json().lifeEvents.map((event) => event.eventType), ['PROPERTY_PURCHASE']);
  await api.close();
});

test('Life Events Fastify composition fails closed for a foreign profile', async () => {
  const { api, rows } = fixture();
  const response = await request(api, 'POST', '/v1/birth-profiles/profile-b/life-events', 'a', {
    category: 'PROPERTY',
    eventType: 'PROPERTY_PURCHASE',
    eventDate: { precision: 'YEAR', year: 2024 },
  });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'NOT_FOUND_OR_FORBIDDEN');
  assert.equal(rows.length, 0);
  await api.close();
});
