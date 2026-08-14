enum DivisionalChartType {
  d9('D9', 'd9'),
  d10('D10', 'd10');

  const DivisionalChartType(this.apiName, this.pathSegment);
  final String apiName;
  final String pathSegment;
}

class DivisionalSign {
  const DivisionalSign({
    required this.rashiIndex,
    required this.sanskritName,
    required this.englishName,
  });

  final int rashiIndex;
  final String sanskritName;
  final String englishName;

  factory DivisionalSign.fromJson(Map<String, dynamic> json) => DivisionalSign(
    rashiIndex: _int(json, 'rashiIndex'),
    sanskritName: _string(json, 'sanskritName'),
    englishName: _string(json, 'englishName'),
  );
}

class DivisionalChartHouse {
  const DivisionalChartHouse({required this.house, required this.sign});
  final int house;
  final DivisionalSign sign;

  factory DivisionalChartHouse.fromJson(Map<String, dynamic> json) =>
      DivisionalChartHouse(
        house: _int(json, 'house'),
        sign: DivisionalSign.fromJson(_map(json, 'sign')),
      );
}

class DivisionalChartPosition {
  const DivisionalChartPosition({
    required this.body,
    required this.sign,
    required this.degreeWithinSign,
    required this.house,
  });

  final String body;
  final DivisionalSign sign;
  final double degreeWithinSign;
  final int house;

  factory DivisionalChartPosition.fromJson(Map<String, dynamic> json) =>
      DivisionalChartPosition(
        body: _string(json, 'body'),
        sign: DivisionalSign.fromJson(_map(json, 'sign')),
        degreeWithinSign: _double(json, 'degreeWithinSign'),
        house: _int(json, 'house'),
      );
}

class DivisionalChart {
  const DivisionalChart({
    required this.birthProfileId,
    required this.type,
    required this.ascendant,
    required this.houses,
    required this.planets,
  });

  static const grahas = <String>[
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
  final DivisionalChartType type;
  final DivisionalChartPosition ascendant;
  final List<DivisionalChartHouse> houses;
  final List<DivisionalChartPosition> planets;

  factory DivisionalChart.fromJson(Map<String, dynamic> json) {
    final type = DivisionalChartType.values.firstWhere(
      (item) => item.apiName == _string(json, 'chart'),
      orElse: () =>
          throw const FormatException('Unsupported divisional chart.'),
    );
    final houses = List<DivisionalChartHouse>.unmodifiable(
      _list(json, 'houses')
          .map((value) => DivisionalChartHouse.fromJson(_asMap(value)))
          .toList(growable: false),
    );
    final planets = List<DivisionalChartPosition>.unmodifiable(
      _list(json, 'planets')
          .map((value) => DivisionalChartPosition.fromJson(_asMap(value)))
          .toList(growable: false),
    );
    final expectedHouses = List.generate(12, (index) => index + 1);
    if (houses.length != 12 ||
        houses.map((item) => item.house).toSet().length != 12 ||
        !expectedHouses.every(
          (house) => houses.any((item) => item.house == house),
        )) {
      throw const FormatException('Divisional chart has an invalid house set.');
    }
    final names = planets.map((item) => item.body).toSet();
    if (planets.length != grahas.length ||
        names.length != grahas.length ||
        !grahas.every(names.contains)) {
      throw const FormatException('Divisional chart has an invalid Graha set.');
    }
    final ascendant = DivisionalChartPosition.fromJson(_map(json, 'ascendant'));
    if (ascendant.body != 'Ascendant' || ascendant.house != 1) {
      throw const FormatException('Divisional chart has an invalid Ascendant.');
    }
    for (final position in [...planets, ascendant]) {
      final house = houses.firstWhere((item) => item.house == position.house);
      if (house.sign.rashiIndex != position.sign.rashiIndex) {
        throw const FormatException(
          'Divisional position conflicts with authoritative house sign.',
        );
      }
    }
    return DivisionalChart(
      birthProfileId: _string(json, 'birthProfileId'),
      type: type,
      ascendant: ascendant,
      houses: houses,
      planets: planets,
    );
  }
}

Map<String, dynamic> _map(Map<String, dynamic> json, String key) =>
    _asMap(json[key]);
Map<String, dynamic> _asMap(Object? value) => value is Map<String, dynamic>
    ? value
    : throw const FormatException('Divisional chart has an invalid object.');
List<dynamic> _list(Map<String, dynamic> json, String key) => json[key] is List
    ? json[key] as List<dynamic>
    : throw const FormatException('Divisional chart has an invalid list.');
String _string(Map<String, dynamic> json, String key) => json[key] is String
    ? json[key] as String
    : throw const FormatException('Divisional chart has an invalid string.');
int _int(Map<String, dynamic> json, String key) => json[key] is int
    ? json[key] as int
    : throw const FormatException('Divisional chart has an invalid integer.');
double _double(Map<String, dynamic> json, String key) => json[key] is num
    ? (json[key] as num).toDouble()
    : throw const FormatException('Divisional chart has an invalid number.');
