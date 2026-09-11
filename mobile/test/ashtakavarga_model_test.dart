import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/ashtakavarga/domain/ashtakavarga.dart';

void main() {
  test('valid frozen API-P5B DTO parses without local calculation', () {
    final x = Ashtakavarga.fromJson(fixture());
    expect(x.sav, hasLength(12));
    expect(x.bav.map((v) => v.body), [
      'Sun',
      'Moon',
      'Mars',
      'Mercury',
      'Jupiter',
      'Venus',
      'Saturn',
    ]);
    expect(x.bav.every((v) => v.signScores.length == 12), true);
    expect(x.lagnaBav.signScores, hasLength(12));
    expect(x.sav.first.score, 17);
    expect(x.sav.first.rashiIndex, 1);
    expect(x.sav.first.sanskritName, 'S0');
  });
  test('rejects duplicate and missing SAV signs', () {
    final a = fixture();
    (a['sav'] as Map)['signScores'] = (a['sav'] as Map)['signScores'].sublist(
      1,
    );
    expect(() => Ashtakavarga.fromJson(a), throwsFormatException);
    final b = fixture();
    ((b['sav'] as Map)['signScores'] as List)[11] = {
      'sign': {'rashiIndex': 1, 'sanskritName': 'S0'},
      'score': 28,
    };
    expect(() => Ashtakavarga.fromJson(b), throwsFormatException);
  });

  test('requires the exact seven Graha BAV body set', () {
    final b = fixture();
    (b['bav'] as List)[0]['body'] = 'Rahu';
    expect(() => Ashtakavarga.fromJson(b), throwsFormatException);
    final c = fixture();
    (c['bav'] as List)[0]['body'] = 'Ketu';
    expect(() => Ashtakavarga.fromJson(c), throwsFormatException);
    final d = fixture();
    (d['bav'] as List).removeLast();
    expect(() => Ashtakavarga.fromJson(d), throwsFormatException);
    final e = fixture();
    (e['bav'] as List)[1]['body'] = 'Sun';
    expect(() => Ashtakavarga.fromJson(e), throwsFormatException);
    final f = fixture();
    (f['bav'] as List)[0]['body'] = 'Ascendant';
    expect(() => Ashtakavarga.fromJson(f), throwsFormatException);
  });

  test(
    'requires twelve unique signs for each BAV and separately for Lagna',
    () {
      final bav = fixture();
      ((bav['bav'] as List)[0]['signScores'] as List).removeLast();
      expect(() => Ashtakavarga.fromJson(bav), throwsFormatException);
      final lagna = fixture();
      ((lagna['lagnaBav'] as Map)['signScores'] as List)[11] = {
        'sign': {'rashiIndex': 1, 'sanskritName': 'S0'},
        'score': 99,
      };
      expect(() => Ashtakavarga.fromJson(lagna), throwsFormatException);
    },
  );

  test('rejects malformed required values while preserving exact scores', () {
    final malformedScore = fixture();
    (((malformedScore['bav'] as List)[0]['signScores'] as List)[0]
            as Map)['score'] =
        2.5;
    expect(() => Ashtakavarga.fromJson(malformedScore), throwsFormatException);
    final missingSign = fixture();
    (((missingSign['lagnaBav'] as Map)['signScores'] as List)[0]
        as Map)['sign'] = {
      'rashiIndex': 1,
    };
    expect(() => Ashtakavarga.fromJson(missingSign), throwsFormatException);
  });

  test('parses additive Lagna and factual Career context defensively', () {
    final value = fixture()
      ..['lagnaRashiIndex'] = 6
      ..['careerContext'] = {
        'h2Sav': {'house': 2, 'bindu': 21},
        'h10Sav': {'house': 10, 'bindu': 29},
        'h11Sav': {'house': 11, 'bindu': 27},
        'h10LagnaBav': {'house': 10, 'bindu': 3},
        'h10LordBav': {'planet': 'Jupiter', 'house': 10, 'bindu': 5},
        'unknown': true,
      };
    final parsed = Ashtakavarga.fromJson(value);
    expect(parsed.lagnaRashiIndex, 6);
    expect(parsed.careerContext!.h10LordBav!.planet, 'Jupiter');
    expect(parsed.careerContext!.h10LordBav!.bindu, 5);

    final legacy = Ashtakavarga.fromJson(fixture());
    expect(legacy.lagnaRashiIndex, isNull);
    expect(legacy.careerContext, isNull);
  });

  test('rotates sign scores into canonical one-based Bhav order', () {
    for (final lagna in [1, 6, 12]) {
      final value = fixture()..['lagnaRashiIndex'] = lagna;
      final parsed = Ashtakavarga.fromJson(value);
      final ordered = parsed.byHouse(parsed.sav);
      expect(ordered, hasLength(12));
      expect(ordered.map((score) => score.rashiIndex).toSet(), hasLength(12));
      expect(ordered.first.rashiIndex, lagna);
      expect(ordered.last.rashiIndex, ((lagna + 10) % 12) + 1);
      for (final score in ordered) {
        expect(score.score, 16 + score.rashiIndex);
      }
    }
  });
}

Map<String, dynamic> fixture() {
  List s(int n) => List.generate(
    12,
    (i) => {
      'sign': {'rashiIndex': i + 1, 'sanskritName': 'S$i'},
      'score': n + i,
    },
  );
  return {
    'birthProfileId': 'p',
    'sav': {'rulesetId': 'sav-v1', 'signScores': s(17)},
    'bav': ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']
        .map((b) => {'body': b, 'rulesetId': 'bav-v1', 'signScores': s(1)})
        .toList(),
    'lagnaBav': {'rulesetId': 'lagna-bav-v1', 'signScores': s(2)},
  };
}
