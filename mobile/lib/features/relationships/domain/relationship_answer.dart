import '../../../shared/models/historical_context.dart';

enum RelationshipIntent {
  outlook('RELATIONSHIP_OUTLOOK'),
  strongerWindow('RELATIONSHIP_STRONGER_WINDOW'),
  marriageOutlook('MARRIAGE_OUTLOOK');

  const RelationshipIntent(this.wire);
  final String wire;
}

class RelationshipSupportWindow {
  const RelationshipSupportWindow({
    required this.start,
    required this.end,
    required this.state,
    required this.temporalStatus,
  });

  final DateTime start;
  final DateTime end;
  final String state;
  final String temporalStatus;

  static RelationshipSupportWindow? tryFromJson(Object? value) {
    if (value is! Map) return null;
    final start = DateTime.tryParse(value['start'] as String? ?? '');
    final end = DateTime.tryParse(value['end'] as String? ?? '');
    if (start == null || end == null || !end.isAfter(start)) return null;
    return RelationshipSupportWindow(
      start: start.toUtc(),
      end: end.toUtc(),
      state: value['state'] as String? ?? 'Insufficient Evidence',
      temporalStatus: value['temporalStatus'] as String? ?? 'UPCOMING',
    );
  }
}

class MarriageOutlook {
  const MarriageOutlook({
    required this.state,
    required this.message,
    required this.window,
    required this.limitations,
  });

  final String state;
  final String message;
  final RelationshipSupportWindow? window;
  final List<String> limitations;

  static MarriageOutlook? tryFromJson(Object? value) {
    if (value is! Map) return null;
    final message = value['message'] as String? ?? '';
    if (message.isEmpty) return null;
    return MarriageOutlook(
      state: value['state'] as String? ?? '',
      message: message,
      window: RelationshipSupportWindow.tryFromJson(value['window']),
      limitations: List<String>.unmodifiable(
        (value['limitations'] as List? ?? const []).whereType<String>(),
      ),
    );
  }
}

class RelationshipAnswer {
  const RelationshipAnswer({
    required this.intent,
    required this.answerability,
    required this.state,
    required this.summary,
    required this.currentPhase,
    required this.strongerWindow,
    required this.marriageOutlook,
    required this.whatThisCanMean,
    required this.supportiveFactors,
    required this.cautionFactors,
    required this.practicalFocus,
    required this.detailedAstrology,
    required this.ruleVersion,
    this.historicalContext,
  });

  final RelationshipIntent intent;
  final String answerability;
  final String state;
  final String summary;
  final String currentPhase;
  final RelationshipSupportWindow? strongerWindow;
  final MarriageOutlook? marriageOutlook;
  final List<String> whatThisCanMean;
  final List<String> supportiveFactors;
  final List<String> cautionFactors;
  final List<String> practicalFocus;
  final Map<String, dynamic> detailedAstrology;
  final String ruleVersion;
  final HistoricalContext? historicalContext;

  bool get premiumRequired => answerability == 'PREMIUM_REQUIRED';

  factory RelationshipAnswer.fromJson(Map<String, dynamic> json) {
    List<String> strings(Object? value) => List<String>.unmodifiable(
      (value as List? ?? const []).whereType<String>(),
    );
    return RelationshipAnswer(
      intent: RelationshipIntent.values.firstWhere(
        (value) => value.wire == json['intent'],
        orElse: () => RelationshipIntent.outlook,
      ),
      answerability: json['answerability'] as String? ?? 'SUPPORTED',
      state: json['state'] as String? ?? 'Insufficient Evidence',
      summary: json['summary'] as String? ?? '',
      currentPhase: json['currentPhase'] as String? ?? '',
      strongerWindow: RelationshipSupportWindow.tryFromJson(
        json['strongerWindow'],
      ),
      marriageOutlook: MarriageOutlook.tryFromJson(json['marriageOutlook']),
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
      historicalContext: HistoricalContext.tryFromJson(
        json['historicalContext'],
      ),
    );
  }
}
