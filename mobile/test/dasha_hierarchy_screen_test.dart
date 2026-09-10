import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';
import 'package:kundlinsights_mobile/features/readings/astrology_presentation_copy.dart';
import 'package:kundlinsights_mobile/features/readings/career_explanation_language.dart';
import 'package:kundlinsights_mobile/features/vimshottari/domain/vimshottari.dart';
import 'package:kundlinsights_mobile/features/vimshottari/domain/vimshottari_repository.dart';
import 'package:kundlinsights_mobile/features/vimshottari/presentation/dasha_hierarchy_screen.dart';
import 'package:kundlinsights_mobile/features/vimshottari/presentation/dasha_period_insight_screen.dart';
import 'package:kundlinsights_mobile/features/vimshottari/presentation/vimshottari_timeline_screen.dart';
import 'package:kundlinsights_mobile/features/vimshottari/vimshottari_controller.dart';

void main() {
  testWidgets('navigates Overview through the full parent-scoped hierarchy', (
    tester,
  ) async {
    final harness = await _Harness.create();
    addTearDown(harness.dispose);
    await tester.pumpWidget(harness.app());
    await tester.pumpAndSettle();

    expect(find.text('View Mahadasha Timeline'), findsOneWidget);
    expect(find.text('Mahadasha'), findsOneWidget);
    expect(find.text('Antardasha'), findsOneWidget);
    expect(find.text('Pratyantar · Active Now'), findsOneWidget);
    expect(find.text('1 year'), findsNothing);

    await tester.tap(find.text('View Mahadasha Timeline'));
    await tester.pumpAndSettle();
    expect(find.text('MAHADASHA TIMELINE'), findsOneWidget);
    expect(find.text('CURRENT'), findsOneWidget);
    expect(find.text('COMPLETED'), findsOneWidget);
    expect(find.text('UPCOMING'), findsWidgets);
    expect(find.text('Jupiter Mahadasha'), findsOneWidget);
    expect(find.text('Saturn Mahadasha'), findsOneWidget);
    expect(find.byType(InkWell), findsNWidgets(9));
    expect(harness.repository.mdCalls, 1);

    await tester.tap(find.text('Jupiter Mahadasha'));
    await tester.pumpAndSettle();
    expect(find.text('ANTARDASHA TIMELINE'), findsOneWidget);
    expect(find.text('WITHIN JUPITER MAHADASHA'), findsOneWidget);
    expect(
      find.text('Jupiter Mahadasha · 1 Jan 2024 — 1 Jan 2040'),
      findsOneWidget,
    );
    expect(find.text('Rahu Antardasha'), findsOneWidget);
    expect(find.byType(InkWell), findsNWidgets(9));
    expect(harness.repository.adSelector, _mdStart);

    await tester.tap(find.text('Rahu Antardasha'));
    await tester.pumpAndSettle();
    expect(find.text('PRATYANTAR TIMELINE'), findsOneWidget);
    expect(
      find.text('Jupiter Mahadasha · 1 Jan 2024 — 1 Jan 2040'),
      findsOneWidget,
    );
    expect(
      find.text('Rahu Antardasha · 3 Feb 2025 — 1 Jan 2027'),
      findsOneWidget,
    );
    expect(find.text('Jupiter Pratyantar'), findsOneWidget);
    expect(find.byType(InkWell), findsNWidgets(9));
    expect(harness.repository.pdMdSelector, _mdStart);
    expect(harness.repository.pdAdSelector, _adStart);

    await tester.tap(find.text('Jupiter Pratyantar'));
    await tester.pumpAndSettle();
    expect(find.text('JUPITER PRATYANTAR'), findsOneWidget);
    expect(find.text('CURRENT'), findsOneWidget);
    expect(harness.repository.detailSelector, _pdStart);

    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.text('PRATYANTAR TIMELINE'), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.text('ANTARDASHA TIMELINE'), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.text('MAHADASHA TIMELINE'), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.text('View Mahadasha Timeline'), findsOneWidget);
  });

  testWidgets(
    'uses Hinglish planet names while hierarchy structure stays English',
    (tester) async {
      final harness = await _Harness.create(
        language: CareerExplanationLanguage.hinglish,
      );
      addTearDown(harness.dispose);
      await tester.pumpWidget(harness.app());
      await tester.pumpAndSettle();
      await tester.tap(find.text('View Mahadasha Timeline'));
      await tester.pumpAndSettle();

      expect(find.text('MAHADASHA TIMELINE'), findsOneWidget);
      expect(find.text('Guru Dev Mahadasha'), findsOneWidget);
      expect(find.text('Shani Dev Mahadasha'), findsOneWidget);
      expect(find.text('Budh Mahadasha'), findsOneWidget);
      expect(find.text('Shukra Mahadasha'), findsOneWidget);
      expect(find.text('Surya Dev Mahadasha'), findsOneWidget);
      expect(find.text('Chandra Dev Mahadasha'), findsOneWidget);
      expect(find.text('Mangal Mahadasha'), findsOneWidget);
      expect(find.text('jupiter'), findsNothing);
      expect(find.text('saturn'), findsNothing);

      await tester.tap(find.text('Guru Dev Mahadasha'));
      await tester.pumpAndSettle();
      expect(find.text('WITHIN GURU DEV MAHADASHA'), findsOneWidget);
      expect(
        find.text('Guru Dev Mahadasha · 1 Jan 2024 — 1 Jan 2040'),
        findsOneWidget,
      );
      expect(find.text('Shani Dev Antardasha'), findsOneWidget);
      expect(find.text('Budh Antardasha'), findsOneWidget);
      expect(find.text('Shukra Antardasha'), findsOneWidget);
      expect(find.text('Surya Dev Antardasha'), findsOneWidget);
      expect(find.text('Chandra Dev Antardasha'), findsOneWidget);
      expect(find.text('Mangal Antardasha'), findsOneWidget);

      await tester.tap(find.text('Rahu Antardasha'));
      await tester.pumpAndSettle();
      expect(find.text('WITHIN RAHU ANTARDASHA'), findsOneWidget);
      expect(find.text('Guru Dev Pratyantar'), findsOneWidget);
      expect(find.text('Shani Dev Pratyantar'), findsOneWidget);
    },
  );

  testWidgets('shows loading, then retries the same parent-scoped selector', (
    tester,
  ) async {
    final harness = await _Harness.create(failFirstAd: true);
    addTearDown(harness.dispose);
    await tester.pumpWidget(harness.app());
    await tester.pumpAndSettle();
    await tester.tap(find.text('View Mahadasha Timeline'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Jupiter Mahadasha'));
    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    await tester.pumpAndSettle();
    expect(find.text('Retry'), findsOneWidget);
    expect(harness.repository.adSelector, _mdStart);

    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(find.text('ANTARDASHA TIMELINE'), findsOneWidget);
    expect(harness.repository.adCalls, 2);
    expect(harness.repository.adSelector, _mdStart);
  });

  testWidgets('renders Antardasha parent context from the backend response', (
    tester,
  ) async {
    final harness = await _Harness.create();
    addTearDown(harness.dispose);
    await tester.pumpWidget(
      AstrologyPresentationScope(
        controller: harness.language,
        child: MaterialApp(
          home: DashaHierarchyScreen(
            profileController: harness.profiles,
            controller: harness.controller,
            level: DashaHierarchyLevel.antardasha,
            // The response parent below remains the authority for rendering.
            mahadashaStart: DateTime.parse('2031-01-01T00:00:00.000Z'),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('WITHIN JUPITER MAHADASHA'), findsOneWidget);
    expect(
      find.text('Jupiter Mahadasha · 1 Jan 2024 — 1 Jan 2040'),
      findsOneWidget,
    );
  });
}

const _mdStart = '2024-01-01T00:00:00.123Z';
const _adStart = '2025-02-03T04:05:06.789Z';
const _pdStart = '2025-02-04T00:00:00.111Z';

class _Harness {
  _Harness._(
    this.auth,
    this.profiles,
    this.controller,
    this.repository,
    this.language,
  );
  final AuthController auth;
  final ProfileController profiles;
  final VimshottariController controller;
  final _Repository repository;
  final CareerExplanationLanguageController language;

  static Future<_Harness> create({
    CareerExplanationLanguage language = CareerExplanationLanguage.english,
    bool failFirstAd = false,
  }) async {
    final authSource = _AuthSource();
    final auth = AuthController(authSource);
    await auth.restore();
    final profiles = ProfileController(_Profiles(), auth);
    await profiles.load();
    final repository = _Repository(failFirstAd: failFirstAd);
    final controller = VimshottariController(
      repository,
      auth,
      profiles,
      now: () => DateTime.utc(2026, 1, 1),
    );
    final preference = CareerExplanationLanguageController(
      _LanguageStore(language),
    );
    await preference.load();
    await Future<void>.delayed(Duration.zero);
    return _Harness._(auth, profiles, controller, repository, preference);
  }

  Widget app() {
    final router = GoRouter(
      initialLocation: '/vimshottari',
      routes: [
        GoRoute(
          path: '/vimshottari',
          builder: (_, _) => VimshottariTimelineScreen(
            profileController: profiles,
            controller: controller,
          ),
        ),
        GoRoute(
          path: '/vimshottari/mahadasha',
          builder: (_, _) => DashaHierarchyScreen(
            profileController: profiles,
            controller: controller,
            level: DashaHierarchyLevel.mahadasha,
          ),
        ),
        GoRoute(
          path: '/vimshottari/antardasha',
          builder: (_, state) => DashaHierarchyScreen(
            profileController: profiles,
            controller: controller,
            level: DashaHierarchyLevel.antardasha,
            mahadashaStart: DateTime.parse(
              state.uri.queryParameters['mahadashaStart']!,
            ).toUtc(),
          ),
        ),
        GoRoute(
          path: '/vimshottari/pratyantar',
          builder: (_, state) => DashaHierarchyScreen(
            profileController: profiles,
            controller: controller,
            level: DashaHierarchyLevel.pratyantar,
            mahadashaStart: DateTime.parse(
              state.uri.queryParameters['mahadashaStart']!,
            ).toUtc(),
            antardashaStart: DateTime.parse(
              state.uri.queryParameters['antardashaStart']!,
            ).toUtc(),
          ),
        ),
        GoRoute(
          path: '/vimshottari/period-insight',
          builder: (_, state) => DashaPeriodInsightScreen(
            profileController: profiles,
            controller: controller,
            pratyantarStart: DateTime.parse(
              state.uri.queryParameters['pratyantarStart']!,
            ).toUtc(),
          ),
        ),
      ],
    );
    return AstrologyPresentationScope(
      controller: language,
      child: MaterialApp.router(routerConfig: router),
    );
  }

  void dispose() {
    controller.dispose();
    profiles.dispose();
    auth.dispose();
    language.dispose();
  }
}

class _Repository implements VimshottariRepository {
  _Repository({this.failFirstAd = false});
  final bool failFirstAd;
  int mdCalls = 0, adCalls = 0;
  String? adSelector, pdMdSelector, pdAdSelector, detailSelector;

  @override
  Future<DashaScopedTimeline> getMahadashaTimeline({
    required String birthProfileId,
  }) async {
    mdCalls++;
    return _timeline('md');
  }

  @override
  Future<DashaScopedTimeline> getAntardashaTimeline({
    required String birthProfileId,
    required DateTime mahadashaStartUtc,
  }) async {
    adCalls++;
    adSelector = mahadashaStartUtc.toIso8601String();
    if (failFirstAd && adCalls == 1) throw StateError('offline');
    return _timeline('ad');
  }

  @override
  Future<DashaScopedTimeline> getPratyantarTimeline({
    required String birthProfileId,
    required DateTime mahadashaStartUtc,
    required DateTime antardashaStartUtc,
  }) async {
    pdMdSelector = mahadashaStartUtc.toIso8601String();
    pdAdSelector = antardashaStartUtc.toIso8601String();
    return _timeline('pd');
  }

  @override
  Future<DashaPeriodInsight> getPeriodInsight({
    required String birthProfileId,
    required DateTime pratyantarStartUtc,
  }) async {
    detailSelector = pratyantarStartUtc.toIso8601String();
    return DashaPeriodInsight(
      mahadasha: _period('jupiter', _mdStart, '2040-01-01T00:00:00.000Z'),
      antardasha: _period('rahu', _adStart, '2027-01-01T00:00:00.000Z'),
      pratyantar: _period('jupiter', _pdStart, '2025-03-01T00:00:00.000Z'),
      status: 'CURRENT',
      summary: 'Safe factual summary.',
      presentation: const DashaPresentationCopy(
        english: 'Safe factual summary.',
        hinglish: 'Safe factual summary.',
      ),
      nextPeriod: null,
      natalFacts: const [],
      stateFacts: const [],
      relationshipFacts: const [],
      d10Facts: const [],
    );
  }

  @override
  Future<VimshottariCurrent> getCurrent({
    required String birthProfileId,
    required DateTime atUtc,
  }) async => VimshottariCurrent(
    birthProfileId: birthProfileId,
    at: atUtc.toIso8601String(),
    mahadasha: _period('jupiter', _mdStart, '2040-01-01T00:00:00.000Z'),
    antardasha: _period('rahu', _adStart, '2027-01-01T00:00:00.000Z'),
    pratyantardasha: _period('jupiter', _pdStart, '2025-03-01T00:00:00.000Z'),
  );
  @override
  Future<VimshottariTimeline> getTimeline({
    required String birthProfileId,
    required DateTime fromUtc,
    required DateTime toUtc,
    required VimshottariLevel level,
  }) => throw UnimplementedError();

  DashaScopedTimeline _timeline(String level) {
    final childLevel = switch (level) {
      'md' => 'MAHADASHA',
      'ad' => 'ANTARDASHA',
      _ => 'PRATYANTAR',
    };
    final lords = level == 'md'
        ? const [
            'ketu',
            'jupiter',
            'saturn',
            'mercury',
            'venus',
            'sun',
            'moon',
            'mars',
            'rahu',
          ]
        : level == 'ad'
        ? const [
            'ketu',
            'rahu',
            'saturn',
            'mercury',
            'venus',
            'sun',
            'moon',
            'mars',
            'jupiter',
          ]
        : const [
            'ketu',
            'jupiter',
            'saturn',
            'mercury',
            'venus',
            'sun',
            'moon',
            'mars',
            'rahu',
          ];
    final periods = List.generate(
      9,
      (i) => DashaTimelinePeriod(
        level: childLevel,
        lord: lords[i],
        start: i == 1 && level == 'ad'
            ? _adStart
            : i == 1 && level == 'pd'
            ? _pdStart
            : '202$i-01-01T00:00:00.000Z',
        end: '203$i-01-01T00:00:00.000Z',
        status: i == 1
            ? 'CURRENT'
            : i == 0
            ? 'COMPLETED'
            : 'UPCOMING',
      ),
    );
    final md = DashaTimelinePeriod(
      level: 'MAHADASHA',
      lord: 'Jupiter',
      start: _mdStart,
      end: '2040-01-01T00:00:00.000Z',
      status: 'CURRENT',
    );
    final ad = DashaTimelinePeriod(
      level: 'ANTARDASHA',
      lord: 'Rahu',
      start: _adStart,
      end: '2027-01-01T00:00:00.000Z',
      status: 'CURRENT',
    );
    return DashaScopedTimeline(
      birthProfileId: 'profile-a',
      level: level,
      periods: periods,
      parent: level == 'ad' ? md : null,
      mahadashaParent: level == 'pd' ? md : null,
      antardashaParent: level == 'pd' ? ad : null,
    );
  }
}

DashaPeriod _period(String lord, String start, String end) =>
    DashaPeriod(lord: lord, start: start, end: end);

class _AuthSource implements AuthRepository {
  @override
  Stream<AuthSnapshot> get states => const Stream.empty();
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
  @override
  Future<List<BirthProfile>> list() async => [
    const BirthProfile(
      id: 'profile-a',
      displayLabel: 'Asha',
      status: 'active',
      birthData: ResolvedBirthData({'timezone': 'UTC'}),
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

class _LanguageStore implements CareerExplanationLanguageStorage {
  _LanguageStore(this.value);
  final CareerExplanationLanguage value;
  @override
  Future<String?> readLanguage() async => value.name;
  @override
  Future<void> writeLanguage(CareerExplanationLanguage language) async {}
}
