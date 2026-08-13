# SEC-P6 secure reading application service

`SecureReadingService` is an injected server-side application boundary. It accepts only a verified SEC-P2 principal; raw tokens, client `userId`, owner IDs, and database rows are not accepted as authority.

Generation has three phases. A short `app_runtime` transaction resolves the caller's owned, encrypted birth profile (whose codec obtains the stored key version through the injected DEK provider). Astrology generation happens outside a database transaction. A final short authenticated transaction first checks idempotency, inserts the encrypted immutable reading, and then switches to the narrowly required `app_worker` role to consume the selected entitlement. Both operations share that transaction, so an insert or consumption failure rolls back both changes. The database's user-scoped idempotency index is the final concurrency authority; a duplicate retry reads and returns the completed owned reading.

New data is encrypted by the existing SEC-P4 AES-256-GCM codecs using the current per-user envelope. Retrieval and replay use the row's stored key version, so old Savana v1 records remain Savana and Solar v2 records remain Solar after rotation. The service returns only application reading records/results: never ciphertext, nonce, auth tag, DEK, wrapped DEK, KMS metadata, SQL details, or RLS details.

The PostgreSQL executor uses the existing transaction-local trusted subject context and can set only `app_runtime`, `app_worker`, or `app_crypto` roles. It neither creates pools nor reads configuration. Application callers must inject repositories, codecs, KMS-backed DEK provider, generator, record factory, replay runtime, clock, and ID generator. No HTTP route, JWT verification, cloud KMS, Supabase SDK, payment-provider API, migration, or client database access is introduced here.

The service deliberately does not reserve an entitlement before expensive calculation. It revalidates and conditionally consumes it only in the final transaction with the reading insert. Future API/auth and production-KMS integration remain separate work.
