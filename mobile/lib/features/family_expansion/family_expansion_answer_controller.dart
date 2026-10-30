import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../profiles/profile_controller.dart';
import 'family_expansion_answer.dart';
import 'family_expansion_answer_repository.dart';
enum FamilyExpansionLoadState { initial, loading, loaded, error }
final familyExpansionAnswerRepositoryProvider = Provider<FamilyExpansionAnswerRepository>((ref) => const UnavailableFamilyExpansionAnswerRepository());
final familyExpansionAnswerControllerProvider = Provider.family<FamilyExpansionAnswerController, ProfileController>((ref, profiles) { final controller = FamilyExpansionAnswerController(ref.watch(familyExpansionAnswerRepositoryProvider), profiles); ref.onDispose(controller.dispose); return controller; });
class FamilyExpansionAnswerController extends ChangeNotifier {
  FamilyExpansionAnswerController(this._repository, this._profiles) { _profiles.addListener(_changed); }
  final FamilyExpansionAnswerRepository _repository; final ProfileController _profiles; final Map<String, FamilyExpansionAnswer> _cache = {}; final Map<String, Future<void>> _inFlight = {}; FamilyExpansionLoadState _state = FamilyExpansionLoadState.initial; FamilyExpansionAnswer? _answer; Object? _error; String? _profile; String? _subject; int _generation = 0; bool _disposed = false;
  FamilyExpansionLoadState get state => _state; FamilyExpansionAnswer? get answer => _answer; Object? get error => _error;
  Future<void> load({bool force = false}) { _sync(); final profile = _profiles.activeProfile?.id; if (profile == null || profile.isEmpty) return Future.value(); final cached = _cache[profile]; if (!force && cached != null && !cached.premiumRequired) { _profile = profile; _answer = cached; _error = null; _state = FamilyExpansionLoadState.loaded; notifyListeners(); return Future.value(); } if (_inFlight[profile] case final current?) return current; final generation = ++_generation, subject = _subject; _profile = profile; _answer = cached; _error = null; _state = cached == null ? FamilyExpansionLoadState.loading : FamilyExpansionLoadState.loaded; notifyListeners(); final future = _fetch(profile, subject, generation, cached); _inFlight[profile] = future; return future; }
  Future<void> _fetch(String profile, String? subject, int generation, FamilyExpansionAnswer? cached) async { try { final answer = await _repository.getAnswer(birthProfileId: profile, intent: FamilyExpansionIntent.outlook); if (_same(subject)) { if (answer.premiumRequired) { _cache.remove(profile); } else { _cache[profile] = answer; } } if (!_current(generation, profile, subject)) return; _answer = answer; _state = FamilyExpansionLoadState.loaded; } catch (error) { if (!_current(generation, profile, subject)) return; _error = error; _answer = cached; _state = cached == null ? FamilyExpansionLoadState.error : FamilyExpansionLoadState.loaded; } finally { _inFlight.remove(profile); if (_current(generation, profile, subject)) { notifyListeners(); } } }
  void invalidateProfile(String profile) { _cache.remove(profile); if (_profiles.activeProfile?.id != profile) return; _generation++; _profile = profile; _answer = null; _error = null; _state = FamilyExpansionLoadState.initial; notifyListeners(); unawaited(load(force: true)); }
  void _changed() { _sync(); final profile = _profiles.activeProfile?.id; if (profile == _profile) return; _generation++; _profile = profile; _answer = _cache[profile]; _error = null; _state = _answer == null ? FamilyExpansionLoadState.initial : FamilyExpansionLoadState.loaded; notifyListeners(); if (profile != null && profile.isNotEmpty) unawaited(load()); }
  void _sync() { final subject = _profiles.activeAuthenticatedSubject; if (subject == _subject) return; _subject = subject; _generation++; _cache.clear(); _inFlight.clear(); }
  bool _same(String? subject) => !_disposed && subject == _profiles.activeAuthenticatedSubject; bool _current(int generation, String profile, String? subject) => !_disposed && generation == _generation && _profiles.activeProfile?.id == profile && _same(subject);
  @override void dispose() { _disposed = true; _profiles.removeListener(_changed); super.dispose(); }
}
