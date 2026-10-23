import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../profiles/profile_controller.dart';
import '../payments/data/debug_local_storekit_entitlement_session.dart';
import 'data/debug_job_favourability_preview_repository.dart';
import 'domain/career_answer.dart';
import 'domain/career_answer_repository.dart';

enum CareerAnswerLoadState { initial, loading, loaded, error }

final careerAnswerRepositoryProvider = Provider<CareerAnswerRepository>(
  (ref) => const UnavailableCareerAnswerRepository(),
);

final careerAnswerControllerProvider =
    Provider.family<CareerAnswerController, ProfileController>((ref, profiles) {
      final controller = CareerAnswerController(
        ref.watch(careerAnswerRepositoryProvider),
        profiles,
        ref.watch(debugLocalStoreKitEntitlementSessionProvider),
      );
      ref.onDispose(controller.dispose);
      return controller;
    });

class CareerAnswerController extends ChangeNotifier {
  CareerAnswerController(
    this._repository,
    this._profiles, [
    this._debugLocalStoreKitEntitlementSession,
  ]) {
    _profiles.addListener(_onProfileChanged);
    _debugLocalStoreKitEntitlementSession?.addListener(
      _onLocalDebugEntitlementChanged,
    );
  }

  final CareerAnswerRepository _repository;
  final ProfileController _profiles;
  final DebugLocalStoreKitEntitlementSession?
  _debugLocalStoreKitEntitlementSession;
  final Map<_CareerAnswerCacheKey, CareerAnswer> _answersByScope = {};
  final Map<_CareerAnswerCacheKey, Future<void>> _inFlightLoads = {};
  final Map<_CareerAnswerCacheKey, Object> _inFlightKeys = {};
  CareerAnswerLoadState _state = CareerAnswerLoadState.initial;
  CareerAnswer? _answer;
  Object? _error;
  String? _profileId;
  CareerQuestionType? _questionType;
  int _generation = 0;
  bool _disposed = false;

  CareerAnswerLoadState get state => _state;
  CareerAnswer? get answer => _answer;
  Object? get error => _error;

  /// A Career answer is a profile- and question-scoped session result. Route
  /// re-entry therefore does not erase a valid answer before showing it.
  Future<void> load(CareerQuestionType questionType, {bool force = false}) {
    final profileId = _profiles.activeProfile?.id;
    if (profileId == null || profileId.isEmpty) return Future.value();
    final subject = _profiles.activeAuthenticatedSubject;
    final key = _CareerAnswerCacheKey(subject, profileId, questionType);
    final cached = _answersByScope[key];
    if (!force && cached != null && !_isPremiumRequired(cached)) {
      _profileId = profileId;
      _questionType = questionType;
      _answer = cached;
      _error = null;
      _state = CareerAnswerLoadState.loaded;
      notifyListeners();
      return Future.value();
    }
    final inFlight = _inFlightLoads[key];
    if (inFlight != null) return inFlight;

    final generation = ++_generation;
    _profileId = profileId;
    _questionType = questionType;
    _state = cached == null
        ? CareerAnswerLoadState.loading
        : CareerAnswerLoadState.loaded;
    _answer = cached;
    _error = null;
    notifyListeners();
    _debugAnswer(
      'CAREER_ANSWER_FETCH_START profile=${_safeProfile(profileId)} '
      'type=${questionType.wireName}',
    );
    final requestKey = Object();
    final request = _loadFromRepository(
      key: key,
      profileId: profileId,
      questionType: questionType,
      generation: generation,
      cached: cached,
      requestKey: requestKey,
    );
    _inFlightLoads[key] = request;
    _inFlightKeys[key] = requestKey;
    return request;
  }

  Future<void> _loadFromRepository({
    required _CareerAnswerCacheKey key,
    required String profileId,
    required CareerQuestionType questionType,
    required int generation,
    required CareerAnswer? cached,
    required Object requestKey,
  }) async {
    try {
      final result =
          _hasLocalDebugJobFavourabilityAccess(profileId, questionType)
          ? DebugJobFavourabilityPreviewRepository.syntheticEntitledAnswer
          : await _repository.getAnswer(
              birthProfileId: profileId,
              questionType: questionType,
            );
      if (key.subject == _profiles.activeAuthenticatedSubject) {
        if (_isPremiumRequired(result)) {
          _answersByScope.remove(key);
        } else {
          _answersByScope[key] = result;
        }
      }
      if (!_current(generation, profileId)) return;
      _answer = result;
      _state = CareerAnswerLoadState.loaded;
      _debugAnswer(
        'CAREER_ANSWER_FETCH_RESULT profile=${_safeProfile(profileId)} '
        'access=${_hasLocalDebugJobFavourabilityAccess(profileId, questionType) ? 'LOCAL_DEBUG_ACTIVE' : result.answerability}',
      );
    } catch (error) {
      if (!_current(generation, profileId)) return;
      _error = error;
      if (cached != null) {
        _answer = cached;
        _state = CareerAnswerLoadState.loaded;
      } else {
        _state = CareerAnswerLoadState.error;
      }
    } finally {
      if (identical(_inFlightKeys[key], requestKey)) {
        _inFlightLoads.remove(key);
        _inFlightKeys.remove(key);
      }
      if (_current(generation, profileId)) notifyListeners();
    }
  }

  void _onProfileChanged() {
    final id = _profiles.activeProfile?.id;
    if (id == _profileId) return;
    final previous = _profileId;
    _generation++;
    if (_profiles.activeAuthenticatedSubject == null) {
      _answersByScope.clear();
      _inFlightLoads.clear();
      _inFlightKeys.clear();
    }
    _profileId = id;
    _state = CareerAnswerLoadState.initial;
    _answer = null;
    _error = null;
    notifyListeners();
    _debugAnswer(
      'ACTIVE_PROFILE_CHANGED old=${_safeProfile(previous)} new=${_safeProfile(id)}',
    );
    final questionType = _questionType;
    if (id != null && id.isNotEmpty && questionType != null) {
      unawaited(load(questionType));
    }
  }

  void _onLocalDebugEntitlementChanged() {
    final profileId = _profiles.activeProfile?.id;
    if (profileId == null ||
        _questionType != CareerQuestionType.jobFavourabilityTiming ||
        !_hasLocalDebugJobFavourabilityAccess(
          profileId,
          CareerQuestionType.jobFavourabilityTiming,
        )) {
      return;
    }
    unawaited(load(CareerQuestionType.jobFavourabilityTiming, force: true));
  }

  bool _hasLocalDebugJobFavourabilityAccess(
    String profileId,
    CareerQuestionType questionType,
  ) =>
      questionType == CareerQuestionType.jobFavourabilityTiming &&
      (_debugLocalStoreKitEntitlementSession?.isActiveFor(
            authenticatedSubject: _profiles.activeAuthenticatedSubject,
            birthProfileId: profileId,
          ) ??
          false);

  bool _isPremiumRequired(CareerAnswer answer) =>
      answer.answerability == CareerAnswerability.premiumRequired;

  void _debugAnswer(String message) {
    if (kDebugMode) debugPrint(message);
  }

  String _safeProfile(String? profileId) =>
      profileId == null ? 'none' : 'p${profileId.hashCode}';

  bool _current(int generation, String profileId) =>
      !_disposed &&
      generation == _generation &&
      _profiles.activeProfile?.id == profileId;

  @override
  void dispose() {
    _disposed = true;
    _generation++;
    _profiles.removeListener(_onProfileChanged);
    _debugLocalStoreKitEntitlementSession?.removeListener(
      _onLocalDebugEntitlementChanged,
    );
    super.dispose();
  }
}

class _CareerAnswerCacheKey {
  const _CareerAnswerCacheKey(this.subject, this.profileId, this.questionType);
  final String? subject;
  final String profileId;
  final CareerQuestionType questionType;

  @override
  bool operator ==(Object other) =>
      other is _CareerAnswerCacheKey &&
      other.subject == subject &&
      other.profileId == profileId &&
      other.questionType == questionType;

  @override
  int get hashCode => Object.hash(subject, profileId, questionType);
}
