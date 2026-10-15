import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/core/api/api_client.dart';
import 'package:kundlinsights_mobile/core/config/app_config.dart';
import 'package:kundlinsights_mobile/features/life_events/data/life_event_api_repository.dart';
import 'package:kundlinsights_mobile/features/life_events/domain/life_event.dart';

void main() {
  const config = AppConfig.test(
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'public-key',
    apiBaseUrl: 'https://api.example.test',
  );

  test(
    'posts the active profile and exact Life Event DTO for every precision',
    () async {
      final adapter = _Adapter([
        _json(201, {'lifeEvent': _event('PROPERTY_PURCHASE', 'DAY')}),
        _json(201, {'lifeEvent': _event('VEHICLE_PURCHASE', 'MONTH')}),
        _json(201, {'lifeEvent': _event('MARRIAGE', 'YEAR')}),
        _json(201, {'lifeEvent': _event('CHILD_BIRTH', 'DAY')}),
      ]);
      final repository = LifeEventApiRepository(
        ApiClient(
          config: config,
          tokens: _Tokens(),
          dio: Dio()..httpClientAdapter = adapter,
        ),
      );

      await repository.create(
        'profile-a',
        const LifeEventInput(
          category: LifeEventCategory.property,
          type: LifeEventType.propertyPurchase,
          date: LifeEventDate(
            precision: LifeEventPrecision.day,
            year: 2020,
            month: 4,
            day: 5,
          ),
        ),
      );
      await repository.create(
        'profile-a',
        const LifeEventInput(
          category: LifeEventCategory.vehicle,
          type: LifeEventType.vehiclePurchase,
          date: LifeEventDate(
            precision: LifeEventPrecision.month,
            year: 2021,
            month: 4,
          ),
        ),
      );
      await repository.create(
        'profile-a',
        const LifeEventInput(
          category: LifeEventCategory.relationshipsFamily,
          type: LifeEventType.marriage,
          date: LifeEventDate(precision: LifeEventPrecision.year, year: 2022),
        ),
      );
      await repository.create(
        'profile-a',
        const LifeEventInput(
          category: LifeEventCategory.relationshipsFamily,
          type: LifeEventType.childBirth,
          date: LifeEventDate(
            precision: LifeEventPrecision.day,
            year: 2023,
            month: 3,
            day: 4,
          ),
        ),
      );

      expect(adapter.requests, hasLength(4));
      expect(
        adapter.requests.map((request) => request.method),
        everyElement('POST'),
      );
      expect(
        adapter.requests.map((request) => request.path),
        everyElement('/v1/birth-profiles/profile-a/life-events'),
      );
      expect(adapter.requests[0].data, {
        'category': 'PROPERTY',
        'eventType': 'PROPERTY_PURCHASE',
        'eventDate': {'precision': 'DAY', 'year': 2020, 'month': 4, 'day': 5},
        'title': null,
        'note': null,
      });
      expect(adapter.requests[1].data['eventDate'], {
        'precision': 'MONTH',
        'year': 2021,
        'month': 4,
      });
      expect(adapter.requests[2].data['eventDate'], {
        'precision': 'YEAR',
        'year': 2022,
      });
      expect(adapter.requests[3].data['eventType'], 'CHILD_BIRTH');
    },
  );
}

Map<String, dynamic> _event(String type, String precision) => {
  'lifeEventId': 'event-$type',
  'birthProfileId': 'profile-a',
  'category': type.startsWith('PROPERTY')
      ? 'PROPERTY'
      : type.startsWith('VEHICLE')
      ? 'VEHICLE'
      : 'RELATIONSHIPS_FAMILY',
  'eventType': type,
  'eventDate': {
    'precision': precision,
    'year': 2020,
    'month': precision == 'YEAR' ? null : 4,
    'day': precision == 'DAY' ? 5 : null,
  },
  'title': null,
  'note': null,
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
