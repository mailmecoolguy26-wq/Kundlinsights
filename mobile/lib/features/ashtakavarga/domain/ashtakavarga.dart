/// A backend-authoritative score for one D1 Rashi.
///
/// This model deliberately validates and preserves API-P5B data; it does not
/// derive Ashtakavarga values in Flutter.
class SignScore {
  const SignScore({
    required this.rashiIndex,
    required this.sanskritName,
    required this.score,
  });

  final int rashiIndex;
  final String sanskritName;
  final int score;

  factory SignScore.fromJson(Map<String, dynamic> json) {
    final sign = json['sign'];
    final rashiIndex = sign is Map<String, dynamic> ? sign['rashiIndex'] : null;
    final sanskritName = sign is Map<String, dynamic>
        ? sign['sanskritName']
        : null;
    final score = json['score'];
    if (rashiIndex is! int ||
        rashiIndex < 1 ||
        rashiIndex > 12 ||
        sanskritName is! String ||
        sanskritName.isEmpty ||
        score is! int) {
      throw const FormatException('Malformed authoritative sign score.');
    }
    return SignScore(
      rashiIndex: rashiIndex,
      sanskritName: sanskritName,
      score: score,
    );
  }
}

class Bav {
  const Bav({
    required this.body,
    required this.rulesetId,
    required this.signScores,
  });

  final String body;
  final String rulesetId;
  final List<SignScore> signScores;

  factory Bav.fromJson(Map<String, dynamic> json) => Bav(
    body: _requiredString(json, 'body'),
    rulesetId: _requiredString(json, 'rulesetId'),
    signScores: _parseSignScores(json),
  );
}

class Ashtakavarga {
  const Ashtakavarga({
    required this.birthProfileId,
    required this.savRulesetId,
    required this.sav,
    required this.bav,
    required this.lagnaBav,
  });

  final String birthProfileId;
  final String savRulesetId;
  final List<SignScore> sav;
  final List<Bav> bav;
  final Bav lagnaBav;

  factory Ashtakavarga.fromJson(Map<String, dynamic> json) {
    final birthProfileId = _requiredString(json, 'birthProfileId');
    final savJson = _requiredMap(json, 'sav');
    final lagnaJson = _requiredMap(json, 'lagnaBav');
    final rawBav = json['bav'];
    if (rawBav is! List) {
      throw const FormatException('Malformed authoritative BAV collection.');
    }
    final bav = List<Bav>.unmodifiable(
      rawBav.map((entry) {
        if (entry is! Map<String, dynamic>) {
          throw const FormatException('Malformed authoritative BAV.');
        }
        return Bav.fromJson(entry);
      }),
    );
    const expectedBodies = <String>{
      'Sun',
      'Moon',
      'Mars',
      'Mercury',
      'Jupiter',
      'Venus',
      'Saturn',
    };
    final bodySet = bav.map((entry) => entry.body).toSet();
    if (bav.length != expectedBodies.length ||
        bodySet.length != bav.length ||
        !bodySet.containsAll(expectedBodies)) {
      throw const FormatException('Unexpected authoritative BAV body set.');
    }

    final sav = _parseSignScores(savJson);
    final lagnaBav = Bav(
      body: 'Ascendant',
      rulesetId: _requiredString(lagnaJson, 'rulesetId'),
      signScores: _parseSignScores(lagnaJson),
    );
    if (!_hasExactTwelveRashis(sav) ||
        !_hasExactTwelveRashis(lagnaBav.signScores) ||
        bav.any((entry) => !_hasExactTwelveRashis(entry.signScores))) {
      throw const FormatException('Malformed authoritative Rashi score set.');
    }
    return Ashtakavarga(
      birthProfileId: birthProfileId,
      savRulesetId: _requiredString(savJson, 'rulesetId'),
      sav: sav,
      bav: bav,
      lagnaBav: lagnaBav,
    );
  }
}

Map<String, dynamic> _requiredMap(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! Map<String, dynamic>) {
    throw FormatException('Missing or malformed $key.');
  }
  return value;
}

String _requiredString(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! String || value.isEmpty) {
    throw FormatException('Missing or malformed $key.');
  }
  return value;
}

List<SignScore> _parseSignScores(Map<String, dynamic> json) {
  final rawScores = json['signScores'];
  if (rawScores is! List) {
    throw const FormatException('Missing or malformed signScores.');
  }
  return List<SignScore>.unmodifiable(
    rawScores.map((entry) {
      if (entry is! Map<String, dynamic>) {
        throw const FormatException('Malformed authoritative sign score.');
      }
      return SignScore.fromJson(entry);
    }),
  );
}

bool _hasExactTwelveRashis(List<SignScore> signScores) {
  if (signScores.length != 12) return false;
  return signScores.map((entry) => entry.rashiIndex).toSet().length == 12;
}
