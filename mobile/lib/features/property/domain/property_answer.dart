enum PropertyIntent {
  currentStrength('PROPERTY_CURRENT_STRENGTH'),
  purchaseTiming('PROPERTY_PURCHASE_TIMING'),
  strongerWindow('PROPERTY_STRONGER_WINDOW');

  const PropertyIntent(this.wire);
  final String wire;
}

/// Server-owned Property Rules v1 data. This model deliberately only renders
/// classifications and boundaries supplied by the Property answer endpoint.
class PropertySupportWindow {
  const PropertySupportWindow({
    required this.start,
    required this.end,
    required this.temporalStatus,
    required this.timingClassification,
  });

  final DateTime start;
  final DateTime end;
  final String temporalStatus;
  final String timingClassification;

  static PropertySupportWindow? tryFromJson(Object? value) {
    if (value is! Map<String, dynamic>) return null;
    final start = DateTime.tryParse(value['start'] as String? ?? '');
    final end = DateTime.tryParse(value['end'] as String? ?? '');
    if (start == null || end == null || !end.isAfter(start)) return null;
    return PropertySupportWindow(
      start: start.toUtc(),
      end: end.toUtc(),
      temporalStatus: value['temporalStatus'] as String? ?? 'UPCOMING',
      timingClassification:
          value['timingClassification'] as String? ?? 'BOUNDED_WINDOW',
    );
  }
}

class PropertyAnswer {
  const PropertyAnswer({
    required this.intent,
    required this.answerability,
    required this.classification,
    required this.windowStatus,
    required this.strongerWindow,
    required this.evidence,
  });

  final PropertyIntent intent;
  final String answerability;
  final String classification;
  final String windowStatus;
  final PropertySupportWindow? strongerWindow;
  final Map<String, dynamic> evidence;

  factory PropertyAnswer.fromJson(Map<String, dynamic> json) {
    final intent = PropertyIntent.values.firstWhere(
      (item) => item.wire == json['intent'],
      orElse: () => PropertyIntent.purchaseTiming,
    );
    return PropertyAnswer(
      intent: intent,
      answerability: json['answerability'] as String? ?? 'SUPPORTED',
      classification: json['classification'] as String? ?? 'WEAK',
      windowStatus: json['windowStatus'] as String? ?? 'NO_RELIABLE_WINDOW',
      strongerWindow: PropertySupportWindow.tryFromJson(json['strongerWindow']),
      evidence: Map<String, dynamic>.unmodifiable(
        json['evidence'] is Map
            ? Map<String, dynamic>.from(json['evidence'] as Map)
            : const {},
      ),
    );
  }
}
