enum CareerQuestionType {
  currentCareerPhase,
  careerActivityTiming,
  jobFavourabilityTiming;

  String get wireName => switch (this) {
    CareerQuestionType.currentCareerPhase => 'CURRENT_CAREER_PHASE',
    CareerQuestionType.careerActivityTiming => 'CAREER_ACTIVITY_TIMING',
    CareerQuestionType.jobFavourabilityTiming => 'JOB_FAVOURABILITY_TIMING',
  };

  static CareerQuestionType? fromWire(Object? value) => switch (value) {
    'CURRENT_CAREER_PHASE' => CareerQuestionType.currentCareerPhase,
    'CAREER_ACTIVITY_TIMING' => CareerQuestionType.careerActivityTiming,
    'JOB_FAVOURABILITY_TIMING' => CareerQuestionType.jobFavourabilityTiming,
    _ => null,
  };
}

enum CareerAnswerability {
  supported,
  insufficientEvidence,
  projectionDisabled,
  noConcentratedJobFavourability,
  unsupported,
}

class JobFavourabilityWindow {
  const JobFavourabilityWindow({required this.start, required this.end});
  final DateTime start;
  final DateTime end;

  static JobFavourabilityWindow? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic>) return null;
    final start = DateTime.tryParse(raw['start'] as String? ?? '');
    final end = DateTime.tryParse(raw['end'] as String? ?? '');
    if (start == null || end == null || !start.isBefore(end)) return null;
    return JobFavourabilityWindow(start: start.toUtc(), end: end.toUtc());
  }
}

class JobFavourabilityBeta {
  const JobFavourabilityBeta({
    required this.window,
    required this.narrowerWindow,
    required this.strength,
    required this.evidenceAgreementCount,
    required this.reasonCodes,
    required this.actionCodes,
    required this.limitationCode,
  });
  final JobFavourabilityWindow window;
  final JobFavourabilityWindow? narrowerWindow;
  final String strength;
  final int evidenceAgreementCount;
  final List<String> reasonCodes;
  final List<String> actionCodes;
  final String limitationCode;

  static JobFavourabilityBeta? tryFromJson(Map<String, dynamic> json) {
    final window = JobFavourabilityWindow.tryFromJson(json['broadWindow']);
    final strength = json['strength'];
    final count = json['evidenceAgreementCount'];
    final limitationCode = json['limitationCode'];
    if (window == null ||
        !{'MODERATE', 'STRONGER'}.contains(strength) ||
        count is! int ||
        count < 1 ||
        limitationCode != 'BETA_DESCRIPTIVE_CONVERGENCE_ONLY') {
      return null;
    }
    return JobFavourabilityBeta(
      window: window,
      narrowerWindow:
          JobFavourabilityWindow.tryFromJson(json['strongerConcentrationWindow']),
      strength: strength as String,
      evidenceAgreementCount: count,
      reasonCodes: List.unmodifiable((json['evidenceReasonCodes'] as List? ?? const [])
          .whereType<String>().where((value) => value.isNotEmpty)),
      actionCodes: List.unmodifiable((json['recommendedActionCodes'] as List? ?? const [])
          .whereType<String>().where((value) => value.isNotEmpty)),
      limitationCode: limitationCode,
    );
  }
}

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
    this.jobFavourability,
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
  final JobFavourabilityBeta? jobFavourability;

  factory CareerAnswer.fromJson(Map<String, dynamic> json) {
    final type = CareerQuestionType.fromWire(json['questionType']);
    final answerability = switch (json['answerability']) {
      'SUPPORTED' => CareerAnswerability.supported,
      'INSUFFICIENT_EVIDENCE' => CareerAnswerability.insufficientEvidence,
      'PROJECTION_DISABLED' => CareerAnswerability.projectionDisabled,
      'NO_CONCENTRATED_JOB_FAVOURABILITY' => CareerAnswerability.noConcentratedJobFavourability,
      'UNSUPPORTED' => CareerAnswerability.unsupported,
      _ => null,
    };
    final answer = json['answer'];
    final agreement = json['agreement'];
    if (type == CareerQuestionType.jobFavourabilityTiming) {
      final beta = answerability == CareerAnswerability.supported
          ? JobFavourabilityBeta.tryFromJson(json)
          : null;
      if (answerability == null ||
          (answerability == CareerAnswerability.supported && beta == null)) {
        throw const FormatException('Malformed Job Favourability Answer.');
      }
      return CareerAnswer(
        questionType: type!, answerability: answerability,
        headline: '', summary: '', currentPhase: null, window: null,
        actionItems: const [], limitation: beta?.limitationCode ??
            (json['limitationCode'] as String? ?? ''),
        availableMajorSignals: 0, alignedMajorSignals: 0,
        primaryEligibility: false, supportSignals: const [], evidence: const [],
        historicalSummary: null,
        sourceReadingId: json['sourceReadingId'] as String?,
        rulesetVersion: json['rulesetVersion'] as String? ?? '',
        jobFavourability: beta,
      );
    }
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
      jobFavourability: null,
    );
  }
}
