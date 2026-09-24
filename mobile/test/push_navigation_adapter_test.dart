import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/app/router/push_navigation_adapter.dart';
import 'package:kundlinsights_mobile/core/push/push_notification_service.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/readings/career_reading_generation_controller.dart';
import 'package:kundlinsights_mobile/features/readings/domain/reading.dart';
import 'package:kundlinsights_mobile/features/readings/domain/reading_repository.dart';

void main() {
  late _Routes routes;
  late List<BirthProfile> profiles;
  late List<String> selected;
  late _Readings readings;
  late CareerEligibilityState eligibility;
  late bool eligibilityFails;
  late PushNavigationAdapter adapter;

  setUp(() {
    routes = _Routes();
    profiles = [_profile('profile-a')];
    selected = [];
    readings = _Readings();
    eligibility = CareerEligibilityState.ineligible;
    eligibilityFails = false;
    adapter = PushNavigationAdapter(
      router: routes,
      profiles: () => profiles,
      selectProfile: (profile) => selected.add(profile.id),
      readings: readings,
      refreshCareerEligibility: () async {
        if (eligibilityFails) throw StateError('unavailable');
      },
      careerEligibilityState: () => eligibility,
    );
  });

  test('HOME and BIRTH_PROFILE use typed locations', () async {
    expect(await adapter.navigate(_intent('HOME')), isTrue);
    expect(routes.locations, [PushNavigationAdapter.homeLocation]);

    expect(
      await adapter.navigate(_intent('BIRTH_PROFILE', profile: 'profile-a')),
      isTrue,
    );
    expect(selected, ['profile-a']);
    expect(routes.locations.last, PushNavigationAdapter.profilesLocation);
    expect(await adapter.navigate(_intent('BIRTH_PROFILE')), isTrue);
    expect(routes.locations.last, PushNavigationAdapter.profilesLocation);
    expect(
      await adapter.navigate(_intent('BIRTH_PROFILE', profile: 'missing')),
      isFalse,
    );
  });

  test('Career destinations require an owned profile and select it', () async {
    expect(
      await adapter.navigate(_intent('CAREER_HISTORY', profile: 'profile-a')),
      isTrue,
    );
    expect(routes.locations.last, PushNavigationAdapter.careerHistoryLocation);
    expect(
      await adapter.navigate(_intent('CAREER_READING', profile: 'profile-a')),
      isTrue,
    );
    expect(routes.locations.last, PushNavigationAdapter.readingsLocation);
    expect(
      await adapter.navigate(_intent('CAREER_HISTORY', profile: 'other')),
      isFalse,
    );
    expect(selected, ['profile-a', 'profile-a']);
  });

  test(
    'Career paywall resolves profile-scoped entitlement and fails closed',
    () async {
      eligibility = CareerEligibilityState.eligible;
      expect(
        await adapter.navigate(_intent('CAREER_PAYWALL', profile: 'profile-a')),
        isTrue,
      );
      expect(routes.locations.last, PushNavigationAdapter.readingsLocation);

      eligibility = CareerEligibilityState.ineligible;
      expect(
        await adapter.navigate(_intent('CAREER_PAYWALL', profile: 'profile-a')),
        isTrue,
      );
      expect(
        routes.locations.last,
        PushNavigationAdapter.careerPaywallLocation,
      );

      eligibilityFails = true;
      expect(
        await adapter.navigate(_intent('CAREER_PAYWALL', profile: 'profile-a')),
        isFalse,
      );
    },
  );

  test(
    'READING_DETAIL authorizes its returned profile before navigation',
    () async {
      readings.profileId = 'profile-a';
      expect(
        await adapter.navigate(_intent('READING_DETAIL', reading: 'r-1')),
        isTrue,
      );
      expect(routes.locations.last, '/readings/detail/r-1');
      expect(selected.last, 'profile-a');

      readings.profileId = 'other';
      expect(
        await adapter.navigate(_intent('READING_DETAIL', reading: 'r-2')),
        isFalse,
      );
      readings.error = true;
      expect(
        await adapter.navigate(_intent('READING_DETAIL', reading: 'r-3')),
        isFalse,
      );
    },
  );

  test(
    'drain defers background and foreground taps until ready and deduplicates',
    () async {
      final queue = PushIntentQueue();
      final intent = _intent('HOME');
      queue.enqueue(intent, identity: 'cold-start');
      queue.enqueue(intent, identity: 'cold-start');
      var calls = 0;
      final drain = PushIntentDrain(
        queue: queue,
        navigate: (_) async {
          calls++;
          return true;
        },
      );
      expect(await drain.drain(), isFalse);
      drain.markReady();
      expect(await drain.drain(), isTrue);
      // The same queue API is used by a foreground banner tap.
      queue.enqueue(intent, identity: 'foreground-tap');
      expect(await drain.drain(), isTrue);
      expect(calls, 2);
    },
  );
}

PushDestinationIntent _intent(
  String type, {
  String? profile,
  String? reading,
}) => PushDestinationIntent(
  destinationType: type,
  birthProfileId: profile,
  readingId: reading,
);

BirthProfile _profile(String id) => BirthProfile(
  id: id,
  displayLabel: id,
  status: 'ACTIVE',
  birthData: const ResolvedBirthData({
    'localDate': '1990-01-01',
    'localTime': '12:00',
    'timezone': 'Asia/Kolkata',
  }),
);

class _Routes implements PushRouteNavigator {
  final locations = <String>[];
  @override
  void go(String location) => locations.add(location);
}

class _Readings implements ReadingRepository {
  String profileId = 'profile-a';
  bool error = false;

  @override
  Future<ReadingDetail> getReadingDetail(String readingId) async {
    if (error) throw StateError('unavailable');
    return ReadingDetail(
      readingId: readingId,
      birthProfileId: profileId,
      domain: 'CAREER',
      status: 'READY',
      createdAt: '2026-01-01T00:00:00.000Z',
      readingInstant: '2026-01-01T00:00:00.000Z',
      locale: 'en-IN',
      content: const ReadingContent(
        domain: 'CAREER',
        locale: 'en-IN',
        sections: [],
      ),
    );
  }

  @override
  Future<List<ReadingSummary>> getReadings({String? birthProfileId}) async =>
      const [];
}
