import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../profiles/profile_controller.dart';
import 'career_decision_controller.dart';
import 'domain/career_decision.dart';

final careerDecisionHistoryControllerProvider =
    Provider.family<CareerDecisionHistoryController, ProfileController>((
      ref,
      profiles,
    ) {
      final value = CareerDecisionHistoryController(
        ref.watch(careerDecisionRepositoryProvider),
        profiles,
      );
      ref.onDispose(value.dispose);
      return value;
    });

enum CareerDecisionHistoryState { initial, loading, loaded, error }

/// Owns only saved-decision list/detail state. It never calls the generation
/// endpoint, so reopening a saved analysis cannot regenerate it.
class CareerDecisionHistoryController extends ChangeNotifier {
  CareerDecisionHistoryController(this._repository, this._profiles) {
    _profiles.addListener(_onProfileChanged);
  }

  final CareerDecisionRepository _repository;
  final ProfileController _profiles;
  CareerDecisionHistoryState listState = CareerDecisionHistoryState.initial;
  CareerDecisionHistoryState detailState = CareerDecisionHistoryState.initial;
  List<CareerDecisionSummary> decisions = const [];
  CareerDecision? selectedDecision;
  Object? listError;
  Object? detailError;
  String? _profileId;
  String? _selectedId;
  var _disposed = false;

  void _onProfileChanged() {
    if (_disposed) return;
    final next = _profiles.activeProfile?.id;
    if (next == _profileId) return;
    _profileId = next;
    decisions = const [];
    selectedDecision = null;
    _selectedId = null;
    listState = CareerDecisionHistoryState.initial;
    detailState = CareerDecisionHistoryState.initial;
    listError = null;
    detailError = null;
    notifyListeners();
    if (next != null) load();
  }

  Future<void> load() async {
    if (_disposed) return;
    final id = _profiles.activeProfile?.id;
    if (id == null || listState == CareerDecisionHistoryState.loading) return;
    _profileId = id;
    listState = CareerDecisionHistoryState.loading;
    listError = null;
    notifyListeners();
    try {
      final items = await _repository.listDecisions(birthProfileId: id);
      if (_disposed || _profiles.activeProfile?.id != id) return;
      decisions = List.unmodifiable(items);
      listState = CareerDecisionHistoryState.loaded;
    } catch (error) {
      if (_disposed || _profiles.activeProfile?.id != id) return;
      listError = error;
      listState = CareerDecisionHistoryState.error;
    }
    notifyListeners();
  }

  Future<void> refreshAfterCreate() async => load();

  Future<void> open(String decisionId) async {
    if (_disposed) return;
    final profileId = _profiles.activeProfile?.id;
    if (profileId == null ||
        detailState == CareerDecisionHistoryState.loading) {
      return;
    }
    _profileId = profileId;
    _selectedId = decisionId;
    selectedDecision = null;
    detailState = CareerDecisionHistoryState.loading;
    detailError = null;
    notifyListeners();
    try {
      final detail = await _repository.getDecision(
        birthProfileId: profileId,
        decisionId: decisionId,
      );
      if (_disposed ||
          _profiles.activeProfile?.id != profileId ||
          _selectedId != decisionId) {
        return;
      }
      selectedDecision = detail;
      detailState = CareerDecisionHistoryState.loaded;
    } catch (error) {
      if (_disposed ||
          _profiles.activeProfile?.id != profileId ||
          _selectedId != decisionId) {
        return;
      }
      detailError = error;
      detailState = CareerDecisionHistoryState.error;
    }
    notifyListeners();
  }

  Future<void> retryDetail() async {
    final id = _selectedId;
    if (id != null) await open(id);
  }

  @override
  void dispose() {
    _disposed = true;
    _profiles.removeListener(_onProfileChanged);
    super.dispose();
  }
}
