import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../auth/domain/auth_repository.dart';
import '../profiles/profile_controller.dart';
import 'domain/ashtakavarga.dart';
import 'domain/ashtakavarga_repository.dart';

enum AshtakavargaLoadState { loading, loaded, error }

class AshtakavargaController extends ChangeNotifier {
  AshtakavargaController(this._repository, this._auth, this._profiles) {
    _auth.addListener(_onScopeChanged);
    _profiles.addListener(_onScopeChanged);
    _onScopeChanged();
  }

  final AshtakavargaRepository _repository;
  final AuthController _auth;
  final ProfileController _profiles;
  AshtakavargaLoadState _state = AshtakavargaLoadState.loading;
  Ashtakavarga? _data;
  String? _subject;
  String? _birthProfileId;
  int _generation = 0;
  bool _disposed = false;

  AshtakavargaLoadState get state => _state;
  Ashtakavarga? get data => _data;

  void refresh() => _loadCurrentScope(force: true);

  void _onScopeChanged() => _loadCurrentScope();

  void _loadCurrentScope({bool force = false}) {
    final subject = _auth.state.status == AuthStatus.authenticated
        ? _auth.state.subject
        : null;
    final birthProfileId = subject == null ? null : _profiles.activeProfile?.id;
    if (!force && subject == _subject && birthProfileId == _birthProfileId) {
      return;
    }

    _subject = subject;
    _birthProfileId = birthProfileId;
    _data = null;
    final generation = ++_generation;
    _state = AshtakavargaLoadState.loading;
    notifyListeners();
    if (subject == null || birthProfileId == null) return;

    _repository
        .getAshtakavarga(birthProfileId: birthProfileId)
        .then((value) {
          if (_isCurrent(generation, subject, birthProfileId)) {
            _data = value;
            _state = AshtakavargaLoadState.loaded;
            notifyListeners();
          }
        })
        .catchError((_) {
          if (_isCurrent(generation, subject, birthProfileId)) {
            _data = null;
            _state = AshtakavargaLoadState.error;
            notifyListeners();
          }
        });
  }

  bool _isCurrent(int generation, String subject, String birthProfileId) =>
      !_disposed &&
      generation == _generation &&
      subject == _subject &&
      birthProfileId == _birthProfileId;

  @override
  void dispose() {
    _disposed = true;
    _generation++;
    _auth.removeListener(_onScopeChanged);
    _profiles.removeListener(_onScopeChanged);
    super.dispose();
  }
}

final ashtakavargaRepositoryProvider = Provider<AshtakavargaRepository>((ref) {
  throw UnimplementedError(
    'AshtakavargaRepository must be provided by application bootstrap.',
  );
});

final ashtakavargaControllerProvider =
    Provider.family<
      AshtakavargaController,
      (AuthController, ProfileController)
    >((ref, scope) {
      final controller = AshtakavargaController(
        ref.watch(ashtakavargaRepositoryProvider),
        scope.$1,
        scope.$2,
      );
      ref.onDispose(controller.dispose);
      return controller;
    });
