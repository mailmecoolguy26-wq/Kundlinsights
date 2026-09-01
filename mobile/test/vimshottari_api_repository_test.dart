import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/core/api/api_client.dart';
import 'package:kundlinsights_mobile/core/config/app_config.dart';
import 'package:kundlinsights_mobile/features/vimshottari/data/vimshottari_api_repository.dart';
import 'package:kundlinsights_mobile/features/vimshottari/domain/vimshottari.dart';

void main() {
  const config = AppConfig.test(
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'public-key',
    apiBaseUrl: 'https://api.example.test',
  );

  test(
    'preserves current MD AD and PD fields and sends explicit UTC at',
    () async {
      final adapter = _Adapter([
        _json(200, {'vimshottari': _current('profile-a')}),
      ]);
      final repository = VimshottariApiRepository(_client(config, adapter));
      final current = await repository.getCurrent(
        birthProfileId: 'profile-a',
        atUtc: DateTime.parse('2027-01-01T12:00:00+05:30'),
      );
      expect(
        adapter.requests.single.path,
        '/v1/birth-profiles/profile-a/vimshottari',
      );
      expect(
        adapter.requests.single.queryParameters['at'],
        '2027-01-01T06:30:00.000Z',
      );
      expect(current.mahadasha.lord, 'Mercury');
      expect(current.antardasha.lord, 'Venus');
      expect(current.pratyantardasha.lord, 'Sun');
      expect(current.pratyantardasha.start, '2027-01-01T00:00:00.000Z');
      expect(current.pratyantardasha.end, '2027-02-01T00:00:00.000Z');
    },
  );

  test('serializes current instants as canonical UTC milliseconds', () async {
    final adapter = _Adapter([
      _json(200, {'vimshottari': _current('profile-a')}),
    ]);
    final repository = VimshottariApiRepository(_client(config, adapter));

    await repository.getCurrent(
      birthProfileId: 'profile-a',
      atUtc: DateTime.utc(2026, 9, 1, 12, 34, 56, 123, 456),
    );

    expect(
      adapter.requests.single.path,
      '/v1/birth-profiles/profile-a/vimshottari',
    );
    expect(
      adapter.requests.single.queryParameters['at'],
      '2026-09-01T12:34:56.123Z',
    );
    expect(
      adapter.requests.single.queryParameters['at'],
      isNot(contains('.123456Z')),
    );
  });

  test(
    'preserves flat chronological MD AD PD timelines and parent context',
    () async {
      for (final level in VimshottariLevel.values) {
        final adapter = _Adapter([
          _json(200, {'vimshottariTimeline': _timeline('profile-a', level)}),
        ]);
        final repository = VimshottariApiRepository(_client(config, adapter));
        final timeline = await repository.getTimeline(
          birthProfileId: 'profile-a',
          fromUtc: DateTime.utc(2027),
          toUtc: DateTime.utc(2028),
          level: level,
        );
        expect(
          adapter.requests.single.path,
          '/v1/birth-profiles/profile-a/vimshottari/timeline',
        );
        expect(adapter.requests.single.queryParameters, {
          'from': '2027-01-01T00:00:00.000Z',
          'to': '2028-01-01T00:00:00.000Z',
          'level': level.apiValue,
        });
        expect(timeline.periods.first.lord, 'Mercury');
        expect(
          timeline.periods.first.mahadashaLord,
          level == VimshottariLevel.md ? null : 'Mercury',
        );
        expect(
          timeline.periods.first.antardashaLord,
          level == VimshottariLevel.pd ? 'Venus' : null,
        );
        expect(
          timeline.periods.first.startUtc.isBefore(
            timeline.periods.last.startUtc,
          ),
          isTrue,
        );
      }
    },
  );
}

ApiClient _client(AppConfig config, _Adapter adapter) => ApiClient(
  config: config,
  tokens: _Tokens(),
  dio: Dio()..httpClientAdapter = adapter,
);

Map<String, dynamic> _current(String id) => {
  'birthProfileId': id,
  'at': '2027-01-01T00:00:00.000Z',
  'current': {
    'mahadasha': _period(
      'Mercury',
      '2026-01-01T00:00:00.000Z',
      '2043-01-01T00:00:00.000Z',
    ),
    'antardasha': _period(
      'Venus',
      '2027-01-01T00:00:00.000Z',
      '2029-01-01T00:00:00.000Z',
      md: 'Mercury',
    ),
    'pratyantardasha': _period(
      'Sun',
      '2027-01-01T00:00:00.000Z',
      '2027-02-01T00:00:00.000Z',
      md: 'Mercury',
      ad: 'Venus',
    ),
  },
};

Map<String, dynamic> _timeline(String id, VimshottariLevel level) => {
  'birthProfileId': id,
  'level': level.apiValue,
  'from': '2027-01-01T00:00:00.000Z',
  'to': '2028-01-01T00:00:00.000Z',
  'periods': [
    _period(
      'Mercury',
      '2027-01-01T00:00:00.000Z',
      '2027-06-01T00:00:00.000Z',
      md: level == VimshottariLevel.md ? null : 'Mercury',
      ad: level == VimshottariLevel.pd ? 'Venus' : null,
    ),
    _period(
      'Ketu',
      '2027-06-01T00:00:00.000Z',
      '2027-12-01T00:00:00.000Z',
      md: level == VimshottariLevel.md ? null : 'Mercury',
      ad: level == VimshottariLevel.pd ? 'Venus' : null,
    ),
  ],
};

Map<String, dynamic> _period(
  String lord,
  String start,
  String end, {
  String? md,
  String? ad,
}) => {
  'lord': lord,
  'start': start,
  'end': end,
  ...md == null ? const <String, dynamic>{} : {'mahadashaLord': md},
  ...ad == null ? const <String, dynamic>{} : {'antardashaLord': ad},
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
