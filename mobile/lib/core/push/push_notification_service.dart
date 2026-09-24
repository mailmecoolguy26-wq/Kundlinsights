import 'dart:async';
import 'dart:math';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../analytics/analytics.dart';

import '../storage/secure_state_store.dart';

enum PushPermissionState {
  notDetermined,
  granted,
  denied,
  provisional,
  unavailable,
}

class SafeForegroundPush {
  const SafeForegroundPush({
    required this.id,
    required this.title,
    required this.body,
    this.intent,
  });
  final String id;
  final String title;
  final String body;
  final PushDestinationIntent? intent;
}

class PushDestinationIntent {
  const PushDestinationIntent({
    required this.destinationType,
    this.birthProfileId,
    this.readingId,
    this.notificationType,
    this.campaignId,
  });
  final String destinationType;
  final String? birthProfileId;
  final String? readingId;
  final String? notificationType;
  final String? campaignId;
  static PushDestinationIntent? parse(Map<String, dynamic> data) {
    const allowed = {
      'HOME',
      'BIRTH_PROFILE',
      'CAREER_HISTORY',
      'CAREER_READING',
      'CAREER_PAYWALL',
      'READING_DETAIL',
    };
    final destination = data['destinationType'];
    if (destination is! String || !allowed.contains(destination)) {
      return null;
    }
    String? text(String key) =>
        data[key] is String && (data[key] as String).isNotEmpty
        ? data[key] as String
        : null;
    if (destination == 'READING_DETAIL' && text('readingId') == null) {
      return null;
    }
    return PushDestinationIntent(
      destinationType: destination,
      birthProfileId: text('birthProfileId'),
      readingId: text('readingId'),
      notificationType: text('notificationType'),
      campaignId: text('campaignId'),
    );
  }
}

class PushIntentQueue {
  final _seen = <String>{};
  PushDestinationIntent? _pending;
  bool get hasPending => _pending != null;
  void enqueue(PushDestinationIntent? intent, {String? identity}) {
    if (intent == null) {
      return;
    }
    final key =
        identity ??
        '${intent.destinationType}:${intent.readingId ?? intent.birthProfileId ?? ''}:${intent.campaignId ?? ''}';
    if (!_seen.add(key)) {
      return;
    }
    _pending = intent;
  }

  PushDestinationIntent? take() {
    final next = _pending;
    _pending = null;
    return next;
  }
}

typedef PushIntentNavigator = Future<bool> Function(
  PushDestinationIntent intent,
);

enum PushResolution { navigated, fallback, rejected }

class PushDestinationResolver {
  PushDestinationResolver({
    required this.navigate,
    required this.ownsProfile,
    required this.canOpenReading,
  });
  final PushIntentNavigator navigate;
  final Future<bool> Function(String profileId) ownsProfile;
  final Future<bool> Function(String readingId) canOpenReading;
  Future<PushResolution> resolve(PushDestinationIntent intent) async {
    if (intent.destinationType == 'HOME' ||
        intent.destinationType == 'BIRTH_PROFILE') {
      return await navigate(intent)
          ? PushResolution.navigated
          : PushResolution.fallback;
    }
    if (intent.destinationType == 'READING_DETAIL') {
      if (intent.readingId == null ||
          !await canOpenReading(intent.readingId!)) {
        return PushResolution.fallback;
      }
      return await navigate(intent)
          ? PushResolution.navigated
          : PushResolution.fallback;
    }
    if (intent.destinationType == 'CAREER_HISTORY' ||
        intent.destinationType == 'CAREER_READING' ||
        intent.destinationType == 'CAREER_PAYWALL') {
      if (intent.birthProfileId == null ||
          !await ownsProfile(intent.birthProfileId!)) {
        return PushResolution.fallback;
      }
      return await navigate(intent)
          ? PushResolution.navigated
          : PushResolution.fallback;
    }
    return PushResolution.rejected;
  }
}

/// Router-independent, testable gate: callers provide the authorized navigator.
class PushIntentDrain {
  PushIntentDrain({required this.queue, required this.navigate});
  final PushIntentQueue queue;
  final PushIntentNavigator navigate;
  bool _ready = false;
  bool _draining = false;
  void markReady() => _ready = true;
  Future<bool> drain() async {
    if (!_ready || _draining) return false;
    final intent = queue.take();
    if (intent == null) return false;
    _draining = true;
    try {
      return await navigate(intent);
    } finally {
      _draining = false;
    }
  }
}

abstract interface class PushRegistrationApi {
  Future<void> register({
    required String deviceId,
    required String platform,
    required String token,
  });
  Future<void> revoke({required String deviceId});
}

abstract interface class PushNotificationPreferencesApi {
  Future<PushNotificationPreferences> getPreferences();
  Future<PushNotificationPreferences> updatePreferences(
    PushNotificationPreferences value,
  );
}

abstract interface class PushNotificationActivityApi {
  Future<void> recordAppActivity();
  Future<void> recordReadingViewed(String readingId);
  Future<void> recordCareerPaywallViewed(String birthProfileId);
}

class PushNotificationPreferences {
  const PushNotificationPreferences({
    this.readingUpdates = true,
    this.careerReminders = true,
    this.offersAndUpdates = false,
  });
  final bool readingUpdates;
  final bool careerReminders;
  final bool offersAndUpdates;

  PushNotificationPreferences copyWith({
    bool? readingUpdates,
    bool? careerReminders,
    bool? offersAndUpdates,
  }) => PushNotificationPreferences(
    readingUpdates: readingUpdates ?? this.readingUpdates,
    careerReminders: careerReminders ?? this.careerReminders,
    offersAndUpdates: offersAndUpdates ?? this.offersAndUpdates,
  );
}

/// Minimal UI-facing push surface. Firebase remains an implementation detail.
abstract interface class PushRuntime {
  Future<PushPermissionState> permissionState();
  Future<PushPermissionState> requestPermission();
  PushNotificationPreferencesApi? get preferencesApi;
  PushNotificationActivityApi? get activityApi;
  bool get initialized;
  bool get tokenAcquired;
  bool get registrationSucceeded;
  bool get tokenRefreshActive;
  String? get lastPushType;
  String? get lastResolvedDestination;
  bool get hasPendingIntent;
  void queueForegroundTap(PushDestinationIntent? intent);
}

class FirebasePushNotificationService extends ChangeNotifier
    implements PushRuntime {
  FirebasePushNotificationService({
    required this.store,
    required this.api,
    FirebaseMessaging? messaging,
  }) : _injectedMessaging = messaging;

  final SecureStateStore store;
  final PushRegistrationApi api;
  final FirebaseMessaging? _injectedMessaging;

  FirebaseMessaging get _messaging =>
      _injectedMessaging ?? FirebaseMessaging.instance;
  StreamSubscription<String>? _tokenRefresh;
  PushDestinationIntent? pendingIntent;
  final intents = PushIntentQueue();
  @override
  bool initialized = false;
  @override
  bool tokenAcquired = false;
  @override
  bool registrationSucceeded = false;
  @override
  bool get tokenRefreshActive => _tokenRefresh != null;
  @override
  String? lastPushType;
  @override
  String? lastResolvedDestination;
  StreamSubscription<RemoteMessage>? _foreground;
  StreamSubscription<RemoteMessage>? _opened;
  final _foregroundMessageIds = <String>{};
  void Function(String title, String body, PushDestinationIntent? intent)?
  onForeground;

  Analytics? _messageAnalytics;
  void Function()? _onIntentQueued;
  bool get isConfigured => initialized;
  @override
  PushNotificationPreferencesApi? get preferencesApi =>
      api is PushNotificationPreferencesApi
      ? api as PushNotificationPreferencesApi
      : null;
  @override
  PushNotificationActivityApi? get activityApi =>
      api is PushNotificationActivityApi
      ? api as PushNotificationActivityApi
      : null;

  Future<bool> initialize() async {
    try {
      await Firebase.initializeApp();
      initialized = true;
      _bindMessageHandling();
      return true;
    } catch (_) {
      initialized = false;
      return false;
    }
  }

  @override
  Future<PushPermissionState> permissionState() async {
    if (!initialized) return PushPermissionState.unavailable;
    final settings = await _messaging.getNotificationSettings();
    return switch (settings.authorizationStatus) {
      AuthorizationStatus.authorized => PushPermissionState.granted,
      AuthorizationStatus.provisional => PushPermissionState.provisional,
      AuthorizationStatus.denied => PushPermissionState.denied,
      _ => PushPermissionState.notDetermined,
    };
  }

  @override
  Future<PushPermissionState> requestPermission() async {
    if (!initialized) return PushPermissionState.unavailable;
    await _messaging.requestPermission(alert: true, badge: true, sound: true);
    return permissionState();
  }

  Future<void> registerAuthenticatedUser() async {
    if (!initialized) return;
    final token = await _messaging.getToken();
    if (token == null) return;
    tokenAcquired = true;
    final id = await _deviceId();
    await api.register(
      deviceId: id,
      platform: defaultTargetPlatform == TargetPlatform.android
          ? 'ANDROID'
          : 'IOS',
      token: token,
    );
    registrationSucceeded = true;
    await _tokenRefresh?.cancel();
    _tokenRefresh = _messaging.onTokenRefresh.listen(
      (next) => api.register(
        deviceId: id,
        platform: defaultTargetPlatform == TargetPlatform.android
            ? 'ANDROID'
            : 'IOS',
        token: next,
      ),
    );
  }

  Future<void> logout() async {
    await _tokenRefresh?.cancel();
    _tokenRefresh = null;
    if (initialized) {
      await api.revoke(deviceId: await _deviceId());
    }
  }

  Future<void> captureInitialMessage() async {
    if (!initialized) return;
    final message = await _messaging.getInitialMessage();
    if (message != null) {
      pendingIntent = PushDestinationIntent.parse(message.data);
      lastPushType = pendingIntent?.notificationType;
      intents.enqueue(pendingIntent, identity: message.messageId);
      _onIntentQueued?.call();
    }
  }

  void startMessageHandling({
    required Analytics analytics,
    void Function(String title, String body, PushDestinationIntent? intent)?
    foreground,
    void Function()? onIntentQueued,
  }) {
    onForeground = foreground;
    _messageAnalytics = analytics;
    _onIntentQueued = onIntentQueued;
    _bindMessageHandling();
  }

  void _bindMessageHandling() {
    if (!initialized || _messageAnalytics == null) return;

    final analytics = _messageAnalytics!;

    _foreground ??= FirebaseMessaging.onMessage.listen((message) {
      if (message.messageId != null &&
          !_foregroundMessageIds.add(message.messageId!)) {
        return;
      }

      final intent = PushDestinationIntent.parse(message.data);
      lastPushType = intent?.notificationType;

      analytics.track(AnalyticsEvent.pushReceived, {
        'notification_type': intent?.notificationType,
        'campaign_id': intent?.campaignId,
        'platform': defaultTargetPlatform.name,
        'app_state': 'foreground',
      });

      final title = message.notification?.title;
      final body = message.notification?.body;

      if (title != null && body != null) {
        onForeground?.call(title, body, intent);
      }
    });

    _opened ??= FirebaseMessaging.onMessageOpenedApp.listen((message) {
      final intent = PushDestinationIntent.parse(message.data);
      lastPushType = intent?.notificationType;
      intents.enqueue(intent, identity: message.messageId);
      _onIntentQueued?.call();

      analytics.track(AnalyticsEvent.pushOpened, {
        'notification_type': intent?.notificationType,
        'campaign_id': intent?.campaignId,
        'platform': defaultTargetPlatform.name,
        'app_state': 'background',
      });
    });
  }

  /// A foreground banner calls this only after the user taps it. Receiving a
  /// foreground notification never navigates automatically.
  @override
  void queueForegroundTap(PushDestinationIntent? intent) =>
      intents.enqueue(intent);

  @override
  bool get hasPendingIntent => intents.hasPending;

  @override
  void dispose() {
    _tokenRefresh?.cancel();
    _foreground?.cancel();
    _opened?.cancel();
    super.dispose();
  }

  Future<String> _deviceId() async {
    const key = 'push_device_id_v1';
    final old = await store.read(key);
    if (old != null && old.isNotEmpty) return old;
    final random = Random.secure();
    final id = List.generate(
      32,
      (_) => random.nextInt(16).toRadixString(16),
    ).join();
    await store.write(key: key, value: id);
    return id;
  }
}
