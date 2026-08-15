import '../../../core/api/api_client.dart';
import '../domain/ashtakavarga.dart';
import '../domain/ashtakavarga_repository.dart';

class AshtakavargaApiRepository implements AshtakavargaRepository {
  const AshtakavargaApiRepository(this._client);

  final ApiClient _client;

  @override
  Future<Ashtakavarga> getAshtakavarga({required String birthProfileId}) async {
    final response = await _client.get<Map<String, dynamic>>(
      '/v1/birth-profiles/$birthProfileId/ashtakavarga',
    );
    final data = response.data;
    final ashtakavarga = data is Map<String, dynamic>
        ? data['ashtakavarga']
        : null;
    if (ashtakavarga is! Map<String, dynamic>) {
      throw const FormatException('Malformed Ashtakavarga API response.');
    }
    return Ashtakavarga.fromJson(ashtakavarga);
  }
}
