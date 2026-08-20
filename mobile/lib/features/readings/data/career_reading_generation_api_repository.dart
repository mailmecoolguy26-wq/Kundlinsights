import '../../../core/api/api_client.dart';
import '../domain/career_reading_generation.dart';

class CareerReadingGenerationApiRepository
    implements CareerReadingGenerationRepository {
  const CareerReadingGenerationApiRepository(this._client);
  final ApiClient _client;
  @override
  Future<CareerEligibility> getCareerEligibility() async {
    final response = await _client.get<Map<String, dynamic>>(
      '/v1/me/entitlements',
    );
    final data = response.data;
    if (data is! Map<String, dynamic>) {
      throw const FormatException('Malformed entitlement response.');
    }
    return CareerEligibility.fromJson(data);
  }

  @override
  Future<CreatedCareerReading> createCareerReading({
    required String birthProfileId,
    required String idempotencyKey,
  }) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/v1/readings',
      data: {'birthProfileId': birthProfileId, 'domain': 'CAREER'},
      headers: {'Idempotency-Key': idempotencyKey},
    );
    final data = response.data;
    if (data is! Map<String, dynamic>) {
      throw const FormatException('Malformed reading creation response.');
    }
    return CreatedCareerReading.fromJson(data);
  }
}
