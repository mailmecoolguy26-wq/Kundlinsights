enum Graha {
  sun('Sun'),
  moon('Moon'),
  mars('Mars'),
  mercury('Mercury'),
  jupiter('Jupiter'),
  venus('Venus'),
  saturn('Saturn'),
  rahu('Rahu'),
  ketu('Ketu');

  const Graha(this.apiName);
  final String apiName;

  static Graha fromApiName(String value) => Graha.values.firstWhere(
    (graha) => graha.apiName == value,
    orElse: () => throw FormatException('Unknown Graha identifier.'),
  );
}

class NatalSign {
  const NatalSign({
    required this.rashiIndex,
    required this.sanskritName,
    required this.englishName,
  });

  final int rashiIndex;
  final String sanskritName;
  final String englishName;

  factory NatalSign.fromJson(Map<String, dynamic> json) => NatalSign(
    rashiIndex: _int(json, 'rashiIndex'),
    sanskritName: _string(json, 'sanskritName'),
    englishName: _string(json, 'englishName'),
  );
}

class NatalNakshatra {
  const NatalNakshatra({required this.nakshatraIndex, required this.name});

  final int nakshatraIndex;
  final String name;

  factory NatalNakshatra.fromJson(Map<String, dynamic> json) => NatalNakshatra(
    nakshatraIndex: _int(json, 'nakshatraIndex'),
    name: _string(json, 'name'),
  );
}

class NatalPosition {
  const NatalPosition({
    required this.body,
    required this.longitude,
    required this.sign,
    required this.degreeWithinSign,
    required this.house,
    required this.nakshatra,
    required this.pada,
    required this.speed,
    required this.motion,
    required this.retrograde,
  });

  final String body;
  final double longitude;
  final NatalSign sign;
  final double degreeWithinSign;
  final int house;
  final NatalNakshatra nakshatra;
  final int pada;
  final double? speed;
  final String? motion;
  final bool retrograde;

  factory NatalPosition.fromJson(Map<String, dynamic> json) => NatalPosition(
    body: _string(json, 'body'),
    longitude: _double(json, 'longitude'),
    sign: NatalSign.fromJson(_map(json, 'sign')),
    degreeWithinSign: _double(json, 'degreeWithinSign'),
    house: _int(json, 'house'),
    nakshatra: NatalNakshatra.fromJson(_map(json, 'nakshatra')),
    pada: _int(json, 'pada'),
    speed: _nullableDouble(json, 'speed'),
    motion: _nullableString(json, 'motion'),
    retrograde: _bool(json, 'retrograde'),
  );
}

class NatalIdentitySummary {
  const NatalIdentitySummary({
    required this.ascendant,
    required this.moonSign,
    required this.moonNakshatra,
    required this.moonPada,
    required this.sunSign,
  });

  final NatalPosition ascendant;
  final NatalSign moonSign;
  final NatalNakshatra moonNakshatra;
  final int moonPada;
  final NatalSign sunSign;

  factory NatalIdentitySummary.fromJson(Map<String, dynamic> json) {
    final moon = _map(json, 'moon');
    final sun = _map(json, 'sun');
    return NatalIdentitySummary(
      ascendant: NatalPosition.fromJson(_map(json, 'ascendant')),
      moonSign: NatalSign.fromJson(_map(moon, 'sign')),
      moonNakshatra: NatalNakshatra.fromJson(_map(moon, 'nakshatra')),
      moonPada: _int(moon, 'pada'),
      sunSign: NatalSign.fromJson(_map(sun, 'sign')),
    );
  }
}

class NatalSummary {
  const NatalSummary({
    required this.birthProfileId,
    required this.summary,
    this.houses = const [],
    required this.planets,
  });

  final String birthProfileId;
  final NatalIdentitySummary summary;
  final List<NatalHouse> houses;
  final List<NatalPosition> planets;

  NatalPosition? planet(Graha graha) => planets
      .where((position) => position.body == graha.apiName)
      .cast<NatalPosition?>()
      .firstOrNull;

  factory NatalSummary.fromJson(Map<String, dynamic> json) {
    final planets = List<NatalPosition>.unmodifiable(
      _list(json, 'planets')
          .map<NatalPosition>((value) => NatalPosition.fromJson(_asMap(value)))
          .toList(growable: false),
    );
    final houses = List<NatalHouse>.unmodifiable(
      _list(json, 'houses')
          .map<NatalHouse>((value) => NatalHouse.fromJson(_asMap(value)))
          .toList(growable: false),
    );
    if (houses.length != 12 ||
        !List.generate(
          12,
          (index) => index + 1,
        ).every((house) => houses.any((item) => item.house == house))) {
      throw const FormatException('Natal summary has an invalid house set.');
    }
    final names = planets.map((planet) => planet.body).toSet();
    if (planets.length != Graha.values.length ||
        names.length != Graha.values.length ||
        !Graha.values.every((graha) => names.contains(graha.apiName))) {
      throw const FormatException('Natal summary has an invalid Graha set.');
    }
    return NatalSummary(
      birthProfileId: _string(json, 'birthProfileId'),
      summary: NatalIdentitySummary.fromJson(_map(json, 'summary')),
      houses: houses,
      planets: planets,
    );
  }
}

class NatalHouse {
  const NatalHouse({required this.house, required this.sign});
  final int house;
  final NatalSign sign;
  factory NatalHouse.fromJson(Map<String, dynamic> json) => NatalHouse(
    house: _int(json, 'house'),
    sign: NatalSign.fromJson(_map(json, 'sign')),
  );
}

Map<String, dynamic> _map(Map<String, dynamic> json, String key) =>
    _asMap(json[key]);
Map<String, dynamic> _asMap(Object? value) => value is Map<String, dynamic>
    ? value
    : throw const FormatException('Natal summary has an invalid object.');
List<dynamic> _list(Map<String, dynamic> json, String key) => json[key] is List
    ? json[key] as List<dynamic>
    : throw const FormatException('Natal summary has an invalid list.');
String _string(Map<String, dynamic> json, String key) => json[key] is String
    ? json[key] as String
    : throw const FormatException('Natal summary has an invalid string.');
String? _nullableString(Map<String, dynamic> json, String key) =>
    json[key] == null ? null : _string(json, key);
bool _bool(Map<String, dynamic> json, String key) => json[key] is bool
    ? json[key] as bool
    : throw const FormatException('Natal summary has an invalid boolean.');
int _int(Map<String, dynamic> json, String key) => json[key] is int
    ? json[key] as int
    : throw const FormatException('Natal summary has an invalid integer.');
double _double(Map<String, dynamic> json, String key) => json[key] is num
    ? (json[key] as num).toDouble()
    : throw const FormatException('Natal summary has an invalid number.');
double? _nullableDouble(Map<String, dynamic> json, String key) =>
    json[key] == null ? null : _double(json, key);
