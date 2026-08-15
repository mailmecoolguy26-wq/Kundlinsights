import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme/app_theme.dart';
import '../../l10n/app_localizations.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/section_header.dart';
import '../natal/domain/natal_summary.dart';
import '../natal/natal_summary_controller.dart';
import '../profiles/profile_controller.dart';
import '../divisional/divisional_chart_controller.dart';
import '../divisional/domain/divisional_chart.dart';
import 'divisional_chart_panel.dart';
import 'north_indian_chart.dart';

class KundliScreen extends StatefulWidget {
  const KundliScreen({
    super.key,
    required this.profileController,
    required this.natalController,
    required this.divisionalController,
  });

  final ProfileController profileController;
  final NatalSummaryController natalController;
  final DivisionalChartController divisionalController;

  @override
  State<KundliScreen> createState() => _KundliScreenState();
}

class _KundliScreenState extends State<KundliScreen> {
  DivisionalChartType? _selectedType;

  void _select(DivisionalChartType? type) {
    setState(() => _selectedType = type);
    if (type != null) widget.divisionalController.load(type);
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.sm,
              AppSpacing.md,
              0,
            ),
            child: SegmentedButton<DivisionalChartType?>(
              segments: [
                ButtonSegment(value: null, label: Text(t.d1)),
                ButtonSegment(value: DivisionalChartType.d9, label: Text(t.d9)),
                ButtonSegment(
                  value: DivisionalChartType.d10,
                  label: Text(t.d10),
                ),
              ],
              selected: {_selectedType},
              onSelectionChanged: (selection) => _select(selection.single),
            ),
          ),
          Expanded(
            child: _selectedType == null
                ? _D1KundliContent(
                    profileController: widget.profileController,
                    natalController: widget.natalController,
                  )
                : DivisionalChartPanel(
                    profileController: widget.profileController,
                    controller: widget.divisionalController,
                    type: _selectedType!,
                  ),
          ),
        ],
      ),
    );
  }
}

class _D1KundliContent extends StatelessWidget {
  const _D1KundliContent({
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
      return RefreshIndicator(
        onRefresh: natalController.refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            SectionHeader(
              title: t.myKundli,
              subtitle: profileController.activeProfile?.label,
            ),
            Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton.icon(
                onPressed: () => context.push('/ashtakavarga'),
                icon: const Icon(Icons.grid_view_outlined),
                label: Text(t.ashtakavarga),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            if (natalController.state == NatalSummaryLoadState.loading ||
                natalController.state == NatalSummaryLoadState.initial)
              const _NatalLoading()
            else if (summary == null)
              _NatalError(onRetry: natalController.refresh)
            else ...[
              SectionHeader(title: t.northIndianChart),
              AppCard(
                padding: const EdgeInsets.all(AppSpacing.xs),
                child: NorthIndianKundliChart(
                  houses: buildD1ChartHouses(summary),
                  onHouseTap: (house) => _showHouseDetails(context, house),
                  onPlanetTap: (planet) => context.goNamed(
                    'planet-detail',
                    pathParameters: {'planet': planet.body},
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              _HouseAccessibilityFallback(houses: buildD1ChartHouses(summary)),
              const SizedBox(height: AppSpacing.xl),
              _IdentityCards(summary: summary),
              const SizedBox(height: AppSpacing.xl),
              SectionHeader(title: t.planetaryPositions),
              ...summary.planets.map(
                (position) => _PlanetRow(position: position),
              ),
            ],
          ],
        ),
      );
    },
  );
}

void _showHouseDetails(BuildContext context, D1ChartHouse house) {
  final t = AppLocalizations.of(context)!;
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (context) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${t.house} ${house.house}',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text('${t.sign}: ${house.sign.englishName}'),
            const SizedBox(height: AppSpacing.sm),
            Text(
              house.planets.isEmpty
                  ? t.noPlanets
                  : house.planets
                        .map(
                          (planet) =>
                              '${planet.body}${planet.retrograde ? ' (${t.retrograde})' : ''}',
                        )
                        .join(', '),
            ),
          ],
        ),
      ),
    ),
  );
}

class _HouseAccessibilityFallback extends StatelessWidget {
  const _HouseAccessibilityFallback({required this.houses});

  final List<D1ChartHouse> houses;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return Material(
      color: Colors.transparent,
      child: ExpansionTile(
        title: Text(t.chartAccessibleHouseList),
        children: houses
            .map(
              (house) => ListTile(
                dense: true,
                title: Text(
                  '${t.house} ${house.house} — ${house.sign.englishName}',
                ),
                subtitle: Text(
                  house.planets.isEmpty
                      ? t.noPlanets
                      : house.planets
                            .map(
                              (planet) =>
                                  '${planet.body}${planet.retrograde ? ' (${t.retrograde})' : ''}',
                            )
                            .join(', '),
                ),
              ),
            )
            .toList(growable: false),
      ),
    );
  }
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
