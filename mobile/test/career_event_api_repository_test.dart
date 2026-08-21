import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/core/api/api_client.dart';
import 'package:kundlinsights_mobile/core/config/app_config.dart';
import 'package:kundlinsights_mobile/features/career_events/data/career_event_api_repository.dart';
import 'package:kundlinsights_mobile/features/career_events/domain/career_event.dart';

void main() {
  const config = AppConfig.test(
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'public-key',
    apiBaseUrl: 'https://api.example.test',
  );

  CareerEventInput input(CareerEventDate date) =>
      CareerEventInput(eventType: CareerEventType.promotion, eventDate: date);

  test('parses all strict event enums and preserves date precision', () {
    expect(CareerEventType.values, hasLength(10));
    for (final type in CareerEventType.values) {
      expect(CareerEventType.fromWireValue(type.wireValue), type);
    }
    expect(
      CareerEventDate.fromJson({'precision': 'MONTH', 'year': 2021, 'month': 4})
          .day,
      isNull,
    );
    final year = CareerEventDate.fromJson({'precision': 'YEAR', 'year': 2021});
    expect(year.month, isNull);
    expect(year.day, isNull);
    expect(() => CareerEventType.fromWireValue('UNKNOWN'), throwsStateError);
  });

  test(
    'uses precise CRUD paths and payloads without fabricated components',
    () async {
      final adapter = _Adapter([
        _json(200, {
          'careerEvents': [_event('DAY')],
        }),
        _json(201, {'careerEvent': _event('DAY')}),
        _json(201, {'careerEvent': _event('MONTH')}),
        _json(201, {'careerEvent': _event('YEAR')}),
        _json(200, {'careerEvent': _event('YEAR')}),
        _json(200, {'careerEvent': _event('YEAR')}),
      ]);
      final repository = CareerEventApiRepository(
        ApiClient(
          config: config,
          tokens: _Tokens(),
          dio: Dio()..httpClientAdapter = adapter,
        ),
      );
      await repository.listCareerEvents('profile-a');
      await repository.createCareerEvent(
        'profile-a',
        input(
          const CareerEventDate(
            precision: CareerEventDatePrecision.day,
            year: 2021,
            month: 4,
            day: 5,
          ),
        ),
      );
      await repository.createCareerEvent(
        'profile-a',
        input(
          const CareerEventDate(
            precision: CareerEventDatePrecision.month,
            year: 2021,
            month: 4,
          ),
        ),
      );
      await repository.createCareerEvent(
        'profile-a',
        input(
          const CareerEventDate(
            precision: CareerEventDatePrecision.year,
            year: 2021,
          ),
        ),
      );
      await repository.updateCareerEvent(
        'profile-a',
        'event-1',
        input(
          const CareerEventDate(
            precision: CareerEventDatePrecision.year,
            year: 2021,
          ),
        ),
      );
      await repository.deleteCareerEvent('profile-a', 'event-1');

      expect(adapter.requests.map((item) => item.method), [
        'GET',
        'POST',
        'POST',
        'POST',
        'PATCH',
        'DELETE',
      ]);
      expect(
        adapter.requests[0].path,
        '/v1/birth-profiles/profile-a/career-events',
      );
      expect(
        adapter.requests[4].path,
        '/v1/birth-profiles/profile-a/career-events/event-1',
      );
      expect(
        adapter.requests[5].path,
        '/v1/birth-profiles/profile-a/career-events/event-1',
      );
      expect(adapter.requests[1].data['eventDate'], {
        'precision': 'DAY',
        'year': 2021,
        'month': 4,
        'day': 5,
      });
      expect(adapter.requests[2].data['eventDate'], {
        'precision': 'MONTH',
        'year': 2021,
        'month': 4,
      });
      expect(adapter.requests[3].data['eventDate'], {
        'precision': 'YEAR',
        'year': 2021,
      });
      expect(adapter.requests[4].data['eventDate'], {
        'precision': 'YEAR',
        'year': 2021,
      });
    },
  );
}

Map<String, dynamic> _event(String precision) => {
  'careerEventId': 'event-1',
  'birthProfileId': 'profile-a',
  'eventType': 'PROMOTION',
  'eventDate': {
    'precision': precision,
    'year': 2021,
    'month': precision == 'YEAR' ? null : 4,
    'day': precision == 'DAY' ? 5 : null,
  },
  'title': null,
  'notes': null,
  'createdAt': '2026-01-01T00:00:00.000Z',
  'updatedAt': '2026-01-01T00:00:00.000Z',
};
ResponseBody _json(int status, Map<String, dynamic> body) =>
    ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {
        'content-type': ['application/json'],
      },
    );

class _Adapter implements HttpClientAdapter {
  _Adapter(this.responses);
  final List<ResponseBody> responses;
  final List<RequestOptions> requests = [];
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return responses.removeAt(0);
  }

  @override
  void close({bool force = false}) {}
}

class _Tokens implements AccessTokenSource {
  @override
  Future<String?> accessToken() async => 'token';
  @override
  Future<void> invalidate() async {}
  @override
  Future<String?> refreshAccessToken() async => 'token';
}
