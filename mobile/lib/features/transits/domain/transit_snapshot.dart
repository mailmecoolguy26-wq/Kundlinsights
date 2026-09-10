class TransitSign {
  const TransitSign({
    required this.rashiIndex,
    required this.sanskritName,
    required this.englishName,
  });
  final int rashiIndex;
  final String sanskritName;
  final String englishName;
  factory TransitSign.fromJson(Map<String, dynamic> json) => TransitSign(
    rashiIndex: _int(json, 'rashiIndex'),
    sanskritName: _string(json, 'sanskritName'),
    englishName: _string(json, 'englishName'),
  );
}

class TransitPlanet {
  const TransitPlanet({
    required this.planet,
    required this.longitude,
    required this.sign,
    required this.degreeWithinSign,
    required this.natalHouse,
    required this.motion,
    required this.retrograde,
  });
  final String planet;
  final double longitude;
  final TransitSign sign;
  final double degreeWithinSign;
  final int natalHouse;
  final String motion;
  final bool retrograde;
  factory TransitPlanet.fromJson(Map<String, dynamic> json) => TransitPlanet(
    planet: _string(json, 'planet'),
    longitude: _double(json, 'longitude'),
    sign: TransitSign.fromJson(_map(json, 'sign')),
    degreeWithinSign: _double(json, 'degreeWithinSign'),
    natalHouse: _int(json, 'natalHouse'),
    motion: _string(json, 'motion'),
    retrograde: _bool(json, 'retrograde'),
  );
}

class SadeSatiStatus {
  const SadeSatiStatus({
    required this.active,
    required this.phase,
    required this.houseFromNatalMoon,
  });
  final bool active;
  final String phase;
  final int houseFromNatalMoon;
  factory SadeSatiStatus.fromJson(Map<String, dynamic> json) => SadeSatiStatus(
    active: _bool(json, 'active'),
    phase: _string(json, 'phase'),
    houseFromNatalMoon: _int(json, 'houseFromNatalMoon'),
  );
}

class TransitSnapshot {
  const TransitSnapshot({
    required this.birthProfileId,
    required this.at,
    required this.planets,
    required this.sadeSati,
    this.insightContext,
  });
  static const grahas = [
    'Sun',
    'Moon',
    'Mars',
    'Mercury',
    'Jupiter',
    'Venus',
    'Saturn',
    'Rahu',
    'Ketu',
  ];
  final String birthProfileId;
  final String at;
  final List<TransitPlanet> planets;
  final SadeSatiStatus sadeSati;
  final TransitInsightContext? insightContext;
  factory TransitSnapshot.fromJson(Map<String, dynamic> json) {
    final at = _string(json, 'at');
    if (!at.endsWith('Z') || DateTime.tryParse(at) == null) {
      throw const FormatException('Transit snapshot timestamp is not UTC.');
    }
    final planets = List<TransitPlanet>.unmodifiable(
      _list(
        json,
        'planets',
      ).map((item) => TransitPlanet.fromJson(_asMap(item))),
    );
    final names = planets.map((planet) => planet.planet).toSet();
    if (planets.length != grahas.length ||
        names.length != grahas.length ||
        !grahas.every(names.contains)) {
      throw const FormatException('Transit snapshot has an invalid Graha set.');
    }
    return TransitSnapshot(
      birthProfileId: _string(json, 'birthProfileId'),
      at: at,
      planets: planets,
      sadeSati: SadeSatiStatus.fromJson(_map(json, 'sadeSati')),
      insightContext: TransitInsightContext.tryFromJson(
        _optionalMap(json, 'insightContext'),
      ),
    );
  }
}

class TransitPresentationCopy {
  const TransitPresentationCopy({
    required this.english,
    required this.hinglish,
  });
  final String english;
  final String hinglish;
  factory TransitPresentationCopy.fromJson(Map<String, dynamic> json) =>
      TransitPresentationCopy(
        english: _string(json, 'english'),
        hinglish: _string(json, 'hinglish'),
      );
}

class TransitActivatedHouse {
  const TransitActivatedHouse({required this.house, required this.planets});
  final int house;
  final List<String> planets;
  static TransitActivatedHouse? tryFromJson(Object? value) {
    if (value is! Map<String, dynamic>) return null;
    final planets = value['planets'];
    if (value['house'] is! int ||
        planets is! List ||
        !planets.every((item) => item is String)) {
      return null;
    }
    return TransitActivatedHouse(
      house: value['house'] as int,
      planets: List.unmodifiable(planets.cast<String>()),
    );
  }
}

class TransitCareerRelevance {
  const TransitCareerRelevance({
    required this.planet,
    required this.status,
    required this.presentation,
    this.instant,
  });
  final String planet;
  final String status;
  final TransitPresentationCopy presentation;
  final String? instant;
  static TransitCareerRelevance? tryFromJson(Object? value) {
    if (value is! Map<String, dynamic>) return null;
    try {
      if (!_statuses.contains(value['status'])) return null;
      final timing = _optionalMap(value, 'timing');
      final instant = timing == null ? null : _optionalUtc(timing, 'instant');
      return TransitCareerRelevance(
        planet: _string(value, 'planet'),
        status: _string(value, 'status'),
        presentation: TransitPresentationCopy.fromJson(
          _map(value, 'presentation'),
        ),
        instant: instant,
      );
    } on FormatException {
      return null;
    }
  }
}

class TransitSpecialState {
  const TransitSpecialState({
    required this.type,
    required this.planet,
    required this.status,
    required this.presentation,
    this.phase,
  });
  final String type, planet, status;
  final TransitPresentationCopy presentation;
  final String? phase;
  static TransitSpecialState? tryFromJson(Object? value) {
    if (value is! Map<String, dynamic>) return null;
    try {
      if (!const {'RETROGRADE', 'SADE_SATI'}.contains(value['type'])) {
        return null;
      }
      return TransitSpecialState(
        type: _string(value, 'type'),
        planet: _string(value, 'planet'),
        status: _string(value, 'status'),
        presentation: TransitPresentationCopy.fromJson(
          _map(value, 'presentation'),
        ),
        phase: _optionalString(value, 'phase'),
      );
    } on FormatException {
      return null;
    }
  }
}

class UpcomingTransitTransition {
  const UpcomingTransitTransition({
    required this.type,
    required this.planet,
    required this.at,
    this.fromSign,
    this.toSign,
    this.motionBefore,
    this.motionAfter,
    this.targetPlanet,
    this.house,
    this.change,
  });
  final String type, planet, at;
  final String? fromSign,
      toSign,
      motionBefore,
      motionAfter,
      targetPlanet,
      change;
  final int? house;
  static UpcomingTransitTransition? tryFromJson(Object? value) {
    if (value is! Map<String, dynamic>) return null;
    try {
      if (!const {
        'INGRESS',
        'STATION_RETROGRADE',
        'STATION_DIRECT',
        'DRISHTI_CHANGE',
        'ASSOCIATION_CHANGE',
        'SADE_SATI_PHASE_CHANGE',
      }.contains(value['type'])) {
        return null;
      }
      return UpcomingTransitTransition(
        type: _string(value, 'type'),
        planet: _string(value, 'planet'),
        at: _utc(value, 'at'),
        fromSign: _optionalString(value, 'fromSign'),
        toSign: _optionalString(value, 'toSign'),
        motionBefore: _optionalString(value, 'motionBefore'),
        motionAfter: _optionalString(value, 'motionAfter'),
        targetPlanet: _optionalString(value, 'targetPlanet'),
        house: value['house'] is int ? value['house'] as int : null,
        change: _optionalString(value, 'change'),
      );
    } on FormatException {
      return null;
    }
  }
}

class TransitHorizon {
  const TransitHorizon({required this.from, required this.to});
  final String from, to;
  static TransitHorizon? tryFromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    try {
      return TransitHorizon(from: _utc(json, 'from'), to: _utc(json, 'to'));
    } on FormatException {
      return null;
    }
  }
}

class TransitInsightContext {
  const TransitInsightContext({
    required this.activatedHouses,
    required this.careerRelevance,
    required this.specialStates,
    required this.upcomingTransitions,
    this.horizon,
  });
  final List<TransitActivatedHouse> activatedHouses;
  final List<TransitCareerRelevance> careerRelevance;
  final List<TransitSpecialState> specialStates;
  final List<UpcomingTransitTransition> upcomingTransitions;
  final TransitHorizon? horizon;
  static TransitInsightContext? tryFromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    final houses = _optionalList(json, 'activatedHouses')
        .map(TransitActivatedHouse.tryFromJson)
        .whereType<TransitActivatedHouse>()
        .toList(growable: false);
    final career = _optionalList(json, 'careerRelevance')
        .map(TransitCareerRelevance.tryFromJson)
        .whereType<TransitCareerRelevance>()
        .toList(growable: false);
    final special = _optionalList(json, 'specialStates')
        .map(TransitSpecialState.tryFromJson)
        .whereType<TransitSpecialState>()
        .toList(growable: false);
    final transitions = _optionalList(json, 'upcomingTransitions')
        .map(UpcomingTransitTransition.tryFromJson)
        .whereType<UpcomingTransitTransition>()
        .toList(growable: false);
    return TransitInsightContext(
      activatedHouses: List.unmodifiable(houses),
      careerRelevance: List.unmodifiable(career),
      specialStates: List.unmodifiable(special),
      upcomingTransitions: List.unmodifiable(transitions),
      horizon: TransitHorizon.tryFromJson(_optionalMap(json, 'horizon')),
    );
  }
}

Map<String, dynamic> _map(Map<String, dynamic> json, String key) =>
    _asMap(json[key]);
Map<String, dynamic>? _optionalMap(Map<String, dynamic> json, String key) =>
    json[key] is Map<String, dynamic>
    ? json[key] as Map<String, dynamic>
    : null;
List<dynamic> _optionalList(Map<String, dynamic> json, String key) =>
    json[key] is List ? json[key] as List<dynamic> : const [];
Map<String, dynamic> _asMap(Object? value) => value is Map<String, dynamic>
    ? value
    : throw const FormatException('Transit snapshot response is malformed.');
List<dynamic> _list(Map<String, dynamic> json, String key) => json[key] is List
    ? json[key] as List<dynamic>
    : throw const FormatException('Transit snapshot response is malformed.');
String _string(Map<String, dynamic> json, String key) => json[key] is String
    ? json[key] as String
    : throw const FormatException('Transit snapshot response is malformed.');
int _int(Map<String, dynamic> json, String key) => json[key] is int
    ? json[key] as int
    : throw const FormatException('Transit snapshot response is malformed.');
double _double(Map<String, dynamic> json, String key) => json[key] is num
    ? (json[key] as num).toDouble()
    : throw const FormatException('Transit snapshot response is malformed.');
bool _bool(Map<String, dynamic> json, String key) => json[key] is bool
    ? json[key] as bool
    : throw const FormatException('Transit snapshot response is malformed.');
String? _optionalString(Map<String, dynamic> json, String key) =>
    json[key] == null ? null : _string(json, key);
String? _optionalUtc(Map<String, dynamic> json, String key) =>
    json[key] == null ? null : _utc(json, key);
String _utc(Map<String, dynamic> json, String key) {
  final value = _string(json, key);
  if (!value.endsWith('Z') || DateTime.tryParse(value) == null) {
    throw const FormatException('Transit insight timestamp is not UTC.');
  }
  return value;
}

const _statuses = {
  'SUPPORTED',
  'MIXED',
  'CONTRADICTED',
  'INSUFFICIENT_EVIDENCE',
};
