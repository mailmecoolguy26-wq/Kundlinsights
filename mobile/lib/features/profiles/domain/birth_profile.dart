class PlaceCandidate {
  const PlaceCandidate({
    required this.id,
    required this.label,
    required this.latitude,
    required this.longitude,
    required this.timezone,
    required this.timezoneProvenance,
  });

  final String id;
  final String label;
  final double latitude;
  final double longitude;
  final String timezone;
  final Map<String, Object?> timezoneProvenance;
}

class ResolvedBirthData {
  const ResolvedBirthData(this.value);

  /// This is backend-authoritative data. Presentation may read safe display
  /// fields but must pass this exact map to birth-profile creation unchanged.
  final Map<String, Object?> value;

  String get localDate => value['localDate']! as String;
  String get localTime => value['localTime']! as String;
  String get timezone => value['timezone']! as String;

  /// Customer-safe place label retained with the encrypted birth payload.
  /// Older payload versions used a few different display-only shapes, so the
  /// reader is deliberately tolerant while never falling back to coordinates.
  String? get displayLocation {
    final direct = [
      value['displayLocation'],
      value['displayName'],
      value['placeName'],
      value['placeLabel'],
      value['location'],
    ];
    for (final candidate in direct) {
      if (candidate is String && candidate.trim().isNotEmpty) {
        return candidate.trim();
      }
    }
    for (final containerKey in ['display', 'place']) {
      final container = value[containerKey];
      if (container is! Map) continue;
      for (final key in ['label', 'displayName', 'name']) {
        final candidate = container[key];
        if (candidate is String && candidate.trim().isNotEmpty) {
          return candidate.trim();
        }
      }
    }
    return null;
  }
}

class BirthProfile {
  const BirthProfile({
    required this.id,
    required this.displayLabel,
    required this.birthData,
    required this.status,
  });

  final String id;
  final String? displayLabel;
  final ResolvedBirthData birthData;
  final String status;

  String get label =>
      displayLabel?.trim().isNotEmpty == true ? displayLabel! : 'Birth profile';
}
