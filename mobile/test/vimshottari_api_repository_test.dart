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

  test('parses the additive safe Dasha insight context defensively', () async {
    final adapter = _Adapter([
      _json(200, {
        'vimshottari': _current('profile-a', insightContext: _insightContext()),
      }),
    ]);
    final current = await VimshottariApiRepository(_client(config, adapter))
        .getCurrent(birthProfileId: 'profile-a', atUtc: DateTime.utc(2027));

    final context = current.insightContext!;
    expect(context.currentPeriods.mahadasha.lord, 'Mercury');
    expect(context.currentPhase!.status, 'SUPPORTED');
    expect(context.currentPhase!.presentation.hinglish, contains('Dasha'));
    expect(context.nextTransition!.level, 'PRATYANTAR');
    expect(context.careerRelevance!.active, isTrue);
    expect(
      context.classicalContext!.caution.english,
      contains('not a guaranteed'),
    );
  });

  test(
    'keeps Dasha facts when optional insight details are malformed',
    () async {
      final insight = _insightContext()
        ..['currentPhase'] = {'status': 'NOT_A_STATUS'}
        ..['nextTransition'] = {'level': 'UNKNOWN', 'lord': 'Ketu'};
      final adapter = _Adapter([
        _json(200, {
          'vimshottari': _current('profile-a', insightContext: insight),
        }),
      ]);
      final current = await VimshottariApiRepository(_client(config, adapter))
          .getCurrent(birthProfileId: 'profile-a', atUtc: DateTime.utc(2027));

      expect(current.mahadasha.lord, 'Mercury');
      expect(current.insightContext, isNotNull);
      expect(current.insightContext!.currentPhase, isNull);
      expect(current.insightContext!.nextTransition, isNull);
      expect(current.insightContext!.careerRelevance, isNotNull);
    },
  );

  test('tolerates legacy current responses without insight context', () async {
    final adapter = _Adapter([
      _json(200, {'vimshottari': _current('profile-a')}),
    ]);
    final current = await VimshottariApiRepository(_client(config, adapter))
        .getCurrent(birthProfileId: 'profile-a', atUtc: DateTime.utc(2027));

    expect(current.insightContext, isNull);
    expect(current.pratyantardasha.lord, 'Sun');
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

  test(
    'requests and parses the canonical Mahadasha root without a legacy window',
    () async {
      final adapter = _Adapter([
        _json(200, {'vimshottariTimeline': _scoped('profile-a', 'md')}),
      ]);
      final timeline = await VimshottariApiRepository(_client(config, adapter))
          .getMahadashaTimeline(birthProfileId: 'profile-a');
      expect(adapter.requests.single.queryParameters, {
        'level': 'md',
        'root': 'true',
      });
      expect(timeline.periods.first, isA<DashaTimelinePeriod>());
      expect(timeline.periods[1].status, 'CURRENT');
      expect(timeline.periods.last.lord, 'Saturn');
    },
  );

  test('preserves exact canonical selectors and backend parents for scoped child timelines', () async {
    const md = '2024-01-01T00:00:00.123Z';
    const ad = '2025-02-03T04:05:06.789Z';
    final adapter = _Adapter([
      _json(200, {'vimshottariTimeline': _scoped('profile-a', 'ad', md: md)}),
      _json(200, {
        'vimshottariTimeline': _scoped('profile-a', 'pd', md: md, ad: ad),
      }),
    ]);
    final repository = VimshottariApiRepository(_client(config, adapter));
    final antardasha = await repository.getAntardashaTimeline(
      birthProfileId: 'profile-a',
      mahadashaStartUtc: DateTime.parse(md),
    );
    final pratyantar = await repository.getPratyantarTimeline(
      birthProfileId: 'profile-a',
      mahadashaStartUtc: DateTime.parse(md),
      antardashaStartUtc: DateTime.parse(ad),
    );
    expect(adapter.requests[0].queryParameters, {
      'level': 'ad',
      'mahadashaStart': md,
    });
    expect(adapter.requests[1].queryParameters, {
      'level': 'pd',
      'mahadashaStart': md,
      'antardashaStart': ad,
    });
    expect(antardasha.parent!.start, md);
    expect(antardasha.periods, hasLength(9));
    expect(pratyantar.mahadashaParent!.start, md);
    expect(pratyantar.antardashaParent!.start, ad);
    expect(pratyantar.periods, hasLength(9));
  });

  test('scoped timeline parsing ignores unknown fields but rejects malformed required data', () {
    final valid = _scoped('profile-a', 'pd')
      ..['unrecognized'] = {'future': true};
    final parsed = DashaScopedTimeline.fromJson(valid);
    expect(parsed.periods, hasLength(9));
    expect(parsed.mahadashaParent!.lord, 'Jupiter');

    final empty = _scoped('profile-a', 'md')..['periods'] = [];
    expect(DashaScopedTimeline.fromJson(empty).periods, isEmpty);

    final missingParent = _scoped('profile-a', 'pd')
      ..['parents'] = {'mahadasha': _scoped('profile-a', 'ad')['parent']};
    expect(
      () => DashaScopedTimeline.fromJson(missingParent),
      throwsFormatException,
    );

    final invalidChild = _scoped('profile-a', 'md')
      ..['periods'] = [
        {'level': 'MAHADASHA', 'lord': 'Jupiter', 'start': 'not-a-date'},
      ];
    expect(
      () => DashaScopedTimeline.fromJson(invalidChild),
      throwsFormatException,
    );
  });
}

ApiClient _client(AppConfig config, _Adapter adapter) => ApiClient(
  config: config,
  tokens: _Tokens(),
  dio: Dio()..httpClientAdapter = adapter,
);

Map<String, dynamic> _current(
  String id, {
  Map<String, dynamic>? insightContext,
}) {
  final current = <String, dynamic>{
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
  if (insightContext != null) current['insightContext'] = insightContext;
  return current;
}

Map<String, dynamic> _insightContext() => {
  'currentPeriods': {
    'mahadasha': {
      ..._period(
        'Mercury',
        '2026-01-01T00:00:00.000Z',
        '2043-01-01T00:00:00.000Z',
      ),
      'isCurrent': true,
    },
    'antardasha': {
      ..._period(
        'Venus',
        '2027-01-01T00:00:00.000Z',
        '2029-01-01T00:00:00.000Z',
      ),
      'isCurrent': true,
    },
    'pratyantardasha': {
      ..._period('Sun', '2027-01-01T00:00:00.000Z', '2027-02-01T00:00:00.000Z'),
      'isCurrent': true,
    },
  },
  'currentPhase': {
    'status': 'SUPPORTED',
    'timingLevel': 'ANTARDASHA',
    'lord': 'Venus',
    'presentation': {
      'english':
          'Career-related Dasha evidence is active in the current period.',
      'hinglish': 'Current Dasha mein Career-related evidence active hai.',
    },
  },
  'nextTransition': {
    'level': 'PRATYANTAR',
    'lord': 'Ketu',
    'starts': '2027-02-01T00:00:00.000Z',
  },
  'careerRelevance': {
    'active': true,
    'status': 'MIXED',
    'presentation': {
      'english': 'This Dasha period contributes to your current Career timing analysis.',
      'hinglish':
          'Yeh Dasha period aapki current Career timing analysis ka hissa hai.',
    },
  },
  'classicalContext': {
    'active': true,
    'status': 'SUPPORTED',
    'presentation': {
      'english': 'An audited classical Career rule is active in the current Dasha sequence.',
      'hinglish': 'Current Dasha sequence mein audited classical Career rule active hai.',
    },
    'cautionPresentation': {
      'english':
          'This is classical rule evidence, not a guaranteed Career outcome.',
      'hinglish':
          'Yeh classical rule evidence hai, guaranteed Career outcome nahi.',
    },
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

Map<String, dynamic> _scoped(
  String id,
  String level, {
  String md = '2024-01-01T00:00:00.123Z',
  String ad = '2025-02-03T04:05:06.789Z',
}) {
  final childLevel = level == 'md'
      ? 'MAHADASHA'
      : level == 'ad'
      ? 'ANTARDASHA'
      : 'PRATYANTAR';
  final periods = List.generate(
    9,
    (index) => {
      'level': childLevel,
      'lord': ['Jupiter', 'Rahu', 'Saturn'][index % 3],
      'start': DateTime.utc(2024 + index, 1, 1).toIso8601String(),
      'end': DateTime.utc(2025 + index, 1, 1).toIso8601String(),
      'status': index == 1
          ? 'CURRENT'
          : index < 1
          ? 'COMPLETED'
          : 'UPCOMING',
    },
  );
  return {
    'birthProfileId': id,
    'level': level,
    'count': periods.length,
    'periods': periods,
    if (level == 'ad')
      'parent': {
        'level': 'MAHADASHA',
        'lord': 'Jupiter',
        'start': md,
        'end': '2040-01-01T00:00:00.000Z',
        'status': 'CURRENT',
      },
    if (level == 'pd')
      'parents': {
        'mahadasha': {
          'level': 'MAHADASHA',
          'lord': 'Jupiter',
          'start': md,
          'end': '2040-01-01T00:00:00.000Z',
          'status': 'CURRENT',
        },
        'antardasha': {
          'level': 'ANTARDASHA',
          'lord': 'Rahu',
          'start': ad,
          'end': '2027-01-01T00:00:00.000Z',
          'status': 'CURRENT',
        },
      },
  };
}

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
