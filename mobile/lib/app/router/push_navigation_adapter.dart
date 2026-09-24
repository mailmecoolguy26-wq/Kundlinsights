import '../../core/push/push_notification_service.dart';
import '../../features/profiles/domain/birth_profile.dart';
import '../../features/readings/career_reading_generation_controller.dart';
import '../../features/readings/domain/reading_repository.dart';

/// Typed, authorization-aware bridge between a push destination and GoRouter.
abstract interface class PushRouteNavigator {
  void go(String location);
}

class PushNavigationAdapter {
  PushNavigationAdapter({
    required this.router,
    required this.profiles,
    required this.selectProfile,
    required this.readings,
    required this.refreshCareerEligibility,
    required this.careerEligibilityState,
  });

  static const homeLocation = '/home';
  static const profilesLocation = '/profiles';
  static const careerHistoryLocation = '/career-calibration';
  static const readingsLocation = '/readings';
  static const careerPaywallLocation = '/career-premium';

  final PushRouteNavigator router;
  final List<BirthProfile> Function() profiles;
  final void Function(BirthProfile profile) selectProfile;
  final ReadingRepository readings;
  final Future<void> Function() refreshCareerEligibility;
  final CareerEligibilityState Function() careerEligibilityState;

  Future<bool> navigate(PushDestinationIntent intent) async {
    switch (intent.destinationType) {
      case 'HOME':
        router.go(homeLocation);
        return true;
      case 'BIRTH_PROFILE':
        final profile = _ownedProfile(intent.birthProfileId);
        if (intent.birthProfileId != null && profile == null) return false;
        if (profile != null) selectProfile(profile);
        router.go(profilesLocation);
        return true;
      case 'CAREER_HISTORY':
        return _withOwnedProfile(intent.birthProfileId, careerHistoryLocation);
      case 'CAREER_READING':
        return _withOwnedProfile(intent.birthProfileId, readingsLocation);
      case 'CAREER_PAYWALL':
        return _openCareerPaywall(intent.birthProfileId);
      case 'READING_DETAIL':
        return _openReadingDetail(intent.readingId);
      default:
        return false;
    }
  }

  Future<bool> _withOwnedProfile(String? profileId, String location) async {
    final profile = _ownedProfile(profileId);
    if (profile == null) return false;
    selectProfile(profile);
    router.go(location);
    return true;
  }

  Future<bool> _openCareerPaywall(String? profileId) async {
    final profile = _ownedProfile(profileId);
    if (profile == null) return false;
    selectProfile(profile);
    try {
      await refreshCareerEligibility();
    } catch (_) {
      return false;
    }
    final state = careerEligibilityState();
    if (state == CareerEligibilityState.error ||
        state == CareerEligibilityState.loading ||
        state == CareerEligibilityState.initial) {
      return false;
    }
    router.go(
      state == CareerEligibilityState.eligible
          ? readingsLocation
          : careerPaywallLocation,
    );
    return true;
  }

  Future<bool> _openReadingDetail(String? readingId) async {
    if (readingId == null || readingId.isEmpty) return false;
    try {
      final reading = await readings.getReadingDetail(readingId);
      final profile = _ownedProfile(reading.birthProfileId);
      if (profile == null) return false;
      selectProfile(profile);
      router.go('$readingsLocation/detail/$readingId');
      return true;
    } catch (_) {
      return false;
    }
  }

  BirthProfile? _ownedProfile(String? profileId) {
    if (profileId == null || profileId.isEmpty) return null;
    for (final profile in profiles()) {
      if (profile.id == profileId) return profile;
    }
    return null;
  }
}
