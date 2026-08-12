'use strict';
const { canonicalSerialize, canonicalValue } = require('../../readings/reading-integrity');
const { ALGORITHM, ENCRYPTION_VERSION, encrypt, decrypt } = require('./aes-gcm');
const { canonicalAad } = require('./canonical-aad');
const { fail, safeCrypto } = require('./crypto-errors');
function context(value) { if (!value || typeof value !== 'object' || typeof value.userId !== 'string' || typeof value.profileId !== 'string') fail('INVALID_ENCRYPTION_PAYLOAD'); return value; }
class BirthProfilePayloadCodec {
  constructor({ userDekProvider } = {}) { if (!userDekProvider || typeof userDekProvider.current !== 'function' || typeof userDekProvider.forVersion !== 'function') fail('DEK_NOT_AVAILABLE'); this.deks = userDekProvider; }
  encodeBirthData({ userId, profileId, birthData } = {}) { return safeCrypto(() => { context({ userId, profileId }); const key = this.deks.current(userId); try { const aad = canonicalAad({ entityType: 'birth_profile', entityId: profileId, userId, fieldPurpose: 'birth_payload', encryptionVersion: ENCRYPTION_VERSION, keyVersion: key.keyVersion }); const encrypted = encrypt({ dek: key.dek, plaintext: Buffer.from(canonicalSerialize(birthData)), aad }); return Object.freeze({ ciphertext: encrypted.ciphertext, nonce: encrypted.nonce, algorithm: ALGORITHM, encryptionVersion: ENCRYPTION_VERSION, keyVersion: key.keyVersion }); } finally { key.dek.fill(0); } }, 'ENCRYPTION_FAILED'); }
  decodeBirthData({ userId, profileId, ciphertext, nonce, algorithm, encryptionVersion, keyVersion } = {}) { return safeCrypto(() => { context({ userId, profileId }); if (algorithm !== ALGORITHM) fail('UNSUPPORTED_ENCRYPTION_ALGORITHM'); if (encryptionVersion !== ENCRYPTION_VERSION) fail('UNSUPPORTED_ENCRYPTION_VERSION'); const key = this.deks.forVersion({ userId, keyVersion }); try { const aad = canonicalAad({ entityType: 'birth_profile', entityId: profileId, userId, fieldPurpose: 'birth_payload', encryptionVersion, keyVersion }); return Object.freeze(canonicalValue(JSON.parse(decrypt({ dek: key.dek, ciphertext, nonce, aad }).toString('utf8')))); } finally { key.dek.fill(0); } }, 'DECRYPTION_FAILED'); }
}
module.exports = { BirthProfilePayloadCodec };
