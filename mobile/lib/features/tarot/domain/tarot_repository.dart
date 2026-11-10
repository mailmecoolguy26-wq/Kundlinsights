import 'tarot.dart';

abstract interface class TarotRepository {
  Future<TarotEntitlement> getEntitlement();
  Future<TarotStartResult> startReading({
    required String question,
    required String idempotencyKey,
    required String language,
  });
  Future<TarotReading> getReading(String readingId);
  Future<TarotReading> selectCard({
    required String readingId,
    required String selectionToken,
    required String idempotencyKey,
  });
  Future<TarotReading> retryInterpretation(String readingId);
  Future<TarotHistoryPage> getHistory({int limit = 20, String? cursor});
}

class UnavailableTarotRepository implements TarotRepository {
  const UnavailableTarotRepository();
  Future<T> _fail<T>() => Future<T>.error(StateError('Tarot is unavailable.'));
  @override
  Future<TarotEntitlement> getEntitlement() => _fail();
  @override
  Future<TarotStartResult> startReading({
    required String question,
    required String idempotencyKey,
    required String language,
  }) => _fail();
  @override
  Future<TarotReading> getReading(String readingId) => _fail();
  @override
  Future<TarotReading> selectCard({
    required String readingId,
    required String selectionToken,
    required String idempotencyKey,
  }) => _fail();
  @override
  Future<TarotReading> retryInterpretation(String readingId) => _fail();
  @override
  Future<TarotHistoryPage> getHistory({int limit = 20, String? cursor}) =>
      _fail();
}
