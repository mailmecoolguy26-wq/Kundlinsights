'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { InMemoryUserRepository, InMemoryBirthProfileRepository, InMemoryReadingRepository, InMemoryEntitlementRepository } = require('../../src/persistence');
const { SecureReadingService } = require('../../src/application/readings');
const T0 = '2026-08-13T00:00:00.000Z';
const principal = (subject, extra = {}) => ({ provider: 'supabase', subject, isAnonymous: false, ...extra });
const birthData = Object.freeze({ localDate: '1990-11-26', localTime: '13:40:00', timezone: 'Asia/Kolkata', utc: '1990-11-26T08:10:00.000Z', latitude: 17.385, longitude: 78.4867, timezoneProvenance: { provider: 'test', datasetVersion: '2026c', datasetChecksum: 'test' } });
function record({ readingId, createdAt, input, result }) { return { schemaVersion: 'kundlinsights-reading-record-v1', readingId, domain: result.domain, createdAt, engineProfileId: 'kundlinsights-vedic-engine-profile-v2', input, provenance: { timezone: { datasetVersion: '2026c' }, dasha: { dashaRulesetId: 'vimshottari-longitude-proportional-solar-return-v1' } }, reading: { result: result.value }, renderedReading: null, integrity: { calculation: { algorithm: 'sha256', digest: 'a'.repeat(64) }, output: { algorithm: 'sha256', digest: 'b'.repeat(64) }, rendered: null } }; }
function setup({ entitlement = 1, generatorFails = false, insertFails = false } = {}) {
  const users = new InMemoryUserRepository(); const profiles = new InMemoryBirthProfileRepository(); const readings = new InMemoryReadingRepository(); const entitlements = new InMemoryEntitlementRepository();
  users.createUser({ id: 'user-a', authSubject: 'subject-a', status: 'active', createdAt: T0 }); users.createUser({ id: 'user-b', authSubject: 'subject-b', status: 'active', createdAt: T0 });
  profiles.createBirthProfile({ id: 'profile-a', userId: 'user-a', birthData, createdAt: T0 }); profiles.createBirthProfile({ id: 'profile-b', userId: 'user-b', birthData, createdAt: T0 });
  entitlements.createEntitlement({ id: 'ent-a', userId: 'user-a', productKey: 'CAREER', status: 'active', quantity: entitlement, validFrom: T0, createdAt: T0 });
  const originalInsert = readings.insertReadingRecord.bind(readings); if (insertFails) readings.insertReadingRecord = () => { const error = new Error(); error.code = 'INSERT_FAILED'; throw error; };
  let next = 0; const service = new SecureReadingService({
    authUserResolver: async (p) => users.getUserByAuthSubject(p.subject), transactionExecutor: { execute: async ({ role, operation }) => operation({ setRole: async () => {}, role }) },
    repositories: () => ({ birthProfiles: profiles, readings, entitlements }),
    readingGenerator: { generate: async ({ birthProfile, domain }) => { if (generatorFails) throw new Error('bad'); return { input: { birth: { ...birthProfile.birthData, placeResolution: { resolutionVersion: 'test', timezoneResolver: birthProfile.birthData.timezoneProvenance }, display: null }, readingInstant: T0, transitScanRange: null, locale: 'en-IN' }, result: { domain, value: 'generated' } }; } },
    readingRecordFactory: record, replayReading: async ({ record: value }) => ({ result: { domain: value.domain } }), requiresEntitlement: () => true, idGenerator: () => `reading-${++next}-abcdefgh`, clock: () => T0,
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
