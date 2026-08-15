import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../auth/domain/auth_repository.dart';
import '../profiles/profile_controller.dart';
import 'domain/vimshottari.dart';
import 'domain/vimshottari_repository.dart';

enum VimshottariLoadState { initial, loading, loaded, refreshing, error }

class VimshottariController extends ChangeNotifier {
  VimshottariController(
    this.repository,
    this._auth,
    this._profiles, {
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now {
    _auth.addListener(_onScopeChanged);
    _profiles.addListener(_onScopeChanged);
    _onScopeChanged();
  }

  static const int maxWindowDays = 1827;
  static const List<int> allowedWindowDays = [365, 1095, 1825];

  final VimshottariRepository repository;
  final AuthController _auth;
  final ProfileController _profiles;
  final DateTime Function() _now;
  VimshottariLoadState _currentState = VimshottariLoadState.initial;
  VimshottariLoadState _timelineState = VimshottariLoadState.initial;
  VimshottariCurrent? _current;
  VimshottariTimeline? _timeline;
  Object? _currentError;
  Object? _timelineError;
  String? _subject;
  String? _birthProfileId;
  VimshottariLevel _timelineLevel = VimshottariLevel.md;
  int _timelineWindowDays = allowedWindowDays.last;
  bool _timelineRequested = false;
  int _currentGeneration = 0;
  int _timelineGeneration = 0;
  bool _disposed = false;

  VimshottariLoadState get currentState => _currentState;
  VimshottariLoadState get timelineState => _timelineState;
  VimshottariCurrent? get current => _current;
  VimshottariTimeline? get timeline => _timeline;
  Object? get currentError => _currentError;
  Object? get timelineError => _timelineError;
  VimshottariLevel get timelineLevel => _timelineLevel;
  int get timelineWindowDays => _timelineWindowDays;

  DateTime get _nowUtc => _now().toUtc();

  void _onScopeChanged() {
    final subject = _auth.state.status == AuthStatus.authenticated
        ? _auth.state.subject
        : null;
    final profileId = subject == null ? null : _profiles.activeProfile?.id;
    if (subject == _subject && profileId == _birthProfileId) return;
    _currentGeneration++;
    _timelineGeneration++;
    _subject = subject;
    _birthProfileId = profileId;
    _current = null;
    _timeline = null;
    _currentError = null;
    _timelineError = null;
    if (subject == null || profileId == null) {
      _currentState = VimshottariLoadState.initial;
      _timelineState = VimshottariLoadState.initial;
      notifyListeners();
      return;
    }
    _currentState = VimshottariLoadState.loading;
    _timelineState = _timelineRequested
        ? VimshottariLoadState.loading
        : VimshottariLoadState.initial;
    notifyListeners();
    _loadCurrent(subject, profileId, refreshing: false);
    if (_timelineRequested) _loadTimeline(subject, profileId);
  }

  Future<void> refreshCurrent() async {
    final subject = _subject;
    final profileId = _birthProfileId;
    if (subject == null || profileId == null) return;
    _currentState = VimshottariLoadState.refreshing;
    _currentError = null;
    notifyListeners();
    await _loadCurrent(subject, profileId, refreshing: true);
  }

  Future<void> loadTimeline({VimshottariLevel? level, int? windowDays}) async {
    final resolvedLevel = level ?? _timelineLevel;
    final resolvedWindow = windowDays ?? _timelineWindowDays;
    if (resolvedWindow <= 0 || resolvedWindow > maxWindowDays) {
      _timeline = null;
      _timelineError = ArgumentError.value(
        resolvedWindow,
        'windowDays',
        'Timeline window exceeds the backend limit.',
      );
      _timelineState = VimshottariLoadState.error;
      notifyListeners();
      return;
    }
    _timelineRequested = true;
    _timelineLevel = resolvedLevel;
    _timelineWindowDays = resolvedWindow;
    final subject = _subject;
    final profileId = _birthProfileId;
    _timelineGeneration++;
    _timeline = null;
    _timelineError = null;
    if (subject == null || profileId == null) {
      _timelineState = VimshottariLoadState.initial;
      notifyListeners();
      return;
    }
    _timelineState = VimshottariLoadState.loading;
    notifyListeners();
    await _loadTimeline(subject, profileId);
  }

  Future<void> _loadCurrent(
    String subject,
    String profileId, {
    required bool refreshing,
  }) async {
    final generation = _currentGeneration;
    try {
      final result = await repository.getCurrent(
        birthProfileId: profileId,
        atUtc: _nowUtc,
      );
      if (!_isCurrentRequest(generation, subject, profileId) ||
          result.birthProfileId != profileId) {
        return;
      }
      _current = result;
      _currentState = VimshottariLoadState.loaded;
    } catch (error) {
      if (!_isCurrentRequest(generation, subject, profileId)) return;
      _currentError = error;
      _currentState = VimshottariLoadState.error;
    }
    notifyListeners();
  }

  Future<void> _loadTimeline(String subject, String profileId) async {
    final generation = _timelineGeneration;
    final from = _nowUtc;
    final to = from.add(Duration(days: _timelineWindowDays));
    final level = _timelineLevel;
    try {
      final result = await repository.getTimeline(
        birthProfileId: profileId,
        fromUtc: from,
        toUtc: to,
        level: level,
      );
      if (!_isTimelineRequest(generation, subject, profileId) ||
          result.birthProfileId != profileId ||
          result.level != level) {
        return;
      }
      _timeline = result;
      _timelineState = VimshottariLoadState.loaded;
    } catch (error) {
      if (!_isTimelineRequest(generation, subject, profileId)) return;
      _timelineError = error;
      _timelineState = VimshottariLoadState.error;
    }
    notifyListeners();
  }

  bool _isCurrentRequest(int generation, String subject, String profileId) =>
      !_disposed &&
      generation == _currentGeneration &&
      subject == _subject &&
      profileId == _birthProfileId;
  bool _isTimelineRequest(int generation, String subject, String profileId) =>
      !_disposed &&
      generation == _timelineGeneration &&
      subject == _subject &&
      profileId == _birthProfileId;

  @override
  void dispose() {
    _disposed = true;
    _currentGeneration++;
    _timelineGeneration++;
    _auth.removeListener(_onScopeChanged);
    _profiles.removeListener(_onScopeChanged);
    super.dispose();
  }
}

final vimshottariRepositoryProvider = Provider<VimshottariRepository>(
  (ref) => const UnavailableVimshottariRepository(),
);

final vimshottariControllerProvider =
    Provider.family<VimshottariController, (AuthController, ProfileController)>(
      (ref, scope) {
        final controller = VimshottariController(
          ref.watch(vimshottariRepositoryProvider),
          scope.$1,
          scope.$2,
        );
        ref.onDispose(controller.dispose);
        return controller;
      },
    );
