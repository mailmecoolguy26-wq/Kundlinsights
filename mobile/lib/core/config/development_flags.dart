import 'package:flutter/foundation.dart';

/// Explicit, compile-time development switches for local visual testing.
///
/// These switches are intentionally inert outside debug builds, even if a
/// matching `--dart-define` is accidentally supplied to a profile or release
/// build.
abstract final class DevelopmentFlags {
  static const bool _careerPremiumUiPreviewBuildFlag = bool.fromEnvironment(
    'CAREER_PREMIUM_UI_PREVIEW',
    defaultValue: false,
  );
  static const bool _appleLocalStoreKitTestingBuildFlag = bool.fromEnvironment(
    'APPLE_LOCAL_STOREKIT_TESTING',
    defaultValue: false,
  );

  static bool get careerPremiumUiPreviewEnabled =>
      isCareerPremiumUiPreviewEnabled(
        debugMode: kDebugMode,
        buildFlag: _careerPremiumUiPreviewBuildFlag,
      );

  /// Enables a client-only StoreKit-local entitlement seam. This must never
  /// activate for profile or release builds, even when a build define exists.
  static bool get appleLocalStoreKitTestingEnabled =>
      isAppleLocalStoreKitTestingEnabled(
        debugMode: kDebugMode,
        buildFlag: _appleLocalStoreKitTestingBuildFlag,
      );

  @visibleForTesting
  static bool isCareerPremiumUiPreviewEnabled({
    required bool debugMode,
    required bool buildFlag,
  }) => debugMode && buildFlag;

  @visibleForTesting
  static bool isAppleLocalStoreKitTestingEnabled({
    required bool debugMode,
    required bool buildFlag,
  }) => debugMode && buildFlag;
}
