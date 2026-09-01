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
    'renders sign-only labels, Lagna, retrograde markers, and tap actions',
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
      expect(find.text('Saᴿ 0°', findRichText: true), findsOneWidget);
      expect(find.text('1 · 1'), findsNothing);
      for (var sign = 1; sign <= 12; sign++) {
        expect(find.text('$sign'), findsOneWidget);
      }

      final firstHouse = find.byType(InkWell).first;
      final firstHouseBounds = tester.getRect(firstHouse);
      await tester.tapAt(
        Offset(firstHouseBounds.right - 2, firstHouseBounds.top + 2),
      );
      await tester.pump();
      expect(tappedHouse?.house, 1);
      await tester.tap(
        find
            .descendant(of: firstHouse, matching: find.byType(GestureDetector))
            .last,
      );
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
        await tester.tap(
          find
              .descendant(
                of: seventhHouse,
                matching: find.byType(GestureDetector),
              )
              .last,
        );
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

    expect(find.text('Meᴿ', findRichText: true), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
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
