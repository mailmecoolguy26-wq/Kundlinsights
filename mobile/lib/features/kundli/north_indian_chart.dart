import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';
import '../../l10n/app_localizations.dart';
import '../natal/domain/natal_summary.dart';

/// Presentation-only placement of an already-authoritative D1 house.
///
/// The API supplies both [house] and [sign]. This model only groups the
/// API-supplied planet house values for display; it performs no Jyotish
/// calculation.
class D1ChartHouse {
  const D1ChartHouse({
    required this.house,
    required this.sign,
    required this.planets,
  });

  final int house;
  final NatalSign sign;
  final List<NatalPosition> planets;
}

/// Presentation-safe, backend-authoritative data accepted by every fixed-house
/// North Indian chart. It deliberately has no calculation helpers.
class ChartSign {
  const ChartSign({required this.rashiIndex, required this.englishName});

  final int rashiIndex;
  final String englishName;
}

class ChartPlanet {
  const ChartPlanet({
    required this.body,
    this.retrograde = false,
    this.degreeWithinSign,
  });

  final String body;
  final bool retrograde;
  final double? degreeWithinSign;
}

class FixedChartHouse {
  const FixedChartHouse({
    required this.house,
    required this.sign,
    required this.planets,
  });

  final int house;
  final ChartSign sign;
  final List<ChartPlanet> planets;
}

List<D1ChartHouse> buildD1ChartHouses(NatalSummary summary) {
  final houses =
      summary.houses
          .map(
            (house) => D1ChartHouse(
              house: house.house,
              sign: house.sign,
              planets: List<NatalPosition>.unmodifiable(
                summary.planets.where((planet) => planet.house == house.house),
              ),
            ),
          )
          .toList(growable: false)
        ..sort((left, right) => left.house.compareTo(right.house));
  return List<D1ChartHouse>.unmodifiable(houses);
}

/// Fixed, normalized visual regions for the North Indian D1 chart.
///
/// This is deliberately visual geometry only: house 1 is the conventional
/// top-centre Lagna region, and each remaining authoritative house number has
/// one stable region. It does not derive either houses or Rashis.
abstract final class NorthIndianChartLayout {
  static const _regions = <Rect>[
    Rect.fromLTWH(.25, 0, .50, .25), // 1: top centre / Lagna
    Rect.fromLTWH(0, 0, .25, .25),
    Rect.fromLTWH(0, .25, .25, .25),
    Rect.fromLTWH(0, .50, .25, .25),
    Rect.fromLTWH(0, .75, .25, .25),
    Rect.fromLTWH(.25, .75, .50, .25),
    Rect.fromLTWH(.75, .75, .25, .25),
    Rect.fromLTWH(.75, .50, .25, .25),
    Rect.fromLTWH(.75, .25, .25, .25),
    Rect.fromLTWH(.75, 0, .25, .25),
    Rect.fromLTWH(.25, .25, .25, .25),
    Rect.fromLTWH(.50, .25, .25, .25),
  ];

  static List<Rect> get regions => List<Rect>.unmodifiable(_regions);

  static Rect regionForHouse(int house) {
    if (house < 1 || house > _regions.length) {
      throw RangeError.range(house, 1, _regions.length, 'house');
    }
    return _regions[house - 1];
  }
}

class NorthIndianKundliChart extends StatelessWidget {
  const NorthIndianKundliChart({
    super.key,
    required this.houses,
    required this.onHouseTap,
    required this.onPlanetTap,
  });

  final List<D1ChartHouse> houses;
  final ValueChanged<D1ChartHouse> onHouseTap;
  final ValueChanged<NatalPosition> onPlanetTap;

  @override
  Widget build(BuildContext context) => NorthIndianFixedHouseChart(
    chartLabel: 'D1',
    houses: houses
        .map(
          (house) => FixedChartHouse(
            house: house.house,
            sign: ChartSign(
              rashiIndex: house.sign.rashiIndex,
              englishName: house.sign.englishName,
            ),
            planets: house.planets
                .map(
                  (planet) => ChartPlanet(
                    body: planet.body,
                    retrograde: planet.retrograde,
                    degreeWithinSign: planet.degreeWithinSign,
                  ),
                )
                .toList(growable: false),
          ),
        )
        .toList(growable: false),
    onHouseTap: (house) =>
        onHouseTap(houses.firstWhere((item) => item.house == house.house)),
    onPlanetTap: (planet) => onPlanetTap(
      houses
          .expand((house) => house.planets)
          .firstWhere((item) => item.body == planet.body),
    ),
  );
}

/// Shared fixed-house renderer for authoritative D1, D9, and D10 data.
/// The only mapping performed here is a supplied house number to visual region.
class NorthIndianFixedHouseChart extends StatelessWidget {
  const NorthIndianFixedHouseChart({
    super.key,
    required this.chartLabel,
    required this.houses,
    required this.onHouseTap,
    required this.onPlanetTap,
  });

  final String chartLabel;
  final List<FixedChartHouse> houses;
  final ValueChanged<FixedChartHouse> onHouseTap;
  final ValueChanged<ChartPlanet> onPlanetTap;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final summary = houses
        .map(
          (house) => t.northIndianHouseSummary(
            house.house.toString(),
            house.sign.englishName,
          ),
        )
        .join('; ');
    return Semantics(
      label: t.northIndianChartSummary(chartLabel, summary),
      child: AspectRatio(
        aspectRatio: 1,
        child: LayoutBuilder(
          builder: (context, constraints) {
            final size = constraints.biggest.shortestSide;
            return Center(
              child: SizedBox.square(
                dimension: size,
                child: Stack(
                  children: [
                    Positioned.fill(
                      child: CustomPaint(painter: _NorthIndianChartPainter()),
                    ),
                    for (final house in houses)
                      _HouseRegion(
                        house: house,
                        size: size,
                        onHouseTap: onHouseTap,
                        onPlanetTap: onPlanetTap,
                      ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _HouseRegion extends StatelessWidget {
  const _HouseRegion({
    required this.house,
    required this.size,
    required this.onHouseTap,
    required this.onPlanetTap,
  });

  final FixedChartHouse house;
  final double size;
  final ValueChanged<FixedChartHouse> onHouseTap;
  final ValueChanged<ChartPlanet> onPlanetTap;

  @override
  Widget build(BuildContext context) {
    final region = NorthIndianChartLayout.regionForHouse(house.house);
    final planets = house.planets.isEmpty
        ? AppLocalizations.of(context)!.noPlanets
        : house.planets
              .map(
                (planet) =>
                    '${planet.body}${planet.retrograde ? ' ${AppLocalizations.of(context)!.retrogradeAbbreviation}' : ''}',
              )
              .join(', ');
    return Positioned(
      left: region.left * size,
      top: region.top * size,
      width: region.width * size,
      height: region.height * size,
      child: Semantics(
        button: true,
        label: AppLocalizations.of(context)!.northIndianHouseSemantics(
          house.house.toString(),
          house.sign.englishName,
          planets,
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () => onHouseTap(house),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xxs),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    house.sign.rashiIndex.toString(),
                    style: AppTypography.caption.copyWith(
                      color: AppColors.secondaryText,
                      fontSize: 10,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (house.house == 1)
                    Text(
                      AppLocalizations.of(context)!.lagna,
                      style: AppTypography.caption.copyWith(
                        color: AppColors.saffron,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  const SizedBox(height: 1),
                  Wrap(
                    spacing: AppSpacing.xxs,
                    runSpacing: 2,
                    children: house.planets
                        .map(
                          (planet) => GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: () => onPlanetTap(planet),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: AppSpacing.xxs,
                                vertical: 0,
                              ),
                              decoration: BoxDecoration(
                                borderRadius: AppRadius.small,
                                color: AppColors.ivory.withValues(alpha: .72),
                              ),
                              child: RichText(
                                text: TextSpan(
                                  style: AppTypography.caption.copyWith(
                                    fontSize: 10,
                                    color: AppColors.midnight,
                                    fontWeight: FontWeight.w600,
                                  ),
                                  children: [
                                    TextSpan(
                                      text:
                                          '${_abbreviation(planet.body)}${planet.retrograde ? 'ᴿ' : ''}',
                                    ),
                                    if (planet.degreeWithinSign != null)
                                      TextSpan(
                                        text:
                                            ' ${planet.degreeWithinSign!.toStringAsFixed(0)}°',
                                        style: AppTypography.caption.copyWith(
                                          fontSize: 8,
                                          color: AppColors.secondaryText,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        )
                        .toList(growable: false),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

String _abbreviation(String body) =>
    const {
      'Sun': 'Su',
      'Moon': 'Mo',
      'Mars': 'Ma',
      'Mercury': 'Me',
      'Jupiter': 'Ju',
      'Venus': 'Ve',
      'Saturn': 'Sa',
      'Rahu': 'Ra',
      'Ketu': 'Ke',
    }[body] ??
    body;

class _NorthIndianChartPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.navy
      ..strokeWidth = 1
      ..style = PaintingStyle.stroke;
    final centre = Offset(size.width / 2, size.height / 2);

    canvas.drawRect(Offset.zero & size, paint);
    canvas.drawLine(Offset.zero, Offset(size.width, size.height), paint);
    canvas.drawLine(Offset(size.width, 0), Offset(0, size.height), paint);
    for (final edgeCentre in <Offset>[
      Offset(size.width / 2, 0),
      Offset(size.width, size.height / 2),
      Offset(size.width / 2, size.height),
      Offset(0, size.height / 2),
    ]) {
      canvas.drawLine(centre, edgeCentre, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _NorthIndianChartPainter oldDelegate) => false;
}
