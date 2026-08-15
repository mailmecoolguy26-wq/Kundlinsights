import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../auth/domain/auth_repository.dart';
import '../profiles/profile_controller.dart';
import 'domain/transit_snapshot.dart';
import 'domain/transit_snapshot_repository.dart';

enum TransitSnapshotLoadState { initial, loading, loaded, refreshing, error }

class TransitSnapshotController extends ChangeNotifier {
  TransitSnapshotController(
    this.repository,
    this._auth,
    this._profiles, {
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now {
    _auth.addListener(_onScopeChanged);
    _profiles.addListener(_onScopeChanged);
    _onScopeChanged();
  }
  final TransitSnapshotRepository repository;
  final AuthController _auth;
  final ProfileController _profiles;
  final DateTime Function() _now;
  TransitSnapshotLoadState _state = TransitSnapshotLoadState.initial;
  TransitSnapshot? _snapshot;
  Object? _error;
  String? _subject;
  String? _birthProfileId;
  int _generation = 0;
  bool _disposed = false;
  TransitSnapshotLoadState get state => _state;
  TransitSnapshot? get snapshot => _snapshot;
  Object? get error => _error;
  DateTime get _nowUtc => _now().toUtc();

  void _onScopeChanged() {
    final subject = _auth.state.status == AuthStatus.authenticated
        ? _auth.state.subject
        : null;
    final profileId = subject == null ? null : _profiles.activeProfile?.id;
    if (subject == _subject && profileId == _birthProfileId) return;
    _generation++;
    _subject = subject;
    _birthProfileId = profileId;
    _snapshot = null;
    _error = null;
    if (subject == null || profileId == null) {
      _state = TransitSnapshotLoadState.initial;
      notifyListeners();
      return;
    }
    _state = TransitSnapshotLoadState.loading;
    notifyListeners();
    _load(subject, profileId, _generation);
  }

  Future<void> refresh() async {
    final subject = _subject;
    final profileId = _birthProfileId;
    if (subject == null || profileId == null) return;
    final generation = ++_generation;
    _state = TransitSnapshotLoadState.refreshing;
    _error = null;
    notifyListeners();
    await _load(subject, profileId, generation);
  }

  Future<void> _load(String subject, String profileId, int generation) async {
    try {
      final result = await repository.getTransitSnapshot(
        birthProfileId: profileId,
        atUtc: _nowUtc,
      );
      if (!_isCurrent(generation, subject, profileId) ||
          result.birthProfileId != profileId) {
        return;
      }
      _snapshot = result;
      _state = TransitSnapshotLoadState.loaded;
    } catch (error) {
      if (!_isCurrent(generation, subject, profileId)) return;
      _error = error;
      _state = TransitSnapshotLoadState.error;
    }
    notifyListeners();
  }

  bool _isCurrent(int generation, String subject, String profileId) =>
      !_disposed &&
      generation == _generation &&
      subject == _subject &&
      profileId == _birthProfileId;
  @override
  void dispose() {
    _disposed = true;
    _generation++;
    _auth.removeListener(_onScopeChanged);
    _profiles.removeListener(_onScopeChanged);
    super.dispose();
  }
}

final transitSnapshotRepositoryProvider = Provider<TransitSnapshotRepository>(
  (ref) => const UnavailableTransitSnapshotRepository(),
);
final transitSnapshotControllerProvider =
    Provider.family<
      TransitSnapshotController,
      (AuthController, ProfileController)
    >((ref, scope) {
      final controller = TransitSnapshotController(
        ref.watch(transitSnapshotRepositoryProvider),
        scope.$1,
        scope.$2,
      );
      ref.onDispose(controller.dispose);
      return controller;
    });
