import '../../../core/api/api_client.dart';
import '../domain/tarot.dart';
import '../domain/tarot_repository.dart';

class TarotApiRepository implements TarotRepository {
  const TarotApiRepository(this._client);
  final ApiClient _client;
  Map<String, dynamic> _map(Object? raw) {
    if (raw is! Map) {
      throw const FormatException('Malformed Tarot API response.');
    }
    return Map<String, dynamic>.from(raw);
  }

  @override
  Future<TarotEntitlement> getEntitlement() async {
    final r = await _client.get<Map<String, dynamic>>('/v1/tarot/entitlement');
    return TarotEntitlement.fromJson(_map(r.data?['entitlement']));
  }

  @override
  Future<TarotStartResult> startReading({
    required String question,
    required String idempotencyKey,
    required String language,
  }) async {
    final r = await _client.post<Map<String, dynamic>>(
      '/v1/tarot/readings',
      data: {'question': question, 'language': language},
      headers: {'Idempotency-Key': idempotencyKey},
    );
    final body = _map(r.data);
    switch (body['state']) {
      case 'READING_READY':
        return TarotStartReady(TarotReading.fromJson(_map(body['reading'])));
      case 'SAFETY_BOUNDARY':
        final s = _map(body['safety']);
        return TarotStartSafety(
          TarotSafetyBoundary(
            message:
                s['message'] as String? ??
                'This question cannot be read safely.',
            suggestedQuestion: s['suggestedQuestion'] as String?,
          ),
        );
      case 'PURCHASE_REQUIRED':
        return TarotStartPurchaseRequired(
          TarotEntitlement.fromJson(_map(body['entitlement'])),
          _packs(body['products']),
        );
      default:
        throw const FormatException('Unknown Tarot creation state.');
    }
  }

  List<TarotPack> _packs(Object? raw) {
    if (raw is! Map) return const [];
    return raw.entries
        .where((e) => e.value is Map)
        .map((e) {
          final p = Map<String, dynamic>.from(e.value as Map);
          return TarotPack(
            key: e.key.toString(),
            quantity: (p['quantity'] as num?)?.toInt() ?? 0,
            priceMinor: (p['priceMinor'] as num?)?.toInt() ?? 0,
            currency: p['currency'] as String? ?? 'INR',
          );
        })
        .toList(growable: false);
  }

  @override
  Future<TarotReading> getReading(String id) async {
    final r = await _client.get<Map<String, dynamic>>(
      '/v1/tarot/readings/${Uri.encodeComponent(id)}',
    );
    return TarotReading.fromJson(_map(r.data?['reading']));
  }

  @override
  Future<TarotReading> selectCard({
    required String readingId,
    required String selectionToken,
    required String idempotencyKey,
  }) async {
    final r = await _client.post<Map<String, dynamic>>(
      '/v1/tarot/readings/${Uri.encodeComponent(readingId)}/select-card',
      data: {'selectionToken': selectionToken},
      headers: {'Idempotency-Key': idempotencyKey},
    );
    return TarotReading.fromJson(_map(r.data?['reading']));
  }

  @override
  Future<TarotReading> retryInterpretation(String readingId) async {
    final r = await _client.post<Map<String, dynamic>>(
      '/v1/tarot/readings/${Uri.encodeComponent(readingId)}/retry-interpretation',
    );
    return TarotReading.fromJson(_map(r.data?['reading']));
  }

  @override
  Future<TarotHistoryPage> getHistory({int limit = 20, String? cursor}) async {
    final query = <String, Object>{'limit': limit};
    if (cursor != null) {
      query['cursor'] = cursor;
    }
    final r = await _client.get<Map<String, dynamic>>(
      '/v1/tarot/readings',
      queryParameters: query,
    );
    final body = _map(r.data);
    return TarotHistoryPage(
      readings: (body['readings'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => TarotReading.fromJson(Map<String, dynamic>.from(e)))
          .toList(growable: false),
      nextCursor: body['nextCursor'] as String?,
    );
  }
}
