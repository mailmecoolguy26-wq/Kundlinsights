import '../../../core/api/api_client.dart';
import '../domain/transit_snapshot.dart';
import '../domain/transit_snapshot_repository.dart';

class TransitSnapshotApiRepository implements TransitSnapshotRepository {
  const TransitSnapshotApiRepository(this._client);
  final ApiClient _client;
  @override
  Future<TransitSnapshot> getTransitSnapshot({
    required String birthProfileId,
    required DateTime atUtc,
  }) async {
    final response = await _client.get<Map<String, dynamic>>(
      '/v1/birth-profiles/$birthProfileId/transits',
      queryParameters: {'at': _utcMilliseconds(atUtc)},
    );
    final data = response.data;
    if (data == null || data['transitSnapshot'] is! Map<String, dynamic>) {
      throw const FormatException('Transit snapshot response is malformed.');
    }
    return TransitSnapshot.fromJson(
      data['transitSnapshot'] as Map<String, dynamic>,
    );
  }
}

String _utcMilliseconds(DateTime value) => DateTime.fromMillisecondsSinceEpoch(
  value.toUtc().millisecondsSinceEpoch,
  isUtc: true,
).toIso8601String();
