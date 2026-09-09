import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/insights/insights_screen.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';
import 'package:kundlinsights_mobile/features/readings/career_reading_generation_controller.dart';
import 'package:kundlinsights_mobile/features/readings/domain/career_reading_generation.dart';
import 'package:kundlinsights_mobile/features/readings/domain/reading.dart';
import 'package:kundlinsights_mobile/features/readings/domain/reading_repository.dart';
import 'package:kundlinsights_mobile/features/readings/reading_controller.dart';

void main() {
  testWidgets('locked Career Premium shows Unlock and reuses paywall route', (
    tester,
  ) async {
    final scope = await _InsightsScope.start(
      eligibility: const {'profile-a': CareerEligibility(eligible: false)},
    );
    addTearDown(scope.dispose);
    await _pumpInsights(tester, scope);

    expect(find.text('PREMIUM'), findsOneWidget);
    expect(find.text('UNLOCK'), findsOneWidget);
    expect(find.text('COMING SOON'), findsNWidgets(2));
    expect(find.text('SEE CAREER INSIGHTS'), findsNothing);
    await tester.tap(find.text('UNLOCK'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Career Premium destination'), findsOneWidget);
  });

  testWidgets('active Career Premium opens the existing Readings route', (
    tester,
  ) async {
    final scope = await _InsightsScope.start(
      eligibility: const {'profile-a': CareerEligibility(eligible: true)},
    );
    addTearDown(scope.dispose);
    await _pumpInsights(tester, scope);

    expect(find.text('SEE CAREER INSIGHTS'), findsOneWidget);
    expect(find.text('UNLOCK'), findsNothing);
    expect(find.text('COMING SOON'), findsNWidgets(2));
    await tester.tap(find.text('SEE CAREER INSIGHTS'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Readings destination'), findsOneWidget);
  });

  testWidgets('Career action remains neutral while entitlement is loading', (
    tester,
  ) async {
    final scope = await _InsightsScope.start(
      eligibility: const {'profile-a': CareerEligibility(eligible: false)},
      holdEligibility: true,
    );
    addTearDown(scope.dispose);
    await _pumpInsights(tester, scope);

    expect(scope.generation.eligibilityState, CareerEligibilityState.loading);
    expect(find.text('CHECKING'), findsOneWidget);
    expect(find.text('UNLOCK'), findsNothing);
    expect(find.text('SEE CAREER INSIGHTS'), findsNothing);
  });

  testWidgets('Career entitlement follows selected birth profile', (
    tester,
  ) async {
    final scope = await _InsightsScope.start(
      profiles: const ['profile-a', 'profile-b'],
      eligibility: const {
        'profile-a': CareerEligibility(eligible: true),
        'profile-b': CareerEligibility(eligible: false),
      },
    );
    addTearDown(scope.dispose);
    await _pumpInsights(tester, scope);

    expect(find.text('SEE CAREER INSIGHTS'), findsOneWidget);
    scope.profiles.select(scope.profiles.profiles.last);
    await tester.pump();
    await tester.pump();
    expect(find.text('UNLOCK'), findsOneWidget);
    expect(find.text('SEE CAREER INSIGHTS'), findsNothing);
  });

  testWidgets('Current Transits preserves existing route', (tester) async {
    final scope = await _InsightsScope.start(
      eligibility: const {'profile-a': CareerEligibility(eligible: false)},
    );
    addTearDown(scope.dispose);
    await _pumpInsights(tester, scope);
    await tester.tap(find.text('Current Transits'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Current Transits destination'), findsOneWidget);
  });
}

Widget _app(_InsightsScope scope) {
  final router = GoRouter(
    initialLocation: '/insights',
    routes: [
      GoRoute(
        path: '/insights',
        builder: (_, _) => InsightsScreen(generation: scope.generation),
      ),
      GoRoute(
        path: '/transits',
        name: 'current-transits',
        builder: (_, _) =>
            const Scaffold(body: Text('Current Transits destination')),
      ),
      GoRoute(
        path: '/career-premium',
        builder: (_, _) =>
            const Scaffold(body: Text('Career Premium destination')),
      ),
      GoRoute(
        path: '/readings',
        builder: (_, _) => const Scaffold(body: Text('Readings destination')),
      ),
    ],
  );
  return MaterialApp.router(routerConfig: router);
}

Future<void> _pumpInsights(WidgetTester tester, _InsightsScope scope) async {
  await tester.pumpWidget(_app(scope));
  await tester.pump();
  await tester.pump();
}

class _InsightsScope {
  _InsightsScope._(this.source, this.repository) {
    auth = AuthController(source);
    profiles = ProfileController(repository, auth);
    readings = ReadingController(_Readings(), auth, profiles);
    generation = CareerReadingGenerationController(
      repository.entitlements,
      auth,
      profiles,
      readings,
    );
  }
  final _Auth source;
  final _Profiles repository;
  late final AuthController auth;
  late final ProfileController profiles;
  late final ReadingController readings;
  late final CareerReadingGenerationController generation;

  static Future<_InsightsScope> start({
    required Map<String, CareerEligibility> eligibility,
    List<String> profiles = const ['profile-a'],
    bool holdEligibility = false,
  }) async {
    final scope = _InsightsScope._(
      _Auth(),
      _Profiles(profiles, eligibility, holdEligibility),
    );
    await scope.auth.restore();
    return scope;
  }

  void dispose() {
    generation.dispose();
    readings.dispose();
    profiles.dispose();
    auth.dispose();
  }
}

class _Auth implements AuthRepository {
  final _states = StreamController<AuthSnapshot>.broadcast(sync: true);
  @override
  Stream<AuthSnapshot> get states => _states.stream;
  @override
  Future<String?> accessToken() async => 'token';
  @override
  Future<String?> refreshAccessToken() async => 'token';
  @override
  Future<AuthSnapshot> restore() async =>
      const AuthSnapshot(AuthStatus.authenticated, subject: 'user-a');
  @override
  Future<void> signIn({
    required String email,
    required String password,
  }) async {}
  @override
  Future<bool> signUp({
    required String email,
    required String password,
  }) async => true;
  @override
  Future<void> signOut() async {}
}

class _Profiles implements BirthProfileRepository {
  _Profiles(
    List<String> ids,
    Map<String, CareerEligibility> eligibility,
    bool hold,
  ) : profiles = ids
          .map(
            (id) => BirthProfile(
              id: id,
              displayLabel: id,
              status: 'active',
              birthData: ResolvedBirthData(const {
                'localDate': '1990-01-01',
                'localTime': '10:00:00',
                'timezone': 'Asia/Kolkata',
              }),
            ),
          )
          .toList(),
      entitlements = _Entitlements(eligibility, hold: hold);
  final List<BirthProfile> profiles;
  final _Entitlements entitlements;
  @override
  Future<List<BirthProfile>> list() async => profiles;
  @override
  Future<BirthProfile> get(String id) async =>
      profiles.firstWhere((profile) => profile.id == id);
  @override
  Future<BirthProfile> create({
    required String? displayLabel,
    required ResolvedBirthData birthData,
  }) => throw UnimplementedError();
  @override
  Future<List<PlaceCandidate>> searchPlaces(String query) =>
      throw UnimplementedError();
  @override
  Future<ResolvedBirthData> resolveBirthTime({
    required String placeId,
    required String localDate,
    required String localTime,
  }) => throw UnimplementedError();
}

class _Entitlements implements CareerReadingGenerationRepository {
  _Entitlements(this.values, {required this.hold});
  final Map<String, CareerEligibility> values;
  final bool hold;
  @override
  Future<CareerEligibility> getCareerEligibility({
    required String birthProfileId,
  }) {
    if (!hold) return Future.value(values[birthProfileId]!);
    return Completer<CareerEligibility>().future;
  }

  @override
  Future<CreatedCareerReading> createCareerReading({
    required String birthProfileId,
    required String idempotencyKey,
  }) => throw UnimplementedError();
}

class _Readings implements ReadingRepository {
  @override
  Future<ReadingDetail> getReadingDetail(String readingId) =>
      throw UnimplementedError();
  @override
  Future<List<ReadingSummary>> getReadings({String? birthProfileId}) async =>
      const [];
}
