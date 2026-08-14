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

The client continues to perform no local astrology calculation. D9, D10, and Vimshottari Dasha views remain deferred to later milestones.
