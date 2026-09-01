import '../../../core/api/api_client.dart';
import '../domain/vimshottari.dart';
import '../domain/vimshottari_repository.dart';

class VimshottariApiRepository implements VimshottariRepository {
  const VimshottariApiRepository(this._client);
  final ApiClient _client;

  @override
  Future<VimshottariCurrent> getCurrent({
    required String birthProfileId,
    required DateTime atUtc,
  }) async {
    final response = await _client.get<Map<String, dynamic>>(
      '/v1/birth-profiles/$birthProfileId/vimshottari',
      queryParameters: {'at': _utc(atUtc)},
    );
    final data = response.data;
    if (data == null || data['vimshottari'] is! Map<String, dynamic>) {
      throw const FormatException('Vimshottari current response is malformed.');
    }
    return VimshottariCurrent.fromJson(
      data['vimshottari'] as Map<String, dynamic>,
    );
  }

  @override
  Future<VimshottariTimeline> getTimeline({
    required String birthProfileId,
    required DateTime fromUtc,
    required DateTime toUtc,
    required VimshottariLevel level,
  }) async {
    final response = await _client.get<Map<String, dynamic>>(
      '/v1/birth-profiles/$birthProfileId/vimshottari/timeline',
      queryParameters: {
        'from': _utc(fromUtc),
        'to': _utc(toUtc),
        'level': level.apiValue,
      },
    );
    final data = response.data;
    if (data == null || data['vimshottariTimeline'] is! Map<String, dynamic>) {
      throw const FormatException(
        'Vimshottari timeline response is malformed.',
      );
    }
    return VimshottariTimeline.fromJson(
      data['vimshottariTimeline'] as Map<String, dynamic>,
    );
  }
}

String _utc(DateTime value) => DateTime.fromMillisecondsSinceEpoch(
  value.toUtc().millisecondsSinceEpoch,
  isUtc: true,
).toIso8601String();
