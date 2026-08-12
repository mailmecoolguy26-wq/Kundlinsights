# DB-P1 Persistence Contracts and In-Memory Adapters

DB-P1 establishes a dependency-free, storage-agnostic application persistence boundary. It adds no database client, schema, network access, authentication, cloud resource, or astrology behavior. The core engine and `src/readings` do not import or depend on `src/persistence`.

## Contracts

`src/persistence` exposes five explicit repository contracts and deterministic in-memory implementations:

- `UserRepository`: create, fetch, and status update users without birth data.
- `BirthProfileRepository`: create, fetch, list, update, and archive mutable application birth profiles.
- `ReadingRepository`: insert, fetch, list, and archive immutable committed reading-record snapshots.
- `EntitlementRepository`: create, fetch, list active (at an injected evaluation instant), and consume finite entitlements.
- `PaymentRepository`: insert, fetch, and find a payment by a provider-scoped transaction identifier.

The contract is intentionally generic. A future `Supabase*Repository` can implement the same methods without changing astrology or reading/replay code.

## Snapshot and profile rules

Birth profiles are mutable application data. A reading is a distinct historical snapshot created with the existing `kundlinsights-reading-record-v1` contract. A profile edit never changes a previously inserted reading record, its engine profile, calculation provenance, structured output, rendered output, or integrity digests. There is deliberately no `updateReadingRecord()` method for calculation content; regenerating produces a new `readingId`.

Calculation digests are not globally unique. `readingId` is the storage identity, and records with equal calculation digests are valid. Records preserve the exact engine profile and Dasha provenance; repositories never select a current default, upgrade a profile, or convert Savana chronology to Solar chronology. Timezone provenance is stored exactly and never resolved or transformed by persistence.

## Determinism, ordering, and immutability

Each adapter is an isolated instance with no global state, filesystem persistence, or network use. Stored values are defensively canonicalized and every returned value is deeply frozen. Birth-profile lists sort by `createdAt` ascending then ID. Reading lists sort by embedded record `createdAt` descending then `readingId`. Active entitlement lists sort by `validFrom` ascending then ID. No documented behavior depends on `Map` insertion order.

Stable machine-readable failures include `DUPLICATE_USER_ID`, `DUPLICATE_AUTH_SUBJECT`, `BIRTH_PROFILE_NOT_FOUND`, `DUPLICATE_READING_ID`, `READING_NOT_FOUND`, `ENTITLEMENT_INACTIVE`, `ENTITLEMENT_EXPIRED`, `ENTITLEMENT_EXHAUSTED`, and `DUPLICATE_PROVIDER_TRANSACTION`. Repositories do not log sensitive birth, coordinate, provenance, reading, or payment payloads.

## Ownership and privacy boundary

Repository records retain explicit user ownership. Birth profiles, readings, entitlements, and payments each have a `userId`; a reading may retain a `birthProfileId`. This layer validates identifiers and local ownership metadata only. It does not create authentication, RLS, or fake access control. A future database adapter must enforce ownership server-side.

Birth details and reading contents are sensitive. DB-P1 deliberately stores only caller-supplied application values in memory; it implements neither encryption nor logging. DB-P2/DB-P4 are expected to add an encrypted persistent-store strategy, database schema, authentication, and RLS policy. No Mapbox response model is persisted and no Mapbox dependency is added.

## Deferred work

DB-P1 does not include SQL, Supabase, database SDKs, auth, RLS, encryption implementation, payment-provider integration, pricing/subscriptions, object storage, cloud setup, networking, or integration into ordinary reading generation.
