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
  testWidgets('renders separate Offer A and Offer B blocks', (tester) async {
    final repository = _Repository();
    final harness = await _Harness.create(repository);
    addTearDown(harness.dispose);
    await tester.pumpWidget(_screen(harness.controller));

    expect(find.text('Offer A'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Offer B'),
      500,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Offer B'), findsOneWidget);
  });

  testWidgets('maps distinct offers, priorities, and Compare Offers type', (
    tester,
  ) async {
    final repository = _Repository();
    final harness = await _Harness.create(repository);
    addTearDown(harness.dispose);
    await harness.controller.submit(
      decisionType: 'COMPARE_OFFERS',
      context: _context(),
    );

    expect(repository.types, ['COMPARE_OFFERS']);
    expect(repository.contexts.single['priorities'], ['Career growth']);
    final offerA = repository.contexts.single['offerA']! as Map;
    final offerB = repository.contexts.single['offerB']! as Map;
    expect(offerA['role'], 'Offer A role');
    expect(offerB['role'], 'Offer B role');
    expect(offerA['joiningDate'], '2026-11-12');
    expect(offerB.containsKey('joiningDate'), isFalse);
  });

  testWidgets(
    'renders a mixed comparison, missing-date safety, and collapsed evidence',
    (tester) async {
      final harness = await _Harness.create(_Repository());
      addTearDown(harness.dispose);
      await tester.pumpWidget(_screen(harness.controller));
      await harness.controller.submit(
        decisionType: 'COMPARE_OFFERS',
        context: _context(),
      );
      await tester.pumpAndSettle();
      await tester.pumpAndSettle();

      expect(find.text('Overall Comparison'), findsOneWidget);
      expect(find.text('Mixed'), findsOneWidget);
      expect(find.text('Offer A'), findsOneWidget);
      expect(find.text('Offer B'), findsOneWidget);
      expect(find.text('Timing Comparison'), findsOneWidget);
      expect(find.textContaining('cannot be compared'), findsWidgets);
      expect(
        find.text('Career-linked Dasha evidence is active.'),
        findsNothing,
      );
      expect(find.textContaining('definitely choose'), findsNothing);
      await tester.drag(find.byType(ListView), const Offset(0, -1600));
      await tester.pumpAndSettle();
      await tester.tap(find.text('View Detailed Astrology'));
      await tester.pumpAndSettle();
      expect(find.text('Dasha & Transit', skipOffstage: false), findsOneWidget);
    },
  );

  testWidgets(
    'keeps the form recoverable after error and prevents duplicate submit',
    (tester) async {
      final pending = Completer<CareerDecision>();
      final repository = _Repository(pending: pending);
      final harness = await _Harness.create(repository);
      addTearDown(harness.dispose);
      final first = harness.controller.submit(
        decisionType: 'COMPARE_OFFERS',
        context: _context(),
      );
      await harness.controller.submit(
        decisionType: 'COMPARE_OFFERS',
        context: _context(),
      );
      expect(repository.contexts, hasLength(1));
      pending.complete(_decision());
      await first;

      final failure = _Repository(failuresBeforeSuccess: 1);
      final failedHarness = await _Harness.create(failure);
      addTearDown(failedHarness.dispose);
      await failedHarness.controller.submit(
        decisionType: 'COMPARE_OFFERS',
        context: _context(),
      );
      expect(failedHarness.controller.state, CareerDecisionLoadState.error);
      await failedHarness.controller.submit(
        decisionType: 'COMPARE_OFFERS',
        context: _context(),
      );
      expect(failure.contexts, hasLength(2));
    },
  );
}

Widget _screen(CareerDecisionController controller) => MaterialApp(
  home: CareerDecisionScreen(
    controller: controller,
    decisionType: 'compare-offers',
  ),
);

Map<String, Object?> _context() => {
  'priorities': ['Career growth'],
  'offerA': {
    'offerDate': '2026-10-01',
    'joiningDate': '2026-11-12',
    'role': 'Offer A role',
    'moveType': 'NEW_COMPANY',
  },
  'offerB': {
    'offerDate': '2026-10-02',
    'role': 'Offer B role',
    'moveType': 'INTERNAL_MOVE',
  },
};

CareerDecision _decision() => CareerDecision.fromJson({
  'decisionType': 'COMPARE_OFFERS',
  'state': 'SUPPORTIVE_WITH_CONDITIONS',
  'overallView': 'The available timing and supplied priorities point to a mixed comparison rather than a single clear preference.',
  'timing': {
    'start': '2026-11-01T00:00:00.000Z',
    'end': '2026-12-01T00:00:00.000Z',
  },
  'context': {
    'priorities': ['Career growth'],
    'offerA': {
      'offerDate': '2026-10-01',
      'joiningDate': '2026-11-12',
      'role': 'Offer A role',
      'moveType': 'NEW_COMPANY',
    },
    'offerB': {
      'offerDate': '2026-10-02',
      'role': 'Offer B role',
      'moveType': 'INTERNAL_MOVE',
    },
  },
  'comparison': {
    'outcome': 'MIXED',
    'summary': 'The available timing and supplied practical priorities point to a mixed comparison rather than a single clear preference.',
    'timingComparison': 'Joining timing cannot be compared until both expected joining dates are known.',
    'offerA': {
      'timing': {
        'state': 'WITHIN_CURRENT_WINDOW',
        'message': 'The expected joining date falls within the current supported Career period.',
      },
      'priority': {
        'state': 'NOT_ASSESSED',
        'message': 'The supplied offer details do not establish a priority-based advantage for this offer.',
      },
      'strengths': [],
      'cautions': [],
    },
    'offerB': {
      'timing': {
        'state': 'NOT_ASSESSED',
        'message': 'No expected joining date was provided, so joining timing cannot be compared yet.',
      },
      'priority': {
        'state': 'NOT_ASSESSED',
        'message': 'The supplied offer details do not establish a priority-based advantage for this offer.',
      },
      'strengths': [],
      'cautions': ['Expected joining date is not known.'],
    },
  },
  'limitation': 'No outcome is guaranteed.',
  'detailedAstrology': {
    'evidence': [
      {
        'family': 'DASHA',
        'role': 'PRIMARY',
        'summary': 'Career-linked Dasha evidence is active.',
      },
    ],
  },
});

class _Repository implements CareerDecisionRepository {
  _Repository({this.pending, this.failuresBeforeSuccess = 0});
  final Completer<CareerDecision>? pending;
  int failuresBeforeSuccess;
  final types = <String>[];
  final contexts = <Map<String, Object?>>[];
  @override
  Future<CareerDecision> submit({
    required String birthProfileId,
    required String decisionType,
    required Map<String, Object?> context,
  }) {
    types.add(decisionType);
    contexts.add(Map.unmodifiable(context));
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
