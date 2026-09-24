import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/core/push/push_notification_service.dart';
import 'package:kundlinsights_mobile/core/push/push_runtime_boundaries.dart';

void main() {
  test('activity throttle uses injected time and swallows failures', () async {
    var now = DateTime.utc(2026, 1, 1);
    var calls = 0;
    final throttle = AppActivityThrottle(now: () => now);
    await throttle.onResume(authenticated: true, record: () async => calls++);
    now = now.add(const Duration(minutes: 2));
    await throttle.onResume(authenticated: true, record: () async => calls++);
    now = now.add(const Duration(minutes: 4));
    await throttle.onResume(authenticated: true, record: () async => calls++);
    await throttle.onResume(authenticated: false, record: () async => calls++);
    expect(calls, 2);
  });
  testWidgets('foreground presenter renders once and preserves typed Open', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1200, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final key = GlobalKey<ScaffoldMessengerState>();
    final seen = <PushDestinationIntent?>[];
    await tester.pumpWidget(
      MaterialApp(scaffoldMessengerKey: key, home: const Scaffold()),
    );
    final presenter = ForegroundPushPresenter();
    final event = SafeForegroundPush(
      id: 'a',
      title: 'Safe title',
      body: 'Safe body',
      intent: const PushDestinationIntent(destinationType: 'HOME'),
    );
    presenter.present(key.currentState!, event, seen.add);
    presenter.present(key.currentState!, event, seen.add);
    await tester.pump();
    expect(find.text('Safe title\nSafe body'), findsOneWidget);
    tester.widget<SnackBarAction>(find.byType(SnackBarAction)).onPressed();
    expect(seen, hasLength(1));
  });
}
