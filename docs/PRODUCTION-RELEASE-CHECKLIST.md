# TaraVerse production release checklist

This checklist records repository-proven release configuration and separates it
from manual provider-console work. It does not contain credentials or assert
that any external resource has been created.

## Repository release baseline

- iOS display name: `TaraVerse`; bundle ID:
  `com.kundlinsights.kundlinsightsMobile`; deployment target: iOS 15.0.
- Android label: `TaraVerse`; application ID:
  `com.kundlinsights.kundlinsights_mobile`. Release builds require the four
  `TARAVERSE_RELEASE_*` signing inputs documented in
  [Android release signing](ANDROID-RELEASE-SIGNING.md).
- The mobile version is currently `1.0.0+1`. Choose an unused production build
  number before every App Store Connect or Play upload; do not reuse a build
  number already accepted by either store.
- Signed Android builds retain `android.permission.INTERNET` from the main
  manifest. Production mobile API endpoints must be HTTPS; the client accepts
  HTTP only for local loopback development.

## Backend production environment

`src/runtime/production-config.js` validates the following values at startup.
Names are listed only; store secrets in the deployment secret manager.

| Component | Variables | Status | Purpose |
| --- | --- | --- | --- |
| Core runtime | `NODE_ENV`, `HOST`, `PORT` | `NODE_ENV` and `HOST` required; `PORT` optional | Production process binding. |
| Database | `DATABASE_URL`, `DB_SSL_REJECT_UNAUTHORIZED`, `DB_POOL_MAX`, `DB_CONNECTION_TIMEOUT_MS`, `DB_IDLE_TIMEOUT_MS` | URL required; remaining optional/bounded | PostgreSQL with verified TLS. |
| Supabase/Auth | `SUPABASE_AUTH_ISSUER`, `SUPABASE_AUTH_JWKS_URL`, `SUPABASE_AUTH_AUDIENCE`, `SUPABASE_AUTH_ALLOWED_ALGORITHMS` | Required | JWT issuer, JWKS and accepted audience/algorithms. |
| AWS/KMS | `AWS_REGION`, `KUNDLINSIGHTS_KMS_KEY_ARN`, `KUNDLINSIGHTS_HISTORICAL_KMS_KEY_ARNS` | first two required; historical optional | Envelope-key wrapping and historical decrypt allowlist. |
| Maps/time zone | `GOOGLE_MAPS_API_KEY`, `GOOGLE_GEOCODING_TIMEOUT_MS`, `TIMEZONE_RUNTIME_MANIFEST_PATH`, `TIMEZONE_RUNTIME_BINARY_PATH` | key/artifact paths required; timeout optional | Backend geocoding and bundled timezone runtime. |
| OpenAI/AI | `OPENAI_API_KEY`, `OPENAI_CAREER_MODEL`, `OPENAI_CAREER_TIMEOUT_MS`, `CAREER_CHAT_LLM_ENABLED`, `CAREER_CHAT_OPENAI_MODEL`, `CAREER_CHAT_LLM_TIMEOUT_MS` | first two required; timeouts optional; chat flag optional | Career-reading provider and optional constrained Career Chat renderer. Never provide an OpenAI key to mobile. |
| Apple | `APPLE_BUNDLE_ID`, `APPLE_APP_ID`, `APPLE_ROOT_CERTIFICATE_PATHS`, `APPLE_CAREER_PROFILE_UNLOCK_PRODUCT_ID`, `APPLE_CAREER_PREMIUM_ANNUAL_PRODUCT_ID` | all except annual compatibility ID required when Apple purchasing is enabled | StoreKit transaction verification and profile-scoped consumable unlock. |
| Google Play | `GOOGLE_PACKAGE_NAME`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `GOOGLE_CAREER_PROFILE_UNLOCK_PRODUCT_ID`, `GOOGLE_CAREER_PREMIUM_ANNUAL_PRODUCT_ID`, `GOOGLE_RTDN_AUDIENCE`, `GOOGLE_RTDN_ALLOWED_SERVICE_ACCOUNT_EMAIL` | package, service account and one product required when enabled; annual/RTDN legacy compatibility | Android purchase verification; a profile unlock ID is required for the launch flow. |
| Razorpay | `RAZORPAY_ENVIRONMENT`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_PRODUCT_CATALOG_JSON` | all required when enabled | Live checkout and signed webhook verification. `RAZORPAY_ENVIRONMENT` is exactly `PRODUCTION` or `SANDBOX`. |
| CORS/logging | `CORS_ALLOWED_ORIGINS`, `REQUEST_BODY_LIMIT_BYTES`, `SHUTDOWN_TIMEOUT_MS`, `LOG_LEVEL` | origins required; remainder optional/bounded | HTTPS browser-origin allowlist and safe runtime limits. |

Development-only names begin with `DEV_` and belong only to the local runtime;
do not carry development Supabase issuer/JWKS, local KMS, loopback URLs, or
test payment keys into production.

## Mobile build-time defines

The shared production Flutter build needs:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `API_BASE_URL`
- `APPLE_CAREER_PROFILE_UNLOCK_PRODUCT_ID` (iOS only; annual ID is legacy compatibility)
- `GOOGLE_CAREER_PROFILE_UNLOCK_PRODUCT_ID` (Android only; annual ID is legacy compatibility)
- `APPLE_PAYMENT_ENVIRONMENT=PRODUCTION` (iOS when Apple purchase is enabled)
- `RAZORPAY_KEY_ID` and `RAZORPAY_CAREER_PREMIUM_ENABLED=true` only for the
  platform/build that intentionally exposes Razorpay.

The Supabase anonymous key is a public mobile credential. Never put service
role, OpenAI, Razorpay secret/webhook, Google service-account, database, KMS,
or Apple signing credentials in a Dart define.

## Build commands

Provide build-time values through a protected CI variable group or shell
environment, then use the same `--dart-define` set for each build.

```bash
cd mobile
flutter build appbundle --release --build-name=<version> --build-number=<build> \
  --dart-define=SUPABASE_URL="$SUPABASE_URL" \
  --dart-define=SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  --dart-define=API_BASE_URL="$API_BASE_URL" \
  --dart-define=GOOGLE_CAREER_PROFILE_UNLOCK_PRODUCT_ID="$GOOGLE_CAREER_PROFILE_UNLOCK_PRODUCT_ID"

flutter build apk --release --build-name=<version> --build-number=<build> \
  --dart-define=SUPABASE_URL="$SUPABASE_URL" \
  --dart-define=SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  --dart-define=API_BASE_URL="$API_BASE_URL"

flutter build ipa --release --build-name=<version> --build-number=<build> \
  --dart-define=SUPABASE_URL="$SUPABASE_URL" \
  --dart-define=SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  --dart-define=API_BASE_URL="$API_BASE_URL" \
  --dart-define=APPLE_CAREER_PROFILE_UNLOCK_PRODUCT_ID="$APPLE_CAREER_PROFILE_UNLOCK_PRODUCT_ID" \
  --dart-define=APPLE_PAYMENT_ENVIRONMENT=PRODUCTION
```

For Android, additionally set `TARAVERSE_RELEASE_STORE_FILE`,
`TARAVERSE_RELEASE_STORE_PASSWORD`, `TARAVERSE_RELEASE_KEY_ALIAS`, and
`TARAVERSE_RELEASE_KEY_PASSWORD`. For iOS, open `ios/Runner.xcworkspace` in
Xcode, select the Apple Developer team for automatic signing (or inject a
matching manual provisioning profile in CI), archive the `Runner` scheme, and
upload the archive to App Store Connect.

## Manual provider-console checklist

### Apple

1. Register the exact bundle ID in the Apple Developer account; enable In-App
   Purchase for that App ID and create the App Store Connect record.
2. Create and activate a **consumable** IAP whose product ID exactly equals
   `APPLE_CAREER_PROFILE_UNLOCK_PRODUCT_ID`. It unlocks one selected birth
   profile; set pricing, localization/display name, review screenshot and IAP
   review metadata.
3. Configure the App Store Connect app: store listing, screenshots, support
   URL, privacy-policy URL, age/content rating, App Privacy disclosure, and
   TestFlight build/testers. Configure App Store Server Notifications only if
   the retained legacy annual-subscription integration is enabled.
4. Supply production Apple App ID, root-certificate deployment files, and
   product ID to the backend. Create sandbox testers for StoreKit testing.
5. Obtain an Apple Distribution certificate and provisioning configuration.
   The repo assumes automatic signing locally; CI must provide its own signing
   credentials/profile or an approved signing integration.

### Google Play

1. Create the Play Console app for `com.kundlinsights.kundlinsights_mobile`;
   enroll in Play App Signing and create/secure the upload key.
2. Create and activate a consumable/in-app product whose ID equals
   `GOOGLE_CAREER_PROFILE_UNLOCK_PRODUCT_ID`; set pricing and license testers.
3. Create an internal testing release by uploading a signed AAB. Complete store
   listing, screenshots, privacy policy, Data Safety, content rating, target
   audience, and app-access declarations.
4. Grant a service account least-privilege Play Developer API access; configure
   RTDN only if the optional legacy annual flow is enabled.

### Razorpay

1. Activate the Live account, complete required KYC and settlement/bank setup,
   and obtain Live keys.
2. Set `RAZORPAY_ENVIRONMENT=PRODUCTION`, a server-only key secret and webhook
   secret, and the trusted server catalog. The launch catalog is documented in
   [Razorpay payment foundation](razorpay-payment-foundation.md).
3. Configure `https://<api-host>/v1/payments/razorpay/webhook` for
   `payment.captured` and `order.paid`, using a distinct Live secret.
4. Validate one captured Live payment and verify that exactly its selected
   `birthProfileId` receives the entitlement.

### Supabase/Auth

1. Configure the production project URL and publishable/anonymous mobile key;
   set the backend issuer, JWKS URL, audience and allowed algorithms for the
   same project.
2. Enable phone OTP, configure the SMS provider/sender/template, rate limits,
   anti-abuse/CAPTCHA settings where applicable, and tested delivery countries.
3. Configure production redirect URLs/origins where Supabase flows require
   them. Native mobile requests use bearer tokens; do not use a development
   loopback API endpoint or development JWT configuration.

## Store disclosure data inventory

The code handles account/authentication phone numbers and account identifiers;
birth-profile label, birth date, birth time and selected place/location data;
astrology outputs and saved readings; Career history/calibration events;
profile-scoped purchase evidence and transaction/order identifiers; and API
request/error operational metadata. Optional provider calls may process Career
Reading/Career Chat structured inputs through the configured OpenAI service.
Store privacy and Data Safety answers must be completed against the deployed
provider configuration and retention policy, not this checklist alone.

## Current repository gaps / external blockers

- There is no CI/CD workflow or versioning automation in this repository.
  Release owners must select and record each store-accepted build number.
- No App Store Connect record, Play Console record, provider credentials,
  signing certificate, upload key, live Razorpay setup, or Supabase SMS setup
  is proven by source control. These are manual external prerequisites.
- Search found no remaining customer-facing `KundliInsights`/`Kundlinsights`
  branding in the mobile store metadata. Compatibility-sensitive package and
  bundle identifiers intentionally retain the historical namespace.
