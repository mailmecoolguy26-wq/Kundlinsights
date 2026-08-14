import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/core/api/api_client.dart';
import 'package:kundlinsights_mobile/core/config/app_config.dart';
import 'package:kundlinsights_mobile/core/errors/api_failure.dart';
import 'package:kundlinsights_mobile/features/natal/data/natal_summary_api_repository.dart';
import 'package:kundlinsights_mobile/features/natal/domain/natal_summary.dart';

void main() {
  const config = AppConfig.test(
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'public-key',
    apiBaseUrl: 'https://api.example.test',
  );

  test(
    'parses the frozen API-P3 DTO and preserves backend fields directly',
    () async {
      final adapter = _Adapter([
        _json(200, {'natalSummary': _summary('profile-a')}),
      ]);
      final repository = NatalSummaryApiRepository(
        ApiClient(
          config: config,
          tokens: _Tokens(),
          dio: Dio()..httpClientAdapter = adapter,
        ),
      );

      final summary = await repository.getNatalSummary('profile-a');

      expect(
        adapter.requests.single.path,
        '/v1/birth-profiles/profile-a/natal-summary',
      );
      expect(
        summary.planets.map((planet) => planet.body),
        Graha.values.map((graha) => graha.apiName),
      );
      final moon = summary.planet(Graha.moon)!;
      expect(moon.degreeWithinSign, 7.125);
      expect(moon.longitude, 319.519869761);
      expect(moon.house, 12);
      expect(moon.retrograde, isTrue);
      expect(summary.houses, hasLength(12));
      expect(summary.houses.first.house, 1);
      expect(summary.houses.first.sign.rashiIndex, 1);
    },
  );

  test(
    'rejects malformed DTOs and preserves existing safe API failure mapping',
    () async {
      final malformed = NatalSummaryApiRepository(
        ApiClient(
          config: config,
          tokens: _Tokens(),
          dio: Dio()
            ..httpClientAdapter = _Adapter([
              _json(200, {
                'natalSummary': {'birthProfileId': 'profile-a'},
              }),
            ]),
        ),
      );
      await expectLater(
        malformed.getNatalSummary('profile-a'),
        throwsA(isA<FormatException>()),
      );

      final unavailable = NatalSummaryApiRepository(
        ApiClient(
          config: config,
          tokens: _Tokens(),
          dio: Dio()
            ..httpClientAdapter = _Adapter([
              _json(404, {
                'requestId': 'request-4',
                'error': {'code': 'NOT_FOUND_OR_FORBIDDEN'},
              }),
            ]),
        ),
      );
      await expectLater(
        unavailable.getNatalSummary('profile-a'),
        throwsA(
          isA<ApiFailure>().having(
            (error) => error.kind,
            'kind',
            ApiFailureKind.notFound,
          ),
        ),
      );
    },
  );
}

Map<String, dynamic> _summary(String id) => {
  'birthProfileId': id,
  'summary': {
    'ascendant': _position(
      'Ascendant',
      retrograde: false,
      speed: null,
      motion: null,
    ),
    'moon': {'sign': _sign, 'nakshatra': _nakshatra, 'pada': 2},
    'sun': {'sign': _sign},
  },
  'houses': List.generate(
    12,
    (index) => {
      'house': index + 1,
      'sign': {
        'rashiIndex': index + 1,
        'sanskritName': 'Sign ${index + 1}',
        'englishName': 'Sign ${index + 1}',
      },
    },
  ),
  'planets': Graha.values.map((graha) => _position(graha.apiName)).toList(),
};

const _sign = {
  'rashiIndex': 11,
  'sanskritName': 'Kumbha',
  'englishName': 'Aquarius',
};
const _nakshatra = {'nakshatraIndex': 24, 'name': 'Shatabhisha'};
Map<String, dynamic> _position(
  String body, {
  bool retrograde = true,
  double? speed = -0.1,
  String? motion = 'retrograde',
}) => {
  'body': body,
  'longitude': 319.519869761,
  'sign': _sign,
  'degreeWithinSign': 7.125,
  'house': 12,
  'nakshatra': _nakshatra,
  'pada': 2,
  'speed': speed,
  'motion': motion,
  'retrograde': retrograde,
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
  Future<String?> refreshAccessToken() async => null;
}
