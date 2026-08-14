import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';
import '../../l10n/app_localizations.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/premium_badge.dart';
import '../../shared/widgets/section_header.dart';

class InsightsScreen extends StatelessWidget {
  const InsightsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context)!;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          SectionHeader(title: text.insights, subtitle: text.insightsBody),
          _InsightItem(
            title: text.career,
            icon: Icons.work_outline,
            badge: true,
          ),
          _InsightItem(title: text.marriage, icon: Icons.favorite_border),
          _InsightItem(
            title: text.wealth,
            icon: Icons.account_balance_wallet_outlined,
          ),
        ],
      ),
    );
  }
}

class _InsightItem extends StatelessWidget {
  const _InsightItem({
    required this.title,
    required this.icon,
    this.badge = false,
  });

  final String title;
  final IconData icon;
  final bool badge;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context)!;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: AppCard(
        child: Row(
          children: [
            Icon(icon),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: Theme.of(context).textTheme.headlineSmall),
                  Text(
                    text.comingSoon,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
            if (badge) const PremiumBadge(),
          ],
        ),
      ),
    );
  }
}
