import 'package:flutter/material.dart';

import '../analytics/analytics.dart';
import '../storage/secure_state_store.dart';
import 'push_notification_service.dart';

class PushPermissionPrompt {
  PushPermissionPrompt({
    required this.store,
    required this.service,
    required this.analytics,
  });
  static const _handledKey = 'push_permission_prompt_handled_v1';
  final PushPromptStore store;
  final PushRuntime service;
  final Analytics analytics;

  Future<void> maybeShow(BuildContext context) async {
    if (!context.mounted || await store.read(_handledKey) != null) return;
    final state = await service.permissionState();
    if (!context.mounted ||
        state == PushPermissionState.granted ||
        state == PushPermissionState.provisional ||
        state == PushPermissionState.denied) {
      if (state == PushPermissionState.denied) {
        await store.write(key: _handledKey, value: 'handled');
      }
      return;
    }
    analytics.track(AnalyticsEvent.pushPermissionPromptShown, {});
    final enable = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Stay updated with TaraVerse'),
        content: const Text(
          'Get notified when your readings and important TaraVerse updates are ready.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Not Now'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Enable Notifications'),
          ),
        ],
      ),
    );
    await store.write(key: _handledKey, value: 'handled');
    if (enable != true) return;
    final result = await service.requestPermission();
    analytics.track(
      result == PushPermissionState.granted ||
              result == PushPermissionState.provisional
          ? AnalyticsEvent.pushPermissionGranted
          : AnalyticsEvent.pushPermissionDenied,
      {},
    );
  }
}

abstract interface class PushPromptStore {
  Future<String?> read(String key);
  Future<void> write({required String key, required String value});
}

class SecurePushPromptStore implements PushPromptStore {
  const SecurePushPromptStore(this._store);
  final SecureStateStore _store;
  @override
  Future<String?> read(String key) => _store.read(key);
  @override
  Future<void> write({required String key, required String value}) =>
      _store.write(key: key, value: value);
}
