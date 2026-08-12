# SEC-P4 production encryption codecs

SEC-P4 adds the application-layer cryptographic boundary that DB-P4 repositories already accept by injection. It does not create a database pool, a cloud KMS connection, a schema migration, or a key-envelope table.

## Cryptographic format

The v1 codecs use Node's `node:crypto` AES-256-GCM implementation.

- Algorithm identifier: `aes-256-gcm-v1`.
- Encryption version: `1`.
- DEK: 32 bytes (256 bits), held only as a `Buffer` while a codec operation is running.
- Nonce: a new `crypto.randomBytes(12)` value per encrypted field (96 bits); no ID, timestamp, digest, or counter is used to derive it.
- Stored ciphertext format: `ciphertext || authenticationTag`, where the final 16 bytes are the GCM authentication tag (128 bits). Payloads shorter than a tag are rejected.

The v1 birth codec encrypts the complete birth payload. The reading codec encrypts `input_snapshot`, `provenance`, `structured_reading`, and non-null `rendered_reading` independently, with distinct nonces. A null rendered reading remains null in both ciphertext and nonce columns.

## Canonical plaintext and AAD

Plaintext uses the committed reading canonical serializer, so encrypt/decrypt reconstruction preserves the existing semantic representation. The canonical AAD binds `entityType`, `entityId`, `userId`, `fieldPurpose`, `encryptionVersion`, and `keyVersion`. It deliberately excludes operationally mutable fields such as labels, archive timestamps, deletion timestamps, and update timestamps.

This makes ciphertext tampering, nonce/tag modification, user swaps, birth-profile/reading-record swaps, and reading-field swaps fail closed. Existing calculation/output/rendered semantic digests remain plaintext identity metadata and are neither recalculated over ciphertext nor changed by nonce randomness.

## Key boundary and rotation

`UserDekProvider` consumes an injected, provider-neutral KMS boundary with `getCurrentKeyVersion`, `wrapDek`, and `unwrapDek`, plus an injected envelope-store boundary. There is one logical DEK per application user and key version. A caller must explicitly provision an envelope; codecs do not create one implicitly.

Writes use the KMS-reported current key version. Decryption uses the stored key version, allowing a retained old envelope to decrypt old immutable readings after a current-version change. SEC-P4 performs no background rotation and does not mutate immutable reading content. Mutable birth profiles may be opportunistically re-encrypted in a future controlled workflow.

No raw DEK, wrapped DEK, nonce, ciphertext, authentication tag, birth data, or reading contents are logged or returned in application persistence objects. Codec code clears its temporary DEK buffer after use where practical. JavaScript runtime memory management cannot guarantee physical memory erasure; this is best-effort hygiene, not a promise of perfect erasure.

## Production boundary and deferred persistence

Production must inject a licensed/approved KMS implementation and a persistent wrapped-DEK envelope store. PostgreSQL stores only the existing opaque ciphertext, nonce, algorithm, encryption-version, and key-version fields; it stores no raw DEK. SEC-P4 intentionally adds no envelope schema or persistence: that forward migration belongs to SEC-P5.

`TEST_ONLY_KMS` and `TEST_ONLY_KEY_ENVELOPE_STORE` live under tests only. They emulate wrapping, unwrapping, and version selection for controlled tests; they are never exported by `src/security/crypto`, never auto-selected, and are not a production KMS.

DB-P4 remains provider-neutral: its mapper passes user and entity context to codecs solely so the canonical AAD can be constructed. Reading replay, engine profile identity, Savana/Solar chronology, and timezone provenance are decrypted unchanged before their existing replay paths execute.

## Threat boundary

SEC-P4 protects application payload confidentiality and integrity when its KMS/envelope dependencies are correctly supplied. It does not replace verified-principal provisioning, server-only database access, SEC-P3 RLS, secure runtime configuration, backups policy, audit logging, access controls, or future envelope persistence. No AWS, GCP, Azure, Supabase, or other cloud KMS is integrated in this phase.
