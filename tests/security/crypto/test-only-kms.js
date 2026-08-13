'use strict';

// Test support only. These deterministic local keys must never be imported by runtime code.
const crypto = require('node:crypto');
const { canonicalAad } = require('../../../src/security/crypto/canonical-aad');

class TestOnlyKeyEnvelopeStore {
  constructor() { this.envelopes = new Map(); }
  key({ userId, keyVersion }) { return `${userId}\u0000${keyVersion}`; }
  getActiveEnvelope({ userId }) { for (const envelope of this.envelopes.values()) if (envelope.userId === userId && envelope.status === 'active') return { ...envelope, wrappedDek: Buffer.from(envelope.wrappedDek) }; return null; }
  getEnvelopeByVersion(input) { const value = this.envelopes.get(this.key(input)); return value ? { ...value, wrappedDek: Buffer.from(value.wrappedDek) } : null; }
  insertEnvelope(input) { if (this.getActiveEnvelope({ userId: input.userId })) { const error = new Error('ACTIVE_KEY_ENVELOPE_EXISTS'); error.code = 'ACTIVE_KEY_ENVELOPE_EXISTS'; throw error; } const envelope = { ...input, wrappedDek: Buffer.from(input.wrappedDek), status: 'active' }; this.envelopes.set(this.key(input), envelope); return { ...envelope, wrappedDek: Buffer.from(envelope.wrappedDek) }; }
  rotateEnvelope(input) { let active; for (const envelope of this.envelopes.values()) if (envelope.userId === input.userId && envelope.status === 'active') { active = envelope; break; } if (!active) { const error = new Error('ACTIVE_KEY_ENVELOPE_NOT_FOUND'); error.code = 'ACTIVE_KEY_ENVELOPE_NOT_FOUND'; throw error; } active.status = 'retired'; active.retiredAt = input.createdAt; return this.insertEnvelope(input); }
}

class TestOnlyKms {
  constructor({ currentKeyVersion = 'test-kek-v1' } = {}) {
    this.currentKeyVersion = currentKeyVersion;
    this.keys = new Map([[currentKeyVersion, crypto.createHash('sha256').update(currentKeyVersion).digest()]]);
  }
  addKeyVersion(keyVersion) { this.keys.set(keyVersion, crypto.createHash('sha256').update(keyVersion).digest()); }
  setCurrentKeyVersion(keyVersion) { if (!this.keys.has(keyVersion)) this.addKeyVersion(keyVersion); this.currentKeyVersion = keyVersion; }
  getCurrentKeyVersion() { return this.currentKeyVersion; }
  getWrappingMetadata({ keyVersion }) { return { kmsKeyRef: `TEST_ONLY/${keyVersion}`, wrappingAlgorithm: 'TEST_ONLY_AES_256_GCM' }; }
  wrapDek({ userId, keyVersion, dek }) {
    const key = this.keys.get(keyVersion); if (!key) throw new Error('missing test key version');
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(canonicalAad({ entityType: 'test_key_envelope', entityId: keyVersion, userId, fieldPurpose: 'dek_wrap', encryptionVersion: 1, keyVersion }));
    return Buffer.concat([nonce, cipher.update(dek), cipher.final(), cipher.getAuthTag()]);
  }
  unwrapDek({ userId, keyVersion, wrappedDek }) {
    const key = this.keys.get(keyVersion); if (!key || !Buffer.isBuffer(wrappedDek) || wrappedDek.length < 28) throw new Error('invalid test envelope');
    const nonce = wrappedDek.subarray(0, 12); const tag = wrappedDek.subarray(-16); const body = wrappedDek.subarray(12, -16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAAD(canonicalAad({ entityType: 'test_key_envelope', entityId: keyVersion, userId, fieldPurpose: 'dek_wrap', encryptionVersion: 1, keyVersion }));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]);
  }
}

module.exports = { TestOnlyKms, TestOnlyKeyEnvelopeStore };
