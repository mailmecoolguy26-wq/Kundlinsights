enum CareerQuestionType {
  currentCareerPhase,
  careerActivityTiming;

  String get wireName => switch (this) {
    CareerQuestionType.currentCareerPhase => 'CURRENT_CAREER_PHASE',
    CareerQuestionType.careerActivityTiming => 'CAREER_ACTIVITY_TIMING',
  };

  static CareerQuestionType? fromWire(Object? value) => switch (value) {
    'CURRENT_CAREER_PHASE' => CareerQuestionType.currentCareerPhase,
    'CAREER_ACTIVITY_TIMING' => CareerQuestionType.careerActivityTiming,
    _ => null,
  };
}

enum CareerAnswerability { supported, insufficientEvidence, unsupported }

class CareerAnswerWindow {
  const CareerAnswerWindow({
    required this.start,
    required this.end,
    required this.classification,
  });

  final DateTime start;
  final DateTime end;
  final String classification;

  static CareerAnswerWindow? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic>) return null;
    final start = raw['start'];
    final end = raw['end'];
    final classification = raw['classification'];
    if (start is! String ||
        end is! String ||
        classification != 'POSSIBLE_CAREER_ACTIVITY_SIGNAL') {
      return null;
    }
    final parsedStart = DateTime.tryParse(start);
    final parsedEnd = DateTime.tryParse(end);
    if (parsedStart == null ||
        parsedEnd == null ||
        !parsedStart.isBefore(parsedEnd)) {
      return null;
    }
    return CareerAnswerWindow(
      start: parsedStart.toUtc(),
      end: parsedEnd.toUtc(),
      classification: classification,
    );
  }
}

class CareerAnswerEvidence {
  const CareerAnswerEvidence({
    required this.family,
    required this.role,
    required this.summary,
  });
  final String family;
  final String role;
  final String summary;

  static CareerAnswerEvidence? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic>) return null;
    final family = raw['family'];
    final role = raw['role'];
    final summary = raw['summary'];
    if (family is! String ||
        family.isEmpty ||
        role is! String ||
        !{'PRIMARY', 'SUPPORT'}.contains(role) ||
        summary is! String ||
        summary.isEmpty) {
      return null;
    }
    return CareerAnswerEvidence(family: family, role: role, summary: summary);
  }
}

class CareerAnswer {
  const CareerAnswer({
    required this.questionType,
    required this.answerability,
    required this.headline,
    required this.summary,
    required this.currentPhase,
    required this.window,
    required this.actionItems,
    required this.limitation,
    required this.availableMajorSignals,
    required this.alignedMajorSignals,
    required this.primaryEligibility,
    required this.supportSignals,
    required this.evidence,
    required this.historicalSummary,
    required this.sourceReadingId,
    required this.rulesetVersion,
  });

  final CareerQuestionType questionType;
  final CareerAnswerability answerability;
  final String headline;
  final String summary;
  final String? currentPhase;
  final CareerAnswerWindow? window;
  final List<String> actionItems;
  final String limitation;
  final int availableMajorSignals;
  final int alignedMajorSignals;
  final bool primaryEligibility;
  final List<String> supportSignals;
  final List<CareerAnswerEvidence> evidence;
  final String? historicalSummary;
  final String? sourceReadingId;
  final String rulesetVersion;

  factory CareerAnswer.fromJson(Map<String, dynamic> json) {
    final type = CareerQuestionType.fromWire(json['questionType']);
    final answerability = switch (json['answerability']) {
      'SUPPORTED' => CareerAnswerability.supported,
      'INSUFFICIENT_EVIDENCE' => CareerAnswerability.insufficientEvidence,
      'UNSUPPORTED' => CareerAnswerability.unsupported,
      _ => null,
    };
    final answer = json['answer'];
    final agreement = json['agreement'];
    if (type == null ||
        answerability == null ||
        answer is! Map<String, dynamic> ||
        agreement is! Map<String, dynamic>) {
      throw const FormatException('Malformed Career Answer.');
    }
    final headline = answer['headline'];
    final summary = answer['summary'];
    final limitation = answer['limitation'];
    final available = agreement['availableMajorSignals'];
    final aligned = agreement['alignedMajorSignals'];
    if (headline is! String ||
        summary is! String ||
        limitation is! String ||
        available is! int ||
        aligned is! int ||
        available < 0 ||
        aligned < 0 ||
        aligned > available) {
      throw const FormatException('Malformed Career Answer content.');
    }
    final historical = json['historicalContext'];
    return CareerAnswer(
      questionType: type,
      answerability: answerability,
      headline: headline,
      summary: summary,
      currentPhase: answer['currentPhase'] is String
          ? answer['currentPhase'] as String
          : null,
      window: CareerAnswerWindow.tryFromJson(answer['window']),
      actionItems: List.unmodifiable(
        (answer['actionItems'] as List? ?? const [])
            .whereType<String>()
            .where((item) => item.isNotEmpty),
      ),
      limitation: limitation,
      availableMajorSignals: available,
      alignedMajorSignals: aligned,
      primaryEligibility: agreement['primaryEligibility'] == true,
      supportSignals: List.unmodifiable(
        (agreement['supportSignals'] as List? ?? const [])
            .whereType<String>()
            .where((item) => item.isNotEmpty),
      ),
      evidence: List.unmodifiable(
        (json['evidence'] as List? ?? const [])
            .map(CareerAnswerEvidence.tryFromJson)
            .whereType<CareerAnswerEvidence>(),
      ),
      historicalSummary: historical is Map<String, dynamic> &&
              historical['summary'] is String
          ? historical['summary'] as String
          : null,
      sourceReadingId: json['sourceReadingId'] is String
          ? json['sourceReadingId'] as String
          : null,
      rulesetVersion: json['rulesetVersion'] is String
          ? json['rulesetVersion'] as String
          : '',
    );
  }
}
