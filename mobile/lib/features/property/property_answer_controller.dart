import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../profiles/profile_controller.dart';
import 'domain/property_answer.dart';
import 'domain/property_answer_repository.dart';

enum PropertyAnswerLoadState { initial, loading, loaded, error }

final propertyAnswerRepositoryProvider = Provider<PropertyAnswerRepository>(
  (ref) => const UnavailablePropertyAnswerRepository(),
);

final propertyAnswerControllerProvider =
    Provider.family<PropertyAnswerController, ProfileController>((
      ref,
      profiles,
    ) {
      final controller = PropertyAnswerController(
        ref.watch(propertyAnswerRepositoryProvider),
        profiles,
      );
      ref.onDispose(controller.dispose);
      return controller;
    });

class PropertyAnswerController extends ChangeNotifier {
  PropertyAnswerController(this._repository, this._profiles) {
    _profiles.addListener(_onProfileChanged);
  }

  final PropertyAnswerRepository _repository;
  final ProfileController _profiles;
  final Map<String, PropertyAnswer> _answersByProfile = {};
  final Map<String, Future<void>> _inFlightLoads = {};
  final Map<String, Object> _inFlightKeys = {};
  PropertyAnswerLoadState _state = PropertyAnswerLoadState.initial;
  PropertyAnswer? _answer;
  Object? _error;
  String? _subject;
  String? _profileId;
  int _generation = 0;
  bool _isRefreshing = false;
  bool _disposed = false;

  PropertyAnswerLoadState get state => _state;
  PropertyAnswer? get answer => _answer;
  Object? get error => _error;
  bool get isRefreshing => _isRefreshing;

  /// Shows a session-cached answer immediately. A caller may explicitly force
  /// a refresh; cached content remains visible if that refresh fails.
  Future<void> load({bool force = false}) {
    final profileId = _profiles.activeProfile?.id;
    if (profileId == null || profileId.isEmpty) return Future.value();
    _synchronizeSubject();
    final cached = _answersByProfile[profileId];
    if (!force && cached != null && !cached.premiumRequired) {
      _profileId = profileId;
      _answer = cached;
      _error = null;
      _state = PropertyAnswerLoadState.loaded;
      _isRefreshing = false;
      notifyListeners();
      return Future.value();
    }
    final inFlight = _inFlightLoads[profileId];
    if (inFlight != null) return inFlight;

    final generation = ++_generation;
    final subject = _subject;
    _profileId = profileId;
    _isRefreshing = cached != null;
    _state = cached == null
        ? PropertyAnswerLoadState.loading
        : PropertyAnswerLoadState.loaded;
    _answer = cached;
    _error = null;
    notifyListeners();
    final requestKey = Object();
    final request = _loadFromRepository(
      profileId: profileId,
      subject: subject,
      generation: generation,
      cached: cached,
      requestKey: requestKey,
    );
    _inFlightLoads[profileId] = request;
    _inFlightKeys[profileId] = requestKey;
    return request;
  }

  Future<void> _loadFromRepository({
    required String profileId,
    required String? subject,
    required int generation,
    required PropertyAnswer? cached,
    required Object requestKey,
  }) async {
    try {
      final answer = await _repository.getAnswer(
        birthProfileId: profileId,
        intent: PropertyIntent.purchaseTiming,
      );
      if (_sameSubject(subject)) {
        if (answer.premiumRequired) {
          _answersByProfile.remove(profileId);
        } else {
          _answersByProfile[profileId] = answer;
        }
      }
      if (!_isCurrent(generation, profileId, subject)) return;
      _answer = answer;
      _state = PropertyAnswerLoadState.loaded;
    } catch (error) {
      if (!_isCurrent(generation, profileId, subject)) return;
      _error = error;
      if (cached != null) {
        _answer = cached;
        _state = PropertyAnswerLoadState.loaded;
      } else {
        _state = PropertyAnswerLoadState.error;
      }
    } finally {
      if (identical(_inFlightKeys[profileId], requestKey)) {
        _inFlightLoads.remove(profileId);
        _inFlightKeys.remove(profileId);
      }
      if (_isCurrent(generation, profileId, subject)) {
        _isRefreshing = false;
        notifyListeners();
      }
    }
  }

  /// Called when the established entitlement refresh detects a material change.
  /// It never changes entitlement; it only discards presentation cache.
  void invalidateProfile(String profileId) {
    _answersByProfile.remove(profileId);
    _inFlightLoads.remove(profileId);
    _inFlightKeys.remove(profileId);
    if (_profiles.activeProfile?.id != profileId) return;
    _generation++;
    _profileId = profileId;
    _answer = null;
    _error = null;
    _isRefreshing = false;
    _state = PropertyAnswerLoadState.initial;
    notifyListeners();
    unawaited(load(force: true));
  }

  void _onProfileChanged() {
    _synchronizeSubject();
    final id = _profiles.activeProfile?.id;
    if (id == _profileId) return;
    _generation++;
    _profileId = id;
    _answer = _answersByProfile[id];
    _error = null;
    _isRefreshing = false;
    _state = _answer == null
        ? PropertyAnswerLoadState.initial
        : PropertyAnswerLoadState.loaded;
    notifyListeners();
    if (id != null && id.isNotEmpty) unawaited(load());
  }

  void _synchronizeSubject() {
    final subject = _profiles.activeAuthenticatedSubject;
    if (subject == _subject) return;
    _subject = subject;
    _generation++;
    _answersByProfile.clear();
    _inFlightLoads.clear();
    _inFlightKeys.clear();
  }

  bool _sameSubject(String? subject) =>
      !_disposed && subject == _profiles.activeAuthenticatedSubject;

  bool _isCurrent(int generation, String profileId, String? subject) =>
      !_disposed &&
      generation == _generation &&
      _sameSubject(subject) &&
      _profiles.activeProfile?.id == profileId;

  @override
  void dispose() {
    _disposed = true;
    _profiles.removeListener(_onProfileChanged);
    super.dispose();
  }
}
