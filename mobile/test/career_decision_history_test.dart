import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/career_answers/career_decision_controller.dart';
import 'package:kundlinsights_mobile/features/career_answers/career_decision_history_controller.dart';
import 'package:kundlinsights_mobile/features/career_answers/domain/career_decision.dart';
import 'package:kundlinsights_mobile/features/career_answers/presentation/career_decision_history_screen.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';

void main() {
  testWidgets('history is newest-first and renders safe customer labels', (
    tester,
  ) async {
    final repository = _Repository();
    final harness = await _Harness.create(repository);
    addTearDown(harness.dispose);

    await tester.pumpWidget(
      MaterialApp(
        home: CareerDecisionHistoryScreen(controller: harness.history),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Job Offer'), findsOneWidget);
    expect(find.text('Career Abroad'), findsOneWidget);
    expect(find.text('Senior Product Manager'), findsOneWidget);
    expect(find.text('Overseas Job · Singapore'), findsOneWidget);
    expect(find.textContaining('More Supportive'), findsNWidgets(2));
    expect(repository.listProfiles, ['profile-a']);
  });

  testWidgets('saved result uses detail GET only and remains marked saved', (
    tester,
  ) async {
    final repository = _Repository();
    final harness = await _Harness.create(repository);
    addTearDown(harness.dispose);

    await tester.pumpWidget(
      MaterialApp(
        home: CareerDecisionSavedScreen(
          controller: harness.history,
          decisionId: 'decision-a',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(repository.detailCalls, ['profile-a/decision-a']);
    expect(repository.submitCalls, isZero);
    expect(find.textContaining('Saved Career Decision'), findsOneWidget);
    expect(find.text('Overall View'), findsOneWidget);
    expect(find.text('View Detailed Astrology'), findsOneWidget);
  });

  test(
    'profile switch clears old decisions and reloads the new profile',
    () async {
      final repository = _Repository();
      final harness = await _Harness.create(repository);
      addTearDown(harness.dispose);
      await harness.history.load();
      expect(harness.history.decisions.first.decisionId, 'decision-a');

      harness.profiles.select(_profile('profile-b'));
      await _settle();

      expect(repository.listProfiles, ['profile-a', 'profile-b']);
      expect(harness.history.decisions.single.decisionId, 'decision-b');
    },
  );
}

Future<void> _settle() => Future<void>.delayed(Duration.zero);

class _Harness {
  _Harness(this.auth, this.profiles, this.history);
  final AuthController auth;
  final ProfileController profiles;
  final CareerDecisionHistoryController history;
  static Future<_Harness> create(_Repository repository) async {
    final auth = AuthController(_Auth());
    await auth.restore();
    final profiles = ProfileController(_Profiles(), auth);
    await profiles.load();
    return _Harness(
      auth,
      profiles,
      CareerDecisionHistoryController(repository, profiles),
    );
  }

  void dispose() {
    history.dispose();
    profiles.dispose();
    auth.dispose();
  }
}

class _Repository implements CareerDecisionRepository {
  final listProfiles = <String>[];
  final detailCalls = <String>[];
  var submitCalls = 0;

  @override
  Future<List<CareerDecisionSummary>> listDecisions({
    required String birthProfileId,
  }) async {
    listProfiles.add(birthProfileId);
    if (birthProfileId == 'profile-b') {
      return [_summary('decision-b', 'SWITCH_JOB', '2026-10-30T12:00:00Z')];
    }
    return [
      _summary(
        'decision-a',
        'JOB_OFFER',
        '2026-10-31T12:00:00Z',
        role: 'Senior Product Manager',
      ),
      _summary(
        'decision-c',
        'CAREER_ABROAD',
        '2026-10-30T12:00:00Z',
        abroad: true,
      ),
    ];
  }

  @override
  Future<CareerDecision> getDecision({
    required String birthProfileId,
    required String decisionId,
  }) async {
    detailCalls.add('$birthProfileId/$decisionId');
    return CareerDecision.fromJson({
      'decisionId': decisionId,
      'createdAt': '2026-10-31T12:00:00Z',
      'decisionType': 'JOB_OFFER',
      'state': 'MORE_SUPPORTIVE',
      'overallView': 'Stored decision output.',
      'supports': ['Stored evidence.'],
      'cautions': [],
      'practicalFactors': [],
      'whatToDo': ['Compare practical conditions.'],
      'limitation': '',
      'detailedAstrology': {
        'evidence': [
          {'family': 'Dasha', 'role': 'SUPPORT', 'summary': 'Stored evidence.'},
        ],
      },
    });
  }

  @override
  Future<CareerDecision> submit({
    required String birthProfileId,
    required String decisionType,
    required Map<String, Object?> context,
  }) {
    submitCalls++;
    return Future.error(UnimplementedError());
  }
}

CareerDecisionSummary _summary(
  String id,
  String type,
  String created, {
  String? role,
  bool abroad = false,
}) => CareerDecisionSummary.fromJson({
  'decisionId': id,
  'decisionType': type,
  'state': 'MORE_SUPPORTIVE',
  'createdAt': created,
  'context': {
    'role': ?role,
    if (abroad) 'abroadPath': 'OVERSEAS_JOB',
    if (abroad) 'targetRegion': 'Singapore',
  },
});

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
    _profile('profile-a'),
    _profile('profile-b'),
  ];
  @override
  Future<BirthProfile> create({
    String? displayLabel,
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

BirthProfile _profile(String id) => BirthProfile(
  id: id,
  displayLabel: id,
  status: 'active',
  birthData: ResolvedBirthData(const {'timezone': 'UTC'}),
);
