import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/core/api/api_client.dart';
import 'package:kundlinsights_mobile/core/config/app_config.dart';
import 'package:kundlinsights_mobile/features/career_chat/data/career_chat_api_repository.dart';
import 'package:kundlinsights_mobile/features/career_chat/domain/career_chat.dart';

void main() {
  const config = AppConfig.test(
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'public-key',
    apiBaseUrl: 'https://api.example.test',
  );

  test(
    'retains the just-persisted premium action if the history reload omits it',
    () async {
      final adapter = _Adapter([
        _json(201, {
          'assistantMessage': {
            'messageId': 'assistant-1',
            'role': 'assistant',
            'content': 'Career Premium teaser.',
            'createdAt': '2026-10-14T00:00:00.000Z',
            'action': {
              'type': 'OPEN_CAREER_PREMIUM',
              'label': 'Unlock Career Premium',
            },
          },
        }),
        _json(200, {
          'conversation': _conversation(),
          'messages': [
            {
              'messageId': 'assistant-1',
              'role': 'assistant',
              'content': 'Career Premium teaser.',
              'createdAt': '2026-10-14T00:00:00.000Z',
            },
          ],
        }),
      ]);
      final repository = CareerChatApiRepository(
        ApiClient(
          config: config,
          tokens: _Tokens(),
          dio: Dio()..httpClientAdapter = adapter,
        ),
      );

      final detail = await repository.sendConversationMessage(
        birthProfileId: 'profile-a',
        conversationId: 'conversation-a',
        message: 'When is my Career likely to improve?',
        language: CareerChatLanguage.english,
      );

      expect(detail.messages.single.action?.type, 'OPEN_CAREER_PREMIUM');
      expect(detail.messages.single.action?.label, 'Unlock Career Premium');
      expect(adapter.requests.map((request) => request.method), [
        'POST',
        'GET',
      ]);
    },
  );
}

Map<String, dynamic> _conversation() => {
  'conversationId': 'conversation-a',
  'birthProfileId': 'profile-a',
  'title': 'Career timing',
  'createdAt': '2026-10-14T00:00:00.000Z',
  'updatedAt': '2026-10-14T00:00:00.000Z',
  'lastMessagePreview': 'Career Premium teaser.',
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
