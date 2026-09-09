import 'package:flutter/material.dart';

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

/// Fixed visual positions in the Stitch North Indian sign-number ring.
/// These are presentation slots, not semantic house numbers.
enum NorthIndianSignSlot {
  topLeftInner,
  topCenter,
  topRightInner,
  leftUpper,
  leftMiddle,
  leftLower,
  bottomLeftInner,
  bottomCenter,
  bottomRightInner,
  rightLower,
  rightMiddle,
  rightUpper,
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

/// Stitch-derived presentation coordinates for the 400 × 400 chart design.
/// This layer is intentionally independent from [NorthIndianChartLayout]: the
/// latter preserves semantic house mapping, while this class controls only the
/// visual placement of its already-authoritative contents.
abstract final class NorthIndianChartPresentation {
  static const designSize = 400.0;

  static Offset normalizedDesignPoint(double x, double y) =>
      Offset(x / designSize, y / designSize);

  static const _planetAnchors = <Offset>[
    Offset(.500, .3375), // 1: Stitch Ascendant anchor
    Offset(.2925, .125),
    Offset(.150, .280),
    Offset(.275, .510),
    Offset(.175, .730),
    Offset(.500, .670),
    Offset(.825, .730),
    Offset(.705, .485),
    Offset(.850, .280),
    Offset(.7125, .1225),
    Offset(.355, .520),
    Offset(.645, .520),
  ];

  /// Insets chosen against the Stitch outer frame, diagonals, and diamond.
  /// They are the only areas in which a house's labels may be laid out.
  static const _safeZones = <Rect>[
    Rect.fromLTWH(.410, .2425, .180, .180), // 1: Ascendant / upper diamond
    Rect.fromLTWH(.220, .090, .145, .070),
    Rect.fromLTWH(.075, .260, .150, .040),
    Rect.fromLTWH(.190, .450, .170, .115),
    Rect.fromLTWH(.105, .720, .140, .030),
    Rect.fromLTWH(.405, .615, .190, .120),
    Rect.fromLTWH(.745, .710, .160, .050),
    Rect.fromLTWH(.640, .425, .170, .120),
    Rect.fromLTWH(.800, .260, .100, .040),
    Rect.fromLTWH(.650, .100, .125, .045),
    Rect.fromLTWH(.315, .490, .080, .060),
    Rect.fromLTWH(.605, .490, .080, .060),
  ];

  /// Unmodified positions from the 400 × 400 Stitch SVG.
  static const _baseSignAnchors = <NorthIndianSignSlot, Offset>{
    NorthIndianSignSlot.topLeftInner: Offset(.425, .085),
    NorthIndianSignSlot.topCenter: Offset(.500, .095),
    NorthIndianSignSlot.topRightInner: Offset(.575, .085),
    NorthIndianSignSlot.leftUpper: Offset(.080, .430),
    NorthIndianSignSlot.leftMiddle: Offset(.105, .500),
    NorthIndianSignSlot.leftLower: Offset(.080, .570),
    NorthIndianSignSlot.bottomLeftInner: Offset(.425, .915),
    NorthIndianSignSlot.bottomCenter: Offset(.500, .905),
    NorthIndianSignSlot.bottomRightInner: Offset(.575, .915),
    NorthIndianSignSlot.rightLower: Offset(.920, .570),
    NorthIndianSignSlot.rightMiddle: Offset(.895, .500),
    NorthIndianSignSlot.rightUpper: Offset(.920, .430),
  };

  static const _signSlotsByHouse = <NorthIndianSignSlot>[
    NorthIndianSignSlot.topCenter, // H1
    NorthIndianSignSlot.topLeftInner, // H2
    NorthIndianSignSlot.leftUpper, // H3
    NorthIndianSignSlot.leftMiddle, // H4
    NorthIndianSignSlot.leftLower, // H5
    NorthIndianSignSlot.bottomLeftInner, // H6
    NorthIndianSignSlot.bottomCenter, // H7
    NorthIndianSignSlot.bottomRightInner, // H8
    NorthIndianSignSlot.rightLower, // H9
    NorthIndianSignSlot.rightMiddle, // H10
    NorthIndianSignSlot.rightUpper, // H11
    NorthIndianSignSlot.topRightInner, // H12
  ];

  static Offset planetAnchorForHouse(int house) {
    if (house < 1 || house > _planetAnchors.length) {
      throw RangeError.range(house, 1, _planetAnchors.length, 'house');
    }
    return _planetAnchors[house - 1];
  }

  static NorthIndianSignSlot signSlotForHouse(int house) {
    if (house < 1 || house > _signSlotsByHouse.length) {
      throw RangeError.range(house, 1, _signSlotsByHouse.length, 'house');
    }
    return _signSlotsByHouse[house - 1];
  }

  static Offset baseSignAnchorForSlot(NorthIndianSignSlot slot) =>
      _baseSignAnchors[slot]!;

  /// Small design-space corrections for Flutter's text metrics. They are
  /// presentation-only and deliberately keyed by visual slot, never by the
  /// dynamic sign value shown in that slot.
  static Offset opticalOffsetForSignSlot(NorthIndianSignSlot slot) =>
      switch (slot) {
        NorthIndianSignSlot.topLeftInner ||
        NorthIndianSignSlot.topCenter ||
        NorthIndianSignSlot.topRightInner => Offset.zero,
        NorthIndianSignSlot.leftUpper => const Offset(-6, 0),
        NorthIndianSignSlot.leftMiddle => const Offset(6, 0),
        NorthIndianSignSlot.leftLower => const Offset(-8, 8),
        NorthIndianSignSlot.bottomLeftInner => const Offset(-10, 8),
        NorthIndianSignSlot.bottomCenter => const Offset(0, -5),
        NorthIndianSignSlot.bottomRightInner => const Offset(10, 8),
        NorthIndianSignSlot.rightLower => const Offset(6, 0),
        NorthIndianSignSlot.rightMiddle => const Offset(-6, 0),
        NorthIndianSignSlot.rightUpper => const Offset(6, 0),
      };

  static Offset signAnchorForSlot(NorthIndianSignSlot slot) {
    final base = baseSignAnchorForSlot(slot);
    final opticalOffset = opticalOffsetForSignSlot(slot);
    return base + normalizedDesignPoint(opticalOffset.dx, opticalOffset.dy);
  }

  static Offset signAnchorForHouse(int house) =>
      signAnchorForSlot(signSlotForHouse(house));

  static Rect safeZoneForHouse(int house) {
    if (house < 1 || house > _safeZones.length) {
      throw RangeError.range(house, 1, _safeZones.length, 'house');
    }
    return _safeZones[house - 1];
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
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: _ChartColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _ChartColors.border),
        ),
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AspectRatio(
                aspectRatio: 1,
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final size = constraints.biggest.shortestSide;
                    final hasH11Planets = houses.any(
                      (house) => house.house == 11 && house.planets.isNotEmpty,
                    );
                    return Center(
                      child: SizedBox.square(
                        dimension: size,
                        child: Stack(
                          children: [
                            Positioned.fill(
                              child: CustomPaint(
                                key: const Key('north-indian-chart-canvas'),
                                painter: _NorthIndianChartPainter(),
                              ),
                            ),
                            for (final house in houses)
                              _HouseHitRegion(
                                house: house,
                                size: size,
                                onHouseTap: onHouseTap,
                              ),
                            for (final house in houses)
                              _HousePresentation(
                                house: house,
                                size: size,
                                planetGroupOffset:
                                    house.house == 4 && hasH11Planets
                                    ? const Offset(0, -.065)
                                    : Offset.zero,
                                onPlanetTap: onPlanetTap,
                              ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 10),
              const _ChartLegend(),
            ],
          ),
        ),
      ),
    );
  }
}

class _HouseHitRegion extends StatelessWidget {
  const _HouseHitRegion({
    required this.house,
    required this.size,
    required this.onHouseTap,
  });

  final FixedChartHouse house;
  final double size;
  final ValueChanged<FixedChartHouse> onHouseTap;

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
            child: const SizedBox.expand(),
          ),
        ),
      ),
    );
  }
}

class _HousePresentation extends StatelessWidget {
  const _HousePresentation({
    required this.house,
    required this.size,
    required this.planetGroupOffset,
    required this.onPlanetTap,
  });

  final FixedChartHouse house;
  final double size;
  final Offset planetGroupOffset;
  final ValueChanged<ChartPlanet> onPlanetTap;

  @override
  Widget build(BuildContext context) {
    final signSlot = NorthIndianChartPresentation.signSlotForHouse(house.house);
    final signAnchor = NorthIndianChartPresentation.signAnchorForSlot(signSlot);
    final safeZone = NorthIndianChartPresentation.safeZoneForHouse(house.house)
        .shift(planetGroupOffset);
    return Stack(
      children: [
        _SvgAnchoredSignLabel(
          text: house.sign.rashiIndex.toString(),
          anchor: signAnchor,
          size: size,
          labelKey: Key('chart-sign-${house.house}'),
        ),
        Positioned.fromRect(
          rect: Rect.fromLTWH(
            safeZone.left * size,
            safeZone.top * size,
            safeZone.width * size,
            safeZone.height * size,
          ),
          child: Center(
            child: OverflowBox(
              minWidth: 0,
              maxWidth: double.infinity,
              minHeight: 0,
              maxHeight: double.infinity,
              alignment: Alignment.center,
              child: _PlanetStack(house: house, onPlanetTap: onPlanetTap),
            ),
          ),
        ),
      ],
    );
  }
}

/// Reproduces SVG `text-anchor="middle"` with an alphabetic-baseline `y`.
/// Flutter's regular alignment centers a text box vertically, whereas SVG's
/// supplied `y` is the text baseline.
class _SvgAnchoredSignLabel extends StatelessWidget {
  const _SvgAnchoredSignLabel({
    required this.text,
    required this.anchor,
    required this.size,
    required this.labelKey,
  });

  final String text;
  final Offset anchor;
  final double size;
  final Key labelKey;

  @override
  Widget build(BuildContext context) {
    final textStyle = DefaultTextStyle.of(context).style.merge(_ChartText.sign);
    final textPainter = TextPainter(
      text: TextSpan(text: text, style: textStyle),
      textDirection: Directionality.of(context),
      textScaler: MediaQuery.textScalerOf(context),
    )..layout();
    final baseline = textPainter.computeDistanceToActualBaseline(
      TextBaseline.alphabetic,
    );

    return Positioned(
      left: anchor.dx * size - textPainter.width / 2,
      top: anchor.dy * size - baseline,
      child: IgnorePointer(
        child: Text(text, key: labelKey, style: textStyle),
      ),
    );
  }
}

class _PlanetStack extends StatelessWidget {
  const _PlanetStack({required this.house, required this.onPlanetTap});

  final FixedChartHouse house;
  final ValueChanged<ChartPlanet> onPlanetTap;

  @override
  Widget build(BuildContext context) {
    final rows = _planetRows(house.planets);
    return Column(
      key: Key('chart-planet-group-${house.house}'),
      mainAxisSize: MainAxisSize.min,
      children: [
        if (house.house == 1)
          Text(
            AppLocalizations.of(context)!.lagna,
            style: _ChartText.ascendant,
            textAlign: TextAlign.center,
          ),
        if (house.house == 1 && house.planets.isNotEmpty)
          const SizedBox(height: 3),
        for (var index = 0; index < rows.length; index++) ...[
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (
                var planetIndex = 0;
                planetIndex < rows[index].length;
                planetIndex++
              ) ...[
                if (planetIndex > 0) const SizedBox(width: 6),
                _PlanetLabel(
                  planet: rows[index][planetIndex],
                  onTap: onPlanetTap,
                ),
              ],
            ],
          ),
          if (index < rows.length - 1) const SizedBox(height: 5),
        ],
      ],
    );
  }
}

List<List<ChartPlanet>> _planetRows(List<ChartPlanet> planets) {
  if (planets.length <= 3) {
    return planets.map((planet) => [planet]).toList(growable: false);
  }
  return List.generate(
    (planets.length / 2).ceil(),
    (row) => planets.skip(row * 2).take(2).toList(growable: false),
    growable: false,
  );
}

class _PlanetLabel extends StatelessWidget {
  const _PlanetLabel({required this.planet, required this.onTap});

  final ChartPlanet planet;
  final ValueChanged<ChartPlanet> onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
    key: Key('chart-planet-${planet.body}'),
    behavior: HitTestBehavior.opaque,
    onTap: () => onTap(planet),
    child: RichText(
      text: TextSpan(
        style: _ChartText.planet,
        children: [
          TextSpan(text: _abbreviation(planet.body)),
          if (planet.degreeWithinSign != null)
            TextSpan(
              text: ' ${planet.degreeWithinSign!.toStringAsFixed(0)}°',
              style: _ChartText.degree,
            ),
          if (planet.retrograde)
            const TextSpan(text: ' R', style: _ChartText.retrograde),
        ],
      ),
    ),
  );
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
    final scale = size.width / NorthIndianChartPresentation.designSize;
    Offset point(double x, double y) => Offset(x * scale, y * scale);
    final frame = RRect.fromRectAndRadius(
      Rect.fromPoints(point(12, 12), point(388, 388)),
      Radius.circular(6 * scale),
    );
    canvas.drawRRect(
      frame,
      Paint()
        ..shader = const RadialGradient(
          center: Alignment(0, -.05),
          radius: .78,
          colors: [Color(0xFF181232), Color(0xFF0D091A)],
        ).createShader(Offset.zero & size)
        ..style = PaintingStyle.fill,
    );
    final border = Paint()
      ..color = _ChartColors.gold.withValues(alpha: .70)
      ..strokeWidth = 1.4 * scale
      ..style = PaintingStyle.stroke;
    final internal = Paint()
      ..color = _ChartColors.gold.withValues(alpha: .40)
      ..strokeWidth = 1.1 * scale
      ..style = PaintingStyle.stroke;
    canvas.drawRRect(frame, border);
    canvas.drawLine(point(12, 12), point(388, 388), internal);
    canvas.drawLine(point(388, 12), point(12, 388), internal);
    canvas.drawPath(
      Path()
        ..moveTo(200 * scale, 12 * scale)
        ..lineTo(388 * scale, 200 * scale)
        ..lineTo(200 * scale, 388 * scale)
        ..lineTo(12 * scale, 200 * scale)
        ..close(),
      internal,
    );
  }

  @override
  bool shouldRepaint(covariant _NorthIndianChartPainter oldDelegate) => false;
}

class _ChartLegend extends StatelessWidget {
  const _ChartLegend();

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: _ChartColors.surface,
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: _ChartColors.border),
    ),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      child: Wrap(
        spacing: 12,
        runSpacing: 4,
        children: const [
          _LegendItem(marker: 'R', label: 'Retro', color: _ChartColors.gold),
        ],
      ),
    ),
  );
}

class _LegendItem extends StatelessWidget {
  const _LegendItem({
    required this.marker,
    required this.label,
    required this.color,
  });

  final String marker;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => RichText(
    text: TextSpan(
      children: [
        TextSpan(
          text: marker,
          style: _ChartText.legendMarker.copyWith(color: color),
        ),
        TextSpan(text: '  $label', style: _ChartText.legend),
      ],
    ),
  );
}

abstract final class _ChartColors {
  static const surface = Color(0xFF120D29);
  static const alabaster = Color(0xFFFAF7F2);
  static const gold = Color(0xFFC5A059);
  static const degreeGold = Color(0xFFD6B878);
  static const slate = Color(0xFF9E9AA9);
  static const border = Color(0x665E4A87);
}

abstract final class _ChartText {
  static const sign = TextStyle(
    color: Color(0x59C5A059),
    fontSize: 9.25,
    fontWeight: FontWeight.w500,
  );
  static const ascendant = TextStyle(
    color: _ChartColors.alabaster,
    fontSize: 10,
    fontWeight: FontWeight.w700,
  );
  static const planet = TextStyle(
    color: _ChartColors.alabaster,
    fontSize: 10,
    height: 1.15,
    fontWeight: FontWeight.w600,
  );
  static const degree = TextStyle(
    color: _ChartColors.degreeGold,
    fontSize: 9,
    fontWeight: FontWeight.w500,
  );
  static const retrograde = TextStyle(
    color: _ChartColors.gold,
    fontSize: 8.5,
    fontWeight: FontWeight.w700,
  );
  static const legendMarker = TextStyle(
    fontSize: 10,
    fontWeight: FontWeight.w800,
  );
  static const legend = TextStyle(
    color: _ChartColors.slate,
    fontSize: 10,
    fontWeight: FontWeight.w500,
  );
}
