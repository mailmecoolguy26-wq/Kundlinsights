# SEC-P3 PostgreSQL roles and RLS

SEC-P3 keeps `app` server-only. Mobile and web clients never receive database credentials or query `app` tables through the Supabase Data API. RLS is defense in depth for the trusted application database path; it does not replace SEC-P4/P5 application-layer encryption.

The forward migration creates a non-exposed `security` schema and two non-login, non-superuser, non-bypass roles. `app_runtime` has only user-scoped reads plus the existing user/profile/reading writes needed by the server path. `app_worker` is the distinct trusted payment/entitlement writer; ordinary runtime requests can only read their own payment and entitlement metadata.

The API server verifies an identity before opening a transaction, then uses parameterized `set_config('app.auth_subject', $1, true)`. `security.current_auth_subject()` returns that transaction-local value; `security.current_app_user_id()` maps it to the independent `app.users.id`. Missing or unknown subjects resolve to no ownership and never provision a user. The GUC must be set inside every `BEGIN`/`COMMIT` or `ROLLBACK` scope so pooled connections cannot inherit a prior request's identity.

`current_app_user_id()` is a fixed-search-path `SECURITY DEFINER` helper created by the privileged migration owner. It is callable only by `app_runtime`; it has no dynamic SQL. Production deployment must ensure its owner is the protected migration owner and not the runtime role.

RLS is enabled and forced on all five `app` tables. `app_runtime` cannot update user status or auth subject, cannot delete rows, cannot grant entitlements, and cannot create or change payments. Reading inserts require both the current user ID and, when present, a birth profile owned by that same user. The immutable-reading trigger remains the final guard for reading semantic fields.

No `auth.users` foreign key, Supabase SDK, service role, JWT verification, production encryption, KMS, or client database access is added. The migration is standard PostgreSQL; if a managed Supabase deployment does not permit application migrations to create roles, the same role DDL must be run through the provider-approved privileged database-administration path before granting the application runtime role.
