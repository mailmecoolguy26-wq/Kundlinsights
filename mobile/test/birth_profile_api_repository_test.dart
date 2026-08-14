import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/core/api/api_client.dart';
import 'package:kundlinsights_mobile/core/config/app_config.dart';
import 'package:kundlinsights_mobile/features/profiles/data/birth_profile_api_repository.dart';

void main() {
  const config = AppConfig.test(
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'public-key',
    apiBaseUrl: 'https://api.example.test',
  );

  test('uses only committed place and profile APIs and preserves resolved birthData for creation', () async {
    final adapter = _Adapter([
      _json(
        200,
        '{"results":[{"id":"google-hyd","label":"Hyderabad, Telangana, India","latitude":17.385,"longitude":78.4867,"timezone":"Asia/Kolkata","timezoneProvenance":{"datasetVersion":"2026c"}}]}',
      ),
      _json(
        200,
        '{"birthData":{"localDate":"1990-11-26","localTime":"13:40:00","timezone":"Asia/Kolkata","utc":"1990-11-26T08:10:00.000Z","latitude":17.385,"longitude":78.4867,"timezoneProvenance":{"datasetVersion":"2026c"}}}',
      ),
      _json(
        201,
        '{"birthProfile":{"id":"profile-1","displayLabel":"Riya","status":"active","birthData":{"localDate":"1990-11-26","localTime":"13:40:00","timezone":"Asia/Kolkata","utc":"1990-11-26T08:10:00.000Z","latitude":17.385,"longitude":78.4867,"timezoneProvenance":{"datasetVersion":"2026c"}}}}',
      ),
    ]);
    final client = ApiClient(
      config: config,
      tokens: _Tokens(),
      dio: Dio()..httpClientAdapter = adapter,
    );
    final repository = BirthProfileApiRepository(client);

    final places = await repository.searchPlaces('Hyderabad');
    expect(adapter.requests.first.path, '/v1/places/search');
    expect(adapter.requests.first.queryParameters, {'q': 'Hyderabad'});
    expect(places.single.label, 'Hyderabad, Telangana, India');

    final resolved = await repository.resolveBirthTime(
      placeId: places.single.id,
      localDate: '1990-11-26',
      localTime: '13:40:00',
    );
    expect(adapter.requests[1].path, '/v1/places/resolve-birth-time');
    expect(adapter.requests[1].data, {
      'place': {'id': 'google-hyd'},
      'localDate': '1990-11-26',
      'localTime': '13:40:00',
    });
    final created = await repository.create(
      displayLabel: 'Riya',
      birthData: resolved,
    );
    expect(adapter.requests[2].path, '/v1/birth-profiles');
    expect(
      (adapter.requests[2].data as Map)['birthData'],
      same(resolved.value),
    );
    expect(created.displayLabel, 'Riya');
  });
}

ResponseBody _json(int status, String body) => ResponseBody.fromString(
  body,
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
  Future<String?> refreshAccessToken() async => 'access-token';
}
