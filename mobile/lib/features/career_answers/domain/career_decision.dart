class CareerDecision {
  const CareerDecision({
    required this.decisionType,
    required this.state,
    this.decisionId,
    this.createdAt,
    this.timing,
    required this.overall,
    required this.supports,
    required this.cautions,
    required this.practicalFactors,
    required this.whatToDo,
    required this.limitation,
    this.timingScope,
    this.context,
    this.comparison,
    this.detailedAstrology,
  });
  final String decisionType;
  final String state;
  final String? decisionId;
  final DateTime? createdAt;
  final CareerDecisionTiming? timing;
  final String overall;
  final List<String> supports, cautions, practicalFactors, whatToDo;
  final String limitation;
  final String? timingScope;
  final CareerDecisionContext? context;
  final CareerOfferComparison? comparison;
  final CareerDecisionDetailedAstrology? detailedAstrology;
  factory CareerDecision.fromJson(Map<String, dynamic> json) {
    final timing = json['timing'];
    return CareerDecision(
      decisionType: json['decisionType'] as String? ?? 'JOB_OFFER',
      state: json['state'] as String? ?? 'INSUFFICIENT_EVIDENCE',
      decisionId: json['decisionId'] as String?,
      createdAt: _date(json['createdAt']),
      timing: timing is Map<String, dynamic>
          ? CareerDecisionTiming.fromJson(timing)
          : null,
      overall: json['overallView'] as String? ?? '',
      supports: _list(json['supports']),
      cautions: _list(json['cautions']),
      practicalFactors: _list(json['practicalFactors']),
      whatToDo: _list(json['whatToDo']),
      limitation: json['limitation'] as String? ?? '',
      timingScope: json['timingScope'] as String?,
      context: CareerDecisionContext.tryFromJson(json['context']),
      comparison: CareerOfferComparison.tryFromJson(json['comparison']),
      detailedAstrology: CareerDecisionDetailedAstrology.tryFromJson(
        json['detailedAstrology'],
      ),
    );
  }
  static List<String> _list(Object? value) =>
      List.unmodifiable((value as List? ?? const []).whereType<String>());
  static DateTime? _date(Object? raw) {
    if (raw is! String) return null;
    return DateTime.tryParse(raw)?.toLocal();
  }
}

/// A deliberately small, safe projection returned by the list API. Full
/// context and immutable result data are fetched only after the user opens an
/// owned decision.
class CareerDecisionSummary {
  const CareerDecisionSummary({
    required this.decisionId,
    required this.decisionType,
    required this.state,
    required this.createdAt,
    this.context,
  });

  final String decisionId, decisionType, state;
  final DateTime createdAt;
  final CareerDecisionContext? context;

  factory CareerDecisionSummary.fromJson(Map<String, dynamic> json) {
    final id = json['decisionId'];
    final created = json['createdAt'];
    if (id is! String || id.isEmpty || created is! String) {
      throw const FormatException('Malformed Career Decision summary.');
    }
    final parsed = DateTime.tryParse(created);
    if (parsed == null) {
      throw const FormatException('Malformed Career Decision summary date.');
    }
    return CareerDecisionSummary(
      decisionId: id,
      decisionType: json['decisionType'] as String? ?? 'JOB_OFFER',
      state: json['state'] as String? ?? 'INSUFFICIENT_EVIDENCE',
      createdAt: parsed.toLocal(),
      context: CareerDecisionContext.tryFromJson(json['context']),
    );
  }
}

class CareerDecisionContext {
  const CareerDecisionContext({
    required this.reasons,
    this.priority,
    this.role,
    this.joiningDate,
    this.activelyInterviewing,
    this.preferredTimeline,
    this.noticePeriod,
    this.currentRole,
    this.targetRole,
    this.workModelPreference,
    this.priorities = const [],
    this.offerA,
    this.offerB,
    this.growthTypes = const [],
    this.reviewDate,
    this.managerDiscussionStatus,
    this.businessStage,
    this.startMode,
    this.founderMode,
    this.businessReason,
    this.runway,
    this.businessCategory,
    this.tractionSummary,
    this.abroadPath,
    this.targetRegion,
    this.applicationStage,
    this.movementDate,
  });

  final List<String> reasons;
  final String? priority;
  final String? role;
  final String? joiningDate;
  final String? activelyInterviewing;
  final String? preferredTimeline;
  final String? noticePeriod;
  final String? currentRole;
  final String? targetRole;
  final String? workModelPreference;
  final List<String> priorities;
  final CareerDecisionOffer? offerA;
  final CareerDecisionOffer? offerB;
  final List<String> growthTypes;
  final String? reviewDate, managerDiscussionStatus, businessStage, startMode;
  final String? founderMode, businessReason, runway, businessCategory;
  final String? tractionSummary, abroadPath, targetRegion, applicationStage;
  final String? movementDate;

  static CareerDecisionContext? tryFromJson(Object? raw) {
    if (raw is! Map) return null;
    final reasons = (raw['reasons'] as List? ?? const [])
        .whereType<String>()
        .where((value) => value.trim().isNotEmpty)
        .toList(growable: false);
    final interviewing = raw['activelyInterviewing'];
    final timeline = raw['preferredTimeline'];
    final priority = raw['priority'];
    final joiningDate = raw['joiningDate'];
    final noticePeriod = raw['noticePeriod'];
    final currentRole = raw['currentRole'];
    final targetRole = raw['targetRole'];
    final workModelPreference = raw['workModelPreference'];
    final priorities = (raw['priorities'] as List? ?? const [])
        .whereType<String>()
        .where((value) => value.trim().isNotEmpty)
        .toList(growable: false);
    final offerA = CareerDecisionOffer.tryFromJson(raw['offerA']);
    final offerB = CareerDecisionOffer.tryFromJson(raw['offerB']);
    String? string(String key) =>
        raw[key] is String ? raw[key] as String : null;
    final growthTypes = (raw['growthTypes'] as List? ?? const [])
        .whereType<String>()
        .where((value) => value.trim().isNotEmpty)
        .toList(growable: false);
    if (reasons.isEmpty &&
        interviewing is! String &&
        timeline is! String &&
        priority is! String &&
        raw['role'] is! String &&
        joiningDate is! String &&
        noticePeriod is! String &&
        currentRole is! String &&
        targetRole is! String &&
        workModelPreference is! String &&
        priorities.isEmpty &&
        offerA == null &&
        offerB == null &&
        growthTypes.isEmpty &&
        ![
          'reviewDate',
          'managerDiscussionStatus',
          'businessStage',
          'startMode',
          'founderMode',
          'businessReason',
          'runway',
          'businessCategory',
          'tractionSummary',
          'abroadPath',
          'targetRegion',
          'applicationStage',
          'movementDate',
        ].any((key) => raw[key] is String)) {
      return null;
    }
    return CareerDecisionContext(
      reasons: List.unmodifiable(reasons),
      priority: priority is String ? priority : null,
      role: string('role'),
      joiningDate: joiningDate is String ? joiningDate : null,
      activelyInterviewing: interviewing is String ? interviewing : null,
      preferredTimeline: timeline is String ? timeline : null,
      noticePeriod: noticePeriod is String ? noticePeriod : null,
      currentRole: currentRole is String ? currentRole : null,
      targetRole: targetRole is String ? targetRole : null,
      workModelPreference: workModelPreference is String
          ? workModelPreference
          : null,
      priorities: List.unmodifiable(priorities),
      offerA: offerA,
      offerB: offerB,
      growthTypes: List.unmodifiable(growthTypes),
      reviewDate: string('reviewDate'),
      managerDiscussionStatus: string('managerDiscussionStatus'),
      businessStage: string('businessStage'),
      startMode: string('startMode'),
      founderMode: string('founderMode'),
      businessReason: string('businessReason'),
      runway: string('runway'),
      businessCategory: string('businessCategory'),
      tractionSummary: string('tractionSummary'),
      abroadPath: string('abroadPath'),
      targetRegion: string('targetRegion'),
      applicationStage: string('applicationStage'),
      movementDate: string('movementDate'),
    );
  }
}

class CareerDecisionOffer {
  const CareerDecisionOffer({
    this.offerDate,
    this.joiningDate,
    this.role,
    this.moveType,
    this.companyLabel,
    this.compensationContext,
    this.locationOrWorkModel,
    this.noticePeriodImpact,
    this.strengths = const [],
    this.concerns = const [],
  });

  final String? offerDate, joiningDate, role, moveType, companyLabel;
  final String? compensationContext, locationOrWorkModel, noticePeriodImpact;
  final List<String> strengths, concerns;

  static CareerDecisionOffer? tryFromJson(Object? raw) {
    if (raw is! Map) return null;
    String? string(String name) =>
        raw[name] is String ? raw[name] as String : null;
    final values = [
      string('offerDate'),
      string('joiningDate'),
      string('role'),
      string('moveType'),
      string('companyLabel'),
      string('compensationContext'),
      string('locationOrWorkModel'),
      string('noticePeriodImpact'),
    ];
    final strengths = CareerDecision._list(raw['strengths']);
    final concerns = CareerDecision._list(raw['concerns']);
    if (values.every((value) => value == null || value.trim().isEmpty) &&
        strengths.isEmpty &&
        concerns.isEmpty) {
      return null;
    }
    return CareerDecisionOffer(
      offerDate: string('offerDate'),
      joiningDate: string('joiningDate'),
      role: string('role'),
      moveType: string('moveType'),
      companyLabel: string('companyLabel'),
      compensationContext: string('compensationContext'),
      locationOrWorkModel: string('locationOrWorkModel'),
      noticePeriodImpact: string('noticePeriodImpact'),
      strengths: strengths,
      concerns: concerns,
    );
  }
}

class CareerOfferComparison {
  const CareerOfferComparison({
    required this.outcome,
    required this.summary,
    required this.timingComparison,
    required this.offerA,
    required this.offerB,
  });
  final String outcome, summary, timingComparison;
  final CareerOfferComparisonDetail offerA, offerB;

  static CareerOfferComparison? tryFromJson(Object? raw) {
    if (raw is! Map ||
        raw['outcome'] is! String ||
        raw['summary'] is! String ||
        raw['timingComparison'] is! String) {
      return null;
    }
    final a = CareerOfferComparisonDetail.tryFromJson(raw['offerA']);
    final b = CareerOfferComparisonDetail.tryFromJson(raw['offerB']);
    if (a == null || b == null) return null;
    return CareerOfferComparison(
      outcome: raw['outcome'] as String,
      summary: raw['summary'] as String,
      timingComparison: raw['timingComparison'] as String,
      offerA: a,
      offerB: b,
    );
  }
}

class CareerOfferComparisonDetail {
  const CareerOfferComparisonDetail({
    required this.timing,
    required this.priority,
    required this.strengths,
    required this.cautions,
  });
  final CareerOfferComparisonSignal timing, priority;
  final List<String> strengths, cautions;
  static CareerOfferComparisonDetail? tryFromJson(Object? raw) {
    if (raw is! Map) return null;
    final timing = CareerOfferComparisonSignal.tryFromJson(raw['timing']);
    final priority = CareerOfferComparisonSignal.tryFromJson(raw['priority']);
    if (timing == null || priority == null) return null;
    return CareerOfferComparisonDetail(
      timing: timing,
      priority: priority,
      strengths: CareerDecision._list(raw['strengths']),
      cautions: CareerDecision._list(raw['cautions']),
    );
  }
}

class CareerOfferComparisonSignal {
  const CareerOfferComparisonSignal({
    required this.state,
    required this.message,
  });
  final String state, message;
  static CareerOfferComparisonSignal? tryFromJson(Object? raw) =>
      raw is Map && raw['state'] is String && raw['message'] is String
      ? CareerOfferComparisonSignal(
          state: raw['state'] as String,
          message: raw['message'] as String,
        )
      : null;
}

class CareerDecisionDetailedAstrology {
  const CareerDecisionDetailedAstrology({
    required this.evidence,
    this.agreement,
  });

  final List<CareerDecisionEvidence> evidence;
  final CareerDecisionEvidenceAgreement? agreement;

  bool get isEmpty => evidence.isEmpty && agreement == null;

  static CareerDecisionDetailedAstrology? tryFromJson(Object? raw) {
    if (raw is! Map) {
      return null;
    }
    final evidence = (raw['evidence'] as List? ?? const [])
        .map(CareerDecisionEvidence.tryFromJson)
        .whereType<CareerDecisionEvidence>()
        .toList(growable: false);
    final agreement = CareerDecisionEvidenceAgreement.tryFromJson(
      raw['agreement'],
    );
    if (evidence.isEmpty && agreement == null) {
      return null;
    }
    return CareerDecisionDetailedAstrology(
      evidence: List.unmodifiable(evidence),
      agreement: agreement,
    );
  }
}

class CareerDecisionEvidence {
  const CareerDecisionEvidence({
    required this.family,
    required this.role,
    required this.summary,
  });

  final String family;
  final String role;
  final String summary;

  static CareerDecisionEvidence? tryFromJson(Object? raw) {
    if (raw is! Map ||
        raw['family'] is! String ||
        raw['role'] is! String ||
        raw['summary'] is! String) {
      return null;
    }
    final family = raw['family'] as String;
    final role = raw['role'] as String;
    final summary = raw['summary'] as String;
    if (family.trim().isEmpty ||
        role.trim().isEmpty ||
        summary.trim().isEmpty) {
      return null;
    }
    return CareerDecisionEvidence(family: family, role: role, summary: summary);
  }
}

class CareerDecisionEvidenceAgreement {
  const CareerDecisionEvidenceAgreement({
    this.availableMajorSignals,
    this.alignedMajorSignals,
    this.primaryEligibility,
    required this.supportSignals,
  });

  final int? availableMajorSignals;
  final int? alignedMajorSignals;
  final bool? primaryEligibility;
  final List<String> supportSignals;

  static CareerDecisionEvidenceAgreement? tryFromJson(Object? raw) {
    if (raw is! Map) {
      return null;
    }
    final available = raw['availableMajorSignals'];
    final aligned = raw['alignedMajorSignals'];
    final eligible = raw['primaryEligibility'];
    final supportSignals = (raw['supportSignals'] as List? ?? const [])
        .whereType<String>()
        .where((value) => value.trim().isNotEmpty)
        .toList(growable: false);
    if (available is! int &&
        aligned is! int &&
        eligible is! bool &&
        supportSignals.isEmpty) {
      return null;
    }
    return CareerDecisionEvidenceAgreement(
      availableMajorSignals: available is int ? available : null,
      alignedMajorSignals: aligned is int ? aligned : null,
      primaryEligibility: eligible is bool ? eligible : null,
      supportSignals: List.unmodifiable(supportSignals),
    );
  }
}

class CareerDecisionTiming {
  const CareerDecisionTiming(this.start, this.end);
  final DateTime start, end;
  factory CareerDecisionTiming.fromJson(Map<String, dynamic> json) =>
      CareerDecisionTiming(
        DateTime.parse(json['start'] as String).toLocal(),
        DateTime.parse(json['end'] as String).toLocal(),
      );
}
