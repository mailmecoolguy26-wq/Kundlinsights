import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../l10n/app_localizations.dart';
import 'router/app_router.dart';
import 'router/push_navigation_adapter.dart';
import 'theme/app_theme.dart';
import '../core/config/app_config.dart';
import '../core/analytics/analytics.dart';
import '../core/push/push_notification_service.dart';
import '../core/push/push_permission_prompt.dart';
import '../core/push/push_runtime_boundaries.dart';
import '../core/storage/secure_state_store.dart';
import '../features/auth/auth_controller.dart';
import '../features/auth/domain/auth_repository.dart';
import '../features/profiles/profile_controller.dart';
import '../features/natal/natal_summary_controller.dart';
import '../features/divisional/divisional_chart_controller.dart';
import '../features/vimshottari/vimshottari_controller.dart';
import '../features/transits/transit_snapshot_controller.dart';
import '../features/ashtakavarga/ashtakavarga_controller.dart';
import '../features/readings/reading_controller.dart';
import '../features/readings/career_explanation_language.dart';
import '../features/readings/astrology_presentation_copy.dart';
import '../features/readings/career_reading_generation_controller.dart';
import '../features/career_events/career_event_controller.dart';
import '../features/payments/career_premium_product_controller.dart';
import '../features/payments/data/career_premium_product_loader.dart';
import '../features/payments/career_premium_purchase_controller.dart';
import '../features/payments/razorpay_career_premium_controller.dart';
import '../features/payments/data/razorpay_purchase_service.dart';
import '../features/payments/data/payment_api_client.dart';
import '../features/splash/splash_launch_gate.dart';
import '../features/career_chat/career_chat_controller.dart';

class KundlInsightsApp extends ConsumerStatefulWidget {
  const KundlInsightsApp({
    super.key,
    required this.authController,
    this.splashLaunchGate,
    this.pushNotifications,
    this.now = DateTime.now,
    this.foregroundEvents,
  });
  final AuthController authController;
  final SplashLaunchGate? splashLaunchGate;
  final FirebasePushNotificationService? pushNotifications;
  final NowProvider now;
  final Stream<SafeForegroundPush>? foregroundEvents;

  @override
  ConsumerState<KundlInsightsApp> createState() => _KundlInsightsAppState();
}

class _KundlInsightsAppState extends ConsumerState<KundlInsightsApp>
    with WidgetsBindingObserver {
  late final GoRouter _router;
  late final SplashLaunchGate _splashLaunchGate;
  late final CareerExplanationLanguageController _careerExplanationLanguage;
  late final CareerChatController _careerChat;
  late final ProfileController _profiles;
  late final CareerReadingGenerationController _generation;
  late final PushNavigationAdapter _pushNavigation;
  late final PushIntentDrain _pushDrain;
  PushPermissionPrompt? _pushPermissionPrompt;
  final _scaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();
  bool _routerReady = false;
  late final AppActivityThrottle _activityThrottle;
  final _foregroundPresenter = ForegroundPushPresenter();
  RazorpayCareerPremiumController? _razorpayPremium;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _activityThrottle = AppActivityThrottle(now: widget.now);
    _splashLaunchGate = widget.splashLaunchGate ?? SplashLaunchGate();
    _careerExplanationLanguage = CareerExplanationLanguageController(
      SecureCareerExplanationLanguageStorage(
        ref.read(secureStateStoreProvider),
      ),
    );
    _careerExplanationLanguage.load();
    final authController = widget.authController;
    final analytics = ref.read(analyticsProvider);
    if (widget.pushNotifications != null) {
      _pushPermissionPrompt = PushPermissionPrompt(
        store: SecurePushPromptStore(ref.read(secureStateStoreProvider)),
        service: widget.pushNotifications!,
        analytics: analytics,
      );
    }
    final profiles = _profiles = ref.read(
      profileControllerProvider(authController),
    );
    final natal = ref.read(
      natalSummaryControllerProvider((authController, profiles)),
    );
    final divisional = ref.read(
      divisionalChartControllerProvider((authController, profiles)),
    );
    final vimshottari = ref.read(
      vimshottariControllerProvider((authController, profiles)),
    );
    final transits = ref.read(
      transitSnapshotControllerProvider((authController, profiles)),
    );
    final ashtakavarga = ref.read(
      ashtakavargaControllerProvider((authController, profiles)),
    );
    final readings = ref.read(
      readingControllerProvider((authController, profiles)),
    );
    final generation = _generation = ref.read(
      careerReadingGenerationControllerProvider((
        authController,
        profiles,
        readings,
      )),
    );
    final careerEvents = ref.read(
      careerEventControllerProvider((authController, profiles)),
    );
    _careerChat = ref.read(
      careerChatControllerProvider((profiles, _careerExplanationLanguage)),
    );
    final premiumProduct = ref.read(careerPremiumProductControllerProvider);
    final premiumPurchase = ref.read(
      careerPremiumPurchaseControllerProvider((
        premiumProduct,
        generation,
        AppConfig.fromEnvironment()?.applePaymentEnvironment,
        defaultTargetPlatform == TargetPlatform.android
            ? CareerPremiumStorePlatform.googlePlay
            : CareerPremiumStorePlatform.apple,
      )),
    );
    final config = AppConfig.fromEnvironment();
    final razorpayPremium = config?.isRazorpayCareerPremiumEligible != true
        ? null
        : _razorpayPremium = RazorpayCareerPremiumController(
            api: ref.read(paymentApiClientProvider),
            checkout: RazorpayPurchaseService(),
            entitlements: CareerReadingEntitlementRefresher(generation),
            analytics: analytics,
          );
    _router = createAppRouter(
      authController,
      profiles,
      natal,
      divisional,
      vimshottari,
      transits,
      ashtakavarga,
      readings,
      generation,
      premiumProduct,
      premiumPurchase,
      careerEvents,
      analytics: analytics,
      careerChat: _careerChat,
      razorpayPremium: razorpayPremium,
      careerExplanationLanguage: _careerExplanationLanguage,
      splashLaunchGate: _splashLaunchGate,
      pushNotifications: widget.pushNotifications,
      pushPermissionPrompt: _pushPermissionPrompt,
    );
    _pushNavigation = PushNavigationAdapter(
      router: _GoRouterPushRouteNavigator(_router),
      profiles: () => _profiles.profiles,
      selectProfile: _profiles.select,
      readings: ref.read(readingRepositoryProvider),
      refreshCareerEligibility: _generation.refreshEligibility,
      careerEligibilityState: () => _generation.eligibilityState,
    );
    _pushDrain = PushIntentDrain(
      queue: widget.pushNotifications?.intents ?? PushIntentQueue(),
      navigate: _navigatePushIntent,
    );
    authController.addListener(_tryDrainPushIntents);
    _profiles.addListener(_tryDrainPushIntents);
    widget.pushNotifications?.startMessageHandling(
      analytics: analytics,
      // Receiving a foreground push is deliberately passive. Its banner action
      // calls [handleForegroundPushTap] and follows this same queue.
      foreground: _showForegroundPush,
      onIntentQueued: _tryDrainPushIntents,
    );
    widget.foregroundEvents?.listen(_handleSafeForegroundEvent);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _routerReady = true;
      _pushDrain.markReady();
      _tryDrainPushIntents();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed ||
        widget.authController.state.status != AuthStatus.authenticated) {
      return;
    }
    _activityThrottle.onResume(
      authenticated: true,
      record: () async =>
          widget.pushNotifications?.activityApi?.recordAppActivity(),
    );
  }

  /// Entry point for the foreground banner's user-initiated action.
  @visibleForTesting
  void handleForegroundPushTap(PushDestinationIntent? intent) {
    widget.pushNotifications?.queueForegroundTap(intent);
    _tryDrainPushIntents();
  }

  void _showForegroundPush(
    String title,
    String body,
    PushDestinationIntent? intent,
  ) {
    _presentForegroundPush(
      SafeForegroundPush(
        id: '$title:$body',
        title: title,
        body: body,
        intent: intent,
      ),
    );
  }

  void _handleSafeForegroundEvent(SafeForegroundPush event) {
    _presentForegroundPush(event);
  }

  void _presentForegroundPush(SafeForegroundPush event) {
    final messenger = _scaffoldMessengerKey.currentState;
    if (messenger != null) {
      _foregroundPresenter.present(messenger, event, handleForegroundPushTap);
    }
  }

  bool get _pushReady =>
      _routerReady &&
      widget.authController.state.status == AuthStatus.authenticated &&
      _profiles.state == ProfileLoadState.ready;

  void _tryDrainPushIntents() {
    if (!_pushReady) return;
    unawaited(_drainPushIntents());
  }

  Future<void> _drainPushIntents() async {
    final handled = await _pushDrain.drain();
    if (handled && _pushDrain.queue.hasPending) _tryDrainPushIntents();
  }

  Future<bool> _navigatePushIntent(PushDestinationIntent intent) async {
    final opened = await _pushNavigation.navigate(intent);
    if (!opened) {
      _router.go(PushNavigationAdapter.homeLocation);
      return false;
    }
    widget.pushNotifications?.lastResolvedDestination = intent.destinationType;
    ref.read(analyticsProvider).track(AnalyticsEvent.pushDestinationOpened, {
      'notification_type': intent.notificationType,
      'campaign_id': intent.campaignId,
      'platform': defaultTargetPlatform.name,
      'app_state': 'active',
    });
    return true;
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    widget.authController.removeListener(_tryDrainPushIntents);
    _profiles.removeListener(_tryDrainPushIntents);
    _razorpayPremium?.dispose();
    _careerExplanationLanguage.dispose();
    _router.dispose();
    _splashLaunchGate.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AstrologyPresentationScope(
      controller: _careerExplanationLanguage,
      child: MaterialApp.router(
        scaffoldMessengerKey: _scaffoldMessengerKey,
        title: 'TaraVerse',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        routerConfig: _router,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
      ),
    );
  }
}

class _GoRouterPushRouteNavigator implements PushRouteNavigator {
  const _GoRouterPushRouteNavigator(this.router);
  final GoRouter router;

  @override
  void go(String location) => router.go(location);
}
