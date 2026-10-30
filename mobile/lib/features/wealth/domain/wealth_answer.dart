enum WealthIntent {
  currentOutlook('WEALTH_CURRENT_OUTLOOK'),
  strongerWindow('WEALTH_STRONGER_WINDOW');

  const WealthIntent(this.wire);
  final String wire;
}

class WealthSupportWindow {
  const WealthSupportWindow({required this.start, required this.end, required this.state, required this.temporalStatus});
  final DateTime start;
  final DateTime end;
  final String state;
  final String temporalStatus;

  static WealthSupportWindow? tryFromJson(Object? value) {
    if (value is! Map<String, dynamic>) return null;
    final start = DateTime.tryParse(value['start'] as String? ?? '');
    final end = DateTime.tryParse(value['end'] as String? ?? '');
    if (start == null || end == null || !end.isAfter(start)) return null;
    return WealthSupportWindow(
      start: start.toUtc(), end: end.toUtc(),
      state: value['state'] as String? ?? 'Insufficient Evidence',
      temporalStatus: value['temporalStatus'] as String? ?? 'FUTURE',
    );
  }
}

class WealthAnswer {
  const WealthAnswer({
    required this.intent, required this.answerability, required this.state,
    required this.summary, required this.currentPhase,
    required this.strongerWindow, required this.whatThisCanMean,
    required this.supportiveFactors, required this.cautionFactors,
    required this.practicalFocus, required this.detailedAstrology,
    required this.ruleVersion,
  });
  final WealthIntent intent;
  final String answerability;
  final String state;
  final String summary;
  final String currentPhase;
  final WealthSupportWindow? strongerWindow;
  final List<String> whatThisCanMean;
  final List<String> supportiveFactors;
  final List<String> cautionFactors;
  final List<String> practicalFocus;
  final Map<String, dynamic> detailedAstrology;
  final String ruleVersion;
  bool get premiumRequired => answerability == 'PREMIUM_REQUIRED';

  factory WealthAnswer.fromJson(Map<String, dynamic> json) {
    List<String> strings(Object? value) => List<String>.unmodifiable(
      (value as List? ?? const []).whereType<String>(),
    );
    return WealthAnswer(
      intent: WealthIntent.values.firstWhere((value) => value.wire == json['intent'], orElse: () => WealthIntent.currentOutlook),
      answerability: json['answerability'] as String? ?? 'SUPPORTED',
      state: json['state'] as String? ?? 'Insufficient Evidence',
      summary: json['summary'] as String? ?? '',
      currentPhase: json['currentPhase'] as String? ?? '',
      strongerWindow: WealthSupportWindow.tryFromJson(json['strongerWindow']),
      whatThisCanMean: strings(json['whatThisCanMean']),
      supportiveFactors: strings(json['supportiveFactors']),
      cautionFactors: strings(json['cautionFactors']),
      practicalFocus: strings(json['practicalFocus']),
      detailedAstrology: Map<String, dynamic>.unmodifiable(json['detailedAstrology'] is Map ? Map<String, dynamic>.from(json['detailedAstrology'] as Map) : const {}),
      ruleVersion: json['ruleVersion'] as String? ?? '',
    );
  }
}
