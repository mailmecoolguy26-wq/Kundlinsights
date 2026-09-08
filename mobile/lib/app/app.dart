import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../l10n/app_localizations.dart';
import 'router/app_router.dart';
import 'theme/app_theme.dart';
import '../core/config/app_config.dart';
import '../features/auth/auth_controller.dart';
import '../features/profiles/profile_controller.dart';
import '../features/natal/natal_summary_controller.dart';
import '../features/divisional/divisional_chart_controller.dart';
import '../features/vimshottari/vimshottari_controller.dart';
import '../features/transits/transit_snapshot_controller.dart';
import '../features/ashtakavarga/ashtakavarga_controller.dart';
import '../features/readings/reading_controller.dart';
import '../features/readings/career_reading_generation_controller.dart';
import '../features/career_events/career_event_controller.dart';
import '../features/payments/career_premium_product_controller.dart';
import '../features/payments/data/career_premium_product_loader.dart';
import '../features/payments/career_premium_purchase_controller.dart';
import '../features/payments/razorpay_career_premium_controller.dart';
import '../features/payments/data/razorpay_purchase_service.dart';
import '../features/payments/data/payment_api_client.dart';
import '../features/splash/splash_launch_gate.dart';

class KundlInsightsApp extends ConsumerStatefulWidget {
  const KundlInsightsApp({
    super.key,
    required this.authController,
    this.splashLaunchGate,
  });
  final AuthController authController;
  final SplashLaunchGate? splashLaunchGate;

  @override
  ConsumerState<KundlInsightsApp> createState() => _KundlInsightsAppState();
}

class _KundlInsightsAppState extends ConsumerState<KundlInsightsApp> {
  late final GoRouter _router;
  late final SplashLaunchGate _splashLaunchGate;
  RazorpayCareerPremiumController? _razorpayPremium;

  @override
  void initState() {
    super.initState();
    _splashLaunchGate = widget.splashLaunchGate ?? SplashLaunchGate();
    final authController = widget.authController;
    final profiles = ref.read(profileControllerProvider(authController));
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
    final generation = ref.read(
      careerReadingGenerationControllerProvider((
        authController,
        profiles,
        readings,
      )),
    );
    final careerEvents = ref.read(
      careerEventControllerProvider((authController, profiles)),
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
      razorpayPremium: razorpayPremium,
      splashLaunchGate: _splashLaunchGate,
    );
  }

  @override
  void dispose() {
    _razorpayPremium?.dispose();
    _router.dispose();
    _splashLaunchGate.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'KundlInsights',
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
    );
  }
}
