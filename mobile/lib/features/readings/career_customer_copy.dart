import 'domain/reading.dart';

/// Filters persisted Career wording for the normal customer-facing forecast.
/// This is deliberately conservative: persisted technical evidence remains
/// available in Detailed Astrology, but uncertain text is never reinterpreted
/// or translated into a new Career conclusion by Flutter.
String? customerFacingCareerPhase(ReadingContent content) {
  for (final section in content.sections) {
    for (final item in section.items) {
      final sentence = item.sentence.trim();
      if (sentence.isNotEmpty && isCustomerFacingCareerCopy(sentence)) {
        return sentence;
      }
    }
  }
  return null;
}

/// Prefers the server-authored customer meaning over a generic timing summary.
String? customerFacingCareerPeriodMeaning(CareerTimingPeriod period) {
  for (final candidate in [period.whatThisCanMean, period.summary]) {
    final trimmed = candidate.trim();
    if (trimmed.isNotEmpty && isCustomerFacingCareerCopy(trimmed)) {
      return trimmed;
    }
  }
  return null;
}

String? customerFacingCareerGuidance(CareerTimingPeriod period) {
  final guidance = period.professionalDirection.trim();
  return guidance.isNotEmpty && isCustomerFacingCareerCopy(guidance)
      ? guidance
      : null;
}

bool isCustomerFacingCareerCopy(String value) {
  final normalized = value.toLowerCase();
  const technicalTerms = [
    '10th-house',
    '10th house',
    'dasha',
    'pratyantar',
    'gochar',
    'transit',
    'ashtakavarga',
    'sav/',
    'sav ',
    'bav',
    'drishti',
    'd1',
    'd10',
    'evidence signal',
    'supplied relation',
  ];
  const diagnosticPhrases = [
    'the supplied',
    'supplied evidence',
    'evidence is insufficient',
    'evidence signal',
    'no matching rule',
    'rule not satisfied',
    'does not satisfy',
    'condition is not met',
    'condition not met',
    'insufficient evidence',
    'mixed evidence',
    'supported context',
    'structurally connected',
    'internal diagnostic',
    'evaluation statement',
  ];
  const customerMarkers = [
    'career',
    'professional',
    'work',
    'job',
    'role',
    'interview',
    'conversation',
    'movement',
    'decision',
    'opportunit',
    'support',
    'prepare',
    'business',
    'resume',
    'network',
    'contact',
    'evaluate',
    'explore',
    'plan',
    'profile',
  ];
  return !technicalTerms.any(normalized.contains) &&
      !diagnosticPhrases.any(normalized.contains) &&
      customerMarkers.any(normalized.contains);
}
