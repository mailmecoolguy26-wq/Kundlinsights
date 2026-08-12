'use strict';
const crypto = require('node:crypto');
const { DEK_BYTES } = require('./aes-gcm');
const { kmsBoundary, envelopeStoreBoundary } = require('./kms-interface');
const { fail, safeCrypto } = require('./crypto-errors');
function validUserId(value) { if (typeof value !== 'string' || !value || value.trim() !== value) fail('INVALID_ENCRYPTION_PAYLOAD'); return value; }
class UserDekProvider {
  constructor({ kms, envelopeStore, randomBytes = crypto.randomBytes } = {}) { this.kms = kmsBoundary(kms); this.envelopeStore = envelopeStoreBoundary(envelopeStore); this.randomBytes = randomBytes; }
  current(user) { const id = validUserId(user); const keyVersion = this.kms.getCurrentKeyVersion({ userId: id }); if (typeof keyVersion !== 'string' || !keyVersion) fail('DEK_NOT_AVAILABLE'); return this.forVersion({ userId: id, keyVersion }); }
  forVersion({ userId: id, keyVersion }) { const userIdValue = validUserId(id); if (typeof keyVersion !== 'string' || !keyVersion) fail('DEK_NOT_AVAILABLE'); const wrappedDek = this.envelopeStore.getEnvelope({ userId: userIdValue, keyVersion }); if (!Buffer.isBuffer(wrappedDek)) fail('DEK_NOT_AVAILABLE'); return safeCrypto(() => { const dek = this.kms.unwrapDek({ userId: userIdValue, keyVersion, wrappedDek }); if (!Buffer.isBuffer(dek) || dek.length !== DEK_BYTES) fail('DEK_UNWRAP_FAILED'); return { keyVersion, dek: Buffer.from(dek) }; }, 'DEK_UNWRAP_FAILED'); }
  provisionCurrent(user) { const userIdValue = validUserId(user); const keyVersion = this.kms.getCurrentKeyVersion({ userId: userIdValue }); if (typeof keyVersion !== 'string' || !keyVersion) fail('DEK_NOT_AVAILABLE'); const dek = this.randomBytes(DEK_BYTES); if (!Buffer.isBuffer(dek) || dek.length !== DEK_BYTES) fail('DEK_WRAP_FAILED'); try { const wrappedDek = this.kms.wrapDek({ userId: userIdValue, keyVersion, dek }); if (!Buffer.isBuffer(wrappedDek)) fail('DEK_WRAP_FAILED'); this.envelopeStore.putEnvelope({ userId: userIdValue, keyVersion, wrappedDek }); return keyVersion; } finally { dek.fill(0); } }
}
module.exports = { UserDekProvider };
