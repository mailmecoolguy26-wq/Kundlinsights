class CareerDecision {
  const CareerDecision({
    required this.decisionType,
    required this.state,
    this.timing,
    required this.overall,
    required this.supports,
    required this.cautions,
    required this.practicalFactors,
    required this.whatToDo,
    required this.limitation,
    this.timingScope,
    this.context,
    this.detailedAstrology,
  });
  final String decisionType;
  final String state;
  final CareerDecisionTiming? timing;
  final String overall;
  final List<String> supports, cautions, practicalFactors, whatToDo;
  final String limitation;
  final String? timingScope;
  final CareerDecisionContext? context;
  final CareerDecisionDetailedAstrology? detailedAstrology;
  factory CareerDecision.fromJson(Map<String, dynamic> json) {
    final timing = json['timing'];
    return CareerDecision(
      decisionType: json['decisionType'] as String? ?? 'JOB_OFFER',
      state: json['state'] as String? ?? 'INSUFFICIENT_EVIDENCE',
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
      detailedAstrology: CareerDecisionDetailedAstrology.tryFromJson(
        json['detailedAstrology'],
      ),
    );
  }
  static List<String> _list(Object? value) =>
      List.unmodifiable((value as List? ?? const []).whereType<String>());
}

class CareerDecisionContext {
  const CareerDecisionContext({
    required this.reasons,
    this.priority,
    this.joiningDate,
    this.activelyInterviewing,
    this.preferredTimeline,
    this.noticePeriod,
    this.currentRole,
    this.targetRole,
    this.workModelPreference,
  });

  final List<String> reasons;
  final String? priority;
  final String? joiningDate;
  final String? activelyInterviewing;
  final String? preferredTimeline;
  final String? noticePeriod;
  final String? currentRole;
  final String? targetRole;
  final String? workModelPreference;

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
    if (reasons.isEmpty &&
        interviewing is! String &&
        timeline is! String &&
        priority is! String &&
        joiningDate is! String &&
        noticePeriod is! String &&
        currentRole is! String &&
        targetRole is! String &&
        workModelPreference is! String) {
      return null;
    }
    return CareerDecisionContext(
      reasons: List.unmodifiable(reasons),
      priority: priority is String ? priority : null,
      joiningDate: joiningDate is String ? joiningDate : null,
      activelyInterviewing: interviewing is String ? interviewing : null,
      preferredTimeline: timeline is String ? timeline : null,
      noticePeriod: noticePeriod is String ? noticePeriod : null,
      currentRole: currentRole is String ? currentRole : null,
      targetRole: targetRole is String ? targetRole : null,
      workModelPreference: workModelPreference is String
          ? workModelPreference
          : null,
    );
  }
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
