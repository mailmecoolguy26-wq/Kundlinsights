import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/core/api/api_client.dart';
import 'package:kundlinsights_mobile/core/config/app_config.dart';
import 'package:kundlinsights_mobile/features/relationships/data/relationship_answer_api_repository.dart';
import 'package:kundlinsights_mobile/features/relationships/domain/relationship_answer.dart';

void main() {
  test(
    'uses the server-owned Relationship endpoint and parses optional data',
    () async {
      final adapter = _Adapter();
      final repository = RelationshipAnswerApiRepository(
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
        intent: RelationshipIntent.outlook,
      );
      expect(adapter.request.method, 'POST');
      expect(
        adapter.request.path,
        '/v1/birth-profiles/profile-a/relationship-answers',
      );
      expect(adapter.request.data, {'intent': 'RELATIONSHIP_OUTLOOK'});
      expect(answer.state, 'Consolidation');
      expect(answer.strongerWindow?.temporalStatus, 'CURRENT');
      expect(answer.marriageOutlook?.message, contains('supportive'));
      expect(answer.detailedAstrology.containsKey('d9Navamsa'), isTrue);
    },
  );

  test(
    'parses absent optional sections defensively without inventing a window',
    () {
      final answer = RelationshipAnswer.fromJson({
        'intent': 'RELATIONSHIP_OUTLOOK',
        'state': 'Insufficient Evidence',
        'answerability': 'SUPPORTED',
        'strongerWindow': {'start': 'bad', 'end': 'also-bad'},
        'marriageOutlook': null,
        'detailedAstrology': null,
      });
      expect(answer.strongerWindow, isNull);
      expect(answer.marriageOutlook, isNull);
      expect(answer.detailedAstrology, isEmpty);
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
        'relationshipAnswer': {
          'intent': 'RELATIONSHIP_OUTLOOK',
          'answerability': 'SUPPORTED',
          'state': 'Consolidation',
          'summary': 'Relationship timing emphasizes stability.',
          'currentPhase': 'Consolidation',
          'strongerWindow': {
            'start': '2026-10-01T00:00:00.000Z',
            'end': '2026-11-20T00:00:00.000Z',
            'state': 'Consolidation',
            'temporalStatus': 'CURRENT',
          },
          'marriageOutlook': {
            'state': 'COMMITMENT_SUPPORTIVE',
            'message': 'This period is relatively supportive for commitment.',
            'limitations': ['NO_GUARANTEED_MARRIAGE'],
          },
          'detailedAstrology': {
            'd9Navamsa': {'confirmation': 'Neutral'},
          },
          'ruleVersion': 'relationship-marriage-rules-v1',
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
