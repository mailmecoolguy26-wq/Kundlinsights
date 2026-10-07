import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../profiles/profile_controller.dart';
import 'domain/career_answer.dart';
import 'domain/career_answer_repository.dart';

enum CareerAnswerLoadState { initial, loading, loaded, error }

final careerAnswerRepositoryProvider = Provider<CareerAnswerRepository>(
  (ref) => const UnavailableCareerAnswerRepository(),
);

final careerAnswerControllerProvider = Provider.family<CareerAnswerController,
    ProfileController>((ref, profiles) {
  final controller = CareerAnswerController(
    ref.watch(careerAnswerRepositoryProvider),
    profiles,
  );
  ref.onDispose(controller.dispose);
  return controller;
});

class CareerAnswerController extends ChangeNotifier {
  CareerAnswerController(this._repository, this._profiles) {
    _profiles.addListener(_onProfileChanged);
  }

  final CareerAnswerRepository _repository;
  final ProfileController _profiles;
  CareerAnswerLoadState _state = CareerAnswerLoadState.initial;
  CareerAnswer? _answer;
  Object? _error;
  String? _profileId;
  int _generation = 0;
  bool _disposed = false;

  CareerAnswerLoadState get state => _state;
  CareerAnswer? get answer => _answer;
  Object? get error => _error;

  Future<void> load(CareerQuestionType questionType) async {
    final profileId = _profiles.activeProfile?.id;
    if (profileId == null || profileId.isEmpty) return;
    final generation = ++_generation;
    _profileId = profileId;
    _state = CareerAnswerLoadState.loading;
    _answer = null;
    _error = null;
    notifyListeners();
    try {
      final result = await _repository.getAnswer(
        birthProfileId: profileId,
        questionType: questionType,
      );
      if (!_current(generation, profileId)) return;
      _answer = result;
      _state = CareerAnswerLoadState.loaded;
    } catch (error) {
      if (!_current(generation, profileId)) return;
      _error = error;
      _state = CareerAnswerLoadState.error;
    }
    notifyListeners();
  }

  void _onProfileChanged() {
    final id = _profiles.activeProfile?.id;
    if (id == _profileId) return;
    _generation++;
    _profileId = id;
    _state = CareerAnswerLoadState.initial;
    _answer = null;
    _error = null;
    notifyListeners();
  }

  bool _current(int generation, String profileId) =>
      !_disposed && generation == _generation && _profiles.activeProfile?.id == profileId;

  @override
  void dispose() {
    _disposed = true;
    _generation++;
    _profiles.removeListener(_onProfileChanged);
    super.dispose();
  }
}
