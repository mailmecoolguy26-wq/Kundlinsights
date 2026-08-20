import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/core/api/api_client.dart';
import 'package:kundlinsights_mobile/core/config/app_config.dart';
import 'package:kundlinsights_mobile/features/readings/data/reading_api_repository.dart';

void main() {
  const config = AppConfig.test(
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'public-key',
    apiBaseUrl: 'https://api.example.test',
  );

  test(
    'uses only frozen GET endpoints for profile-scoped history and detail',
    () async {
      final adapter = _Adapter([
        _json(200, {
          'readings': [_summary()],
        }),
        _json(200, {'reading': _detail()}),
      ]);
      final repository = ReadingApiRepository(
        ApiClient(
          config: config,
          tokens: _Tokens(),
          dio: Dio()..httpClientAdapter = adapter,
        ),
      );

      await repository.getReadings(birthProfileId: 'profile-a');
      final detail = await repository.getReadingDetail('reading-123');

      expect(adapter.requests, hasLength(2));
      expect(adapter.requests[0].method, 'GET');
      expect(adapter.requests[0].path, '/v1/readings');
      expect(adapter.requests[0].queryParameters, {
        'birthProfileId': 'profile-a',
      });
      expect(adapter.requests[1].method, 'GET');
      expect(adapter.requests[1].path, '/v1/readings/reading-123');
      expect(detail.readingId, 'reading-123');
      expect(
        adapter.requests.map((request) => request.path),
        isNot(contains('/v1/readings/reading-123/replay')),
      );
      expect(
        adapter.requests.every((request) => request.method == 'GET'),
        isTrue,
      );
    },
  );
}

Map<String, dynamic> _summary() => {
  'readingId': 'reading-123',
  'birthProfileId': 'profile-a',
  'domain': 'CAREER',
  'status': 'active',
  'createdAt': '2027-01-01T10:00:00.000Z',
  'readingInstant': '2027-01-01T10:00:00.000Z',
  'locale': 'en-IN',
};

Map<String, dynamic> _detail() => {
  ..._summary(),
  'content': {
    'domain': 'CAREER',
    'locale': 'en-IN',
    'sections': [
      {
        'section': 'CAREER_STRUCTURE',
        'headline': 'Career structure',
        'items': [
          {'headline': 'Career structure', 'sentence': 'Stored text.'},
        ],
      },
    ],
  },
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
  Future<String?> accessToken() async => 'access-token';
  @override
  Future<void> invalidate() async {}
  @override
  Future<String?> refreshAccessToken() async => 'access-token';
}
