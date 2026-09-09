import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
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
import 'package:kundlinsights_mobile/features/ashtakavarga/domain/ashtakavarga.dart';
import 'package:kundlinsights_mobile/features/ashtakavarga/domain/ashtakavarga_repository.dart';
import 'package:kundlinsights_mobile/features/ashtakavarga/ashtakavarga_controller.dart';
import 'package:kundlinsights_mobile/features/splash/presentation/stitch_splash_screen.dart';
import 'package:kundlinsights_mobile/features/splash/splash_launch_gate.dart';
import 'package:kundlinsights_mobile/shared/widgets/states.dart';

import 'ashtakavarga_fixture.dart';

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
    expect(
      find.text('Here’s what your chart indicates right now'),
      findsOneWidget,
    );
    expect(find.text('Home'), findsWidgets);
  });

  testWidgets('cold launch keeps ready profiles on splash before Home', (
    tester,
  ) async {
    final gate = SplashLaunchGate(
      minimumDuration: const Duration(milliseconds: 1300),
    );
    await tester.pumpWidget(_app(controller, profiles, splashLaunchGate: gate));
    await controller.restore();
    await tester.pump();

    expect(find.byType(StitchSplashScreen), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 1300));
    await tester.pumpAndSettle();
    expect(
      find.text('Here’s what your chart indicates right now'),
      findsOneWidget,
    );
  });

  testWidgets(
    'cold launch keeps an unauthenticated user on splash before login',
    (tester) async {
      repository.authenticated = false;
      final gate = SplashLaunchGate(
        minimumDuration: const Duration(milliseconds: 1300),
      );
      await tester.pumpWidget(
        _app(controller, profiles, splashLaunchGate: gate),
      );
      await controller.restore();
      await tester.pump();

      expect(find.byType(StitchSplashScreen), findsOneWidget);

      await tester.pump(const Duration(milliseconds: 1300));
      await tester.pumpAndSettle();
      expect(find.text('MOBILE NUMBER'), findsOneWidget);
    },
  );

  testWidgets(
    'cold launch keeps an empty profile account on splash before onboarding',
    (tester) async {
      final gate = SplashLaunchGate(
        minimumDuration: const Duration(milliseconds: 1300),
      );
      await tester.pumpWidget(
        _app(controller, _Profiles(empty: true), splashLaunchGate: gate),
      );
      await controller.restore();
      await tester.pump();

      expect(find.byType(StitchSplashScreen), findsOneWidget);

      await tester.pump(const Duration(milliseconds: 1300));
      await tester.pumpAndSettle();
      expect(find.text('Create your birth profile'), findsOneWidget);
    },
  );

  testWidgets(
    'a completed launch gate does not replay splash on router refresh',
    (tester) async {
      final gate = SplashLaunchGate(
        minimumDuration: const Duration(milliseconds: 1300),
      );
      await tester.pumpWidget(
        _app(controller, profiles, splashLaunchGate: gate),
      );
      await controller.restore();
      await tester.pump(const Duration(milliseconds: 1300));
      await tester.pumpAndSettle();

      final home = find.byKey(const ValueKey('home-profile-avatar'));
      final router = GoRouter.of(tester.element(home));
      expect(router.routerDelegate.currentConfiguration.uri.path, '/home');

      await controller.restore();
      await tester.pump();
      await tester.pump();
      expect(find.byType(StitchSplashScreen), findsNothing);
      expect(router.routerDelegate.currentConfiguration.uri.path, '/home');
    },
  );

  testWidgets('ready profiles leave the profiles-loading route for Home', (
    tester,
  ) async {
    final delayedProfiles = _DelayedProfiles();
    await tester.pumpWidget(_app(controller, delayedProfiles));
    await controller.restore();
    await tester.pump();
    await tester.pump();

    final router = GoRouter.of(tester.element(find.byType(LoadingState)));
    expect(
      router.routerDelegate.currentConfiguration.uri.path,
      '/profiles-loading',
    );

    delayedProfiles.complete();
    await tester.pumpAndSettle();

    expect(router.routerDelegate.currentConfiguration.uri.path, '/home');
    expect(
      find.text('Here’s what your chart indicates right now'),
      findsOneWidget,
    );
  });

  testWidgets(
    'authenticated users with no profiles are redirected to onboarding',
    (tester) async {
      await tester.pumpWidget(_app(controller, _Profiles(empty: true)));
      await controller.restore();
      await tester.pumpAndSettle();
      expect(find.text('Create your birth profile'), findsOneWidget);
    },
  );

  testWidgets('direct subject change routes from clean profile state', (
    tester,
  ) async {
    final subjectProfiles = _SubjectProfiles();
    await tester.pumpWidget(_app(controller, subjectProfiles));
    await controller.restore();
    await tester.pumpAndSettle();
    expect(find.textContaining('A profile'), findsWidgets);
    final router = GoRouter.of(
      tester.element(find.byKey(const ValueKey('home-profile-avatar'))),
    );

    subjectProfiles.holdNextLoad = true;
    repository.replaceAuthenticatedSubject('user-b');
    await tester.pump();
    await tester.pump();
    expect(router.routerDelegate.currentConfiguration.uri.path, '/home');

    subjectProfiles.completeForB();
    await tester.pump();
    await tester.pump();
    expect(find.textContaining('B profile'), findsWidgets);
    expect(router.routerDelegate.currentConfiguration.uri.path, '/home');
  });

  testWidgets('switches all primary tabs', (tester) async {
    await tester.pumpWidget(_app(controller, profiles));
    await controller.restore();
    await tester.pumpAndSettle();
    for (final item in const [
      ('Kundli', 'My Kundli'),
      ('Insights', 'Career'),
      ('Readings', 'My Readings'),
      ('Profile', 'Settings'),
    ]) {
      await tester.tap(find.text(item.$1).last);
      await tester.pumpAndSettle();
      expect(find.text(item.$2), findsOneWidget);
    }
  });

  testWidgets('keeps the five shell tabs and premium selected treatment', (
    tester,
  ) async {
    await tester.pumpWidget(_app(controller, profiles));
    await controller.restore();
    await tester.pumpAndSettle();

    final navigationBar = find.byType(NavigationBar);
    expect(navigationBar, findsOneWidget);
    final bar = tester.widget<NavigationBar>(navigationBar);
    final navigationTheme = NavigationBarTheme.of(
      tester.element(navigationBar),
    );
    expect(bar.selectedIndex, 0);
    expect(navigationTheme.backgroundColor, const Color(0xFF0B071B));
    expect(navigationTheme.indicatorColor, Colors.transparent);
    for (final label in const [
      'Home',
      'Kundli',
      'Insights',
      'Readings',
      'Profile',
    ]) {
      expect(
        find.descendant(of: navigationBar, matching: find.text(label)),
        findsOneWidget,
      );
    }
    expect(
      tester
          .widget<Icon>(
            find.descendant(
              of: navigationBar,
              matching: find.byIcon(Icons.home),
            ),
          )
          .color,
      const Color(0xFFC5A059),
    );
    expect(
      tester
          .widget<Icon>(
            find.descendant(
              of: navigationBar,
              matching: find.byIcon(Icons.diamond_outlined),
            ),
          )
          .color,
      const Color(0xFF9E9AA9),
    );

    await tester.tap(
      find.descendant(of: navigationBar, matching: find.text('Kundli')),
    );
    await tester.pumpAndSettle();
    expect(tester.widget<NavigationBar>(navigationBar).selectedIndex, 1);
    expect(find.text('My Kundli'), findsOneWidget);
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
    expect(find.text('11'), findsNWidgets(12));
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

    await tester.tap(find.text('Suᴿ 20°', findRichText: true));
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
      await tester.drag(find.byType(ListView).first, const Offset(0, -900));
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
    expect(find.text('MOBILE NUMBER'), findsOneWidget);
    expect(find.text('CONTINUE'), findsOneWidget);
  });

  testWidgets(
    'mobile-number login remains available to unauthenticated users',
    (tester) async {
      repository.authenticated = false;
      await tester.pumpWidget(_app(controller, profiles));
      await controller.restore();
      await tester.pumpAndSettle();
      expect(find.text('SACRED VEDIC ASTROLOGY'), findsOneWidget);
      expect(
        find.textContaining('Enter your mobile number to begin your'),
        findsOneWidget,
      );
    },
  );

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
    expect(find.text('MOBILE NUMBER'), findsOneWidget);
  });

  testWidgets(
    'Profile keeps only working profile management and sign out actions',
    (tester) async {
      await tester.pumpWidget(_app(controller, profiles));
      await controller.restore();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Profile').last);
      await tester.pumpAndSettle();

      expect(find.text('Birth Profiles'), findsOneWidget);
      expect(find.text('Sign out'), findsOneWidget);
      expect(find.text('Language'), findsNothing);
      expect(find.text('Privacy'), findsNothing);
      expect(find.text('Terms'), findsNothing);
      expect(find.byIcon(Icons.chevron_right), findsOneWidget);
    },
  );

  testWidgets('Home shows factual current Dasha with a timeline CTA', (
    tester,
  ) async {
    await tester.pumpWidget(_app(controller, profiles, vimshottari: _Dasha()));
    await controller.restore();
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Mercury → Venus'), 240);
    expect(find.text('Mercury → Venus'), findsOneWidget);
    expect(find.text('UNDERSTAND THIS PHASE  →'), findsOneWidget);
  });

  testWidgets('Home uses the active profile and real Kundli summary', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(900, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(_app(controller, profiles));
    await controller.restore();
    await tester.pumpAndSettle();

    expect(find.textContaining('My Profile · 26 Nov 1990'), findsOneWidget);
    expect(find.text('MP'), findsOneWidget);
    expect(find.text('Active Growth Phase'), findsNothing);
    expect(find.text('Saturn → Mercury'), findsNothing);

    await tester.drag(find.byType(ListView).first, const Offset(0, -900));
    await tester.pumpAndSettle();
    expect(find.text('Aquarius'), findsWidgets);
    expect(find.text('Shatabhisha'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('home-kundli-cta')));
    await tester.pumpAndSettle();
    expect(find.text('My Kundli'), findsOneWidget);
  });

  testWidgets('Home profile selector preserves profile navigation', (
    tester,
  ) async {
    await tester.pumpWidget(_app(controller, profiles));
    await controller.restore();
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('home-profile-selector')));
    await tester.pumpAndSettle();
    expect(find.text('Birth Profiles'), findsOneWidget);
  });

  testWidgets('Kundli opens factual sign-oriented Ashtakavarga', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1400, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(_app(controller, profiles));
    await controller.restore();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Kundli').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ashtakavarga'));
    await tester.pumpAndSettle();

    expect(find.text('Sarvashtakavarga'), findsOneWidget);
    expect(find.text('Lagna BAV'), findsOneWidget);
    expect(find.text('Rashi-1'), findsWidgets);
    expect(find.text('Rahu'), findsNothing);
    expect(find.text('Ketu'), findsNothing);
    expect(find.textContaining('House'), findsNothing);
    expect(find.textContaining('Strong'), findsNothing);

    await tester.tap(find.text('Moon'));
    await tester.pumpAndSettle();
    expect(find.text('BAV'), findsOneWidget);
    await tester.tap(find.text('Saturn'));
    await tester.pumpAndSettle();
    expect(find.text('Lagna BAV'), findsOneWidget);
  });
}

Widget _app(
  AuthController controller,
  BirthProfileRepository profiles, {
  DivisionalChartRepository? charts,
  VimshottariRepository? vimshottari,
  AshtakavargaRepository? ashtakavarga,
  SplashLaunchGate? splashLaunchGate,
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
    ashtakavargaRepositoryProvider.overrideWithValue(
      ashtakavarga ?? _Ashtakavarga(),
    ),
  ],
  child: KundlInsightsApp(
    authController: controller,
    splashLaunchGate:
        splashLaunchGate ?? SplashLaunchGate(minimumDuration: Duration.zero),
  ),
);

class _Ashtakavarga implements AshtakavargaRepository {
  @override
  Future<Ashtakavarga> getAshtakavarga({
    required String birthProfileId,
  }) async =>
      Ashtakavarga.fromJson(ashtakavargaFixture(profileId: birthProfileId));
}

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

class _FakeAuthRepository implements AuthRepository, PhoneOtpAuthRepository {
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
  Future<void> requestPhoneOtp({required String phoneNumber}) async {}

  @override
  Future<void> verifyPhoneOtp({
    required String phoneNumber,
    required String otp,
  }) async {
    authenticated = true;
    _states.add(AuthSnapshot(AuthStatus.authenticated, subject: subject));
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

class _DelayedProfiles extends _Profiles {
  final _result = Completer<List<BirthProfile>>();

  @override
  Future<List<BirthProfile>> list() => _result.future;

  void complete() => _result.complete([profile]);
}
