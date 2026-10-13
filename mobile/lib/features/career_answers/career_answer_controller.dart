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

  Future<void> load(CareerQuestionType questionType) async {
    final profileId = _profiles.activeProfile?.id;
    if (profileId == null || profileId.isEmpty) return;
    final generation = ++_generation;
    _profileId = profileId;
    _questionType = questionType;
    _state = CareerAnswerLoadState.loading;
    _answer = null;
    _error = null;
    notifyListeners();
    _debugAnswer(
      'CAREER_ANSWER_FETCH_START profile=${_safeProfile(profileId)} '
      'type=${questionType.wireName}',
    );
    try {
      final result =
          _hasLocalDebugJobFavourabilityAccess(profileId, questionType)
          ? DebugJobFavourabilityPreviewRepository.syntheticEntitledAnswer
          : await _repository.getAnswer(
              birthProfileId: profileId,
              questionType: questionType,
            );
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
      _state = CareerAnswerLoadState.error;
    }
    notifyListeners();
  }

  void _onProfileChanged() {
    final id = _profiles.activeProfile?.id;
    if (id == _profileId) return;
    final previous = _profileId;
    _generation++;
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
    unawaited(load(CareerQuestionType.jobFavourabilityTiming));
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
