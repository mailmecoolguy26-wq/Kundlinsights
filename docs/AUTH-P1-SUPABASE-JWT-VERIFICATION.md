# AUTH-P1 Supabase JWT verification

The API accepts only `Authorization: Bearer <access-token>`. The injected production `createSupabaseAuthVerifier()` verifies an asymmetric Supabase access JWT before API-P1 receives a principal. Raw Authorization values and JWTs stop at this verifier and are neither persisted nor passed to application, persistence, crypto, or astrology code.

Configuration is injected by a future deployment bootstrap: `issuer`, `jwksUri`, optional `audience` policy, and an explicit allowlist of asymmetric algorithms. For hosted Supabase, configure the issuer as `https://<project-ref>.supabase.co/auth/v1` and JWKS as `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`. The verifier uses JWKS `kid` resolution and jose's remote JWKS cache, so new signing keys can be trusted through normal JWKS rotation. It does not derive a trusted issuer or JWKS URI from an unverified token.

Verification enforces signature, issuer, configured audience, expiration, and not-before claims. Only approved asymmetric algorithms are accepted. `sub` must be a non-empty verified string and becomes `principal.subject`. The only principal output is `{ provider: 'supabase', subject, isAnonymous }`; `isAnonymous` is taken only from Supabase's verified boolean `is_anonymous` claim. JWT `role` never selects a KundlInsights database role. `service_role` and declared refresh-token JWTs are rejected as end-user authentication.

KundlInsights database roles remain server-controlled: `app_runtime`, `app_worker`, and `app_crypto`. Supabase's legacy `service_role` credential is privileged and must never be sent by mobile or web clients. A client authenticates with Supabase Auth, sends its access token in the bearer header, and never supplies an app-user ID, database credential, or service-role key as authority. Refresh-token exchange remains between the client and Supabase Auth; this API does not accept refresh tokens.

`createApiComposition()` remains dependency-injected and does not read environment variables or create this verifier automatically. `createTestOnlyAuthVerifier()` remains test-only; production bootstrap must inject a real Supabase verifier and a real KMS separately. Unit tests use ephemeral local asymmetric keys and local JWKS resolvers; no production secrets or live Supabase project are used.

Official references: [Supabase JWT signing keys](https://supabase.com/docs/guides/auth/signing-keys), [anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous), and [API keys](https://supabase.com/docs/guides/getting-started/api-keys).
