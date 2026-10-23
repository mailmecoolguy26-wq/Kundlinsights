import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';
import 'package:kundlinsights_mobile/features/vehicle/domain/vehicle_answer.dart';
import 'package:kundlinsights_mobile/features/vehicle/domain/vehicle_answer_repository.dart';
import 'package:kundlinsights_mobile/features/vehicle/vehicle_answer_controller.dart';

void main() {
  test('reuses a cached Vehicle answer for the same profile', () async {
    final harness = await _Harness.create();
    harness.repository.responses['profile-a'] = _answer('MODERATE_CANDIDATE');

    await harness.controller.load();
    await harness.controller.load();

    expect(harness.repository.callsFor('profile-a'), 1);
    expect(harness.controller.answer?.candidateStrength, 'MODERATE_CANDIDATE');

    harness.dispose();
  });

  test('keeps a cached Vehicle answer when a forced refresh fails', () async {
    final harness = await _Harness.create();
    harness.repository.responses['profile-a'] = _answer('MODERATE_CANDIDATE');
    await harness.controller.load();
    harness.repository.failures['profile-a'] = StateError('offline');

    await harness.controller.load(force: true);

    expect(harness.repository.callsFor('profile-a'), 2);
    expect(harness.controller.state, VehicleAnswerLoadState.loaded);
    expect(harness.controller.answer?.candidateStrength, 'MODERATE_CANDIDATE');
    expect(harness.controller.error, isA<StateError>());

    harness.dispose();
  });

  test(
    'keeps Vehicle results profile scoped and restores only that cache',
    () async {
      final harness = await _Harness.create();
      harness.repository.responses['profile-a'] = _answer('MODERATE_CANDIDATE');
      harness.repository.responses['profile-b'] = _answer('MIXED_CANDIDATE');

      await harness.controller.load();
      harness.profiles.select(harness.profiles.profiles.last);
      await Future<void>.delayed(Duration.zero);
      expect(harness.controller.answer?.candidateStrength, 'MIXED_CANDIDATE');
      harness.profiles.select(harness.profiles.profiles.first);
      await Future<void>.delayed(Duration.zero);

      expect(
        harness.controller.answer?.candidateStrength,
        'MODERATE_CANDIDATE',
      );
      expect(harness.repository.callsFor('profile-a'), 1);
      expect(harness.repository.callsFor('profile-b'), 1);

      harness.dispose();
    },
  );
}

VehicleAnswer _answer(String classification) => VehicleAnswer(
  intent: VehicleIntent.purchaseTiming,
  answerability: 'SUPPORTED',
  candidateStrength: classification,
  windowShape: 'BOUNDED_WINDOW',
  strongerWindow: null,
  evidence: const {},
);

class _Answers implements VehicleAnswerRepository {
  final responses = <String, VehicleAnswer>{};
  final failures = <String, Object>{};
  final calls = <String, int>{};

  int callsFor(String profileId) => calls[profileId] ?? 0;

  @override
  Future<VehicleAnswer> getAnswer({
    required String birthProfileId,
    required VehicleIntent intent,
  }) {
    calls[birthProfileId] = callsFor(birthProfileId) + 1;
    final failure = failures[birthProfileId];
    if (failure != null) return Future.error(failure);
    return Future.value(
      responses[birthProfileId] ?? _answer('MIXED_CANDIDATE'),
    );
  }
}

class _Harness {
  _Harness._(this.auth, this.profiles, this.repository, this.controller);
  final AuthController auth;
  final ProfileController profiles;
  final _Answers repository;
  final VehicleAnswerController controller;

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
      VehicleAnswerController(repository, profiles),
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
