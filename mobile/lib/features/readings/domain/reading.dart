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
  });

  final ReadingContent content;
  final ReadingContent? calibratedContent;

  factory ReadingDetail.fromJson(Map<String, dynamic> json) {
    final content = json['content'];
    if (content is! Map<String, dynamic>) {
      throw const FormatException('Stored reading content is unavailable.');
    }
    final calibratedContent = json['calibratedContent'];
    if (calibratedContent != null &&
        calibratedContent is! Map<String, dynamic>) {
      throw const FormatException('Malformed calibrated reading content.');
    }
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
