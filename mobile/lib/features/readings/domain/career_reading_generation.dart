class CareerEligibility {
  const CareerEligibility({required this.eligible});
  final bool eligible;
  factory CareerEligibility.fromJson(Map<String, dynamic> json) {
    final entitlements = json['entitlements'];
    final career = entitlements is Map<String, dynamic>
        ? entitlements['career']
        : null;
    final eligible = career is Map<String, dynamic> ? career['eligible'] : null;
    if (eligible is! bool) {
      throw const FormatException('Malformed entitlement status.');
    }
    return CareerEligibility(eligible: eligible);
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
  Future<CareerEligibility> getCareerEligibility();
  Future<CreatedCareerReading> createCareerReading({
    required String birthProfileId,
    required String idempotencyKey,
  });
}

class UnavailableCareerReadingGenerationRepository
    implements CareerReadingGenerationRepository {
  const UnavailableCareerReadingGenerationRepository();
  @override
  Future<CareerEligibility> getCareerEligibility() =>
      Future.error(StateError('Configuration is required.'));
  @override
  Future<CreatedCareerReading> createCareerReading({
    required String birthProfileId,
    required String idempotencyKey,
  }) => Future.error(StateError('Configuration is required.'));
}
