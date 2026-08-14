import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/app_localizations.dart';
import 'router/app_router.dart';
import 'theme/app_theme.dart';
import '../features/auth/auth_controller.dart';
import '../features/profiles/profile_controller.dart';

class KundlInsightsApp extends ConsumerWidget {
  const KundlInsightsApp({super.key, required this.authController});
  final AuthController authController;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profiles = ref.watch(profileControllerProvider(authController));
    return MaterialApp.router(
      title: 'KundlInsights',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      routerConfig: createAppRouter(authController, profiles),
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
