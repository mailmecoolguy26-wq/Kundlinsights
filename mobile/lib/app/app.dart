import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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

class KundlInsightsApp extends ConsumerWidget {
  const KundlInsightsApp({super.key, required this.authController});
  final AuthController authController;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profiles = ref.watch(profileControllerProvider(authController));
    final natal = ref.watch(
      natalSummaryControllerProvider((authController, profiles)),
    );
    final divisional = ref.watch(
      divisionalChartControllerProvider((authController, profiles)),
    );
    final vimshottari = ref.watch(
      vimshottariControllerProvider((authController, profiles)),
    );
    final transits = ref.watch(
      transitSnapshotControllerProvider((authController, profiles)),
    );
    final ashtakavarga = ref.watch(
      ashtakavargaControllerProvider((authController, profiles)),
    );
    final readings = ref.watch(
      readingControllerProvider((authController, profiles)),
    );
    final generation = ref.watch(
      careerReadingGenerationControllerProvider((
        authController,
        profiles,
        readings,
      )),
    );
    return MaterialApp.router(
      title: 'KundlInsights',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      routerConfig: createAppRouter(
        authController,
        profiles,
        natal,
        divisional,
        vimshottari,
        transits,
        ashtakavarga,
        readings,
        generation,
      ),
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
