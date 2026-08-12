'use strict';

const { resolveEngineProfile } = require('../../engine-profiles');
const { digest } = require('../../readings/reading-integrity');
const { freeze } = require('../../synthesis/evidence-node');
const { immutableCopy, canonicalTime, requiredString } = require('../contracts');

function dbTime(value) { return value instanceof Date ? value.toISOString() : canonicalTime(value); }
function nullableTime(value) { return value === null || value === undefined ? null : dbTime(value); }
function nullableString(value, code) { return value === null || value === undefined ? null : requiredString(value, code); }
function toBuffer(value, code = 'INVALID_CODEC_PAYLOAD') {
  if (!Buffer.isBuffer(value)) { const error = new RangeError(code); error.code = code; throw error; }
  return value;
}
function profileFingerprint(engineProfileId) { return digest('sha256', resolveEngineProfile(engineProfileId)).digest; }
function userFromRow(row) { return immutableCopy({ id: row.id, authSubject: row.auth_subject, status: row.status, createdAt: dbTime(row.created_at), updatedAt: dbTime(row.updated_at), deletedAt: nullableTime(row.deleted_at) }); }
function birthProfileFromRow(row, codec) {
  const birthData = codec.decodeBirthData({ ciphertext: row.birth_payload_ciphertext, encryptionVersion: row.birth_payload_encryption_version, keyVersion: row.birth_payload_key_version, algorithm: row.birth_payload_algorithm, nonce: row.birth_payload_nonce });
  return immutableCopy({ id: row.id, userId: row.user_id, displayLabel: row.display_label, birthData, status: row.status, createdAt: dbTime(row.created_at), updatedAt: dbTime(row.updated_at), archivedAt: nullableTime(row.archived_at) });
}
function paymentFromRow(row) { return immutableCopy({ id: row.id, userId: row.user_id, provider: row.provider, providerTransactionId: row.provider_transaction_id, status: row.status, amountMinor: Number(row.amount_minor), currency: row.currency.trim(), createdAt: dbTime(row.created_at), updatedAt: dbTime(row.updated_at) }); }
function entitlementFromRow(row) { return immutableCopy({ id: row.id, userId: row.user_id, productKey: row.product_key, status: row.status, quantity: row.quantity, validFrom: dbTime(row.valid_from), validUntil: nullableTime(row.valid_until), sourcePaymentTransactionId: row.source_payment_transaction_id }); }
function readingFromRow(row, codec) {
  const record = codec.decodeRecord({
    inputSnapshotCiphertext: row.input_snapshot_ciphertext, provenanceCiphertext: row.provenance_ciphertext, structuredReadingCiphertext: row.structured_reading_ciphertext, renderedReadingCiphertext: row.rendered_reading_ciphertext,
    payloadEncryptionVersion: row.payload_encryption_version, payloadKeyVersion: row.payload_key_version, payloadAlgorithm: row.payload_algorithm,
    inputSnapshotNonce: row.input_snapshot_nonce, provenanceNonce: row.provenance_nonce, structuredReadingNonce: row.structured_reading_nonce, renderedReadingNonce: row.rendered_reading_nonce,
    integrityMetadata: row.integrity_metadata,
    recordMetadata: {
      readingId: row.id,
      domain: row.domain,
      engineProfileId: row.engine_profile_id,
      engineProfileFingerprint: row.engine_profile_fingerprint,
      schemaVersion: row.record_schema_version,
      createdAt: dbTime(row.created_at),
      integrity: {
        calculation: { algorithm: 'sha256', digest: row.calculation_digest },
        output: { algorithm: 'sha256', digest: row.output_digest },
        rendered: row.rendered_output_digest === null ? null : { algorithm: 'sha256', digest: row.rendered_output_digest },
      },
    },
  });
  return immutableCopy({ readingId: row.id, userId: row.user_id, birthProfileId: row.birth_profile_id, status: row.archived_at ? 'archived' : 'active', archivedAt: nullableTime(row.archived_at), record });
}
function encodedBirthPayload(codec, birthData) {
  const value = codec.encodeBirthData(birthData);
  if (!value || typeof value !== 'object') { const error = new RangeError('INVALID_CODEC_PAYLOAD'); error.code = 'INVALID_CODEC_PAYLOAD'; throw error; }
  return { ciphertext: toBuffer(value.ciphertext), encryptionVersion: value.encryptionVersion, keyVersion: requiredString(value.keyVersion, 'INVALID_CODEC_PAYLOAD'), algorithm: requiredString(value.algorithm, 'INVALID_CODEC_PAYLOAD'), nonce: toBuffer(value.nonce) };
}
function encodedReadingPayload(codec, record) {
  const value = codec.encodeRecord(record);
  if (!value || typeof value !== 'object') { const error = new RangeError('INVALID_CODEC_PAYLOAD'); error.code = 'INVALID_CODEC_PAYLOAD'; throw error; }
  const out = {
    inputSnapshotCiphertext: toBuffer(value.inputSnapshotCiphertext), provenanceCiphertext: toBuffer(value.provenanceCiphertext), structuredReadingCiphertext: toBuffer(value.structuredReadingCiphertext), renderedReadingCiphertext: value.renderedReadingCiphertext === null || value.renderedReadingCiphertext === undefined ? null : toBuffer(value.renderedReadingCiphertext),
    payloadEncryptionVersion: value.payloadEncryptionVersion, payloadKeyVersion: requiredString(value.payloadKeyVersion, 'INVALID_CODEC_PAYLOAD'), payloadAlgorithm: requiredString(value.payloadAlgorithm, 'INVALID_CODEC_PAYLOAD'),
    inputSnapshotNonce: toBuffer(value.inputSnapshotNonce), provenanceNonce: toBuffer(value.provenanceNonce), structuredReadingNonce: toBuffer(value.structuredReadingNonce), renderedReadingNonce: value.renderedReadingNonce === null || value.renderedReadingNonce === undefined ? null : toBuffer(value.renderedReadingNonce),
    integrityMetadata: value.integrityMetadata,
  };
  if ((out.renderedReadingCiphertext === null) !== (out.renderedReadingNonce === null)) { const error = new RangeError('INVALID_CODEC_PAYLOAD'); error.code = 'INVALID_CODEC_PAYLOAD'; throw error; }
  return out;
}

module.exports = { dbTime, nullableTime, nullableString, toBuffer, profileFingerprint, userFromRow, birthProfileFromRow, paymentFromRow, entitlementFromRow, readingFromRow, encodedBirthPayload, encodedReadingPayload, freeze };
