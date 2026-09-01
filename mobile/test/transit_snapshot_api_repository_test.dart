import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/core/api/api_client.dart';
import 'package:kundlinsights_mobile/core/config/app_config.dart';
import 'package:kundlinsights_mobile/features/transits/data/transit_snapshot_api_repository.dart';

void main() {
  test('serializes transit instants as canonical UTC milliseconds', () async {
    final adapter = _Adapter();
    final repository = TransitSnapshotApiRepository(
      ApiClient(
        config: const AppConfig.test(
          supabaseUrl: 'https://project.supabase.co',
          supabaseAnonKey: 'public-key',
          apiBaseUrl: 'https://api.example.test',
        ),
        tokens: _Tokens(),
        dio: Dio()..httpClientAdapter = adapter,
      ),
    );

    await repository.getTransitSnapshot(
      birthProfileId: 'profile-a',
      atUtc: DateTime.parse('2026-09-01T18:04:56.123456+05:30'),
    );

    expect(adapter.request.path, '/v1/birth-profiles/profile-a/transits');
    expect(adapter.request.queryParameters['at'], '2026-09-01T12:34:56.123Z');
    expect(adapter.request.queryParameters['at'], isNot(contains('.123456Z')));
  });
}

class _Adapter implements HttpClientAdapter {
  late RequestOptions request;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    request = options;
    return ResponseBody.fromString(
      jsonEncode({
        'transitSnapshot': {
          'birthProfileId': 'profile-a',
          'at': '2026-09-01T12:34:56.123Z',
          'planets': List.generate(
            9,
            (index) => {
              'planet': const [
                'Sun',
                'Moon',
                'Mars',
                'Mercury',
                'Jupiter',
                'Venus',
                'Saturn',
                'Rahu',
                'Ketu',
              ][index],
              'longitude': 1.0,
              'sign': {
                'rashiIndex': 1,
                'sanskritName': 'Mesha',
                'englishName': 'Aries',
              },
              'degreeWithinSign': 1.0,
              'natalHouse': 1,
              'motion': 'direct',
              'retrograde': false,
            },
          ),
          'sadeSati': {
            'active': false,
            'phase': 'none',
            'houseFromNatalMoon': 0,
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

class _Tokens implements AccessTokenSource {
  @override
  Future<String?> accessToken() async => 'access-token';

  @override
  Future<void> invalidate() async {}

  @override
  Future<String?> refreshAccessToken() async => null;
}
