'use strict';

const crypto = require('node:crypto');
const { canonicalAad } = require('../security/crypto/canonical-aad');

const WRAPPING_ALGORITHM = 'LOCAL_DEVELOPMENT_AES_256_GCM';

class DevelopmentLocalKms {
  constructor({ key, keyVersion = 'development-local-kek-v1' } = {}) {
    if (!Buffer.isBuffer(key) || key.length !== 32 || typeof keyVersion !== 'string' || keyVersion.length === 0) throw new TypeError('DevelopmentLocalKms requires a 32-byte local development key.');
    this.key = Buffer.from(key); this.keyVersion = keyVersion; Object.freeze(this);
  }
  getCurrentKeyVersion() { return this.keyVersion; }
  getWrappingMetadata({ keyVersion }) { return Object.freeze({ kmsKeyRef: `LOCAL_DEVELOPMENT/${keyVersion}`, wrappingAlgorithm: WRAPPING_ALGORITHM }); }
  async wrapDek({ userId, keyVersion, dek }) { return this.transform({ userId, keyVersion, dek, decrypt: false }); }
  async unwrapDek({ userId, keyVersion, kmsKeyRef, wrappingAlgorithm, wrappedDek }) { if (kmsKeyRef !== `LOCAL_DEVELOPMENT/${keyVersion}` || wrappingAlgorithm !== WRAPPING_ALGORITHM) throw new Error('Invalid local development envelope metadata.'); return this.transform({ userId, keyVersion, dek: wrappedDek, decrypt: true }); }
  async validateStartupKey() { return Object.freeze({ keyVersion: this.keyVersion, localDevelopmentOnly: true }); }
  transform({ userId, keyVersion, dek, decrypt }) {
    if (typeof userId !== 'string' || typeof keyVersion !== 'string' || !Buffer.isBuffer(dek)) throw new Error('Invalid local development envelope input.');
    const aad = canonicalAad({ entityType: 'development_key_envelope', entityId: keyVersion, userId, fieldPurpose: 'dek_wrap', encryptionVersion: 1, keyVersion });
    if (!decrypt) { const nonce = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', this.key, nonce); cipher.setAAD(aad); return Buffer.concat([nonce, cipher.update(dek), cipher.final(), cipher.getAuthTag()]); }
    if (dek.length < 29) throw new Error('Invalid local development envelope.'); const nonce = dek.subarray(0, 12), tag = dek.subarray(-16), body = dek.subarray(12, -16); const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, nonce); decipher.setAAD(aad); decipher.setAuthTag(tag); return Buffer.concat([decipher.update(body), decipher.final()]);
  }
}

module.exports = { DevelopmentLocalKms, DEVELOPMENT_LOCAL_WRAPPING_ALGORITHM: WRAPPING_ALGORITHM };
