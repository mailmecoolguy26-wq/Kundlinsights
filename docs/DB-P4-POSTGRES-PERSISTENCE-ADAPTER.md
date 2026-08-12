# DB-P4 PostgreSQL persistence adapters

DB-P4 adds portable PostgreSQL implementations of the DB-P1 repository contracts. They live in `src/persistence/postgres/` and accept an injected query-compatible `db` client or pool. Repository constructors never create a pool, inspect environment variables, or resolve a connection string.

The five adapters are `PostgresUserRepository`, `PostgresBirthProfileRepository`, `PostgresReadingRepository`, `PostgresEntitlementRepository`, and `PostgresPaymentRepository`. `withClient(db)` creates a same-codec repository scoped to an externally managed transaction client.

All database values use parameterized SQL. PostgreSQL errors are translated to stable repository error codes; raw database query text, host details, and payloads are not exposed.

## Ciphertext boundary

DB-P2 stores opaque ciphertext and nonce columns. DB-P4 deliberately does not encrypt or decrypt application data. The birth-profile adapter requires a `birthProfilePayloadCodec`; the reading adapter requires a `readingPayloadCodec`. Production must inject a future authenticated-encryption/KMS implementation before use with real data.

The DB-P4 PostgreSQL integration test contains a `TEST_ONLY_CODEC`. It is deterministic serialization used solely to validate the storage boundary against a disposable local database. It is explicitly not encryption and is not exported by runtime code.

## Reading integrity and replay

The adapter persists the existing immutable record’s engine profile ID, schema version, timestamps, and digests unchanged. Its `engine_profile_fingerprint` is computed through the existing canonical SHA-256 `digest` mechanism over the authoritative immutable profile definition. No alternative fingerprint algorithm is introduced.

The reading table trigger remains the final semantic-immutability guard. Archiving changes only `archived_at`; it never rewrites the snapshot payload. Calculation digests remain non-unique, while non-null idempotency keys are unique per user.

## Local integration test

`tests/persistence/postgres-repositories.test.js` is opt-in and skipped by ordinary `npm test`. It requires an explicitly supplied disposable local connection string in `KUNDLINSIGHTS_DB_P4_DATABASE_URL` and a database already initialized with the committed DB-P2 migration. The test neither discovers credentials nor makes any cloud connection.

DB-P4 does not add Supabase Auth, RLS, a Supabase SDK, a payment API, KMS, production encryption, Mapbox, or any astrology-engine dependency.
