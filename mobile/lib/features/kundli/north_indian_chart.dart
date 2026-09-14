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

/// Fixed, normalized visual regions for the conventional North Indian chart.
///
/// These polygons are the same twelve regions drawn by [_NorthIndianChartPainter]:
/// four inner-diamond regions and eight outer triangles. They deliberately map
/// only an already-authoritative house number to a visual cell; they never
/// derive houses, Rashis, or planet positions.
abstract final class NorthIndianChartLayout {
  static const _polygons = <List<Offset>>[
    [
      Offset(.5, .03),
      Offset(.735, .265),
      Offset(.5, .5),
      Offset(.265, .265),
    ], // H1: top-centre diamond
    [
      Offset(.03, .03),
      Offset(.5, .03),
      Offset(.265, .265),
    ], // H2: upper-left top
    [
      Offset(.03, .03),
      Offset(.265, .265),
      Offset(.03, .5),
    ], // H3: upper-left side
    [
      Offset(.03, .5),
      Offset(.265, .265),
      Offset(.5, .5),
      Offset(.265, .735),
    ], // H4: centre-left diamond
    [
      Offset(.03, .5),
      Offset(.265, .735),
      Offset(.03, .97),
    ], // H5: lower-left side
    [
      Offset(.03, .97),
      Offset(.265, .735),
      Offset(.5, .97),
    ], // H6: lower-left bottom
    [
      Offset(.5, .5),
      Offset(.265, .735),
      Offset(.5, .97),
      Offset(.735, .735),
    ], // H7: bottom-centre diamond
    [
      Offset(.5, .97),
      Offset(.735, .735),
      Offset(.97, .97),
    ], // H8: lower-right bottom
    [
      Offset(.735, .735),
      Offset(.97, .5),
      Offset(.97, .97),
    ], // H9: lower-right side
    [
      Offset(.5, .5),
      Offset(.735, .265),
      Offset(.97, .5),
      Offset(.735, .735),
    ], // H10: centre-right diamond
    [
      Offset(.735, .265),
      Offset(.97, .03),
      Offset(.97, .5),
    ], // H11: upper-right side
    [
      Offset(.5, .03),
      Offset(.97, .03),
      Offset(.735, .265),
    ], // H12: upper-right top
  ];

  static List<List<Offset>> get polygons =>
      List<List<Offset>>.unmodifiable(_polygons.map(List<Offset>.unmodifiable));

  static List<Rect> get regions =>
      List<Rect>.unmodifiable(_polygons.map(_boundsForPolygon));

  static List<Offset> polygonForHouse(int house) {
    if (house < 1 || house > _polygons.length) {
      throw RangeError.range(house, 1, _polygons.length, 'house');
    }
    return List<Offset>.unmodifiable(_polygons[house - 1]);
  }

  static Rect regionForHouse(int house) {
    return _boundsForPolygon(polygonForHouse(house));
  }

  static Rect _boundsForPolygon(List<Offset> polygon) => Rect.fromPoints(
    Offset(
      polygon
          .map((point) => point.dx)
          .reduce((left, right) => left < right ? left : right),
      polygon
          .map((point) => point.dy)
          .reduce((left, right) => left < right ? left : right),
    ),
    Offset(
      polygon
          .map((point) => point.dx)
          .reduce((left, right) => left > right ? left : right),
      polygon
          .map((point) => point.dy)
          .reduce((left, right) => left > right ? left : right),
    ),
  );
}

/// Stitch-derived presentation coordinates for the 400 × 400 chart design.
/// This uses [NorthIndianChartLayout]'s semantic fixed-house geometry for the
/// already-authoritative contents. Sign labels and planet groups therefore
/// cannot rotate independently from one another.
abstract final class NorthIndianChartPresentation {
  static const designSize = 400.0;

  static Offset normalizedDesignPoint(double x, double y) =>
      Offset(x / designSize, y / designSize);

  /// Insets chosen against the Stitch outer frame, diagonals, and diamond.
  /// They are the only areas in which a house's labels may be laid out.
  static const _safeZones = <Rect>[
    Rect.fromLTWH(.410, .2475, .180, .180), // 1: Ascendant / upper diamond
    Rect.fromLTWH(.220, .090, .145, .070),
    Rect.fromLTWH(.075, .260, .150, .040),
    Rect.fromLTWH(.190, .450, .170, .115),
    Rect.fromLTWH(.105, .720, .140, .030),
    Rect.fromLTWH(.220, .840, .145, .070),
    Rect.fromLTWH(.405, .615, .190, .120),
    Rect.fromLTWH(.635, .840, .145, .070),
    Rect.fromLTWH(.800, .720, .100, .040),
    Rect.fromLTWH(.640, .425, .170, .120),
    Rect.fromLTWH(.775, .260, .150, .040),
    Rect.fromLTWH(.635, .090, .145, .070),
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
    return safeZoneForHouse(house).center;
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
                                onHouseTap: onHouseTap,
                              ),
                            for (final house in houses)
                              _HousePresentation(
                                house: house,
                                size: size,
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
  const _HouseHitRegion({required this.house, required this.onHouseTap});

  final FixedChartHouse house;
  final ValueChanged<FixedChartHouse> onHouseTap;

  @override
  Widget build(BuildContext context) {
    final planets = house.planets.isEmpty
        ? AppLocalizations.of(context)!.noPlanets
        : house.planets
              .map(
                (planet) =>
                    '${planet.body}${planet.retrograde ? ' ${AppLocalizations.of(context)!.retrogradeAbbreviation}' : ''}',
              )
              .join(', ');
    return Positioned.fill(
      child: ClipPath(
        clipper: _NormalizedHouseClipper(
          NorthIndianChartLayout.polygonForHouse(house.house),
        ),
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
              key: Key('chart-house-${house.house}'),
              onTap: () => onHouseTap(house),
              child: const SizedBox.expand(),
            ),
          ),
        ),
      ),
    );
  }
}

class _NormalizedHouseClipper extends CustomClipper<Path> {
  const _NormalizedHouseClipper(this.points);

  final List<Offset> points;

  @override
  Path getClip(Size size) {
    final path = Path()
      ..moveTo(points.first.dx * size.width, points.first.dy * size.height);
    for (final point in points.skip(1)) {
      path.lineTo(point.dx * size.width, point.dy * size.height);
    }
    return path..close();
  }

  @override
  bool shouldReclip(covariant _NormalizedHouseClipper oldClipper) =>
      !identical(points, oldClipper.points);
}

class _HousePresentation extends StatelessWidget {
  const _HousePresentation({
    required this.house,
    required this.size,
    required this.onPlanetTap,
  });

  final FixedChartHouse house;
  final double size;
  final ValueChanged<ChartPlanet> onPlanetTap;

  @override
  Widget build(BuildContext context) {
    final signSlot = NorthIndianChartPresentation.signSlotForHouse(house.house);
    final signAnchor = NorthIndianChartPresentation.signAnchorForSlot(signSlot);
    final safeZone = NorthIndianChartPresentation.safeZoneForHouse(house.house);
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
