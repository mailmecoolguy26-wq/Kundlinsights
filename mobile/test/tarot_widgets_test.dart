import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/tarot/data/tarot_card_assets.dart';
import 'package:kundlinsights_mobile/features/tarot/domain/tarot.dart';
import 'package:kundlinsights_mobile/features/tarot/domain/tarot_repository.dart';
import 'package:kundlinsights_mobile/features/tarot/presentation/tarot_screens.dart';
import 'package:kundlinsights_mobile/features/tarot/presentation/tarot_card_artwork.dart';
import 'package:kundlinsights_mobile/features/tarot/tarot_controller.dart';
import 'package:kundlinsights_mobile/features/readings/career_explanation_language.dart';

void main() {
  testWidgets('face-down card hides identity and is accessible', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: TarotFaceDownCard(enabled: true, onTap: () {})),
      ),
    );
    expect(find.text('The Fool'), findsNothing);
    expect(find.byType(TarotCardArt), findsNothing);
    expect(
      find.bySemanticsLabel('Select this face-down Tarot card'),
      findsOneWidget,
    );
  });

  testWidgets('revealed card shows only the selected identity and position', (
    tester,
  ) async {
    const card = TarotCard(
      position: 1,
      positionName: 'Situation',
      cardId: 'MAJOR_FOOL',
      cardName: 'The Fool',
      orientation: 'UPRIGHT',
    );
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: TarotRevealedCard(
            card: card,
            interpretation: 'Begin with an open mind.',
          ),
        ),
      ),
    );
    expect(find.text('Situation'), findsOneWidget);
    expect(find.text('The Fool'), findsOneWidget);
    expect(find.text('Begin with an open mind.'), findsOneWidget);
    expect(find.byType(TarotCardArt), findsOneWidget);
  });

  test('all 78 stable card ids map to unique bundled artwork paths', () {
    expect(TarotCardAssets.byId, hasLength(78));
    expect(TarotCardAssets.byId.values.toSet(), hasLength(78));
    expect(
      TarotCardArtwork.pathFor('MAJOR_FOOL'),
      'assets/tarot/cards/major_00.webp',
    );
    expect(
      TarotCardArtwork.pathFor('PENTACLES_KING'),
      'assets/tarot/cards/pentacles_14.webp',
    );
    expect(TarotCardArtwork.pathFor('UNKNOWN_CARD'), isNull);
  });

  testWidgets('missing artwork falls back and card detail is read-only', (
    tester,
  ) async {
    const card = TarotCard(
      position: 2,
      positionName: 'What To Understand',
      cardId: 'UNKNOWN_CARD',
      cardName: 'Known Persisted Card',
      orientation: 'UPRIGHT',
      coreTheme: 'A concise theme',
    );
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: TarotRevealedCard(
            card: card,
            interpretation: 'Existing persisted interpretation.',
          ),
        ),
      ),
    );
    expect(
      find.byKey(const ValueKey('tarot-art-fallback-UNKNOWN_CARD')),
      findsOneWidget,
    );
    await tester.tap(find.text('Known Persisted Card'));
    await tester.pumpAndSettle();
    expect(
      find.byKey(const ValueKey('tarot-card-detail-art-UNKNOWN_CARD')),
      findsOneWidget,
    );
    expect(find.text('Known Persisted Card'), findsNWidgets(2));
    expect(find.text('Existing persisted interpretation.'), findsNWidgets(2));
    expect(
      find.byKey(const ValueKey('tarot-art-fallback-UNKNOWN_CARD')),
      findsNWidgets(2),
    );
  });

  testWidgets('landing renders eligible and used-today states safely', (
    tester,
  ) async {
    final eligible = _Harness(
      const TarotEntitlement(
        freeReadingAvailableToday: true,
        paidCreditsRemaining: 0,
      ),
    );
    addTearDown(eligible.dispose);
    await tester.pumpWidget(
      MaterialApp(
        home: TarotLandingScreen(
          key: const ValueKey('eligible'),
          controller: eligible.controller,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('1 free reading available today'), findsOneWidget);
    expect(find.text('Ask Tarot'), findsOneWidget);

    final used = _Harness(
      const TarotEntitlement(
        freeReadingAvailableToday: false,
        paidCreditsRemaining: 0,
      ),
    );
    addTearDown(used.dispose);
    await tester.pumpWidget(
      MaterialApp(
        home: TarotLandingScreen(
          key: const ValueKey('used'),
          controller: used.controller,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text("Today's free reading has been used"), findsOneWidget);
    expect(
      tester
          .widget<FilledButton>(find.byKey(const ValueKey('tarot-start')))
          .onPressed,
      isNull,
    );
  });

  testWidgets('landing copy is consistently English or Hinglish', (
    tester,
  ) async {
    final english = _Harness(
      const TarotEntitlement(
        freeReadingAvailableToday: true,
        paidCreditsRemaining: 0,
      ),
    );
    addTearDown(english.dispose);
    await tester.pumpWidget(
      MaterialApp(home: TarotLandingScreen(controller: english.controller)),
    );
    await tester.pumpAndSettle();
    expect(find.text('What would you like guidance on?'), findsOneWidget);
    expect(find.text('Ask Tarot'), findsOneWidget);
    expect(find.text('Tarot Se Poochhein'), findsNothing);

    final hinglish = _Harness(
      const TarotEntitlement(
        freeReadingAvailableToday: true,
        paidCreditsRemaining: 0,
      ),
      hinglish: true,
    );
    addTearDown(hinglish.dispose);
    await tester.pumpWidget(
      MaterialApp(
        home: TarotLandingScreen(
          key: const ValueKey('hinglish'),
          controller: hinglish.controller,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      find.text('Aap kis baare mein guidance chahte hain?'),
      findsOneWidget,
    );
    expect(find.text('Tarot Se Poochhein'), findsOneWidget);
    expect(find.text('What would you like guidance on?'), findsNothing);
    expect(find.text('View Tarot History'), findsNothing);
  });

  testWidgets(
    'question stays recoverable and duplicate submit is disabled while loading',
    (tester) async {
      final harness = _Harness(
        const TarotEntitlement(
          freeReadingAvailableToday: true,
          paidCreditsRemaining: 0,
        ),
      );
      addTearDown(harness.dispose);
      harness.repository.pending = Completer<TarotStartResult>();
      await tester.pumpWidget(
        MaterialApp(home: TarotLandingScreen(controller: harness.controller)),
      );
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const ValueKey('tarot-question')),
        'What should I focus on?',
      );
      await tester.pump();
      await tester.ensureVisible(find.byKey(const ValueKey('tarot-start')));
      await tester.tap(find.byKey(const ValueKey('tarot-start')));
      await tester.pump();
      expect(
        find.descendant(
          of: find.byKey(const ValueKey('tarot-start')),
          matching: find.byType(CircularProgressIndicator),
        ),
        findsOneWidget,
      );
      expect(
        tester
            .widget<FilledButton>(find.byKey(const ValueKey('tarot-start')))
            .onPressed,
        isNull,
      );
      expect(harness.repository.starts, 1);
      harness.repository.pending!.complete(
        const TarotStartSafety(
          TarotSafetyBoundary(message: 'Please reframe safely.'),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('What should I focus on?'), findsOneWidget);
      expect(find.text('Please reframe safely.'), findsOneWidget);
    },
  );

  testWidgets('completed result renders three cards and structured sections', (
    tester,
  ) async {
    final harness = _Harness(
      const TarotEntitlement(
        freeReadingAvailableToday: true,
        paidCreditsRemaining: 0,
      ),
    );
    addTearDown(harness.dispose);
    harness.repository.reading = _completeReading();
    await harness.controller.start('What should I focus on?');
    await tester.pumpWidget(
      MaterialApp(
        home: TarotReadingScreen(
          controller: harness.controller,
          readingId: 'reading-a',
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Your Three Cards'), findsOneWidget);
    expect(find.text('Card 1'), findsOneWidget);
    expect(find.text('Card 2'), findsOneWidget);
    expect(find.text('Card 3'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('What This May Mean'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('What This May Mean'), findsOneWidget);
    expect(
      find.text('What To Reflect On', skipOffstage: false),
      findsOneWidget,
    );
    expect(find.text('Next Step', skipOffstage: false), findsOneWidget);
    expect(find.text('Keep in Mind'), findsNothing);
    expect(find.text('GENERAL GUIDANCE'), findsNothing);
  });

  testWidgets(
    'timing question shows expectation note without blocking reading',
    (tester) async {
      final harness = _Harness(
        const TarotEntitlement(
          freeReadingAvailableToday: true,
          paidCreditsRemaining: 0,
        ),
      );
      addTearDown(harness.dispose);
      harness.repository.reading = _completeReading(
        question: 'When will I get a job?',
      );
      await harness.controller.start('When will I get a job?');
      await tester.pumpWidget(
        MaterialApp(
          home: TarotReadingScreen(
            controller: harness.controller,
            readingId: 'reading-a',
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.text(
          'Tarot does not predict an exact date. This reading reflects your current situation, challenges and next direction.',
        ),
        findsOneWidget,
      );
      expect(find.text('Your Three Cards'), findsOneWidget);
    },
  );

  testWidgets('card choices fit responsively with three choices visible', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final harness = _Harness(
      const TarotEntitlement(
        freeReadingAvailableToday: true,
        paidCreditsRemaining: 0,
      ),
    );
    addTearDown(harness.dispose);
    harness.repository.reading = _drawingReading();
    await harness.controller.start('What should I focus on?');
    await tester.pumpWidget(
      MaterialApp(
        home: TarotReadingScreen(
          controller: harness.controller,
          readingId: 'reading-drawing',
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('tarot-card-choices')), findsOneWidget);
    expect(
      find.bySemanticsLabel('Select this face-down Tarot card'),
      findsAtLeastNWidgets(3),
    );
    expect(tester.takeException(), isNull);
  });
}

TarotReading _completeReading({String question = 'What should I focus on?'}) =>
    TarotReading(
      readingId: 'reading-a',
      question: question,
      category: 'GENERAL_GUIDANCE',
      spread: const TarotSpread(
        spreadType: 'GENERAL_GUIDANCE',
        positions: [
          TarotSpreadPosition(position: 1, name: 'Current Energy'),
          TarotSpreadPosition(position: 2, name: 'What To Understand'),
          TarotSpreadPosition(position: 3, name: 'Guidance'),
        ],
      ),
      status: 'COMPLETED',
      selectableTokens: const [],
      createdAt: DateTime.utc(2026, 11, 1),
      selectedCards: List.generate(
        3,
        (i) => TarotCard(
          position: i + 1,
          positionName: 'Position ${i + 1}',
          cardId: 'card-$i',
          cardName: 'Card ${i + 1}',
          orientation: 'UPRIGHT',
          coreTheme: 'Theme ${i + 1}',
        ),
      ),
      interpretation: const TarotInterpretation(
        overview: 'Overview',
        cards: [],
        combinedMessage: 'Meaning',
        practicalReflection: 'Reflect',
        nextStep: 'Act',
        caution: 'Caution',
        disclaimer: 'Reflection only.',
      ),
    );

TarotReading _drawingReading() => TarotReading(
  readingId: 'reading-drawing',
  question: 'What should I focus on?',
  category: 'GENERAL_GUIDANCE',
  spread: const TarotSpread(
    spreadType: 'GENERAL_GUIDANCE',
    positions: [
      TarotSpreadPosition(position: 1, name: 'Current Energy'),
      TarotSpreadPosition(position: 2, name: 'What To Understand'),
      TarotSpreadPosition(position: 3, name: 'Guidance'),
    ],
  ),
  status: 'DRAWING',
  selectedCards: const [],
  selectableTokens: List.generate(6, (index) => 'token-$index'),
  createdAt: DateTime.utc(2026, 11, 1),
);

class _Harness {
  _Harness(TarotEntitlement entitlement, {bool hinglish = false})
    : repository = _Repository(entitlement),
      authRepository = _AuthRepository(),
      language = CareerExplanationLanguageController(_LanguageStorage()) {
    auth = AuthController(authRepository);
    if (hinglish) {
      language.setLanguage(CareerExplanationLanguage.hinglish);
    }
    controller = TarotController(repository, auth, language: language);
  }
  final _Repository repository;
  final _AuthRepository authRepository;
  final CareerExplanationLanguageController language;
  late final AuthController auth;
  late final TarotController controller;
  void dispose() {
    controller.dispose();
    language.dispose();
    auth.dispose();
    authRepository.dispose();
  }
}

class _LanguageStorage implements CareerExplanationLanguageStorage {
  @override
  Future<String?> readLanguage() async => null;
  @override
  Future<void> writeLanguage(CareerExplanationLanguage language) async {}
}

class _Repository implements TarotRepository {
  _Repository(this.entitlement);
  final TarotEntitlement entitlement;
  int starts = 0;
  Completer<TarotStartResult>? pending;
  TarotReading reading = _completeReading();
  @override
  Future<TarotEntitlement> getEntitlement() async => entitlement;
  @override
  Future<TarotStartResult> startReading({
    required String question,
    required String idempotencyKey,
    required String language,
  }) async {
    starts++;
    return pending?.future ?? TarotStartReady(reading);
  }

  @override
  Future<TarotReading> getReading(String readingId) async => reading;
  @override
  Future<TarotHistoryPage> getHistory({int limit = 20, String? cursor}) async =>
      TarotHistoryPage(readings: [reading]);
  @override
  Future<TarotReading> retryInterpretation(String readingId) async => reading;
  @override
  Future<TarotReading> selectCard({
    required String readingId,
    required String selectionToken,
    required String idempotencyKey,
  }) async => reading;
}

class _AuthRepository implements AuthRepository {
  final stream = StreamController<AuthSnapshot>.broadcast();
  void dispose() => stream.close();
  @override
  Stream<AuthSnapshot> get states => stream.stream;
  @override
  Future<AuthSnapshot> restore() async =>
      const AuthSnapshot(AuthStatus.authenticated, subject: 'subject-a');
  @override
  Future<String?> accessToken() async => 'token';
  @override
  Future<String?> refreshAccessToken() async => 'token';
  @override
  Future<void> signIn({
    required String email,
    required String password,
  }) async {}
  @override
  Future<bool> signUp({
    required String email,
    required String password,
  }) async => true;
  @override
  Future<void> signOut() async {}
}
