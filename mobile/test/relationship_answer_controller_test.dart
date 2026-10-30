import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';
import 'package:kundlinsights_mobile/features/relationships/domain/relationship_answer.dart';
import 'package:kundlinsights_mobile/features/relationships/domain/relationship_answer_repository.dart';
import 'package:kundlinsights_mobile/features/relationships/relationship_answer_controller.dart';

void main() {
  test(
    'relationship answers are profile-scoped and stale responses cannot leak',
    () async {
      final auth = AuthController(_Auth());
      await auth.restore();
      final profiles = ProfileController(_Profiles(), auth);
      await Future<void>.delayed(Duration.zero);
      final repository = _Answers();
      final controller = RelationshipAnswerController(repository, profiles);

      final pendingA = controller.load();
      profiles.select(profiles.profiles.last);
      await Future<void>.delayed(Duration.zero);
      expect(controller.answer?.state, 'Mixed');
      repository.a.complete(_answer('Supportive'));
      await pendingA;
      expect(controller.answer?.state, 'Mixed');

      controller.invalidateProfile('profile-b');
      await Future<void>.delayed(Duration.zero);
      expect(repository.callsFor('profile-b'), greaterThanOrEqualTo(2));
      controller.dispose();
      profiles.dispose();
      auth.dispose();
    },
  );

  test(
    'a failed refresh retains a cached relationship result and permits retry',
    () async {
      final harness = await _Harness.create();
      harness.repository.responses['profile-a'] = _answer('Improving');
      await harness.controller.load();
      harness.repository.failures['profile-a'] = StateError('offline');
      await harness.controller.load(force: true);
      expect(harness.controller.state, RelationshipAnswerLoadState.loaded);
      expect(harness.controller.answer?.state, 'Improving');
      expect(harness.controller.error, isA<StateError>());
      harness.dispose();
    },
  );
}

RelationshipAnswer _answer(String state) => RelationshipAnswer(
  intent: RelationshipIntent.outlook,
  answerability: 'SUPPORTED',
  state: state,
  summary: 'Server summary',
  currentPhase: state,
  strongerWindow: null,
  marriageOutlook: null,
  whatThisCanMean: const [],
  supportiveFactors: const [],
  cautionFactors: const [],
  practicalFocus: const [],
  detailedAstrology: const {},
  ruleVersion: 'relationship-marriage-rules-v1',
);

class _Answers implements RelationshipAnswerRepository {
  final a = Completer<RelationshipAnswer>();
  final responses = <String, RelationshipAnswer>{};
  final failures = <String, Object>{};
  final calls = <String, int>{};
  int callsFor(String id) => calls[id] ?? 0;
  @override
  Future<RelationshipAnswer> getAnswer({
    required String birthProfileId,
    required RelationshipIntent intent,
  }) {
    calls[birthProfileId] = callsFor(birthProfileId) + 1;
    if (failures[birthProfileId] case final failure?) {
      return Future.error(failure);
    }
    if (responses[birthProfileId] case final answer?) {
      return Future.value(answer);
    }
    return birthProfileId == 'profile-a'
        ? a.future
        : Future.value(_answer('Mixed'));
  }
}

class _Harness {
  _Harness._(this.auth, this.profiles, this.repository, this.controller);
  final AuthController auth;
  final ProfileController profiles;
  final _Answers repository;
  final RelationshipAnswerController controller;
  static Future<_Harness> create() async {
    final auth = AuthController(_Auth());
    await auth.restore();
    final profiles = ProfileController(_Profiles(), auth);
    await Future<void>.delayed(Duration.zero);
    final repository = _Answers();
    return _Harness._(
      auth,
      profiles,
      repository,
      RelationshipAnswerController(repository, profiles),
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
    _profile('profile-a'),
    _profile('profile-b'),
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

BirthProfile _profile(String id) => BirthProfile(
  id: id,
  displayLabel: id,
  birthData: ResolvedBirthData(const {'timezone': 'UTC'}),
  status: 'active',
);
