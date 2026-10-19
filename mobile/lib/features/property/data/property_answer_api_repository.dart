import '../../../core/api/api_client.dart';
import '../domain/property_answer.dart';
import '../domain/property_answer_repository.dart';

class PropertyAnswerApiRepository implements PropertyAnswerRepository {
  const PropertyAnswerApiRepository(this._client);
  final ApiClient _client;

  @override
  Future<PropertyAnswer> getAnswer({
    required String birthProfileId,
    required PropertyIntent intent,
  }) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/v1/birth-profiles/${Uri.encodeComponent(birthProfileId)}/property-answers',
      data: {'intent': intent.wire},
    );
    final body = response.data;
    final raw = body is Map<String, dynamic> ? body['propertyAnswer'] : null;
    if (raw is! Map<String, dynamic>) {
      throw const FormatException('Malformed Property Answer API response.');
    }
    return PropertyAnswer.fromJson(raw);
  }
}
