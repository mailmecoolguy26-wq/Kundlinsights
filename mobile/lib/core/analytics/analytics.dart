import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

enum AnalyticsEvent {
  signupCompleted('signup_completed'),
  birthProfileCreated('birth_profile_created'),
  careerOpened('career_opened'),
  careerChatQuestionSent('career_chat_question_sent'),
  careerPaywallViewed('career_paywall_viewed'),
  purchaseStarted('purchase_started'),
  purchaseFailed('purchase_failed'),
  purchaseCompleted('purchase_completed'),
  careerUnlocked('career_unlocked'),
  pushPermissionPromptShown('push_permission_prompt_shown'),
  pushPermissionGranted('push_permission_granted'),
  pushPermissionDenied('push_permission_denied'),
  pushReceived('push_received'),
  pushOpened('push_opened'),
  pushDestinationOpened('push_destination_opened');

  const AnalyticsEvent(this.name);
  final String name;
}

abstract interface class AnalyticsProvider {
  FutureOr<void> track(String eventName, Map<String, Object?> properties);
}

/// Vendor-neutral, fail-open analytics boundary.  Only categorical and opaque
/// identifiers are allowed across this boundary.
class Analytics {
  Analytics(this._provider);
  final AnalyticsProvider _provider;

  static const _allowed = {
    'user_id',
    'birth_profile_id',
    'platform',
    'app_version',
    'screen',
    'source',
    'sku',
    'payment_provider',
    'product_type',
    'failure_category',
    'is_premium',
    'intent',
    'notification_type',
    'campaign_id',
    'app_state',
  };

  Future<void> track(
    AnalyticsEvent event, [
    Map<String, Object?> properties = const {},
  ]) async {
    final safe = <String, Object?>{};
    for (final entry in properties.entries) {
      if (_allowed.contains(entry.key) && _safeValue(entry.value)) {
        safe[entry.key] = entry.value;
      }
    }
    try {
      await _provider.track(event.name, Map.unmodifiable(safe));
    } catch (_) {}
  }

  static bool _safeValue(Object? value) =>
      value == null || value is String || value is bool || value is num;
}

class NoopAnalyticsProvider implements AnalyticsProvider {
  const NoopAnalyticsProvider();
  @override
  Future<void> track(String eventName, Map<String, Object?> properties) async {}
}

/// Swappable provider-neutral boundary. V1 intentionally ships with a no-op
/// adapter until a production analytics provider is selected.
final analyticsProvider = Provider<Analytics>(
  (ref) => Analytics(const NoopAnalyticsProvider()),
);
