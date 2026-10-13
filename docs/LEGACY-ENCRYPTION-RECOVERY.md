# Legacy local-encryption recovery

This operator-only procedure recovers records encrypted with `development-local-kek-v1`. It is not an API feature, is never run by Railway, and must not receive a local development key through Railway environment variables.

## Preconditions

- A verified, restorable database backup ID.
- A controlled offline machine holding the retained local recovery file.
- A separate privileged `LEGACY_RECOVERY_DATABASE_URL`; do not use an app client connection string.
- AWS credentials capable of encrypt/decrypt with the current production KMS key.
- The SQL migration `20261009000000_sec_legacy_local_encryption_recovery.sql` applied through the normal audited migration process.

The recovery login must be permitted to assume both `app_crypto` (to rotate the user envelope) and `app_legacy_encryption_recovery` (to re-encrypt an authenticated user's payloads). Do not grant the latter role to the normal runtime login.

## Dry run

The dry run makes no database mutations. It unwraps and decrypts in memory, validates codec/schema integrity, and prints only aggregate/user-batch counts and safe codes.

```sh
LEGACY_RECOVERY_DATABASE_URL="$LEGACY_RECOVERY_DATABASE_URL" \
AWS_REGION="$AWS_REGION" \
KUNDLINSIGHTS_KMS_KEY_ARN="$KUNDLINSIGHTS_KMS_KEY_ARN" \
node scripts/migrate-legacy-encryption.js --dry-run --legacy-env-file /secure/offline/.env.development.local
```

## Migration

Run only after a successful dry run and recorded backup. `--backup-id` is mandatory and is an operator acknowledgement, not a backup implementation.

```sh
LEGACY_RECOVERY_DATABASE_URL="$LEGACY_RECOVERY_DATABASE_URL" \
AWS_REGION="$AWS_REGION" \
KUNDLINSIGHTS_KMS_KEY_ARN="$KUNDLINSIGHTS_KMS_KEY_ARN" \
node scripts/migrate-legacy-encryption.js --migrate --backup-id "approved-backup-id" --legacy-env-file /secure/offline/.env.development.local
```

Each user is one transaction. Before mutation, legacy payloads are decoded in memory. A new AWS envelope is created via the normal `UserDekProvider.rotateUserDek` path; profiles/readings are re-encrypted with existing codecs, immediately decoded with the AWS-backed provider, and compared canonically before commit. Any error rolls back that user batch.

The database migration creates a dedicated `app_legacy_encryption_recovery` role and a narrowly scoped reading-record re-encryption exception. The recovery database principal must be explicitly allowed to `SET ROLE app_crypto` and `SET ROLE app_legacy_encryption_recovery`; the normal application runtime must not receive that membership.

## Post-migration validation

Run the read-only aggregate checks with migration credentials. They must return zero legacy rows; then reproduce authenticated profile listing through the production-style API.

```sql
select count(*) as legacy_birth_profiles from app.birth_profiles where birth_payload_key_version = 'development-local-kek-v1';
select count(*) as legacy_readings from app.reading_records where payload_key_version = 'development-local-kek-v1';
```

Then perform codec-level production-style decrypt validation (AWS provider only; no local key is loaded):

```sh
LEGACY_RECOVERY_DATABASE_URL="$LEGACY_RECOVERY_DATABASE_URL" \
AWS_REGION="$AWS_REGION" \
KUNDLINSIGHTS_KMS_KEY_ARN="$KUNDLINSIGHTS_KMS_KEY_ARN" \
KUNDLINSIGHTS_HISTORICAL_KMS_KEY_ARNS="$KUNDLINSIGHTS_HISTORICAL_KMS_KEY_ARNS" \
node scripts/validate-legacy-encryption-migration.js
```

Finally, with a securely supplied bearer token for a migrated owner, confirm the exact production list path without printing a response body or token:

```sh
curl --fail --silent --show-error --output /dev/null \
  --write-out 'birth-profile-list HTTP %{http_code}\n' \
  -H "Authorization: Bearer $PRODUCTION_TEST_BEARER_TOKEN" \
  "$API_BASE_URL/v1/birth-profiles"
```

Do not retire/delete the offline recovery file automatically. Keep it in secure offline retention until backup restore testing and authenticated production-style decrypt validation are complete.

## Rollback and recovery

- The tool commits one user batch at a time. A failed batch is rolled back in full, including its envelope rotation.
- It is resumable: committed users no longer have an active legacy envelope and are skipped by the next run; failed users remain eligible.
- Once a user batch commits, the old envelope row is retained as `retired`, but the old record ciphertext has been replaced. The verified database backup is therefore the rollback mechanism for a committed batch.
- Stop immediately on the first migration error, preserve the safe error code, and restore only through the verified backup/change-control process. Never attempt manual ciphertext edits.
- Do not delete the retained local recovery material as part of rollback, validation, or cleanup.
