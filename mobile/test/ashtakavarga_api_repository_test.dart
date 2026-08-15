import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/core/api/api_client.dart';
import 'package:kundlinsights_mobile/core/config/app_config.dart';
import 'package:kundlinsights_mobile/core/errors/api_failure.dart';
import 'package:kundlinsights_mobile/features/ashtakavarga/data/ashtakavarga_repository.dart';

import 'ashtakavarga_fixture.dart';

void main() {
  const config = AppConfig.test(
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'public-key',
    apiBaseUrl: 'https://api.example.test',
  );

  test(
    'uses the authenticated API client for the authoritative endpoint',
    () async {
      final adapter = _Adapter([
        _json(200, {'ashtakavarga': ashtakavargaFixture()}),
      ]);
      final repository = AshtakavargaApiRepository(_client(config, adapter));

      final result = await repository.getAshtakavarga(
        birthProfileId: 'profile-a',
      );

      expect(adapter.requests, hasLength(1));
      expect(adapter.requests.single.method, 'GET');
      expect(
        adapter.requests.single.path,
        '/v1/birth-profiles/profile-a/ashtakavarga',
      );
      expect(adapter.requests.single.queryParameters, isEmpty);
      expect(adapter.requests.single.data, isNull);
      expect(
        adapter.requests.single.headers['Authorization'],
        'Bearer access-token',
      );
      expect(result.birthProfileId, 'profile-a');
    },
  );

  test(
    'keeps API failures safely mapped by the shared authenticated client',
    () async {
      final adapter = _Adapter([
        _json(404, {
          'error': {'code': 'BIRTH_PROFILE_NOT_FOUND'},
          'requestId': 'request-123',
        }),
      ]);
      final repository = AshtakavargaApiRepository(_client(config, adapter));

      expect(
        () => repository.getAshtakavarga(birthProfileId: 'profile-a'),
        throwsA(
          isA<ApiFailure>()
              .having(
                (failure) => failure.kind,
                'kind',
                ApiFailureKind.notFound,
              )
              .having(
                (failure) => failure.requestId,
                'requestId',
                'request-123',
              ),
        ),
      );
    },
  );
}

ApiClient _client(AppConfig config, _Adapter adapter) => ApiClient(
  config: config,
  tokens: _Tokens(),
  dio: Dio()..httpClientAdapter = adapter,
);

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
  Future<String?> refreshAccessToken() async => null;
}
