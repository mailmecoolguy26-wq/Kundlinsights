'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { UserDekProvider, BirthProfilePayloadCodec, ReadingPayloadCodec, ALGORITHM, AUTH_TAG_BYTES } = require('../../../src/security/crypto');
const { TestOnlyKms, TestOnlyKeyEnvelopeStore } = require('./test-only-kms');

async function fixture() {
  const kms = new TestOnlyKms(); const envelopes = new TestOnlyKeyEnvelopeStore(); const deks = new UserDekProvider({ kms, envelopeStore: envelopes });
  await deks.provisionCurrent('user-a');
  return { kms, envelopes, deks, births: new BirthProfilePayloadCodec({ userDekProvider: deks }), readings: new ReadingPayloadCodec({ userDekProvider: deks }) };
}
function record(renderedReading = { text: 'Career reading' }) { return { schemaVersion: 'kundlinsights-reading-record-v1', readingId: 'reading-a', domain: 'CAREER', createdAt: '2026-08-12T00:00:00.000Z', engineProfileId: 'kundlinsights-vedic-engine-profile-v2', input: { place: 'Hyderabad' }, provenance: { provider: 'Swiss' }, reading: { conclusion: 'deterministic' }, renderedReading, integrity: { calculation: { algorithm: 'sha256', digest: 'a'.repeat(64) }, output: { algorithm: 'sha256', digest: 'b'.repeat(64) }, rendered: renderedReading === null ? null : { algorithm: 'sha256', digest: 'c'.repeat(64) } } }; }
function readInput(encoded, rec = record()) { return { userId: 'user-a', ...encoded, recordMetadata: { readingId: rec.readingId, schemaVersion: rec.schemaVersion, domain: rec.domain, createdAt: rec.createdAt, engineProfileId: rec.engineProfileId, integrity: rec.integrity } }; }

test('production codecs use AES-256-GCM with a 16-byte tag at the end and preserve exact semantic values', async () => {
  const { births, readings } = await fixture(); const birth = { timezone: 'Asia/Kolkata', latitude: 17.385, longitude: 78.4867 };
  const first = await births.encodeBirthData({ userId: 'user-a', profileId: 'profile-a', birthData: birth });
  const second = await births.encodeBirthData({ userId: 'user-a', profileId: 'profile-a', birthData: birth });
  assert.equal(first.algorithm, ALGORITHM); assert.equal(first.ciphertext.length > AUTH_TAG_BYTES, true); assert.notDeepEqual(first.nonce, second.nonce);
  assert.deepEqual(await births.decodeBirthData({ userId: 'user-a', profileId: 'profile-a', ...first }), birth);
  const rec = record(); const encrypted = await readings.encodeRecord({ userId: 'user-a', record: rec });
  const decoded = await readings.decodeRecord(readInput(encrypted, rec));
  assert.deepEqual(decoded.input, rec.input); assert.deepEqual(decoded.provenance, rec.provenance); assert.deepEqual(decoded.reading, rec.reading); assert.deepEqual(decoded.integrity, rec.integrity);
});

test('AAD rejects ciphertext tampering, wrong user/entity, and protected field swaps', async () => {
  const { births, readings } = await fixture(); const encryptedBirth = await births.encodeBirthData({ userId: 'user-a', profileId: 'profile-a', birthData: { x: 1 } });
  const tampered = { ...encryptedBirth, ciphertext: Buffer.from(encryptedBirth.ciphertext) }; tampered.ciphertext[0] ^= 1;
  await assert.rejects(births.decodeBirthData({ userId: 'user-a', profileId: 'profile-a', ...tampered }), (e) => e.code === 'AUTHENTICATION_FAILED');
  const tagTampered = { ...encryptedBirth, ciphertext: Buffer.from(encryptedBirth.ciphertext) }; tagTampered.ciphertext[tagTampered.ciphertext.length - 1] ^= 1;
  await assert.rejects(births.decodeBirthData({ userId: 'user-a', profileId: 'profile-a', ...tagTampered }), (e) => e.code === 'AUTHENTICATION_FAILED');
  const nonceTampered = { ...encryptedBirth, nonce: Buffer.from(encryptedBirth.nonce) }; nonceTampered.nonce[0] ^= 1;
  await assert.rejects(births.decodeBirthData({ userId: 'user-a', profileId: 'profile-a', ...nonceTampered }), (e) => e.code === 'AUTHENTICATION_FAILED');
  await assert.rejects(births.decodeBirthData({ userId: 'wrong-user', profileId: 'profile-a', ...encryptedBirth }), (e) => e.code === 'DEK_NOT_AVAILABLE');
  await assert.rejects(births.decodeBirthData({ userId: 'user-a', profileId: 'profile-b', ...encryptedBirth }), (e) => e.code === 'AUTHENTICATION_FAILED');
  const rec = record(); const encrypted = await readings.encodeRecord({ userId: 'user-a', record: rec });
  await assert.rejects(readings.decodeRecord(readInput({ ...encrypted, structuredReadingCiphertext: encrypted.provenanceCiphertext, structuredReadingNonce: encrypted.provenanceNonce }, rec)), (e) => e.code === 'AUTHENTICATION_FAILED');
});

test('codec rejects unsupported formats, malformed authentication payloads, and an unavailable DEK without leaking crypto details', async () => {
  const { births } = await fixture(); const encrypted = await births.encodeBirthData({ userId: 'user-a', profileId: 'profile-a', birthData: {} });
  await assert.rejects(births.decodeBirthData({ userId: 'user-a', profileId: 'profile-a', ...encrypted, algorithm: 'AES' }), (e) => e.code === 'UNSUPPORTED_ENCRYPTION_ALGORITHM');
  await assert.rejects(births.decodeBirthData({ userId: 'user-a', profileId: 'profile-a', ...encrypted, encryptionVersion: 99 }), (e) => e.code === 'UNSUPPORTED_ENCRYPTION_VERSION');
  await assert.rejects(births.decodeBirthData({ userId: 'user-a', profileId: 'profile-a', ...encrypted, ciphertext: Buffer.alloc(15) }), (e) => e.code === 'INVALID_ENCRYPTION_PAYLOAD');
  await assert.rejects(births.decodeBirthData({ userId: 'user-a', profileId: 'profile-a', ...encrypted, keyVersion: 'unavailable' }), (e) => e.code === 'DEK_NOT_AVAILABLE');
});

test('reading rendered null remains null and versioned user DEKs decrypt old and new records across rotation', async () => {
  const { kms, deks, readings } = await fixture(); const nullRecord = record(null); const nullEncrypted = await readings.encodeRecord({ userId: 'user-a', record: nullRecord });
  assert.equal(nullEncrypted.renderedReadingCiphertext, null); assert.equal((await readings.decodeRecord(readInput(nullEncrypted, nullRecord))).renderedReading, null);
  const oldRecord = record(); const oldEncrypted = await readings.encodeRecord({ userId: 'user-a', record: oldRecord });
  kms.setCurrentKeyVersion('test-kek-v2'); await deks.rotateUserDek('user-a');
  const newRecord = { ...record(), readingId: 'reading-b' }; const newEncrypted = await readings.encodeRecord({ userId: 'user-a', record: newRecord });
  assert.equal(oldEncrypted.payloadKeyVersion, 'test-kek-v1'); assert.equal(newEncrypted.payloadKeyVersion, 'test-kek-v2');
  assert.deepEqual((await readings.decodeRecord(readInput(oldEncrypted, oldRecord))).integrity, oldRecord.integrity);
  assert.deepEqual((await readings.decodeRecord(readInput(oldEncrypted, oldRecord))).reading, oldRecord.reading);
  assert.deepEqual((await readings.decodeRecord(readInput(newEncrypted, newRecord))).reading, newRecord.reading);
});

test('production crypto exports no test-only KMS implementation', () => {
  const exported = require('../../../src/security/crypto');
  assert.equal('TestOnlyKms' in exported, false); assert.equal('TestOnlyKeyEnvelopeStore' in exported, false);
});
