import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../profiles/profile_controller.dart';
import 'domain/wealth_answer.dart';
import 'domain/wealth_answer_repository.dart';

enum WealthAnswerLoadState { initial, loading, loaded, error }

final wealthAnswerRepositoryProvider = Provider<WealthAnswerRepository>((ref) => const UnavailableWealthAnswerRepository());
final wealthAnswerControllerProvider = Provider.family<WealthAnswerController, ProfileController>((ref, profiles) {
  final controller = WealthAnswerController(ref.watch(wealthAnswerRepositoryProvider), profiles);
  ref.onDispose(controller.dispose);
  return controller;
});

class WealthAnswerController extends ChangeNotifier {
  WealthAnswerController(this._repository, this._profiles) { _profiles.addListener(_onProfileChanged); }
  final WealthAnswerRepository _repository;
  final ProfileController _profiles;
  final Map<String, WealthAnswer> _cache = {};
  final Map<String, Future<void>> _inFlight = {};
  WealthAnswerLoadState _state = WealthAnswerLoadState.initial;
  WealthAnswer? _answer;
  Object? _error;
  String? _profileId;
  String? _subject;
  int _generation = 0;
  bool _disposed = false;
  WealthAnswerLoadState get state => _state;
  WealthAnswer? get answer => _answer;
  Object? get error => _error;

  Future<void> load({bool force = false}) {
    _syncSubject();
    final profileId = _profiles.activeProfile?.id;
    if (profileId == null || profileId.isEmpty) return Future.value();
    final cached = _cache[profileId];
    if (!force && cached != null && !cached.premiumRequired) {
      _profileId = profileId; _answer = cached; _error = null; _state = WealthAnswerLoadState.loaded; notifyListeners(); return Future.value();
    }
    if (_inFlight[profileId] case final active?) return active;
    final generation = ++_generation, subject = _subject;
    _profileId = profileId; _answer = cached; _error = null; _state = cached == null ? WealthAnswerLoadState.loading : WealthAnswerLoadState.loaded; notifyListeners();
    final future = _fetch(profileId, subject, generation, cached);
    _inFlight[profileId] = future;
    return future;
  }
  Future<void> _fetch(String profileId, String? subject, int generation, WealthAnswer? cached) async {
    try {
      final answer = await _repository.getAnswer(birthProfileId: profileId, intent: WealthIntent.currentOutlook);
      if (_sameSubject(subject)) {
        if (answer.premiumRequired) {
          _cache.remove(profileId);
        } else {
          _cache[profileId] = answer;
        }
      }
      if (!_current(generation, profileId, subject)) return;
      _answer = answer; _state = WealthAnswerLoadState.loaded;
    } catch (error) {
      if (!_current(generation, profileId, subject)) return;
      _error = error; _answer = cached; _state = cached == null ? WealthAnswerLoadState.error : WealthAnswerLoadState.loaded;
    } finally {
      _inFlight.remove(profileId);
      if (_current(generation, profileId, subject)) notifyListeners();
    }
  }
  void invalidateProfile(String profileId) {
    _cache.remove(profileId);
    if (_profiles.activeProfile?.id != profileId) return;
    _generation++; _profileId = profileId; _answer = null; _error = null; _state = WealthAnswerLoadState.initial; notifyListeners();
    unawaited(load(force: true));
  }
  void _onProfileChanged() { _syncSubject(); final id = _profiles.activeProfile?.id; if (id == _profileId) return; _generation++; _profileId = id; _answer = _cache[id]; _error = null; _state = _answer == null ? WealthAnswerLoadState.initial : WealthAnswerLoadState.loaded; notifyListeners(); if (id != null && id.isNotEmpty) unawaited(load()); }
  void _syncSubject() { final subject = _profiles.activeAuthenticatedSubject; if (subject == _subject) return; _subject = subject; _generation++; _cache.clear(); _inFlight.clear(); }
  bool _sameSubject(String? subject) => !_disposed && subject == _profiles.activeAuthenticatedSubject;
  bool _current(int generation, String id, String? subject) => !_disposed && generation == _generation && _profiles.activeProfile?.id == id && _sameSubject(subject);
  @override void dispose() { _disposed = true; _profiles.removeListener(_onProfileChanged); super.dispose(); }
}
