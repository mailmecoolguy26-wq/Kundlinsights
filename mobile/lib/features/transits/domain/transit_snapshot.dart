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
    );
  }
}

Map<String, dynamic> _map(Map<String, dynamic> json, String key) =>
    _asMap(json[key]);
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
