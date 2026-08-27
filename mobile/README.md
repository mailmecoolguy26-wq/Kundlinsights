# KundlInsights Mobile

The shared Flutter client for KundlInsights iOS and Android.

## Requirements

- Flutter 3.47.0 stable (Dart 3.13.0)
- Xcode for iOS
- Android Studio / Android SDK for Android

## Commands

```sh
flutter pub get
flutter analyze
flutter test
flutter run
```

## P3 authentication and API foundation

`lib/app` bootstraps validated build-time configuration, Supabase once, Riverpod, localization, and GoRouter. `lib/features/auth` owns the authentication repository, controller, and auth screens. The router observes the controller: unauthenticated sessions reach Login/Sign Up only; authenticated sessions reach the five-tab shell.

Required P3 packages are `supabase_flutter`, `dio`, and `flutter_secure_storage`. Use safe placeholders during local development:

```sh
flutter run \
  --dart-define=SUPABASE_URL=https://your-project.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your-public-client-key \
  --dart-define=API_BASE_URL=https://api.example.invalid
```

## Local development backend

Start the backend separately with `NODE_ENV=development npm run start:dev` and
the required `DEV_*` variables from the repository root. The backend uses a
real development PostgreSQL/Supabase-compatible database, Supabase JWT
verification, and the local development KMS adapter; it does not require AWS
KMS, a Swiss Ephemeris commercial license, or OpenAI credentials to start.

Pass the backend URL at build time. For an iOS simulator use
`--dart-define=API_BASE_URL=http://localhost:3000`; for an Android Emulator use
`--dart-define=API_BASE_URL=http://10.0.2.2:3000`. A physical device needs an
HTTPS development endpoint reachable from that device. Do not commit access
tokens, database URLs, service-role keys, or local environment files.

No key, JWT, refresh token, database credential, service-role key, or `.env` file is committed. `SUPABASE_ANON_KEY` is a public client credential only. Supabase Flutter owns its native mobile session persistence; KundlInsights deliberately does not duplicate access or refresh tokens. `flutter_secure_storage` is reserved for future app-owned sensitive state.

`lib/core/api` provides the sole Dio boundary. It obtains the current access token from the auth repository, injects `Authorization: Bearer <access-token>`, never transmits a refresh token, maps failures safely, captures backend request IDs, and can perform exactly one refresh-and-retry after a 401. `ApiMeRepository` is the minimal `GET /v1/me` authenticated integration boundary; P3 does not call it automatically and does not expose backend user IDs.

The mobile client contains no astrology calculation, birth-profile implementation, payments, entitlements, or live-service test. Future UI must consume secure backend-authoritative results. The temporary application identifier is `com.kundlinsights.kundlinsights_mobile`; a final release identifier needs a product/domain decision.

## P4 birth profiles

P4 adds the authenticated first-profile flow: profile label, birth date, exact local birth time, API-backed place search, backend birth-time resolution, review, and profile creation. The app uses `GET /v1/places/search`, `POST /v1/places/resolve-birth-time`, and the existing birth-profile endpoints through the sole Dio client. It does not calculate latitude, longitude, timezone, historical offset, or UTC; it submits the backend-resolved `birthData` unchanged.

Place-search results show the required `Google Maps` attribution. The client does not store search history or log place queries, and it never receives a Google Maps API key. The profile controller is Riverpod-scoped and keeps the active profile as in-memory UI state only. It clears the collection and active selection on logout, so a subsequent user does not see prior-user profile state. Profile edit and delete are deliberately unavailable because the backend has no matching routes.

## P5 natal summary

P5 integrates the authenticated backend contract `GET /v1/birth-profiles/:id/natal-summary` through the existing sole Dio client. The request uses only the active birth-profile ID; Flutter does not resend birth data, identity data, coordinates, timezone, or any astrology settings.

`lib/features/natal` maps the frozen public DTO into a safe client model and scopes its in-memory state to the authenticated subject plus active birth profile. On a profile or identity change, the prior summary clears before another profile can render. A same-subject token refresh leaves the active summary intact. No natal-summary payload is persisted or logged.

Home and Kundli display only backend-authoritative Lahiri/Mean-Node natal fields. Flutter formats supplied degrees, longitude, and speed for presentation but performs no astrological calculation, sign derivation, Nakshatra/Pada calculation, house calculation, or retrograde inference. P5 adds factual planetary-position and planet-detail views.

## P6 North Indian D1 chart

P6 implements the North Indian D1 chart as a fixed-house, responsive visual layout. All twelve house regions are rendered, with House 1/Lagna in the conventional top-centre region. House numbers and signs are supplied authoritatively by API-P3.1, while each Graha's placement uses its API-P3 authoritative house value. Flutter only maps an already-authoritative house number to visual geometry; it never derives a Rashi sequence, a house, or a sign from the Ascendant or longitude.

The chart supports multiple Grahas per house, a backend-supplied retrograde marker, and a separate Lagna marker. A house tap shows only its authoritative number, sign, and contained planets; a planet tap reuses the existing P5 Planet Detail route. An accessible expandable list represents every house with its sign and planets (or no planets). The same profile and authenticated-user isolation that protects natal-summary state therefore also protects chart state; a prior chart clears before another profile or user can render it.

The client continues to perform no local astrology calculation.

## P7 D9 Navamsa and D10 Dasamsa

P7 adds authenticated D9 and D10 views using `GET /v1/birth-profiles/:id/divisional-charts/d9` and `GET /v1/birth-profiles/:id/divisional-charts/d10`. They share the P6 North Indian fixed-house renderer, but receive all Varga signs, degrees, houses, Ascendant, and Graha placements directly from the API-P4A DTO. Flutter never calculates a Varga, derives a sign or house, or infers retrograde/Nakshatra data. D11 is not exposed. Vimshottari remains the next backend API milestone.

## P8 Vimshottari state and timeline

P8 uses only the authenticated API-P4B endpoints: `GET /v1/birth-profiles/:id/vimshottari?at=<UTC RFC3339>` for the current Mahadasha, Antardasha, and Pratyantardasha, and `GET /v1/birth-profiles/:id/vimshottari/timeline?from=<UTC RFC3339>&to=<UTC RFC3339>&level=md|ad|pd` for a flat, chronological timeline.

Flutter sends an explicit UTC instant for current state and only UTC `from`, `to`, and `level` for timelines. It uses safe one-, three-, and five-year presets; the largest is 1,825 days and stays below the backend’s 1,827-civil-day maximum. The backend remains authoritative for the production solar-return ruleset, period boundaries, hierarchy, and all Dasha calculation. The mobile client exposes neither a ruleset selector nor any prediction or interpretation, and it never sends raw birth data or calculates Vimshottari locally.

P8 state is scoped to the authenticated subject, active birth profile, and the selected timeline query (level and UTC window). When Profile A changes to Profile B, Profile A’s current and timeline state is invalidated immediately; it cannot render beneath Profile B, which loads independently. A direct authenticated User A-to-User B change clears User A’s Dasha state immediately, while a token or session refresh for the same authenticated subject retains valid state.

Each asynchronous current or timeline request is bound to that state identity. A late response is discarded after a profile or authenticated-user change, or after a newer timeline level/window request. For example, if an MD request begins, the user selects PD, and the earlier MD response arrives last, it cannot overwrite the PD result. Likewise, a late Profile A response is discarded after switching to Profile B.

## P9 Current Transits / Gochar

P9 uses the authenticated API-P5A snapshot endpoint, `GET /v1/birth-profiles/:id/transits?at=<UTC RFC3339>`. The app sends a new explicit current UTC instant for each load or refresh; it never sends raw birth data or a client user ID. The backend is authoritative for all nine Grahas, their transit sign, degree within sign, natal-house placement, motion/retrograde state, and factual Sade Sati status.

Flutter only formats the supplied values. It does not calculate transits, Rashis, degrees, houses, retrograde, or Sade Sati. Same-Rashi associations, Transit Drishti, transit events, predictions, and interpretations are deliberately absent from P9.

Transit state is scoped to the authenticated subject and active profile. A profile or user change clears prior state immediately; a same-subject token refresh preserves it. Generation identities prevent late responses from an earlier profile or refresh from overwriting the newest snapshot.

## P10 Ashtakavarga

P10 presents the factual API-P5B response from `GET /v1/birth-profiles/:id/ashtakavarga` through the existing authenticated Dio client. Kundli provides the route to Ashtakavarga; it is not a sixth bottom-navigation tab. The view shows SAV as twelve authoritative sign scores, BAV for exactly Sun, Moon, Mars, Mercury, Jupiter, Venus, and Saturn, plus separate Lagna BAV. Rahu and Ketu BAV are not exposed.

All scores remain sign-oriented. Flutter does not convert signs to houses, use the Ascendant to reinterpret them, calculate Ashtakavarga, normalize or rank scores, or add strength meanings, predictions, or interpretations. Shodhana, Pinda, contributor matrices, and calculation traces are not available in P10.

Ashtakavarga state is scoped to the authenticated subject and active birth profile. It clears immediately for a profile or user change, remains for a same-subject token refresh, and its request generation prevents late responses from an earlier profile or refresh from overwriting current data. No raw birth data or client user ID is sent.
