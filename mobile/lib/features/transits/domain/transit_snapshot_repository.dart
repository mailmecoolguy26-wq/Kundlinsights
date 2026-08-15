import '../../../core/errors/api_failure.dart';
import 'transit_snapshot.dart';

abstract interface class TransitSnapshotRepository {
  Future<TransitSnapshot> getTransitSnapshot({
    required String birthProfileId,
    required DateTime atUtc,
  });
}

class UnavailableTransitSnapshotRepository
    implements TransitSnapshotRepository {
  const UnavailableTransitSnapshotRepository();
  @override
  Future<TransitSnapshot> getTransitSnapshot({
    required String birthProfileId,
    required DateTime atUtc,
  }) => Future.error(const ApiFailure(ApiFailureKind.network));
}
