import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/readings/career_activity_window_dev_preview.dart';

void main() {
  Widget app(CareerActivityWindowViewModel value) => MaterialApp(
    home: Scaffold(
      body: SingleChildScrollView(
        child: CareerActivityWindowCard(model: value),
      ),
    ),
  );
  testWidgets('renders activity window and hides recurrence when unavailable', (
    tester,
  ) async {
    await tester.pumpWidget(
      app(
        const CareerActivityWindowViewModel.activity(
          dateRange: 'Feb 2024 – Apr 2024',
        ),
      ),
    );
    expect(find.text('FAVOURABLE CAREER PERIOD'), findsOneWidget);
    expect(find.text('ASTROLOGICALLY SUPPORTIVE PERIOD'), findsOneWidget);
    expect(
      find.text(
        'TaraVerse ke current timing model ke according, is period mein Career '
        'se jude important Dasha aur Gochar factors active hain.',
      ),
      findsOneWidget,
    );
    expect(
      find.text(
        'Yeh kisi specific event ki guarantee nahi hai. Is period ko interviews, '
        'networking, Career conversations aur opportunities explore karne ke '
        'liye supportive timing ke roop mein dekhein.',
      ),
      findsOneWidget,
    );
    expect(
      find.text('Shani Dev aapki Career-linked Dasha mein active hain'),
      findsOneWidget,
    );
    expect(find.byIcon(Icons.check_circle_outline_rounded), findsNWidgets(3));
    expect(find.text('PAST PATTERN'), findsNothing);
    expect(find.textContaining('probability'), findsNothing);
    expect(find.textContaining('Candidate'), findsNothing);

    final card = tester.widget<Container>(
      find.byKey(const ValueKey('career-activity-window-card')),
    );
    final decoration = card.decoration! as BoxDecoration;
    expect(decoration.color, isNull);
    expect(
      tester
          .widget<Material>(
            find.descendant(
              of: find.byKey(const ValueKey('career-activity-window-card')),
              matching: find.byType(Material),
            ),
          )
          .color,
      const Color(0xFF17112F),
    );
  });
  testWidgets('renders recurrence and no-window states', (tester) async {
    await tester.pumpWidget(
      app(
        const CareerActivityWindowViewModel.activity(
          dateRange: 'Feb 2024 – Apr 2024',
          hasRecurrence: true,
        ),
      ),
    );
    expect(find.text('PAST PATTERN'), findsOneWidget);
    expect(
      find.text(
        'Is period ka kuch astrological pattern aapke ek pehle confirmed '
        'Career transition se similar hai.',
      ),
      findsOneWidget,
    );
    await tester.pumpWidget(
      app(const CareerActivityWindowViewModel.noWindow()),
    );
    expect(find.text('FAVOURABLE CAREER PERIODS'), findsOneWidget);
    expect(
      find.text(
        'Current timing model abhi kisi concentrated supportive Career period '
        'ko identify nahi kar raha.',
      ),
      findsOneWidget,
    );
    final noWindow = tester.widget<Container>(
      find.byKey(const ValueKey('career-activity-no-window-card')),
    );
    expect(noWindow.decoration, isNotNull);
  });

  testWidgets(
    'keeps technical details collapsed by default and long windows readable',
    (tester) async {
      await tester.pumpWidget(
        app(
          const CareerActivityWindowViewModel.activity(
            dateRange: 'May 2022 – Nov 2022',
            longWindow: true,
          ),
        ),
      );
      expect(find.text('May 2022 – Nov 2022'), findsOneWidget);
      expect(
        find.text('Dasha: MD / AD / PD', findRichText: true),
        findsNothing,
      );
      final technicalDisclosure = find.text('See the astrology behind this');
      await tester.ensureVisible(technicalDisclosure);
      await tester.tap(technicalDisclosure);
      await tester.pump();
      expect(
        find.text('Dasha: MD / AD / PD', findRichText: true),
        findsOneWidget,
      );
    },
  );

  testWidgets('debug preview selector exposes all anonymized fixture states', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: CareerActivityWindowDevPreviewPanel(),
          ),
        ),
      ),
    );
    expect(find.text('FAVOURABLE CAREER PERIODS'), findsOneWidget);
    expect(find.text('DEV SAMPLE DATA'), findsOneWidget);
    expect(find.text('DEV SAMPLE CONTROLS'), findsOneWidget);
    expect(find.text('Supportive Activity Window'), findsOneWidget);
    expect(find.text('Activity Window + Past Pattern'), findsOneWidget);
    expect(find.text('No Concentrated Window'), findsOneWidget);
    expect(find.text('Expanded Technical Details'), findsOneWidget);
    expect(find.text('Long Window'), findsOneWidget);

    final recurrenceSelector = find.text('Activity Window + Past Pattern');
    await tester.ensureVisible(recurrenceSelector);
    await tester.tap(recurrenceSelector);
    await tester.pump();
    expect(find.text('PAST PATTERN'), findsOneWidget);

    final noWindowSelector = find.text('No Concentrated Window');
    await tester.ensureVisible(noWindowSelector);
    await tester.tap(noWindowSelector);
    await tester.pump();
    expect(find.text('FAVOURABLE CAREER PERIODS'), findsNWidgets(2));
  });

  testWidgets('supports a chronological list of favourable periods', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: CareerActivityWindowDevPreviewPanel(
              windows: [
                CareerActivityWindowViewModel.activity(
                  dateRange: 'Feb 2024 – Apr 2024',
                ),
                CareerActivityWindowViewModel.activity(
                  dateRange: 'Jul 2024 – Aug 2024',
                ),
              ],
            ),
          ),
        ),
      ),
    );

    expect(find.text('Feb 2024 – Apr 2024'), findsOneWidget);
    expect(find.text('Jul 2024 – Aug 2024'), findsOneWidget);
    expect(find.text('ASTROLOGICALLY SUPPORTIVE PERIOD'), findsNWidgets(2));
  });

  testWidgets('keeps possible and limited signals out of the favourable list', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: CareerActivityWindowDevPreviewPanel(
              windows: [
                CareerActivityWindowViewModel.activity(
                  dateRange: 'Nov 2026 – Jan 2027',
                ),
                CareerActivityWindowViewModel.activity(
                  dateRange: 'Feb 2027 – Mar 2027',
                  evidenceState: CareerTimingEvidenceState.limitedSupport,
                ),
                CareerActivityWindowViewModel.activity(
                  dateRange: 'Apr 2027 – May 2027',
                  evidenceState:
                      CareerTimingEvidenceState.possibleCareerActivitySignal,
                ),
              ],
            ),
          ),
        ),
      ),
    );

    expect(find.text('Nov 2026 – Jan 2027'), findsOneWidget);
    expect(find.text('Feb 2027 – Mar 2027'), findsNothing);
    expect(find.text('Apr 2027 – May 2027'), findsNothing);
    expect(find.text('LIMITED SUPPORT'), findsNothing);
    expect(find.text('POSSIBLE CAREER ACTIVITY SIGNAL'), findsNothing);
  });

  testWidgets('renders the approved convergence state without probability', (
    tester,
  ) async {
    await tester.pumpWidget(
      app(
        const CareerActivityWindowViewModel.activity(
          dateRange: 'Nov 2026 – Jan 2027',
          evidenceState:
              CareerTimingEvidenceState.multipleTimingFactorsConverge,
        ),
      ),
    );

    expect(find.text('MULTIPLE TIMING FACTORS CONVERGE'), findsOneWidget);
    expect(find.textContaining('%'), findsNothing);
    expect(find.textContaining('guaranteed'), findsNothing);
  });

  test('keeps possible signals separate from validated favourable periods', () {
    const signal = CareerActivityWindowViewModel.activity(
      dateRange: '20 Nov 2026 – 10 Jan 2027',
      evidenceState: CareerTimingEvidenceState.possibleCareerActivitySignal,
      evidence: CareerActivityWindowEvidence(
        dashaEvidence: ['PD:Ketu'],
        gocharEvidence: ['Jupiter:H10_SIGN', 'Saturn:H10_SIGN'],
        moonSupport: false,
        d10Support: ['PROFESSIONAL_EXECUTION'],
        savBavContext: 'H10 SAV 31',
        recurrenceAvailable: true,
        recurrencePresent: true,
        historicalSimilarity: '9 matched observations',
        controlSimilarity: '3 Candidate-B control windows',
      ),
    );
    const contract = CareerFuturePeriodDisplayContract(
      possibleCareerActivitySignals: [signal],
      favourableCareerPeriods: [],
    );

    expect(contract.productionProjectionEnabled, isFalse);
    expect(contract.possibleCareerActivitySignals, hasLength(1));
    expect(contract.favourableCareerPeriods, isEmpty);
    expect(contract.possibleCareerActivitySignals.single.evidence, isNotNull);
    expect(
      contract.possibleCareerActivitySignals.single.evidence!.dashaEvidence,
      ['PD:Ketu'],
    );
    expect(
      contract.possibleCareerActivitySignals.single.evidence!.gocharEvidence,
      ['Jupiter:H10_SIGN', 'Saturn:H10_SIGN'],
    );
    expect(contract.possibleCareerActivitySignals.single.evidence!.d10Support, [
      'PROFESSIONAL_EXECUTION',
    ]);
    expect(
      contract.possibleCareerActivitySignals.single.evidence!.recurrencePresent,
      isTrue,
    );
  });

  test('release gates keep fixtures and preview unavailable', () {
    expect(CareerActivityWindowDevPreviewPanel.isAvailableFor(false), isFalse);
    expect(
      CareerActivityWindowDevFixtures.forDebugMode(
        false,
        const CareerActivityWindowViewModel.activity(dateRange: 'Fictional'),
      ),
      isNull,
    );
  });
}
