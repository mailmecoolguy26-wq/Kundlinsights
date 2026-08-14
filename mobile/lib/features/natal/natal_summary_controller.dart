import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../auth/domain/auth_repository.dart';
import '../profiles/profile_controller.dart';
import 'domain/natal_summary.dart';
import 'domain/natal_summary_repository.dart';

enum NatalSummaryLoadState { initial, loading, loaded, refreshing, error }

class NatalSummaryController extends ChangeNotifier {
  NatalSummaryController(this.repository, this._auth, this._profiles) {
    _auth.addListener(_onScopeChanged);
    _profiles.addListener(_onScopeChanged);
    _onScopeChanged();
  }

  final NatalSummaryRepository repository;
  final AuthController _auth;
  final ProfileController _profiles;
  NatalSummaryLoadState _state = NatalSummaryLoadState.initial;
  NatalSummary? _summary;
  Object? _error;
  String? _subject;
  String? _birthProfileId;
  int _generation = 0;
  bool _disposed = false;

  NatalSummaryLoadState get state => _state;
  NatalSummary? get summary => _summary;
  Object? get error => _error;

  void _onScopeChanged() {
    final subject = _auth.state.status == AuthStatus.authenticated
        ? _auth.state.subject
        : null;
    final profileId = subject == null ? null : _profiles.activeProfile?.id;
    if (subject == _subject && profileId == _birthProfileId) return;
    _generation++;
    _subject = subject;
    _birthProfileId = profileId;
    _summary = null;
    _error = null;
    if (subject == null || profileId == null) {
      _state = NatalSummaryLoadState.initial;
      notifyListeners();
      return;
    }
    _state = NatalSummaryLoadState.loading;
    notifyListeners();
    _load(subject, profileId, refreshing: false);
  }

  Future<void> refresh() async {
    final subject = _subject;
    final profileId = _birthProfileId;
    if (subject == null || profileId == null) return;
    _state = NatalSummaryLoadState.refreshing;
    _error = null;
    notifyListeners();
    await _load(subject, profileId, refreshing: true);
  }

  Future<void> _load(
    String subject,
    String profileId, {
    required bool refreshing,
  }) async {
    final generation = _generation;
    try {
      final summary = await repository.getNatalSummary(profileId);
      if (generation != _generation ||
          _disposed ||
          subject != _subject ||
          profileId != _birthProfileId ||
          summary.birthProfileId != profileId) {
        return;
      }
      _summary = summary;
      _state = NatalSummaryLoadState.loaded;
    } catch (error) {
      if (generation != _generation ||
          _disposed ||
          subject != _subject ||
          profileId != _birthProfileId) {
        return;
      }
      _error = error;
      _state = NatalSummaryLoadState.error;
    }
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _generation++;
    _auth.removeListener(_onScopeChanged);
    _profiles.removeListener(_onScopeChanged);
    super.dispose();
  }
}

final natalSummaryRepositoryProvider = Provider<NatalSummaryRepository>(
  (ref) => const UnavailableNatalSummaryRepository(),
);

final natalSummaryControllerProvider =
    Provider.family<
      NatalSummaryController,
      (AuthController, ProfileController)
    >((ref, scope) {
      final controller = NatalSummaryController(
        ref.watch(natalSummaryRepositoryProvider),
        scope.$1,
        scope.$2,
      );
      ref.onDispose(controller.dispose);
      return controller;
    });
