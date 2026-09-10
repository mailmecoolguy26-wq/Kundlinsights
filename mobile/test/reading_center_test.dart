import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/app/theme/app_theme.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';
import 'package:kundlinsights_mobile/features/readings/domain/reading.dart';
import 'package:kundlinsights_mobile/features/readings/domain/reading_repository.dart';
import 'package:kundlinsights_mobile/features/readings/reading_controller.dart';
import 'package:kundlinsights_mobile/features/readings/readings_screen.dart';
import 'package:kundlinsights_mobile/l10n/app_localizations.dart';

void main() {
  test('parses only the safe list and stored detail DTO contracts', () {
    final summary = ReadingSummary.fromJson(_summaryJson());
    final detail = ReadingDetail.fromJson(_detailJson());
    expect(summary.readingId, 'reading-a');
    expect(summary.birthProfileId, 'profile-a');
    expect(detail.content.sections.single.headline, 'Career structure');
    expect(
      detail.content.sections.single.items.single.sentence,
      'Stored text.',
    );
    expect(detail.content.sections.single.items.single.sourceTitle, isNull);
    expect(detail.calibratedContent, isNull);
    expect(
      () => ReadingDetail.fromJson({..._detailJson(), 'content': null}),
      throwsFormatException,
    );
  });

  test(
    'parses optional calibrated content in exact server section and item order',
    () {
      final detail = ReadingDetail.fromJson({
        ..._detailJson(),
        'calibratedContent': _calibratedContent([
          _section('future-key', 'Future server title', 'Future server text.'),
          _section(
            'unknown-future-key',
            'Unknown server title',
            'Unknown text.',
          ),
          _section('calibration', 'Calibration', 'Calibration text.'),
        ]),
      });
      expect(detail.calibratedContent, isNotNull);
      expect(
        detail.calibratedContent!.sections.map((section) => section.section),
        ['future-key', 'unknown-future-key', 'calibration'],
      );
      expect(
        detail.calibratedContent!.sections[1].items.single.sentence,
        'Unknown text.',
      );
      final empty = ReadingDetail.fromJson({
        ..._detailJson(),
        'calibratedContent': _calibratedContent([]),
      });
      expect(empty.calibratedContent!.sections, isEmpty);
    },
  );

  test(
    'parses safe structured insights defensively and retains legacy detail',
    () {
      final detail = ReadingDetail.fromJson({
        ..._detailJson(),
        'insights': [
          _insight('ACTIVE_CAREER_DASHA', 0),
          _insight('FUTURE_UNKNOWN', 1, status: 'FUTURE_STATUS'),
          {'family': 'malformed'},
        ],
      });
      expect(detail.insights, hasLength(2));
      expect(detail.insights.first.family, 'ACTIVE_CAREER_DASHA');
      expect(detail.insights.last.status, 'FUTURE_STATUS');
      expect(ReadingDetail.fromJson(_detailJson()).insights, isEmpty);
    },
  );

  test(
    'preserves backend list order and supports the documented 50-item cap',
    () async {
      final authSource = _AuthSource();
      final auth = AuthController(authSource);
      await auth.restore();
      final profiles = ProfileController(_Profiles(authSource), auth);
      await _settle();
      final repository = _ReadingRepository()
        ..nextList = List<ReadingSummary>.generate(
          50,
          (index) => ReadingSummary.fromJson({
            ..._summaryJson(profileId: 'profile-a'),
            'readingId': 'reading-$index',
          }),
        );
      final controller = ReadingController(repository, auth, profiles);
      await _settle();
      expect(controller.readings, hasLength(50));
      expect(controller.readings.first.readingId, 'reading-0');
      expect(controller.readings.last.readingId, 'reading-49');
      controller.dispose();
      profiles.dispose();
      auth.dispose();
    },
  );

  test(
    'loads, refreshes, and protects list/detail state across identity scopes',
    () async {
      final authSource = _AuthSource();
      final auth = AuthController(authSource);
      await auth.restore();
      final profiles = ProfileController(_Profiles(authSource), auth);
      await _settle();
      final repository = _ReadingRepository(deferredListCalls: {1, 3});
      final controller = ReadingController(repository, auth, profiles);
      await _settle();
      expect(controller.listState, ReadingListState.loading);
      repository.completeList(1, [_summary('profile-a')]);
      await _settle();
      expect(controller.readings.single.birthProfileId, 'profile-a');

      profiles.select(profiles.profiles.last);
      expect(controller.readings, isEmpty);
      await _settle();
      expect(controller.readings.single.birthProfileId, 'profile-b');

      final refresh = controller.refresh();
      expect(controller.listState, ReadingListState.refreshing);
      await _settle();
      repository.completeList(3, [_summary('profile-b')]);
      await refresh;
      expect(controller.readings.single.birthProfileId, 'profile-b');

      final detail = controller.loadDetail('reading-b');
      await _settle();
      repository.completeDetail(_detail('profile-b'));
      await detail;
      expect(controller.detail?.birthProfileId, 'profile-b');

      authSource.switchSubject('user-b');
      expect(controller.readings, isEmpty);
      expect(controller.detail, isNull);
      await _settle();
      expect(controller.readings.single.birthProfileId, 'profile-user-b');
      authSource.logout();
      expect(controller.readings, isEmpty);
      expect(controller.detail, isNull);
      expect(controller.listState, ReadingListState.initial);
      controller.dispose();
      profiles.dispose();
      auth.dispose();
    },
  );

  test('blocks stale user-A and profile-A list responses', () async {
    final authSource = _AuthSource();
    final auth = AuthController(authSource);
    await auth.restore();
    final profiles = ProfileController(_Profiles(authSource), auth);
    await _settle();
    final repository = _ReadingRepository(deferredListCalls: {1, 2, 3});
    final controller = ReadingController(repository, auth, profiles);
    await _settle();

    profiles.select(profiles.profiles.last);
    await _settle();
    repository.completeList(1, [_summary('profile-a')]);
    await _settle();
    expect(controller.readings, isEmpty);
    repository.completeList(2, [_summary('profile-b')]);
    await _settle();
    expect(controller.readings.single.birthProfileId, 'profile-b');

    final staleUserA = controller.refresh();
    await _settle();
    authSource.switchSubject('user-b');
    expect(controller.readings, isEmpty);
    await _settle();
    repository.completeList(3, [_summary('profile-b')]);
    await staleUserA;
    await _settle();
    expect(controller.readings.single.birthProfileId, 'profile-user-b');
    controller.dispose();
    profiles.dispose();
    auth.dispose();
  });

  test(
    'rapid profile A to B to A keeps only the latest A list response',
    () async {
      final authSource = _AuthSource();
      final auth = AuthController(authSource);
      await auth.restore();
      final profiles = ProfileController(_Profiles(authSource), auth);
      await _settle();
      final repository = _ReadingRepository(deferredListCalls: {1, 2, 3});
      final controller = ReadingController(repository, auth, profiles);
      await _settle();

      profiles.select(profiles.profiles.last);
      await _settle();
      profiles.select(profiles.profiles.first);
      await _settle();
      repository.completeList(3, [_summary('profile-a')]);
      await _settle();
      expect(controller.readings.single.birthProfileId, 'profile-a');
      repository.completeList(1, [_summary('profile-a')]);
      repository.completeList(2, [_summary('profile-b')]);
      await _settle();
      expect(controller.readings.single.birthProfileId, 'profile-a');

      controller.dispose();
      profiles.dispose();
      auth.dispose();
    },
  );

  testWidgets(
    'an open Profile A detail route cannot retain content after a user switch',
    (tester) async {
      final authSource = _AuthSource();
      final auth = AuthController(authSource);
      await auth.restore();
      final profiles = ProfileController(_Profiles(authSource), auth);
      await tester.pump();
      final controller = ReadingController(
        _ReadingRepository(),
        auth,
        profiles,
      );
      await controller.loadDetail('reading-a');
      await tester.pumpWidget(
        _localized(
          ReadingDetailScreen(controller: controller, readingId: 'reading-a'),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Stored text.'), findsOneWidget);

      authSource.switchSubject('user-b');
      await tester.pump();
      expect(controller.detail, isNull);
      expect(controller.detailState, ReadingDetailState.initial);
      expect(find.text('Stored text.'), findsNothing);
      expect(
        find.text(
          'This saved reading is unavailable right now. Please return to My Readings and try again.',
        ),
        findsOneWidget,
      );

      controller.dispose();
      profiles.dispose();
      auth.dispose();
    },
  );

  testWidgets('renders non-empty, empty, error, and stored detail content', (
    tester,
  ) async {
    final authSource = _AuthSource();
    final auth = AuthController(authSource);
    await auth.restore();
    final profiles = ProfileController(_Profiles(authSource), auth);
    await tester.pump();
    final repository = _ReadingRepository();
    final controller = ReadingController(repository, auth, profiles);
    await tester.pumpWidget(_localized(ReadingsScreen(controller: controller)));
    await tester.pumpAndSettle();
    expect(find.text('Career Reading'), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp('Career Reading')), findsWidgets);

    repository.nextList = const [];
    await controller.refresh();
    await tester.pumpAndSettle();
    expect(find.text('No readings yet.'), findsOneWidget);

    repository.failList = true;
    await controller.refresh();
    await tester.pumpAndSettle();
    expect(find.text('Something went wrong'), findsOneWidget);

    repository.failList = false;
    await controller.loadDetail('reading-a');
    await tester.pumpWidget(
      _localized(
        ReadingDetailScreen(controller: controller, readingId: 'reading-a'),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Career Timing Forecast'), findsWidgets);
    expect(find.text('CAREER READING'), findsOneWidget);
    expect(find.text('CAREER INSIGHTS'), findsOneWidget);
    expect(find.text('Career structure'), findsWidgets);
    expect(find.text('Stored text.'), findsOneWidget);
    final detailScaffold = tester.widget<Scaffold>(find.byType(Scaffold).last);
    expect(detailScaffold.backgroundColor, const Color(0xFF0B071B));
    expect(find.text('NEXT STRONG CAREER WINDOW'), findsNothing);
    expect(find.text('WHAT TO WATCH FOR'), findsNothing);
    expect(repository.listCalls, greaterThan(0));
    expect(repository.detailCalls, greaterThan(0));
    controller.dispose();
    profiles.dispose();
    auth.dispose();
  });

  testWidgets(
    'renders structured insights first with caveats and expandable trace',
    (tester) async {
      final authSource = _AuthSource();
      final auth = AuthController(authSource);
      await auth.restore();
      final profiles = ProfileController(_Profiles(authSource), auth);
      await tester.pump();
      final repository = _ReadingRepository()
        ..nextDetail = ReadingDetail.fromJson({
          ..._detailJson(),
          'insights': [
            _insight(
              'CONCURRENT_CAREER_TIMING',
              0,
              technicalContext: {
                'natalStructure': [],
                'd10CareerChart': [],
                'timing': [
                  {
                    'kind': 'CONCURRENT_TIMING',
                    'lineageClassification': 'INDEPENDENT',
                  },
                ],
                'supportingContext': [],
                'careerHistory': [],
                'classicalRuleContext': [],
              },
            ),
            _insight('HISTORICAL_CALIBRATION_RECURRENCE', 1, status: 'MIXED'),
            _insight(
              'FUTURE_RECURRENCE_WINDOW',
              2,
              timing: {'from': '2027-02-01', 'to': '2027-03-01'},
            ),
          ],
        });
      final controller = ReadingController(repository, auth, profiles);
      await tester.pumpWidget(
        _localized(
          ReadingDetailScreen(controller: controller, readingId: 'reading-a'),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Career Timing Alignment'), findsWidgets);
      expect(find.text('MATCHED WITH YOUR CAREER HISTORY'), findsWidgets);
      expect(find.text('FUTURE CAREER TIMING'), findsWidgets);
      expect(
        tester
            .getTopLeft(find.text('MATCHED WITH YOUR CAREER HISTORY').first)
            .dy,
        lessThan(tester.getTopLeft(find.text('FUTURE CAREER TIMING').first).dy),
      );
      expect(find.text('Career structure'), findsNothing);
      expect(find.text('WHAT LIMITS THIS SIGNAL'), findsOneWidget);
      await tester.tap(find.text('ASTROLOGY BEHIND THIS').first);
      await tester.pumpAndSettle();
      expect(find.text('Timing'), findsWidgets);
      expect(find.textContaining('Independent mechanisms'), findsWidgets);
      expect(find.textContaining('Source rule:'), findsNothing);
      controller.dispose();
      profiles.dispose();
      auth.dispose();
    },
  );

  testWidgets('renders only safe backend Career timing and history facts', (
    tester,
  ) async {
    final authSource = _AuthSource();
    final auth = AuthController(authSource);
    await auth.restore();
    final profiles = ProfileController(_Profiles(authSource), auth);
    await tester.pump();
    final detailJson = {
      ..._detailJson(),
      'insights': [
        _insight(
          'ACTIVE_CAREER_DASHA',
          0,
          timing: {
            'dashaPeriods': [
              {
                'periodLevel': 'MAHADASHA',
                'periodPlanet': 'Venus',
                'start': '2025-01-01T00:00:00.000Z',
                'end': '2027-01-01T00:00:00.000Z',
                'isCurrent': true,
              },
              {
                'periodLevel': 'ANTARDASHA',
                'periodPlanet': 'Saturn',
                'start': '2026-09-01T00:00:00.000Z',
                'end': '2026-10-01T00:00:00.000Z',
                'isCurrent': true,
              },
              {
                'periodLevel': 'PRATYANTAR_DASHA',
                'periodPlanet': 'Mercury',
                'start': '2026-09-15T00:00:00.000Z',
                'end': '2026-09-20T00:00:00.000Z',
                'isCurrent': false,
              },
            ],
          },
        ),
        _insight(
          'CURRENT_CAREER_TRANSIT',
          1,
          timing: {
            'transitContexts': [
              {
                'transitPlanet': 'Saturn',
                'start': '2026-09-01T00:00:00.000Z',
                'end': '2026-11-15T00:00:00.000Z',
                'eventType': 'rashiIngress',
                'motion': 'DIRECT',
                'natalBody': 'Moon',
              },
            ],
          },
        ),
        _insight(
          'CONCURRENT_CAREER_TIMING',
          2,
          timing: {
            'timingWindow': {
              'start': '2026-09-15T00:00:00.000Z',
              'end': '2026-10-01T00:00:00.000Z',
              'isCurrent': false,
            },
            'timingState': 'UPCOMING',
            'lineageClassification': 'INDEPENDENT',
          },
        ),
        _insight(
          'FUTURE_RECURRENCE_WINDOW',
          3,
          timing: {
            'from': '2026-10-15T00:00:00.000Z',
            'to': '2026-11-20T00:00:00.000Z',
          },
          calibrationContext: {
            'calibrationLevel': 'CALIBRATED',
            'eventCount': 3,
            'matchedEventCount': 2,
            'matchedEvents': [],
            'mechanismFamilies': [],
            'patternCount': 99,
            'composite': false,
          },
        ),
      ],
    };
    final detail = ReadingDetail.fromJson(detailJson);
    expect(detail.insights[2].timing.timingState, 'UPCOMING');
    expect(detail.insights[2].timing.timingWindow, isNotNull);
    final repository = _ReadingRepository()..nextDetail = detail;
    final controller = ReadingController(repository, auth, profiles);
    await tester.pumpWidget(
      _localized(
        ReadingDetailScreen(controller: controller, readingId: 'reading-a'),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('CAREER TIMING'), findsOneWidget);
    expect(find.text('Mahadasha'), findsOneWidget);
    expect(find.text('Antardasha'), findsOneWidget);
    expect(find.text('Pratyantar'), findsOneWidget);
    expect(find.text('Saturn'), findsWidgets);
    expect(find.text('1 Sep 2026 – 1 Oct 2026'), findsOneWidget);
    expect(find.text('Active now'), findsWidgets);
    expect(
      find.textContaining('Upcoming', skipOffstage: false),
      findsOneWidget,
    );
    expect(
      find.textContaining('Independent timing mechanisms', skipOffstage: false),
      findsOneWidget,
    );
    expect(
      find.text('15 Oct 2026 – 20 Nov 2026', skipOffstage: false),
      findsOneWidget,
    );
    expect(
      find.text(
        '3 saved Career events available for recurring-pattern comparison.',
      ),
      findsOneWidget,
    );
    expect(find.text('Supported'), findsWidgets);
    expect(find.text('rashiIngress'), findsNothing);
    expect(find.text('DIRECT'), findsNothing);
    expect(find.text('Moon'), findsNothing);
    expect(find.text('99'), findsNothing);
    controller.dispose();
    profiles.dispose();
    auth.dispose();
  });

  testWidgets(
    'renders the safe detail error without retaining stored content',
    (tester) async {
      final authSource = _AuthSource();
      final auth = AuthController(authSource);
      await auth.restore();
      final profiles = ProfileController(_Profiles(authSource), auth);
      await tester.pump();
      final repository = _ReadingRepository()..failDetail = true;
      final controller = ReadingController(repository, auth, profiles);
      await tester.pumpWidget(
        _localized(
          ReadingDetailScreen(controller: controller, readingId: 'reading-123'),
        ),
      );
      await tester.pumpAndSettle();
      expect(controller.detailState, ReadingDetailState.error);
      expect(controller.detail, isNull);
      expect(find.text('Something went wrong'), findsOneWidget);
      expect(find.text('Stored text.'), findsNothing);
      expect(repository.detailCalls, 1);
      controller.dispose();
      profiles.dispose();
      auth.dispose();
    },
  );

  testWidgets('structured readings do not append legacy calibration or notes', (
    tester,
  ) async {
    final authSource = _AuthSource();
    final auth = AuthController(authSource);
    await auth.restore();
    final profiles = ProfileController(_Profiles(authSource), auth);
    await tester.pump();
    final detail = ReadingDetail.fromJson({
      ..._detailJson(),
      'insights': [_insight('CAREER_FOUNDATION', 0)],
      'calibrationContext': {'calibrationLevel': 'CALIBRATED', 'eventCount': 3},
      'calibratedContent': _calibratedContent([
        _section(
          'calibration',
          'Calibration',
          'This context deserves attention.',
        ),
        _section(
          'calculation-note',
          'Calculation note',
          'Some calculations use a provisional calculation basis.',
        ),
      ]),
    });
    final repository = _ReadingRepository()..nextDetail = detail;
    final controller = ReadingController(repository, auth, profiles);
    await tester.pumpWidget(
      _localized(
        ReadingDetailScreen(controller: controller, readingId: 'reading-a'),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text(
        '3 saved Career events available for recurring-pattern comparison.',
      ),
      findsOneWidget,
    );
    expect(find.text('This context deserves attention.'), findsNothing);
    expect(find.text('CAREER HISTORY CALIBRATION'), findsNothing);
    expect(find.text('Calculation note'), findsNothing);
    expect(find.text('TECHNICAL NOTE'), findsOneWidget);
    expect(
      find.text('Some calculations use a provisional calculation basis.'),
      findsOneWidget,
    );
    expect(find.text('Update Career History'), findsOneWidget);
    controller.dispose();
    profiles.dispose();
    auth.dispose();
  });

  testWidgets('renders returned NONE and LIMITED calibrated sections only', (
    tester,
  ) async {
    final none = _detailJson()
      ..['calibratedContent'] = _calibratedContent([
        _section('calibration', 'Calibration', 'No historical calibration.'),
      ]);
    final limited = _detailJson()
      ..['calibratedContent'] = _calibratedContent([
        _section('calibration', 'Calibration', 'Limited calibration.'),
        _section(
          'decision-considerations',
          'Considerations',
          'Review options.',
        ),
      ]);
    final authSource = _AuthSource();
    final auth = AuthController(authSource);
    await auth.restore();
    final profiles = ProfileController(_Profiles(authSource), auth);
    await tester.pump();
    final repository = _ReadingRepository()
      ..nextDetail = ReadingDetail.fromJson(none);
    final controller = ReadingController(repository, auth, profiles);
    await tester.pumpWidget(
      _localized(
        ReadingDetailScreen(controller: controller, readingId: 'reading-a'),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('No historical calibration.'), findsOneWidget);
    expect(find.text('CAREER HISTORY CALIBRATION'), findsOneWidget);
    expect(find.text('Update Career History'), findsOneWidget);
    expect(find.text('Historical patterns'), findsNothing);
    expect(find.text('Upcoming periods'), findsNothing);

    repository.nextDetail = ReadingDetail.fromJson({
      ..._detailJson(),
      'calibratedContent': _calibratedContent([]),
    });
    await controller.loadDetail('reading-a');
    await tester.pumpAndSettle();
    expect(find.text('Stored text.'), findsOneWidget);
    expect(find.text('Calibration'), findsNothing);

    repository.nextDetail = ReadingDetail.fromJson(limited);
    await controller.loadDetail('reading-a');
    await tester.pumpAndSettle();
    expect(find.text('Limited calibration.'), findsOneWidget);
    expect(find.text('Review options.'), findsOneWidget);
    expect(find.text('Historical patterns'), findsNothing);
    expect(find.text('Upcoming periods'), findsNothing);
    controller.dispose();
    profiles.dispose();
    auth.dispose();
  });

  testWidgets(
    'renders full calibrated content in server order after existing content',
    (tester) async {
      final detail = _detailJson()
        ..['calibratedContent'] = _calibratedContent([
          _section('calibration', 'Calibration', 'Calibration text.'),
          _section(
            'historical-patterns',
            'Historical patterns',
            'Historical text.',
          ),
          _section('upcoming-periods', 'Upcoming periods', 'Future text.'),
          _section(
            'decision-considerations',
            'Considerations',
            'Consider this.',
          ),
          _section('calculation-note', 'Calculation note', 'Provisional note.'),
          _section('unknown-section', 'Unknown section', 'Unknown text.'),
        ]);
      final authSource = _AuthSource();
      final auth = AuthController(authSource);
      await auth.restore();
      final profiles = ProfileController(_Profiles(authSource), auth);
      await tester.pump();
      final repository = _ReadingRepository()
        ..nextDetail = ReadingDetail.fromJson(detail);
      final controller = ReadingController(repository, auth, profiles);
      await tester.pumpWidget(
        _localized(
          ReadingDetailScreen(controller: controller, readingId: 'reading-a'),
        ),
      );
      await tester.pumpAndSettle();
      final calibratedHeadlines = [
        'Calibration',
        'Historical patterns',
        'Upcoming periods',
        'Considerations',
        'Calculation note',
        'Unknown section',
      ];
      for (final headline in calibratedHeadlines) {
        final finder = find.text(headline);
        expect(finder, findsOneWidget);
        await tester.ensureVisible(finder);
      }
      expect(find.text('Stored text.'), findsOneWidget);
      expect(find.text('Provisional note.'), findsOneWidget);
      expect(find.text('Unknown text.'), findsOneWidget);
      controller.dispose();
      profiles.dispose();
      auth.dispose();
    },
  );
}

Widget _localized(Widget child) => MaterialApp(
  theme: AppTheme.light,
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  home: child,
);

Future<void> _settle() => Future<void>.delayed(Duration.zero);

ReadingSummary _summary(String profileId) =>
    ReadingSummary.fromJson(_summaryJson(profileId: profileId));
ReadingDetail _detail(String profileId) =>
    ReadingDetail.fromJson(_detailJson(profileId: profileId));
Map<String, dynamic> _summaryJson({String profileId = 'profile-a'}) => {
  'readingId': 'reading-a',
  'birthProfileId': profileId,
  'domain': 'CAREER',
  'status': 'active',
  'createdAt': '2027-01-01T10:00:00.000Z',
  'readingInstant': '2027-01-01T10:00:00.000Z',
  'locale': 'en-IN',
};
Map<String, dynamic> _detailJson({String profileId = 'profile-a'}) => {
  ..._summaryJson(profileId: profileId),
  'content': {
    'domain': 'CAREER',
    'locale': 'en-IN',
    'sections': [
      {
        'section': 'CAREER_STRUCTURE',
        'headline': 'Career structure',
        'items': [
          {
            'headline': 'Career structure',
            'sentence': 'Stored text.',
            'sourceAttribution': {'title': null},
          },
        ],
      },
    ],
  },
};
Map<String, dynamic> _section(
  String section,
  String headline,
  String sentence,
) => {
  'section': section,
  'headline': headline,
  'items': [
    {'headline': '$headline item', 'sentence': sentence},
  ],
};
Map<String, dynamic> _calibratedContent(List<Map<String, dynamic>> sections) =>
    {'domain': 'CAREER', 'locale': 'en-IN', 'sections': sections};
Map<String, dynamic> _insight(
  String family,
  int priority, {
  String status = 'SUPPORTED',
  Map<String, dynamic>? timing,
  Map<String, dynamic>? technicalContext,
  Map<String, dynamic>? calibrationContext,
}) => {
  'insightId': 'insight-$family-$priority',
  'family': family,
  'titleKey': 'title',
  'summaryKey': 'summary',
  'displayPriority': priority,
  'status': status,
  'timing': timing ?? <String, dynamic>{},
  'caveats': status == 'MIXED'
      ? [
          {'status': 'MIXED'},
        ]
      : [],
  'evidenceTrace': {
    'signals': [
      {
        'sourceRuleIds': ['rule-$family'],
        'sourceRulesetIds': ['ruleset-$family'],
      },
    ],
  },
  'technicalDetails': {
    'independentMechanismFamilies': ['DASHA'],
  },
  'rulesetVersions': {'insightEngine': 'v1'},
  'technicalContext': ?technicalContext,
  'calibrationContext': ?calibrationContext,
};

class _ReadingRepository implements ReadingRepository {
  _ReadingRepository({Set<int>? deferredListCalls})
    : _deferredListCalls = deferredListCalls ?? const {};
  final Set<int> _deferredListCalls;
  final Map<int, Completer<List<ReadingSummary>>> _pendingLists = {};
  Completer<ReadingDetail>? _pendingDetail;
  int listCalls = 0;
  int detailCalls = 0;
  bool failList = false;
  bool failDetail = false;
  List<ReadingSummary>? nextList;
  ReadingDetail? nextDetail;
  @override
  Future<List<ReadingSummary>> getReadings({String? birthProfileId}) {
    listCalls++;
    if (failList) {
      return Future<List<ReadingSummary>>.error(StateError('failed'));
    }
    if (_deferredListCalls.contains(listCalls)) {
      final result = Completer<List<ReadingSummary>>();
      _pendingLists[listCalls] = result;
      return result.future;
    }
    return Future.value(nextList ?? [_summary(birthProfileId!)]);
  }

  void completeList(int call, List<ReadingSummary> value) =>
      _pendingLists.remove(call)!.complete(value);
  @override
  Future<ReadingDetail> getReadingDetail(String readingId) {
    detailCalls++;
    if (failDetail) {
      return Future<ReadingDetail>.error(StateError('safe detail failure'));
    }
    if (_deferredListCalls.isNotEmpty) {
      _pendingDetail = Completer<ReadingDetail>();
      return _pendingDetail!.future;
    }
    return Future.value(nextDetail ?? _detail('profile-a'));
  }

  void completeDetail(ReadingDetail value) => _pendingDetail!.complete(value);
}

class _AuthSource implements AuthRepository {
  String subject = 'user-a';
  final _states = StreamController<AuthSnapshot>.broadcast(sync: true);
  @override
  Stream<AuthSnapshot> get states => _states.stream;
  @override
  Future<String?> accessToken() async => 'token';
  @override
  Future<String?> refreshAccessToken() async => 'token';
  @override
  Future<AuthSnapshot> restore() async =>
      AuthSnapshot(AuthStatus.authenticated, subject: subject);
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
  void switchSubject(String value) {
    subject = value;
    _states.add(AuthSnapshot(AuthStatus.authenticated, subject: value));
  }

  void logout() => _states.add(const AuthSnapshot(AuthStatus.unauthenticated));
}

class _Profiles implements BirthProfileRepository {
  _Profiles(this.auth);
  final _AuthSource auth;
  @override
  Future<List<BirthProfile>> list() async => auth.subject == 'user-b'
      ? [_profile('profile-user-b')]
      : [_profile('profile-a'), _profile('profile-b')];
  BirthProfile _profile(String id) => BirthProfile(
    id: id,
    displayLabel: id,
    status: 'active',
    birthData: ResolvedBirthData(const {'timezone': 'UTC'}),
  );
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
