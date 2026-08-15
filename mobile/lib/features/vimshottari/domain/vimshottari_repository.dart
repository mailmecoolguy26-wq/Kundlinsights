import '../../../core/errors/api_failure.dart';
import 'vimshottari.dart';

abstract interface class VimshottariRepository {
  Future<VimshottariCurrent> getCurrent({
    required String birthProfileId,
    required DateTime atUtc,
  });

  Future<VimshottariTimeline> getTimeline({
    required String birthProfileId,
    required DateTime fromUtc,
    required DateTime toUtc,
    required VimshottariLevel level,
  });
}

class UnavailableVimshottariRepository implements VimshottariRepository {
  const UnavailableVimshottariRepository();

  @override
  Future<VimshottariCurrent> getCurrent({
    required String birthProfileId,
    required DateTime atUtc,
  }) => Future.error(const ApiFailure(ApiFailureKind.network));

  @override
  Future<VimshottariTimeline> getTimeline({
    required String birthProfileId,
    required DateTime fromUtc,
    required DateTime toUtc,
    required VimshottariLevel level,
  }) => Future.error(const ApiFailure(ApiFailureKind.network));
}
