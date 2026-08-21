import '../../../core/api/api_client.dart';
import '../domain/career_event.dart';
import '../domain/career_event_repository.dart';

class CareerEventApiRepository implements CareerEventRepository {
  const CareerEventApiRepository(this._client);
  final ApiClient _client;

  String _base(String profileId) =>
      '/v1/birth-profiles/$profileId/career-events';

  @override
  Future<List<CareerEvent>> listCareerEvents(String birthProfileId) async {
    final response = await _client.get<Map<String, dynamic>>(
      _base(birthProfileId),
    );
    final values = response.data?['careerEvents'];
    if (values is! List) {
      throw const FormatException('Malformed career events.');
    }
    return List.unmodifiable(
      values.map(
        (value) =>
            CareerEvent.fromJson(Map<String, dynamic>.from(value as Map)),
      ),
    );
  }

  @override
  Future<CareerEvent> createCareerEvent(
    String birthProfileId,
    CareerEventInput input,
  ) => _write(
    _client.post<Map<String, dynamic>>(
      _base(birthProfileId),
      data: input.toJson(),
    ),
  );

  @override
  Future<CareerEvent> updateCareerEvent(
    String birthProfileId,
    String careerEventId,
    CareerEventInput input,
  ) => _write(
    _client.patch<Map<String, dynamic>>(
      '${_base(birthProfileId)}/$careerEventId',
      data: input.toJson(),
    ),
  );

  @override
  Future<CareerEvent> deleteCareerEvent(
    String birthProfileId,
    String careerEventId,
  ) => _write(
    _client.delete<Map<String, dynamic>>(
      '${_base(birthProfileId)}/$careerEventId',
    ),
  );

  Future<CareerEvent> _write(Future<dynamic> request) async {
    final response = await request;
    final value = response.data?['careerEvent'];
    if (value is! Map) throw const FormatException('Malformed career event.');
    return CareerEvent.fromJson(Map<String, dynamic>.from(value));
  }
}
