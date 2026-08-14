import '../../../core/api/api_client.dart';

/// Minimal authenticated backend boundary. It deliberately exposes no profile
/// or astrology payloads; those arrive in later frontend milestones.
class ApiMeRepository {
  const ApiMeRepository(this._client);

  final ApiClient _client;

  Future<Map<String, Object?>> getMe() async {
    final response = await _client.get<Map<String, dynamic>>('/v1/me');
    return Map<String, Object?>.unmodifiable(response.data ?? const {});
  }
}
