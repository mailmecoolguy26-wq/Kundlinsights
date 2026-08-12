# SEC-P2 Auth identity to application-user provisioning

SEC-P2 is a server-side boundary between an upstream authentication verifier and DB-P1 user repositories. It does not authenticate, parse, or verify JWTs. It accepts only a verified principal with `provider`, exact non-empty `subject`, and boolean `isAnonymous`.

For Supabase, the verified `auth.users.id` string is persisted as `app.users.auth_subject`. The application user ID remains an independently generated opaque ID. Client-provided user, owner, or application-user IDs are ignored and cannot control provisioning.

`resolveOrProvisionAppUser` receives injected `userRepository`, `idGenerator`, and `now` dependencies. It resolves a subject first, creates an active user only when absent, and recovers from a `DUPLICATE_AUTH_SUBJECT` race by loading the one authoritative winner. Existing non-active users fail with `APP_USER_DISABLED`; provisioning never reactivates users or rewrites auth subjects.

Anonymous principals are rejected for durable provisioning in SEC-P2. Account linking/reassignment is explicitly deferred to a future privileged, audited flow. Supabase SDK/session integration is also deferred: SEC-P2 neither installs nor requires `@supabase/supabase-js`.

RLS, database roles, production encryption, KMS, key storage, and client table access are deferred. The PostgreSQL schema already has the unique `auth_subject` column required by this phase; DB-P2 is unchanged.
