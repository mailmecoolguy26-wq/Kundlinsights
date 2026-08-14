import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../auth/domain/auth_repository.dart';
import '../profiles/profile_controller.dart';
import 'domain/divisional_chart.dart';
import 'domain/divisional_chart_repository.dart';

enum DivisionalChartLoadState { initial, loading, loaded, refreshing, error }

class DivisionalChartController extends ChangeNotifier {
  DivisionalChartController(this.repository, this._auth, this._profiles) {
    _auth.addListener(_onScopeChanged);
    _profiles.addListener(_onScopeChanged);
    _onScopeChanged();
  }

  final DivisionalChartRepository repository;
  final AuthController _auth;
  final ProfileController _profiles;
  final Map<DivisionalChartType, DivisionalChart> _charts = {};
  final Map<DivisionalChartType, DivisionalChartLoadState> _states = {};
  final Map<DivisionalChartType, Object?> _errors = {};
  String? _subject;
  String? _birthProfileId;
  int _generation = 0;
  bool _disposed = false;

  DivisionalChart? chart(DivisionalChartType type) => _charts[type];
  DivisionalChartLoadState state(DivisionalChartType type) =>
      _states[type] ?? DivisionalChartLoadState.initial;
  Object? error(DivisionalChartType type) => _errors[type];

  void _onScopeChanged() {
    final subject = _auth.state.status == AuthStatus.authenticated
        ? _auth.state.subject
        : null;
    final profileId = subject == null ? null : _profiles.activeProfile?.id;
    if (subject == _subject && profileId == _birthProfileId) return;
    _generation++;
    _subject = subject;
    _birthProfileId = profileId;
    _charts.clear();
    _states.clear();
    _errors.clear();
    notifyListeners();
  }

  Future<void> load(DivisionalChartType type, {bool refresh = false}) async {
    final subject = _subject;
    final profileId = _birthProfileId;
    if (subject == null || profileId == null) return;
    if (!refresh && _charts.containsKey(type)) return;
    _states[type] = refresh
        ? DivisionalChartLoadState.refreshing
        : DivisionalChartLoadState.loading;
    _errors.remove(type);
    notifyListeners();
    final generation = _generation;
    try {
      final chart = await repository.getChart(
        birthProfileId: profileId,
        type: type,
      );
      if (_discard(generation, subject, profileId) ||
          chart.birthProfileId != profileId ||
          chart.type != type) {
        return;
      }
      _charts[type] = chart;
      _states[type] = DivisionalChartLoadState.loaded;
    } catch (error) {
      if (_discard(generation, subject, profileId)) return;
      _errors[type] = error;
      _states[type] = DivisionalChartLoadState.error;
    }
    notifyListeners();
  }

  bool _discard(int generation, String subject, String profileId) =>
      _disposed ||
      generation != _generation ||
      subject != _subject ||
      profileId != _birthProfileId;

  @override
  void dispose() {
    _disposed = true;
    _generation++;
    _auth.removeListener(_onScopeChanged);
    _profiles.removeListener(_onScopeChanged);
    super.dispose();
  }
}

final divisionalChartRepositoryProvider = Provider<DivisionalChartRepository>(
  (ref) => const UnavailableDivisionalChartRepository(),
);

final divisionalChartControllerProvider =
    Provider.family<
      DivisionalChartController,
      (AuthController, ProfileController)
    >((ref, scope) {
      final controller = DivisionalChartController(
        ref.watch(divisionalChartRepositoryProvider),
        scope.$1,
        scope.$2,
      );
      ref.onDispose(controller.dispose);
      return controller;
    });
