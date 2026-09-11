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
    this.lagnaRashiIndex,
    this.careerContext,
  });

  final String birthProfileId;
  final String savRulesetId;
  final List<SignScore> sav;
  final List<Bav> bav;
  final Bav lagnaBav;
  final int? lagnaRashiIndex;
  final AshtakavargaCareerContext? careerContext;

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
      lagnaRashiIndex: _optionalRashiIndex(json['lagnaRashiIndex']),
      careerContext: AshtakavargaCareerContext.tryFromJson(
        json['careerContext'],
      ),
    );
  }

  List<SignScore> byHouse(List<SignScore> values) {
    final lagna = lagnaRashiIndex;
    if (lagna == null) return values;
    final bySign = {for (final value in values) value.rashiIndex: value};
    return List.unmodifiable(
      List.generate(12, (index) {
        final sign = ((lagna - 1 + index) % 12) + 1;
        return bySign[sign]!;
      }),
    );
  }
}

class AshtakavargaCareerValue {
  const AshtakavargaCareerValue({
    required this.house,
    required this.bindu,
    this.planet,
  });
  final int house, bindu;
  final String? planet;
  static AshtakavargaCareerValue? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic>) return null;
    final house = raw['house'], bindu = raw['bindu'], planet = raw['planet'];
    if (house is! int ||
        house < 1 ||
        house > 12 ||
        bindu is! int ||
        (planet != null && planet is! String)) {
      return null;
    }
    return AshtakavargaCareerValue(
      house: house,
      bindu: bindu,
      planet: planet as String?,
    );
  }
}

class AshtakavargaCareerContext {
  const AshtakavargaCareerContext({
    required this.h2Sav,
    required this.h10Sav,
    required this.h11Sav,
    required this.h10LagnaBav,
    this.h10LordBav,
  });
  final AshtakavargaCareerValue h2Sav, h10Sav, h11Sav, h10LagnaBav;
  final AshtakavargaCareerValue? h10LordBav;
  static AshtakavargaCareerContext? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic>) return null;
    final h2 = AshtakavargaCareerValue.tryFromJson(raw['h2Sav']),
        h10 = AshtakavargaCareerValue.tryFromJson(raw['h10Sav']),
        h11 = AshtakavargaCareerValue.tryFromJson(raw['h11Sav']),
        lagna = AshtakavargaCareerValue.tryFromJson(raw['h10LagnaBav']);
    if (h2 == null || h10 == null || h11 == null || lagna == null) {
      return null;
    }
    return AshtakavargaCareerContext(
      h2Sav: h2,
      h10Sav: h10,
      h11Sav: h11,
      h10LagnaBav: lagna,
      h10LordBav: AshtakavargaCareerValue.tryFromJson(raw['h10LordBav']),
    );
  }
}

int? _optionalRashiIndex(Object? value) =>
    value is int && value >= 1 && value <= 12 ? value : null;

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
