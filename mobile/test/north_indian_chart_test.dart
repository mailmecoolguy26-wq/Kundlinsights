import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/kundli/north_indian_chart.dart';
import 'package:kundlinsights_mobile/features/natal/domain/natal_summary.dart';
import 'package:kundlinsights_mobile/l10n/app_localizations.dart';

void main() {
  test('maps every authoritative house to one unique fixed visual region', () {
    final regions = List.generate(
      12,
      (index) => NorthIndianChartLayout.regionForHouse(index + 1),
    );

    expect(NorthIndianChartLayout.regions, hasLength(12));
    expect(regions.toSet(), hasLength(12));
    expect(() => NorthIndianChartLayout.regionForHouse(13), throwsRangeError);
  });

  test('uses Stitch design-space presentation coordinates separately', () {
    expect(
      NorthIndianChartPresentation.normalizedDesignPoint(200, 135),
      const Offset(.5, .3375),
    );
    expect(
      NorthIndianChartPresentation.planetAnchorForHouse(1),
      const Offset(.5, .3375),
    );
    expect(
      NorthIndianChartPresentation.signAnchorForHouse(1),
      const Offset(.5, .095),
    );
    expect(
      [
        NorthIndianChartPresentation.baseSignAnchorForSlot(
          NorthIndianSignSlot.topLeftInner,
        ),
        NorthIndianChartPresentation.baseSignAnchorForSlot(
          NorthIndianSignSlot.topCenter,
        ),
        NorthIndianChartPresentation.baseSignAnchorForSlot(
          NorthIndianSignSlot.topRightInner,
        ),
        NorthIndianChartPresentation.baseSignAnchorForSlot(
          NorthIndianSignSlot.leftUpper,
        ),
        NorthIndianChartPresentation.baseSignAnchorForSlot(
          NorthIndianSignSlot.leftMiddle,
        ),
        NorthIndianChartPresentation.baseSignAnchorForSlot(
          NorthIndianSignSlot.leftLower,
        ),
        NorthIndianChartPresentation.baseSignAnchorForSlot(
          NorthIndianSignSlot.bottomLeftInner,
        ),
        NorthIndianChartPresentation.baseSignAnchorForSlot(
          NorthIndianSignSlot.bottomCenter,
        ),
        NorthIndianChartPresentation.baseSignAnchorForSlot(
          NorthIndianSignSlot.bottomRightInner,
        ),
        NorthIndianChartPresentation.baseSignAnchorForSlot(
          NorthIndianSignSlot.rightLower,
        ),
        NorthIndianChartPresentation.baseSignAnchorForSlot(
          NorthIndianSignSlot.rightMiddle,
        ),
        NorthIndianChartPresentation.baseSignAnchorForSlot(
          NorthIndianSignSlot.rightUpper,
        ),
      ],
      const [
        Offset(.425, .085),
        Offset(.500, .095),
        Offset(.575, .085),
        Offset(.080, .430),
        Offset(.105, .500),
        Offset(.080, .570),
        Offset(.425, .915),
        Offset(.500, .905),
        Offset(.575, .915),
        Offset(.920, .570),
        Offset(.895, .500),
        Offset(.920, .430),
      ],
    );
    const opticalAnchorsByHouse = [
      Offset(.500, .095),
      Offset(.425, .085),
      Offset(.065, .430),
      Offset(.120, .500),
      Offset(.060, .590),
      Offset(.400, .935),
      Offset(.500, .8925),
      Offset(.600, .935),
      Offset(.935, .570),
      Offset(.880, .500),
      Offset(.935, .430),
      Offset(.575, .085),
    ];
    for (var house = 1; house <= 12; house++) {
      final anchor = NorthIndianChartPresentation.signAnchorForHouse(house);
      final expected = opticalAnchorsByHouse[house - 1];
      expect(anchor.dx, closeTo(expected.dx, .000001));
      expect(anchor.dy, closeTo(expected.dy, .000001));
    }
    expect(
      NorthIndianChartLayout.regionForHouse(1),
      const Rect.fromLTWH(.25, 0, .50, .25),
    );
    for (var house = 1; house <= 12; house++) {
      final safeZone = NorthIndianChartPresentation.safeZoneForHouse(house);
      expect(safeZone.left, greaterThanOrEqualTo(0));
      expect(safeZone.top, greaterThanOrEqualTo(0));
      expect(safeZone.right, lessThanOrEqualTo(1));
      expect(safeZone.bottom, lessThanOrEqualTo(1));
    }
  });

  test('maps semantic houses to explicit Stitch sign-number slots', () {
    expect(
      List.generate(
        12,
        (index) => NorthIndianChartPresentation.signSlotForHouse(index + 1),
      ),
      const [
        NorthIndianSignSlot.topCenter,
        NorthIndianSignSlot.topLeftInner,
        NorthIndianSignSlot.leftUpper,
        NorthIndianSignSlot.leftMiddle,
        NorthIndianSignSlot.leftLower,
        NorthIndianSignSlot.bottomLeftInner,
        NorthIndianSignSlot.bottomCenter,
        NorthIndianSignSlot.bottomRightInner,
        NorthIndianSignSlot.rightLower,
        NorthIndianSignSlot.rightMiddle,
        NorthIndianSignSlot.rightUpper,
        NorthIndianSignSlot.topRightInner,
      ],
    );

    // The Stitch reference orientation is only a presentation check. Values
    // remain supplied dynamically by the real chart's semantic house slots.
    const valuesByHouse = [6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5];
    final valuesBySlot = <NorthIndianSignSlot, int>{
      for (var house = 1; house <= 12; house++)
        NorthIndianChartPresentation.signSlotForHouse(house):
            valuesByHouse[house - 1],
    };
    expect(
      [
        valuesBySlot[NorthIndianSignSlot.topLeftInner],
        valuesBySlot[NorthIndianSignSlot.topCenter],
        valuesBySlot[NorthIndianSignSlot.topRightInner],
      ],
      [7, 6, 5],
    );
    expect(
      [
        valuesBySlot[NorthIndianSignSlot.leftUpper],
        valuesBySlot[NorthIndianSignSlot.leftMiddle],
        valuesBySlot[NorthIndianSignSlot.leftLower],
      ],
      [8, 9, 10],
    );
    expect(
      [
        valuesBySlot[NorthIndianSignSlot.bottomLeftInner],
        valuesBySlot[NorthIndianSignSlot.bottomCenter],
        valuesBySlot[NorthIndianSignSlot.bottomRightInner],
      ],
      [11, 12, 1],
    );
    expect(
      [
        valuesBySlot[NorthIndianSignSlot.rightLower],
        valuesBySlot[NorthIndianSignSlot.rightMiddle],
        valuesBySlot[NorthIndianSignSlot.rightUpper],
      ],
      [2, 3, 4],
    );
  });

  test('keeps six optically adjusted sign slots outside diamond edges', () {
    const outerEdgeBySlot = <NorthIndianSignSlot, (Offset, Offset)>{
      NorthIndianSignSlot.leftUpper: (Offset(12, 200), Offset(200, 12)),
      NorthIndianSignSlot.leftLower: (Offset(200, 388), Offset(12, 200)),
      NorthIndianSignSlot.bottomLeftInner: (Offset(200, 388), Offset(12, 200)),
      NorthIndianSignSlot.bottomRightInner: (
        Offset(388, 200),
        Offset(200, 388),
      ),
      NorthIndianSignSlot.rightUpper: (Offset(200, 12), Offset(388, 200)),
      NorthIndianSignSlot.rightLower: (Offset(388, 200), Offset(200, 388)),
    };

    for (final entry in outerEdgeBySlot.entries) {
      final slot = entry.key;
      final edge = entry.value;
      final normalized = NorthIndianChartPresentation.signAnchorForSlot(slot);
      final point = Offset(
        normalized.dx * NorthIndianChartPresentation.designSize,
        normalized.dy * NorthIndianChartPresentation.designSize,
      );
      final clearance = _distanceToSegment(point, edge.$1, edge.$2);
      expect(clearance, greaterThanOrEqualTo(8), reason: slot.name);
      expect(
        _crossProduct(edge.$2 - edge.$1, point - edge.$1),
        lessThan(0),
        reason: '${slot.name} must remain outside the center diamond',
      );
    }
  });

  test('preserves API-authoritative house signs and planet house values', () {
    final chartHouses = buildD1ChartHouses(_summary());

    expect(chartHouses, hasLength(12));
    expect(
      chartHouses.map((house) => house.house),
      List.generate(12, (index) => index + 1),
    );
    expect(chartHouses[0].sign.englishName, 'Aries');
    expect(chartHouses[0].planets.map((planet) => planet.body), [
      'Sun',
      'Saturn',
    ]);
    expect(chartHouses[0].planets.last.retrograde, isTrue);
    expect(chartHouses[1].planets.single.body, 'Moon');
  });

  testWidgets(
    'renders direct planet labels, Lagna, retrograde marker, legend, and tap actions',
    (tester) async {
      D1ChartHouse? tappedHouse;
      NatalPosition? tappedPlanet;
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: SizedBox(
              width: 390,
              child: NorthIndianKundliChart(
                houses: buildD1ChartHouses(_summary()),
                onHouseTap: (house) => tappedHouse = house,
                onPlanetTap: (planet) => tappedPlanet = planet,
              ),
            ),
          ),
        ),
      );

      expect(find.text('Lagna'), findsOneWidget);
      expect(find.text('Sa 0° R', findRichText: true), findsOneWidget);
      expect(find.text('R  Retro', findRichText: true), findsOneWidget);
      expect(find.byKey(const Key('chart-planet-Saturn')), findsOneWidget);
      expect(
        find.descendant(
          of: find.byKey(const Key('chart-planet-Saturn')),
          matching: find.byType(Container),
        ),
        findsNothing,
      );
      expect(
        find.descendant(
          of: find.byKey(const Key('north-indian-chart-canvas')),
          matching: find.byType(FittedBox),
        ),
        findsNothing,
      );
      for (final planet in const ['Moon', 'Sun', 'Mercury', 'Rahu']) {
        final richText = tester.widget<RichText>(
          find.descendant(
            of: find.byKey(Key('chart-planet-$planet')),
            matching: find.byType(RichText),
          ),
        );
        final span = richText.text as TextSpan;
        expect(span.style?.fontSize, 10);
        expect(span.style?.fontWeight, FontWeight.w600);
        final degree = span.children!.whereType<TextSpan>().skip(1).first;
        expect(degree.style?.fontSize, 9);
      }
      expect(find.text('1 · 1'), findsNothing);
      for (var sign = 1; sign <= 12; sign++) {
        expect(find.text('$sign'), findsOneWidget);
      }
      final signStyle = tester
          .widget<Text>(find.byKey(const Key('chart-sign-1')))
          .style;
      expect(signStyle?.color, const Color(0x59C5A059));
      expect(signStyle?.fontSize, 9.25);
      expect(signStyle?.fontWeight, FontWeight.w500);
      final chartBounds = tester.getRect(
        find.byKey(const Key('north-indian-chart-canvas')),
      );
      for (final planet in const [
        'Sun',
        'Moon',
        'Mars',
        'Mercury',
        'Jupiter',
        'Venus',
        'Saturn',
        'Rahu',
        'Ketu',
      ]) {
        final labelBounds = tester.getRect(
          find.byKey(Key('chart-planet-$planet')),
        );
        expect(chartBounds.contains(labelBounds.topLeft), isTrue);
        expect(chartBounds.contains(labelBounds.bottomRight), isTrue);
        final safeBounds = _scaledSafeZone(
          chartBounds,
          _houseForPlanet(planet),
        );
        expect(
          safeBounds.inflate(.5).contains(labelBounds.topLeft),
          isTrue,
          reason: planet,
        );
        expect(
          safeBounds.inflate(.5).contains(labelBounds.bottomRight),
          isTrue,
          reason: planet,
        );
      }
      for (var house = 1; house <= 12; house++) {
        final signBounds = tester.getRect(find.byKey(Key('chart-sign-$house')));
        final slot = NorthIndianChartPresentation.signAnchorForHouse(house);
        final signCenter = tester.getCenter(
          find.byKey(Key('chart-sign-$house')),
        );
        final signText = tester.widget<Text>(
          find.byKey(Key('chart-sign-$house')),
        );
        final signPainter = TextPainter(
          text: TextSpan(text: signText.data, style: signText.style),
          textDirection: TextDirection.ltr,
        )..layout();
        final signBaseline = signPainter.computeDistanceToActualBaseline(
          TextBaseline.alphabetic,
        );
        expect(
          signCenter.dx,
          closeTo(chartBounds.left + slot.dx * chartBounds.width, .5),
        );
        expect(
          signBounds.top + signBaseline,
          closeTo(chartBounds.top + slot.dy * chartBounds.height, .5),
        );
        expect(chartBounds.contains(signBounds.topLeft), isTrue);
        expect(chartBounds.contains(signBounds.bottomRight), isTrue);
        for (final planet in const [
          'Sun',
          'Moon',
          'Mars',
          'Mercury',
          'Jupiter',
          'Venus',
          'Saturn',
          'Rahu',
          'Ketu',
        ]) {
          final planetBounds = tester.getRect(
            find.byKey(Key('chart-planet-$planet')),
          );
          expect(
            signBounds.overlaps(planetBounds),
            isFalse,
            reason: '$house/$planet',
          );
        }
      }

      final firstHouse = find.byType(InkWell).first;
      final firstHouseBounds = tester.getRect(firstHouse);
      await tester.tapAt(
        Offset(firstHouseBounds.right - 2, firstHouseBounds.top + 2),
      );
      await tester.pump();
      expect(tappedHouse?.house, 1);
      await tester.tap(find.byKey(const Key('chart-planet-Saturn')));
      await tester.pump();
      expect(tappedPlanet?.body, 'Saturn');
    },
  );

  testWidgets(
    'reuses fixed-house geometry and accessibility semantics for D9 and D10',
    (tester) async {
      FixedChartHouse? tappedHouse;
      ChartPlanet? tappedPlanet;
      final houses = List.generate(
        12,
        (index) => FixedChartHouse(
          house: index + 1,
          sign: ChartSign(
            rashiIndex: index + 1,
            englishName: 'D Sign ${index + 1}',
          ),
          planets: index == 6 ? const [ChartPlanet(body: 'Sun')] : const [],
        ),
      );
      for (final label in const ['D9', 'D10']) {
        await tester.pumpWidget(
          MaterialApp(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: Scaffold(
              body: SizedBox(
                width: 390,
                child: NorthIndianFixedHouseChart(
                  chartLabel: label,
                  houses: houses,
                  onHouseTap: (house) => tappedHouse = house,
                  onPlanetTap: (planet) => tappedPlanet = planet,
                ),
              ),
            ),
          ),
        );
        expect(
          find.bySemanticsLabel(RegExp('North Indian $label chart')),
          findsOneWidget,
        );
        expect(find.text('7'), findsOneWidget);
        expect(find.text('7 · 7'), findsNothing);
        final seventhHouse = find.byType(InkWell).at(6);
        final seventhHouseBounds = tester.getRect(seventhHouse);
        await tester.tapAt(
          Offset(seventhHouseBounds.right - 2, seventhHouseBounds.top + 2),
        );
        await tester.pump();
        expect(tappedHouse?.house, 7);
        await tester.tap(find.byKey(const Key('chart-planet-Sun')));
        await tester.pump();
        expect(tappedPlanet?.body, 'Sun');
      }
    },
  );

  testWidgets('keeps a five-planet house within a small iPhone chart', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: SizedBox(
            width: 320,
            child: NorthIndianFixedHouseChart(
              chartLabel: 'D1',
              houses: List.generate(
                12,
                (index) => FixedChartHouse(
                  house: index + 1,
                  sign: ChartSign(
                    rashiIndex: index + 1,
                    englishName: 'Sign ${index + 1}',
                  ),
                  planets: index == 0
                      ? const [
                          ChartPlanet(body: 'Sun'),
                          ChartPlanet(body: 'Moon'),
                          ChartPlanet(body: 'Mars'),
                          ChartPlanet(body: 'Mercury', retrograde: true),
                          ChartPlanet(body: 'Jupiter'),
                        ]
                      : const [],
                ),
              ),
              onHouseTap: (_) {},
              onPlanetTap: (_) {},
            ),
          ),
        ),
      ),
    );

    expect(find.text('Me R', findRichText: true), findsOneWidget);
    expect(find.text('R  Retro', findRichText: true), findsOneWidget);
    final labels = const ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter']
        .map((body) => tester.getRect(find.byKey(Key('chart-planet-$body'))))
        .toList(growable: false);
    for (var index = 0; index < labels.length; index++) {
      for (var other = index + 1; other < labels.length; other++) {
        expect(labels[index].overlaps(labels[other]), isFalse);
      }
    }
    expect(tester.takeException(), isNull);
  });

  testWidgets('keeps a Rahu group separate from adjacent Sun and Mercury', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: SizedBox(
            width: 390,
            child: NorthIndianFixedHouseChart(
              chartLabel: 'D1',
              houses: List.generate(
                12,
                (index) => FixedChartHouse(
                  house: index + 1,
                  sign: ChartSign(
                    rashiIndex: index + 1,
                    englishName: 'Sign ${index + 1}',
                  ),
                  planets: switch (index + 1) {
                    4 => const [
                      ChartPlanet(body: 'Sun', degreeWithinSign: 18),
                      ChartPlanet(
                        body: 'Mercury',
                        degreeWithinSign: 16,
                        retrograde: true,
                      ),
                    ],
                    11 => const [
                      ChartPlanet(
                        body: 'Rahu',
                        degreeWithinSign: 5,
                        retrograde: true,
                      ),
                    ],
                    _ => const [],
                  },
                ),
              ),
              onHouseTap: (_) {},
              onPlanetTap: (_) {},
            ),
          ),
        ),
      ),
    );

    final sun = tester.getRect(find.byKey(const Key('chart-planet-Sun')));
    final mercury = tester.getRect(
      find.byKey(const Key('chart-planet-Mercury')),
    );
    final rahu = tester.getRect(find.byKey(const Key('chart-planet-Rahu')));
    final chart = tester.getRect(
      find.byKey(const Key('north-indian-chart-canvas')),
    );
    expect(sun.bottom, lessThanOrEqualTo(mercury.top));
    final sunMercuryBounds = sun.expandToInclude(mercury);
    expect(rahu.overlaps(sunMercuryBounds), isFalse);
    expect(
      _rectGap(rahu, sunMercuryBounds) /
          chart.width *
          NorthIndianChartPresentation.designSize,
      greaterThanOrEqualTo(8),
    );
  });

  testWidgets('keeps Jupiter and Venus at their accepted group anchors', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: SizedBox(
            width: 390,
            child: NorthIndianFixedHouseChart(
              chartLabel: 'D1',
              houses: List.generate(
                12,
                (index) => FixedChartHouse(
                  house: index + 1,
                  sign: ChartSign(
                    rashiIndex: index + 1,
                    englishName: 'Sign ${index + 1}',
                  ),
                  planets: switch (index + 1) {
                    5 => const [ChartPlanet(body: 'Jupiter')],
                    6 => const [ChartPlanet(body: 'Venus')],
                    _ => const [],
                  },
                ),
              ),
              onHouseTap: (_) {},
              onPlanetTap: (_) {},
            ),
          ),
        ),
      ),
    );

    final chart = tester.getRect(
      find.byKey(const Key('north-indian-chart-canvas')),
    );
    for (final planet in const [('Jupiter', 5), ('Venus', 6)]) {
      final bounds = tester.getRect(
        find.byKey(Key('chart-planet-${planet.$1}')),
      );
      final expected = _scaledSafeZone(chart, planet.$2).center;
      expect(bounds.center.dx, closeTo(expected.dx, .5));
      expect(bounds.center.dy, closeTo(expected.dy, .5));
    }
  });
}

Rect _scaledSafeZone(Rect canvas, int house) {
  final zone = NorthIndianChartPresentation.safeZoneForHouse(house);
  return Rect.fromLTWH(
    canvas.left + zone.left * canvas.width,
    canvas.top + zone.top * canvas.height,
    zone.width * canvas.width,
    zone.height * canvas.height,
  );
}

int _houseForPlanet(String body) => const {
  'Sun': 1,
  'Saturn': 1,
  'Moon': 2,
  'Mars': 3,
  'Mercury': 4,
  'Jupiter': 5,
  'Venus': 6,
  'Rahu': 7,
  'Ketu': 8,
}[body]!;

double _distanceToSegment(Offset point, Offset start, Offset end) {
  final segment = end - start;
  final lengthSquared = segment.dx * segment.dx + segment.dy * segment.dy;
  final projection =
      ((point - start).dx * segment.dx + (point - start).dy * segment.dy) /
      lengthSquared;
  final clampedProjection = projection.clamp(0.0, 1.0);
  final closest = start + segment * clampedProjection;
  return (point - closest).distance;
}

double _crossProduct(Offset first, Offset second) =>
    first.dx * second.dy - first.dy * second.dx;

double _rectGap(Rect first, Rect second) {
  final horizontal = first.left > second.right
      ? first.left - second.right
      : second.left > first.right
      ? second.left - first.right
      : 0.0;
  final vertical = first.top > second.bottom
      ? first.top - second.bottom
      : second.top > first.bottom
      ? second.top - first.bottom
      : 0.0;
  return Offset(horizontal, vertical).distance;
}

NatalSummary _summary() {
  const nakshatra = NatalNakshatra(nakshatraIndex: 1, name: 'Ashwini');
  final houses = List<NatalHouse>.generate(
    12,
    (index) => NatalHouse(
      house: index + 1,
      sign: NatalSign(
        rashiIndex: index + 1,
        sanskritName: 'Sign ${index + 1}',
        englishName: index == 0 ? 'Aries' : 'Sign ${index + 1}',
      ),
    ),
  );
  NatalPosition position(String body, int house, {bool retrograde = false}) =>
      NatalPosition(
        body: body,
        longitude: 0,
        sign: houses[house - 1].sign,
        degreeWithinSign: 0,
        house: house,
        nakshatra: nakshatra,
        pada: 1,
        speed: retrograde ? -0.1 : 1,
        motion: retrograde ? 'retrograde' : 'direct',
        retrograde: retrograde,
      );
  final planets = <NatalPosition>[
    position('Sun', 1),
    position('Moon', 2),
    position('Mars', 3),
    position('Mercury', 4),
    position('Jupiter', 5),
    position('Venus', 6),
    position('Saturn', 1, retrograde: true),
    position('Rahu', 7),
    position('Ketu', 8),
  ];
  return NatalSummary(
    birthProfileId: 'profile-a',
    summary: NatalIdentitySummary(
      ascendant: position('Ascendant', 1),
      moonSign: houses[1].sign,
      moonNakshatra: nakshatra,
      moonPada: 1,
      sunSign: houses.first.sign,
    ),
    houses: houses,
    planets: planets,
  );
}
