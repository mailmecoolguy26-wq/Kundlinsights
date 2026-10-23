import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../auth/domain/auth_repository.dart';
import '../profiles/profile_controller.dart';
import '../payments/data/debug_local_storekit_entitlement_session.dart';
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
    DebugLocalStoreKitEntitlementSession? debugLocalStoreKitEntitlementSession,
  }) : _idempotencyKey = idempotencyKey ?? _newKey {
    _debugLocalStoreKitEntitlementSession =
        debugLocalStoreKitEntitlementSession;
    _auth.addListener(_onScopeChanged);
    _profiles.addListener(_onScopeChanged);
    _debugLocalStoreKitEntitlementSession?.addListener(_onLocalDebugChanged);
    _onScopeChanged();
  }
  final CareerReadingGenerationRepository repository;
  final AuthController _auth;
  final ProfileController _profiles;
  final ReadingController _readings;
  final String Function() _idempotencyKey;
  late final DebugLocalStoreKitEntitlementSession?
  _debugLocalStoreKitEntitlementSession;
  CareerEligibilityState _eligibilityState = CareerEligibilityState.initial;
  CareerGenerationState _generationState = CareerGenerationState.idle;
  String? _subject,
      _profileId,
      _attemptKey,
      _createdReadingId,
      _eligibilityMode,
      _backendPurchaseMode,
      _purchaseMode;
  DateTime? _validUntil;
  int _generation = 0;
  bool _disposed = false;
  CareerEligibilityState get eligibilityState => _eligibilityState;
  CareerGenerationState get generationState => _generationState;
  String? get createdReadingId => _createdReadingId;
  String? get eligibilityMode => _eligibilityMode;
  String? get backendPurchaseMode => _backendPurchaseMode;
  String? get purchaseMode => _purchaseMode;
  String? get activeBirthProfileId => _profileId;
  String? get activeAuthenticatedSubject => _subject;
  DateTime? get validUntil => _validUntil;
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
    _eligibilityMode = null;
    _backendPurchaseMode = null;
    _purchaseMode = null;
    _validUntil = null;
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
      final value = await repository.getCareerEligibility(
        birthProfileId: profile,
      );
      if (!_current(generation, subject, profile)) return;
      _eligibilityState = value.eligible
          ? CareerEligibilityState.eligible
          : CareerEligibilityState.ineligible;
      _eligibilityMode = value.mode;
      _backendPurchaseMode = value.purchaseMode;
      _purchaseMode =
          _debugLocalStoreKitEntitlementSession?.resolvePurchaseMode(
            authenticatedSubject: subject,
            birthProfileId: profile,
            backendPurchaseMode: value.purchaseMode,
          ) ??
          value.purchaseMode;
      _validUntil = value.validUntil;
      final localSession = _debugLocalStoreKitEntitlementSession;
      if (kDebugMode && localSession?.enabled == true) {
        debugPrint(
          'CAREER_PURCHASE_CONTEXT '
          'subject=$subject '
          'profile=$profile '
          'hasLocalPrimary=${localSession!.hasActivePrimarySubscription(subject)} '
          'localProfileSource=${localSession.localEntitlementSourceFor(authenticatedSubject: subject, birthProfileId: profile) ?? 'none'} '
          'backendPurchaseMode=${value.purchaseMode ?? 'none'} '
          'effectivePurchaseMode=${_purchaseMode ?? 'none'} '
          'providerProductId=not_loaded',
        );
      }
      _debugEligibility(profile, _eligibilityState);
    } catch (_) {
      if (!_current(generation, subject, profile)) return;
      _eligibilityState = CareerEligibilityState.error;
      _eligibilityMode = null;
      _backendPurchaseMode = null;
      _purchaseMode = null;
      _validUntil = null;
      _debugEligibility(profile, _eligibilityState);
    }
    notifyListeners();
  }

  void _onLocalDebugChanged() {
    if (_subject != null && _profileId != null) unawaited(refreshEligibility());
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

  void _debugEligibility(String profileId, CareerEligibilityState state) {
    if (!kDebugMode) return;
    debugPrint(
      'CAREER_ENTITLEMENT_REFRESH profile=p${profileId.hashCode} state=${state.name}',
    );
  }

  @override
  void dispose() {
    _disposed = true;
    _generation++;
    _auth.removeListener(_onScopeChanged);
    _profiles.removeListener(_onScopeChanged);
    _debugLocalStoreKitEntitlementSession?.removeListener(_onLocalDebugChanged);
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
        debugLocalStoreKitEntitlementSession: ref.watch(
          debugLocalStoreKitEntitlementSessionProvider,
        ),
      );
      ref.onDispose(controller.dispose);
      return controller;
    });
