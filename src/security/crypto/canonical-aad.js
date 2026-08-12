'use strict';

const { canonicalSerialize } = require('../../readings/reading-integrity');
const { fail } = require('./crypto-errors');

function required(value) { if (typeof value !== 'string' || !value || value.trim() !== value) fail('INVALID_ENCRYPTION_PAYLOAD'); return value; }
function canonicalAad({ entityType, entityId, userId, fieldPurpose, encryptionVersion, keyVersion } = {}) {
  if (!Number.isInteger(encryptionVersion) || encryptionVersion < 1) fail('INVALID_ENCRYPTION_PAYLOAD');
  return Buffer.from(canonicalSerialize({ entityType: required(entityType), entityId: required(entityId), userId: required(userId), fieldPurpose: required(fieldPurpose), encryptionVersion, keyVersion: required(keyVersion) }), 'utf8');
}

module.exports = { canonicalAad };
