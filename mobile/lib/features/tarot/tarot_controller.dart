import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../auth/domain/auth_repository.dart';
import '../readings/career_explanation_language.dart';
import 'domain/tarot.dart';
import 'domain/tarot_repository.dart';

final tarotRepositoryProvider = Provider<TarotRepository>(
  (ref) => const UnavailableTarotRepository(),
);
final tarotControllerProvider =
    Provider.family<
      TarotController,
      (AuthController, CareerExplanationLanguageController)
    >((ref, input) {
      final controller = TarotController(
        ref.watch(tarotRepositoryProvider),
        input.$1,
        language: input.$2,
      );
      ref.onDispose(controller.dispose);
      return controller;
    });

enum TarotLoadState { initial, loading, ready, error }

String _requestKey() {
  final random = Random.secure();
  return '${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}-${List.generate(4, (_) => random.nextInt(1 << 32).toRadixString(16).padLeft(8, '0')).join()}';
}

class TarotController extends ChangeNotifier {
  TarotController(this._repository, this._auth, {this._language}) {
    _auth.addListener(_authChanged);
  }
  final TarotRepository _repository;
  final AuthController _auth;
  final CareerExplanationLanguageController? _language;
  bool get isHinglish =>
      _language?.language == CareerExplanationLanguage.hinglish;
  TarotLoadState landingState = TarotLoadState.initial;
  TarotEntitlement? entitlement;
  Object? error;
  TarotReading? reading;
  bool selecting = false;
  bool interpreting = false;
  String? _creationKey;
  String? _creationQuestion;
  final Map<String, String> _selectionKeys = {};
  List<TarotReading> history = [];
  String? nextCursor;
  bool historyLoading = false;
  TarotSafetyBoundary? safetyBoundary;
  List<TarotPack> purchasePacks = [];
  Future<void> loadLanding() async {
    landingState = TarotLoadState.loading;
    error = null;
    notifyListeners();
    try {
      entitlement = await _repository.getEntitlement();
      landingState = TarotLoadState.ready;
    } catch (e) {
      error = e;
      landingState = TarotLoadState.error;
    }
    notifyListeners();
  }

  Future<TarotStartResult?> start(String question) async {
    final value = question.trim();
    if (value.isEmpty) return null;
    if (_creationQuestion != value) {
      _creationQuestion = value;
      _creationKey = _requestKey();
    }
    landingState = TarotLoadState.loading;
    safetyBoundary = null;
    purchasePacks = [];
    error = null;
    notifyListeners();
    try {
      final result = await _repository.startReading(
        question: value,
        idempotencyKey: _creationKey!,
        language: isHinglish ? 'HINGLISH' : 'ENGLISH',
      );
      switch (result) {
        case TarotStartReady():
          reading = result.reading;
          _creationKey = null;
          _creationQuestion = null;
          landingState = TarotLoadState.ready;
        case TarotStartSafety():
          safetyBoundary = result.boundary;
          _creationKey = null;
          _creationQuestion = null;
          landingState = TarotLoadState.ready;
        case TarotStartPurchaseRequired():
          entitlement = result.entitlement;
          purchasePacks = result.products;
          _creationKey = null;
          _creationQuestion = null;
          landingState = TarotLoadState.ready;
      }
      notifyListeners();
      return result;
    } catch (e) {
      error = e;
      landingState = TarotLoadState.error;
      notifyListeners();
      return null;
    }
  }

  Future<void> loadReading(String id) async {
    error = null;
    reading = null;
    notifyListeners();
    try {
      reading = await _repository.getReading(id);
    } catch (e) {
      error = e;
    }
    notifyListeners();
  }

  Future<bool> select(String token) async {
    if (selecting || reading == null || !reading!.canDraw) return false;
    selecting = true;
    error = null;
    final keyId = '${reading!.readingId}:$token';
    final key = _selectionKeys.putIfAbsent(keyId, _requestKey);
    notifyListeners();
    try {
      reading = await _repository.selectCard(
        readingId: reading!.readingId,
        selectionToken: token,
        idempotencyKey: key,
      );
      _selectionKeys.remove(keyId);
      return true;
    } catch (e) {
      error = e;
      return false;
    } finally {
      selecting = false;
      notifyListeners();
    }
  }

  Future<void> retryInterpretation() async {
    if (reading == null || interpreting) return;
    interpreting = true;
    error = null;
    notifyListeners();
    try {
      reading = await _repository.retryInterpretation(reading!.readingId);
    } catch (e) {
      error = e;
    } finally {
      interpreting = false;
      notifyListeners();
    }
  }

  Future<void> refreshEntitlement() => loadLanding();
  Future<void> loadHistory({bool more = false}) async {
    if (historyLoading) return;
    historyLoading = true;
    error = null;
    if (!more) {
      history = [];
      nextCursor = null;
    }
    notifyListeners();
    try {
      final page = await _repository.getHistory(
        cursor: more ? nextCursor : null,
      );
      history = more ? [...history, ...page.readings] : page.readings;
      nextCursor = page.nextCursor;
    } catch (e) {
      error = e;
    } finally {
      historyLoading = false;
      notifyListeners();
    }
  }

  void _authChanged() {
    if (_auth.state.status == AuthStatus.authenticated) return;
    entitlement = null;
    reading = null;
    history = [];
    nextCursor = null;
    safetyBoundary = null;
    purchasePacks = [];
    _selectionKeys.clear();
    _creationKey = null;
    _creationQuestion = null;
    landingState = TarotLoadState.initial;
    notifyListeners();
  }

  @override
  void dispose() {
    _auth.removeListener(_authChanged);
    super.dispose();
  }
}
