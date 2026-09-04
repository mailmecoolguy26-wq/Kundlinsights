'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DevelopmentCareerEntitlementFixture } = require('../../src/runtime/development-career-entitlement-fixture');
const { InMemoryUserRepository, InMemoryBirthProfileRepository, InMemoryReadingRepository, InMemoryEntitlementRepository } = require('../../src/persistence');
const { SecureReadingService } = require('../../src/application/readings');
const T0 = '2026-08-24T00:00:00.000Z';
const principal = (subject, isAnonymous = false) => ({ provider: 'supabase', subject, isAnonymous });

function fixtureSetup() {
  const users = new InMemoryUserRepository(); const entitlements = new InMemoryEntitlementRepository();
  users.createUser({ id: 'user-a', authSubject: 'subject-a', status: 'active', createdAt: T0 });
  users.createUser({ id: 'user-b', authSubject: 'subject-b', status: 'active', createdAt: T0 });
  let next = 0;
  const fixture = new DevelopmentCareerEntitlementFixture({
    authUserResolver: async (value) => users.getUserByAuthSubject(value.subject),
    transactionExecutor: { execute: async ({ principal: value, role, operation }) => { assert.equal(role, 'app_worker'); return operation({ db: { subject: value.subject } }); } },
    entitlementRepositoryFactory: () => entitlements, idGenerator: () => `dev-entitlement-${++next}`, clock: () => T0,
  });
  return { fixture, entitlements };
}

test('development fixture authorizes only the verified principal and idempotently creates CAREER', async () => {
  const { fixture, entitlements } = fixtureSetup();
  await assert.rejects(fixture.ensureCareerEntitlementForAuthenticatedDevUser({ authenticatedPrincipal: principal('subject-a', true) }), (error) => error.code === 'ANONYMOUS_AUTH_NOT_ALLOWED');
  const first = await fixture.ensureCareerEntitlementForAuthenticatedDevUser({ authenticatedPrincipal: principal('subject-a'), userId: 'user-b', productKey: 'OTHER' });
  const second = await fixture.ensureCareerEntitlementForAuthenticatedDevUser({ authenticatedPrincipal: principal('subject-a') });
  const userB = await fixture.ensureCareerEntitlementForAuthenticatedDevUser({ authenticatedPrincipal: principal('subject-b') });
  assert.equal(first.created, true); assert.equal(second.created, false); assert.equal(userB.created, true);
  assert.equal(first.entitlement.userId, 'user-a'); assert.equal(first.entitlement.productKey, 'CAREER'); assert.equal(first.entitlement.quantity, 1);
  assert.equal(entitlements.listActiveEntitlementsForUser('user-a', T0).length, 1); assert.equal(entitlements.listActiveEntitlementsForUser('user-b', T0).length, 1);
});

test('fixture grant satisfies normal Career reading consumption and same-key replay semantics', async () => {
  const { fixture, entitlements } = fixtureSetup(); const profiles = new InMemoryBirthProfileRepository(); const readings = new InMemoryReadingRepository();
  const birthData = { localDate: '1990-08-15', localTime: '14:30:00', timezone: 'Asia/Kolkata', utc: '1990-08-15T09:00:00.000Z', latitude: 19.076, longitude: 72.8777, timezoneProvenance: { provider: 'test', datasetVersion: 'test', datasetChecksum: 'test' } };
  profiles.createBirthProfile({ id: 'profile-a', userId: 'user-a', birthData, createdAt: T0 });
  await fixture.ensureCareerEntitlementForAuthenticatedDevUser({ authenticatedPrincipal: principal('subject-a') });
  const service = new SecureReadingService({
    authUserResolver: async () => ({ id: 'user-a', status: 'active' }), transactionExecutor: { execute: async ({ operation }) => operation({}) },
    repositories: () => ({ birthProfiles: profiles, readings, entitlements }),
    readingGenerator: { generate: async ({ domain }) => ({ input: { readingInstant: T0, locale: 'en-IN' }, result: { domain } }) },
    readingRecordFactory: ({ readingId, createdAt, input, result }) => ({ schemaVersion: 'kundlinsights-reading-record-v1', readingId, domain: result.domain, createdAt, engineProfileId: 'kundlinsights-vedic-engine-profile-v2', input, provenance: {}, reading: {}, renderedReading: null, integrity: { calculation: { algorithm: 'sha256', digest: 'a'.repeat(64) }, output: { algorithm: 'sha256', digest: 'b'.repeat(64) }, rendered: null } }),
    replayReading: async () => ({}), requiresEntitlement: () => true, idGenerator: () => 'reading-a', clock: () => T0,
  });
  assert.deepEqual(await service.getReadingEntitlementStatus({ principal: principal('subject-a'), birthProfileId: 'profile-a' }), { career: { eligible: true, mode: 'CREDIT', consuming: true } });
  const request = { principal: principal('subject-a'), birthProfileId: 'profile-a', domain: 'CAREER', idempotencyKey: 'dev-fixture-reading' };
  const first = await service.generateSecureReading(request); const replay = await service.generateSecureReading(request);
  assert.equal(first.readingId, replay.readingId); assert.equal(readings.listReadingRecordsForUser('user-a').length, 1);
  assert.equal(entitlements.listActiveEntitlementsForUser('user-a', T0).length, 0);
});
