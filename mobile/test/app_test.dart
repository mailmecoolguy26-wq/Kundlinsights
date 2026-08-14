import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/app/app.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';

void main() {
  late _FakeAuthRepository repository;
  late AuthController controller;

  setUp(() {
    repository = _FakeAuthRepository(authenticated: true);
    controller = AuthController(repository);
  });

  tearDown(() => controller.dispose());

  testWidgets('boots to localized Home for a restored session', (tester) async {
    await tester.pumpWidget(KundlInsightsApp(authController: controller));
    await controller.restore();
    await tester.pumpAndSettle();
    expect(find.text('Welcome to KundlInsights'), findsOneWidget);
    expect(find.text('Home'), findsWidgets);
  });

  testWidgets('switches all primary tabs', (tester) async {
    await tester.pumpWidget(KundlInsightsApp(authController: controller));
    await controller.restore();
    await tester.pumpAndSettle();
    for (final item in const [
      ('Kundli', 'My Kundli'),
      ('Insights', 'Career'),
      ('Readings', 'Detailed Readings'),
      ('Profile', 'Settings'),
    ]) {
      await tester.tap(find.text(item.$1).last);
      await tester.pumpAndSettle();
      expect(find.text(item.$2), findsOneWidget);
    }
  });

  testWidgets('Kundli reserved chart is semantic', (tester) async {
    await tester.pumpWidget(KundlInsightsApp(authController: controller));
    await controller.restore();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Kundli').last);
    await tester.pumpAndSettle();
    expect(
      find.bySemanticsLabel(
        'Reserved North Indian Kundli chart area. No astrology data is shown yet.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('unauthenticated sessions are redirected to sign in', (
    tester,
  ) async {
    repository.authenticated = false;
    await tester.pumpWidget(KundlInsightsApp(authController: controller));
    await controller.restore();
    await tester.pumpAndSettle();
    expect(find.text('Welcome back'), findsOneWidget);
    expect(find.text('Sign in'), findsOneWidget);
  });

  testWidgets('sign-up navigation is available to unauthenticated users', (
    tester,
  ) async {
    repository.authenticated = false;
    await tester.pumpWidget(KundlInsightsApp(authController: controller));
    await controller.restore();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Create an account'));
    await tester.pumpAndSettle();
    expect(find.text('Create your account'), findsOneWidget);
  });

  testWidgets('logout returns an authenticated session to sign in', (
    tester,
  ) async {
    await tester.pumpWidget(KundlInsightsApp(authController: controller));
    await controller.restore();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Profile').last);
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Sign out'), 200);
    await tester.tap(find.text('Sign out'));
    await tester.pumpAndSettle();
    expect(find.text('Welcome back'), findsOneWidget);
  });
}

class _FakeAuthRepository implements AuthRepository {
  _FakeAuthRepository({required this.authenticated});

  bool authenticated;
  final _states = StreamController<AuthSnapshot>.broadcast();

  @override
  Stream<AuthSnapshot> get states => _states.stream;

  @override
  Future<String?> accessToken() async => authenticated ? 'test-token' : null;

  @override
  Future<String?> refreshAccessToken() async =>
      authenticated ? 'test-token' : null;

  @override
  Future<AuthSnapshot> restore() async => AuthSnapshot(
    authenticated ? AuthStatus.authenticated : AuthStatus.unauthenticated,
  );

  @override
  Future<void> signIn({required String email, required String password}) async {
    authenticated = true;
    _states.add(const AuthSnapshot(AuthStatus.authenticated));
  }

  @override
  Future<bool> signUp({required String email, required String password}) async {
    authenticated = true;
    _states.add(const AuthSnapshot(AuthStatus.authenticated));
    return true;
  }

  @override
  Future<void> signOut() async {
    authenticated = false;
    _states.add(const AuthSnapshot(AuthStatus.unauthenticated));
  }
}
