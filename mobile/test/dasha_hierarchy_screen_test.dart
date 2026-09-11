import 'dart:async';

import 'package:flutter/foundation.dart';
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
import 'package:kundlinsights_mobile/features/vimshottari/presentation/dasha_status_view.dart';
import 'package:kundlinsights_mobile/features/vimshottari/presentation/vimshottari_timeline_screen.dart';
import 'package:kundlinsights_mobile/features/vimshottari/vimshottari_controller.dart';

void main() {
  testWidgets('navigates Overview through the full parent-scoped hierarchy', (
    tester,
  ) async {
    final harness = await _Harness.create();
    addTearDown(harness.dispose);
    await tester.pumpWidget(harness.app());
    await _pumpDasha(tester);
    expect(find.text('VIMSHOTTARI'), findsNothing);
    expect(find.text('Pratyantar · Active Now'), findsNothing);
    _expectBackGeometry(
      tester,
      buttonKey: const ValueKey('dasha_overview_back_button'),
      title: 'Vimshottari',
    );
    expect(
      tester.getTopLeft(find.byKey(const ValueKey('dasha-profile-pill'))).dx,
      greaterThan(180),
    );
    expect(find.text('Mahadasha'), findsOneWidget);
    expect(find.text('Antardasha'), findsOneWidget);
    expect(find.text('ACTIVE'), findsOneWidget);
    expect(find.text('1 year'), findsNothing);

    await _revealOverviewAction(tester);
    expect(find.text('View Mahadasha Timeline'), findsOneWidget);

    await tester.tap(find.text('View Mahadasha Timeline'));
    await _pumpDasha(tester);
    expect(find.text('MAHADASHA SEQUENCE'), findsOneWidget);
    expect(find.text('CURRENT'), findsWidgets);
    expect(find.text('COMPLETED'), findsOneWidget);
    expect(find.text('UPCOMING'), findsWidgets);
    expect(find.text('Jupiter Mahadasha'), findsOneWidget);
    expect(find.text('Saturn Mahadasha'), findsOneWidget);
    expect(find.byType(InkWell), findsAtLeastNWidgets(9));
    expect(harness.repository.mdCalls, 1);

    await tester.tap(find.text('Jupiter Mahadasha'));
    await _pumpDasha(tester);
    expect(find.text('ANTARDASHA SEQUENCE'), findsOneWidget);
    expect(find.text('Rahu Antardasha'), findsOneWidget);
    expect(find.byType(InkWell), findsAtLeastNWidgets(9));
    expect(harness.repository.adSelector, _mdStart);

    await tester.tap(find.text('Rahu Antardasha'));
    await _pumpDasha(tester);
    expect(find.text('PRATYANTAR SEQUENCE'), findsOneWidget);
    expect(find.text('Jupiter Pratyantar'), findsOneWidget);
    expect(find.byType(InkWell), findsAtLeastNWidgets(9));
    expect(harness.repository.pdMdSelector, _mdStart);
    expect(harness.repository.pdAdSelector, _adStart);

    await tester.tap(find.text('Jupiter Pratyantar'));
    await _pumpDasha(tester);
    expect(find.text('JUPITER PRATYANTAR'), findsOneWidget);
    _expectBackGeometry(
      tester,
      buttonKey: const ValueKey('dasha_period_detail_back_button'),
      title: 'JUPITER PRATYANTAR',
    );
    expect(find.text('CURRENT'), findsWidgets);
    expect(harness.repository.detailSelector, _pdStart);

    await tester.binding.handlePopRoute();
    await _pumpDasha(tester);
    expect(find.text('PRATYANTAR SEQUENCE'), findsOneWidget);
    await tester.binding.handlePopRoute();
    await _pumpDasha(tester);
    expect(find.text('ANTARDASHA SEQUENCE'), findsOneWidget);
    await tester.binding.handlePopRoute();
    await _pumpDasha(tester);
    expect(find.text('MAHADASHA SEQUENCE'), findsOneWidget);
    await tester.binding.handlePopRoute();
    await _pumpDasha(tester);
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
      await _pumpDasha(tester);
      await _revealOverviewAction(tester);
      await tester.tap(find.text('View Mahadasha Timeline'));
      await _pumpDasha(tester);

      expect(find.text('MAHADASHA SEQUENCE'), findsOneWidget);
      expect(find.text('Guru Dev Mahadasha'), findsOneWidget);
      expect(find.text('Shani Dev Mahadasha'), findsOneWidget);
      expect(find.text('Budh Mahadasha'), findsOneWidget);
      expect(find.text('Shukra Mahadasha'), findsOneWidget);
      expect(find.text('Surya Dev Mahadasha'), findsOneWidget);
      expect(find.text('Chandra Dev Mahadasha'), findsOneWidget);
      expect(find.text('jupiter'), findsNothing);
      expect(find.text('saturn'), findsNothing);

      await tester.tap(find.text('Guru Dev Mahadasha'));
      await _pumpDasha(tester);
      expect(find.text('ANTARDASHA SEQUENCE'), findsOneWidget);
      expect(find.text('Shani Dev Antardasha'), findsOneWidget);
      expect(find.text('Budh Antardasha'), findsOneWidget);
      expect(find.text('Shukra Antardasha'), findsOneWidget);
      expect(find.text('Surya Dev Antardasha'), findsOneWidget);
      expect(find.text('Chandra Dev Antardasha'), findsOneWidget);

      await tester.tap(find.text('Rahu Antardasha'));
      await _pumpDasha(tester);
      expect(find.text('PRATYANTAR SEQUENCE'), findsOneWidget);
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
    await _pumpDasha(tester);
    await _revealOverviewAction(tester);
    await tester.tap(find.text('View Mahadasha Timeline'));
    await _pumpDasha(tester);
    await tester.tap(find.text('Jupiter Mahadasha'));
    await _pumpDasha(tester);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    harness.repository.completeFirstAntardashaWithError();
    await _pumpDasha(tester);
    expect(find.text('Retry'), findsOneWidget);
    expect(harness.repository.adSelector, _mdStart);

    await tester.tap(find.text('Retry'));
    await _pumpDasha(tester);
    expect(find.text('ANTARDASHA SEQUENCE'), findsOneWidget);
    expect(harness.repository.adCalls, 2);
    expect(harness.repository.adSelector, _mdStart);
  });

  testWidgets('shows an overview error and retries the current Dasha request', (
    tester,
  ) async {
    final harness = await _Harness.create(failFirstCurrent: true);
    addTearDown(harness.dispose);
    await tester.pumpWidget(harness.app());
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 20));

    expect(find.text('Dasha unavailable'), findsOneWidget);
    expect(
      find.text("We couldn't load your current Dasha right now."),
      findsOneWidget,
    );
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.text('Retry'), findsOneWidget);
    expect(harness.repository.currentCalls, 1);

    await tester.tap(find.text('Retry'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 20));
    expect(find.text('ACTIVE PLANETARY PERIOD'), findsOneWidget);
    expect(harness.repository.currentCalls, 2);
  });

  testWidgets('retries a failed period insight with the same canonical start', (
    tester,
  ) async {
    final harness = await _Harness.create(failFirstDetail: true);
    addTearDown(harness.dispose);
    await tester.pumpWidget(
      MaterialApp(
        home: DashaPeriodInsightScreen(
          profileController: harness.profiles,
          controller: harness.controller,
          pratyantarStart: DateTime.parse(_pdStart),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 20));

    expect(find.text('Dasha unavailable'), findsOneWidget);
    expect(
      find.text("We couldn't load this Dasha period right now."),
      findsOneWidget,
    );
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(harness.repository.detailSelector, _pdStart);
    expect(harness.repository.detailProfileId, 'profile-a');

    await tester.tap(find.text('Retry'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 20));
    expect(find.text('JUPITER PRATYANTAR'), findsOneWidget);
    expect(harness.repository.detailCalls, 2);
    expect(harness.repository.detailSelector, _pdStart);
    expect(harness.repository.detailProfileId, 'profile-a');
  });

  testWidgets('invalid Dasha deep links do not request a period insight', (
    tester,
  ) async {
    final harness = await _Harness.create();
    addTearDown(harness.dispose);
    final router = GoRouter(
      initialLocation: '/vimshottari/period-insight',
      routes: [
        GoRoute(
          path: '/vimshottari',
          builder: (_, _) => const Scaffold(body: Text('Dasha overview')),
        ),
        GoRoute(
          path: '/vimshottari/period-insight',
          builder: (context, state) {
            final value = state.uri.queryParameters['pratyantarStart'];
            final start = value == null
                ? null
                : DateTime.tryParse(value)?.toUtc();
            return start == null
                ? DashaInvalidLinkScreen(
                    onBackToDasha: () => context.go('/vimshottari'),
                  )
                : DashaPeriodInsightScreen(
                    profileController: harness.profiles,
                    controller: harness.controller,
                    pratyantarStart: start,
                  );
          },
        ),
      ],
    );
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pump();

    expect(find.text('Dasha link unavailable'), findsOneWidget);
    expect(find.text('Back to Dasha'), findsOneWidget);
    expect(harness.repository.detailCalls, 0);

    router.go('/vimshottari/period-insight?pratyantarStart=not-a-date');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 20));
    expect(find.text('Dasha link unavailable'), findsOneWidget);
    expect(harness.repository.detailCalls, 0);

    await tester.tap(find.text('Back to Dasha'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 20));
    expect(find.text('Dasha overview'), findsOneWidget);
  });

  testWidgets('uses the backend Antardasha parent response', (tester) async {
    final harness = await _Harness.create();
    addTearDown(harness.dispose);
    final timeline = await harness.controller.loadAntardashaTimeline(
      DateTime.parse('2031-01-01T00:00:00.000Z'),
    );
    expect(timeline!.parent!.lord, 'Jupiter');
    expect(timeline.parent!.start, _mdStart);
    await tester.pumpWidget(
      harness.app(
        initialLocation: '/vimshottari/antardasha?mahadashaStart=2031-01-01T00%3A00%3A00.000Z',
      ),
    );
    await _pumpDasha(tester);

    expect(find.text('ANTARDASHA SEQUENCE'), findsOneWidget);
  });

  testWidgets('renders factual current-period detail in Hinglish', (
    tester,
  ) async {
    final harness = await _Harness.create(
      language: CareerExplanationLanguage.hinglish,
    );
    addTearDown(harness.dispose);
    harness.repository.detailOverride = _richDetail();
    await tester.pumpWidget(
      AstrologyPresentationScope(
        controller: harness.language,
        child: MaterialApp(
          home: DashaPeriodInsightScreen(
            profileController: harness.profiles,
            controller: harness.controller,
            pratyantarStart: DateTime.parse(_pdStart),
            now: () => DateTime.utc(2026, 9, 10),
          ),
        ),
      ),
    );
    await _pumpDasha(tester);

    _expectBackGeometry(
      tester,
      buttonKey: const ValueKey('dasha_period_detail_back_button'),
      title: 'GURU DEV PRATYANTAR',
    );
    expect(find.text('GURU DEV PRATYANTAR'), findsOneWidget);
    expect(find.text('Within Rahu Antardasha'), findsOneWidget);
    expect(find.text('PRATYANTAR'), findsOneWidget);
    expect(find.text('CURRENT'), findsOneWidget);
    expect(find.text('21 days remaining'), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsOneWidget);
    expect(find.text('Guru Dev'), findsWidgets);
    expect(find.text('11th Bhav · Cancer'), findsOneWidget);
    expect(find.text('Vakri · Asta'), findsOneWidget);
    expect(find.text('Guru Dev → Shukra'), findsOneWidget);
    expect(find.text('D10 · 10th Bhav · Leo'), findsOneWidget);
    await _revealText(tester, 'CAREER RELEVANCE');
    expect(find.text('CAREER RELEVANCE'), findsOneWidget);
    expect(find.text('Supported'), findsOneWidget);
    expect(find.text('See Career Timing'), findsOneWidget);
    expect(find.text('Shani Dev'), findsOneWidget);
    expect(find.text('Favorable'), findsNothing);
    expect(find.text('Best Used For'), findsNothing);
    expect(find.text('Promotion'), findsNothing);

    await _revealText(tester, 'ASTROLOGY BEHIND THIS');
    await tester.tap(find.text('ASTROLOGY BEHIND THIS'));
    await _pumpDasha(tester);
    expect(find.text('CAREER HISTORY CONTEXT'), findsOneWidget);
    expect(find.text('CLASSICAL CONTEXT'), findsOneWidget);
    expect(find.text('Internal rule'), findsNothing);
  });

  testWidgets('shows lifecycle-specific detail hero without unsafe progress', (
    tester,
  ) async {
    for (final status in const ['PAST', 'UPCOMING']) {
      final harness = await _Harness.create();
      addTearDown(harness.dispose);
      harness.repository.detailOverride = _richDetail(status: status);
      await harness.controller.loadPeriodInsight(DateTime.parse(_pdStart));
      await tester.pumpWidget(
        MaterialApp(
          home: DashaPeriodInsightScreen(
            profileController: harness.profiles,
            controller: harness.controller,
            pratyantarStart: DateTime.parse(_pdStart),
            now: () => DateTime.utc(2026, 9, 10),
          ),
        ),
      );
      await tester.pump();
      expect(
        find.text(status == 'PAST' ? 'COMPLETED' : 'UPCOMING'),
        findsOneWidget,
      );
      expect(find.byType(LinearProgressIndicator), findsNothing);
      if (status == 'UPCOMING') {
        expect(find.textContaining('Starts '), findsOneWidget);
      }
    }
  });
}

void _expectBackGeometry(
  WidgetTester tester, {
  required ValueKey<String> buttonKey,
  required String title,
}) {
  final backFinder = find.byKey(buttonKey);
  final titleFinder = find.text(title);
  expect(backFinder, findsOneWidget);
  expect(titleFinder, findsOneWidget);

  final backTopLeft = tester.getTopLeft(backFinder);
  final backSize = tester.getSize(backFinder);
  final titleTopLeft = tester.getTopLeft(titleFinder);
  final screenWidth =
      tester.view.physicalSize.width / tester.view.devicePixelRatio;
  final backCenterX = backTopLeft.dx + backSize.width / 2;

  expect(backTopLeft.dx, closeTo(20, 2));
  expect(backSize.width, closeTo(48, .1));
  expect(backSize.height, closeTo(48, .1));
  expect(titleTopLeft.dx, closeTo(20, 2));
  expect(backTopLeft.dx, lessThan(screenWidth * .2));
  expect((backCenterX - screenWidth / 2).abs(), greaterThan(screenWidth * .2));
}

Future<void> _pumpDasha(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 350));
  await tester.pump();
}

Future<void> _revealOverviewAction(WidgetTester tester) async {
  final action = find.text('View Mahadasha Timeline');
  await tester.scrollUntilVisible(action, 180);
  await tester.ensureVisible(action);
  await tester.pump();
}

Future<void> _revealText(WidgetTester tester, String text) async {
  final target = find.text(text);
  await tester.scrollUntilVisible(
    target,
    180,
    scrollable: find.byType(Scrollable).last,
  );
  await tester.ensureVisible(target);
  await tester.pump();
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
    bool failFirstCurrent = false,
    bool failFirstDetail = false,
  }) async {
    final authSource = _AuthSource();
    final auth = AuthController(authSource);
    await auth.restore();
    final profiles = ProfileController(_Profiles(), auth);
    await profiles.load();
    final repository = _Repository(
      failFirstAd: failFirstAd,
      failFirstCurrent: failFirstCurrent,
      failFirstDetail: failFirstDetail,
    );
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
    return _Harness._(auth, profiles, controller, repository, preference);
  }

  Widget app({String initialLocation = '/vimshottari'}) {
    final router = GoRouter(
      initialLocation: initialLocation,
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
  _Repository({
    this.failFirstAd = false,
    this.failFirstCurrent = false,
    this.failFirstDetail = false,
  });
  final bool failFirstAd;
  final bool failFirstCurrent;
  final bool failFirstDetail;
  int mdCalls = 0, adCalls = 0, currentCalls = 0, detailCalls = 0;
  String? adSelector,
      pdMdSelector,
      pdAdSelector,
      detailSelector,
      detailProfileId;
  DashaPeriodInsight? detailOverride;
  Completer<DashaScopedTimeline>? _firstAntardasha;

  void completeFirstAntardashaWithError() {
    _firstAntardasha!.completeError(StateError('offline'));
  }

  @override
  Future<DashaScopedTimeline> getMahadashaTimeline({
    required String birthProfileId,
  }) {
    mdCalls++;
    return SynchronousFuture(_timeline('md'));
  }

  @override
  Future<DashaScopedTimeline> getAntardashaTimeline({
    required String birthProfileId,
    required DateTime mahadashaStartUtc,
  }) {
    adCalls++;
    adSelector = mahadashaStartUtc.toIso8601String();
    if (failFirstAd && adCalls == 1) {
      return (_firstAntardasha = Completer<DashaScopedTimeline>()).future;
    }
    return SynchronousFuture(_timeline('ad'));
  }

  @override
  Future<DashaScopedTimeline> getPratyantarTimeline({
    required String birthProfileId,
    required DateTime mahadashaStartUtc,
    required DateTime antardashaStartUtc,
  }) {
    pdMdSelector = mahadashaStartUtc.toIso8601String();
    pdAdSelector = antardashaStartUtc.toIso8601String();
    return SynchronousFuture(_timeline('pd'));
  }

  @override
  Future<DashaPeriodInsight> getPeriodInsight({
    required String birthProfileId,
    required DateTime pratyantarStartUtc,
  }) {
    detailCalls++;
    detailSelector = pratyantarStartUtc.toIso8601String();
    detailProfileId = birthProfileId;
    if (failFirstDetail && detailCalls == 1) {
      return Future<DashaPeriodInsight>.error(StateError('offline'));
    }
    return SynchronousFuture(
      detailOverride ??
          DashaPeriodInsight(
            mahadasha: _period('jupiter', _mdStart, '2040-01-01T00:00:00.000Z'),
            antardasha: _period('rahu', _adStart, '2027-01-01T00:00:00.000Z'),
            pratyantar: _period(
              'jupiter',
              _pdStart,
              '2025-03-01T00:00:00.000Z',
            ),
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
          ),
    );
  }

  @override
  Future<VimshottariCurrent> getCurrent({
    required String birthProfileId,
    required DateTime atUtc,
  }) {
    currentCalls++;
    if (failFirstCurrent && currentCalls == 1) {
      return Future<VimshottariCurrent>.error(StateError('offline'));
    }
    return SynchronousFuture(
      VimshottariCurrent(
        birthProfileId: birthProfileId,
        at: atUtc.toIso8601String(),
        mahadasha: _period('jupiter', _mdStart, '2040-01-01T00:00:00.000Z'),
        antardasha: _period('rahu', _adStart, '2027-01-01T00:00:00.000Z'),
        pratyantardasha: _period(
          'jupiter',
          _pdStart,
          '2025-03-01T00:00:00.000Z',
        ),
      ),
    );
  }

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
        start: i == 1 && level == 'md'
            ? _mdStart
            : i == 1 && level == 'ad'
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

DashaPeriodInsight _richDetail({String status = 'CURRENT'}) =>
    DashaPeriodInsight(
      mahadasha: _period(
        'jupiter',
        '2024-01-01T00:00:00.000Z',
        '2040-01-01T00:00:00.000Z',
      ),
      antardasha: _period(
        'rahu',
        '2026-01-01T00:00:00.000Z',
        '2027-01-01T00:00:00.000Z',
      ),
      pratyantar: _period(
        'jupiter',
        '2026-09-01T00:00:00.000Z',
        '2026-10-01T00:00:00.000Z',
      ),
      status: status,
      summary: 'Backend factual copy.',
      presentation: const DashaPresentationCopy(
        english: 'This Jupiter Pratyantar is factual context.',
        hinglish: 'Yeh Guru Dev Pratyantar factual context hai.',
      ),
      nextPeriod: _period(
        'saturn',
        '2026-10-01T00:00:00.000Z',
        '2026-11-01T00:00:00.000Z',
      ),
      natalFacts: const [
        DashaFact({
          'planet': 'jupiter',
          'role': 'PRATYANTAR',
          'sign': 'Cancer',
          'house': 11,
          'ownsHouses': [10],
        }),
      ],
      stateFacts: const [
        DashaFact({
          'planet': 'jupiter',
          'role': 'PRATYANTAR',
          'states': ['RETROGRADE', 'COMBUST'],
        }),
      ],
      relationshipFacts: const [
        DashaFact({'from': 'jupiter', 'to': 'venus', 'relationship': 'FRIEND'}),
      ],
      d10Facts: const [
        DashaFact({
          'planet': 'jupiter',
          'role': 'PRATYANTAR',
          'sign': 'Leo',
          'house': 10,
        }),
      ],
      careerRelevance: const DashaOptionalContext(
        status: 'SUPPORTED',
        presentation: DashaPresentationCopy(
          english: 'Exact Career timing context.',
          hinglish: 'Exact Career timing context.',
        ),
      ),
      calibrationContext: const DashaOptionalContext(
        status: 'MIXED',
        presentation: DashaPresentationCopy(
          english: 'Recorded Career history context.',
          hinglish: 'Recorded Career history context.',
        ),
      ),
      classicalContext: const DashaOptionalContext(
        status: 'SUPPORTED',
        presentation: DashaPresentationCopy(
          english: 'Audited classical context.',
          hinglish: 'Audited classical context.',
        ),
      ),
    );

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
