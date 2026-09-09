import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:kundlinsights_mobile/features/account/profile_screen.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';
import 'package:kundlinsights_mobile/l10n/app_localizations.dart';

void main() {
  late _AuthRepository authRepository;
  late AuthController authController;
  late ProfileController profileController;

  setUp(() async {
    authRepository = _AuthRepository();
    authController = AuthController(authRepository);
    await authController.restore();
    profileController = ProfileController(_ProfileRepository(), authController);
    await profileController.load();
  });

  tearDown(() {
    profileController.dispose();
    authController.dispose();
    authRepository.dispose();
  });

  testWidgets('renders the active profile hub and opens Birth Profiles', (
    tester,
  ) async {
    await tester.pumpWidget(_app(profileController, authController));

    expect(find.text('PROFILE'), findsOneWidget);
    expect(find.text('Profile & Settings'), findsOneWidget);
    expect(find.text('Aditi Sharma'), findsOneWidget);
    expect(find.text('ACTIVE PROFILE'), findsOneWidget);
    expect(find.text('Manage saved birth profiles'), findsOneWidget);
    expect(find.text('Terms of Service'), findsNothing);

    await tester.tap(find.text('Birth Profiles'));
    await tester.pumpAndSettle();
    expect(find.text('Birth profiles destination'), findsOneWidget);
  });

  testWidgets('reacts to the active profile and preserves logout behavior', (
    tester,
  ) async {
    await tester.pumpWidget(_app(profileController, authController));
    profileController.select(profileController.profiles.last);
    await tester.pump();
    expect(find.text('Rohan Mehta'), findsOneWidget);

    await tester.tap(find.text('Sign out'));
    await tester.pump();
    expect(authRepository.signOutCalls, 1);
  });
}

Widget _app(ProfileController profiles, AuthController auth) {
  final router = GoRouter(
    initialLocation: '/profile',
    routes: [
      GoRoute(
        path: '/profile',
        builder: (context, state) =>
            ProfileScreen(authController: auth, profileController: profiles),
      ),
      GoRoute(
        path: '/profiles',
        builder: (context, state) =>
            const Scaffold(body: Text('Birth profiles destination')),
      ),
    ],
  );
  return MaterialApp.router(
    routerConfig: router,
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
  );
}

class _AuthRepository implements AuthRepository {
  final _states = StreamController<AuthSnapshot>.broadcast();
  int signOutCalls = 0;

  @override
  Stream<AuthSnapshot> get states => _states.stream;

  @override
  Future<String?> accessToken() async => 'token';

  @override
  Future<String?> refreshAccessToken() async => 'token';

  @override
  Future<AuthSnapshot> restore() async =>
      const AuthSnapshot(AuthStatus.authenticated, subject: 'user');

  @override
  Future<void> signIn({
    required String email,
    required String password,
  }) async {}

  @override
  Future<void> signOut() async {
    signOutCalls++;
    _states.add(const AuthSnapshot(AuthStatus.unauthenticated));
  }

  @override
  Future<bool> signUp({
    required String email,
    required String password,
  }) async => true;

  void dispose() => _states.close();
}

class _ProfileRepository implements BirthProfileRepository {
  @override
  Future<BirthProfile> create({
    required String? displayLabel,
    required ResolvedBirthData birthData,
  }) => throw UnimplementedError();

  @override
  Future<BirthProfile> get(String id) => throw UnimplementedError();

  @override
  Future<List<BirthProfile>> list() async => [
    _profile('a', 'Aditi Sharma'),
    _profile('b', 'Rohan Mehta'),
  ];

  @override
  Future<ResolvedBirthData> resolveBirthTime({
    required String placeId,
    required String localDate,
    required String localTime,
  }) => throw UnimplementedError();

  @override
  Future<List<PlaceCandidate>> searchPlaces(String query) =>
      throw UnimplementedError();

  BirthProfile _profile(String id, String label) => BirthProfile(
    id: id,
    displayLabel: label,
    status: 'ACTIVE',
    birthData: ResolvedBirthData(const {
      'localDate': '1994-01-01',
      'localTime': '12:00:00',
      'timezone': 'Asia/Kolkata',
    }),
  );
}
