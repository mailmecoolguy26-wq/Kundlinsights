import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../auth/domain/auth_repository.dart';
import '../profiles/profile_controller.dart';
import 'domain/career_reading_generation.dart';
import 'reading_controller.dart';

enum CareerEligibilityState { initial, loading, eligible, ineligible, error }

enum CareerGenerationState { idle, generating, success, error }

class CareerReadingGenerationController extends ChangeNotifier {
  CareerReadingGenerationController(
    this.repository,
    this._auth,
    this._profiles,
    this._readings, {
    String Function()? idempotencyKey,
  }) : _idempotencyKey = idempotencyKey ?? _newKey {
    _auth.addListener(_onScopeChanged);
    _profiles.addListener(_onScopeChanged);
    _onScopeChanged();
  }
  final CareerReadingGenerationRepository repository;
  final AuthController _auth;
  final ProfileController _profiles;
  final ReadingController _readings;
  final String Function() _idempotencyKey;
  CareerEligibilityState _eligibilityState = CareerEligibilityState.initial;
  CareerGenerationState _generationState = CareerGenerationState.idle;
  String? _subject, _profileId, _attemptKey, _createdReadingId;
  int _generation = 0;
  bool _disposed = false;
  CareerEligibilityState get eligibilityState => _eligibilityState;
  CareerGenerationState get generationState => _generationState;
  String? get createdReadingId => _createdReadingId;
  bool get canGenerate =>
      _eligibilityState == CareerEligibilityState.eligible &&
      _generationState != CareerGenerationState.generating;

  void _onScopeChanged() {
    final subject = _auth.state.status == AuthStatus.authenticated
        ? _auth.state.subject
        : null;
    final profile = subject == null ? null : _profiles.activeProfile?.id;
    if (subject == _subject && profile == _profileId) return;
    _generation++;
    _subject = subject;
    _profileId = profile;
    _attemptKey = null;
    _createdReadingId = null;
    _generationState = CareerGenerationState.idle;
    if (subject == null || profile == null) {
      _eligibilityState = CareerEligibilityState.initial;
      notifyListeners();
      return;
    }
    _eligibilityState = CareerEligibilityState.loading;
    notifyListeners();
    _loadEligibility(subject, profile, _generation);
  }

  Future<void> refreshEligibility() async {
    final subject = _subject, profile = _profileId;
    if (subject == null || profile == null) return;
    final generation = ++_generation;
    _eligibilityState = CareerEligibilityState.loading;
    notifyListeners();
    await _loadEligibility(subject, profile, generation);
  }

  Future<void> _loadEligibility(
    String subject,
    String profile,
    int generation,
  ) async {
    try {
      final value = await repository.getCareerEligibility();
      if (!_current(generation, subject, profile)) return;
      _eligibilityState = value.eligible
          ? CareerEligibilityState.eligible
          : CareerEligibilityState.ineligible;
    } catch (_) {
      if (!_current(generation, subject, profile)) return;
      _eligibilityState = CareerEligibilityState.error;
    }
    notifyListeners();
  }

  Future<void> generate() async {
    if (!canGenerate) return;
    final subject = _subject!, profile = _profileId!, generation = _generation;
    final key = _attemptKey ??= _idempotencyKey();
    _generationState = CareerGenerationState.generating;
    _createdReadingId = null;
    notifyListeners();
    try {
      final created = await repository.createCareerReading(
        birthProfileId: profile,
        idempotencyKey: key,
      );
      if (!_current(generation, subject, profile)) return;
      await _readings.refresh();
      if (!_current(generation, subject, profile)) return;
      await _readings.loadDetail(created.readingId);
      if (!_current(generation, subject, profile)) return;
      _createdReadingId = created.readingId;
      _attemptKey = null;
      _generationState = CareerGenerationState.success;
      await refreshEligibility();
    } catch (_) {
      if (!_current(generation, subject, profile)) return;
      _generationState = CareerGenerationState.error;
      await refreshEligibility();
    }
    if (_current(generation, subject, profile)) notifyListeners();
  }

  bool _current(int generation, String subject, String profile) =>
      !_disposed &&
      generation == _generation &&
      subject == _subject &&
      profile == _profileId;
  @override
  void dispose() {
    _disposed = true;
    _generation++;
    _auth.removeListener(_onScopeChanged);
    _profiles.removeListener(_onScopeChanged);
    super.dispose();
  }
}

String _newKey() =>
    '${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}-${Random.secure().nextInt(1 << 32).toRadixString(36)}';
final careerReadingGenerationRepositoryProvider =
    Provider<CareerReadingGenerationRepository>(
      (ref) => const UnavailableCareerReadingGenerationRepository(),
    );
final careerReadingGenerationControllerProvider =
    Provider.family<
      CareerReadingGenerationController,
      (AuthController, ProfileController, ReadingController)
    >((ref, scope) {
      final controller = CareerReadingGenerationController(
        ref.watch(careerReadingGenerationRepositoryProvider),
        scope.$1,
        scope.$2,
        scope.$3,
      );
      ref.onDispose(controller.dispose);
      return controller;
    });
