/// Safe, backend-authoritative summary returned by `GET /v1/readings`.
class ReadingSummary {
  const ReadingSummary({
    required this.readingId,
    required this.birthProfileId,
    required this.domain,
    required this.status,
    required this.createdAt,
    required this.readingInstant,
    required this.locale,
  });

  final String readingId;
  final String birthProfileId;
  final String domain;
  final String status;
  final String createdAt;
  final String readingInstant;
  final String locale;

  factory ReadingSummary.fromJson(Map<String, dynamic> json) => ReadingSummary(
    readingId: _string(json, 'readingId'),
    birthProfileId: _string(json, 'birthProfileId'),
    domain: _string(json, 'domain'),
    status: _string(json, 'status'),
    createdAt: _timestamp(json, 'createdAt'),
    readingInstant: _timestamp(json, 'readingInstant'),
    locale: _string(json, 'locale'),
  );
}

/// Stored, rendered CAREER content. Flutter displays it in server order and
/// never derives, regenerates, or interprets its contents.
class ReadingContent {
  const ReadingContent({
    required this.domain,
    required this.locale,
    required this.sections,
  });

  final String domain;
  final String locale;
  final List<ReadingSection> sections;

  factory ReadingContent.fromJson(Map<String, dynamic> json) {
    final rawSections = json['sections'];
    if (rawSections is! List) {
      throw const FormatException('Malformed stored reading sections.');
    }
    return ReadingContent(
      domain: _string(json, 'domain'),
      locale: _string(json, 'locale'),
      sections: List<ReadingSection>.unmodifiable(
        rawSections.map((entry) {
          if (entry is! Map<String, dynamic>) {
            throw const FormatException('Malformed stored reading section.');
          }
          return ReadingSection.fromJson(entry);
        }),
      ),
    );
  }
}

class ReadingSection {
  const ReadingSection({
    required this.section,
    required this.headline,
    required this.items,
  });

  final String section;
  final String headline;
  final List<ReadingSectionItem> items;

  factory ReadingSection.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'];
    if (rawItems is! List) {
      throw const FormatException('Malformed stored reading items.');
    }
    return ReadingSection(
      section: _string(json, 'section'),
      headline: _string(json, 'headline'),
      items: List<ReadingSectionItem>.unmodifiable(
        rawItems.map((entry) {
          if (entry is! Map<String, dynamic>) {
            throw const FormatException('Malformed stored reading item.');
          }
          return ReadingSectionItem.fromJson(entry);
        }),
      ),
    );
  }
}

class ReadingSectionItem {
  const ReadingSectionItem({
    required this.headline,
    required this.sentence,
    this.sourceTitle,
  });

  final String headline;
  final String sentence;
  final String? sourceTitle;

  factory ReadingSectionItem.fromJson(Map<String, dynamic> json) {
    final source = json['sourceAttribution'];
    final title = source is Map<String, dynamic> ? source['title'] : null;
    return ReadingSectionItem(
      headline: _string(json, 'headline'),
      sentence: _string(json, 'sentence'),
      sourceTitle: title is String && title.isNotEmpty ? title : null,
    );
  }
}

class ReadingDetail extends ReadingSummary {
  const ReadingDetail({
    required super.readingId,
    required super.birthProfileId,
    required super.domain,
    required super.status,
    required super.createdAt,
    required super.readingInstant,
    required super.locale,
    required this.content,
    this.calibratedContent,
    this.insights = const [],
  });

  final ReadingContent content;
  final ReadingContent? calibratedContent;
  final List<CareerInsight> insights;

  factory ReadingDetail.fromJson(Map<String, dynamic> json) {
    final content = json['content'];
    if (content is! Map<String, dynamic>) {
      throw const FormatException('Stored reading content is unavailable.');
    }
    final calibratedContent = json['calibratedContent'];
    final rawInsights = json['insights'];
    if (calibratedContent != null &&
        calibratedContent is! Map<String, dynamic>) {
      throw const FormatException('Malformed calibrated reading content.');
    }
    final insights = rawInsights is List
        ? rawInsights
              .whereType<Map<String, dynamic>>()
              .map(CareerInsight.tryFromJson)
              .whereType<CareerInsight>()
              .toList(growable: false)
        : const <CareerInsight>[];
    final summary = ReadingSummary.fromJson(json);
    return ReadingDetail(
      readingId: summary.readingId,
      birthProfileId: summary.birthProfileId,
      domain: summary.domain,
      status: summary.status,
      createdAt: summary.createdAt,
      readingInstant: summary.readingInstant,
      locale: summary.locale,
      content: ReadingContent.fromJson(content),
      calibratedContent: calibratedContent == null
          ? null
          : ReadingContent.fromJson(calibratedContent),
      insights: List<CareerInsight>.unmodifiable(insights),
    );
  }
}

class CareerInsight {
  const CareerInsight({
    required this.insightId,
    required this.family,
    required this.titleKey,
    required this.summaryKey,
    required this.displayPriority,
    required this.status,
    required this.timing,
    required this.caveats,
    required this.evidenceTrace,
    this.calibrationContext,
    this.technicalContext,
    this.technicalDetails = const {},
    this.rulesetVersions = const {},
  });
  final String insightId;
  final String family;
  final String titleKey;
  final String summaryKey;
  final int displayPriority;
  final String status;
  final CareerInsightTiming timing;
  final List<CareerInsightCaveat> caveats;
  final CareerInsightEvidenceTrace evidenceTrace;
  final CareerInsightCalibrationContext? calibrationContext;
  final CareerTechnicalContext? technicalContext;
  final Map<String, dynamic> technicalDetails;
  final Map<String, dynamic> rulesetVersions;

  static CareerInsight? tryFromJson(Map<String, dynamic> json) {
    final id = json['insightId'];
    final family = json['family'];
    final title = json['titleKey'];
    final summary = json['summaryKey'];
    final priority = json['displayPriority'];
    final status = json['status'];
    if (id is! String ||
        family is! String ||
        title is! String ||
        summary is! String ||
        priority is! int ||
        status is! String) {
      return null;
    }
    return CareerInsight(
      insightId: id,
      family: family,
      titleKey: title,
      summaryKey: summary,
      displayPriority: priority,
      status: status,
      timing: CareerInsightTiming.fromJson(json['timing']),
      caveats: (json['caveats'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(CareerInsightCaveat.fromJson)
          .toList(growable: false),
      evidenceTrace: CareerInsightEvidenceTrace.fromJson(json['evidenceTrace']),
      calibrationContext: CareerInsightCalibrationContext.tryFromJson(
        json['calibrationContext'],
      ),
      technicalContext: CareerTechnicalContext.tryFromJson(
        json['technicalContext'],
      ),
      technicalDetails: json['technicalDetails'] is Map<String, dynamic>
          ? Map<String, dynamic>.unmodifiable(
              json['technicalDetails'] as Map<String, dynamic>,
            )
          : const {},
      rulesetVersions: json['rulesetVersions'] is Map<String, dynamic>
          ? Map<String, dynamic>.unmodifiable(
              json['rulesetVersions'] as Map<String, dynamic>,
            )
          : const {},
    );
  }
}

class CareerTechnicalContext {
  const CareerTechnicalContext({
    required this.natalStructure,
    required this.d10CareerChart,
    required this.timing,
    required this.supportingContext,
    required this.careerHistory,
    required this.classicalRuleContext,
  });
  final List<Map<String, dynamic>> natalStructure,
      d10CareerChart,
      timing,
      supportingContext,
      careerHistory,
      classicalRuleContext;
  static CareerTechnicalContext? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic>) return null;
    List<Map<String, dynamic>> rows(String key) =>
        (raw[key] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(Map<String, dynamic>.unmodifiable)
            .toList(growable: false);
    return CareerTechnicalContext(
      natalStructure: rows('natalStructure'),
      d10CareerChart: rows('d10CareerChart'),
      timing: rows('timing'),
      supportingContext: rows('supportingContext'),
      careerHistory: rows('careerHistory'),
      classicalRuleContext: rows('classicalRuleContext'),
    );
  }

  bool get isEmpty =>
      natalStructure.isEmpty &&
      d10CareerChart.isEmpty &&
      timing.isEmpty &&
      supportingContext.isEmpty &&
      careerHistory.isEmpty &&
      classicalRuleContext.isEmpty;
}

class CareerInsightTiming {
  const CareerInsightTiming({
    this.instant,
    this.from,
    this.to,
    this.dashaPeriods = const [],
    this.transitContexts = const [],
    this.timingWindow,
    this.timingState,
    this.lineageClassification,
  });
  final String? instant;
  final String? from;
  final String? to;
  final List<CareerDashaPeriod> dashaPeriods;
  final List<CareerTransitTiming> transitContexts;
  final CareerTimingWindow? timingWindow;
  final String? timingState;
  final String? lineageClassification;
  factory CareerInsightTiming.fromJson(Object? raw) {
    final json = raw is Map<String, dynamic> ? raw : const <String, dynamic>{};
    final periods =
        (json['dashaPeriods'] ?? json['dashaIntervals']) as List? ?? const [];
    return CareerInsightTiming(
      instant: _optionalTimestamp(json['instant']),
      from: _optionalTimestamp(json['from']),
      to: _optionalTimestamp(json['to']),
      dashaPeriods: periods
          .whereType<Map<String, dynamic>>()
          .map(CareerDashaPeriod.tryFromJson)
          .whereType<CareerDashaPeriod>()
          .toList(growable: false),
      transitContexts: (json['transitContexts'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(CareerTransitTiming.tryFromJson)
          .whereType<CareerTransitTiming>()
          .toList(growable: false),
      timingWindow: CareerTimingWindow.tryFromJson(json['timingWindow']),
      timingState: _timingState(json['timingState']),
      lineageClassification: _lineageClassification(
        json['lineageClassification'],
      ),
    );
  }
}

class CareerDashaPeriod {
  const CareerDashaPeriod({
    required this.level,
    required this.planet,
    required this.start,
    required this.end,
    required this.isCurrent,
  });
  final String level, planet, start, end;
  final bool isCurrent;
  static CareerDashaPeriod? tryFromJson(Map<String, dynamic> json) {
    final level = json['periodLevel'] ?? json['level'];
    final planet = json['periodPlanet'] ?? json['planet'];
    final start = _optionalTimestamp(json['start']);
    final end = _optionalTimestamp(json['end']);
    if (level is! String || planet is! String || start == null || end == null) {
      return null;
    }
    return CareerDashaPeriod(
      level: level,
      planet: planet,
      start: start,
      end: end,
      isCurrent: json['isCurrent'] == true,
    );
  }
}

class CareerTransitTiming {
  const CareerTransitTiming({this.planet, this.start, this.end});
  final String? planet, start, end;
  static CareerTransitTiming? tryFromJson(Map<String, dynamic> json) {
    final planet = json['transitPlanet'];
    final start = _optionalTimestamp(json['start']);
    final end = _optionalTimestamp(json['end']);
    if (planet is! String || start == null) return null;
    return CareerTransitTiming(planet: planet, start: start, end: end);
  }
}

class CareerTimingWindow {
  const CareerTimingWindow({
    required this.start,
    required this.end,
    required this.isCurrent,
  });
  final String start, end;
  final bool isCurrent;
  static CareerTimingWindow? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic>) return null;
    final start = _optionalTimestamp(raw['start']);
    final end = _optionalTimestamp(raw['end']);
    if (start == null || end == null) return null;
    return CareerTimingWindow(
      start: start,
      end: end,
      isCurrent: raw['isCurrent'] == true,
    );
  }
}

class CareerInsightCaveat {
  const CareerInsightCaveat(this.status);
  final String? status;
  factory CareerInsightCaveat.fromJson(Map<String, dynamic> json) =>
      CareerInsightCaveat(json['status'] as String?);
}

class CareerInsightEvidenceTrace {
  const CareerInsightEvidenceTrace({
    this.sourceRuleIds = const [],
    this.sourceRulesetIds = const [],
  });
  final List<String> sourceRuleIds;
  final List<String> sourceRulesetIds;
  factory CareerInsightEvidenceTrace.fromJson(Object? raw) {
    final trace = raw is Map<String, dynamic> ? raw : const <String, dynamic>{};
    final signals = trace['signals'] as List? ?? const [];
    final rules = <String>{}, rulesets = <String>{};
    for (final rawSignal in signals.whereType<Map<String, dynamic>>()) {
      rules.addAll(
        (rawSignal['sourceRuleIds'] as List? ?? const []).whereType<String>(),
      );
      rulesets.addAll(
        (rawSignal['sourceRulesetIds'] as List? ?? const [])
            .whereType<String>(),
      );
    }
    return CareerInsightEvidenceTrace(
      sourceRuleIds: List.unmodifiable(rules),
      sourceRulesetIds: List.unmodifiable(rulesets),
    );
  }
}

class CareerInsightCalibrationContext {
  const CareerInsightCalibrationContext({
    this.calibrationLevel,
    this.eventCount,
    this.matchedEventCount,
    this.matchedEvents = const [],
    this.mechanismFamilies = const [],
    this.patternCount,
    this.composite = false,
  });
  final String? calibrationLevel;
  final int? eventCount;
  final int? matchedEventCount;
  final List<CareerInsightMatchedEvent> matchedEvents;
  final List<String> mechanismFamilies;
  final int? patternCount;
  final bool composite;
  static CareerInsightCalibrationContext? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic>) return null;
    return CareerInsightCalibrationContext(
      calibrationLevel: raw['calibrationLevel'] as String?,
      eventCount: raw['eventCount'] as int?,
      matchedEventCount: raw['matchedEventCount'] as int?,
      matchedEvents: (raw['matchedEvents'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(CareerInsightMatchedEvent.tryFromJson)
          .whereType<CareerInsightMatchedEvent>()
          .toList(growable: false),
      mechanismFamilies: (raw['mechanismFamilies'] as List? ?? const [])
          .whereType<String>()
          .toList(growable: false),
      patternCount: raw['patternCount'] as int?,
      composite: raw['composite'] == true,
    );
  }
}

class CareerInsightMatchedEvent {
  const CareerInsightMatchedEvent({
    required this.eventType,
    required this.eventDate,
  });
  final String eventType;
  final Map<String, dynamic> eventDate;
  static CareerInsightMatchedEvent? tryFromJson(Map<String, dynamic> json) {
    final type = json['eventType'];
    final date = json['eventDate'];
    if (type is! String || date is! Map<String, dynamic>) return null;
    return CareerInsightMatchedEvent(
      eventType: type,
      eventDate: Map<String, dynamic>.unmodifiable(date),
    );
  }
}

String _string(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! String || value.isEmpty) {
    throw FormatException('Missing or malformed $key.');
  }
  return value;
}

String _timestamp(Map<String, dynamic> json, String key) {
  final value = _string(json, key);
  if (DateTime.tryParse(value) == null) {
    throw FormatException('Missing or malformed $key.');
  }
  return value;
}

String? _optionalTimestamp(Object? value) {
  if (value is! String || DateTime.tryParse(value) == null) return null;
  return value;
}

String? _timingState(Object? value) =>
    const {'CURRENT', 'UPCOMING', 'PAST'}.contains(value)
    ? value as String
    : null;

String? _lineageClassification(Object? value) =>
    const {
      'INDEPENDENT',
      'PARTIALLY_OVERLAPPING',
      'FULLY_DEPENDENT',
      'IDENTICAL',
      'CONTRADICTORY',
    }.contains(value)
    ? value as String
    : null;
