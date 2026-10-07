import 'package:flutter/material.dart';

abstract final class AppColors {
  /// Core TaraVerse dark-teal visual system. These are semantic tokens rather
  /// than feature colours so every module can share one product identity.
  static const backgroundPrimary = Color(0xFF061A1A),
      backgroundSecondary = Color(0xFF082625),
      surfacePrimary = Color(0xFF0B2626),
      surfaceElevated = Color(0xFF114A46),
      surfaceSubtle = Color(0xFF0B3D3B),
      brandPrimary = Color(0xFF0F5C55),
      brandSecondary = Color(0xFF0B3D3B),
      accentTurquoise = Color(0xFF35B9AC),
      accentGold = Color(0xFFD6B15A),
      textPrimary = Color(0xFFF7F4EC),
      textSecondary = Color(0xFFA8B7B4),
      textMuted = Color(0xFF718582),
      borderSubtle = Color(0xFF255C57),
      borderActive = Color(0xFF358F85),
      success = Color(0xFF52B788),
      warning = Color(0xFFE0A84F),
      error = Color(0xFFE98686);

  static const premium = accentGold;

  static const backgroundGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [backgroundPrimary, brandSecondary, brandPrimary],
  );

  static const elevatedGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [surfacePrimary, surfaceElevated],
  );

  static const insightGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [brandSecondary, brandPrimary, Color(0xFF167D73)],
  );

  // Compatibility aliases for the small number of shared components that
  // already consume AppColors directly.
  static const midnight = backgroundPrimary,
      navy = surfaceElevated,
      gold = accentGold,
      saffron = warning,
      ivory = textPrimary,
      surface = surfacePrimary,
      text = textPrimary,
      secondaryText = textSecondary;
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
  /// Kept as `light` for compatibility with the existing app/test entry
  /// points; the TaraVerse product theme itself is intentionally dark.
  static final light = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: const ColorScheme.dark(
      primary: AppColors.accentTurquoise,
      onPrimary: AppColors.backgroundPrimary,
      secondary: AppColors.accentGold,
      onSecondary: AppColors.backgroundPrimary,
      surface: AppColors.surfacePrimary,
      onSurface: AppColors.textPrimary,
      error: AppColors.error,
      onError: AppColors.backgroundPrimary,
    ),
    scaffoldBackgroundColor: AppColors.backgroundPrimary,
    textTheme: const TextTheme(
      displayLarge: AppTypography.display,
      headlineLarge: AppTypography.h1,
      headlineMedium: AppTypography.h2,
      headlineSmall: AppTypography.h3,
      bodyLarge: AppTypography.body,
      bodyMedium: AppTypography.bodySmall,
      bodySmall: AppTypography.caption,
      labelLarge: AppTypography.button,
    ).apply(bodyColor: AppColors.textPrimary, displayColor: AppColors.textPrimary),
    cardTheme: const CardThemeData(
      color: AppColors.surfacePrimary,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: AppRadius.medium),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.accentTurquoise,
        foregroundColor: AppColors.backgroundPrimary,
        minimumSize: const Size.fromHeight(48),
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.pill),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.surfaceElevated,
        foregroundColor: AppColors.textPrimary,
        minimumSize: const Size.fromHeight(48),
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.pill),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.textPrimary,
        side: const BorderSide(color: AppColors.borderSubtle),
        minimumSize: const Size.fromHeight(48),
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.pill),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.accentTurquoise,
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.pill),
      ),
    ),
    appBarTheme: const AppBarTheme(
      centerTitle: false,
      backgroundColor: AppColors.backgroundPrimary,
      foregroundColor: AppColors.textPrimary,
      elevation: 0,
    ),
    inputDecorationTheme: const InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surfacePrimary,
      hintStyle: TextStyle(color: AppColors.textMuted),
      labelStyle: TextStyle(color: AppColors.textSecondary),
      border: OutlineInputBorder(
        borderRadius: AppRadius.medium,
        borderSide: BorderSide(color: AppColors.borderSubtle),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: AppRadius.medium,
        borderSide: BorderSide(color: AppColors.borderSubtle),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: AppRadius.medium,
        borderSide: BorderSide(color: AppColors.accentTurquoise, width: 1.5),
      ),
    ),
    dividerTheme: const DividerThemeData(color: AppColors.borderSubtle),
    dialogTheme: const DialogThemeData(
      backgroundColor: AppColors.surfacePrimary,
      titleTextStyle: AppTypography.h2,
      contentTextStyle: AppTypography.bodySmall,
      shape: RoundedRectangleBorder(borderRadius: AppRadius.large),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      shape: RoundedRectangleBorder(borderRadius: AppRadius.large),
    ),
    snackBarTheme: const SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: AppColors.surfaceElevated,
      contentTextStyle: TextStyle(color: AppColors.textPrimary),
    ),
    navigationBarTheme: const NavigationBarThemeData(
      height: 76,
      backgroundColor: AppColors.backgroundPrimary,
      indicatorColor: Color(0x1F35B9AC),
    ),
  );
}
