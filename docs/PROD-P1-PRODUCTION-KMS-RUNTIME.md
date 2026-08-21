# PROD-P1 Production KMS and Runtime

## Deployment shape

Run the Fastify API as an Amazon ECS/Fargate service behind an HTTPS ALB and AWS WAF. The task is a persistent backend; serverless/edge deployment is not approved for this release. Use a task IAM role, not static AWS credentials. The task role is limited to `kms:Encrypt`, `kms:Decrypt`, and `kms:DescribeKey` on the one configured customer-managed symmetric KMS key; it must not receive `kms:*` or administrator access.

The task execution role, separate from the task role, may retrieve container/runtime secrets from AWS Secrets Manager. `DATABASE_URL` is injected as a secret and never logged. No KMS key material, raw DEK, ciphertext, nonce, JWT, authorization header, cookie, birth data, or reading payload is logged.

## KMS envelope policy

KundlInsights generates each 32-byte user DEK locally and uses AWS KMS `Encrypt`/`Decrypt` only to wrap/unwrap it. It does not use `GenerateDataKey`. `keyVersion` identifies the logical user-DEK envelope and is distinct from `kmsKeyRef`, the immutable KMS ARN that wrapped it. Historical decrypt calls use persisted envelope metadata; retain old KMS keys and decrypt permission until all retained historical encrypted records are no longer needed.

Use a symmetric `ENCRYPT_DECRYPT` key and AWS KMS automatic key-material rotation. Automatic rotation does not rotate application DEKs. A manually replaced KMS key requires a deliberate migration/retention plan; never schedule deletion of an old key until restore and historical-decrypt requirements are satisfied.

## Required runtime configuration

`NODE_ENV=production`, `HOST`, `PORT`, `DATABASE_URL`, `SUPABASE_AUTH_ISSUER`, `SUPABASE_AUTH_JWKS_URL`, `SUPABASE_AUTH_AUDIENCE`, `SUPABASE_AUTH_ALLOWED_ALGORITHMS`, `AWS_REGION`, `KUNDLINSIGHTS_KMS_KEY_ARN`, and `CORS_ALLOWED_ORIGINS` are required. `KUNDLINSIGHTS_HISTORICAL_KMS_KEY_ARNS` is an optional comma-separated allowlist for manually replaced retained keys. Optional bounded values are `DB_POOL_MAX`, `DB_CONNECTION_TIMEOUT_MS`, `DB_IDLE_TIMEOUT_MS`, `REQUEST_BODY_LIMIT_BYTES` (maximum 16384), `SHUTDOWN_TIMEOUT_MS`, and `LOG_LEVEL`.

Swiss Ephemeris commercial activation additionally requires `SWISS_EPHEMERIS_LICENSE_CONFIRMED=true`, an absolute `SWISS_EPHEMERIS_PATH`, and `SWISS_EPHEMERIS_MANIFEST` containing immutable `manifestId`, `releaseId`, and SHA-256/byte-length records for at least `sepl_18.se1` and `semo_18.se1`. The application does not download ephemeris data at runtime. Startup constructs one shared native adapter, verifies the artifacts, initializes native Lahiri (`SE_SIDM_LAHIRI`), and performs a verified calculation before the service can listen. Any missing license confirmation, malformed manifest, missing file, checksum mismatch, failed native load, or failed authority verification prevents startup. The Swiss Ephemeris Professional License must be acquired and recorded outside this repository before public or commercial activation; neither license material nor ephemeris data belongs in source control.

Production requires PostgreSQL TLS certificate verification, HTTPS browser origins without wildcards, explicit JWT algorithms, and no HTTP origins. AWS credentials are supplied only by the SDK default credential chain/ECS task role.

## PostgreSQL and Supabase

Prefer a direct Supabase PostgreSQL connection for this persistent backend. If the task network is IPv4-only, Supavisor session mode is the fallback. Supavisor transaction mode is not production-approved: it needs separate acceptance of the full transaction-local RLS sequence and prepared-statement behavior. Budget pool maximums across every task against the Supabase connection limit. Existing request transactions retain their `BEGIN`, transaction-local subject configuration, `SET LOCAL ROLE`, and commit/rollback behavior.

Do not run migrations in API startup. Execute migrations as a separately controlled, audited deployment step with migration-only credentials. Enable the Supabase plan's appropriate backups/PITR, test restores, and retain KMS keys needed to decrypt restored data.

## Lifecycle and traffic controls

Startup validates configuration, runs `select 1`, and calls KMS `DescribeKey`, requiring an enabled symmetric `ENCRYPT_DECRYPT` key. `/health` is process liveness only. `/ready` reports maintained runtime readiness and does not query KMS or PostgreSQL per request. A failed startup does not bind a listener.

On `SIGTERM` or `SIGINT`, readiness is cleared, Fastify stops accepting work, in-flight work is bounded by the shutdown timeout, then the PostgreSQL pool and KMS client are closed. Duplicate signals share one shutdown operation.

`@fastify/cors` uses only the configured allowlist. Allowed browser origins receive CORS headers; unlisted origins do not; requests without `Origin`, including native mobile clients, remain usable. AWS WAF provides the initial distributed rate-limit control. The 16 KiB body limit remains in force. ALB access logs, application logs, and metrics must use request IDs, route/status/latency, and safe error codes only.
