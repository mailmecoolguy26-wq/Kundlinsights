import 'dart:async';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/core/api/api_client.dart';
import 'package:kundlinsights_mobile/core/config/app_config.dart';
import 'package:kundlinsights_mobile/core/errors/api_failure.dart';
import 'package:kundlinsights_mobile/features/payments/data/payment_api_client.dart';

void main() {
  const config = AppConfig.test(
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'public-key',
    apiBaseUrl: 'https://api.example.test',
  );

  test(
    'adds a bearer access token and does not send a refresh token',
    () async {
      final adapter = _QueueAdapter([_json(200, '{"status":"ok"}')]);
      final tokens = _Tokens();
      final client = ApiClient(
        config: config,
        tokens: tokens,
        dio: Dio()..httpClientAdapter = adapter,
      );

      await client.get<Map<String, dynamic>>('/v1/me');

      expect(
        adapter.requests.single.headers['Authorization'],
        'Bearer access-token',
      );
      expect(
        adapter.requests.single.headers.values.join(),
        isNot(contains('refresh-token')),
      );
    },
  );

  test('captures request IDs in safe backend failure mapping', () async {
    final client = ApiClient(
      config: config,
      tokens: _Tokens(),
      dio: Dio()
        ..httpClientAdapter = _QueueAdapter([
          _json(403, '{"requestId":"req-42"}'),
        ]),
    );

    await expectLater(
      client.get<Map<String, dynamic>>('/v1/me'),
      throwsA(
        isA<ApiFailure>()
            .having((error) => error.kind, 'kind', ApiFailureKind.forbidden)
            .having((error) => error.requestId, 'requestId', 'req-42'),
      ),
    );
  });

  test('refreshes exactly once after a 401 before retrying', () async {
    final tokens = _Tokens();
    final adapter = _QueueAdapter([_json(401, '{}'), _json(200, '{}')]);
    final client = ApiClient(
      config: config,
      tokens: tokens,
      dio: Dio()..httpClientAdapter = adapter,
    );

    await client.get<Map<String, dynamic>>('/v1/me');

    expect(tokens.refreshes, 1);
    expect(adapter.requests, hasLength(2));
  });

  test('signs out after a failed refresh and second 401', () async {
    final tokens = _Tokens();
    final client = ApiClient(
      config: config,
      tokens: tokens,
      dio: Dio()
        ..httpClientAdapter = _QueueAdapter([
          _json(401, '{}'),
          _json(401, '{}'),
        ]),
    );

    await expectLater(
      client.get<Map<String, dynamic>>('/v1/me'),
      throwsA(isA<ApiFailure>()),
    );
    expect(tokens.refreshes, 1);
    expect(tokens.invalidated, 1);
  });

  test(
    'gets the latest unresolved Razorpay order for the exact profile',
    () async {
      final adapter = _QueueAdapter([
        _json(
          200,
          '{"order":{"providerOrderId":"order-1","status":"CREATED",'
          '"logicalSku":"career_premium_annual","finalized":false}}',
        ),
      ]);
      final api = AuthenticatedPaymentApiClient(
        ApiClient(
          config: config,
          tokens: _Tokens(),
          dio: Dio()..httpClientAdapter = adapter,
        ),
      );

      final result = await api.getLatestUnresolvedRazorpayOrder(
        birthProfileId: 'profile-id',
      );

      expect(
        adapter.requests.single.path,
        '/v1/payments/razorpay/unresolved-order',
      );
      expect(adapter.requests.single.queryParameters, {
        'birthProfileId': 'profile-id',
      });
      expect(result['order'], {
        'providerOrderId': 'order-1',
        'status': 'CREATED',
        'logicalSku': 'career_premium_annual',
        'finalized': false,
      });
    },
  );

  test('keeps an empty unresolved Razorpay order response intact', () async {
    final api = AuthenticatedPaymentApiClient(
      ApiClient(
        config: config,
        tokens: _Tokens(),
        dio: Dio()
          ..httpClientAdapter = _QueueAdapter([_json(200, '{"order":null}')]),
      ),
    );

    expect(
      await api.getLatestUnresolvedRazorpayOrder(birthProfileId: 'profile-id'),
      {'order': null},
    );
  });

  test(
    'unavailable payments fail consistently for unresolved Razorpay lookup',
    () {
      expect(
        () => UnavailablePaymentApiClient().getLatestUnresolvedRazorpayOrder(
          birthProfileId: 'profile-id',
        ),
        throwsA(isA<StateError>()),
      );
    },
  );
}

ResponseBody _json(int status, String body) => ResponseBody.fromString(
  body,
  status,
  headers: {
    'content-type': ['application/json'],
  },
);

class _QueueAdapter implements HttpClientAdapter {
  _QueueAdapter(this.responses);

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
  int refreshes = 0;
  int invalidated = 0;

  @override
  Future<String?> accessToken() async => 'access-token';

  @override
  Future<void> invalidate() async => invalidated++;

  @override
  Future<String?> refreshAccessToken() async {
    refreshes++;
    return 'refreshed-access-token';
  }
}
