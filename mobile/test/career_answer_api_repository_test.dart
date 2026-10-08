import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/core/api/api_client.dart';
import 'package:kundlinsights_mobile/core/config/app_config.dart';
import 'package:kundlinsights_mobile/features/career_answers/data/career_answer_api_repository.dart';
import 'package:kundlinsights_mobile/features/career_answers/domain/career_answer.dart';

void main() {
  const config = AppConfig.test(
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'public-key',
    apiBaseUrl: 'https://api.example.test',
  );

  CareerAnswerApiRepository repositoryFor(_RecordingAdapter adapter) =>
      CareerAnswerApiRepository(
        ApiClient(
          config: config,
          tokens: _Tokens(),
          dio: Dio()..httpClientAdapter = adapter,
        ),
      );

  test('uses a 45-second receive timeout only for job favourability', () async {
    final adapter = _RecordingAdapter();
    await repositoryFor(adapter).getAnswer(
      birthProfileId: 'profile-a',
      questionType: CareerQuestionType.jobFavourabilityTiming,
    );
    expect(adapter.requests.single.receiveTimeout, const Duration(seconds: 45));
  });

  test('keeps the normal timeout for other Career Answer questions', () async {
    final adapter = _RecordingAdapter();
    await repositoryFor(adapter).getAnswer(
      birthProfileId: 'profile-a',
      questionType: CareerQuestionType.currentCareerPhase,
    );
    expect(adapter.requests.single.receiveTimeout, isNull);
  });
}

class _Tokens implements AccessTokenSource {
  @override
  Future<String?> accessToken() async => 'access-token';

  @override
  Future<void> invalidate() async {}

  @override
  Future<String?> refreshAccessToken() async => 'refreshed-access-token';
}

class _RecordingAdapter implements HttpClientAdapter {
  final List<RequestOptions> requests = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return ResponseBody.fromString(
      '{"careerAnswer":{"questionType":"CURRENT_CAREER_PHASE",'
      '"answerability":"INSUFFICIENT_EVIDENCE","sourceReadingId":null,'
      '"answer":{"headline":"Limited","summary":"Limited",'
      '"limitation":"Limited","currentPhase":null,"window":null,'
      '"actionItems":[]},"agreement":{"availableMajorSignals":0,'
      '"alignedMajorSignals":0,"primaryEligibility":false,"supportSignals":[]}}}',
      200,
      headers: {
        'content-type': ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}
