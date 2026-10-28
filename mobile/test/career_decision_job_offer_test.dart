import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/career_answers/career_decision_controller.dart';
import 'package:kundlinsights_mobile/features/career_answers/domain/career_decision.dart';
import 'package:kundlinsights_mobile/features/career_answers/presentation/career_decision_screen.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';

void main() {
  testWidgets('renders the Job Offer form with its supported context fields', (
    tester,
  ) async {
    final harness = await _Harness.create(_Repository());
    addTearDown(harness.dispose);

    await tester.pumpWidget(_screen(harness.controller));

    expect(find.text('I have a job offer'), findsOneWidget);
    expect(find.text('Offer received date'), findsOneWidget);
    expect(find.text('Current employment situation'), findsOneWidget);
    expect(find.text('New company'), findsOneWidget);
    expect(find.text('Expected joining date (optional)'), findsOneWidget);
    expect(find.text('Role / designation (optional)'), findsOneWidget);
    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pump();
    expect(find.text('Internal move'), findsOneWidget);
    await tester.tap(find.text('New company').last);
    await tester.pump();
    await _scrollTo(tester, find.text('WHAT MATTERS MOST?'));
    expect(find.text('Career growth'), findsOneWidget);
  });

  testWidgets('validates required Job Offer fields without calling the API', (
    tester,
  ) async {
    final repository = _Repository();
    final harness = await _Harness.create(repository);
    addTearDown(harness.dispose);
    await tester.pumpWidget(_screen(harness.controller));

    await _tapSubmit(tester);
    await tester.pump();

    expect(find.text('Required'), findsAtLeastNWidgets(1));
    expect(repository.calls, isEmpty);
  });

  testWidgets('can return to its caller without a Navigator exception', (
    tester,
  ) async {
    final harness = await _Harness.create(_Repository());
    addTearDown(harness.dispose);
    await tester.pumpWidget(
      MaterialApp(home: _DecisionLauncher(controller: harness.controller)),
    );

    await tester.tap(find.text('Open Job Offer'));
    await tester.pumpAndSettle();
    expect(find.text('I have a job offer'), findsOneWidget);

    await tester.tap(find.byTooltip('Back'));
    await tester.pumpAndSettle();
    expect(find.text('Open Job Offer'), findsOneWidget);
  });

  testWidgets('submits only supported Job Offer context to the repository', (
    tester,
  ) async {
    final repository = _Repository();
    final harness = await _Harness.create(repository);
    addTearDown(harness.dispose);
    await tester.pumpWidget(_screen(harness.controller));

    await _completeRequiredFields(tester);
    await tester.enterText(find.byType(TextFormField).at(2), '2026-12-01');
    await tester.enterText(find.byType(TextFormField).at(3), 'Senior Analyst');
    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pump();
    await tester.tap(find.text('Internal move').last);
    await tester.pump();
    await _scrollTo(tester, find.text('Career growth'));
    await tester.tap(find.text('Career growth'));
    await tester.tap(find.text('Stability'));
    await _tapSubmit(tester);
    await tester.pumpAndSettle();

    expect(repository.profileIds, ['profile-a']);
    expect(repository.calls, hasLength(1));
    expect(repository.calls.single, {
      'offerReceivedDate': '2026-10-01',
      'currentSituation': 'Currently employed',
      'moveType': 'INTERNAL_MOVE',
      'joiningDate': '2026-12-01',
      'role': 'Senior Analyst',
      'priority': 'Career growth, Stability',
    });
    expect(repository.calls.single.containsKey('concerns'), isFalse);
    expect(find.text('Overall View'), findsOneWidget);
  });

  testWidgets('shows a progress state and guards against duplicate submit', (
    tester,
  ) async {
    final pending = Completer<CareerDecision>();
    final repository = _Repository(pending: pending);
    final harness = await _Harness.create(repository);
    addTearDown(harness.dispose);
    await tester.pumpWidget(_screen(harness.controller));
    await _completeRequiredFields(tester);

    await _tapSubmit(tester);
    await tester.pump();
    await tester.tapAt(const Offset(200, 500));
    await tester.pump();

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(repository.calls, hasLength(1));

    pending.complete(_decision());
    await tester.pumpAndSettle();
    expect(find.text('Overall View'), findsOneWidget);
  });

  testWidgets('renders the backend Job Offer result and detailed evidence', (
    tester,
  ) async {
    final result = _decision();
    expect(result.detailedAstrology?.evidence, hasLength(6));
    final harness = await _Harness.create(_Repository(result: result));
    addTearDown(harness.dispose);
    await tester.pumpWidget(_screen(harness.controller));
    await _completeRequiredFields(tester);
    await _scrollTo(tester, find.text('Career growth'));
    await tester.tap(find.text('Career growth'));
    await _tapSubmit(tester);
    await tester.pumpAndSettle();

    expect(find.text('Supportive With Conditions'), findsOneWidget);
    expect(
      find.text('Use the current window alongside practical diligence.'),
      findsOneWidget,
    );
    expect(find.text('Offer Timing'), findsOneWidget);
    expect(find.text('Joining Timing'), findsOneWidget);
    expect(find.text('Alignment With Your Priorities'), findsOneWidget);
    expect(find.text('What Supports This'), findsOneWidget);
    expect(find.text('What Needs Caution'), findsOneWidget);
    expect(find.text('Practical Decision Factors'), findsOneWidget);
    expect(find.text('What To Do', skipOffstage: false), findsOneWidget);
    expect(
      find.text('View Detailed Astrology', skipOffstage: false),
      findsOneWidget,
    );
    expect(
      find.textContaining(
        'Career growth is your main priority. Compare whether this role meaningfully increases scope, learning, responsibility or future opportunities.',
        skipOffstage: false,
      ),
      findsOneWidget,
    );
    expect(
      find.textContaining(
        'Compare role scope, manager, compensation and joining conditions before accepting.',
        skipOffstage: false,
      ),
      findsOneWidget,
    );
    expect(find.text('Career-linked Dasha evidence is active.'), findsNothing);
    expect(find.text('Career foundation evidence is available.'), findsNothing);
    expect(find.text('Ashtakavarga context is available.'), findsNothing);
    expect(
      find.text('Technical evidence is available from saved Career timing.'),
      findsNothing,
    );

    await _scrollTo(tester, find.text('View Detailed Astrology'));
    await tester.tap(find.text('View Detailed Astrology'));
    await tester.pumpAndSettle();
    expect(find.text('Dasha & Transit', skipOffstage: false), findsOneWidget);
    expect(
      find.text('D1 / Career Foundation', skipOffstage: false),
      findsOneWidget,
    );
    expect(find.text('Ashtakavarga', skipOffstage: false), findsOneWidget);
    expect(
      find.text('D10 Career Analysis', skipOffstage: false),
      findsOneWidget,
    );
    expect(find.text('Calibration', skipOffstage: false), findsOneWidget);
    expect(
      find.text(
        '• Career-linked Dasha evidence is active.',
        skipOffstage: false,
      ),
      findsOneWidget,
    );
    expect(
      find.text('• Career transit evidence is available.', skipOffstage: false),
      findsOneWidget,
    );
    expect(
      find.text(
        '3 of 6 major Career timing signals currently align.',
        skipOffstage: false,
      ),
      findsOneWidget,
    );
    expect(
      find.text(
        'Primary Career timing evidence is available.',
        skipOffstage: false,
      ),
      findsOneWidget,
    );
    expect(
      find.text(
        'Supporting evidence is also present from D10 and Ashtakavarga and historical Career patterns.',
        skipOffstage: false,
      ),
      findsOneWidget,
    );
    expect(
      find.text('Technical evidence is available from saved Career timing.'),
      findsOneWidget,
    );
    expect(find.textContaining('guaranteed'), findsNothing);
    expect(find.textContaining('definitely accept'), findsNothing);
    expect(find.textContaining('definitely reject'), findsNothing);
  });

  testWidgets('omits absent detailed evidence sections without crashing', (
    tester,
  ) async {
    final harness = await _Harness.create(
      _Repository(result: _decision(detailed: false)),
    );
    addTearDown(harness.dispose);
    await tester.pumpWidget(_screen(harness.controller));
    await _completeRequiredFields(tester);
    await _tapSubmit(tester);
    await tester.pumpAndSettle();

    await _scrollTo(tester, find.text('View Detailed Astrology'));
    await tester.tap(find.text('View Detailed Astrology'));
    await tester.pumpAndSettle();

    expect(find.text('Calibration', skipOffstage: false), findsOneWidget);
    expect(find.text('Dasha & Transit', skipOffstage: false), findsNothing);
    expect(
      find.text('D1 / Career Foundation', skipOffstage: false),
      findsNothing,
    );
    expect(find.text('Ashtakavarga', skipOffstage: false), findsNothing);
    expect(find.text('D10 Career Analysis', skipOffstage: false), findsNothing);
  });

  testWidgets(
    'uses the safe joining message when no joining date is supplied',
    (tester) async {
      final repository = _Repository();
      final harness = await _Harness.create(repository);
      addTearDown(harness.dispose);
      await tester.pumpWidget(_screen(harness.controller));
      await _completeRequiredFields(tester);
      await _tapSubmit(tester);
      await tester.pumpAndSettle();

      expect(repository.calls.single.containsKey('joiningDate'), isFalse);
      expect(
        find.text(
          'Joining timing can be assessed once you know the expected joining date.',
        ),
        findsOneWidget,
      );
    },
  );

  testWidgets('renders insufficient evidence without inventing a conclusion', (
    tester,
  ) async {
    final harness = await _Harness.create(
      _Repository(result: _decision(state: 'INSUFFICIENT_EVIDENCE')),
    );
    addTearDown(harness.dispose);
    await tester.pumpWidget(_screen(harness.controller));
    await _completeRequiredFields(tester);
    await _tapSubmit(tester);
    await tester.pumpAndSettle();

    expect(find.text('Insufficient Evidence'), findsOneWidget);
    expect(
      find.text('Use the current window alongside practical diligence.'),
      findsNothing,
    );
    expect(
      find.text('Technical evidence is available from saved Career timing.'),
      findsNothing,
    );
  });

  testWidgets('keeps the form recoverable after failure and retries safely', (
    tester,
  ) async {
    final repository = _Repository(failuresBeforeSuccess: 1);
    final harness = await _Harness.create(repository);
    addTearDown(harness.dispose);
    await tester.pumpWidget(_screen(harness.controller));
    await _completeRequiredFields(tester);
    await _tapSubmit(tester);
    await tester.pumpAndSettle();

    expect(
      find.text('We could not prepare your decision view. Please try again.'),
      findsOneWidget,
    );
    expect(find.text('offline'), findsNothing);
    expect(find.text('RETRY'), findsOneWidget);
    final fields = tester.widgetList<TextFormField>(
      find.byType(TextFormField, skipOffstage: false),
    );
    expect(
      fields.any((field) => field.controller?.text == '2026-10-01'),
      isTrue,
    );

    await _tapSubmit(tester, label: 'RETRY');
    await tester.pumpAndSettle();
    expect(repository.calls, hasLength(2));
    expect(find.text('Overall View'), findsOneWidget);
  });
}

Widget _screen(CareerDecisionController controller) => MaterialApp(
  home: CareerDecisionScreen(controller: controller, decisionType: 'job-offer'),
);

class _DecisionLauncher extends StatelessWidget {
  const _DecisionLauncher({required this.controller});
  final CareerDecisionController controller;

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(
      child: FilledButton(
        onPressed: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => CareerDecisionScreen(
              controller: controller,
              decisionType: 'job-offer',
            ),
          ),
        ),
        child: const Text('Open Job Offer'),
      ),
    ),
  );
}

Future<void> _completeRequiredFields(WidgetTester tester) async {
  await tester.enterText(find.byType(TextFormField).at(0), '2026-10-01');
  await tester.enterText(
    find.byType(TextFormField).at(1),
    'Currently employed',
  );
}

Future<void> _scrollTo(WidgetTester tester, Finder finder) => tester
    .scrollUntilVisible(finder, 240, scrollable: find.byType(Scrollable).first);

Future<void> _tapSubmit(
  WidgetTester tester, {
  String label = 'CONTINUE',
}) async {
  final button = find.widgetWithText(FilledButton, label);
  await _scrollTo(tester, button);
  await tester.drag(find.byType(ListView), const Offset(0, -120));
  await tester.pump();
  await tester.tap(button);
}

CareerDecision _decision({
  String state = 'SUPPORTIVE_WITH_CONDITIONS',
  bool detailed = true,
}) => CareerDecision.fromJson({
  'decisionType': 'JOB_OFFER',
  'state': state,
  if (state != 'INSUFFICIENT_EVIDENCE')
    'overallView': 'Use the current window alongside practical diligence.',
  if (state != 'INSUFFICIENT_EVIDENCE')
    'timing': {
      'start': '2026-11-20T00:00:00.000Z',
      'end': '2027-01-10T00:00:00.000Z',
    },
  if (state != 'INSUFFICIENT_EVIDENCE')
    'supports': ['A grounded Career timing signal is active.'],
  if (state != 'INSUFFICIENT_EVIDENCE')
    'cautions': ['Compare practical conditions before deciding.'],
  'practicalFactors': [
    'Compare role scope, manager, compensation and joining conditions before accepting.',
  ],
  'whatToDo': [
    'Compare role scope, manager, compensation and joining conditions before accepting.',
  ],
  'limitation': 'Technical evidence is available from saved Career timing.',
  'context': {'priority': 'Career growth'},
  if (detailed)
    'detailedAstrology': {
      'evidence': [
        {
          'family': 'D1_CAREER_FOUNDATION',
          'role': 'PRIMARY',
          'summary': 'Career foundation evidence is available.',
        },
        {
          'family': 'DASHA',
          'role': 'PRIMARY',
          'summary': 'Career-linked Dasha evidence is active.',
        },
        {
          'family': 'TRANSIT',
          'role': 'PRIMARY',
          'summary': 'Career transit evidence is available.',
        },
        {
          'family': 'D10',
          'role': 'SUPPORT',
          'summary': 'Career chart context is available.',
        },
        {
          'family': 'ASHTAKAVARGA',
          'role': 'SUPPORT',
          'summary': 'Ashtakavarga context is available.',
        },
        {
          'family': 'HISTORICAL_PATTERN',
          'role': 'SUPPORT',
          'summary': 'A related historical Career pattern is available.',
        },
      ],
      'agreement': {
        'availableMajorSignals': 6,
        'alignedMajorSignals': 3,
        'primaryEligibility': true,
        'supportSignals': ['D10', 'ASHTAKAVARGA', 'HISTORICAL_PATTERN'],
      },
    },
});

class _Repository implements CareerDecisionRepository {
  @override
  Future<CareerDecision> getDecision({
    required String birthProfileId,
    required String decisionId,
  }) => Future.error(UnimplementedError());
  @override
  Future<List<CareerDecisionSummary>> listDecisions({
    required String birthProfileId,
  }) async => const [];
  _Repository({this.pending, this.result, this.failuresBeforeSuccess = 0});

  final Completer<CareerDecision>? pending;
  final CareerDecision? result;
  int failuresBeforeSuccess;
  final List<String> profileIds = [];
  final List<Map<String, Object?>> calls = [];

  @override
  Future<CareerDecision> submit({
    required String birthProfileId,
    required String decisionType,
    required Map<String, Object?> context,
  }) {
    profileIds.add(birthProfileId);
    calls.add(Map.unmodifiable(context));
    if (failuresBeforeSuccess > 0) {
      failuresBeforeSuccess--;
      return Future<CareerDecision>.error(StateError('offline'));
    }
    return pending?.future ??
        Future<CareerDecision>.value(result ?? _decision());
  }
}

class _Harness {
  _Harness(this.auth, this.profiles, this.controller);
  final AuthController auth;
  final ProfileController profiles;
  final CareerDecisionController controller;

  static Future<_Harness> create(CareerDecisionRepository repository) async {
    final auth = AuthController(_Auth());
    await auth.restore();
    final profiles = ProfileController(_Profiles(), auth);
    await profiles.load();
    return _Harness(
      auth,
      profiles,
      CareerDecisionController(repository, profiles),
    );
  }

  void dispose() {
    controller.dispose();
    profiles.dispose();
    auth.dispose();
  }
}

class _Auth implements AuthRepository {
  final _states = StreamController<AuthSnapshot>.broadcast(sync: true);

  @override
  Stream<AuthSnapshot> get states => _states.stream;
  @override
  Future<String?> accessToken() async => 'test-token';
  @override
  Future<String?> refreshAccessToken() async => 'test-token';
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
    BirthProfile(
      id: 'profile-a',
      displayLabel: 'Profile A',
      status: 'active',
      birthData: ResolvedBirthData(const {'timezone': 'UTC'}),
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
