import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../profiles/profile_controller.dart';
import 'domain/vehicle_answer.dart';
import 'domain/vehicle_answer_repository.dart';

enum VehicleAnswerLoadState { initial, loading, loaded, error }

final vehicleAnswerRepositoryProvider = Provider<VehicleAnswerRepository>(
  (ref) => const UnavailableVehicleAnswerRepository(),
);

final vehicleAnswerControllerProvider =
    Provider.family<VehicleAnswerController, ProfileController>((
      ref,
      profiles,
    ) {
      final controller = VehicleAnswerController(
        ref.watch(vehicleAnswerRepositoryProvider),
        profiles,
      );
      ref.onDispose(controller.dispose);
      return controller;
    });

class VehicleAnswerController extends ChangeNotifier {
  VehicleAnswerController(this._repository, this._profiles) {
    _profiles.addListener(_onProfileChanged);
  }
  final VehicleAnswerRepository _repository;
  final ProfileController _profiles;
  VehicleAnswerLoadState _state = VehicleAnswerLoadState.initial;
  VehicleAnswer? _answer;
  Object? _error;
  String? _profileId;
  int _generation = 0;
  bool _disposed = false;
  VehicleAnswerLoadState get state => _state;
  VehicleAnswer? get answer => _answer;
  Object? get error => _error;

  Future<void> load() async {
    final profileId = _profiles.activeProfile?.id;
    if (profileId == null || profileId.isEmpty) return;
    final generation = ++_generation;
    _profileId = profileId;
    _state = VehicleAnswerLoadState.loading;
    _answer = null;
    _error = null;
    notifyListeners();
    try {
      final answer = await _repository.getAnswer(
        birthProfileId: profileId,
        intent: VehicleIntent.purchaseTiming,
      );
      if (!_isCurrent(generation, profileId)) return;
      _answer = answer;
      _state = VehicleAnswerLoadState.loaded;
    } catch (error) {
      if (!_isCurrent(generation, profileId)) return;
      _error = error;
      _state = VehicleAnswerLoadState.error;
    }
    notifyListeners();
  }

  void _onProfileChanged() {
    final id = _profiles.activeProfile?.id;
    if (id == _profileId) return;
    _generation++;
    _profileId = id;
    _answer = null;
    _error = null;
    _state = VehicleAnswerLoadState.initial;
    notifyListeners();
    if (id != null && id.isNotEmpty) unawaited(load());
  }

  bool _isCurrent(int generation, String profileId) =>
      !_disposed &&
      generation == _generation &&
      _profiles.activeProfile?.id == profileId;
  @override
  void dispose() {
    _disposed = true;
    _profiles.removeListener(_onProfileChanged);
    super.dispose();
  }
}
