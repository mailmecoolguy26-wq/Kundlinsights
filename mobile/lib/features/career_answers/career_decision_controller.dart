import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../profiles/profile_controller.dart';
import 'domain/career_decision.dart';

abstract interface class CareerDecisionRepository {
  Future<CareerDecision> submit({
    required String birthProfileId,
    required String decisionType,
    required Map<String, Object?> context,
  });
}

final careerDecisionRepositoryProvider = Provider<CareerDecisionRepository>(
  (_) => const UnavailableCareerDecisionRepository(),
);

class UnavailableCareerDecisionRepository implements CareerDecisionRepository {
  const UnavailableCareerDecisionRepository();
  @override
  Future<CareerDecision> submit({
    required String birthProfileId,
    required String decisionType,
    required Map<String, Object?> context,
  }) => Future.error(StateError('Career Decision Support is unavailable.'));
}

final careerDecisionControllerProvider =
    Provider.family<CareerDecisionController, ProfileController>((
      ref,
      profiles,
    ) {
      final value = CareerDecisionController(
        ref.watch(careerDecisionRepositoryProvider),
        profiles,
      );
      ref.onDispose(value.dispose);
      return value;
    });

enum CareerDecisionLoadState { initial, loading, loaded, error }

class CareerDecisionController extends ChangeNotifier {
  CareerDecisionController(this._repository, this._profiles);
  final CareerDecisionRepository _repository;
  final ProfileController _profiles;
  CareerDecisionLoadState state = CareerDecisionLoadState.initial;
  CareerDecision? decision;
  Object? error;
  void reset() {
    state = CareerDecisionLoadState.initial;
    decision = null;
    error = null;
    notifyListeners();
  }

  Future<void> submit({
    required String decisionType,
    required Map<String, Object?> context,
  }) async {
    if (state == CareerDecisionLoadState.loading) {
      return;
    }
    final id = _profiles.activeProfile?.id;
    if (id == null) return;
    state = CareerDecisionLoadState.loading;
    error = null;
    notifyListeners();
    try {
      decision = await _repository.submit(
        birthProfileId: id,
        decisionType: decisionType,
        context: context,
      );
      state = CareerDecisionLoadState.loaded;
    } catch (e) {
      error = e;
      state = CareerDecisionLoadState.error;
    }
    notifyListeners();
  }
}
