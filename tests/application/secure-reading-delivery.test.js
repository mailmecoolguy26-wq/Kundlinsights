'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { InMemoryReadingRepository } = require('../../src/persistence');
const { SecureReadingService } = require('../../src/application/readings');
const { ReadingPayloadCodec } = require('../../src/security/crypto');

const principal = (subject) => ({ provider: 'supabase', subject, isAnonymous: false });

function record(readingId, createdAt, sentence) {
  return {
    schemaVersion: 'kundlinsights-reading-record-v1', readingId, domain: 'CAREER', createdAt,
    engineProfileId: 'kundlinsights-vedic-engine-profile-v2',
    input: { readingInstant: createdAt, locale: 'en-IN' }, provenance: {}, reading: { internalEvidence: 'not-public' },
    renderedReading: { domain: 'CAREER', locale: 'en-IN', sections: [{ section: 'CAREER_STRUCTURE', headline: 'Career structure', items: [{ sentence }] }] },
    integrity: { calculation: { algorithm: 'sha256', digest: 'a'.repeat(64) }, output: { algorithm: 'sha256', digest: 'b'.repeat(64) }, rendered: { algorithm: 'sha256', digest: 'c'.repeat(64) } },
  };
}

function setup() {
  const readings = new InMemoryReadingRepository();
  readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: record('reading-a-old', '2026-08-17T00:00:00.000Z', 'Older stored content.') });
  readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: record('reading-a-new', '2026-08-18T00:00:00.000Z', 'Newer stored content.') });
  readings.insertReadingRecord({ userId: 'user-b', birthProfileId: 'profile-b', record: record('reading-b-own', '2026-08-19T00:00:00.000Z', 'Private content.') });
  const calls = { generator: 0, entitlement: 0, replay: 0 };
  const service = new SecureReadingService({
    authUserResolver: async (value) => ({ id: value.subject === 'subject-a' ? 'user-a' : 'user-b', status: 'active' }),
    transactionExecutor: { execute: async ({ operation }) => operation({}) },
    repositories: () => ({ birthProfiles: {}, readings, entitlements: {} }),
    secureBirthProfileLoader: { get: async ({ principal: value, birthProfileId }) => {
      if ((value.subject === 'subject-a' && birthProfileId === 'profile-a') || (value.subject === 'subject-b' && birthProfileId === 'profile-b')) return { id: birthProfileId, status: 'active' };
      const error = new Error(); error.code = 'NOT_FOUND_OR_FORBIDDEN'; throw error;
    } },
    readingGenerator: { generate: async () => { calls.generator += 1; throw new Error('not used'); } },
    readingRecordFactory: () => { throw new Error('not used'); },
    replayReading: async () => { calls.replay += 1; throw new Error('not used'); },
    requiresEntitlement: () => { calls.entitlement += 1; return true; }, idGenerator: () => 'unused', clock: () => '2026-08-20T00:00:00.000Z',
  });
  return { service, calls, readings };
}

test('API-P5C2 service lists bounded owned summaries newest-first and verifies an optional birth profile filter', async () => {
  const { service, calls } = setup();
  const listed = await service.listSecureReadings({ principal: principal('subject-a') });
  assert.deepEqual(listed.map((item) => item.readingId), ['reading-a-new', 'reading-a-old']);
  assert.equal(JSON.stringify(listed).includes('content'), false); assert.equal(JSON.stringify(listed).includes('internalEvidence'), false);
  assert.deepEqual(await service.listSecureReadings({ principal: principal('subject-a'), birthProfileId: 'profile-a' }), listed);
  await assert.rejects(service.listSecureReadings({ principal: principal('subject-a'), birthProfileId: 'profile-b' }), (error) => error && error.code === 'NOT_FOUND_OR_FORBIDDEN');
  assert.deepEqual(calls, { generator: 0, entitlement: 0, replay: 0 });
});

test('API-P5C2 service returns exactly the newest fifty readings and uses reading ID ascending as the created-at tie-breaker', async () => {
  const { service, readings } = setup();
  for (let index = 0; index <= 50; index += 1) {
    readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: record(`limit-${String(index).padStart(2, '0')}`, new Date(Date.UTC(2026, 8, 1, 0, 0, index)).toISOString(), `Stored ${index}.`) });
  }
  readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: record('tie-z', '2026-10-01T00:00:00.000Z', 'Tie z.') });
  readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: record('tie-a', '2026-10-01T00:00:00.000Z', 'Tie a.') });
  const listed = await service.listSecureReadings({ principal: principal('subject-a') });
  assert.equal(listed.length, 50); assert.deepEqual(listed.slice(0, 2).map((item) => item.readingId), ['tie-a', 'tie-z']);
  assert.deepEqual(listed.slice(2).map((item) => item.readingId), Array.from({ length: 48 }, (_, offset) => `limit-${String(50 - offset).padStart(2, '0')}`));
  assert.equal(listed.some((item) => item.readingId === 'limit-02'), false);
});

test('API-P5C2 service returns only owned persisted rendered content without generation, replay, or entitlement consumption', async () => {
  const { service, calls } = setup();
  const detail = await service.getSecureReadingDetail({ principal: principal('subject-a'), readingId: 'reading-a-new' });
  assert.equal(detail.content.sections[0].items[0].sentence, 'Newer stored content.');
  assert.equal(JSON.stringify(detail).includes('internalEvidence'), false);
  await assert.rejects(service.getSecureReadingDetail({ principal: principal('subject-a'), readingId: 'reading-b-own' }), (error) => error && error.code === 'NOT_FOUND_OR_FORBIDDEN');
  assert.deepEqual(calls, { generator: 0, entitlement: 0, replay: 0 });
});

test('API-P5C2 service decrypts owned encrypted storage through the existing reading payload codec without exposing an envelope', async () => {
  const plain = record('reading-encrypted', '2026-08-20T00:00:00.000Z', 'Encrypted stored content.');
  const encodeCodec = new ReadingPayloadCodec({ userDekProvider: { current: async () => ({ keyVersion: 'test-key', dek: Buffer.alloc(32, 7) }), forVersion: async () => ({ keyVersion: 'test-key', dek: Buffer.alloc(32, 7) }) } });
  const payload = await encodeCodec.encodeRecord({ userId: 'user-a', record: plain });
  const encrypted = { readingId: plain.readingId, userId: 'user-a', birthProfileId: 'profile-a', status: 'active', archivedAt: null, idempotencyKey: null, recordMetadata: { readingId: plain.readingId, domain: plain.domain, engineProfileId: plain.engineProfileId, schemaVersion: plain.schemaVersion, createdAt: plain.createdAt, integrity: plain.integrity }, ...payload };
  let replayCalls = 0;
  const service = new SecureReadingService({
    authUserResolver: async () => ({ id: 'user-a', status: 'active' }), transactionExecutor: { execute: async ({ operation }) => operation({}) },
    repositories: () => ({ birthProfiles: {}, entitlements: {}, readings: { getEncryptedReadingRecord: async () => encrypted, listEncryptedReadingRecordsForUser: async () => [encrypted] } }),
    readingCryptoCoordinator: { current: async () => ({ keyVersion: 'test-key', dek: Buffer.alloc(32, 7) }), forVersion: async () => ({ keyVersion: 'test-key', dek: Buffer.alloc(32, 7) }) },
    readingGenerator: { generate: async () => { throw new Error('not used'); } }, readingRecordFactory: () => { throw new Error('not used'); }, replayReading: async () => { replayCalls += 1; }, requiresEntitlement: () => false, idGenerator: () => 'unused', clock: () => '2026-08-20T00:00:00.000Z',
  });
  const detail = await service.getSecureReadingDetail({ principal: principal('subject-a'), readingId: plain.readingId });
  const list = await service.listSecureReadings({ principal: principal('subject-a') });
  assert.equal(detail.content.sections[0].items[0].sentence, 'Encrypted stored content.'); assert.deepEqual(list.map((item) => item.readingId), [plain.readingId]);
  assert.equal(JSON.stringify({ detail, list }).match(/ciphertext|nonce|keyVersion|userId/g), null); assert.equal(replayCalls, 0);
});
