import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/readings/domain/career_timing.dart';

void main() {
  test('supported CANONICAL v1 resolves to canonical immutable timing', () {
    final timing = CareerTimingDto.tryFromJson(_timing('CANONICAL'));
    expect(timing, isNotNull);
    expect(resolveCareerTiming(timing).source, CareerTimingSource.canonical);
    expect(timing!.current!.eligiblePeriod!.label, 'Supportive period');
    expect(timing.current!.refinement!.label, 'Strongest window');
    expect(
      () => timing.periods.add(timing.periods.single),
      throwsUnsupportedError,
    );
    expect(
      () => timing.periods.single.refinementWindows.add(
        timing.periods.single.refinementWindows.single,
      ),
      throwsUnsupportedError,
    );
  });

  test('legacy, SHADOW, unsupported, and malformed contracts use legacy', () {
    expect(resolveCareerTiming(null).source, CareerTimingSource.legacy);
    expect(
      resolveCareerTiming(CareerTimingDto.tryFromJson(_timing('SHADOW')))
          .source,
      CareerTimingSource.legacy,
    );
    expect(
      CareerTimingDto.tryFromJson({
        ..._timing('CANONICAL'),
        'contractVersion': 'career-timing-production-v2',
      }),
      isNull,
    );
    expect(
      CareerTimingDto.tryFromJson({
        ..._timing('CANONICAL'),
        'periods': [
          {
            ...(_timing('CANONICAL')['periods'] as List).single
                as Map<String, dynamic>,
            'end': 'bad',
          },
        ],
      }),
      isNull,
    );
  });

  test('null current, next, and strongest window parse safely', () {
    final json = _timing('CANONICAL');
    final period = Map<String, dynamic>.from(
      (json['periods'] as List).single as Map<String, dynamic>,
    )..['strongestWindow'] = null;
    json['periods'] = [period];
    json['current'] = null;
    json['next'] = null;
    final timing = CareerTimingDto.tryFromJson(json);
    expect(timing, isNotNull);
    expect(timing!.current, isNull);
    expect(timing.next, isNull);
    expect(timing.periods.single.strongestWindow, isNull);
  });
}

Map<String, dynamic> _timing(String authority) {
  final refinement = {
    'windowId': 'window-1',
    'start': '2026-11-10T00:00:00.000Z',
    'end': '2026-11-20T00:00:00.000Z',
    'internalTier': 'PEAK',
    'label': 'Strongest window',
    'reasonSummary': {
      'primaryDashaConvergence': 'STRONG_CONVERGENCE',
      'pdRefinement': 'PEAK_SUPPORT',
      'd10Confirmation': 'CONFIRMS',
      'transitConfirmation': 'JUPITER_ONLY',
    },
    'evidence': {
      'pd': 'PEAK_SUPPORT',
      'd10': 'CONFIRMS',
      'jupiter': 'CONFIRMS',
      'saturn': 'NOT_CONFIRMED',
      'ashtakavarga': 'RAW_CONTEXT',
    },
  };
  final period = {
    'periodId': 'period-1',
    'start': '2026-11-01T00:00:00.000Z',
    'end': '2026-12-01T00:00:00.000Z',
    'internalState': 'SUPPORTIVE',
    'label': 'Supportive period',
    'convergence': 'STRONG_CONVERGENCE',
    'strongestWindow': refinement,
    'refinementWindows': [refinement],
  };
  return {
    'contractVersion': 'career-timing-production-v1',
    'timingEngineVersion': 'career-timing-v2-production-1',
    'eligibilityRuleset': 'career-timing-v2.2-shadow-1',
    'refinementRuleset': 'career-timing-v2.3-shadow-1',
    'authority': authority,
    'intervalSemantics': 'HALF_OPEN',
    'periods': [period],
    'current': {'eligiblePeriod': period, 'activeRefinement': refinement},
    'next': null,
    'explanationPolicy': {
      'outcomeGuarantee': false,
      'customerTimingLanguage': 'SUPPORT_ONLY',
      'ashtakavargaRole': 'CONTEXT_ONLY',
      'historicalEventsRole': 'NOT_USED_FOR_ELIGIBILITY_OR_REFINEMENT',
    },
  };
}
