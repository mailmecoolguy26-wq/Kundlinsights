import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:kundlinsights_mobile/app/app.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/natal/domain/natal_summary.dart';
import 'package:kundlinsights_mobile/features/natal/domain/natal_summary_repository.dart';
import 'package:kundlinsights_mobile/features/natal/natal_summary_controller.dart';
import 'package:kundlinsights_mobile/features/divisional/divisional_chart_controller.dart';
import 'package:kundlinsights_mobile/features/divisional/domain/divisional_chart.dart';
import 'package:kundlinsights_mobile/features/divisional/domain/divisional_chart_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';
import 'package:kundlinsights_mobile/features/vimshottari/domain/vimshottari.dart';
import 'package:kundlinsights_mobile/features/vimshottari/domain/vimshottari_repository.dart';
import 'package:kundlinsights_mobile/features/vimshottari/vimshottari_controller.dart';

void main() {
  late _FakeAuthRepository repository;
  late AuthController controller;
  late _Profiles profiles;

  setUp(() {
    repository = _FakeAuthRepository(authenticated: true);
    controller = AuthController(repository);
    profiles = _Profiles();
  });

  tearDown(() => controller.dispose());

  testWidgets('boots to localized Home for a restored session', (tester) async {
    await tester.pumpWidget(_app(controller, profiles));
    await controller.restore();
    await tester.pumpAndSettle();
    expect(find.text('Welcome to KundlInsights'), findsOneWidget);
    expect(find.text('Home'), findsWidgets);
  });

  testWidgets(
    'authenticated users with no profiles are redirected to onboarding',
    (tester) async {
      await tester.pumpWidget(_app(controller, _Profiles(empty: true)));
      await controller.restore();
      await tester.pumpAndSettle();
      expect(find.text('Create birth profile'), findsOneWidget);
    },
  );

  testWidgets('direct subject change routes from clean profile state', (
    tester,
  ) async {
    final subjectProfiles = _SubjectProfiles();
    await tester.pumpWidget(_app(controller, subjectProfiles));
    await controller.restore();
    await tester.pumpAndSettle();
    expect(find.text('A profile'), findsOneWidget);

    subjectProfiles.holdNextLoad = true;
    repository.replaceAuthenticatedSubject('user-b');
    await tester.pump();
    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    subjectProfiles.completeForB();
    await tester.pump();
    await tester.pump();
    expect(find.text('B profile'), findsOneWidget);
  });

  testWidgets('switches all primary tabs', (tester) async {
    await tester.pumpWidget(_app(controller, profiles));
    await controller.restore();
    await tester.pumpAndSettle();
    for (final item in const [
      ('Kundli', 'My Kundli'),
      ('Insights', 'Career'),
      ('Readings', 'Detailed Readings'),
      ('Profile', 'Settings'),
    ]) {
      await tester.tap(find.text(item.$1).last);
      await tester.pumpAndSettle();
      expect(find.text(item.$2), findsOneWidget);
    }
  });

  testWidgets('Kundli renders an accessible North Indian D1 chart', (
    tester,
  ) async {
    await tester.pumpWidget(_app(controller, profiles));
    await controller.restore();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Kundli').last);
    await tester.pumpAndSettle();
    expect(find.text('Lagna'), findsOneWidget);
    expect(find.text('1 · 11'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Accessible house list'), 240);
    expect(find.text('Accessible house list'), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp('House 12, Aquarius')), findsWidgets);
  });

  testWidgets('tapping a rendered chart planet opens the existing P5 detail', (
    tester,
  ) async {
    await tester.pumpWidget(_app(controller, profiles));
    await controller.restore();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Kundli').last);
    await tester.pumpAndSettle();

    await tester.tap(find.text('Su (R)'));
    await tester.pumpAndSettle();

    expect(find.text('Sun'), findsOneWidget);
    expect(find.text('319.5000°'), findsOneWidget);
    expect(find.text('Astronomical Details'), findsOneWidget);
  });

  testWidgets('switches D1, Navamsa, and Dasamsa without stale chart labels', (
    tester,
  ) async {
    await tester.pumpWidget(
      _app(controller, profiles, charts: _DivisionalCharts()),
    );
    await controller.restore();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Kundli').last);
    await tester.pumpAndSettle();
    expect(find.text('My Kundli'), findsOneWidget);

    await tester.tap(find.text('D9'));
    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    await tester.pumpAndSettle();
    expect(find.text('Navamsa (D9)'), findsOneWidget);
    expect(find.text('D9 · Sun'), findsNothing);

    await tester.tap(find.text('D10'));
    await tester.pumpAndSettle();
    expect(find.text('Dasamsa (D10)'), findsOneWidget);
    expect(find.text('Navamsa (D9)'), findsNothing);

    await tester.tap(find.text('D1'));
    await tester.pumpAndSettle();
    expect(find.text('My Kundli'), findsOneWidget);
  });

  testWidgets(
    'renders backend natal facts, nine Grahas, and a factual planet detail',
    (tester) async {
      await tester.pumpWidget(_app(controller, profiles));
      await controller.restore();
      await tester.pumpAndSettle();
      expect(find.text('Aquarius'), findsWidgets);
      await tester.tap(find.text('Kundli').last);
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.text('Planetary Positions'), 240);
      expect(find.text('Planetary Positions'), findsOneWidget);
      expect(find.text('Sun'), findsOneWidget);
      await tester.tap(find.text('Sun'));
      await tester.pumpAndSettle();
      expect(find.text('319.5000°'), findsOneWidget);
      expect(find.text('Astronomical Details'), findsOneWidget);
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.text('Ketu'), 240);
      expect(find.text('Ketu'), findsOneWidget);
    },
  );

  testWidgets('unauthenticated sessions are redirected to sign in', (
    tester,
  ) async {
    repository.authenticated = false;
    await tester.pumpWidget(_app(controller, profiles));
    await controller.restore();
    await tester.pumpAndSettle();
    expect(find.text('Welcome back'), findsOneWidget);
    expect(find.text('Sign in'), findsOneWidget);
  });

  testWidgets('sign-up navigation is available to unauthenticated users', (
    tester,
  ) async {
    repository.authenticated = false;
    await tester.pumpWidget(_app(controller, profiles));
    await controller.restore();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Create an account'));
    await tester.pumpAndSettle();
    expect(find.text('Create your account'), findsOneWidget);
  });

  testWidgets('logout returns an authenticated session to sign in', (
    tester,
  ) async {
    await tester.pumpWidget(_app(controller, profiles));
    await controller.restore();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Profile').last);
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Sign out'), 200);
    await tester.tap(find.text('Sign out'));
    await tester.pumpAndSettle();
    expect(find.text('Welcome back'), findsOneWidget);
  });

  testWidgets('Home shows factual current Dasha with a timeline CTA', (
    tester,
  ) async {
    await tester.pumpWidget(_app(controller, profiles, vimshottari: _Dasha()));
    await controller.restore();
    await tester.pumpAndSettle();
    expect(find.text('Current Mahadasha'), findsOneWidget);
    expect(find.text('Mercury'), findsOneWidget);
    expect(find.text('Current Antardasha'), findsOneWidget);
    expect(find.text('Venus'), findsOneWidget);
    expect(find.text('Current Pratyantardasha'), findsOneWidget);
    expect(find.text('Sun'), findsOneWidget);
    expect(find.text('View full Dasha timeline'), findsOneWidget);
  });
}

Widget _app(
  AuthController controller,
  BirthProfileRepository profiles, {
  DivisionalChartRepository? charts,
  VimshottariRepository? vimshottari,
}) => ProviderScope(
  overrides: [
    birthProfileRepositoryProvider.overrideWithValue(profiles),
    natalSummaryRepositoryProvider.overrideWithValue(_Natal()),
    divisionalChartRepositoryProvider.overrideWithValue(
      charts ?? const UnavailableDivisionalChartRepository(),
    ),
    vimshottariRepositoryProvider.overrideWithValue(
      vimshottari ?? const UnavailableVimshottariRepository(),
    ),
  ],
  child: KundlInsightsApp(authController: controller),
);

class _Natal implements NatalSummaryRepository {
  @override
  Future<NatalSummary> getNatalSummary(String birthProfileId) async =>
      _natalSummary(birthProfileId);
}

class _Dasha implements VimshottariRepository {
  @override
  Future<VimshottariCurrent> getCurrent({
    required String birthProfileId,
    required DateTime atUtc,
  }) async => VimshottariCurrent(
    birthProfileId: birthProfileId,
    at: atUtc.toIso8601String(),
    mahadasha: _period('Mercury'),
    antardasha: _period('Venus'),
    pratyantardasha: _period('Sun'),
  );

  @override
  Future<VimshottariTimeline> getTimeline({
    required String birthProfileId,
    required DateTime fromUtc,
    required DateTime toUtc,
    required VimshottariLevel level,
  }) async => VimshottariTimeline(
    birthProfileId: birthProfileId,
    level: level,
    from: fromUtc.toIso8601String(),
    to: toUtc.toIso8601String(),
    periods: [_period('Mercury')],
  );

  DashaPeriod _period(String lord) => DashaPeriod(
    lord: lord,
    start: '2027-01-01T00:00:00.000Z',
    end: '2027-02-01T00:00:00.000Z',
  );
}

class _DivisionalCharts implements DivisionalChartRepository {
  @override
  Future<DivisionalChart> getChart({
    required String birthProfileId,
    required DivisionalChartType type,
  }) async {
    await Future<void>.delayed(Duration.zero);
    final houses = List.generate(
      12,
      (index) => DivisionalChartHouse(
        house: index + 1,
        sign: DivisionalSign(
          rashiIndex: index + 1,
          sanskritName: '${type.apiName} Sign ${index + 1}',
          englishName: '${type.apiName} Sign ${index + 1}',
        ),
      ),
    );
    final ascendant = DivisionalChartPosition(
      body: 'Ascendant',
      sign: houses.first.sign,
      degreeWithinSign: 1.25,
      house: 1,
    );
    return DivisionalChart(
      birthProfileId: birthProfileId,
      type: type,
      ascendant: ascendant,
      houses: houses,
      planets: List.generate(
        DivisionalChart.grahas.length,
        (index) => DivisionalChartPosition(
          body: DivisionalChart.grahas[index],
          sign: houses[index].sign,
          degreeWithinSign: index + .5,
          house: index + 1,
        ),
      ),
    );
  }
}

NatalSummary _natalSummary(String birthProfileId) {
  const sign = NatalSign(
    rashiIndex: 11,
    sanskritName: 'Kumbha',
    englishName: 'Aquarius',
  );
  const nakshatra = NatalNakshatra(nakshatraIndex: 24, name: 'Shatabhisha');
  const ascendant = NatalPosition(
    body: 'Ascendant',
    longitude: 331.2,
    sign: sign,
    degreeWithinSign: 1.2,
    house: 1,
    nakshatra: nakshatra,
    pada: 1,
    speed: null,
    motion: null,
    retrograde: false,
  );
  final planets = Graha.values
      .map(
        (graha) => NatalPosition(
          body: graha.apiName,
          longitude: 319.5,
          sign: sign,
          degreeWithinSign: 19.5,
          house: graha == Graha.sun ? 1 : 12,
          nakshatra: nakshatra,
          pada: 2,
          speed: -0.1,
          motion: 'retrograde',
          retrograde: true,
        ),
      )
      .toList(growable: false);
  return NatalSummary(
    birthProfileId: birthProfileId,
    summary: NatalIdentitySummary(
      ascendant: ascendant,
      moonSign: sign,
      moonNakshatra: nakshatra,
      moonPada: 2,
      sunSign: sign,
    ),
    houses: List<NatalHouse>.generate(
      12,
      (index) => NatalHouse(house: index + 1, sign: sign),
    ),
    planets: planets,
  );
}

class _Profiles implements BirthProfileRepository {
  _Profiles({this.empty = false});
  final bool empty;
  final BirthProfile profile = BirthProfile(
    id: 'profile-1',
    displayLabel: 'My Profile',
    status: 'active',
    birthData: ResolvedBirthData(const {
      'localDate': '1990-11-26',
      'localTime': '13:40:00',
      'timezone': 'Asia/Kolkata',
    }),
  );
  @override
  Future<BirthProfile> create({
    required String? displayLabel,
    required ResolvedBirthData birthData,
  }) async => profile;
  @override
  Future<BirthProfile> get(String id) async => profile;
  @override
  Future<List<BirthProfile>> list() async => empty ? [] : [profile];
  @override
  Future<ResolvedBirthData> resolveBirthTime({
    required String placeId,
    required String localDate,
    required String localTime,
  }) async => ResolvedBirthData({
    'localDate': localDate,
    'localTime': localTime,
    'timezone': 'Asia/Kolkata',
  });
  @override
  Future<List<PlaceCandidate>> searchPlaces(String query) async => const [];
}

class _FakeAuthRepository implements AuthRepository {
  _FakeAuthRepository({required this.authenticated});

  bool authenticated;
  String? subject = 'test-user';
  final _states = StreamController<AuthSnapshot>.broadcast(sync: true);

  @override
  Stream<AuthSnapshot> get states => _states.stream;

  @override
  Future<String?> accessToken() async => authenticated ? 'test-token' : null;

  @override
  Future<String?> refreshAccessToken() async =>
      authenticated ? 'test-token' : null;

  @override
  Future<AuthSnapshot> restore() async => AuthSnapshot(
    authenticated ? AuthStatus.authenticated : AuthStatus.unauthenticated,
    subject: authenticated ? subject : null,
  );

  @override
  Future<void> signIn({required String email, required String password}) async {
    authenticated = true;
    _states.add(AuthSnapshot(AuthStatus.authenticated, subject: subject));
  }

  @override
  Future<bool> signUp({required String email, required String password}) async {
    authenticated = true;
    _states.add(AuthSnapshot(AuthStatus.authenticated, subject: subject));
    return true;
  }

  @override
  Future<void> signOut() async {
    authenticated = false;
    _states.add(const AuthSnapshot(AuthStatus.unauthenticated));
  }

  void replaceAuthenticatedSubject(String nextSubject) {
    authenticated = true;
    subject = nextSubject;
    _states.add(AuthSnapshot(AuthStatus.authenticated, subject: nextSubject));
  }
}

class _SubjectProfiles extends _Profiles {
  bool holdNextLoad = false;
  final _b = Completer<List<BirthProfile>>();

  @override
  Future<List<BirthProfile>> list() {
    if (holdNextLoad) return _b.future;
    return Future.value([_subjectProfile('a-profile', 'A profile')]);
  }

  void completeForB() =>
      _b.complete([_subjectProfile('b-profile', 'B profile')]);

  BirthProfile _subjectProfile(String id, String label) => BirthProfile(
    id: id,
    displayLabel: label,
    status: 'active',
    birthData: ResolvedBirthData(const {
      'localDate': '1990-11-26',
      'localTime': '13:40:00',
      'timezone': 'Asia/Kolkata',
    }),
  );
}
