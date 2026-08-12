'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { UserDekProvider, BirthProfilePayloadCodec, ReadingPayloadCodec, ALGORITHM, AUTH_TAG_BYTES } = require('../../../src/security/crypto');
const { TestOnlyKms, TestOnlyKeyEnvelopeStore } = require('./test-only-kms');

function fixture() {
  const kms = new TestOnlyKms(); const envelopes = new TestOnlyKeyEnvelopeStore(); const deks = new UserDekProvider({ kms, envelopeStore: envelopes });
  deks.provisionCurrent('user-a');
  return { kms, envelopes, deks, births: new BirthProfilePayloadCodec({ userDekProvider: deks }), readings: new ReadingPayloadCodec({ userDekProvider: deks }) };
}
function record(renderedReading = { text: 'Career reading' }) { return { schemaVersion: 'kundlinsights-reading-record-v1', readingId: 'reading-a', domain: 'CAREER', createdAt: '2026-08-12T00:00:00.000Z', engineProfileId: 'kundlinsights-vedic-engine-profile-v2', input: { place: 'Hyderabad' }, provenance: { provider: 'Swiss' }, reading: { conclusion: 'deterministic' }, renderedReading, integrity: { calculation: { algorithm: 'sha256', digest: 'a'.repeat(64) }, output: { algorithm: 'sha256', digest: 'b'.repeat(64) }, rendered: renderedReading === null ? null : { algorithm: 'sha256', digest: 'c'.repeat(64) } } }; }
function readInput(encoded, rec = record()) { return { userId: 'user-a', ...encoded, recordMetadata: { readingId: rec.readingId, schemaVersion: rec.schemaVersion, domain: rec.domain, createdAt: rec.createdAt, engineProfileId: rec.engineProfileId, integrity: rec.integrity } }; }

test('production codecs use AES-256-GCM with a 16-byte tag at the end and preserve exact semantic values', () => {
  const { births, readings } = fixture(); const birth = { timezone: 'Asia/Kolkata', latitude: 17.385, longitude: 78.4867 };
  const first = births.encodeBirthData({ userId: 'user-a', profileId: 'profile-a', birthData: birth });
  const second = births.encodeBirthData({ userId: 'user-a', profileId: 'profile-a', birthData: birth });
  assert.equal(first.algorithm, ALGORITHM); assert.equal(first.ciphertext.length > AUTH_TAG_BYTES, true); assert.notDeepEqual(first.nonce, second.nonce);
  assert.deepEqual(births.decodeBirthData({ userId: 'user-a', profileId: 'profile-a', ...first }), birth);
  const rec = record(); const encrypted = readings.encodeRecord({ userId: 'user-a', record: rec });
  const decoded = readings.decodeRecord(readInput(encrypted, rec));
  assert.deepEqual(decoded.input, rec.input); assert.deepEqual(decoded.provenance, rec.provenance); assert.deepEqual(decoded.reading, rec.reading); assert.deepEqual(decoded.integrity, rec.integrity);
});

test('AAD rejects ciphertext tampering, wrong user/entity, and protected field swaps', () => {
  const { births, readings } = fixture(); const encryptedBirth = births.encodeBirthData({ userId: 'user-a', profileId: 'profile-a', birthData: { x: 1 } });
  const tampered = { ...encryptedBirth, ciphertext: Buffer.from(encryptedBirth.ciphertext) }; tampered.ciphertext[0] ^= 1;
  assert.throws(() => births.decodeBirthData({ userId: 'user-a', profileId: 'profile-a', ...tampered }), (e) => e.code === 'AUTHENTICATION_FAILED');
  const tagTampered = { ...encryptedBirth, ciphertext: Buffer.from(encryptedBirth.ciphertext) }; tagTampered.ciphertext[tagTampered.ciphertext.length - 1] ^= 1;
  assert.throws(() => births.decodeBirthData({ userId: 'user-a', profileId: 'profile-a', ...tagTampered }), (e) => e.code === 'AUTHENTICATION_FAILED');
  const nonceTampered = { ...encryptedBirth, nonce: Buffer.from(encryptedBirth.nonce) }; nonceTampered.nonce[0] ^= 1;
  assert.throws(() => births.decodeBirthData({ userId: 'user-a', profileId: 'profile-a', ...nonceTampered }), (e) => e.code === 'AUTHENTICATION_FAILED');
  assert.throws(() => births.decodeBirthData({ userId: 'wrong-user', profileId: 'profile-a', ...encryptedBirth }), (e) => e.code === 'DEK_NOT_AVAILABLE');
  assert.throws(() => births.decodeBirthData({ userId: 'user-a', profileId: 'profile-b', ...encryptedBirth }), (e) => e.code === 'AUTHENTICATION_FAILED');
  const rec = record(); const encrypted = readings.encodeRecord({ userId: 'user-a', record: rec });
  assert.throws(() => readings.decodeRecord(readInput({ ...encrypted, structuredReadingCiphertext: encrypted.provenanceCiphertext, structuredReadingNonce: encrypted.provenanceNonce }, rec)), (e) => e.code === 'AUTHENTICATION_FAILED');
});

test('codec rejects unsupported formats, malformed authentication payloads, and an unavailable DEK without leaking crypto details', () => {
  const { births } = fixture(); const encrypted = births.encodeBirthData({ userId: 'user-a', profileId: 'profile-a', birthData: {} });
  assert.throws(() => births.decodeBirthData({ userId: 'user-a', profileId: 'profile-a', ...encrypted, algorithm: 'AES' }), (e) => e.code === 'UNSUPPORTED_ENCRYPTION_ALGORITHM');
  assert.throws(() => births.decodeBirthData({ userId: 'user-a', profileId: 'profile-a', ...encrypted, encryptionVersion: 99 }), (e) => e.code === 'UNSUPPORTED_ENCRYPTION_VERSION');
  assert.throws(() => births.decodeBirthData({ userId: 'user-a', profileId: 'profile-a', ...encrypted, ciphertext: Buffer.alloc(15) }), (e) => e.code === 'INVALID_ENCRYPTION_PAYLOAD');
  assert.throws(() => births.decodeBirthData({ userId: 'user-a', profileId: 'profile-a', ...encrypted, keyVersion: 'unavailable' }), (e) => e.code === 'DEK_NOT_AVAILABLE');
});

test('reading rendered null remains null and versioned user DEKs decrypt old and new records across rotation', () => {
  const { kms, deks, readings } = fixture(); const nullRecord = record(null); const nullEncrypted = readings.encodeRecord({ userId: 'user-a', record: nullRecord });
  assert.equal(nullEncrypted.renderedReadingCiphertext, null); assert.equal(readings.decodeRecord(readInput(nullEncrypted, nullRecord)).renderedReading, null);
  const oldRecord = record(); const oldEncrypted = readings.encodeRecord({ userId: 'user-a', record: oldRecord });
  kms.setCurrentKeyVersion('test-kek-v2'); deks.provisionCurrent('user-a');
  const newRecord = { ...record(), readingId: 'reading-b' }; const newEncrypted = readings.encodeRecord({ userId: 'user-a', record: newRecord });
  assert.equal(oldEncrypted.payloadKeyVersion, 'test-kek-v1'); assert.equal(newEncrypted.payloadKeyVersion, 'test-kek-v2');
  assert.deepEqual(readings.decodeRecord(readInput(oldEncrypted, oldRecord)).integrity, oldRecord.integrity);
  assert.deepEqual(readings.decodeRecord(readInput(oldEncrypted, oldRecord)).reading, oldRecord.reading);
  assert.deepEqual(readings.decodeRecord(readInput(newEncrypted, newRecord)).reading, newRecord.reading);
});

test('production crypto exports no test-only KMS implementation', () => {
  const exported = require('../../../src/security/crypto');
  assert.equal('TestOnlyKms' in exported, false); assert.equal('TestOnlyKeyEnvelopeStore' in exported, false);
});
