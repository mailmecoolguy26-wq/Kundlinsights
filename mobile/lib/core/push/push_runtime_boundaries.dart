import 'package:flutter/material.dart';

import 'push_notification_service.dart';

class ForegroundPushPresenter {
  final _seen = <String>{};
  void present(
    ScaffoldMessengerState messenger,
    SafeForegroundPush event,
    void Function(PushDestinationIntent?) onOpen,
  ) {
    if (!_seen.add(event.id)) return;
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        content: Text('${event.title}\n${event.body}'),
        action: event.intent == null
            ? null
            : SnackBarAction(
                label: 'Open',
                onPressed: () => onOpen(event.intent),
              ),
      ),
    );
  }
}

typedef NowProvider = DateTime Function();

class AppActivityThrottle {
  AppActivityThrottle({
    this.now = DateTime.now,
    this.interval = const Duration(minutes: 5),
  });
  final NowProvider now;
  final Duration interval;
  DateTime? _last;
  Future<void> onResume({
    required bool authenticated,
    required Future<void> Function() record,
  }) async {
    if (!authenticated) return;
    final value = now();
    if (_last != null && value.difference(_last!) < interval) return;
    _last = value;
    try {
      await record();
    } catch (_) {}
  }
}
