'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { InMemoryUserRepository, InMemoryBirthProfileRepository, InMemoryReadingRepository, InMemoryEntitlementRepository } = require('../../src/persistence');
const { SecureReadingService } = require('../../src/application/readings');
const T0 = '2026-08-13T00:00:00.000Z';
const principal = (subject, extra = {}) => ({ provider: 'supabase', subject, isAnonymous: false, ...extra });
const birthData = Object.freeze({ localDate: '1990-11-26', localTime: '13:40:00', timezone: 'Asia/Kolkata', utc: '1990-11-26T08:10:00.000Z', latitude: 17.385, longitude: 78.4867, timezoneProvenance: { provider: 'test', datasetVersion: '2026c', datasetChecksum: 'test' } });
function record({ readingId, createdAt, input, result }) { return { schemaVersion: 'kundlinsights-reading-record-v1', readingId, domain: result.domain, createdAt, engineProfileId: 'kundlinsights-vedic-engine-profile-v2', input, provenance: { timezone: { datasetVersion: '2026c' }, dasha: { dashaRulesetId: 'vimshottari-longitude-proportional-solar-return-v1' } }, reading: { result: result.value }, renderedReading: null, integrity: { calculation: { algorithm: 'sha256', digest: 'a'.repeat(64) }, output: { algorithm: 'sha256', digest: 'b'.repeat(64) }, rendered: null } }; }
function setup({ entitlement = 1, generatorFails = false, insertFails = false, secureBirthProfileLoader = null, requiresEntitlement = () => true } = {}) {
  const users = new InMemoryUserRepository(); const profiles = new InMemoryBirthProfileRepository(); const readings = new InMemoryReadingRepository(); const entitlements = new InMemoryEntitlementRepository();
  users.createUser({ id: 'user-a', authSubject: 'subject-a', status: 'active', createdAt: T0 }); users.createUser({ id: 'user-b', authSubject: 'subject-b', status: 'active', createdAt: T0 });
  profiles.createBirthProfile({ id: 'profile-a', userId: 'user-a', birthData, createdAt: T0 }); profiles.createBirthProfile({ id: 'profile-b', userId: 'user-b', birthData, createdAt: T0 });
  entitlements.createEntitlement({ id: 'ent-a', userId: 'user-a', productKey: 'CAREER', status: 'active', quantity: entitlement, validFrom: T0, createdAt: T0 });
  const originalInsert = readings.insertReadingRecord.bind(readings); if (insertFails) readings.insertReadingRecord = () => { const error = new Error(); error.code = 'INSERT_FAILED'; throw error; };
  let next = 0; const service = new SecureReadingService({
    authUserResolver: async (p) => users.getUserByAuthSubject(p.subject), transactionExecutor: { execute: async ({ role, operation }) => { const readingSnapshot = new Map(readings.readings); const entitlementSnapshot = new Map(entitlements.entitlements); try { return await operation({ setRole: async () => {}, role }); } catch (error) { readings.readings = readingSnapshot; entitlements.entitlements = entitlementSnapshot; throw error; } } },
    repositories: () => ({ birthProfiles: profiles, readings, entitlements }), secureBirthProfileLoader,
    readingGenerator: { generate: async ({ birthProfile, domain }) => { if (generatorFails) throw new Error('bad'); return { input: { birth: { ...birthProfile.birthData, placeResolution: { resolutionVersion: 'test', timezoneResolver: birthProfile.birthData.timezoneProvenance }, display: null }, readingInstant: T0, transitScanRange: null, locale: 'en-IN' }, result: { domain, value: 'generated' } }; } },
    readingRecordFactory: record, replayReading: async ({ record: value }) => ({ result: { domain: value.domain } }), requiresEntitlement, idGenerator: () => `reading-${++next}-abcdefgh`, clock: () => T0,
  });
  return { service, readings, entitlements, originalInsert };
}
function rejects(promise, code) { return assert.rejects(promise, (error) => error && error.code === code); }

test('SEC-P6 generates an owned reading once, consumes entitlement once, and returns the idempotent result', async () => {
  const { service, readings, entitlements } = setup(); const request = { principal: principal('subject-a'), birthProfileId: 'profile-a', domain: 'CAREER', idempotencyKey: 'request-a', readingInstant: T0, locale: 'en-IN' };
  const first = await service.generateSecureReading(request); const retry = await service.generateSecureReading(request);
  assert.equal(first.readingId, retry.readingId); assert.equal(entitlements.getEntitlement('ent-a').quantity, 0); assert.equal(readings.listReadingRecordsForUser('user-a').length, 1); assert.equal('userId' in first, false);
});
test('SEC-P6 blocks anonymous, disabled/wrong-owner, exhausted, generation-failed, and persistence-failed requests without consuming entitlement', async () => {
  const request = { principal: principal('subject-a'), birthProfileId: 'profile-a', domain: 'CAREER', idempotencyKey: 'request-b', readingInstant: T0, locale: 'en-IN' };
  await rejects(setup().service.generateSecureReading({ ...request, principal: { ...principal('subject-a'), isAnonymous: true } }), 'ANONYMOUS_AUTH_NOT_ALLOWED');
  await rejects(setup().service.generateSecureReading({ ...request, birthProfileId: 'profile-b' }), 'NOT_FOUND_OR_FORBIDDEN');
  const exhausted = setup({ entitlement: 0 }); await rejects(exhausted.service.generateSecureReading(request), 'ENTITLEMENT_EXHAUSTED'); assert.equal(exhausted.entitlements.getEntitlement('ent-a').quantity, 0);
  const generation = setup({ generatorFails: true }); await rejects(generation.service.generateSecureReading(request), 'READING_GENERATION_FAILED'); assert.equal(generation.entitlements.getEntitlement('ent-a').quantity, 1);
  const persistence = setup({ insertFails: true }); await rejects(persistence.service.generateSecureReading(request), 'READING_PERSISTENCE_FAILED'); assert.equal(persistence.entitlements.getEntitlement('ent-a').quantity, 1);
});
test('SEC-P6 secure fetch/replay returns only owned decrypted readings and never ciphertext/key metadata', async () => {
  const { service } = setup(); const made = await service.generateSecureReading({ principal: principal('subject-a'), birthProfileId: 'profile-a', domain: 'CAREER', idempotencyKey: 'request-c', readingInstant: T0, locale: 'en-IN' });
  const fetched = await service.getSecureReading({ principal: principal('subject-a'), readingId: made.readingId }); assert.equal(fetched.record.reading.result, 'generated'); assert.equal(JSON.stringify(fetched).includes('ciphertext'), false);
  await rejects(service.getSecureReading({ principal: principal('subject-b'), readingId: made.readingId }), 'NOT_FOUND_OR_FORBIDDEN');
  assert.equal((await service.replaySecureReading({ principal: principal('subject-a'), readingId: made.readingId, astronomicalRuntime: {} })).replay.result.domain, 'CAREER');
});
test('SEC-P6 uses an injected secure profile loader before generation and does not consume entitlement when it fails', async () => {
  const calls = []; const loader = { get: async ({ principal: value, birthProfileId }) => { calls.push([value.subject, birthProfileId]); return { id: birthProfileId, displayLabel: null, birthData, status: 'active', createdAt: T0, updatedAt: T0 }; } };
  const working = setup({ secureBirthProfileLoader: loader });
  await working.service.generateSecureReading({ principal: principal('subject-a'), birthProfileId: 'profile-a', domain: 'CAREER', idempotencyKey: 'loader-ok', readingInstant: T0, locale: 'en-IN' });
  assert.deepEqual(calls, [['subject-a', 'profile-a']]);
  const failed = setup({ secureBirthProfileLoader: { get: async () => { const error = new Error(); error.code = 'NOT_FOUND_OR_FORBIDDEN'; throw error; } } });
  await rejects(failed.service.generateSecureReading({ principal: principal('subject-a'), birthProfileId: 'profile-a', domain: 'CAREER', idempotencyKey: 'loader-fail', readingInstant: T0, locale: 'en-IN' }), 'NOT_FOUND_OR_FORBIDDEN');
  assert.equal(failed.entitlements.getEntitlement('ent-a').quantity, 1);
});
test('SEC-P6 rechecks a user-scoped idempotency winner inside the final transaction before entitlement handling', async () => {
  const { service, readings, entitlements, originalInsert } = setup(); const request = { principal: principal('subject-a'), birthProfileId: 'profile-a', domain: 'CAREER', idempotencyKey: 'final-winner', readingInstant: T0, locale: 'en-IN' };
  const lookup = readings.getReadingRecordByIdempotencyKey.bind(readings); let lookups = 0; let entitlementLookups = 0; let consumes = 0;
  readings.getReadingRecordByIdempotencyKey = (userId, key) => { lookups += 1; if (lookups === 2) originalInsert({ userId, birthProfileId: 'profile-a', idempotencyKey: key, record: record({ readingId: 'winner-abcdefgh', createdAt: T0, input: { birth: { ...birthData }, readingInstant: T0 }, result: { domain: 'CAREER', value: 'winner' } }) }); return lookup(userId, key); };
  entitlements.listActiveEntitlementsForUser = () => { entitlementLookups += 1; throw new Error('must not check entitlement'); };
  entitlements.consumeEntitlement = () => { consumes += 1; throw new Error('must not consume entitlement'); };
  readings.insertReadingRecord = () => { throw new Error('must not insert candidate'); };
  const result = await service.generateSecureReading(request);
  assert.equal(result.readingId, 'winner-abcdefgh'); assert.equal(entitlementLookups, 0); assert.equal(consumes, 0); assert.equal(readings.listReadingRecordsForUser('user-a').length, 1);
});
test('SEC-P6 retains duplicate-insert recovery and never returns another user’s same idempotency key', async () => {
  const fallback = setup({ requiresEntitlement: () => false }); const fallbackRequest = { principal: principal('subject-a'), birthProfileId: 'profile-a', domain: 'CAREER', idempotencyKey: 'duplicate-race', readingInstant: T0, locale: 'en-IN' };
  const lookup = fallback.readings.getReadingRecordByIdempotencyKey.bind(fallback.readings); let lookups = 0;
  const raceWinner = { readingId: 'race-winner-abcdefgh', userId: 'user-a', birthProfileId: 'profile-a', status: 'active', archivedAt: null, idempotencyKey: 'duplicate-race', record: record({ readingId: 'race-winner-abcdefgh', createdAt: T0, input: { birth: { ...birthData }, readingInstant: T0 }, result: { domain: 'CAREER', value: 'winner' } }) };
  fallback.readings.getReadingRecordByIdempotencyKey = (userId, key) => { lookups += 1; return lookups === 3 ? raceWinner : lookup(userId, key); };
  fallback.readings.insertReadingRecord = () => { const error = new Error(); error.code = 'DUPLICATE_READING_IDEMPOTENCY_KEY'; throw error; };
  assert.equal((await fallback.service.generateSecureReading(fallbackRequest)).readingId, 'race-winner-abcdefgh');
  const scoped = setup(); scoped.originalInsert({ userId: 'user-b', birthProfileId: 'profile-b', idempotencyKey: 'shared-key', record: record({ readingId: 'user-b-winner-abcdefgh', createdAt: T0, input: { birth: { ...birthData }, readingInstant: T0 }, result: { domain: 'CAREER', value: 'user-b' } }) });
  const result = await scoped.service.generateSecureReading({ ...fallbackRequest, idempotencyKey: 'shared-key' });
  assert.notEqual(result.readingId, 'user-b-winner-abcdefgh'); assert.equal(scoped.readings.listReadingRecordsForUser('user-a').length, 1); assert.equal(scoped.readings.listReadingRecordsForUser('user-b').length, 1);
});
test('API-P5C3 status reuses the create-reading entitlement selection authority without consuming or reserving a grant', async () => {
  const { service, entitlements } = setup(); const originalConsume = entitlements.consumeEntitlement.bind(entitlements); let consumes = 0;
  entitlements.consumeEntitlement = (...args) => { consumes += 1; return originalConsume(...args); };
  assert.deepEqual(await service.getReadingEntitlementStatus({ principal: principal('subject-a') }), { career: { eligible: true } });
  assert.equal(entitlements.getEntitlement('ent-a').quantity, 1); assert.equal(consumes, 0);
  await service.generateSecureReading({ principal: principal('subject-a'), birthProfileId: 'profile-a', domain: 'CAREER', idempotencyKey: 'status-consistency', readingInstant: T0, locale: 'en-IN' });
  assert.equal(consumes, 1); assert.deepEqual(await service.getReadingEntitlementStatus({ principal: principal('subject-a') }), { career: { eligible: false } });
});
test('API-P5C3 status excludes consumed, expired, and other-user grants while accepting multiple valid CAREER grants', async () => {
  const exhausted = setup({ entitlement: 0 });
  exhausted.entitlements.createEntitlement({ id: 'expired', userId: 'user-a', productKey: 'CAREER', status: 'active', quantity: 3, validFrom: '2026-08-12T00:00:00.000Z', validUntil: T0 });
  exhausted.entitlements.createEntitlement({ id: 'other-user', userId: 'user-b', productKey: 'CAREER', status: 'active', quantity: 3, validFrom: T0 });
  assert.deepEqual(await exhausted.service.getReadingEntitlementStatus({ principal: principal('subject-a') }), { career: { eligible: false } });
  assert.deepEqual(await exhausted.service.getReadingEntitlementStatus({ principal: principal('subject-b') }), { career: { eligible: true } });
  exhausted.entitlements.createEntitlement({ id: 'second-valid', userId: 'user-a', productKey: 'CAREER', status: 'active', quantity: 2, validFrom: T0 });
  assert.deepEqual(await exhausted.service.getReadingEntitlementStatus({ principal: principal('subject-a') }), { career: { eligible: true } });
});
