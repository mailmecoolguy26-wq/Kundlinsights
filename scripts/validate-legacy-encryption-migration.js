'use strict';

// Read-only post-migration validation. It never loads a local development key.
const { Pool } = require('pg');
const { KMSClient } = require('@aws-sdk/client-kms');
const { AwsKmsProvider, BirthProfilePayloadCodec, ReadingPayloadCodec } = require('../src/security/crypto');

const LEGACY = 'development-local-kek-v1';
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function safeCode(error) { return error && typeof error.code === 'string' && /^[A-Z][A-Z0-9_]{1,127}$/.test(error.code) ? error.code : 'UNKNOWN_ERROR'; }
function provider(version, dek) { return Object.freeze({ current: async () => ({ keyVersion: version, dek: Buffer.from(dek) }), forVersion: async () => ({ keyVersion: version, dek: Buffer.from(dek) }) }); }
function historical() { return process.env.KUNDLINSIGHTS_HISTORICAL_KMS_KEY_ARNS ? process.env.KUNDLINSIGHTS_HISTORICAL_KMS_KEY_ARNS.split(',') : []; }
async function main() {
  const url = process.env.LEGACY_RECOVERY_DATABASE_URL; if (!url) fail('LEGACY_RECOVERY_DATABASE_URL_REQUIRED');
  const kmsClient = new KMSClient({ region: process.env.AWS_REGION, maxAttempts: 3, retryMode: 'standard' }); const kms = new AwsKmsProvider({ client: kmsClient, kmsKeyArn: process.env.KUNDLINSIGHTS_KMS_KEY_ARN, historicalKmsKeyArns: historical() }); const db = new Pool({ connectionString: url, max: 1, ssl: { rejectUnauthorized: true }, application_name: 'taraverse-legacy-encryption-validation' });
  try {
    const client = await db.connect(); try {
      const [legacyProfiles, legacyReadings] = await Promise.all([client.query('select count(*)::int as count from app.birth_profiles where birth_payload_key_version=$1',[LEGACY]),client.query('select count(*)::int as count from app.reading_records where payload_key_version=$1',[LEGACY])]);
      if (legacyProfiles.rows[0].count || legacyReadings.rows[0].count) fail('LEGACY_RECORDS_REMAIN');
      const profiles = (await client.query('select bp.*,e.wrapped_dek,e.kms_key_ref,e.wrapping_algorithm from app.birth_profiles bp join app.user_key_envelopes e on e.user_id=bp.user_id and e.key_version=bp.birth_payload_key_version')).rows;
      const readings = (await client.query('select rr.*,e.wrapped_dek,e.kms_key_ref,e.wrapping_algorithm from app.reading_records rr join app.user_key_envelopes e on e.user_id=rr.user_id and e.key_version=rr.payload_key_version')).rows;
      for (const row of profiles) { const dek=await kms.unwrapDek({userId:row.user_id,keyVersion:row.birth_payload_key_version,kmsKeyRef:row.kms_key_ref,wrappingAlgorithm:row.wrapping_algorithm,wrappedDek:row.wrapped_dek});try { await new BirthProfilePayloadCodec({userDekProvider:provider(row.birth_payload_key_version,dek)}).decodeBirthData({userId:row.user_id,profileId:row.id,ciphertext:row.birth_payload_ciphertext,nonce:row.birth_payload_nonce,algorithm:row.birth_payload_algorithm,encryptionVersion:row.birth_payload_encryption_version,keyVersion:row.birth_payload_key_version}); } finally { dek.fill(0); } }
      for (const row of readings) { const dek=await kms.unwrapDek({userId:row.user_id,keyVersion:row.payload_key_version,kmsKeyRef:row.kms_key_ref,wrappingAlgorithm:row.wrapping_algorithm,wrappedDek:row.wrapped_dek});try { await new ReadingPayloadCodec({userDekProvider:provider(row.payload_key_version,dek)}).decodeRecord({userId:row.user_id,inputSnapshotCiphertext:row.input_snapshot_ciphertext,provenanceCiphertext:row.provenance_ciphertext,structuredReadingCiphertext:row.structured_reading_ciphertext,renderedReadingCiphertext:row.rendered_reading_ciphertext,payloadEncryptionVersion:row.payload_encryption_version,payloadKeyVersion:row.payload_key_version,payloadAlgorithm:row.payload_algorithm,inputSnapshotNonce:row.input_snapshot_nonce,provenanceNonce:row.provenance_nonce,structuredReadingNonce:row.structured_reading_nonce,renderedReadingNonce:row.rendered_reading_nonce,integrityMetadata:row.integrity_metadata,recordMetadata:{readingId:row.id,domain:row.domain,engineProfileId:row.engine_profile_id,schemaVersion:row.record_schema_version,createdAt:new Date(row.created_at).toISOString(),integrity:{calculation:{algorithm:'sha256',digest:row.calculation_digest},output:{algorithm:'sha256',digest:row.output_digest},rendered:row.rendered_output_digest===null?null:{algorithm:'sha256',digest:row.rendered_output_digest}}}}); } finally { dek.fill(0); } }
      process.stdout.write(`${JSON.stringify({status:'VALIDATED',productionStyleBirthProfiles:profiles.length,productionStyleReadings:readings.length,remainingLegacyBirthProfiles:0,remainingLegacyReadings:0})}\n`);
    } finally { client.release(); }
  } finally { await db.end().catch(()=>{}); kmsClient.destroy(); }
}
main().catch((error)=>{process.stderr.write(`LEGACY_ENCRYPTION_VALIDATION_FAILED ${safeCode(error)}\n`);process.exitCode=1;});
