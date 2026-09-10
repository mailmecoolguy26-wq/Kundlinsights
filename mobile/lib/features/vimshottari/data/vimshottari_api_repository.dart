// ignore_for_file: curly_braces_in_flow_control_structures

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

  @override
  Future<DashaPeriodInsight> getPeriodInsight({
    required String birthProfileId,
    required DateTime pratyantarStartUtc,
  }) async {
    final response = await _client.get<Map<String, dynamic>>(
      '/v1/birth-profiles/$birthProfileId/vimshottari/period-insight',
      queryParameters: {'pratyantarStart': _utc(pratyantarStartUtc)},
    );
    final data = response.data;
    if (data == null || data['periodInsight'] is! Map<String, dynamic>) {
      throw const FormatException(
        'Vimshottari period insight response is malformed.',
      );
    }
    return DashaPeriodInsight.fromJson(
      data['periodInsight'] as Map<String, dynamic>,
    );
  }

  @override
  Future<DashaScopedTimeline> getMahadashaTimeline({
    required String birthProfileId,
  }) => _scoped(birthProfileId, {'level': 'md', 'root': 'true'});

  @override
  Future<DashaScopedTimeline> getAntardashaTimeline({
    required String birthProfileId,
    required DateTime mahadashaStartUtc,
  }) => _scoped(birthProfileId, {
    'level': 'ad',
    'mahadashaStart': _utc(mahadashaStartUtc),
  });

  @override
  Future<DashaScopedTimeline> getPratyantarTimeline({
    required String birthProfileId,
    required DateTime mahadashaStartUtc,
    required DateTime antardashaStartUtc,
  }) => _scoped(birthProfileId, {
    'level': 'pd',
    'mahadashaStart': _utc(mahadashaStartUtc),
    'antardashaStart': _utc(antardashaStartUtc),
  });

  Future<DashaScopedTimeline> _scoped(
    String profileId,
    Map<String, dynamic> queryParameters,
  ) async {
    final response = await _client.get<Map<String, dynamic>>(
      '/v1/birth-profiles/$profileId/vimshottari/timeline',
      queryParameters: queryParameters,
    );
    final data = response.data;
    if (data == null || data['vimshottariTimeline'] is! Map<String, dynamic>)
      throw const FormatException(
        'Vimshottari scoped timeline response is malformed.',
      );
    return DashaScopedTimeline.fromJson(
      data['vimshottariTimeline'] as Map<String, dynamic>,
    );
  }
}

String _utc(DateTime value) => DateTime.fromMillisecondsSinceEpoch(
  value.toUtc().millisecondsSinceEpoch,
  isUtc: true,
).toIso8601String();
