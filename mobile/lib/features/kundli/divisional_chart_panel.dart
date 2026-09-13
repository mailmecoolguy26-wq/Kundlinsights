import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';
import '../../l10n/app_localizations.dart';
import '../readings/astrology_presentation_copy.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/section_header.dart';
import '../../shared/widgets/states.dart';
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
      final copy = AstrologyPresentationCopy.of(context);
      final chart = controller.chart(type);
      final state = controller.state(type);
      final t = AppLocalizations.of(context)!;
      final title = type == DivisionalChartType.d9
          ? t.navamsa
          : 'D10 Career Chart';
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
                  onHouseTap: (house) =>
                      _showHouse(context, type, chart, house),
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
                    title: Text(
                      copy.planet(planet.body),
                      style: _DivisionalStyle.planetName,
                    ),
                    subtitle: Text(
                      '${copy.sign(sanskritName: planet.sign.sanskritName, englishName: planet.sign.englishName)} · '
                      '${planet.degreeWithinSign.toStringAsFixed(2)}° · '
                      '${copy.house(planet.house)}',
                      style: _DivisionalStyle.planetSubtitle,
                    ),
                    trailing: const Icon(
                      Icons.chevron_right,
                      color: Color(0xFFC5A059),
                    ),
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
  DivisionalChart chart,
  FixedChartHouse selected,
) {
  final t = AppLocalizations.of(context)!;
  final copy = AstrologyPresentationCopy.of(context);
  final house = chart.houses.firstWhere((item) => item.house == selected.house);
  final planets = chart.planets.where((item) => item.house == house.house);
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    backgroundColor: const Color(0xFF120D29),
    builder: (context) => SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${type.apiName} · ${copy.house(house.house)}',
              style: _DivisionalStyle.title,
            ),
            const SizedBox(height: AppSpacing.sm),
            _DivisionalFact(
              label: t.sign,
              value: copy.sign(
                sanskritName: house.sign.sanskritName,
                englishName: house.sign.englishName,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            _DivisionalFact(
              label: t.planetaryPositions,
              value: planets.isEmpty
                  ? t.noPlanets
                  : planets.map((item) => copy.planet(item.body)).join(', '),
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
  final copy = AstrologyPresentationCopy.of(context);
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    backgroundColor: const Color(0xFF120D29),
    builder: (context) => SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${type.apiName} · ${copy.planet(position.body)}',
              style: _DivisionalStyle.title,
            ),
            const SizedBox(height: AppSpacing.sm),
            _DivisionalFact(
              label: t.sign,
              value: copy.sign(
                sanskritName: position.sign.sanskritName,
                englishName: position.sign.englishName,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            _DivisionalFact(
              label: t.degreeInSign,
              value: '${position.degreeWithinSign.toStringAsFixed(2)}°',
            ),
            const SizedBox(height: AppSpacing.sm),
            _DivisionalFact(label: t.house, value: copy.house(position.house)),
          ],
        ),
      ),
    ),
  );
}

class _DivisionalFact extends StatelessWidget {
  const _DivisionalFact({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Expanded(child: Text(label, style: _DivisionalStyle.label)),
      const SizedBox(width: 16),
      Flexible(
        child: Text(
          value,
          textAlign: TextAlign.end,
          style: _DivisionalStyle.value,
        ),
      ),
    ],
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
    final copy = AstrologyPresentationCopy.of(context);
    return ExpansionTile(
      title: Text('${type.apiName} · ${t.chartAccessibleHouseList}'),
      children: houses
          .map(
            (house) => ListTile(
              dense: true,
              title: Text(
                '${copy.house(house.house)} — ${house.sign.englishName}',
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
  Widget build(BuildContext context) => const SizedBox(
    height: 220,
    child: LoadingState(label: 'Loading chart facts'),
  );
}

class _DivisionalError extends StatelessWidget {
  const _DivisionalError({required this.onRetry});
  final Future<void> Function() onRetry;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return SizedBox(
      height: 260,
      child: ErrorState(
        title: 'Chart unavailable',
        message: t.divisionalChartUnavailable,
        onRetry: () => onRetry(),
      ),
    );
  }
}

abstract final class _DivisionalStyle {
  static const planetName = TextStyle(
    color: Color(0xFFFAF7F2),
    fontWeight: FontWeight.w600,
  );
  static const planetSubtitle = TextStyle(
    color: Color(0xFF9E9AA9),
    height: 1.35,
  );
  static const title = TextStyle(
    color: Color(0xFFFAF7F2),
    fontFamily: 'EBGaramond',
    fontSize: 25,
    fontWeight: FontWeight.w600,
  );
  static const label = TextStyle(color: Color(0xFF9E9AA9), fontSize: 13);
  static const value = TextStyle(
    color: Color(0xFFFAF7F2),
    fontSize: 13,
    fontWeight: FontWeight.w600,
  );
}
