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

  @override
  Future<PropertyAnswer> getAnswer({
    required String birthProfileId,
    required PropertyIntent intent,
  }) =>
      birthProfileId == 'profile-a' ? a.future : Future.value(_answer('MIXED'));
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
