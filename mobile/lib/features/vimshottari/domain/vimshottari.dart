enum VimshottariLevel {
  md('md'),
  ad('ad'),
  pd('pd');

  const VimshottariLevel(this.apiValue);
  final String apiValue;
}

class DashaPeriod {
  const DashaPeriod({
    required this.lord,
    required this.start,
    required this.end,
    this.mahadashaLord,
    this.antardashaLord,
  });

  final String lord;
  final String start;
  final String end;
  final String? mahadashaLord;
  final String? antardashaLord;

  DateTime get startUtc => DateTime.parse(start).toUtc();
  DateTime get endUtc => DateTime.parse(end).toUtc();

  factory DashaPeriod.fromJson(Map<String, dynamic> json) => DashaPeriod(
    lord: _string(json, 'lord'),
    start: _utc(json, 'start'),
    end: _utc(json, 'end'),
    mahadashaLord: _optionalString(json, 'mahadashaLord'),
    antardashaLord: _optionalString(json, 'antardashaLord'),
  );
}

class VimshottariCurrent {
  const VimshottariCurrent({
    required this.birthProfileId,
    required this.at,
    required this.mahadasha,
    required this.antardasha,
    required this.pratyantardasha,
  });

  final String birthProfileId;
  final String at;
  final DashaPeriod mahadasha;
  final DashaPeriod antardasha;
  final DashaPeriod pratyantardasha;

  factory VimshottariCurrent.fromJson(Map<String, dynamic> json) {
    final current = _map(json, 'current');
    return VimshottariCurrent(
      birthProfileId: _string(json, 'birthProfileId'),
      at: _utc(json, 'at'),
      mahadasha: DashaPeriod.fromJson(_map(current, 'mahadasha')),
      antardasha: DashaPeriod.fromJson(_map(current, 'antardasha')),
      pratyantardasha: DashaPeriod.fromJson(_map(current, 'pratyantardasha')),
    );
  }
}

class VimshottariTimeline {
  const VimshottariTimeline({
    required this.birthProfileId,
    required this.level,
    required this.from,
    required this.to,
    required this.periods,
  });

  final String birthProfileId;
  final VimshottariLevel level;
  final String from;
  final String to;
  final List<DashaPeriod> periods;

  factory VimshottariTimeline.fromJson(Map<String, dynamic> json) {
    final level = VimshottariLevel.values.firstWhere(
      (value) => value.apiValue == _string(json, 'level'),
      orElse: () => throw const FormatException('Unknown Dasha level.'),
    );
    final periods = _list(json, 'periods')
        .map((value) => DashaPeriod.fromJson(_asMap(value)))
        .toList(growable: false);
    for (var index = 1; index < periods.length; index += 1) {
      if (periods[index - 1].startUtc.isAfter(periods[index].startUtc)) {
        throw const FormatException('Dasha timeline is not chronological.');
      }
    }
    return VimshottariTimeline(
      birthProfileId: _string(json, 'birthProfileId'),
      level: level,
      from: _utc(json, 'from'),
      to: _utc(json, 'to'),
      periods: List.unmodifiable(periods),
    );
  }
}

Map<String, dynamic> _map(Map<String, dynamic> json, String key) =>
    _asMap(json[key]);
Map<String, dynamic> _asMap(Object? value) => value is Map<String, dynamic>
    ? value
    : throw const FormatException('Vimshottari response is malformed.');
List<dynamic> _list(Map<String, dynamic> json, String key) => json[key] is List
    ? json[key] as List<dynamic>
    : throw const FormatException('Vimshottari response is malformed.');
String _string(Map<String, dynamic> json, String key) => json[key] is String
    ? json[key] as String
    : throw const FormatException('Vimshottari response is malformed.');
String? _optionalString(Map<String, dynamic> json, String key) =>
    json[key] == null ? null : _string(json, key);
String _utc(Map<String, dynamic> json, String key) {
  final value = _string(json, key);
  final parsed = DateTime.tryParse(value);
  if (parsed == null || !value.endsWith('Z')) {
    throw const FormatException('Vimshottari timestamp is not UTC.');
  }
  return value;
}
