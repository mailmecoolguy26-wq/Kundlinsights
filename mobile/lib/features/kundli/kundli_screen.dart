import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme/app_theme.dart';
import '../../l10n/app_localizations.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/section_header.dart';
import '../natal/domain/natal_summary.dart';
import '../natal/natal_summary_controller.dart';
import '../profiles/profile_controller.dart';

class KundliScreen extends StatelessWidget {
  const KundliScreen({
    super.key,
    required this.profileController,
    required this.natalController,
  });

  final ProfileController profileController;
  final NatalSummaryController natalController;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: natalController,
    builder: (context, child) {
      final t = AppLocalizations.of(context)!;
      final summary = natalController.summary;
      return SafeArea(
        child: RefreshIndicator(
          onRefresh: natalController.refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              SectionHeader(
                title: t.myKundli,
                subtitle: profileController.activeProfile?.label,
              ),
              if (natalController.state == NatalSummaryLoadState.loading ||
                  natalController.state == NatalSummaryLoadState.initial)
                const _NatalLoading()
              else if (summary == null)
                _NatalError(onRetry: natalController.refresh)
              else ...[
                _IdentityCards(summary: summary),
                const SizedBox(height: AppSpacing.xl),
                SectionHeader(title: t.planetaryPositions),
                ...summary.planets.map(
                  (position) => _PlanetRow(position: position),
                ),
              ],
              const SizedBox(height: AppSpacing.xl),
              SectionHeader(title: t.northIndianChart),
              Semantics(
                label: t.northIndianChartSemantics,
                child: AppCard(
                  child: Column(
                    children: [
                      const Icon(Icons.grid_view_rounded, size: 48),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        t.northIndianChartPlaceholder,
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}

class _NatalLoading extends StatelessWidget {
  const _NatalLoading();
  @override
  Widget build(BuildContext context) => const AppCard(
    child: SizedBox(
      height: 220,
      child: Center(child: CircularProgressIndicator()),
    ),
  );
}

class _NatalError extends StatelessWidget {
  const _NatalError({required this.onRetry});
  final Future<void> Function() onRetry;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return AppCard(
      child: Column(
        children: [
          Text(t.natalSummaryUnavailable, textAlign: TextAlign.center),
          const SizedBox(height: AppSpacing.md),
          FilledButton(onPressed: onRetry, child: Text(t.retry)),
        ],
      ),
    );
  }
}

class _IdentityCards extends StatelessWidget {
  const _IdentityCards({required this.summary});
  final NatalSummary summary;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final identity = summary.summary;
    return AppCard(
      child: Column(
        children: [
          _Value(
            label: t.ascendant,
            value: identity.ascendant.sign.englishName,
          ),
          _Value(label: t.moonSign, value: identity.moonSign.englishName),
          _Value(label: t.nakshatra, value: identity.moonNakshatra.name),
          _Value(label: t.pada, value: '${identity.moonPada}'),
          _Value(label: t.sunSign, value: identity.sunSign.englishName),
        ],
      ),
    );
  }
}

class _Value extends StatelessWidget {
  const _Value({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
    child: Row(
      children: [
        Expanded(child: Text(label)),
        Text(value),
      ],
    ),
  );
}

class _PlanetRow extends StatelessWidget {
  const _PlanetRow({required this.position});
  final NatalPosition position;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Semantics(
        label:
            '${position.body}, ${position.sign.englishName}, ${t.house} ${position.house}${position.retrograde ? ', ${t.retrograde}' : ''}',
        button: true,
        child: AppCard(
          padding: EdgeInsets.zero,
          child: ListTile(
            title: Text(position.body),
            subtitle: Text(
              '${position.sign.englishName} · ${position.degreeWithinSign.toStringAsFixed(2)}° · ${t.house} ${position.house}\n${position.nakshatra.name} · ${t.pada} ${position.pada}',
            ),
            trailing: position.retrograde
                ? Chip(label: Text(t.retrograde))
                : const Icon(Icons.chevron_right),
            onTap: () => context.goNamed(
              'planet-detail',
              pathParameters: {'planet': position.body},
            ),
          ),
        ),
      ),
    );
  }
}
