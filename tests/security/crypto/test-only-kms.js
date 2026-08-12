'use strict';

// Test support only. These deterministic local keys must never be imported by runtime code.
const crypto = require('node:crypto');
const { canonicalAad } = require('../../../src/security/crypto/canonical-aad');

class TestOnlyKeyEnvelopeStore {
  constructor() { this.envelopes = new Map(); }
  key({ userId, keyVersion }) { return `${userId}\u0000${keyVersion}`; }
  getEnvelope(input) { const value = this.envelopes.get(this.key(input)); return value ? Buffer.from(value) : null; }
  putEnvelope(input) { this.envelopes.set(this.key(input), Buffer.from(input.wrappedDek)); }
}

class TestOnlyKms {
  constructor({ currentKeyVersion = 'test-kek-v1' } = {}) {
    this.currentKeyVersion = currentKeyVersion;
    this.keys = new Map([[currentKeyVersion, crypto.createHash('sha256').update(currentKeyVersion).digest()]]);
  }
  addKeyVersion(keyVersion) { this.keys.set(keyVersion, crypto.createHash('sha256').update(keyVersion).digest()); }
  setCurrentKeyVersion(keyVersion) { if (!this.keys.has(keyVersion)) this.addKeyVersion(keyVersion); this.currentKeyVersion = keyVersion; }
  getCurrentKeyVersion() { return this.currentKeyVersion; }
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
