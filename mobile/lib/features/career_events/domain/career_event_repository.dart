import 'career_event.dart';

abstract interface class CareerEventRepository {
  Future<List<CareerEvent>> listCareerEvents(String birthProfileId);
  Future<CareerEvent> createCareerEvent(
    String birthProfileId,
    CareerEventInput input,
  );
  Future<CareerEvent> updateCareerEvent(
    String birthProfileId,
    String careerEventId,
    CareerEventInput input,
  );
  Future<CareerEvent> deleteCareerEvent(
    String birthProfileId,
    String careerEventId,
  );
}

class UnavailableCareerEventRepository implements CareerEventRepository {
  const UnavailableCareerEventRepository();
  Never _unavailable() => throw StateError('Configuration is required.');

  @override
  Future<CareerEvent> createCareerEvent(
    String _,
    CareerEventInput input,
  ) async => _unavailable();
  @override
  Future<CareerEvent> deleteCareerEvent(String _, String eventId) async =>
      _unavailable();
  @override
  Future<List<CareerEvent>> listCareerEvents(String _) async => _unavailable();
  @override
  Future<CareerEvent> updateCareerEvent(
    String _,
    String eventId,
    CareerEventInput input,
  ) async => _unavailable();
}
