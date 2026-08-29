import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/auth/presentation/auth_screens.dart';
import 'package:kundlinsights_mobile/l10n/app_localizations.dart';

void main() {
  late _Auth source;
  late AuthController controller;

  setUp(() {
    source = _Auth();
    controller = AuthController(source);
  });
  tearDown(() => controller.dispose());

  testWidgets(
    'login validates required fields and toggles password visibility',
    (tester) async {
      await tester.pumpWidget(_app(LoginScreen(controller: controller)));
      await tester.tap(find.text('Sign in'));
      await tester.pump();
      expect(find.text('Enter your email.'), findsOneWidget);
      expect(find.text('Enter your password.'), findsOneWidget);
      await tester.tap(find.byTooltip('Show password'));
      await tester.pump();
      expect(find.byTooltip('Hide password'), findsOneWidget);
    },
  );

  testWidgets(
    'signup validates mismatch and exposes both visibility controls',
    (tester) async {
      await tester.pumpWidget(_app(SignupScreen(controller: controller)));
      final fields = find.byType(TextFormField);
      await tester.enterText(fields.at(0), 'user@example.com');
      await tester.enterText(fields.at(1), 'password1');
      await tester.enterText(fields.at(2), 'password2');
      await tester.tap(find.text('Sign up'));
      await tester.pump();
      expect(find.text('Passwords do not match.'), findsOneWidget);
      expect(find.byTooltip('Show password'), findsNWidgets(2));
    },
  );

  testWidgets('safe auth failures never render provider text', (tester) async {
    source.error = StateError('provider credential details');
    await tester.pumpWidget(_app(LoginScreen(controller: controller)));
    await tester.enterText(
      find.byType(TextFormField).at(0),
      'user@example.com',
    );
    await tester.enterText(find.byType(TextFormField).at(1), 'password1');
    await tester.tap(find.text('Sign in'));
    await tester.pump();
    expect(
      find.text('Something went wrong. Please try again.'),
      findsOneWidget,
    );
    expect(find.textContaining('provider credential details'), findsNothing);
  });
}

Widget _app(Widget child) => MaterialApp.router(
  localizationsDelegates: const [
    AppLocalizations.delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
  ],
  supportedLocales: AppLocalizations.supportedLocales,
  routerConfig: GoRouter(
    routes: [GoRoute(path: '/', builder: (context, state) => child)],
  ),
);

class _Auth implements AuthRepository {
  final _states = StreamController<AuthSnapshot>.broadcast();
  @override
  Stream<AuthSnapshot> get states => _states.stream;
  Object? error;
  @override
  Future<String?> accessToken() async => null;
  @override
  Future<String?> refreshAccessToken() async => null;
  @override
  Future<AuthSnapshot> restore() async =>
      const AuthSnapshot(AuthStatus.unauthenticated);
  @override
  Future<void> signIn({required String email, required String password}) async {
    if (error != null) throw error!;
  }

  @override
  Future<bool> signUp({
    required String email,
    required String password,
  }) async => true;
  @override
  Future<void> signOut() async {}
}
