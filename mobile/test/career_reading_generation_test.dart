import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/core/api/api_client.dart';
import 'package:kundlinsights_mobile/core/config/app_config.dart';
import 'package:kundlinsights_mobile/features/readings/data/career_reading_generation_api_repository.dart';

void main() {
  test(
    'uses frozen entitlement GET and CAREER create POST contracts',
    () async {
      final adapter = _Adapter([
        _json(200, {
          'entitlements': {
            'career': {'eligible': true},
          },
        }),
        _json(201, {
          'reading': {'readingId': 'reading-123'},
        }),
      ]);
      final repo = CareerReadingGenerationApiRepository(
        ApiClient(
          config: const AppConfig.test(
            supabaseUrl: 'https://project.supabase.co',
            supabaseAnonKey: 'key',
            apiBaseUrl: 'https://api.example.test',
          ),
          tokens: _Tokens(),
          dio: Dio()..httpClientAdapter = adapter,
        ),
      );
      expect((await repo.getCareerEligibility()).eligible, isTrue);
      expect(
        (await repo.createCareerReading(
          birthProfileId: 'profile-a',
          idempotencyKey: 'attempt-1',
        )).readingId,
        'reading-123',
      );
      expect(adapter.requests[0].method, 'GET');
      expect(adapter.requests[0].path, '/v1/me/entitlements');
      expect(adapter.requests[1].method, 'POST');
      expect(adapter.requests[1].path, '/v1/readings');
      expect(adapter.requests[1].data, {
        'birthProfileId': 'profile-a',
        'domain': 'CAREER',
      });
      expect(adapter.requests[1].headers['Idempotency-Key'], 'attempt-1');
    },
  );
}

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
    RequestOptions o,
    Stream<Uint8List>? s,
    Future<void>? c,
  ) async {
    requests.add(o);
    return responses.removeAt(0);
  }

  @override
  void close({bool force = false}) {}
}

class _Tokens implements AccessTokenSource {
  @override
  Future<String?> accessToken() async => 't';
  @override
  Future<String?> refreshAccessToken() async => 't';
  @override
  Future<void> invalidate() async {}
}
