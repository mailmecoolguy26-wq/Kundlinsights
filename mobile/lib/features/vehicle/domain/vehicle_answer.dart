enum VehicleIntent {
  currentStrength('VEHICLE_CURRENT_STRENGTH'),
  purchaseTiming('VEHICLE_PURCHASE_TIMING'),
  strongerWindow('VEHICLE_STRONGER_WINDOW');

  const VehicleIntent(this.wire);
  final String wire;
}

class VehicleSupportWindow {
  const VehicleSupportWindow({
    required this.start,
    required this.end,
    required this.candidateStrength,
    required this.windowShape,
    required this.temporalStatus,
    required this.internalPhases,
  });
  final DateTime start;
  final DateTime end;
  final String candidateStrength;
  final String windowShape;
  final String temporalStatus;
  final List<Object?> internalPhases;

  static VehicleSupportWindow? tryFromJson(Object? value) {
    if (value is! Map<String, dynamic>) return null;
    final start = DateTime.tryParse(value['start'] as String? ?? '');
    final end = DateTime.tryParse(value['end'] as String? ?? '');
    if (start == null || end == null || !end.isAfter(start)) return null;
    return VehicleSupportWindow(
      start: start.toUtc(),
      end: end.toUtc(),
      candidateStrength:
          value['candidateStrength'] as String? ?? 'NOT_SUPPORTED',
      windowShape: value['windowShape'] as String? ?? 'NO_RELIABLE_WINDOW',
      temporalStatus: value['temporalStatus'] as String? ?? 'FUTURE',
      internalPhases: List<Object?>.unmodifiable(
        value['internalPhases'] as List? ?? const [],
      ),
    );
  }
}

class VehicleAnswer {
  const VehicleAnswer({
    required this.intent,
    required this.answerability,
    required this.candidateStrength,
    required this.windowShape,
    required this.strongerWindow,
    required this.evidence,
  });
  final VehicleIntent intent;
  final String answerability;
  final String candidateStrength;
  final String windowShape;
  final VehicleSupportWindow? strongerWindow;
  final Map<String, dynamic> evidence;

  factory VehicleAnswer.fromJson(Map<String, dynamic> json) {
    final intent = VehicleIntent.values.firstWhere(
      (item) => item.wire == json['intent'],
      orElse: () => VehicleIntent.purchaseTiming,
    );
    return VehicleAnswer(
      intent: intent,
      answerability: json['answerability'] as String? ?? 'SUPPORTED',
      candidateStrength: json['classification'] as String? ?? 'NOT_SUPPORTED',
      windowShape: json['windowShape'] as String? ?? 'NO_RELIABLE_WINDOW',
      strongerWindow: VehicleSupportWindow.tryFromJson(json['strongerWindow']),
      evidence: Map<String, dynamic>.unmodifiable(
        json['evidence'] is Map
            ? Map<String, dynamic>.from(json['evidence'] as Map)
            : const {},
      ),
    );
  }
}
