import '../../shared/models/historical_context.dart';

enum FamilyExpansionIntent {
  outlook('FAMILY_EXPANSION_OUTLOOK'),
  strongerWindow('FAMILY_EXPANSION_STRONGER_WINDOW');

  const FamilyExpansionIntent(this.wire);
  final String wire;
}

class FamilyExpansionWindow {
  const FamilyExpansionWindow({
    required this.start,
    required this.end,
    required this.state,
    required this.temporalStatus,
  });
  final DateTime start;
  final DateTime end;
  final String state;
  final String temporalStatus;
  static FamilyExpansionWindow? tryFromJson(Object? value) {
    if (value is! Map) return null;
    final start = DateTime.tryParse(value['start'] as String? ?? '');
    final end = DateTime.tryParse(value['end'] as String? ?? '');
    if (start == null || end == null || !end.isAfter(start)) return null;
    return FamilyExpansionWindow(
      start: start.toUtc(),
      end: end.toUtc(),
      state: value['state'] as String? ?? 'Insufficient Evidence',
      temporalStatus: value['temporalStatus'] as String? ?? 'UPCOMING',
    );
  }
}

class FamilyExpansionAnswer {
  const FamilyExpansionAnswer({
    required this.intent,
    required this.answerability,
    required this.state,
    required this.summary,
    required this.currentPhase,
    required this.strongerWindow,
    required this.whatThisCanMean,
    required this.supportiveFactors,
    required this.cautionFactors,
    required this.practicalFocus,
    required this.detailedAstrology,
    required this.ruleVersion,
    required this.limitations,
    this.historicalContext,
  });
  final FamilyExpansionIntent intent;
  final String answerability;
  final String state;
  final String summary;
  final String currentPhase;
  final FamilyExpansionWindow? strongerWindow;
  final List<String> whatThisCanMean,
      supportiveFactors,
      cautionFactors,
      practicalFocus,
      limitations;
  final Map<String, dynamic> detailedAstrology;
  final String ruleVersion;
  final HistoricalContext? historicalContext;
  bool get premiumRequired => answerability == 'PREMIUM_REQUIRED';
  factory FamilyExpansionAnswer.fromJson(Map<String, dynamic> json) {
    List<String> strings(Object? value) => List<String>.unmodifiable(
      (value as List? ?? const []).whereType<String>(),
    );
    return FamilyExpansionAnswer(
      intent: FamilyExpansionIntent.values.firstWhere(
        (item) => item.wire == json['intent'],
        orElse: () => FamilyExpansionIntent.outlook,
      ),
      answerability: json['answerability'] as String? ?? 'SUPPORTED',
      state: json['state'] as String? ?? 'Insufficient Evidence',
      summary: json['summary'] as String? ?? '',
      currentPhase: json['currentPhase'] as String? ?? '',
      strongerWindow: FamilyExpansionWindow.tryFromJson(json['strongerWindow']),
      whatThisCanMean: strings(json['whatThisCanMean']),
      supportiveFactors: strings(json['supportiveFactors']),
      cautionFactors: strings(json['cautionFactors']),
      practicalFocus: strings(json['practicalFocus']),
      detailedAstrology: Map<String, dynamic>.unmodifiable(
        json['detailedAstrology'] is Map
            ? Map<String, dynamic>.from(json['detailedAstrology'] as Map)
            : const {},
      ),
      ruleVersion: json['ruleVersion'] as String? ?? '',
      limitations: strings(json['limitations']),
      historicalContext: HistoricalContext.tryFromJson(
        json['historicalContext'],
      ),
    );
  }
}
