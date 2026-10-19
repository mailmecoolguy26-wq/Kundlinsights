import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/core/api/api_client.dart';
import 'package:kundlinsights_mobile/core/config/app_config.dart';
import 'package:kundlinsights_mobile/features/vehicle/data/vehicle_answer_api_repository.dart';
import 'package:kundlinsights_mobile/features/vehicle/domain/vehicle_answer.dart';

void main() {
  test(
    'uses only the server Vehicle endpoint and preserves coalesced window',
    () async {
      final adapter = _Adapter();
      final repository = VehicleAnswerApiRepository(
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
        intent: VehicleIntent.purchaseTiming,
      );
      expect(adapter.request.method, 'POST');
      expect(
        adapter.request.path,
        '/v1/birth-profiles/profile-a/vehicle-answers',
      );
      expect(adapter.request.data, {'intent': 'VEHICLE_PURCHASE_TIMING'});
      expect(answer.candidateStrength, 'MODERATE_CANDIDATE');
      expect(
        answer.strongerWindow!.start,
        DateTime.parse('2026-07-18T21:55:32.729Z'),
      );
      expect(
        answer.strongerWindow!.end,
        DateTime.parse('2026-11-20T12:46:11.911Z'),
      );
      expect(answer.strongerWindow!.internalPhases, hasLength(2));
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
        'vehicleAnswer': {
          'intent': 'VEHICLE_PURCHASE_TIMING',
          'answerability': 'SUPPORTED',
          'classification': 'MODERATE_CANDIDATE',
          'windowShape': 'BOUNDED_WINDOW',
          'strongerWindow': {
            'start': '2026-07-18T21:55:32.729Z',
            'end': '2026-11-20T12:46:11.911Z',
            'candidateStrength': 'MODERATE_CANDIDATE',
            'windowShape': 'BOUNDED_WINDOW',
            'temporalStatus': 'CURRENT',
            'internalPhases': [{}, {}],
          },
          'evidence': {
            'natal': {'classification': 'CORE_AND_ACQUISITION'},
            'd16': {'confirmation': 'CONFIRMS'},
            'mdAd': {'classification': 'MODERATE_MD_AD_SUPPORT'},
            'transit': {'majorConfirmation': 'PARTIAL_MAJOR_CONFIRMATION'},
          },
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
