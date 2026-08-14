import '../../../core/errors/api_failure.dart';
import 'natal_summary.dart';

abstract interface class NatalSummaryRepository {
  Future<NatalSummary> getNatalSummary(String birthProfileId);
}

class UnavailableNatalSummaryRepository implements NatalSummaryRepository {
  const UnavailableNatalSummaryRepository();

  @override
  Future<NatalSummary> getNatalSummary(String birthProfileId) =>
      Future.error(const ApiFailure(ApiFailureKind.network));
}
