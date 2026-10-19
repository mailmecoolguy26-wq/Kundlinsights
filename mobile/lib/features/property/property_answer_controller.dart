import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../profiles/profile_controller.dart';
import 'domain/property_answer.dart';
import 'domain/property_answer_repository.dart';

enum PropertyAnswerLoadState { initial, loading, loaded, error }

final propertyAnswerRepositoryProvider = Provider<PropertyAnswerRepository>(
  (ref) => const UnavailablePropertyAnswerRepository(),
);

final propertyAnswerControllerProvider =
    Provider.family<PropertyAnswerController, ProfileController>((
      ref,
      profiles,
    ) {
      final controller = PropertyAnswerController(
        ref.watch(propertyAnswerRepositoryProvider),
        profiles,
      );
      ref.onDispose(controller.dispose);
      return controller;
    });

class PropertyAnswerController extends ChangeNotifier {
  PropertyAnswerController(this._repository, this._profiles) {
    _profiles.addListener(_onProfileChanged);
  }

  final PropertyAnswerRepository _repository;
  final ProfileController _profiles;
  PropertyAnswerLoadState _state = PropertyAnswerLoadState.initial;
  PropertyAnswer? _answer;
  Object? _error;
  String? _profileId;
  int _generation = 0;
  bool _disposed = false;

  PropertyAnswerLoadState get state => _state;
  PropertyAnswer? get answer => _answer;
  Object? get error => _error;

  Future<void> load() async {
    final profileId = _profiles.activeProfile?.id;
    if (profileId == null || profileId.isEmpty) return;
    final generation = ++_generation;
    _profileId = profileId;
    _state = PropertyAnswerLoadState.loading;
    _answer = null;
    _error = null;
    notifyListeners();
    try {
      final answer = await _repository.getAnswer(
        birthProfileId: profileId,
        intent: PropertyIntent.purchaseTiming,
      );
      if (!_isCurrent(generation, profileId)) return;
      _answer = answer;
      _state = PropertyAnswerLoadState.loaded;
    } catch (error) {
      if (!_isCurrent(generation, profileId)) return;
      _error = error;
      _state = PropertyAnswerLoadState.error;
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
    _state = PropertyAnswerLoadState.initial;
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
