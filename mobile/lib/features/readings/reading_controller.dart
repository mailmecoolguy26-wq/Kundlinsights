import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_controller.dart';
import '../auth/domain/auth_repository.dart';
import '../profiles/profile_controller.dart';
import 'domain/reading.dart';
import 'domain/reading_repository.dart';

enum ReadingListState { initial, loading, loaded, refreshing, error }

enum ReadingDetailState { initial, loading, loaded, error }

class ReadingController extends ChangeNotifier {
  ReadingController(this.repository, this._auth, this._profiles) {
    _auth.addListener(_onScopeChanged);
    _profiles.addListener(_onScopeChanged);
    _onScopeChanged();
  }

  final ReadingRepository repository;
  final AuthController _auth;
  final ProfileController _profiles;
  ReadingListState _listState = ReadingListState.initial;
  ReadingDetailState _detailState = ReadingDetailState.initial;
  List<ReadingSummary> _readings = const [];
  ReadingDetail? _detail;
  Object? _listError;
  Object? _detailError;
  String? _subject;
  String? _birthProfileId;
  int _listGeneration = 0;
  int _detailGeneration = 0;
  bool _disposed = false;

  ReadingListState get listState => _listState;
  ReadingDetailState get detailState => _detailState;
  List<ReadingSummary> get readings => _readings;
  ReadingDetail? get detail => _detail;
  Object? get listError => _listError;
  Object? get detailError => _detailError;

  void _onScopeChanged() {
    final subject = _auth.state.status == AuthStatus.authenticated
        ? _auth.state.subject
        : null;
    final profileId = subject == null ? null : _profiles.activeProfile?.id;
    if (subject == _subject && profileId == _birthProfileId) return;
    _listGeneration++;
    _detailGeneration++;
    _subject = subject;
    _birthProfileId = profileId;
    _readings = const [];
    _detail = null;
    _listError = null;
    _detailError = null;
    if (subject == null || profileId == null) {
      _listState = ReadingListState.initial;
      _detailState = ReadingDetailState.initial;
      notifyListeners();
      return;
    }
    _listState = ReadingListState.loading;
    _detailState = ReadingDetailState.initial;
    notifyListeners();
    _loadList(subject, profileId, _listGeneration);
  }

  Future<void> refresh() async {
    final subject = _subject;
    final profileId = _birthProfileId;
    if (subject == null || profileId == null) return;
    final generation = ++_listGeneration;
    _listState = ReadingListState.refreshing;
    _listError = null;
    notifyListeners();
    await _loadList(subject, profileId, generation);
  }

  Future<void> loadDetail(String readingId) async {
    final subject = _subject;
    final profileId = _birthProfileId;
    if (subject == null || profileId == null) return;
    final generation = ++_detailGeneration;
    _detail = null;
    _detailError = null;
    _detailState = ReadingDetailState.loading;
    notifyListeners();
    try {
      final result = await repository.getReadingDetail(readingId);
      if (!_isCurrentDetail(generation, subject, profileId) ||
          result.birthProfileId != profileId) {
        return;
      }
      _detail = result;
      _detailState = ReadingDetailState.loaded;
    } catch (error) {
      if (!_isCurrentDetail(generation, subject, profileId)) return;
      _detailError = error;
      _detailState = ReadingDetailState.error;
    }
    notifyListeners();
  }

  Future<void> _loadList(
    String subject,
    String profileId,
    int generation,
  ) async {
    try {
      final result = await repository.getReadings(birthProfileId: profileId);
      if (!_isCurrentList(generation, subject, profileId) ||
          result.any((reading) => reading.birthProfileId != profileId)) {
        return;
      }
      _readings = List.unmodifiable(result);
      _listState = ReadingListState.loaded;
    } catch (error) {
      if (!_isCurrentList(generation, subject, profileId)) return;
      _readings = const [];
      _listError = error;
      _listState = ReadingListState.error;
    }
    notifyListeners();
  }

  bool _isCurrentList(int generation, String subject, String profileId) =>
      !_disposed &&
      generation == _listGeneration &&
      subject == _subject &&
      profileId == _birthProfileId;
  bool _isCurrentDetail(int generation, String subject, String profileId) =>
      !_disposed &&
      generation == _detailGeneration &&
      subject == _subject &&
      profileId == _birthProfileId;

  @override
  void dispose() {
    _disposed = true;
    _listGeneration++;
    _detailGeneration++;
    _auth.removeListener(_onScopeChanged);
    _profiles.removeListener(_onScopeChanged);
    super.dispose();
  }
}

final readingRepositoryProvider = Provider<ReadingRepository>(
  (ref) => const UnavailableReadingRepository(),
);
final readingControllerProvider =
    Provider.family<ReadingController, (AuthController, ProfileController)>((
      ref,
      scope,
    ) {
      final controller = ReadingController(
        ref.watch(readingRepositoryProvider),
        scope.$1,
        scope.$2,
      );
      ref.onDispose(controller.dispose);
      return controller;
    });
