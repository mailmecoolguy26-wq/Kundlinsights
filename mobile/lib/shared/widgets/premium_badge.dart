import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';
import '../../l10n/app_localizations.dart';

class PremiumBadge extends StatelessWidget {
  const PremiumBadge({super.key});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(
      horizontal: AppSpacing.sm,
      vertical: AppSpacing.xxs,
    ),
    decoration: const BoxDecoration(
      color: AppColors.gold,
      borderRadius: AppRadius.pill,
    ),
    child: Text(
      AppLocalizations.of(context)!.premium,
      style: Theme.of(context).textTheme.bodySmall,
    ),
  );
}
