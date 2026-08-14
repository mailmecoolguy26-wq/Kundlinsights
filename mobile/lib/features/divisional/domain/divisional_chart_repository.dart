import 'divisional_chart.dart';

abstract interface class DivisionalChartRepository {
  Future<DivisionalChart> getChart({
    required String birthProfileId,
    required DivisionalChartType type,
  });
}

class UnavailableDivisionalChartRepository
    implements DivisionalChartRepository {
  const UnavailableDivisionalChartRepository();

  @override
  Future<DivisionalChart> getChart({
    required String birthProfileId,
    required DivisionalChartType type,
  }) =>
      throw StateError('Divisional charts require application configuration.');
}
