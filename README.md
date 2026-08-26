# KundlInsights

## Production OpenAI Career generation

Production Career generation requires `OPENAI_API_KEY` and `OPENAI_CAREER_MODEL`; `OPENAI_CAREER_TIMEOUT_MS` is optional (default `15000`, range `100–30000`). Configure these only in the production secret manager and redeploy to rotate keys. Do not add keys to source control, client applications, or normal test/CI environments.

Astronomical calculations use an explicit Layer 1 provider boundary. The default development provider remains provisional; the Swiss Ephemeris provider is implemented only for license-gated engineering validation and is not production authority until its deployment license and data-manifest gates are satisfied.

## Local development runtime

Run `npm run start:dev` with `NODE_ENV=development`. Required local configuration is `DEV_DATABASE_URL`, `DEV_SUPABASE_AUTH_ISSUER`, `DEV_SUPABASE_AUTH_JWKS_URL`, `DEV_SUPABASE_AUTH_AUDIENCE`, and a non-production 32-byte base64 `DEV_LOCAL_KMS_KEY_BASE64`. `DEV_HOST` defaults to `0.0.0.0`; `DEV_PORT` defaults to `3000`.

### Development Career entitlement fixture

For an authenticated development user to exercise the normal Career-reading entitlement and consumption flow, run `NODE_ENV=development DEV_AUTH_BEARER_TOKEN="Bearer <legitimate development access token>" npm run dev:grant-career-entitlement`. The command verifies the supplied Supabase principal, resolves that principal's application user, and creates or reuses one active `CAREER` entitlement through the existing repository contract. It accepts neither a user ID nor a product argument.

This capability is only composed by the development runtime; it has no HTTP route and is not imported or registered by the production runtime. It is developer tooling, not payment simulation or proof of purchase, and must never be used for launch or production.

This runtime preserves encrypted PostgreSQL persistence using the local development envelope key. It requires no AWS KMS, Swiss license, or OpenAI credentials merely to boot. It uses the provisional/reference Astronomy Engine provider and must never be used for commercial production.

To enable backend-authoritative development birth-place resolution, additionally provide `GOOGLE_MAPS_API_KEY` plus explicit `TIMEZONE_RUNTIME_MANIFEST_PATH` and `TIMEZONE_RUNTIME_BINARY_PATH`. Any partial configuration fails closed. Build the external artifacts from the approved TBB 2026c/1970 GeoJSON with `node scripts/build-timezone-runtime-artifact.js <source-json> <external-output-directory>`; this creates `tbb-2026c-1970.manifest.json` and `tbb-2026c-1970.bin`. These files and the Google key remain outside the repository.

KundlInsights is a production-grade iOS and Android application for **Vedic / Jyotish astrology**.

It is intentionally being built in layers, beginning with a deterministic astronomical calculation foundation and progressing through charting, dashas, transits, Ashtakavarga, event analysis, prediction, interpretation, mobile delivery, and subscriptions.

## Astrology commitment

KundlInsights uses only the following astrology standard:

- Vedic / Jyotish, with Parashari as the primary framework
- Sidereal zodiac using Lahiri / Chitrapaksha ayanamsha
- 27 Nakshatras, Vimshottari Dasha, Vedic Drishti, SAV/BAV Ashtakavarga, and Vedic divisional charts

It does not use tropical zodiac, Western house systems, Western aspects, or Western interpretation rules.

The authoritative technical and domain decisions are documented in [docs](docs/).

## Repository layout

```
docs/   Architecture, astrology standards, and phased delivery plan
src/    Application and domain source code (not implemented yet)
tests/  Automated test suites and reference fixtures (not implemented yet)
```

## Current status

Layers 1–15A are implemented. Layer 15A composes existing Layer 12–14 contracts into a deterministic Career reading and rendered English output from supplied precomputed evidence only. See [LAYER-15A-CAREER-READING-ORCHESTRATOR.md](docs/LAYER-15A-CAREER-READING-ORCHESTRATOR.md).

See [ARCHITECTURE.md](docs/ARCHITECTURE.md), [ASTROLOGY-STANDARDS.md](docs/ASTROLOGY-STANDARDS.md), and [DEVELOPMENT-PLAN.md](docs/DEVELOPMENT-PLAN.md).
