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

  testWidgets('Stitch mobile login enables Continue only at ten digits', (
    tester,
  ) async {
    await tester.pumpWidget(_app(LoginScreen(controller: controller)));

    expect(find.text('SACRED VEDIC ASTROLOGY'), findsOneWidget);
    expect(find.text('Welcome to'), findsOneWidget);
    expect(find.text('KundliInsights'), findsOneWidget);
    expect(_continueButton(tester).onPressed, isNull);

    await tester.enterText(
      find.byKey(const ValueKey('mobile-number-input')),
      '98765',
    );
    await tester.pump();
    expect(_continueButton(tester).onPressed, isNull);

    await tester.enterText(
      find.byKey(const ValueKey('mobile-number-input')),
      '9876543210',
    );
    await tester.pump();
    expect(_phoneField(tester).controller!.text, '98765 43210');
    expect(_continueButton(tester).onPressed, isNotNull);
  });

  testWidgets('phone formatter rejects non-digits and submits E.164 once', (
    tester,
  ) async {
    await tester.pumpWidget(_app(LoginScreen(controller: controller)));
    await tester.enterText(
      find.byKey(const ValueKey('mobile-number-input')),
      '98x765 43210',
    );
    await tester.pump();
    expect(_phoneField(tester).controller!.text, '98765 43210');

    await tester.tap(find.byKey(const ValueKey('phone-continue')));
    await tester.tap(find.byKey(const ValueKey('phone-continue')));
    await tester.pump();
    expect(source.requestedPhones, ['+919876543210']);
  });

  testWidgets('OTP route retains the requested phone number', (tester) async {
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => LoginScreen(controller: controller),
        ),
        GoRoute(
          path: '/verify-otp',
          builder: (context, state) =>
              Text(state.uri.queryParameters['phone'] ?? 'missing'),
        ),
      ],
    );
    await tester.pumpWidget(_routerApp(router));
    await tester.enterText(
      find.byKey(const ValueKey('mobile-number-input')),
      '9876543210',
    );
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('phone-continue')));
    await tester.pumpAndSettle();
    expect(find.text('+919876543210'), findsOneWidget);
  });

  testWidgets(
    'OTP verification authenticates through the existing session path',
    (tester) async {
      await tester.pumpWidget(
        _app(
          VerifyOtpScreen(controller: controller, phoneNumber: '+919876543210'),
        ),
      );
      await _enterOtp(tester, '123456');
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey('verify-otp')));
      await tester.pump();
      expect(source.verified, [('+919876543210', '123456')]);
      expect(controller.state.status, AuthStatus.authenticated);
    },
  );

  testWidgets('invalid OTP renders only the safe error state', (tester) async {
    source.verifyError = StateError('raw provider detail');
    await tester.pumpWidget(
      _app(
        VerifyOtpScreen(controller: controller, phoneNumber: '+919876543210'),
      ),
    );
    await _enterOtp(tester, '123456');
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('verify-otp')));
    await tester.pump();
    expect(
      find.text('Something went wrong. Please try again.'),
      findsOneWidget,
    );
    expect(find.textContaining('raw provider detail'), findsNothing);
  });

  testWidgets('resend calls the OTP repository safely', (tester) async {
    await tester.pumpWidget(
      _app(
        VerifyOtpScreen(
          controller: controller,
          phoneNumber: '+919876543210',
          resendCooldown: Duration.zero,
        ),
      ),
    );
    final resend = find.byKey(const ValueKey('resend-otp'));
    await tester.ensureVisible(resend);
    await tester.tap(resend);
    await tester.pump();
    expect(source.requestedPhones, ['+919876543210']);
  });

  testWidgets('OTP screen presents six cells and Stitch verification details', (
    tester,
  ) async {
    await tester.pumpWidget(
      _app(
        VerifyOtpScreen(controller: controller, phoneNumber: '+919876543210'),
      ),
    );

    expect(find.text('Verify your mobile number'), findsOneWidget);
    expect(find.text('Code dispatched to'), findsOneWidget);
    expect(find.text('+91 ••••• 3210'), findsOneWidget);
    expect(find.byKey(const ValueKey('otp-cell-0')), findsOneWidget);
    expect(find.byKey(const ValueKey('otp-cell-5')), findsOneWidget);
    expect(find.text('Resend OTP in 00:30'), findsOneWidget);
    expect(find.textContaining('WhatsApp'), findsNothing);
  });

  testWidgets('pasting a six digit OTP verifies the concatenated value', (
    tester,
  ) async {
    await tester.pumpWidget(
      _app(
        VerifyOtpScreen(
          controller: controller,
          phoneNumber: '+919876543210',
          resendCooldown: Duration.zero,
        ),
      ),
    );

    await _enterOtp(tester, '123456');
    await tester.tap(find.byKey(const ValueKey('verify-otp')));
    await tester.pump();

    expect(source.verified, [('+919876543210', '123456')]);
  });

  testWidgets('resend cooldown enables a safe resend after the timer', (
    tester,
  ) async {
    await tester.pumpWidget(
      _app(
        VerifyOtpScreen(
          controller: controller,
          phoneNumber: '+919876543210',
          resendCooldown: const Duration(seconds: 1),
        ),
      ),
    );
    expect(find.text('Resend OTP in 00:01'), findsOneWidget);
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('Resend code now'), findsOneWidget);
  });
}

Future<void> _enterOtp(WidgetTester tester, String otp) async {
  await tester.enterText(find.byKey(const ValueKey('otp-cell-0')), otp);
  await tester.pump();
}

FilledButton _continueButton(WidgetTester tester) =>
    tester.widget<FilledButton>(
      find.descendant(
        of: find.byKey(const ValueKey('phone-continue')),
        matching: find.byType(FilledButton),
      ),
    );

TextField _phoneField(WidgetTester tester) =>
    tester.widget<TextField>(find.byKey(const ValueKey('mobile-number-input')));

Widget _app(Widget child) => _routerApp(
  GoRouter(
    routes: [GoRoute(path: '/', builder: (context, state) => child)],
  ),
);

Widget _routerApp(GoRouter router) => MaterialApp.router(
  localizationsDelegates: const [
    AppLocalizations.delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ],
  supportedLocales: AppLocalizations.supportedLocales,
  routerConfig: router,
);

class _Auth implements AuthRepository, PhoneOtpAuthRepository {
  final _states = StreamController<AuthSnapshot>.broadcast();
  final requestedPhones = <String>[];
  final verified = <(String, String)>[];
  Object? verifyError;
  bool authenticated = false;

  @override
  Stream<AuthSnapshot> get states => _states.stream;
  @override
  Future<String?> accessToken() async => null;
  @override
  Future<String?> refreshAccessToken() async => null;
  @override
  Future<AuthSnapshot> restore() async => AuthSnapshot(
    authenticated ? AuthStatus.authenticated : AuthStatus.unauthenticated,
    subject: authenticated ? 'phone-user' : null,
  );
  @override
  Future<void> requestPhoneOtp({required String phoneNumber}) async {
    requestedPhones.add(phoneNumber);
  }

  @override
  Future<void> verifyPhoneOtp({
    required String phoneNumber,
    required String otp,
  }) async {
    if (verifyError != null) throw verifyError!;
    verified.add((phoneNumber, otp));
    authenticated = true;
  }

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
