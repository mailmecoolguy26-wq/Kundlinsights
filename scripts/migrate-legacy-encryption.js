'use strict';

// Offline operator tool. It has no HTTP/API entry point and is intentionally
// inert unless an explicit mode is supplied.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const { KMSClient } = require('@aws-sdk/client-kms');
const { DevelopmentLocalKms } = require('../src/runtime/development-local-kms');
const { AwsKmsProvider, UserDekProvider, PostgresUserKeyEnvelopeStore, BirthProfilePayloadCodec, ReadingPayloadCodec } = require('../src/security/crypto');
const { LEGACY_KEY_VERSION, LEGACY_WRAPPING_ALGORITHM, safeCode, sameCanonical, immutableReport } = require('../src/application/legacy-encryption/legacy-encryption-migration');

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function argument(name) { const at = process.argv.indexOf(name); return at < 0 ? null : process.argv[at + 1] || null; }
function mode() { const dry = process.argv.includes('--dry-run'); const migrate = process.argv.includes('--migrate'); if (dry === migrate) fail('SELECT_EXACTLY_ONE_MODE'); return dry ? 'DRY_RUN' : 'MIGRATE'; }
function envValue(text, name) { const line = text.split(/\r?\n/).find((value) => value.replace(/^export\s+/, '').startsWith(`${name}=`)); if (!line) fail(`MISSING_${name}`); return line.replace(/^export\s+/, '').slice(name.length + 1).replace(/^['"]|['"]$/g, ''); }
function loadLegacyKms(file) { const text = fs.readFileSync(file, 'utf8'); const key = Buffer.from(envValue(text, 'DEV_LOCAL_KMS_KEY_BASE64'), 'base64'); const keyVersion = (() => { try { return envValue(text, 'DEV_LOCAL_KMS_KEY_VERSION'); } catch { return LEGACY_KEY_VERSION; } })(); if (keyVersion !== LEGACY_KEY_VERSION) fail('UNEXPECTED_LEGACY_KEY_VERSION'); return new DevelopmentLocalKms({ key, keyVersion }); }
function output(value) { process.stdout.write(`${JSON.stringify(value)}\n`); }
function safeErrorClass(error) { return error && typeof error.name === 'string' && /^[A-Za-z][A-Za-z0-9_.-]{0,127}$/.test(error.name) ? error.name : 'UNKNOWN_ERROR_CLASS'; }
function safeSqlState(error) { return error && typeof error.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code) ? error.code : undefined; }
function safeAwsHttpStatus(error) { const value = error && error.$metadata && error.$metadata.httpStatusCode; return Number.isInteger(value) && value >= 100 && value <= 599 ? value : undefined; }
function safePostgresMessage(error) {
  if (!safeSqlState(error) || !error || typeof error.message !== 'string') return undefined;
  return error.message.trim().slice(0, 512)
    .replace(/(?:postgres(?:ql)?:\/\/|postgres:\/\/|[a-z][a-z0-9+.-]*:\/\/)[^\s]+/gi, '[REDACTED_CONNECTION]')
    .replace(/(['"]).*?\1/g, '$1[REDACTED]$1')
    .replace(/\b(?:app|security)\.[a-z_][a-z0-9_$]*/gi, '[REDACTED_IDENTIFIER]')
    .replace(/\b(?:role|schema|table|relation|function|parameter|database|user)\s+[a-z_][a-z0-9_$.-]*/gi, '$1 [REDACTED_IDENTIFIER]');
}
function stageFailure(stage, error) { output(immutableReport({ stage, safeErrorCode: safeCode(error), errorClass: safeErrorClass(error), ...(safeSqlState(error) ? { postgresqlSqlState: safeSqlState(error), safePostgresMessage: safePostgresMessage(error) } : {}), ...(safeAwsHttpStatus(error) ? { awsHttpStatusCode: safeAwsHttpStatus(error) } : {}) })); }
async function atStage(stage, action) { try { return await action(); } catch (error) { if (!error.migrationDiagnosticStage) { Object.defineProperty(error, 'migrationDiagnosticStage', { value: stage }); stageFailure(stage, error); } throw error; } }
function keyProvider(keyVersion, dek) { return Object.freeze({ current: async () => ({ keyVersion, dek: Buffer.from(dek) }), forVersion: async () => ({ keyVersion, dek: Buffer.from(dek) }) }); }
function profileInput(row) { return { userId: row.user_id, profileId: row.id, ciphertext: row.birth_payload_ciphertext, nonce: row.birth_payload_nonce, algorithm: row.birth_payload_algorithm, encryptionVersion: row.birth_payload_encryption_version, keyVersion: row.birth_payload_key_version }; }
function readingInput(row) { return { userId: row.user_id, inputSnapshotCiphertext: row.input_snapshot_ciphertext, provenanceCiphertext: row.provenance_ciphertext, structuredReadingCiphertext: row.structured_reading_ciphertext, renderedReadingCiphertext: row.rendered_reading_ciphertext, payloadEncryptionVersion: row.payload_encryption_version, payloadKeyVersion: row.payload_key_version, payloadAlgorithm: row.payload_algorithm, inputSnapshotNonce: row.input_snapshot_nonce, provenanceNonce: row.provenance_nonce, structuredReadingNonce: row.structured_reading_nonce, renderedReadingNonce: row.rendered_reading_nonce, integrityMetadata: row.integrity_metadata, recordMetadata: { readingId: row.id, domain: row.domain, engineProfileId: row.engine_profile_id, schemaVersion: row.record_schema_version, createdAt: new Date(row.created_at).toISOString(), integrity: { calculation: { algorithm: 'sha256', digest: row.calculation_digest }, output: { algorithm: 'sha256', digest: row.output_digest }, rendered: row.rendered_output_digest === null ? null : { algorithm: 'sha256', digest: row.rendered_output_digest } } } }; }
async function readPersistedProfile(client, item) { const row = (await client.query('select * from app.birth_profiles where id=$1', [item.row.id])).rows[0]; if (!row) fail('PROFILE_PERSISTENCE_MISSING'); return row; }
async function readPersistedReading(client, item) { const row = (await client.query('select * from app.reading_records where id=$1', [item.row.id])).rows[0]; if (!row) fail('READING_PERSISTENCE_MISSING'); return row; }
async function rows(client) { return (await client.query("select u.id as user_id,u.auth_subject,e.key_version,e.wrapped_dek,e.kms_key_ref,e.wrapping_algorithm from app.users u join app.user_key_envelopes e on e.user_id=u.id and e.key_version=$1 where e.status='active'", [LEGACY_KEY_VERSION])).rows; }
async function records(client, userId) { const profiles = (await client.query('select * from app.birth_profiles where user_id=$1 and birth_payload_key_version=$2 order by id', [userId, LEGACY_KEY_VERSION])).rows; const readings = (await client.query('select * from app.reading_records where user_id=$1 and payload_key_version=$2 order by id', [userId, LEGACY_KEY_VERSION])).rows; return { profiles, readings }; }
async function legacyDek(kms, envelope) { if (envelope.wrapping_algorithm !== LEGACY_WRAPPING_ALGORITHM) fail('UNEXPECTED_LEGACY_WRAPPING_ALGORITHM'); return kms.unwrapDek({ userId: envelope.user_id, keyVersion: envelope.key_version, kmsKeyRef: envelope.kms_key_ref, wrappingAlgorithm: envelope.wrapping_algorithm, wrappedDek: envelope.wrapped_dek }); }
async function assumeAndVerifyRole(client, { role, assumeStage, verifyStage }) {
  await atStage(assumeStage, () => client.query(`set local role ${role}`));
  const state = await atStage(verifyStage, () => client.query('select current_user = $1 as role_active', [role]));
  if (!state.rows[0] || state.rows[0].role_active !== true) await atStage(verifyStage, () => { fail('RECOVERY_ROLE_NOT_ACTIVE'); });
}
async function resetCryptoRoleAndVerify(client) {
  await atStage('APP_CRYPTO_ROLE_RESET', () => client.query('reset role'));
  const state = await atStage('APP_CRYPTO_ROLE_RESET_VERIFY', () => client.query('select current_user = session_user as role_reset, current_setting($1,true) is not null as auth_context_active', ['app.auth_subject']));
  if (!state.rows[0] || state.rows[0].role_reset !== true) await atStage('APP_CRYPTO_ROLE_RESET_VERIFY', () => { fail('APP_CRYPTO_ROLE_NOT_RESET'); });
  if (state.rows[0].auth_context_active !== true) await atStage('APP_CRYPTO_ROLE_RESET_VERIFY', () => { fail('AUTH_CONTEXT_NOT_PRESERVED'); });
}
async function configureRecoveryRole(client) {
  await assumeAndVerifyRole(client, { role: 'app_legacy_encryption_recovery', assumeStage: 'RECOVERY_ROLE_ASSUME', verifyStage: 'RECOVERY_ROLE_VERIFY' });
  await atStage('RECOVERY_FLAG_SET', () => client.query('select set_config($1,$2,true)', ['app.legacy_encryption_recovery', 'v1']));
  const state = await atStage('RECOVERY_FLAG_VERIFY', () => client.query('select current_setting($1,true) as recovery_flag', ['app.legacy_encryption_recovery']));
  if (!state.rows[0] || state.rows[0].recovery_flag !== 'v1') await atStage('RECOVERY_FLAG_VERIFY', () => { fail('RECOVERY_FLAG_NOT_ACTIVE'); });
}
async function validateLegacy(kms, envelope, data, stage = atStage) {
  const dek = await stage('LEGACY_DEK_UNWRAP', () => legacyDek(kms, envelope));
  try {
    const provider = keyProvider(envelope.key_version, dek); const birth = new BirthProfilePayloadCodec({ userDekProvider: provider }); const reading = new ReadingPayloadCodec({ userDekProvider: provider });
    const profiles = await stage('PROFILE_DECRYPT', () => Promise.all(data.profiles.map(async (row) => ({ row, value: await birth.decodeBirthData(profileInput(row)) }))));
    const readings = await stage('READING_DECRYPT', () => Promise.all(data.readings.map(async (row) => ({ row, value: await reading.decodeRecord(readingInput(row)) }))));
    return { profiles, readings };
  } finally { dek.fill(0); }
}
async function run() {
  const operation = mode(); const legacyEnvFile = argument('--legacy-env-file'); if (!legacyEnvFile) fail('LEGACY_ENV_FILE_REQUIRED');
  if (operation === 'MIGRATE' && !argument('--backup-id')) fail('BACKUP_ID_REQUIRED');
  const databaseUrl = process.env.LEGACY_RECOVERY_DATABASE_URL; if (!databaseUrl) fail('LEGACY_RECOVERY_DATABASE_URL_REQUIRED');
  const legacy = loadLegacyKms(legacyEnvFile); const db = new Pool({ connectionString: databaseUrl, max: 1, ssl: { rejectUnauthorized: true }, application_name: 'taraverse-legacy-encryption-recovery' });
  let awsClient;
  try {
    const client = await db.connect();
    try {
      const affected = await rows(client);
      const summary = { mode: operation, users: affected.length, birthProfiles: 0, readings: 0, succeeded: 0, failed: 0 };
      for (const envelope of affected) {
        let transaction = false;
        try {
          if (operation === 'MIGRATE') { await atStage('USER_TRANSACTION_START', () => client.query('begin')); transaction = true; }
          const data = await records(client, envelope.user_id); const decoded = await validateLegacy(legacy, envelope, data);
          summary.birthProfiles += data.profiles.length; summary.readings += data.readings.length;
          if (operation === 'DRY_RUN') { summary.succeeded += 1; output(immutableReport({ recordType: 'USER_BATCH', oldKeyVersion: LEGACY_KEY_VERSION, migrationStatus: 'VALIDATED', birthProfiles: data.profiles.length, readings: data.readings.length })); continue; }
          if (!awsClient) { awsClient = new KMSClient({ region: process.env.AWS_REGION, maxAttempts: 3, retryMode: 'standard' }); }
          const aws = new AwsKmsProvider({ client: awsClient, kmsKeyArn: process.env.KUNDLINSIGHTS_KMS_KEY_ARN });
          await atStage('USER_TRANSACTION_START', () => client.query('select set_config($1,$2,true)', ['app.auth_subject', envelope.auth_subject]));
          await assumeAndVerifyRole(client, { role: 'app_crypto', assumeStage: 'APP_CRYPTO_ROLE_ASSUME', verifyStage: 'APP_CRYPTO_ROLE_VERIFY' });
          const awsKeys = new UserDekProvider({ kms: aws, envelopeStore: new PostgresUserKeyEnvelopeStore({ db: client }), idGenerator: crypto.randomUUID, now: () => new Date().toISOString() });
          const metadata = await atStage('AWS_DEK_WRAP', () => awsKeys.rotateUserDek(envelope.user_id)); const next = await atStage('AWS_DECRYPT_VERIFY', () => awsKeys.current(envelope.user_id));
          try {
            await resetCryptoRoleAndVerify(client);
            await configureRecoveryRole(client);
            const provider = keyProvider(next.keyVersion, next.dek); const birth = new BirthProfilePayloadCodec({ userDekProvider: provider }); const reading = new ReadingPayloadCodec({ userDekProvider: provider });
            for (const item of decoded.profiles) {
              const payload = await atStage('PROFILE_REENCRYPT', () => birth.encodeBirthData({ userId: item.row.user_id, profileId: item.row.id, birthData: item.value }));
              const verify = await atStage('PROFILE_REENCRYPT', () => birth.decodeBirthData({ userId: item.row.user_id, profileId: item.row.id, ...payload }));
              await atStage('CANONICAL_COMPARE', () => { if (!sameCanonical(item.value, verify)) fail('PROFILE_REENCRYPTION_MISMATCH'); });
              await atStage('PROFILE_PERSIST', () => client.query('update app.birth_profiles set birth_payload_ciphertext=$2,birth_payload_encryption_version=$3,birth_payload_key_version=$4,birth_payload_algorithm=$5,birth_payload_nonce=$6 where id=$1 and birth_payload_key_version=$7', [item.row.id, payload.ciphertext, payload.encryptionVersion, payload.keyVersion, payload.algorithm, payload.nonce, LEGACY_KEY_VERSION]));
              const persisted = await atStage('READBACK', () => readPersistedProfile(client, item));
              const persistedValue = await atStage('AWS_DECRYPT_VERIFY', () => birth.decodeBirthData(profileInput(persisted)));
              await atStage('CANONICAL_COMPARE', () => { if (!sameCanonical(item.value, persistedValue)) fail('PROFILE_PERSISTED_REENCRYPTION_MISMATCH'); });
            }
            for (const item of decoded.readings) {
              const payload = await atStage('READING_REENCRYPT', () => reading.encodeRecord({ userId: item.row.user_id, record: item.value }));
              const verify = await atStage('READING_REENCRYPT', () => reading.decodeRecord({ userId: item.row.user_id, ...payload, recordMetadata: readingInput(item.row).recordMetadata }));
              await atStage('CANONICAL_COMPARE', () => { if (!sameCanonical(item.value, verify)) fail('READING_REENCRYPTION_MISMATCH'); });
              await atStage('READING_PERSIST', () => client.query('update app.reading_records set input_snapshot_ciphertext=$2,provenance_ciphertext=$3,structured_reading_ciphertext=$4,rendered_reading_ciphertext=$5,payload_encryption_version=$6,payload_key_version=$7,payload_algorithm=$8,input_snapshot_nonce=$9,provenance_nonce=$10,structured_reading_nonce=$11,rendered_reading_nonce=$12 where id=$1 and payload_key_version=$13', [item.row.id,payload.inputSnapshotCiphertext,payload.provenanceCiphertext,payload.structuredReadingCiphertext,payload.renderedReadingCiphertext,payload.payloadEncryptionVersion,payload.payloadKeyVersion,payload.payloadAlgorithm,payload.inputSnapshotNonce,payload.provenanceNonce,payload.structuredReadingNonce,payload.renderedReadingNonce,LEGACY_KEY_VERSION]));
              const persisted = await atStage('READBACK', () => readPersistedReading(client, item));
              const persistedValue = await atStage('AWS_DECRYPT_VERIFY', () => reading.decodeRecord(readingInput(persisted)));
              await atStage('CANONICAL_COMPARE', () => { if (!sameCanonical(item.value, persistedValue)) fail('READING_PERSISTED_REENCRYPTION_MISMATCH'); });
            }
          } finally { next.dek.fill(0); }
          await atStage('COMMIT', () => client.query('commit')); transaction = false; summary.succeeded += 1; output(immutableReport({ recordType: 'USER_BATCH', oldKeyVersion: LEGACY_KEY_VERSION, newKeyVersion: metadata.keyVersion, migrationStatus: 'MIGRATED', birthProfiles: data.profiles.length, readings: data.readings.length }));
        } catch (error) { if (transaction) await client.query('rollback').catch(() => {}); summary.failed += 1; output(immutableReport({ recordType: 'USER_BATCH', oldKeyVersion: LEGACY_KEY_VERSION, migrationStatus: 'FAILED', safeErrorCode: safeCode(error) })); if (operation === 'MIGRATE') throw error; }
      }
      output(immutableReport({ recordType: 'SUMMARY', migrationStatus: summary.failed ? 'FAILED' : operation === 'DRY_RUN' ? 'DRY_RUN_VALIDATED' : 'MIGRATED', ...summary }));
    } finally { client.release(); }
  } finally { await db.end().catch(() => {}); if (legacy && legacy.key) legacy.key.fill(0); if (awsClient) awsClient.destroy(); }
}
if (require.main === module) run().catch((error) => { process.stderr.write(`LEGACY_ENCRYPTION_MIGRATION_FAILED ${safeCode(error)}\n`); process.exitCode = 1; });
module.exports = { mode, loadLegacyKms, profileInput, readingInput, validateLegacy, readPersistedProfile, readPersistedReading, safeErrorClass, safeSqlState, safeAwsHttpStatus, safePostgresMessage, atStage, assumeAndVerifyRole, resetCryptoRoleAndVerify, configureRecoveryRole };
