import '../../../core/api/api_client.dart';
import '../domain/reading.dart';
import '../domain/reading_repository.dart';

class ReadingApiRepository implements ReadingRepository {
  const ReadingApiRepository(this._client);
  final ApiClient _client;

  @override
  Future<List<ReadingSummary>> getReadings({String? birthProfileId}) async {
    final response = await _client.get<Map<String, dynamic>>(
      '/v1/readings',
      queryParameters: birthProfileId == null
          ? null
          : {'birthProfileId': birthProfileId},
    );
    final data = response.data;
    final readings = data is Map<String, dynamic> ? data['readings'] : null;
    if (readings is! List) {
      throw const FormatException('Malformed readings API response.');
    }
    return List<ReadingSummary>.unmodifiable(
      readings.map((entry) {
        if (entry is! Map<String, dynamic>) {
          throw const FormatException('Malformed reading summary.');
        }
        return ReadingSummary.fromJson(entry);
      }),
    );
  }

  @override
  Future<ReadingDetail> getReadingDetail(String readingId) async {
    final response = await _client.get<Map<String, dynamic>>(
      '/v1/readings/$readingId',
    );
    final data = response.data;
    final reading = data is Map<String, dynamic> ? data['reading'] : null;
    if (reading is! Map<String, dynamic>) {
      throw const FormatException('Malformed reading detail API response.');
    }
    return ReadingDetail.fromJson(reading);
  }
}
