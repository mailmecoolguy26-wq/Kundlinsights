import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import '../l10n/app_localizations.dart';
import 'router/app_router.dart';
import 'theme/app_theme.dart';
import '../features/auth/auth_controller.dart';

class KundlInsightsApp extends StatelessWidget {
  const KundlInsightsApp({super.key, required this.authController});
  final AuthController authController;
  @override
  Widget build(BuildContext context) => MaterialApp.router(
    title: 'KundlInsights',
    debugShowCheckedModeBanner: false,
    theme: AppTheme.light,
    routerConfig: createAppRouter(authController),
    localizationsDelegates: const [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    supportedLocales: AppLocalizations.supportedLocales,
  );
}
