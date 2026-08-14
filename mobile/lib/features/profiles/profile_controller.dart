import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../auth/domain/auth_repository.dart';
import 'domain/birth_profile.dart';
import 'domain/birth_profile_repository.dart';

enum ProfileLoadState { loading, ready, error }

class ProfileController extends ChangeNotifier {
  ProfileController(this.repository, this._auth) {
    _auth.addListener(_onAuthChanged);
    _onAuthChanged();
  }

  final BirthProfileRepository repository;
  final AuthController _auth;
  ProfileLoadState _state = ProfileLoadState.loading;
  List<BirthProfile> _profiles = const [];
  BirthProfile? _activeProfile;
  String? _subject;
  int _loadGeneration = 0;

  ProfileLoadState get state => _state;
  List<BirthProfile> get profiles => _profiles;
  BirthProfile? get activeProfile => _activeProfile;
  bool get isEmpty => _state == ProfileLoadState.ready && _profiles.isEmpty;

  Future<void> load() async {
    final subject = _auth.state.subject;
    if (_auth.state.status != AuthStatus.authenticated || subject == null) {
      return;
    }
    _subject = subject;
    await _loadForSubject(subject);
  }

  Future<void> _loadForSubject(String subject) async {
    final generation = ++_loadGeneration;
    _state = ProfileLoadState.loading;
    notifyListeners();
    try {
      final next = await repository.list();
      if (generation != _loadGeneration || _subject != subject) return;
      _profiles = List.unmodifiable(next);
      _activeProfile ??= _profiles.isEmpty ? null : _profiles.first;
      if (_activeProfile != null &&
          !_profiles.any((profile) => profile.id == _activeProfile!.id)) {
        _activeProfile = _profiles.firstOrNull;
      }
      _state = ProfileLoadState.ready;
    } catch (_) {
      if (generation != _loadGeneration || _subject != subject) return;
      _profiles = const [];
      _activeProfile = null;
      _state = ProfileLoadState.error;
    }
    notifyListeners();
  }

  Future<BirthProfile> create({
    required String? displayLabel,
    required ResolvedBirthData birthData,
  }) async {
    final subject = _subject;
    final generation = _loadGeneration;
    if (subject == null) {
      throw StateError('An authenticated subject is required.');
    }
    final created = await repository.create(
      displayLabel: displayLabel,
      birthData: birthData,
    );
    if (subject != _subject || generation != _loadGeneration) {
      throw StateError(
        'Authenticated identity changed during profile creation.',
      );
    }
    _profiles = List.unmodifiable([..._profiles, created]);
    _activeProfile = created;
    _state = ProfileLoadState.ready;
    notifyListeners();
    return created;
  }

  void select(BirthProfile profile) {
    if (!_profiles.any((item) => item.id == profile.id)) return;
    _activeProfile = profile;
    notifyListeners();
  }

  void _onAuthChanged() {
    final snapshot = _auth.state;
    final subject = snapshot.subject;
    if (snapshot.status == AuthStatus.authenticated && subject != null) {
      if (_subject == subject) return;
      _clearForIdentityChange();
      _subject = subject;
      _loadForSubject(subject);
      return;
    }
    _clearForIdentityChange();
  }

  void _clearForIdentityChange() {
    _loadGeneration++;
    _subject = null;
    _profiles = const [];
    _activeProfile = null;
    _state = ProfileLoadState.loading;
    notifyListeners();
  }

  @override
  void dispose() {
    _auth.removeListener(_onAuthChanged);
    super.dispose();
  }
}

final birthProfileRepositoryProvider = Provider<BirthProfileRepository>((ref) {
  throw UnimplementedError(
    'BirthProfileRepository must be provided by bootstrap.',
  );
});

final profileControllerProvider =
    Provider.family<ProfileController, AuthController>((ref, auth) {
      final controller = ProfileController(
        ref.watch(birthProfileRepositoryProvider),
        auth,
      );
      ref.onDispose(controller.dispose);
      return controller;
    });
