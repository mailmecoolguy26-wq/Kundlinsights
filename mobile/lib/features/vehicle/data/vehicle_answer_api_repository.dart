import '../../../core/api/api_client.dart';
import '../domain/vehicle_answer.dart';
import '../domain/vehicle_answer_repository.dart';

class VehicleAnswerApiRepository implements VehicleAnswerRepository {
  const VehicleAnswerApiRepository(this._client);
  final ApiClient _client;

  @override
  Future<VehicleAnswer> getAnswer({
    required String birthProfileId,
    required VehicleIntent intent,
  }) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/v1/birth-profiles/${Uri.encodeComponent(birthProfileId)}/vehicle-answers',
      data: {'intent': intent.wire},
    );
    final body = response.data;
    final raw = body is Map<String, dynamic> ? body['vehicleAnswer'] : null;
    if (raw is! Map<String, dynamic>) {
      throw const FormatException('Malformed Vehicle Answer API response.');
    }
    return VehicleAnswer.fromJson(raw);
  }
}
