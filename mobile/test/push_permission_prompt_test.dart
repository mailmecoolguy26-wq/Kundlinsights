import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/core/analytics/analytics.dart';
import 'package:kundlinsights_mobile/core/push/push_notification_service.dart';
import 'package:kundlinsights_mobile/core/push/push_permission_prompt.dart';

void main() {
  testWidgets('Not Now persists handling without requesting permission', (
    tester,
  ) async {
    final runtime = _Runtime();
    final store = _Store();
    final prompt = PushPermissionPrompt(
      store: store,
      service: runtime,
      analytics: Analytics(_Analytics()),
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) {
            return ElevatedButton(
              onPressed: () => prompt.maybeShow(context),
              child: const Text('create'),
            );
          },
        ),
      ),
    );
    await tester.tap(find.text('create'));
    await tester.pumpAndSettle();
    expect(find.text('Stay updated with TaraVerse'), findsOneWidget);
    await tester.tap(find.text('Not Now'));
    await tester.pumpAndSettle();
    expect(store.values['push_permission_prompt_handled_v1'], 'handled');
    expect(runtime.requests, 0);
  });

  testWidgets('Enable records granted permission once', (tester) async {
    final runtime = _Runtime();
    final store = _Store();
    final analytics = _Analytics();
    final prompt = PushPermissionPrompt(
      store: store,
      service: runtime,
      analytics: Analytics(analytics),
    );
    await tester.pumpWidget(_trigger(prompt));
    await tester.tap(find.text('create'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Enable Notifications'));
    await tester.pumpAndSettle();
    expect(runtime.requests, 1);
    expect(analytics.events, [
      'push_permission_prompt_shown',
      'push_permission_granted',
    ]);
    expect(store.values['push_permission_prompt_handled_v1'], 'handled');
  });

  testWidgets('denied or handled permission does not repeatedly prompt', (
    tester,
  ) async {
    final runtime = _Runtime()..state = PushPermissionState.denied;
    final prompt = PushPermissionPrompt(
      store: _Store(),
      service: runtime,
      analytics: Analytics(_Analytics()),
    );
    await tester.pumpWidget(_trigger(prompt));
    await tester.tap(find.text('create'));
    await tester.pumpAndSettle();
    expect(find.text('Stay updated with TaraVerse'), findsNothing);
  });
}

Widget _trigger(PushPermissionPrompt prompt) => MaterialApp(
  home: Builder(
    builder: (context) => ElevatedButton(
      onPressed: () => prompt.maybeShow(context),
      child: const Text('create'),
    ),
  ),
);

class _Store implements PushPromptStore {
  final values = <String, String>{};
  @override
  Future<String?> read(String key) async => values[key];
  @override
  Future<void> write({required String key, required String value}) async {
    values[key] = value;
  }
}

class _Analytics implements AnalyticsProvider {
  final events = <String>[];
  @override
  Future<void> track(String a, Map<String, Object?> b) async => events.add(a);
}

class _Runtime implements PushRuntime {
  int requests = 0;
  PushPermissionState state = PushPermissionState.notDetermined;
  @override
  bool initialized = true;
  @override
  bool tokenAcquired = false;
  @override
  bool registrationSucceeded = false;
  @override
  bool get tokenRefreshActive => false;
  @override
  String? lastPushType;
  @override
  String? lastResolvedDestination;
  @override
  bool get hasPendingIntent => false;
  @override
  PushNotificationPreferencesApi? get preferencesApi => null;
  @override
  PushNotificationActivityApi? get activityApi => null;
  @override
  Future<PushPermissionState> permissionState() async => state;
  @override
  Future<PushPermissionState> requestPermission() async {
    requests++;
    return PushPermissionState.granted;
  }

  @override
  void queueForegroundTap(PushDestinationIntent? intent) {}
}
