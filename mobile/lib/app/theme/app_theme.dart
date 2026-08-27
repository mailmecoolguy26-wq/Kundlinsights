import 'package:flutter/material.dart';

abstract final class AppColors {
  static const midnight = Color(0xFF111A2F),
      navy = Color(0xFF273552),
      gold = Color(0xFFB58A42),
      saffron = Color(0xFFC9672B),
      ivory = Color(0xFFF8F4EC),
      surface = Color(0xFFFFFFFF),
      text = Color(0xFF182033),
      secondaryText = Color(0xFF5D6573),
      success = Color(0xFF2E7D63),
      warning = Color(0xFFA66C1B),
      error = Color(0xFFB63A3A);
}

abstract final class AppSpacing {
  static const xxs = 4.0,
      xs = 8.0,
      sm = 12.0,
      md = 16.0,
      lg = 20.0,
      xl = 24.0,
      xxl = 32.0,
      xxxl = 40.0;
}

abstract final class AppRadius {
  static const small = BorderRadius.all(Radius.circular(8)),
      medium = BorderRadius.all(Radius.circular(16)),
      large = BorderRadius.all(Radius.circular(24)),
      pill = BorderRadius.all(Radius.circular(999));
}

abstract final class AppTypography {
  static const display = TextStyle(
        fontSize: 32,
        height: 1.15,
        fontWeight: FontWeight.w700,
      ),
      h1 = TextStyle(fontSize: 26, height: 1.2, fontWeight: FontWeight.w700),
      h2 = TextStyle(fontSize: 21, height: 1.25, fontWeight: FontWeight.w700),
      h3 = TextStyle(fontSize: 17, height: 1.3, fontWeight: FontWeight.w600),
      body = TextStyle(fontSize: 16, height: 1.5),
      bodySmall = TextStyle(fontSize: 14, height: 1.45),
      caption = TextStyle(
        fontSize: 12,
        height: 1.35,
        fontWeight: FontWeight.w500,
      ),
      button = TextStyle(
        fontSize: 15,
        height: 1.2,
        fontWeight: FontWeight.w700,
      );
}

abstract final class AppTheme {
  static final light = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    colorScheme: const ColorScheme.light(
      primary: AppColors.midnight,
      onPrimary: AppColors.surface,
      secondary: AppColors.gold,
      onSecondary: AppColors.midnight,
      surface: AppColors.surface,
      onSurface: AppColors.text,
      error: AppColors.error,
      onError: AppColors.surface,
    ),
    scaffoldBackgroundColor: AppColors.ivory,
    textTheme: const TextTheme(
      displayLarge: AppTypography.display,
      headlineLarge: AppTypography.h1,
      headlineMedium: AppTypography.h2,
      headlineSmall: AppTypography.h3,
      bodyLarge: AppTypography.body,
      bodyMedium: AppTypography.bodySmall,
      bodySmall: AppTypography.caption,
      labelLarge: AppTypography.button,
    ).apply(bodyColor: AppColors.text, displayColor: AppColors.text),
    cardTheme: const CardThemeData(
      color: AppColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: AppRadius.medium),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(48),
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.pill),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        minimumSize: const Size.fromHeight(48),
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.pill),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(48),
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.pill),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.pill),
      ),
    ),
    appBarTheme: const AppBarTheme(
      centerTitle: false,
      backgroundColor: AppColors.ivory,
      foregroundColor: AppColors.text,
      elevation: 0,
    ),
    inputDecorationTheme: const InputDecorationTheme(
      border: OutlineInputBorder(borderRadius: AppRadius.medium),
      enabledBorder: OutlineInputBorder(borderRadius: AppRadius.medium),
      focusedBorder: OutlineInputBorder(borderRadius: AppRadius.medium),
    ),
    dividerTheme: const DividerThemeData(color: Color(0x1A182033)),
    dialogTheme: const DialogThemeData(
      shape: RoundedRectangleBorder(borderRadius: AppRadius.large),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      shape: RoundedRectangleBorder(borderRadius: AppRadius.large),
    ),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
    navigationBarTheme: const NavigationBarThemeData(height: 76),
  );
}
