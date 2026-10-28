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
  testWidgets('Promotion / growth renders only its approved context controls', (
    tester,
  ) async {
    final harness = await _Harness.create();
    addTearDown(harness.dispose);
    await tester.pumpWidget(_screen(harness.controller, 'promotion-growth'));
    expect(
      find.text('WHAT KIND OF GROWTH ARE YOU LOOKING FOR?'),
      findsOneWidget,
    );
    expect(find.text('Leadership role'), findsOneWidget);
    expect(find.text('Have discussions already started?'), findsOneWidget);
    expect(find.text('Preferred / expected timeline'), findsOneWidget);
  });

  testWidgets('Business form preserves build/preparation and runway context', (
    tester,
  ) async {
    final harness = await _Harness.create();
    addTearDown(harness.dispose);
    await tester.pumpWidget(_screen(harness.controller, 'start-business'));
    expect(find.text('Should I start a business?'), findsOneWidget);
    expect(find.text('How are you planning to start?'), findsOneWidget);
    expect(find.text('Current stage'), findsOneWidget);
    expect(find.text('Runway (optional)'), findsOneWidget);
    expect(find.textContaining('quit your job'), findsNothing);
  });

  testWidgets(
    'Career abroad separates application context from movement timing',
    (tester) async {
      final harness = await _Harness.create();
      addTearDown(harness.dispose);
      await tester.pumpWidget(_screen(harness.controller, 'career-abroad'));
      expect(find.text('What kind of international move?'), findsOneWidget);
      expect(find.text('Are you already applying?'), findsOneWidget);
      expect(
        find.text('Expected joining / movement date (optional)'),
        findsOneWidget,
      );
      expect(find.textContaining('visa'), findsNothing);
    },
  );
}

Widget _screen(CareerDecisionController controller, String type) => MaterialApp(
  home: CareerDecisionScreen(controller: controller, decisionType: type),
);

class _Harness {
  _Harness(this.auth, this.profiles, this.controller);
  final AuthController auth;
  final ProfileController profiles;
  final CareerDecisionController controller;
  static Future<_Harness> create() async {
    final auth = AuthController(_Auth());
    await auth.restore();
    final profiles = ProfileController(_Profiles(), auth);
    await profiles.load();
    return _Harness(
      auth,
      profiles,
      CareerDecisionController(_Repository(), profiles),
    );
  }

  void dispose() {
    controller.dispose();
    profiles.dispose();
    auth.dispose();
  }
}

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
  @override
  Future<CareerDecision> submit({
    required String birthProfileId,
    required String decisionType,
    required Map<String, Object?> context,
  }) => Future.error(UnimplementedError());
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
      displayLabel: 'A',
      status: 'active',
      birthData: ResolvedBirthData(const {'timezone': 'UTC'}),
    ),
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
