import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';

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
    child: Text('Premium', style: Theme.of(context).textTheme.bodySmall),
  );
}
