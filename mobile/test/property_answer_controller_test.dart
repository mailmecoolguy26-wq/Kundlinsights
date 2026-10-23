import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';
import 'package:kundlinsights_mobile/features/property/domain/property_answer.dart';
import 'package:kundlinsights_mobile/features/property/domain/property_answer_repository.dart';
import 'package:kundlinsights_mobile/features/property/property_answer_controller.dart';

void main() {
  test('reuses a cached Property answer for the same profile', () async {
    final harness = await _Harness.create();
    harness.repository.responses['profile-a'] = _answer('STRONG');

    await harness.controller.load();
    await harness.controller.load();

    expect(harness.repository.callsFor('profile-a'), 1);
    expect(harness.controller.answer?.classification, 'STRONG');

    harness.dispose();
  });

  test('keeps a cached Property answer when a forced refresh fails', () async {
    final harness = await _Harness.create();
    harness.repository.responses['profile-a'] = _answer('STRONG');
    await harness.controller.load();
    harness.repository.failures['profile-a'] = StateError('offline');

    await harness.controller.load(force: true);

    expect(harness.repository.callsFor('profile-a'), 2);
    expect(harness.controller.state, PropertyAnswerLoadState.loaded);
    expect(harness.controller.answer?.classification, 'STRONG');
    expect(harness.controller.error, isA<StateError>());

    harness.dispose();
  });

  test(
    'keeps Property results profile scoped and restores only that cache',
    () async {
      final harness = await _Harness.create();
      harness.repository.responses['profile-a'] = _answer('STRONG');
      harness.repository.responses['profile-b'] = _answer('MIXED');

      await harness.controller.load();
      harness.profiles.select(harness.profiles.profiles.last);
      await Future<void>.delayed(Duration.zero);
      expect(harness.controller.answer?.classification, 'MIXED');
      harness.profiles.select(harness.profiles.profiles.first);
      await Future<void>.delayed(Duration.zero);

      expect(harness.controller.answer?.classification, 'STRONG');
      expect(harness.repository.callsFor('profile-a'), 1);
      expect(harness.repository.callsFor('profile-b'), 1);

      harness.dispose();
    },
  );

  test(
    'profile switch clears Property state and rejects a stale answer',
    () async {
      final authSource = _Auth();
      final auth = AuthController(authSource);
      await auth.restore();
      final profiles = ProfileController(_Profiles(), auth);
      await Future<void>.delayed(Duration.zero);
      final repository = _Answers();
      final controller = PropertyAnswerController(repository, profiles);

      final pendingA = controller.load();
      profiles.select(profiles.profiles.last);
      expect(controller.answer, isNull);

      await Future<void>.delayed(Duration.zero);
      expect(controller.answer?.classification, 'MIXED');
      repository.a.complete(_answer('STRONG'));
      await pendingA;
      expect(controller.answer?.classification, 'MIXED');

      controller.dispose();
      profiles.dispose();
      auth.dispose();
    },
  );
}

class _Answers implements PropertyAnswerRepository {
  final a = Completer<PropertyAnswer>();
  final responses = <String, PropertyAnswer>{};
  final failures = <String, Object>{};
  final calls = <String, int>{};

  int callsFor(String profileId) => calls[profileId] ?? 0;

  @override
  Future<PropertyAnswer> getAnswer({
    required String birthProfileId,
    required PropertyIntent intent,
  }) {
    calls[birthProfileId] = callsFor(birthProfileId) + 1;
    final failure = failures[birthProfileId];
    if (failure != null) return Future.error(failure);
    final answer = responses[birthProfileId];
    if (answer != null) return Future.value(answer);
    return birthProfileId == 'profile-a'
        ? a.future
        : Future.value(_answer('MIXED'));
  }
}

class _Harness {
  _Harness._(this.auth, this.profiles, this.repository, this.controller);
  final AuthController auth;
  final ProfileController profiles;
  final _Answers repository;
  final PropertyAnswerController controller;

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
      PropertyAnswerController(repository, profiles),
    );
  }

  void dispose() {
    controller.dispose();
    profiles.dispose();
    auth.dispose();
  }
}

PropertyAnswer _answer(String classification) => PropertyAnswer(
  intent: PropertyIntent.purchaseTiming,
  answerability: 'SUPPORTED',
  classification: classification,
  windowStatus: 'BOUNDED_WINDOW',
  strongerWindow: null,
  evidence: const {},
);

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
