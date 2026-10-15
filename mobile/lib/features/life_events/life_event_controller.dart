import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../auth/domain/auth_repository.dart';
import '../profiles/profile_controller.dart';
import 'domain/life_event.dart';
import 'domain/life_event_repository.dart';

class LifeEventController extends ChangeNotifier {
  LifeEventController(this.repository, this.auth, this.profiles) {
    auth.addListener(_scope);
    profiles.addListener(_scope);
    _scope();
  }

  final LifeEventRepository repository;
  final AuthController auth;
  final ProfileController profiles;

  List<LifeEvent> events = const [];
  bool loading = false;
  Object? error;
  String? _profileId;
  String? _subject;
  int _generation = 0;
  bool _disposed = false;

  void _scope() {
    final subject = auth.state.status == AuthStatus.authenticated
        ? auth.state.subject
        : null;
    final profileId = subject == null ? null : profiles.activeProfile?.id;
    if (subject == _subject && profileId == _profileId) return;

    _subject = subject;
    _profileId = profileId;
    events = const [];
    error = null;
    _generation++;
    if (profileId == null) {
      _notify();
      return;
    }
    refresh();
  }

  Future<void> refresh() async {
    final profileId = _profileId;
    final subject = _subject;
    final generation = ++_generation;
    if (profileId == null || subject == null || _disposed) return;

    loading = true;
    _notify();
    try {
      final result = await repository.list(profileId);
      if (!_isCurrent(generation, profileId, subject)) return;
      events = result;
    } catch (exception) {
      if (_isCurrent(generation, profileId, subject)) error = exception;
    } finally {
      if (_isCurrent(generation, profileId, subject)) {
        loading = false;
        _notify();
      }
    }
  }

  Future<bool> save(LifeEventInput input, {LifeEvent? editing}) async {
    final profileId = _profileId;
    if (profileId == null || _disposed) return false;
    try {
      if (editing == null) {
        await repository.create(profileId, input);
      } else {
        await repository.update(profileId, editing.id, input);
      }
      await refresh();
      return !_disposed;
    } catch (exception) {
      if (!_disposed) {
        error = exception;
        _notify();
      }
      return false;
    }
  }

  Future<void> remove(LifeEvent event) async {
    final profileId = _profileId;
    if (profileId == null || _disposed) return;
    await repository.delete(profileId, event.id);
    await refresh();
  }

  bool _isCurrent(int generation, String profileId, String subject) {
    return !_disposed &&
        generation == _generation &&
        profileId == _profileId &&
        subject == _subject;
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    auth.removeListener(_scope);
    profiles.removeListener(_scope);
    super.dispose();
  }
}

final lifeEventRepositoryProvider = Provider<LifeEventRepository>(
  (_) => const UnavailableLifeEventRepository(),
);

final lifeEventControllerProvider =
    Provider.family<LifeEventController, (AuthController, ProfileController)>((
      ref,
      scope,
    ) {
      final controller = LifeEventController(
        ref.watch(lifeEventRepositoryProvider),
        scope.$1,
        scope.$2,
      );
      ref.onDispose(controller.dispose);
      return controller;
    });
