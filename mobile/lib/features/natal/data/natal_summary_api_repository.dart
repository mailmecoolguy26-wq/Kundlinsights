import '../../../core/api/api_client.dart';
import '../domain/natal_summary.dart';
import '../domain/natal_summary_repository.dart';

class NatalSummaryApiRepository implements NatalSummaryRepository {
  const NatalSummaryApiRepository(this._client);
  final ApiClient _client;

  @override
  Future<NatalSummary> getNatalSummary(String birthProfileId) async {
    final response = await _client.get<Map<String, dynamic>>(
      '/v1/birth-profiles/$birthProfileId/natal-summary',
    );
    final data = response.data;
    if (data == null || data['natalSummary'] is! Map<String, dynamic>) {
      throw const FormatException('Natal summary response is malformed.');
    }
    return NatalSummary.fromJson(data['natalSummary'] as Map<String, dynamic>);
  }
}
