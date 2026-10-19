import 'vehicle_answer.dart';

abstract interface class VehicleAnswerRepository {
  Future<VehicleAnswer> getAnswer({
    required String birthProfileId,
    required VehicleIntent intent,
  });
}

class UnavailableVehicleAnswerRepository implements VehicleAnswerRepository {
  const UnavailableVehicleAnswerRepository();
  @override
  Future<VehicleAnswer> getAnswer({
    required String birthProfileId,
    required VehicleIntent intent,
  }) =>
      Future<VehicleAnswer>.error(StateError('Vehicle timing is unavailable.'));
}
