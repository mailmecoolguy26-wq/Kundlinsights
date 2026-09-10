// ignore_for_file: curly_braces_in_flow_control_structures

enum VimshottariLevel {
  md('md'),
  ad('ad'),
  pd('pd');

  const VimshottariLevel(this.apiValue);
  final String apiValue;
}

class DashaTimelinePeriod {
  const DashaTimelinePeriod({
    required this.level,
    required this.lord,
    required this.start,
    required this.end,
    required this.status,
  });
  final String level, lord, start, end, status;
  DateTime get startUtc => DateTime.parse(start).toUtc();
  DateTime get endUtc => DateTime.parse(end).toUtc();
  factory DashaTimelinePeriod.fromJson(Map<String, dynamic> json) {
    final level = _string(json, 'level');
    final status = _string(json, 'status');
    if (!{'MAHADASHA', 'ANTARDASHA', 'PRATYANTAR'}.contains(level) ||
        !{'CURRENT', 'COMPLETED', 'UPCOMING'}.contains(status))
      throw const FormatException('Invalid parent-scoped Dasha timeline row.');
    return DashaTimelinePeriod(
      level: level,
      lord: _string(json, 'lord'),
      start: _utc(json, 'start'),
      end: _utc(json, 'end'),
      status: status,
    );
  }
}

class DashaScopedTimeline {
  const DashaScopedTimeline({
    required this.birthProfileId,
    required this.level,
    required this.periods,
    this.parent,
    this.mahadashaParent,
    this.antardashaParent,
  });
  final String birthProfileId, level;
  final List<DashaTimelinePeriod> periods;
  final DashaTimelinePeriod? parent, mahadashaParent, antardashaParent;
  factory DashaScopedTimeline.fromJson(Map<String, dynamic> json) {
    final level = _string(json, 'level');
    final raw = json['periods'];
    if (!{'md', 'ad', 'pd'}.contains(level) || raw is! List)
      throw const FormatException('Malformed parent-scoped Dasha timeline.');
    final periods = raw
        .whereType<Map<String, dynamic>>()
        .map(DashaTimelinePeriod.fromJson)
        .toList(growable: false);
    if (periods.length != raw.length)
      throw const FormatException('Malformed parent-scoped Dasha period.');
    final parents = _optionalMap(json, 'parents');
    final parent = _optionalMap(json, 'parent');
    return DashaScopedTimeline(
      birthProfileId: _string(json, 'birthProfileId'),
      level: level,
      periods: periods,
      parent: parent == null ? null : DashaTimelinePeriod.fromJson(parent),
      mahadashaParent: parents == null
          ? null
          : DashaTimelinePeriod.fromJson(_map(parents, 'mahadasha')),
      antardashaParent: parents == null
          ? null
          : DashaTimelinePeriod.fromJson(_map(parents, 'antardasha')),
    );
  }
}

class DashaPeriodInsight {
  const DashaPeriodInsight({
    required this.mahadasha,
    required this.antardasha,
    required this.pratyantar,
    required this.status,
    required this.summary,
    required this.presentation,
    required this.nextPeriod,
    required this.natalFacts,
    required this.stateFacts,
    required this.relationshipFacts,
    required this.d10Facts,
    this.careerRelevance,
    this.classicalContext,
  });
  final DashaPeriod mahadasha, antardasha, pratyantar;
  final String status, summary;
  final DashaPresentationCopy presentation;
  final DashaPeriod? nextPeriod;
  final List<DashaFact> natalFacts, stateFacts, relationshipFacts, d10Facts;
  final DashaOptionalContext? careerRelevance, classicalContext;
  factory DashaPeriodInsight.fromJson(Map<String, dynamic> json) {
    final hierarchy = _map(json, 'hierarchy');
    final context = _map(json, 'periodContext');
    final next = _optionalMap(json, 'nextPeriod');
    final status = _string(context, 'status');
    if (!{'CURRENT', 'UPCOMING', 'PAST'}.contains(status)) {
      throw const FormatException('Invalid period insight status.');
    }
    return DashaPeriodInsight(
      mahadasha: DashaPeriod.fromJson(_map(hierarchy, 'mahadasha')),
      antardasha: DashaPeriod.fromJson(_map(hierarchy, 'antardasha')),
      pratyantar: DashaPeriod.fromJson(_map(hierarchy, 'pratyantar')),
      status: status,
      summary: _string(context, 'summary'),
      presentation: DashaPresentationCopy.fromJson(
        _map(context, 'presentation'),
      ),
      nextPeriod: next == null ? null : DashaPeriod.fromJson(next),
      natalFacts: _facts(json['natalFacts']),
      stateFacts: _facts(json['stateFacts']),
      relationshipFacts: _facts(json['relationshipFacts']),
      d10Facts: _facts(json['d10Facts']),
      careerRelevance: DashaOptionalContext.tryFromJson(
        _optionalMap(json, 'careerRelevance'),
      ),
      classicalContext: DashaOptionalContext.tryFromJson(
        _optionalMap(json, 'classicalContext'),
      ),
    );
  }
}

class DashaFact {
  const DashaFact(this.values);
  final Map<String, dynamic> values;
}

class DashaOptionalContext {
  const DashaOptionalContext({
    required this.status,
    required this.presentation,
  });
  final String status;
  final DashaPresentationCopy presentation;
  static DashaOptionalContext? tryFromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    try {
      return DashaOptionalContext(
        status: _string(json, 'status'),
        presentation: DashaPresentationCopy.fromJson(
          _map(json, 'presentation'),
        ),
      );
    } on FormatException {
      return null;
    }
  }
}

List<DashaFact> _facts(Object? raw) => raw is List
    ? raw
          .whereType<Map<String, dynamic>>()
          .map(DashaFact.new)
          .toList(growable: false)
    : const [];

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
    this.insightContext,
  });

  final String birthProfileId;
  final String at;
  final DashaPeriod mahadasha;
  final DashaPeriod antardasha;
  final DashaPeriod pratyantardasha;
  final DashaInsightContext? insightContext;

  factory VimshottariCurrent.fromJson(Map<String, dynamic> json) {
    final current = _map(json, 'current');
    return VimshottariCurrent(
      birthProfileId: _string(json, 'birthProfileId'),
      at: _utc(json, 'at'),
      mahadasha: DashaPeriod.fromJson(_map(current, 'mahadasha')),
      antardasha: DashaPeriod.fromJson(_map(current, 'antardasha')),
      pratyantardasha: DashaPeriod.fromJson(_map(current, 'pratyantardasha')),
      insightContext: DashaInsightContext.tryFromJson(
        _optionalMap(json, 'insightContext'),
      ),
    );
  }
}

class DashaPresentationCopy {
  const DashaPresentationCopy({required this.english, required this.hinglish});
  final String english;
  final String hinglish;

  factory DashaPresentationCopy.fromJson(Map<String, dynamic> json) =>
      DashaPresentationCopy(
        english: _string(json, 'english'),
        hinglish: _string(json, 'hinglish'),
      );
}

class DashaInsightPeriod {
  const DashaInsightPeriod({
    required this.lord,
    required this.start,
    required this.end,
    required this.isCurrent,
  });
  final String lord;
  final String start;
  final String end;
  final bool isCurrent;

  factory DashaInsightPeriod.fromJson(Map<String, dynamic> json) =>
      DashaInsightPeriod(
        lord: _string(json, 'lord'),
        start: _utc(json, 'start'),
        end: _utc(json, 'end'),
        isCurrent: _bool(json, 'isCurrent'),
      );
}

class DashaInsightCurrentPeriods {
  const DashaInsightCurrentPeriods({
    required this.mahadasha,
    required this.antardasha,
    required this.pratyantardasha,
  });
  final DashaInsightPeriod mahadasha;
  final DashaInsightPeriod antardasha;
  final DashaInsightPeriod pratyantardasha;

  factory DashaInsightCurrentPeriods.fromJson(Map<String, dynamic> json) =>
      DashaInsightCurrentPeriods(
        mahadasha: DashaInsightPeriod.fromJson(_map(json, 'mahadasha')),
        antardasha: DashaInsightPeriod.fromJson(_map(json, 'antardasha')),
        pratyantardasha: DashaInsightPeriod.fromJson(
          _map(json, 'pratyantardasha'),
        ),
      );
}

class DashaCurrentPhase {
  const DashaCurrentPhase({
    required this.status,
    required this.timingLevel,
    required this.lord,
    required this.presentation,
  });
  final String status;
  final String timingLevel;
  final String lord;
  final DashaPresentationCopy presentation;

  static DashaCurrentPhase? tryFromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    try {
      final status = _string(json, 'status');
      final level = _string(json, 'timingLevel');
      if (!_insightStatuses.contains(status) ||
          !_insightLevels.contains(level)) {
        return null;
      }
      return DashaCurrentPhase(
        status: status,
        timingLevel: level,
        lord: _string(json, 'lord'),
        presentation: DashaPresentationCopy.fromJson(
          _map(json, 'presentation'),
        ),
      );
    } on FormatException {
      return null;
    }
  }
}

class DashaCareerRelevance {
  const DashaCareerRelevance({
    required this.active,
    required this.status,
    required this.presentation,
  });
  final bool active;
  final String status;
  final DashaPresentationCopy presentation;

  static DashaCareerRelevance? tryFromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    try {
      final status = _string(json, 'status');
      if (!_insightStatuses.contains(status)) return null;
      return DashaCareerRelevance(
        active: _bool(json, 'active'),
        status: status,
        presentation: DashaPresentationCopy.fromJson(
          _map(json, 'presentation'),
        ),
      );
    } on FormatException {
      return null;
    }
  }
}

class DashaNextTransition {
  const DashaNextTransition({
    required this.level,
    required this.lord,
    required this.starts,
  });
  final String level;
  final String lord;
  final String starts;

  static DashaNextTransition? tryFromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    try {
      final level = _string(json, 'level');
      if (!_insightLevels.contains(level)) return null;
      return DashaNextTransition(
        level: level,
        lord: _string(json, 'lord'),
        starts: _utc(json, 'starts'),
      );
    } on FormatException {
      return null;
    }
  }
}

class DashaClassicalContext {
  const DashaClassicalContext({
    required this.active,
    required this.status,
    required this.presentation,
    required this.caution,
  });
  final bool active;
  final String status;
  final DashaPresentationCopy presentation;
  final DashaPresentationCopy caution;

  static DashaClassicalContext? tryFromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    try {
      final status = _string(json, 'status');
      if (!_insightStatuses.contains(status)) return null;
      return DashaClassicalContext(
        active: _bool(json, 'active'),
        status: status,
        presentation: DashaPresentationCopy.fromJson(
          _map(json, 'presentation'),
        ),
        caution: DashaPresentationCopy.fromJson(
          _map(json, 'cautionPresentation'),
        ),
      );
    } on FormatException {
      return null;
    }
  }
}

class DashaInsightContext {
  const DashaInsightContext({
    required this.currentPeriods,
    this.currentPhase,
    this.careerRelevance,
    this.nextTransition,
    this.classicalContext,
  });
  final DashaInsightCurrentPeriods currentPeriods;
  final DashaCurrentPhase? currentPhase;
  final DashaCareerRelevance? careerRelevance;
  final DashaNextTransition? nextTransition;
  final DashaClassicalContext? classicalContext;

  static DashaInsightContext? tryFromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    try {
      return DashaInsightContext(
        currentPeriods: DashaInsightCurrentPeriods.fromJson(
          _map(json, 'currentPeriods'),
        ),
        currentPhase: DashaCurrentPhase.tryFromJson(
          _optionalMap(json, 'currentPhase'),
        ),
        careerRelevance: DashaCareerRelevance.tryFromJson(
          _optionalMap(json, 'careerRelevance'),
        ),
        nextTransition: DashaNextTransition.tryFromJson(
          _optionalMap(json, 'nextTransition'),
        ),
        classicalContext: DashaClassicalContext.tryFromJson(
          _optionalMap(json, 'classicalContext'),
        ),
      );
    } on FormatException {
      return null;
    }
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
Map<String, dynamic>? _optionalMap(Map<String, dynamic> json, String key) =>
    json[key] is Map<String, dynamic>
    ? json[key] as Map<String, dynamic>
    : null;
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

bool _bool(Map<String, dynamic> json, String key) => json[key] is bool
    ? json[key] as bool
    : throw const FormatException('Vimshottari response is malformed.');

const _insightStatuses = {
  'SUPPORTED',
  'MIXED',
  'CONTRADICTED',
  'INSUFFICIENT_EVIDENCE',
};
const _insightLevels = {'MAHADASHA', 'ANTARDASHA', 'PRATYANTAR'};
