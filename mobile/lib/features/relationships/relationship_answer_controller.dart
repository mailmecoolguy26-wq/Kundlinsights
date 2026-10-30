import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../profiles/profile_controller.dart';
import 'domain/relationship_answer.dart';
import 'domain/relationship_answer_repository.dart';

enum RelationshipAnswerLoadState { initial, loading, loaded, error }

final relationshipAnswerRepositoryProvider =
    Provider<RelationshipAnswerRepository>(
      (ref) => const UnavailableRelationshipAnswerRepository(),
    );

final relationshipAnswerControllerProvider =
    Provider.family<RelationshipAnswerController, ProfileController>((
      ref,
      profiles,
    ) {
      final controller = RelationshipAnswerController(
        ref.watch(relationshipAnswerRepositoryProvider),
        profiles,
      );
      ref.onDispose(controller.dispose);
      return controller;
    });

class RelationshipAnswerController extends ChangeNotifier {
  RelationshipAnswerController(this._repository, this._profiles) {
    _profiles.addListener(_onProfileChanged);
  }

  final RelationshipAnswerRepository _repository;
  final ProfileController _profiles;
  final Map<String, RelationshipAnswer> _cache = {};
  final Map<String, Future<void>> _inFlight = {};
  RelationshipAnswerLoadState _state = RelationshipAnswerLoadState.initial;
  RelationshipAnswer? _answer;
  Object? _error;
  String? _profileId;
  String? _subject;
  int _generation = 0;
  bool _disposed = false;

  RelationshipAnswerLoadState get state => _state;
  RelationshipAnswer? get answer => _answer;
  Object? get error => _error;

  Future<void> load({bool force = false}) {
    _syncSubject();
    final profileId = _profiles.activeProfile?.id;
    if (profileId == null || profileId.isEmpty) return Future.value();
    final cached = _cache[profileId];
    if (!force && cached != null && !cached.premiumRequired) {
      _profileId = profileId;
      _answer = cached;
      _error = null;
      _state = RelationshipAnswerLoadState.loaded;
      notifyListeners();
      return Future.value();
    }
    if (_inFlight[profileId] case final active?) return active;
    final generation = ++_generation;
    final subject = _subject;
    _profileId = profileId;
    _answer = cached;
    _error = null;
    _state = cached == null
        ? RelationshipAnswerLoadState.loading
        : RelationshipAnswerLoadState.loaded;
    notifyListeners();
    final future = _fetch(profileId, subject, generation, cached);
    _inFlight[profileId] = future;
    return future;
  }

  Future<void> _fetch(
    String profileId,
    String? subject,
    int generation,
    RelationshipAnswer? cached,
  ) async {
    try {
      final answer = await _repository.getAnswer(
        birthProfileId: profileId,
        intent: RelationshipIntent.outlook,
      );
      if (_sameSubject(subject)) {
        if (answer.premiumRequired) {
          _cache.remove(profileId);
        } else {
          _cache[profileId] = answer;
        }
      }
      if (!_current(generation, profileId, subject)) return;
      _answer = answer;
      _state = RelationshipAnswerLoadState.loaded;
    } catch (error) {
      if (!_current(generation, profileId, subject)) return;
      _error = error;
      _answer = cached;
      _state = cached == null
          ? RelationshipAnswerLoadState.error
          : RelationshipAnswerLoadState.loaded;
    } finally {
      _inFlight.remove(profileId);
      if (_current(generation, profileId, subject)) notifyListeners();
    }
  }

  void invalidateProfile(String profileId) {
    _cache.remove(profileId);
    if (_profiles.activeProfile?.id != profileId) return;
    _generation++;
    _profileId = profileId;
    _answer = null;
    _error = null;
    _state = RelationshipAnswerLoadState.initial;
    notifyListeners();
    unawaited(load(force: true));
  }

  void _onProfileChanged() {
    _syncSubject();
    final id = _profiles.activeProfile?.id;
    if (id == _profileId) return;
    _generation++;
    _profileId = id;
    _answer = _cache[id];
    _error = null;
    _state = _answer == null
        ? RelationshipAnswerLoadState.initial
        : RelationshipAnswerLoadState.loaded;
    notifyListeners();
    if (id != null && id.isNotEmpty) unawaited(load());
  }

  void _syncSubject() {
    final subject = _profiles.activeAuthenticatedSubject;
    if (subject == _subject) return;
    _subject = subject;
    _generation++;
    _cache.clear();
    _inFlight.clear();
  }

  bool _sameSubject(String? subject) =>
      !_disposed && subject == _profiles.activeAuthenticatedSubject;
  bool _current(int generation, String id, String? subject) =>
      !_disposed &&
      generation == _generation &&
      _profiles.activeProfile?.id == id &&
      _sameSubject(subject);

  @override
  void dispose() {
    _disposed = true;
    _profiles.removeListener(_onProfileChanged);
    super.dispose();
  }
}
