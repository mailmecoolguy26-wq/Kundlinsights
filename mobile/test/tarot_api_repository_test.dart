import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/core/api/api_client.dart';
import 'package:kundlinsights_mobile/core/config/app_config.dart';
import 'package:kundlinsights_mobile/features/tarot/data/tarot_api_repository.dart';
import 'package:kundlinsights_mobile/features/tarot/domain/tarot.dart';

void main() {
  test(
    'creates a reading with an idempotency key and no birth profile',
    () async {
      final adapter = _Adapter();
      final repository = TarotApiRepository(_client(adapter));
      final result = await repository.startReading(
        question: 'What should I reflect on?',
        idempotencyKey: 'create-key',
        language: 'ENGLISH',
      );
      expect(result, isA<TarotStartReady>());
      expect(adapter.request.path, '/v1/tarot/readings');
      expect(adapter.request.headers['Idempotency-Key'], 'create-key');
      expect(adapter.request.data, {
        'question': 'What should I reflect on?',
        'language': 'ENGLISH',
      });
      expect(adapter.request.data.toString(), isNot(contains('birthProfile')));
    },
  );

  test('selects the exact opaque token idempotently', () async {
    final adapter = _Adapter(selection: true);
    final repository = TarotApiRepository(_client(adapter));
    final reading = await repository.selectCard(
      readingId: 'reading-a',
      selectionToken: 'opaque-token',
      idempotencyKey: 'selection-key',
    );
    expect(adapter.request.path, '/v1/tarot/readings/reading-a/select-card');
    expect(adapter.request.headers['Idempotency-Key'], 'selection-key');
    expect(adapter.request.data, {'selectionToken': 'opaque-token'});
    expect(reading.selectedCards.single.cardName, 'The Fool');
  });
}

ApiClient _client(HttpClientAdapter adapter) => ApiClient(
  config: const AppConfig.test(
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'public',
    apiBaseUrl: 'https://api.example.test',
  ),
  tokens: _Tokens(),
  dio: Dio()..httpClientAdapter = adapter,
);

class _Tokens implements AccessTokenSource {
  @override
  Future<String?> accessToken() async => 'token';
  @override
  Future<void> invalidate() async {}
  @override
  Future<String?> refreshAccessToken() async => 'token';
}

class _Adapter implements HttpClientAdapter {
  _Adapter({this.selection = false});
  final bool selection;
  late RequestOptions request;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    request = options;
    final reading = {
      'readingId': 'reading-a',
      'question': 'What should I reflect on?',
      'category': 'GENERAL_GUIDANCE',
      'spread': {'spreadType': 'GENERAL_GUIDANCE', 'positions': const []},
      'status': 'DRAWING',
      'selectedCards': selection
          ? [
              {
                'position': 1,
                'positionName': 'Situation',
                'cardId': 'MAJOR_FOOL',
                'cardName': 'The Fool',
                'orientation': 'UPRIGHT',
              },
            ]
          : const [],
      'selectableTokens': const ['opaque-token'],
      'createdAt': '2026-11-05T00:00:00.000Z',
    };
    return ResponseBody.fromString(
      jsonEncode(
        selection
            ? {'reading': reading, 'revealedCard': reading['selectedCards']}
            : {'state': 'READING_READY', 'reading': reading},
      ),
      200,
      headers: {
        'content-type': ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}
