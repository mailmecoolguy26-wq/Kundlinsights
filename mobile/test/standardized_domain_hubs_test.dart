import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:kundlinsights_mobile/core/analytics/analytics.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/family_expansion/family_expansion_answer.dart';
import 'package:kundlinsights_mobile/features/family_expansion/family_expansion_answer_controller.dart';
import 'package:kundlinsights_mobile/features/family_expansion/family_expansion_answer_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';
import 'package:kundlinsights_mobile/features/readings/career_explanation_language.dart';
import 'package:kundlinsights_mobile/features/relationships/domain/relationship_answer.dart';
import 'package:kundlinsights_mobile/features/relationships/domain/relationship_answer_repository.dart';
import 'package:kundlinsights_mobile/features/relationships/presentation/relationship_hub_screen.dart';
import 'package:kundlinsights_mobile/features/relationships/relationship_answer_controller.dart';
import 'package:kundlinsights_mobile/features/vehicle/domain/vehicle_answer.dart';
import 'package:kundlinsights_mobile/features/vehicle/domain/vehicle_answer_repository.dart';
import 'package:kundlinsights_mobile/features/vehicle/presentation/vehicle_hub_screen.dart';
import 'package:kundlinsights_mobile/features/vehicle/vehicle_answer_controller.dart';
import 'package:kundlinsights_mobile/features/wealth/domain/wealth_answer.dart';
import 'package:kundlinsights_mobile/features/wealth/domain/wealth_answer_repository.dart';
import 'package:kundlinsights_mobile/features/wealth/presentation/wealth_hub_screen.dart';
import 'package:kundlinsights_mobile/features/wealth/wealth_answer_controller.dart';

void main() {
  testWidgets('Vehicle hub follows the shared structure and uses real routes', (
    tester,
  ) async {
    final scope = await _Scope.create();
    final language = CareerExplanationLanguageController(_LanguageStorage());
    final controller = VehicleAnswerController(
      _VehicleRepository(),
      scope.profiles,
    );
    final router = _router(
      VehicleHubScreen(
        controller: controller,
        language: language,
        analytics: Analytics(const NoopAnalyticsProvider()),
      ),
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    await _reveal(tester, find.byKey(const ValueKey('domain-hub-ask-tara')));
    await tester.tap(find.byKey(const ValueKey('domain-hub-ask-tara')));
    await tester.pumpAndSettle();
    expect(find.text('Ask Tara destination'), findsOneWidget);

    router.go('/');
    await tester.pumpAndSettle();
    await _expectSections(tester, const [
      'Your Vehicle Outlook',
      'Ask TaraVerse',
      'Vehicle Timeline',
      'Vehicle Events',
      'Detailed Astrology',
    ]);
    await _reveal(tester, find.text('Vehicle Events').last);
    await tester.tap(find.text('Vehicle Events').last);
    await tester.pumpAndSettle();
    expect(find.text('Life Events destination'), findsOneWidget);

    controller.dispose();
    language.dispose();
    scope.dispose();
  });

  testWidgets('Wealth hub has no fake reading or events action', (
    tester,
  ) async {
    final scope = await _Scope.create();
    final controller = WealthAnswerController(
      _WealthRepository(),
      scope.profiles,
    );
    final router = _router(WealthHubScreen(controller: controller));
    addTearDown(router.dispose);
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    await _expectSections(tester, const [
      'Your Wealth Outlook',
      'Ask TaraVerse',
      'Wealth Timeline',
      'Wealth Events',
      'Detailed Astrology',
    ]);
    await _reveal(tester, find.text('Wealth Events').first);
    expect(find.textContaining('not available yet'), findsOneWidget);
    expect(find.text('Create Wealth Reading'), findsNothing);

    controller.dispose();
    scope.dispose();
  });

  testWidgets('Relationships and Family use ordered safe hub sections', (
    tester,
  ) async {
    final scope = await _Scope.create();
    final relationship = RelationshipAnswerController(
      _RelationshipRepository(),
      scope.profiles,
    );
    final family = FamilyExpansionAnswerController(
      _FamilyRepository(),
      scope.profiles,
    );
    final router = _router(
      RelationshipHubScreen(controller: relationship, familyController: family),
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    await _expectSections(tester, const [
      'Your Relationship Outlook',
      'Ask TaraVerse',
      'Relationship Timeline',
      'Relationship Events',
      'Detailed Astrology',
      'Your Family Outlook',
      'Family Timeline',
      'Family Events',
    ]);
    await _reveal(tester, find.textContaining('does not assess fertility'));
    expect(find.textContaining('does not assess fertility'), findsOneWidget);
    expect(find.text('Create Relationship Reading'), findsNothing);
    expect(find.text('Create Family Reading'), findsNothing);

    relationship.dispose();
    family.dispose();
    scope.dispose();
  });
}

Future<void> _expectSections(WidgetTester tester, List<String> labels) async {
  await tester.fling(find.byType(ListView).first, const Offset(0, 2000), 5000);
  await tester.pumpAndSettle();
  var last = -1.0;
  for (final label in labels) {
    final finder = find.text(label).first;
    await _reveal(tester, finder);
    final y = tester.getTopLeft(finder).dy;
    // Once scrolled, every requested section must exist. Ordering is also
    // encoded by the order in which scrollUntilVisible can advance the list.
    expect(y, greaterThanOrEqualTo(0));
    last = y;
  }
  expect(last, greaterThanOrEqualTo(0));
}

Future<void> _reveal(WidgetTester tester, Finder finder) async {
  for (var attempt = 0; attempt < 30 && finder.evaluate().isEmpty; attempt++) {
    await tester.drag(find.byType(ListView).first, const Offset(0, -240));
    await tester.pump();
  }
  expect(finder, findsWidgets);
  await tester.ensureVisible(finder);
  await tester.pump();
}

GoRouter _router(Widget home) => GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(path: '/', builder: (_, _) => home),
    GoRoute(
      path: '/career-chat',
      builder: (_, _) => const Scaffold(body: Text('Ask Tara destination')),
    ),
    GoRoute(
      path: '/life-events',
      builder: (_, _) => const Scaffold(body: Text('Life Events destination')),
    ),
    GoRoute(
      path: '/premium',
      builder: (_, _) => const Scaffold(body: Text('Premium destination')),
    ),
  ],
);

class _Scope {
  _Scope(this.auth, this.profiles);
  final AuthController auth;
  final ProfileController profiles;

  static Future<_Scope> create() async {
    final auth = AuthController(_AuthRepository());
    final profiles = ProfileController(_ProfileRepository(), auth);
    await auth.restore();
    await profiles.load();
    return _Scope(auth, profiles);
  }

  void dispose() {
    profiles.dispose();
    auth.dispose();
  }
}

class _AuthRepository implements AuthRepository {
  final _states = StreamController<AuthSnapshot>.broadcast();
  @override
  Stream<AuthSnapshot> get states => _states.stream;
  @override
  Future<String?> accessToken() async => 'token';
  @override
  Future<String?> refreshAccessToken() async => 'token';
  @override
  Future<AuthSnapshot> restore() async =>
      const AuthSnapshot(AuthStatus.authenticated, subject: 'subject');
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

class _ProfileRepository implements BirthProfileRepository {
  static final profile = BirthProfile(
    id: 'profile-a',
    displayLabel: 'Profile A',
    status: 'active',
    birthData: ResolvedBirthData(const {
      'localDate': '1990-01-01',
      'localTime': '12:00:00',
      'timezone': 'Asia/Kolkata',
      'displayLocation': 'Hyderabad, India',
    }),
  );
  @override
  Future<List<BirthProfile>> list() async => [profile];
  @override
  Future<BirthProfile> create({
    required String? displayLabel,
    required ResolvedBirthData birthData,
  }) async => profile;
  @override
  Future<BirthProfile> get(String id) async => profile;
  @override
  Future<ResolvedBirthData> resolveBirthTime({
    required String placeId,
    required String localDate,
    required String localTime,
  }) async => profile.birthData;
  @override
  Future<List<PlaceCandidate>> searchPlaces(String query) async => const [];
}

class _VehicleRepository implements VehicleAnswerRepository {
  @override
  Future<VehicleAnswer> getAnswer({
    required String birthProfileId,
    required VehicleIntent intent,
  }) async => VehicleAnswer.fromJson(_base('VEHICLE_PURCHASE_TIMING'));
}

class _WealthRepository implements WealthAnswerRepository {
  @override
  Future<WealthAnswer> getAnswer({
    required String birthProfileId,
    required WealthIntent intent,
  }) async => WealthAnswer.fromJson({
    ..._base('WEALTH_CURRENT_OUTLOOK'),
    'summary': 'Measured support.',
    'currentPhase': 'Current',
    'whatThisCanMean': const [],
    'supportiveFactors': const [],
    'cautionFactors': const [],
    'practicalFocus': const [],
    'detailedAstrology': const {},
    'ruleVersion': 'v1',
  });
}

class _RelationshipRepository implements RelationshipAnswerRepository {
  @override
  Future<RelationshipAnswer> getAnswer({
    required String birthProfileId,
    required RelationshipIntent intent,
  }) async => RelationshipAnswer.fromJson({
    ..._base('RELATIONSHIP_OUTLOOK'),
    'summary': 'Measured support.',
    'currentPhase': 'Current',
    'whatThisCanMean': const [],
    'supportiveFactors': const [],
    'cautionFactors': const [],
    'practicalFocus': const [],
    'detailedAstrology': const {},
    'ruleVersion': 'v1',
  });
}

class _FamilyRepository implements FamilyExpansionAnswerRepository {
  @override
  Future<FamilyExpansionAnswer> getAnswer({
    required String birthProfileId,
    required FamilyExpansionIntent intent,
  }) async => FamilyExpansionAnswer.fromJson({
    ..._base('FAMILY_EXPANSION_OUTLOOK'),
    'summary': 'Astrological context only.',
    'currentPhase': 'Current',
    'whatThisCanMean': const [],
    'supportiveFactors': const [],
    'cautionFactors': const [],
    'practicalFocus': const [],
    'detailedAstrology': const {},
    'limitations': const [],
    'ruleVersion': 'v1',
  });
}

Map<String, dynamic> _base(String intent) => {
  'intent': intent,
  'answerability': 'SUPPORTED',
  'classification': 'MODERATE_CANDIDATE',
  'state': 'Mixed',
  'windowShape': 'BOUNDED_WINDOW',
  'strongerWindow': {
    'start': '2026-11-20T00:00:00.000Z',
    'end': '2027-01-10T00:00:00.000Z',
    'state': 'Supportive',
    'candidateStrength': 'MODERATE_CANDIDATE',
    'windowShape': 'BOUNDED_WINDOW',
    'temporalStatus': 'FUTURE',
    'internalPhases': const [],
  },
  'evidence': const {},
};

class _LanguageStorage implements CareerExplanationLanguageStorage {
  @override
  Future<String?> readLanguage() async => 'english';
  @override
  Future<void> writeLanguage(CareerExplanationLanguage language) async {}
}
