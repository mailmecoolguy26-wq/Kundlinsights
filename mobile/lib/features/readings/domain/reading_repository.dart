import 'reading.dart';

abstract interface class ReadingRepository {
  Future<List<ReadingSummary>> getReadings({String? birthProfileId});
  Future<ReadingDetail> getReadingDetail(String readingId);
}

class UnavailableReadingRepository implements ReadingRepository {
  const UnavailableReadingRepository();

  @override
  Future<ReadingDetail> getReadingDetail(String readingId) =>
      Future<ReadingDetail>.error(StateError('Configuration is required.'));

  @override
  Future<List<ReadingSummary>> getReadings({String? birthProfileId}) =>
      Future<List<ReadingSummary>>.error(
        StateError('Configuration is required.'),
      );
}
