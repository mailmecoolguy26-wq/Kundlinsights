import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';
import '../../l10n/app_localizations.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/section_header.dart';
import '../divisional/divisional_chart_controller.dart';
import '../divisional/domain/divisional_chart.dart';
import '../profiles/profile_controller.dart';
import 'north_indian_chart.dart';

class DivisionalChartPanel extends StatelessWidget {
  const DivisionalChartPanel({
    super.key,
    required this.profileController,
    required this.controller,
    required this.type,
  });

  final ProfileController profileController;
  final DivisionalChartController controller;
  final DivisionalChartType type;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, child) {
      final chart = controller.chart(type);
      final state = controller.state(type);
      final t = AppLocalizations.of(context)!;
      final title = type == DivisionalChartType.d9 ? t.navamsa : t.dasamsa;
      return RefreshIndicator(
        onRefresh: () => controller.load(type, refresh: true),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            SectionHeader(
              title: title,
              subtitle: profileController.activeProfile?.label,
            ),
            if (state == DivisionalChartLoadState.initial ||
                state == DivisionalChartLoadState.loading ||
                state == DivisionalChartLoadState.refreshing)
              const _DivisionalLoading()
            else if (chart == null)
              _DivisionalError(
                onRetry: () => controller.load(type, refresh: true),
              )
            else ...[
              AppCard(
                child: Text(
                  '${t.ascendant}: ${chart.ascendant.sign.englishName} · '
                  '${chart.ascendant.degreeWithinSign.toStringAsFixed(2)}°',
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              AppCard(
                padding: const EdgeInsets.all(AppSpacing.xs),
                child: NorthIndianFixedHouseChart(
                  chartLabel: type.apiName,
                  houses: _chartHouses(chart),
                  onHouseTap: (house) => _showHouse(context, type, house),
                  onPlanetTap: (planet) =>
                      _showPlanet(context, type, chart, planet),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              _DivisionalAccessibilityFallback(
                type: type,
                houses: _chartHouses(chart),
              ),
              const SizedBox(height: AppSpacing.xl),
              SectionHeader(title: t.planetaryPositions),
              ...chart.planets.map(
                (planet) => AppCard(
                  padding: EdgeInsets.zero,
                  child: ListTile(
                    title: Text(planet.body),
                    subtitle: Text(
                      '${planet.sign.englishName} · '
                      '${planet.degreeWithinSign.toStringAsFixed(2)}° · '
                      '${t.house} ${planet.house}',
                    ),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => _showPlanet(
                      context,
                      type,
                      chart,
                      ChartPlanet(body: planet.body),
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      );
    },
  );
}

List<FixedChartHouse> _chartHouses(DivisionalChart chart) => chart.houses
    .map(
      (house) => FixedChartHouse(
        house: house.house,
        sign: ChartSign(
          rashiIndex: house.sign.rashiIndex,
          englishName: house.sign.englishName,
        ),
        planets: chart.planets
            .where((planet) => planet.house == house.house)
            .map(
              (planet) => ChartPlanet(
                body: planet.body,
                degreeWithinSign: planet.degreeWithinSign,
              ),
            )
            .toList(growable: false),
      ),
    )
    .toList(growable: false);

void _showHouse(
  BuildContext context,
  DivisionalChartType type,
  FixedChartHouse house,
) {
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
              '${type.apiName} · ${t.house} ${house.house}',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text('${t.sign}: ${house.sign.englishName}'),
            const SizedBox(height: AppSpacing.sm),
            Text(
              house.planets.isEmpty
                  ? t.noPlanets
                  : house.planets.map((item) => item.body).join(', '),
            ),
          ],
        ),
      ),
    ),
  );
}

void _showPlanet(
  BuildContext context,
  DivisionalChartType type,
  DivisionalChart chart,
  ChartPlanet selected,
) {
  final position = chart.planets.firstWhere(
    (item) => item.body == selected.body,
  );
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
              '${type.apiName} · ${position.body}',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text('${t.sign}: ${position.sign.englishName}'),
            Text(
              '${t.degreeInSign}: ${position.degreeWithinSign.toStringAsFixed(2)}°',
            ),
            Text('${t.house}: ${position.house}'),
          ],
        ),
      ),
    ),
  );
}

class _DivisionalAccessibilityFallback extends StatelessWidget {
  const _DivisionalAccessibilityFallback({
    required this.type,
    required this.houses,
  });
  final DivisionalChartType type;
  final List<FixedChartHouse> houses;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return ExpansionTile(
      title: Text('${type.apiName} · ${t.chartAccessibleHouseList}'),
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
                    : house.planets.map((item) => item.body).join(', '),
              ),
            ),
          )
          .toList(growable: false),
    );
  }
}

class _DivisionalLoading extends StatelessWidget {
  const _DivisionalLoading();
  @override
  Widget build(BuildContext context) => const AppCard(
    child: SizedBox(
      height: 220,
      child: Center(child: CircularProgressIndicator()),
    ),
  );
}

class _DivisionalError extends StatelessWidget {
  const _DivisionalError({required this.onRetry});
  final Future<void> Function() onRetry;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return AppCard(
      child: Column(
        children: [
          Text(t.divisionalChartUnavailable, textAlign: TextAlign.center),
          const SizedBox(height: AppSpacing.md),
          FilledButton(onPressed: onRetry, child: Text(t.retry)),
        ],
      ),
    );
  }
}
