import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/divisional/divisional_chart_controller.dart';
import 'package:kundlinsights_mobile/features/divisional/domain/divisional_chart.dart';
import 'package:kundlinsights_mobile/features/divisional/domain/divisional_chart_repository.dart';
import 'package:kundlinsights_mobile/features/kundli/kundli_screen.dart';
import 'package:kundlinsights_mobile/features/kundli/north_indian_chart.dart';
import 'package:kundlinsights_mobile/features/natal/domain/natal_summary.dart';
import 'package:kundlinsights_mobile/features/natal/domain/natal_summary_repository.dart';
import 'package:kundlinsights_mobile/features/natal/natal_summary_controller.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';
import 'package:kundlinsights_mobile/l10n/app_localizations.dart';

void main() {
  test('Chandra chart rotates authoritative D1 signs from the Moon', () {
    final summary = _summary('profile-a');
    final houses = buildChandraChartHouses(summary);

    expect(houses, hasLength(12));
    expect(houses.first.sign.rashiIndex, 11);
    expect(houses.first.planets.map((planet) => planet.body), contains('Moon'));
    expect(houses[2].sign.rashiIndex, 1);
    expect(houses[2].planets.map((planet) => planet.body), contains('Sun'));
  });

  testWidgets('Kundli V2 groups only supported customer surfaces', (
    tester,
  ) async {
    final source = _AuthSource();
    final auth = AuthController(source);
    await auth.restore();
    final profiles = ProfileController(_Profiles(), auth);
    await profiles.load();
    final natal = NatalSummaryController(_Natal(), auth, profiles);
    final divisional = DivisionalChartController(_Divisional(), auth, profiles);

    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: KundliScreen(
          profileController: profiles,
          natalController: natal,
          divisionalController: divisional,
        ),
      ),
    );
    await tester.pump();

    expect(find.text('My Kundli'), findsOneWidget);
    expect(find.text('CHARTS'), findsOneWidget);
    expect(find.text('Lagna Chart'), findsOneWidget);
    expect(find.text('Navamsha Chart'), findsOneWidget);
    expect(find.text('Chandra Kundli'), findsOneWidget);
    expect(find.text('Divisional Charts'), findsOneWidget);
    expect(find.text('D2'), findsNothing);
    expect(find.text('D4'), findsNothing);
    expect(find.text('Birth Panchang'), findsNothing);
    expect(find.text('Shadbala'), findsNothing);

    await tester.scrollUntilVisible(find.text('Planet Positions'), 260);
    expect(find.text('Vimshottari Dasha'), findsOneWidget);
    expect(find.text('Current Transits'), findsOneWidget);
    expect(find.text('Planetary Status'), findsOneWidget);
    expect(find.text('Ashtakavarga'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Birth Details'), 260);
    expect(find.text('Birth Details'), findsOneWidget);

    divisional.dispose();
    natal.dispose();
    profiles.dispose();
    auth.dispose();
  });

  testWidgets('Birth Details renders a safe place label without coordinates', (
    tester,
  ) async {
    final source = _AuthSource();
    final auth = AuthController(source);
    await auth.restore();
    final profiles = ProfileController(_Profiles(), auth);
    await profiles.load();
    final natal = NatalSummaryController(_Natal(), auth, profiles);
    await tester.pumpWidget(
      MaterialApp(
        home: BirthDetailsScreen(
          profileController: profiles,
          natalController: natal,
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Hyderabad, India'), findsOneWidget);
    expect(find.textContaining('17.385'), findsNothing);
    expect(find.textContaining('78.486'), findsNothing);

    natal.dispose();
    profiles.dispose();
    auth.dispose();
  });

  testWidgets('Birth Details uses the safe legacy location fallback', (
    tester,
  ) async {
    final source = _AuthSource();
    final auth = AuthController(source);
    await auth.restore();
    final profiles = ProfileController(_Profiles(displayLocation: null), auth);
    await profiles.load();
    final natal = NatalSummaryController(_Natal(), auth, profiles);
    await tester.pumpWidget(
      MaterialApp(
        home: BirthDetailsScreen(
          profileController: profiles,
          natalController: natal,
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Location not available'), findsOneWidget);

    natal.dispose();
    profiles.dispose();
    auth.dispose();
  });
}

class _AuthSource implements AuthRepository {
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
  _Profiles({this.displayLocation = 'Hyderabad, India'});
  final String? displayLocation;

  @override
  Future<List<BirthProfile>> list() async => [
    BirthProfile(
      id: 'profile-a',
      displayLabel: 'Pratik',
      status: 'active',
      birthData: ResolvedBirthData({
        'localDate': '1990-01-01',
        'localTime': '12:00',
        'timezone': 'Asia/Kolkata',
        'latitude': 17.385,
        'longitude': 78.486,
        if (displayLocation != null) 'displayLocation': displayLocation,
      }),
    ),
  ];
  @override
  Future<BirthProfile> create({
    required String? displayLabel,
    required ResolvedBirthData birthData,
  }) => throw UnimplementedError();
  @override
  Future<BirthProfile> get(String id) => throw UnimplementedError();
  @override
  Future<ResolvedBirthData> resolveBirthTime({
    required String placeId,
    required String localDate,
    required String localTime,
  }) => throw UnimplementedError();
  @override
  Future<List<PlaceCandidate>> searchPlaces(String query) async => const [];
}

class _Natal implements NatalSummaryRepository {
  @override
  Future<NatalSummary> getNatalSummary(String birthProfileId) async =>
      _summary(birthProfileId);
}

class _Divisional implements DivisionalChartRepository {
  @override
  Future<DivisionalChart> getChart({
    required String birthProfileId,
    required DivisionalChartType type,
  }) => throw UnimplementedError();
}

NatalSummary _summary(String id) {
  final signs = List.generate(
    12,
    (index) => NatalSign(
      rashiIndex: index + 1,
      sanskritName: 'Sign ${index + 1}',
      englishName: 'Sign ${index + 1}',
    ),
  );
  const nakshatra = NatalNakshatra(nakshatraIndex: 1, name: 'Ashwini');
  NatalPosition position(String body, int signIndex) => NatalPosition(
    body: body,
    longitude: (signIndex - 1) * 30,
    sign: signs[signIndex - 1],
    degreeWithinSign: 0,
    house: signIndex,
    nakshatra: nakshatra,
    pada: 1,
    speed: 1,
    motion: 'direct',
    retrograde: false,
  );
  final planets = <NatalPosition>[
    position('Sun', 1),
    position('Moon', 11),
    position('Mars', 2),
    position('Mercury', 3),
    position('Jupiter', 4),
    position('Venus', 5),
    position('Saturn', 6),
    position('Rahu', 7),
    position('Ketu', 8),
  ];
  return NatalSummary(
    birthProfileId: id,
    summary: NatalIdentitySummary(
      ascendant: position('Ascendant', 1),
      moonSign: signs[10],
      moonNakshatra: nakshatra,
      moonPada: 1,
      sunSign: signs[0],
    ),
    houses: List.generate(
      12,
      (index) => NatalHouse(house: index + 1, sign: signs[index]),
    ),
    planets: planets,
  );
}
