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

## P2 architecture

`lib/app` contains bootstrapping, Material 3 theme, localization, and GoRouter. `lib/features` owns tab placeholders; `lib/shared` has small reusable UI components. Riverpod is the state-management foundation, with no global mutable app state.

Frontend-P2 intentionally contains no authentication, API client, Supabase configuration, birth data, astrology calculation, Dasha/transit calculation, payments, or secrets. Future mobile UI must consume backend-authoritative astrology results. The temporary application identifier is `com.kundlinsights.kundlinsights_mobile`; a final release identifier needs a product/domain decision.
