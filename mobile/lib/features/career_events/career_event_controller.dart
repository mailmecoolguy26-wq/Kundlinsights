import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../auth/domain/auth_repository.dart';
import '../profiles/profile_controller.dart';
import 'domain/career_event.dart';
import 'domain/career_event_repository.dart';

enum CareerEventLoadState { initial, loading, loaded, error }

enum CareerEventMutationState { idle, creating, updating, deleting, error }

class CareerEventController extends ChangeNotifier {
  CareerEventController(this.repository, this._auth, this._profiles) {
    _auth.addListener(_onScopeChanged);
    _profiles.addListener(_onScopeChanged);
    _onScopeChanged();
  }

  final CareerEventRepository repository;
  final AuthController _auth;
  final ProfileController _profiles;
  CareerEventLoadState _state = CareerEventLoadState.initial;
  List<CareerEvent> _events = const [];
  Object? _error;
  String? _subject;
  String? _profileId;
  int _generation = 0;
  CareerEventMutationState _mutationState = CareerEventMutationState.idle;
  Object? _mutationError;
  bool _disposed = false;

  CareerEventLoadState get state => _state;
  List<CareerEvent> get events => _events;
  Object? get error => _error;
  CareerEventMutationState get mutationState => _mutationState;
  Object? get mutationError => _mutationError;
  bool get isMutating =>
      _mutationState == CareerEventMutationState.creating ||
      _mutationState == CareerEventMutationState.updating ||
      _mutationState == CareerEventMutationState.deleting;
  int get scopeGeneration => _generation;

  void clearMutationError() {
    if (_mutationState != CareerEventMutationState.error) return;
    _mutationState = CareerEventMutationState.idle;
    _mutationError = null;
    notifyListeners();
  }

  void _onScopeChanged() {
    final subject = _auth.state.status == AuthStatus.authenticated
        ? _auth.state.subject
        : null;
    final profileId = subject == null ? null : _profiles.activeProfile?.id;
    if (subject == _subject && profileId == _profileId) return;
    _generation++;
    _subject = subject;
    _profileId = profileId;
    _events = const [];
    _error = null;
    _mutationState = CareerEventMutationState.idle;
    _mutationError = null;
    if (subject == null || profileId == null) {
      _state = CareerEventLoadState.initial;
      notifyListeners();
      return;
    }
    _state = CareerEventLoadState.loading;
    notifyListeners();
    _load(subject, profileId, _generation);
  }

  Future<void> refresh() async {
    final subject = _subject;
    final profileId = _profileId;
    if (subject == null || profileId == null) return;
    final generation = ++_generation;
    _state = CareerEventLoadState.loading;
    _error = null;
    notifyListeners();
    await _load(subject, profileId, generation);
  }

  Future<void> _load(String subject, String profileId, int generation) async {
    try {
      final events = await repository.listCareerEvents(profileId);
      if (!_current(generation, subject, profileId) ||
          events.any((event) => event.birthProfileId != profileId)) {
        return;
      }
      _events = List.unmodifiable(events);
      _state = CareerEventLoadState.loaded;
    } catch (error) {
      if (!_current(generation, subject, profileId)) return;
      _events = const [];
      _error = error;
      _state = CareerEventLoadState.error;
    }
    notifyListeners();
  }

  Future<bool> create(CareerEventInput input) => _mutate(
    CareerEventMutationState.creating,
    (profileId) => repository.createCareerEvent(profileId, input),
  );

  Future<bool> update(String eventId, CareerEventInput input) => _mutate(
    CareerEventMutationState.updating,
    (profileId) => repository.updateCareerEvent(profileId, eventId, input),
  );

  Future<bool> delete(String eventId) => _mutate(
    CareerEventMutationState.deleting,
    (profileId) => repository.deleteCareerEvent(profileId, eventId),
  );

  Future<bool> _mutate(
    CareerEventMutationState mutationState,
    Future<CareerEvent> Function(String profileId) operation,
  ) async {
    final subject = _subject;
    final profileId = _profileId;
    if (subject == null || profileId == null || isMutating) return false;
    final generation = _generation;
    _mutationState = mutationState;
    _mutationError = null;
    notifyListeners();
    try {
      await operation(profileId);
      if (!_current(generation, subject, profileId)) return false;
      await _load(subject, profileId, generation);
      return _current(generation, subject, profileId);
    } catch (error) {
      if (_current(generation, subject, profileId)) {
        _mutationError = error;
        _mutationState = CareerEventMutationState.error;
        notifyListeners();
      }
      return false;
    } finally {
      if (_current(generation, subject, profileId)) {
        if (_mutationState != CareerEventMutationState.error) {
          _mutationState = CareerEventMutationState.idle;
        }
        notifyListeners();
      }
    }
  }

  bool _current(int generation, String subject, String profileId) =>
      !_disposed &&
      generation == _generation &&
      subject == _subject &&
      profileId == _profileId;

  @override
  void dispose() {
    _disposed = true;
    _generation++;
    _auth.removeListener(_onScopeChanged);
    _profiles.removeListener(_onScopeChanged);
    super.dispose();
  }
}

final careerEventRepositoryProvider = Provider<CareerEventRepository>(
  (ref) => const UnavailableCareerEventRepository(),
);

final careerEventControllerProvider =
    Provider.family<CareerEventController, (AuthController, ProfileController)>(
      (ref, scope) {
        final controller = CareerEventController(
          ref.watch(careerEventRepositoryProvider),
          scope.$1,
          scope.$2,
        );
        ref.onDispose(controller.dispose);
        return controller;
      },
    );
