# API-P1 server boundary

API-P1 uses Fastify 5.11.0 only as transport. `createApi` receives injected `AuthVerifier`, SEC-P2 user resolver, secure birth-profile service, SEC-P6 reading service, and optional entitlement service; it creates no pool, provider, KMS, or crypto dependency.

Routes are `GET /health`, `GET /ready`, `GET /v1/me`, profile create/list/get, reading create/get, reading replay, and optionally entitlements. Requests require an injected verifier to turn an Authorization credential into a verified principal. Route code never decodes a JWT, trusts client owner/user identifiers, or selects an engine profile/ruleset.

`POST /v1/readings` requires a 1–128 character `Idempotency-Key` header. Request bodies are limited to 16 KiB. Responses use allowlisted DTOs and include only safe request IDs; ciphertext, nonces, keys, KMS references, DB rows, SQL/RLS details, and auth subjects are omitted. Invalid authentication is 401; hidden ownership failures are 404; invalid input is 400; exhausted entitlement is 403.

Production CORS must use an injected allowlist—never authenticated wildcard CORS. Bearer-token APIs do not use cookie CSRF semantics; reassess if cookies are introduced. Rate limiting, security headers, a production Supabase verifier, and a production KMS provider are deferred. The API remains portable and does not select hosting or package Swiss runtime. Production KMS provider: **UNDECIDED**.
