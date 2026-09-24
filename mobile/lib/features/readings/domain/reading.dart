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
    this.calibrationContext,
    this.careerAshtakavargaStructure,
    this.careerD10Structure,
    this.careerD10Corroboration,
    this.careerAshtakavargaCorroboration,
    this.careerEvidenceSynthesis,
    this.careerTimingPeriods,
    this.insights = const [],
  });

  final ReadingContent content;
  final ReadingContent? calibratedContent;
  final CareerReadingCalibrationSummary? calibrationContext;
  final CareerAshtakavargaStructure? careerAshtakavargaStructure;
  final CareerD10Structure? careerD10Structure;
  final CareerD10Corroboration? careerD10Corroboration;
  final CareerAshtakavargaCorroboration? careerAshtakavargaCorroboration;
  final CareerEvidenceSynthesis? careerEvidenceSynthesis;
  final List<CareerTimingPeriod>? careerTimingPeriods;
  final List<CareerInsight> insights;

  factory ReadingDetail.fromJson(Map<String, dynamic> json) {
    final content = json['content'];
    if (content is! Map<String, dynamic>) {
      throw const FormatException('Stored reading content is unavailable.');
    }
    final calibratedContent = json['calibratedContent'];
    final rawInsights = json['insights'];
    final rawCareerTimingPeriods = json['careerTimingPeriods'];
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
    if (rawCareerTimingPeriods != null && rawCareerTimingPeriods is! List) {
      throw const FormatException('Malformed Career timing periods.');
    }
    final careerTimingPeriods = rawCareerTimingPeriods
        ?.whereType<Map<String, dynamic>>()
        .map(CareerTimingPeriod.tryFromJson)
        .whereType<CareerTimingPeriod>()
        .toList(growable: false);
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
      calibrationContext: CareerReadingCalibrationSummary.tryFromJson(
        json['calibrationContext'],
      ),
      careerAshtakavargaStructure: CareerAshtakavargaStructure.tryFromJson(
        json['careerAshtakavargaStructure'],
      ),
      careerD10Structure: CareerD10Structure.tryFromJson(
        json['careerD10Structure'],
      ),
      careerD10Corroboration: CareerD10Corroboration.tryFromJson(
        json['careerD10Corroboration'],
      ),
      careerAshtakavargaCorroboration:
          CareerAshtakavargaCorroboration.tryFromJson(
            json['careerAshtakavargaCorroboration'],
          ),
      careerEvidenceSynthesis: CareerEvidenceSynthesis.tryFromJson(
        json['careerEvidenceSynthesis'],
      ),
      careerTimingPeriods: careerTimingPeriods == null
          ? null
          : List<CareerTimingPeriod>.unmodifiable(careerTimingPeriods),
      insights: List<CareerInsight>.unmodifiable(insights),
    );
  }
}

/// A server-calculated, non-predictive Career timing signal. Flutter only
/// displays this packet and never derives labels, dates, or astrology facts.
class CareerTimingPeriod {
  const CareerTimingPeriod({
    required this.startDate,
    required this.endDate,
    required this.evidenceState,
    required this.headline,
    required this.summary,
    required this.whyItems,
    required this.whatThisCanMean,
    required this.professionalDirection,
    this.recurrenceSummary,
    required this.technicalDetails,
    required this.disclosure,
    required this.sourceRuleVersion,
    required this.longWindow,
  });

  static const _states = {
    'POSSIBLE_CAREER_ACTIVITY_SIGNAL',
    'ASTROLOGICALLY_SUPPORTIVE_PERIOD',
    'MULTIPLE_TIMING_FACTORS_CONVERGE',
  };

  final String startDate;
  final String endDate;
  final String evidenceState;
  final String headline;
  final String summary;
  final List<String> whyItems;
  final String whatThisCanMean;
  final String professionalDirection;
  final String? recurrenceSummary;
  final Map<String, dynamic> technicalDetails;
  final String disclosure;
  final String sourceRuleVersion;
  final bool longWindow;

  static CareerTimingPeriod? tryFromJson(Map<String, dynamic> json) {
    final startDate = _optionalTimestamp(json['startDate']);
    final endDate = _optionalTimestamp(json['endDate']);
    final state = json['evidenceState'];
    final details = json['technicalDetails'];
    if (startDate == null ||
        endDate == null ||
        DateTime.parse(startDate).isAfter(DateTime.parse(endDate)) ||
        state is! String ||
        !_states.contains(state) ||
        details is! Map<String, dynamic>) {
      return null;
    }
    final headline = json['headline'];
    final summary = json['summary'];
    final whatThisCanMean = json['whatThisCanMean'];
    final professionalDirection = json['professionalDirection'];
    final disclosure = json['disclosure'];
    final sourceRuleVersion = json['sourceRuleVersion'];
    if ([
      headline,
      summary,
      whatThisCanMean,
      professionalDirection,
      disclosure,
      sourceRuleVersion,
    ].any((value) => value is! String || value.isEmpty)) {
      return null;
    }
    return CareerTimingPeriod(
      startDate: startDate,
      endDate: endDate,
      evidenceState: state,
      headline: headline as String,
      summary: summary as String,
      whyItems: List<String>.unmodifiable(
        (json['whyItems'] as List? ?? const []).whereType<String>(),
      ),
      whatThisCanMean: whatThisCanMean as String,
      professionalDirection: professionalDirection as String,
      recurrenceSummary: json['recurrenceSummary'] is String
          ? json['recurrenceSummary'] as String
          : null,
      technicalDetails: Map<String, dynamic>.unmodifiable(details),
      disclosure: disclosure as String,
      sourceRuleVersion: sourceRuleVersion as String,
      longWindow: json['longWindow'] == true,
    );
  }
}

/// Server-derived D10 Career context. This remains a controlled contextual
/// packet and does not calculate outcomes, timing, rankings, or confidence.
class CareerD10Corroboration {
  const CareerD10Corroboration({required this.themes});

  final List<CareerD10Theme> themes;

  static const _themes = {
    'AUTHORITY_ADMINISTRATION',
    'PEOPLE_CARE_PUBLIC',
    'EXECUTION_TECHNICAL',
    'COMMUNICATION_COMMERCE_TECH',
    'ADVISORY_KNOWLEDGE',
    'DESIGN_LUXURY_CLIENT',
    'STRUCTURE_OPERATIONS',
    'UNCONVENTIONAL_TECH_GLOBAL',
    'RESEARCH_SPECIALIZATION',
  };

  static CareerD10Corroboration? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic> ||
        raw['chart'] != 'D10' ||
        raw['corroborates'] != 'CAREER_FOUNDATION' ||
        raw['themes'] is! List) {
      return null;
    }
    final themes = (raw['themes'] as List)
        .map(CareerD10Theme.tryFromJson)
        .whereType<CareerD10Theme>()
        .where((theme) => _themes.contains(theme.theme))
        .toList(growable: false);
    return themes.isEmpty
        ? null
        : CareerD10Corroboration(themes: List.unmodifiable(themes));
  }
}

class CareerD10Theme {
  const CareerD10Theme({required this.theme, required this.supportingFactors});

  final String theme;
  final List<CareerD10ThemeFactor> supportingFactors;

  static CareerD10Theme? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic> ||
        raw['theme'] is! String ||
        raw['interpretationLevel'] != 'CONTEXTUAL' ||
        raw['limitation'] != 'NOT_STANDALONE_PREDICTION' ||
        raw['supportingFactors'] is! List) {
      return null;
    }
    final factors = (raw['supportingFactors'] as List)
        .map(CareerD10ThemeFactor.tryFromJson)
        .whereType<CareerD10ThemeFactor>()
        .toList(growable: false);
    return factors.isEmpty
        ? null
        : CareerD10Theme(
            theme: raw['theme'] as String,
            supportingFactors: List.unmodifiable(factors),
          );
  }
}

class CareerD10ThemeFactor {
  const CareerD10ThemeFactor({required this.planet, required this.house});

  final String planet;
  final int house;

  static const _planets = {
    'Sun',
    'Moon',
    'Mars',
    'Mercury',
    'Jupiter',
    'Venus',
    'Saturn',
    'Rahu',
    'Ketu',
  };
  static const _sources = {
    'D10_LAGNA_OCCUPANT',
    'D10_LAGNA_LORD',
    'D10_TENTH_OCCUPANT',
    'D10_TENTH_LORD',
    'D10_SHANI',
  };

  static CareerD10ThemeFactor? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic> ||
        raw['planet'] is! String ||
        !_planets.contains(raw['planet']) ||
        raw['source'] is! String ||
        !_sources.contains(raw['source']) ||
        raw['house'] is! int ||
        raw['house'] < 1 ||
        raw['house'] > 12) {
      return null;
    }
    return CareerD10ThemeFactor(
      planet: raw['planet'] as String,
      house: raw['house'] as int,
    );
  }
}

/// Server-derived D10 facts. This parser intentionally does not calculate
/// aspects, dignity, outcomes, timing, or any Career interpretation.
class CareerD10Structure {
  const CareerD10Structure({
    required this.lagna,
    required this.tenthHouse,
    required this.shani,
    this.shaniConjunctions = const [],
    this.shaniAspectsToHouses = const [],
    this.shaniAspectsToPlanets = const [],
  });

  final CareerD10HouseFact lagna;
  final CareerD10HouseFact tenthHouse;
  final CareerD10PlanetFact shani;
  final List<CareerD10PlanetFact> shaniConjunctions;
  final List<CareerD10HouseAspectFact> shaniAspectsToHouses;
  final List<CareerD10PlanetAspectFact> shaniAspectsToPlanets;

  static CareerD10Structure? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic> || raw['chart'] != 'D10') return null;
    final lagna = CareerD10HouseFact.tryFromJson(raw['lagna']);
    final tenthHouse = CareerD10HouseFact.tryFromJson(raw['tenthHouse']);
    final shani = CareerD10PlanetFact.tryFromJson(raw['shani']);
    if (lagna == null || tenthHouse == null || shani?.planet != 'Saturn') {
      return null;
    }
    final rawShani = raw['shani'] as Map<String, dynamic>;
    final conjunctions = rawShani['conjunctions'] is List
        ? (rawShani['conjunctions'] as List)
              .map(CareerD10PlanetFact.tryFromJson)
              .whereType<CareerD10PlanetFact>()
              .toList(growable: false)
        : const <CareerD10PlanetFact>[];
    final houses = rawShani['aspectsToHouses'] is List
        ? (rawShani['aspectsToHouses'] as List)
              .map(CareerD10HouseAspectFact.tryFromJson)
              .whereType<CareerD10HouseAspectFact>()
              .toList(growable: false)
        : const <CareerD10HouseAspectFact>[];
    final planets = rawShani['aspectsToPlanets'] is List
        ? (rawShani['aspectsToPlanets'] as List)
              .map(CareerD10PlanetAspectFact.tryFromJson)
              .whereType<CareerD10PlanetAspectFact>()
              .toList(growable: false)
        : const <CareerD10PlanetAspectFact>[];
    return CareerD10Structure(
      lagna: lagna,
      tenthHouse: tenthHouse,
      shani: shani!,
      shaniConjunctions: List.unmodifiable(conjunctions),
      shaniAspectsToHouses: List.unmodifiable(houses),
      shaniAspectsToPlanets: List.unmodifiable(planets),
    );
  }
}

class CareerD10Sign {
  const CareerD10Sign({required this.rashiIndex, required this.englishName});
  final int rashiIndex;
  final String englishName;
  static CareerD10Sign? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic>) return null;
    final index = raw['rashiIndex'];
    final name = raw['englishName'];
    if (index is! int ||
        index < 1 ||
        index > 12 ||
        name is! String ||
        name.isEmpty) {
      return null;
    }
    return CareerD10Sign(rashiIndex: index, englishName: name);
  }
}

class CareerD10PlanetFact {
  const CareerD10PlanetFact({
    required this.planet,
    required this.house,
    required this.sign,
    this.degree,
    this.retrograde,
  });
  final String planet;
  final int house;
  final CareerD10Sign sign;
  final double? degree;
  final bool? retrograde;
  static const _planets = {
    'Sun',
    'Moon',
    'Mars',
    'Mercury',
    'Jupiter',
    'Venus',
    'Saturn',
    'Rahu',
    'Ketu',
  };
  static CareerD10PlanetFact? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic>) return null;
    final planet = raw['planet'];
    final house = raw['house'];
    final sign = CareerD10Sign.tryFromJson(raw['sign']);
    final degree = raw['degree'];
    final retrograde = raw['retrograde'];
    if (planet is! String ||
        !_planets.contains(planet) ||
        house is! int ||
        house < 1 ||
        house > 12 ||
        sign == null ||
        (degree != null && degree is! num) ||
        (degree is num && (degree < 0 || degree >= 30)) ||
        (retrograde != null && retrograde is! bool)) {
      return null;
    }
    return CareerD10PlanetFact(
      planet: planet,
      house: house,
      sign: sign,
      degree: (degree as num?)?.toDouble(),
      retrograde: retrograde as bool?,
    );
  }
}

class CareerD10AspectFact {
  const CareerD10AspectFact({required this.planet, required this.aspectNumber});
  final String planet;
  final int aspectNumber;
  static CareerD10AspectFact? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic>) return null;
    final planet = raw['planet'];
    final aspect = raw['aspectNumber'];
    if (planet is! String || aspect is! int || aspect < 3 || aspect > 10) {
      return null;
    }
    return CareerD10AspectFact(planet: planet, aspectNumber: aspect);
  }
}

class CareerD10HouseAspectFact {
  const CareerD10HouseAspectFact({
    required this.house,
    required this.aspectNumber,
  });
  final int house;
  final int aspectNumber;
  static CareerD10HouseAspectFact? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic>) return null;
    final house = raw['house'];
    final aspect = raw['aspectNumber'];
    if (house is! int ||
        house < 1 ||
        house > 12 ||
        aspect is! int ||
        aspect < 3 ||
        aspect > 10) {
      return null;
    }
    return CareerD10HouseAspectFact(house: house, aspectNumber: aspect);
  }
}

class CareerD10PlanetAspectFact extends CareerD10HouseAspectFact {
  const CareerD10PlanetAspectFact({
    required this.planet,
    required super.house,
    required super.aspectNumber,
  });
  final String planet;
  static CareerD10PlanetAspectFact? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic>) return null;
    final base = CareerD10HouseAspectFact.tryFromJson(raw);
    final planet = raw['planet'];
    if (base == null || planet is! String) return null;
    return CareerD10PlanetAspectFact(
      planet: planet,
      house: base.house,
      aspectNumber: base.aspectNumber,
    );
  }
}

class CareerD10HouseFact {
  const CareerD10HouseFact({
    required this.house,
    required this.sign,
    this.lord,
    this.lordHouse,
    this.occupants = const [],
    this.aspectsReceived = const [],
  });
  final int house;
  final CareerD10Sign sign;
  final String? lord;
  final int? lordHouse;
  final List<CareerD10PlanetFact> occupants;
  final List<CareerD10AspectFact> aspectsReceived;
  static CareerD10HouseFact? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic>) return null;
    final house = raw['house'];
    final sign = CareerD10Sign.tryFromJson(raw['sign']);
    final lord = raw['lord'];
    final lordHouse = raw['lordHouse'];
    if (house is! int ||
        house < 1 ||
        house > 12 ||
        sign == null ||
        (lord != null && lord is! String) ||
        (lordHouse != null &&
            (lordHouse is! int || lordHouse < 1 || lordHouse > 12))) {
      return null;
    }
    final occupants = raw['occupants'] is List
        ? (raw['occupants'] as List)
              .map(CareerD10PlanetFact.tryFromJson)
              .whereType<CareerD10PlanetFact>()
              .toList(growable: false)
        : const <CareerD10PlanetFact>[];
    final aspects = raw['aspectsReceived'] is List
        ? (raw['aspectsReceived'] as List)
              .map(CareerD10AspectFact.tryFromJson)
              .whereType<CareerD10AspectFact>()
              .toList(growable: false)
        : const <CareerD10AspectFact>[];
    return CareerD10HouseFact(
      house: house,
      sign: sign,
      lord: lord as String?,
      lordHouse: lordHouse as int?,
      occupants: List.unmodifiable(occupants),
      aspectsReceived: List.unmodifiable(aspects),
    );
  }
}

/// Safe, factual D1 SAV structure. These values are server-derived snapshots;
/// Flutter only formats them and never derives a score or interpretation.
class CareerAshtakavargaStructure {
  const CareerAshtakavargaStructure({
    this.h10,
    this.h10Lord,
    this.h7,
    this.h7Lord,
    this.tenthFromH10Lord,
  });

  final CareerAshtakavargaHouseFact? h10;
  final CareerAshtakavargaLordFact? h10Lord;
  final CareerAshtakavargaHouseFact? h7;
  final CareerAshtakavargaLordFact? h7Lord;
  final CareerAshtakavargaHouseFact? tenthFromH10Lord;

  bool get isEmpty =>
      h10 == null &&
      h10Lord == null &&
      h7 == null &&
      h7Lord == null &&
      tenthFromH10Lord == null;

  static CareerAshtakavargaStructure? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic>) return null;
    final structure = CareerAshtakavargaStructure(
      h10: CareerAshtakavargaHouseFact.tryFromJson(raw['h10']),
      h10Lord: CareerAshtakavargaLordFact.tryFromJson(raw['h10Lord']),
      h7: CareerAshtakavargaHouseFact.tryFromJson(raw['h7']),
      h7Lord: CareerAshtakavargaLordFact.tryFromJson(raw['h7Lord']),
      tenthFromH10Lord: CareerAshtakavargaHouseFact.tryFromJson(
        raw['tenthFromH10Lord'],
      ),
    );
    return structure.isEmpty ? null : structure;
  }
}

/// A backend-gated, non-predictive H10 context. Flutter formats this supplied
/// decision but never decides whether SAV corroboration exists.
class CareerAshtakavargaCorroboration {
  const CareerAshtakavargaCorroboration({required this.h10});

  final CareerAshtakavargaHouseFact h10;

  static CareerAshtakavargaCorroboration? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic> ||
        raw['kind'] != 'H10_NATAL_CONTEXT' ||
        raw['chart'] != 'D1' ||
        raw['corroborates'] != 'CAREER_FOUNDATION' ||
        raw['limitation'] != 'NOT_STANDALONE_PREDICTION') {
      return null;
    }
    final h10 = CareerAshtakavargaHouseFact.tryFromJson(raw['h10']);
    if (h10 == null || h10.house != 10 || h10.sav == null) return null;
    return CareerAshtakavargaCorroboration(h10: h10);
  }
}

/// Server-authored synthesis of already validated evidence. It intentionally
/// contains no astrology derivation, score, prediction, or ranking metadata.
class CareerEvidenceSynthesis {
  const CareerEvidenceSynthesis({
    required this.activeDasha,
    required this.currentTransit,
    required this.concurrent,
    required this.limited,
    this.h10Sav,
    this.calibrationLevel,
    this.calibrationEventCount,
    this.hasFutureRecurrence = false,
  });

  final bool activeDasha;
  final bool currentTransit;
  final bool concurrent;
  final bool limited;
  final int? h10Sav;
  final String? calibrationLevel;
  final int? calibrationEventCount;
  final bool hasFutureRecurrence;

  static CareerEvidenceSynthesis? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic> ||
        raw['foundation'] is! Map<String, dynamic> ||
        (raw['foundation'] as Map<String, dynamic>)['family'] !=
            'CAREER_FOUNDATION' ||
        raw['timing'] is! Map<String, dynamic>) {
      return null;
    }
    final timing = raw['timing'] as Map<String, dynamic>;
    final fields = ['activeDasha', 'currentTransit', 'concurrent', 'limited'];
    if (!fields.every((field) => timing[field] is bool)) {
      return null;
    }
    final corroboration = raw['corroboration'];
    final h10 = corroboration is Map<String, dynamic>
        ? CareerAshtakavargaHouseFact.tryFromJson(corroboration['h10'])
        : null;
    if (h10 != null && (h10.house != 10 || h10.sav == null)) {
      return null;
    }
    final calibration = raw['calibration'];
    final level = calibration is Map<String, dynamic>
        ? calibration['calibrationLevel']
        : null;
    final count = calibration is Map<String, dynamic>
        ? calibration['eventCount']
        : null;
    if (level != null && !['NONE', 'LIMITED', 'CALIBRATED'].contains(level)) {
      return null;
    }
    if (count != null && (count is! int || count < 0)) {
      return null;
    }
    final future = raw['futureRecurrence'];
    if (future != null &&
        (future is! Map<String, dynamic> ||
            future['family'] != 'FUTURE_RECURRENCE_WINDOW')) {
      return null;
    }
    return CareerEvidenceSynthesis(
      activeDasha: timing['activeDasha'] as bool,
      currentTransit: timing['currentTransit'] as bool,
      concurrent: timing['concurrent'] as bool,
      limited: timing['limited'] as bool,
      h10Sav: h10?.sav,
      calibrationLevel: level as String?,
      calibrationEventCount: count as int?,
      hasFutureRecurrence: future != null,
    );
  }
}

class CareerAshtakavargaHouseFact {
  const CareerAshtakavargaHouseFact({required this.house, this.sav});
  final int house;
  final int? sav;

  static CareerAshtakavargaHouseFact? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic>) return null;
    final house = raw['house'];
    final sav = raw['sav'];
    if (house is! int ||
        house < 1 ||
        house > 12 ||
        (sav != null && (sav is! int || sav < 0))) {
      return null;
    }
    return CareerAshtakavargaHouseFact(house: house, sav: sav as int?);
  }
}

class CareerAshtakavargaLordFact extends CareerAshtakavargaHouseFact {
  const CareerAshtakavargaLordFact({
    required this.planet,
    required super.house,
    this.houseSav,
  }) : super(sav: null);

  final String planet;
  final int? houseSav;

  static CareerAshtakavargaLordFact? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic>) return null;
    final planet = raw['planet'];
    final house = raw['house'];
    final houseSav = raw['houseSav'];
    if (planet is! String ||
        !const {
          'Sun',
          'Moon',
          'Mars',
          'Mercury',
          'Jupiter',
          'Venus',
          'Saturn',
        }.contains(planet) ||
        house is! int ||
        house < 1 ||
        house > 12 ||
        (houseSav != null && (houseSav is! int || houseSav < 0))) {
      return null;
    }
    return CareerAshtakavargaLordFact(
      planet: planet,
      house: house,
      houseSav: houseSav as int?,
    );
  }
}

class CareerReadingCalibrationSummary {
  const CareerReadingCalibrationSummary({
    required this.calibrationLevel,
    this.eventCount,
  });

  final String calibrationLevel;
  final int? eventCount;

  static CareerReadingCalibrationSummary? tryFromJson(Object? value) {
    if (value is! Map<String, dynamic>) return null;
    final level = value['calibrationLevel'];
    final eventCount = value['eventCount'];
    if (level is! String ||
        !const {'NONE', 'LIMITED', 'CALIBRATED'}.contains(level) ||
        (eventCount != null && eventCount is! int)) {
      return null;
    }
    return CareerReadingCalibrationSummary(
      calibrationLevel: level,
      eventCount: eventCount as int?,
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
