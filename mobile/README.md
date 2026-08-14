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
