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
  Future<DashaPeriodInsight> getPeriodInsight({
    required String birthProfileId,
    required DateTime pratyantarStartUtc,
  });
  Future<DashaScopedTimeline> getMahadashaTimeline({
    required String birthProfileId,
  });
  Future<DashaScopedTimeline> getAntardashaTimeline({
    required String birthProfileId,
    required DateTime mahadashaStartUtc,
  });
  Future<DashaScopedTimeline> getPratyantarTimeline({
    required String birthProfileId,
    required DateTime mahadashaStartUtc,
    required DateTime antardashaStartUtc,
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

  @override
  Future<DashaPeriodInsight> getPeriodInsight({
    required String birthProfileId,
    required DateTime pratyantarStartUtc,
  }) => Future.error(const ApiFailure(ApiFailureKind.network));

  @override
  Future<DashaScopedTimeline> getMahadashaTimeline({
    required String birthProfileId,
  }) => Future.error(const ApiFailure(ApiFailureKind.network));
  @override
  Future<DashaScopedTimeline> getAntardashaTimeline({
    required String birthProfileId,
    required DateTime mahadashaStartUtc,
  }) => Future.error(const ApiFailure(ApiFailureKind.network));
  @override
  Future<DashaScopedTimeline> getPratyantarTimeline({
    required String birthProfileId,
    required DateTime mahadashaStartUtc,
    required DateTime antardashaStartUtc,
  }) => Future.error(const ApiFailure(ApiFailureKind.network));
}
