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
  testWidgets(
    'collects required Switch Job context and sends its decision type',
    (tester) async {
      final repository = _Repository();
      final harness = await _Harness.create(repository);
      addTearDown(harness.dispose);
      await tester.pumpWidget(_screen(harness.controller));

      expect(find.text('Should I switch jobs?'), findsOneWidget);
      await _submit(tester);
      await tester.pump();
      expect(
        find.text('Choose at least one reason.', skipOffstage: false),
        findsOneWidget,
      );

      await _completeRequired(tester);
      await _submit(tester);
      await tester.pumpAndSettle();

      expect(repository.decisionTypes, ['SWITCH_JOB']);
      expect(repository.calls.single, {
        'reasons': ['Career growth'],
        'activelyInterviewing': 'EXPLORING',
        'preferredTimeline': 'ONE_TO_THREE_MONTHS',
      });
    },
  );

  testWidgets(
    'renders exploration-only timing and keeps technical evidence collapsed',
    (tester) async {
      final harness = await _Harness.create(_Repository());
      addTearDown(harness.dispose);
      await tester.pumpWidget(_screen(harness.controller));
      await _completeRequired(tester);
      await _submit(tester);
      await tester.pumpAndSettle();

      expect(find.text('Overall View'), findsOneWidget);
      expect(find.text('Explore Timing'), findsOneWidget);
      expect(find.text('Move / Joining Timing'), findsOneWidget);
      expect(
        find.textContaining('supports exploration timing only'),
        findsOneWidget,
      );
      expect(find.text('Alignment With Your Reasons'), findsOneWidget);
      expect(
        find.textContaining('scope, learning or responsibility'),
        findsOneWidget,
      );
      expect(
        find.text('Career-linked Dasha evidence is active.'),
        findsNothing,
      );
      await tester.drag(find.byType(ListView), const Offset(0, -1000));
      await tester.pumpAndSettle();
      await tester.tap(find.text('View Detailed Astrology'));
      await tester.pumpAndSettle();
      expect(find.text('Dasha & Transit', skipOffstage: false), findsOneWidget);
      expect(
        find.text(
          '• Career-linked Dasha evidence is active.',
          skipOffstage: false,
        ),
        findsOneWidget,
      );
      expect(find.textContaining('quit your job now'), findsNothing);
      expect(find.textContaining('guaranteed'), findsNothing);
    },
  );

  testWidgets('guards duplicate submit and recovers after a network failure', (
    tester,
  ) async {
    final pending = Completer<CareerDecision>();
    final repository = _Repository(pending: pending);
    final harness = await _Harness.create(repository);
    addTearDown(harness.dispose);
    await tester.pumpWidget(_screen(harness.controller));
    await _completeRequired(tester);
    await _submit(tester);
    await tester.pump();
    await tester.tapAt(const Offset(200, 500));
    expect(repository.calls, hasLength(1));
    pending.complete(_decision());
    await tester.pumpAndSettle();

    final failing = _Repository(failuresBeforeSuccess: 1);
    final failedHarness = await _Harness.create(failing);
    addTearDown(failedHarness.dispose);
    await tester.pumpWidget(_screen(failedHarness.controller));
    await _completeRequired(tester);
    await _submit(tester);
    await tester.pumpAndSettle();
    expect(
      find.text('We could not prepare your decision view. Please try again.'),
      findsOneWidget,
    );
    await _submit(tester, label: 'RETRY');
    await tester.pumpAndSettle();
    expect(failing.calls, hasLength(2));
  });
}

Widget _screen(CareerDecisionController controller) => MaterialApp(
  home: CareerDecisionScreen(
    controller: controller,
    decisionType: 'switch-job',
  ),
);

Future<void> _completeRequired(WidgetTester tester) async {
  await tester.drag(find.byType(ListView), const Offset(0, 1000));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Career growth'));
  await tester.drag(find.byType(ListView), const Offset(0, -320));
  await tester.pumpAndSettle();
  final interviewing = find.byType(DropdownButtonFormField<String>).at(0);
  await tester.tap(
    find.descendant(
      of: interviewing,
      matching: find.byType(DropdownButton<String>),
    ),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('Just exploring').last);
  await tester.pumpAndSettle();
  final timeline = find.byType(DropdownButtonFormField<String>).at(1);
  await tester.tap(
    find.descendant(
      of: timeline,
      matching: find.byType(DropdownButton<String>),
    ),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('Within 1–3 months').last);
  await tester.pumpAndSettle();
}

Future<void> _submit(WidgetTester tester, {String label = 'CONTINUE'}) async {
  await tester.drag(find.byType(ListView), const Offset(0, -1000));
  await tester.pumpAndSettle();
  await tester.tap(find.widgetWithText(FilledButton, label));
}

CareerDecision _decision() => CareerDecision.fromJson({
  'decisionType': 'SWITCH_JOB',
  'state': 'SUPPORTIVE_WITH_CONDITIONS',
  'timingScope': 'EXPLORE_ONLY',
  'overallView': 'Switching jobs can be considered alongside the currently supported Career timing.',
  'timing': {
    'start': '2026-11-20T00:00:00.000Z',
    'end': '2027-01-10T00:00:00.000Z',
  },
  'context': {
    'reasons': ['Career growth'],
    'activelyInterviewing': 'EXPLORING',
    'preferredTimeline': 'ONE_TO_THREE_MONTHS',
  },
  'cautions': ['Practical factors remain important before making a move.'],
  'whatToDo': ['Use the stronger period for applications and interviews.'],
  'limitation': 'This is a possible Career activity signal, not a favourable window, job-offer prediction, or guarantee.',
  'detailedAstrology': {
    'evidence': [
      {
        'family': 'DASHA',
        'role': 'PRIMARY',
        'summary': 'Career-linked Dasha evidence is active.',
      },
    ],
    'agreement': {
      'availableMajorSignals': 2,
      'alignedMajorSignals': 2,
      'primaryEligibility': true,
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
  _Repository({this.pending, this.failuresBeforeSuccess = 0});
  final Completer<CareerDecision>? pending;
  int failuresBeforeSuccess;
  final List<String> decisionTypes = [];
  final List<Map<String, Object?>> calls = [];

  @override
  Future<CareerDecision> submit({
    required String birthProfileId,
    required String decisionType,
    required Map<String, Object?> context,
  }) {
    decisionTypes.add(decisionType);
    calls.add(Map.unmodifiable(context));
    if (failuresBeforeSuccess-- > 0) return Future.error(StateError('offline'));
    return pending?.future ?? Future.value(_decision());
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
