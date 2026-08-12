# DB-P2 PostgreSQL / Supabase Initial Schema

DB-P2 adds one portable PostgreSQL migration at `supabase/migrations/20260812000000_db_p2_initial_app_schema.sql`. It defines storage only: no database is connected, no Supabase client is installed, and no runtime repository adapter is added.

## Schema and tables

The dedicated `app` schema is not exposed through the `public` API surface. It contains, in foreign-key-safe creation order: `users`, mutable `birth_profiles`, `payment_transactions`, `entitlements`, and immutable `reading_records`. Schema/table privileges are conservatively revoked from `PUBLIC`; DB-P4 will define deliberate grants and RLS policies.

`users.auth_subject` is unique text rather than an `auth.users` foreign key. This preserves the independent application-user contract and defers Supabase Auth integration. All user-owned tables retain direct `user_id` references to support later RLS.

## Encrypted payload boundary

Birth profiles contain no plaintext birth date, local time, timezone, or coordinates. Their complete payload is reserved for application/KMS-produced ciphertext plus encryption version, key version, algorithm identifier, and nonce.

Reading records likewise preserve the existing reading-record contract as separately encrypted input-snapshot, provenance, structured-reading, and optional rendered-reading payloads. PostgreSQL stores no key and performs no encryption/decryption. The encrypted application/KMS implementation is deferred.

## Immutable readings and integrity

`reading_records` holds an immutable historical replay snapshot. A `BEFORE UPDATE` trigger rejects every semantic change, including profile/version values, ciphertext, nonces, provenance, output, digests, creation time, and idempotency key. Only `archived_at` and `deleted_at` may change operationally.

SHA-256 values use lowercase hexadecimal `char(64)` columns. Calculation digests are intentionally non-unique. Engine profile ID and profile fingerprint are stored separately. JSONB is limited to integrity metadata and optional provider metadata; no JSONB indexes are added because there is no approved JSON-path query.

## Foreign keys, indexes, and deletion

All foreign keys use `ON DELETE RESTRICT`; no automatic cascade can erase historical records. MVP list indexes cover user/profile reading lists, engine-profile lookup, calculation digest lookup, entitlement lookup, payment provider transaction uniqueness, and user-scoped reading idempotency. `amount_minor bigint` is nonnegative and maps directly from DB-P1.1’s safe integer `amountMinor` contract.

## Deferred work

DB-P2 does not activate RLS, integrate authentication, grant browser access, implement encryption, add payment/entitlement transaction procedures, connect a database, or test a live PostgreSQL instance. DB-P3 will validate this migration against local Supabase/PostgreSQL; DB-P4 will introduce approved auth, grants, and RLS policies.
