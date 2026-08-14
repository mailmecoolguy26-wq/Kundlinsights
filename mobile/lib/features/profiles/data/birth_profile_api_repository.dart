import '../../../core/api/api_client.dart';
import '../domain/birth_profile.dart';
import '../domain/birth_profile_repository.dart';

class BirthProfileApiRepository implements BirthProfileRepository {
  const BirthProfileApiRepository(this._client);
  final ApiClient _client;

  @override
  Future<List<BirthProfile>> list() async {
    final response = await _client.get<Map<String, dynamic>>(
      '/v1/birth-profiles',
    );
    final items =
        (response.data?['birthProfiles'] as List<dynamic>? ?? const []);
    return List.unmodifiable(
      items.map((value) => _profile(value as Map<String, dynamic>)),
    );
  }

  @override
  Future<BirthProfile> get(String id) async {
    final response = await _client.get<Map<String, dynamic>>(
      '/v1/birth-profiles/$id',
    );
    return _profile(response.data!['birthProfile'] as Map<String, dynamic>);
  }

  @override
  Future<List<PlaceCandidate>> searchPlaces(String query) async {
    final response = await _client.get<Map<String, dynamic>>(
      '/v1/places/search',
      queryParameters: {'q': query},
    );
    final items = response.data?['results'] as List<dynamic>? ?? const [];
    return List.unmodifiable(
      items.map((value) {
        final item = value as Map<String, dynamic>;
        return PlaceCandidate(
          id: item['id']! as String,
          label: item['label']! as String,
          latitude: (item['latitude']! as num).toDouble(),
          longitude: (item['longitude']! as num).toDouble(),
          timezone: item['timezone']! as String,
          timezoneProvenance: Map.unmodifiable(
            Map<String, Object?>.from(item['timezoneProvenance'] as Map),
          ),
        );
      }),
    );
  }

  @override
  Future<ResolvedBirthData> resolveBirthTime({
    required String placeId,
    required String localDate,
    required String localTime,
  }) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/v1/places/resolve-birth-time',
      data: {
        'place': {'id': placeId},
        'localDate': localDate,
        'localTime': localTime,
      },
    );
    return ResolvedBirthData(
      Map.unmodifiable(
        Map<String, Object?>.from(response.data!['birthData'] as Map),
      ),
    );
  }

  @override
  Future<BirthProfile> create({
    required String? displayLabel,
    required ResolvedBirthData birthData,
  }) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/v1/birth-profiles',
      data: {'displayLabel': displayLabel, 'birthData': birthData.value},
    );
    return _profile(response.data!['birthProfile'] as Map<String, dynamic>);
  }

  BirthProfile _profile(Map<String, dynamic> value) => BirthProfile(
    id: value['id']! as String,
    displayLabel: value['displayLabel'] as String?,
    birthData: ResolvedBirthData(
      Map.unmodifiable(Map<String, Object?>.from(value['birthData'] as Map)),
    ),
    status: value['status']! as String,
  );
}
