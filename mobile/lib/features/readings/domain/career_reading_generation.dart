class CareerEligibility {
  const CareerEligibility({
    required this.eligible,
    this.mode,
    this.purchaseMode,
    this.validUntil,
    this.consuming = false,
  });
  final bool eligible;
  final String? mode;
  final String? purchaseMode;
  final DateTime? validUntil;
  final bool consuming;
  factory CareerEligibility.fromJson(Map<String, dynamic> json) {
    final entitlements = json['entitlements'];
    final profilePremium = entitlements is Map<String, dynamic>
        ? entitlements['profilePremium']
        : null;
    // Temporary compatibility for clients served by a pre-Phase-1 backend.
    final career = profilePremium is Map<String, dynamic>
        ? profilePremium
        : entitlements is Map<String, dynamic>
        ? entitlements['career']
        : null;
    final eligible = career is Map<String, dynamic> ? career['eligible'] : null;
    if (eligible is! bool) {
      throw const FormatException('Malformed entitlement status.');
    }
    final mode = career is Map<String, dynamic> ? career['mode'] : null;
    if (mode != null && mode is! String) {
      throw const FormatException('Malformed entitlement status.');
    }
    final purchaseMode = career is Map<String, dynamic>
        ? career['purchaseMode']
        : null;
    if (purchaseMode != null &&
        (purchaseMode is! String ||
            !{'PRIMARY_SUBSCRIPTION', 'ADDON'}.contains(purchaseMode))) {
      throw const FormatException('Malformed entitlement status.');
    }
    final consuming = career is Map<String, dynamic>
        ? career['consuming']
        : null;
    if (consuming != null && consuming is! bool) {
      throw const FormatException('Malformed entitlement status.');
    }
    final rawValidUntil = career is Map<String, dynamic>
        ? career['validUntil']
        : null;
    final validUntil = rawValidUntil is String
        ? DateTime.tryParse(rawValidUntil)
        : null;
    return CareerEligibility(
      eligible: eligible,
      mode: mode as String?,
      purchaseMode: purchaseMode as String?,
      validUntil: validUntil,
      consuming: consuming as bool? ?? false,
    );
  }
}

class CreatedCareerReading {
  const CreatedCareerReading({required this.readingId});
  final String readingId;
  factory CreatedCareerReading.fromJson(Map<String, dynamic> json) {
    final reading = json['reading'];
    final id = reading is Map<String, dynamic> ? reading['readingId'] : null;
    if (id is! String || id.isEmpty) {
      throw const FormatException('Malformed created reading.');
    }
    return CreatedCareerReading(readingId: id);
  }
}

abstract interface class CareerReadingGenerationRepository {
  Future<CareerEligibility> getCareerEligibility({
    required String birthProfileId,
  });
  Future<CreatedCareerReading> createCareerReading({
    required String birthProfileId,
    required String idempotencyKey,
  });
}

class UnavailableCareerReadingGenerationRepository
    implements CareerReadingGenerationRepository {
  const UnavailableCareerReadingGenerationRepository();
  @override
  Future<CareerEligibility> getCareerEligibility({
    required String birthProfileId,
  }) => Future.error(StateError('Configuration is required.'));
  @override
  Future<CreatedCareerReading> createCareerReading({
    required String birthProfileId,
    required String idempotencyKey,
  }) => Future.error(StateError('Configuration is required.'));
}
