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

class CareerInsightTiming {
  const CareerInsightTiming({
    this.instant,
    this.from,
    this.to,
    this.dashaIntervals = const [],
  });
  final String? instant;
  final String? from;
  final String? to;
  final List<Map<String, dynamic>> dashaIntervals;
  factory CareerInsightTiming.fromJson(Object? raw) {
    final json = raw is Map<String, dynamic> ? raw : const <String, dynamic>{};
    final intervals = (json['dashaIntervals'] as List? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(Map<String, dynamic>.unmodifiable)
        .toList(growable: false);
    return CareerInsightTiming(
      instant: json['instant'] as String?,
      from: json['from'] as String?,
      to: json['to'] as String?,
      dashaIntervals: List.unmodifiable(intervals),
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
  const CareerInsightCalibrationContext(this.calibrationLevel);
  final String? calibrationLevel;
  static CareerInsightCalibrationContext? tryFromJson(Object? raw) =>
      raw is Map<String, dynamic>
      ? CareerInsightCalibrationContext(raw['calibrationLevel'] as String?)
      : null;
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
