import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';
import '../../l10n/app_localizations.dart';
import '../../shared/widgets/app_card.dart';
import '../natal/domain/natal_summary.dart';
import '../natal/natal_summary_controller.dart';

class PlanetDetailScreen extends StatelessWidget {
  const PlanetDetailScreen({
    super.key,
    required this.natalController,
    required this.planetName,
  });

  final NatalSummaryController natalController;
  final String planetName;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: natalController,
    builder: (context, child) {
      final position = natalController.summary?.planets
          .where((item) => item.body == planetName)
          .cast<NatalPosition?>()
          .firstOrNull;
      if (position == null) {
        return Scaffold(
          appBar: AppBar(
            title: Text(AppLocalizations.of(context)!.planetDetail),
          ),
          body: const Center(child: CircularProgressIndicator()),
        );
      }
      return _PlanetFacts(position: position);
    },
  );
}

class _PlanetFacts extends StatelessWidget {
  const _PlanetFacts({required this.position});
  final NatalPosition position;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(position.body)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            AppCard(
              child: Column(
                children: [
                  _Fact(label: t.sign, value: position.sign.englishName),
                  _Fact(label: t.house, value: '${position.house}'),
                  _Fact(
                    label: t.longitude,
                    value: '${position.longitude.toStringAsFixed(4)}°',
                  ),
                  _Fact(
                    label: t.degreeInSign,
                    value: '${position.degreeWithinSign.toStringAsFixed(4)}°',
                  ),
                  _Fact(label: t.nakshatra, value: position.nakshatra.name),
                  _Fact(label: t.pada, value: '${position.pada}'),
                  _Fact(label: t.motion, value: position.motion ?? '—'),
                  _Fact(
                    label: t.retrograde,
                    value: position.retrograde ? t.retrograde : '—',
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              t.astronomicalDetails,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: AppSpacing.sm),
            AppCard(
              child: _Fact(
                label: t.speed,
                value: position.speed == null
                    ? '—'
                    : t.speedDegreesPerDay(position.speed!.toStringAsFixed(6)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.label, required this.value});
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
