import 'birth_profile.dart';

abstract interface class BirthProfileRepository {
  Future<List<BirthProfile>> list();
  Future<BirthProfile> get(String id);
  Future<List<PlaceCandidate>> searchPlaces(String query);
  Future<ResolvedBirthData> resolveBirthTime({
    required String placeId,
    required String localDate,
    required String localTime,
  });
  Future<BirthProfile> create({
    required String? displayLabel,
    required ResolvedBirthData birthData,
  });
}

class UnavailableBirthProfileRepository implements BirthProfileRepository {
  const UnavailableBirthProfileRepository();
  Never _unavailable() => throw StateError('API configuration is required.');
  @override
  Future<BirthProfile> create({
    required String? displayLabel,
    required ResolvedBirthData birthData,
  }) async => _unavailable();
  @override
  Future<BirthProfile> get(String id) async => _unavailable();
  @override
  Future<List<BirthProfile>> list() async => _unavailable();
  @override
  Future<ResolvedBirthData> resolveBirthTime({
    required String placeId,
    required String localDate,
    required String localTime,
  }) async => _unavailable();
  @override
  Future<List<PlaceCandidate>> searchPlaces(String query) async =>
      _unavailable();
}
