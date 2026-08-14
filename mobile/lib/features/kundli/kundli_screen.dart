import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';
import '../../l10n/app_localizations.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/section_header.dart';

class KundliScreen extends StatelessWidget {
  const KundliScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          SectionHeader(title: t.myKundli),
          Semantics(
            label: t.chartSemantics,
            child: AppCard(
              child: AspectRatio(
                aspectRatio: 1,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: AppColors.navy.withValues(alpha: .25),
                    ),
                    borderRadius: AppRadius.medium,
                  ),
                  child: const Center(
                    child: Icon(Icons.grid_view_rounded, size: 48),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(t.kundliBody, style: Theme.of(context).textTheme.bodyLarge),
        ],
      ),
    );
  }
}
