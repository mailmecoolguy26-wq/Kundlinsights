import '../../../core/api/api_client.dart';
import '../domain/divisional_chart.dart';
import '../domain/divisional_chart_repository.dart';

class DivisionalChartApiRepository implements DivisionalChartRepository {
  const DivisionalChartApiRepository(this._client);
  final ApiClient _client;

  @override
  Future<DivisionalChart> getChart({
    required String birthProfileId,
    required DivisionalChartType type,
  }) async {
    final response = await _client.get<Map<String, dynamic>>(
      '/v1/birth-profiles/$birthProfileId/divisional-charts/${type.pathSegment}',
    );
    final data = response.data;
    if (data == null || data['divisionalChart'] is! Map<String, dynamic>) {
      throw const FormatException('Divisional chart response is malformed.');
    }
    final chart = DivisionalChart.fromJson(
      data['divisionalChart'] as Map<String, dynamic>,
    );
    if (chart.birthProfileId != birthProfileId || chart.type != type) {
      throw const FormatException(
        'Divisional chart response has the wrong scope.',
      );
    }
    return chart;
  }
}
