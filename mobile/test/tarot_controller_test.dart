import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/tarot/domain/tarot.dart';
import 'package:kundlinsights_mobile/features/tarot/domain/tarot_repository.dart';
import 'package:kundlinsights_mobile/features/tarot/tarot_controller.dart';
import 'package:kundlinsights_mobile/features/readings/career_explanation_language.dart';

void main() {
  late _AuthRepository authRepository;
  late AuthController auth;
  late _TarotRepository repository;
  late TarotController controller;

  setUp(() {
    authRepository = _AuthRepository();
    auth = AuthController(authRepository);
    repository = _TarotRepository();
    controller = TarotController(repository, auth);
  });

  tearDown(() {
    controller.dispose();
    auth.dispose();
    authRepository.dispose();
  });

  test('creates, resumes and completes a three-card reading', () async {
    final result = await controller.start('What should I consider?');
    expect(result, isA<TarotStartReady>());
    expect(controller.reading!.selectedCards, isEmpty);

    await controller.select('token-1');
    await controller.select('token-2');
    await controller.select('token-3');

    expect(controller.reading!.status, 'COMPLETED');
    expect(controller.reading!.selectedCards, hasLength(3));
    expect(repository.selectionKeys, hasLength(3));

    await controller.loadReading('reading-1');
    expect(controller.reading!.readingId, 'reading-1');
    expect(controller.reading!.isComplete, isTrue);
  });

  test('keeps the same idempotency key when creation is retried', () async {
    repository.failCreateOnce = true;
    expect(await controller.start('Retry-safe question'), isNull);
    expect(
      await controller.start('Retry-safe question'),
      isA<TarotStartReady>(),
    );
    expect(repository.creationKeys[0], repository.creationKeys[1]);
  });

  test(
    'renders safety and purchase-required states without creating a reading',
    () async {
      repository.startResult = const TarotStartSafety(
        TarotSafetyBoundary(message: 'Please reframe this question safely.'),
      );
      await controller.start('Unsafe certainty request');
      expect(controller.safetyBoundary, isNotNull);
      expect(controller.reading, isNull);

      repository.startResult = const TarotStartPurchaseRequired(
        TarotEntitlement(
          freeReadingAvailableToday: false,
          paidCreditsRemaining: 0,
        ),
        [
          TarotPack(
            key: 'pack_3',
            quantity: 3,
            priceMinor: 19900,
            currency: 'INR',
          ),
        ],
      );
      await controller.start('Another question');
      expect(controller.purchasePacks.single.quantity, 3);
    },
  );

  test('logout clears account-scoped Tarot state', () async {
    await controller.start('Account scoped question');
    expect(controller.reading, isNotNull);
    authRepository.emit(const AuthSnapshot(AuthStatus.unauthenticated));
    await Future<void>.delayed(Duration.zero);
    expect(controller.reading, isNull);
    expect(controller.history, isEmpty);
  });

  test(
    'sends the selected English or Hinglish preference to the API',
    () async {
      final language = CareerExplanationLanguageController(_LanguageStorage());
      final localized = TarotController(repository, auth, language: language);
      addTearDown(localized.dispose);
      await language.setLanguage(CareerExplanationLanguage.hinglish);
      await localized.start('Mujhe kis baat par focus karna chahiye?');
      expect(repository.languages.last, 'HINGLISH');
      await language.setLanguage(CareerExplanationLanguage.english);
      await localized.start('What should I focus on?');
      expect(repository.languages.last, 'ENGLISH');
      language.dispose();
    },
  );
}

TarotReading _reading({int selected = 0, String status = 'DRAWING'}) =>
    TarotReading(
      readingId: 'reading-1',
      question: 'What should I consider?',
      category: 'GENERAL_GUIDANCE',
      spread: const TarotSpread(
        spreadType: 'GENERAL_GUIDANCE',
        positions: [
          TarotSpreadPosition(position: 1, name: 'Situation'),
          TarotSpreadPosition(position: 2, name: 'Challenge'),
          TarotSpreadPosition(position: 3, name: 'Guidance'),
        ],
      ),
      status: status,
      selectedCards: List.generate(
        selected,
        (i) => TarotCard(
          position: i + 1,
          positionName: 'Position ${i + 1}',
          cardId: 'card-$i',
          cardName: 'Card $i',
          orientation: 'UPRIGHT',
        ),
      ),
      selectableTokens: List.generate(
        3 - selected,
        (i) => 'token-${selected + i + 1}',
      ),
      createdAt: DateTime.utc(2026, 1, 1),
      interpretation: status == 'COMPLETED'
          ? const TarotInterpretation(
              overview: 'Overview',
              cards: [],
              combinedMessage: 'Combined',
              practicalReflection: 'Reflect',
              caution: 'No certainty.',
            )
          : null,
    );

class _TarotRepository implements TarotRepository {
  bool failCreateOnce = false;
  TarotStartResult? startResult;
  final creationKeys = <String>[];
  final selectionKeys = <String>[];
  final languages = <String>[];
  TarotReading current = _reading();
  @override
  Future<TarotEntitlement> getEntitlement() async => const TarotEntitlement(
    freeReadingAvailableToday: true,
    paidCreditsRemaining: 0,
  );
  @override
  Future<TarotStartResult> startReading({
    required String question,
    required String idempotencyKey,
    required String language,
  }) async {
    creationKeys.add(idempotencyKey);
    languages.add(language);
    if (failCreateOnce) {
      failCreateOnce = false;
      throw StateError('network');
    }
    return startResult ?? TarotStartReady(current);
  }

  @override
  Future<TarotReading> getReading(String id) async => current;
  @override
  Future<TarotReading> selectCard({
    required String readingId,
    required String selectionToken,
    required String idempotencyKey,
  }) async {
    selectionKeys.add(idempotencyKey);
    final count = current.selectedCards.length + 1;
    current = _reading(
      selected: count,
      status: count == 3 ? 'COMPLETED' : 'DRAWING',
    );
    return current;
  }

  @override
  Future<TarotReading> retryInterpretation(String readingId) async =>
      current = _reading(selected: 3, status: 'COMPLETED');
  @override
  Future<TarotHistoryPage> getHistory({int limit = 20, String? cursor}) async =>
      TarotHistoryPage(readings: [current]);
}

class _LanguageStorage implements CareerExplanationLanguageStorage {
  @override
  Future<String?> readLanguage() async => null;
  @override
  Future<void> writeLanguage(CareerExplanationLanguage language) async {}
}

class _AuthRepository implements AuthRepository {
  final controller = StreamController<AuthSnapshot>.broadcast();
  void emit(AuthSnapshot value) => controller.add(value);
  void dispose() => controller.close();
  @override
  Stream<AuthSnapshot> get states => controller.stream;
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
