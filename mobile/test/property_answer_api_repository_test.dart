import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/core/api/api_client.dart';
import 'package:kundlinsights_mobile/core/config/app_config.dart';
import 'package:kundlinsights_mobile/features/property/data/property_answer_api_repository.dart';
import 'package:kundlinsights_mobile/features/property/domain/property_answer.dart';

void main() {
  test(
    'uses the server-owned Property endpoint and preserves its window',
    () async {
      final adapter = _Adapter();
      final repository = PropertyAnswerApiRepository(
        ApiClient(
          config: const AppConfig.test(
            supabaseUrl: 'https://project.supabase.co',
            supabaseAnonKey: 'public',
            apiBaseUrl: 'https://api.example.test',
          ),
          tokens: _Tokens(),
          dio: Dio()..httpClientAdapter = adapter,
        ),
      );

      final answer = await repository.getAnswer(
        birthProfileId: 'profile-a',
        intent: PropertyIntent.purchaseTiming,
      );

      expect(adapter.request.method, 'POST');
      expect(
        adapter.request.path,
        '/v1/birth-profiles/profile-a/property-answers',
      );
      expect(adapter.request.data, {'intent': 'PROPERTY_PURCHASE_TIMING'});
      expect(answer.classification, 'MODERATE');
      expect(
        answer.strongerWindow!.start,
        DateTime.parse('2026-10-01T00:00:00.000Z'),
      );
      expect(
        answer.strongerWindow!.end,
        DateTime.parse('2026-11-20T00:00:00.000Z'),
      );
    },
  );
}

class _Tokens implements AccessTokenSource {
  @override
  Future<String?> accessToken() async => 'token';
  @override
  Future<void> invalidate() async {}
  @override
  Future<String?> refreshAccessToken() async => 'token';
}

class _Adapter implements HttpClientAdapter {
  late RequestOptions request;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? stream,
    Future<void>? cancel,
  ) async {
    request = options;
    return ResponseBody.fromString(
      jsonEncode({
        'propertyAnswer': {
          'intent': 'PROPERTY_PURCHASE_TIMING',
          'answerability': 'SUPPORTED',
          'classification': 'MODERATE',
          'windowStatus': 'BOUNDED_WINDOW',
          'strongerWindow': {
            'start': '2026-10-01T00:00:00.000Z',
            'end': '2026-11-20T00:00:00.000Z',
            'temporalStatus': 'CURRENT',
            'timingClassification': 'BOUNDED_WINDOW',
          },
          'evidence': const {},
        },
      }),
      200,
      headers: {
        'content-type': ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}
