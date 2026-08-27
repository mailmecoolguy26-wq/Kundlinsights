import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../l10n/app_localizations.dart';
import 'router/app_router.dart';
import 'theme/app_theme.dart';
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

class KundlInsightsApp extends ConsumerStatefulWidget {
  const KundlInsightsApp({super.key, required this.authController});
  final AuthController authController;

  @override
  ConsumerState<KundlInsightsApp> createState() => _KundlInsightsAppState();
}

class _KundlInsightsAppState extends ConsumerState<KundlInsightsApp> {
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
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
      careerEvents,
    );
  }

  @override
  void dispose() {
    _router.dispose();
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
