class TarotEntitlement {
  const TarotEntitlement({
    required this.freeReadingAvailableToday,
    required this.paidCreditsRemaining,
    this.nextFreeAt,
  });
  final bool freeReadingAvailableToday;
  final int paidCreditsRemaining;
  final DateTime? nextFreeAt;
  factory TarotEntitlement.fromJson(Map<String, dynamic> json) =>
      TarotEntitlement(
        freeReadingAvailableToday: json['freeReadingAvailableToday'] == true,
        paidCreditsRemaining:
            (json['paidCreditsRemaining'] as num?)?.toInt() ?? 0,
        nextFreeAt: DateTime.tryParse(json['nextFreeAt'] as String? ?? ''),
      );
}

class TarotSpreadPosition {
  const TarotSpreadPosition({required this.position, required this.name});
  final int position;
  final String name;
  factory TarotSpreadPosition.fromJson(Map<String, dynamic> json) =>
      TarotSpreadPosition(
        position: (json['position'] as num?)?.toInt() ?? 0,
        name: json['name'] as String? ?? 'Card',
      );
}

class TarotSpread {
  const TarotSpread({required this.spreadType, required this.positions});
  final String spreadType;
  final List<TarotSpreadPosition> positions;
  factory TarotSpread.fromJson(Map<String, dynamic> json) => TarotSpread(
    spreadType: json['spreadType'] as String? ?? 'GENERAL_GUIDANCE',
    positions: (json['positions'] as List? ?? const [])
        .whereType<Map>()
        .map((e) => TarotSpreadPosition.fromJson(Map<String, dynamic>.from(e)))
        .toList(growable: false),
  );
}

class TarotCard {
  const TarotCard({
    required this.position,
    required this.positionName,
    required this.cardId,
    required this.cardName,
    required this.orientation,
    this.arcana,
    this.suit,
    this.coreTheme,
  });
  final int position;
  final String positionName;
  final String cardId;
  final String cardName;
  final String orientation;
  final String? arcana;
  final String? suit;
  final String? coreTheme;
  factory TarotCard.fromJson(Map<String, dynamic> json) => TarotCard(
    position: (json['position'] as num?)?.toInt() ?? 0,
    positionName: json['positionName'] as String? ?? 'Card',
    cardId: json['cardId'] as String? ?? '',
    cardName: json['cardName'] as String? ?? 'Revealed card',
    orientation: json['orientation'] as String? ?? 'UPRIGHT',
    arcana: json['arcana'] as String?,
    suit: json['suit'] as String?,
    coreTheme: json['coreTheme'] as String?,
  );
}

class TarotCardInterpretation {
  const TarotCardInterpretation({
    required this.position,
    required this.cardId,
    required this.cardName,
    required this.interpretation,
  });
  final int position;
  final String cardId;
  final String cardName;
  final String interpretation;
  factory TarotCardInterpretation.fromJson(Map<String, dynamic> json) =>
      TarotCardInterpretation(
        position: (json['position'] as num?)?.toInt() ?? 0,
        cardId: json['cardId'] as String? ?? '',
        cardName: json['cardName'] as String? ?? '',
        interpretation: json['interpretation'] as String? ?? '',
      );
}

class TarotInterpretation {
  const TarotInterpretation({
    required this.overview,
    required this.cards,
    required this.combinedMessage,
    required this.practicalReflection,
    this.nextStep = '',
    required this.caution,
    this.disclaimer = '',
  });
  final String overview;
  final List<TarotCardInterpretation> cards;
  final String combinedMessage;
  final String practicalReflection;
  final String nextStep;
  final String caution;
  final String disclaimer;
  factory TarotInterpretation.fromJson(Map<String, dynamic> json) =>
      TarotInterpretation(
        overview: json['overview'] as String? ?? '',
        cards: (json['cards'] as List? ?? const [])
            .whereType<Map>()
            .map(
              (e) => TarotCardInterpretation.fromJson(
                Map<String, dynamic>.from(e),
              ),
            )
            .toList(growable: false),
        combinedMessage: json['combinedMessage'] as String? ?? '',
        practicalReflection: json['practicalReflection'] as String? ?? '',
        nextStep: json['nextStep'] as String? ?? '',
        caution: json['caution'] as String? ?? '',
        disclaimer: json['disclaimer'] as String? ?? '',
      );
}

class TarotReading {
  const TarotReading({
    required this.readingId,
    required this.question,
    required this.category,
    required this.spread,
    required this.status,
    required this.selectedCards,
    required this.selectableTokens,
    required this.createdAt,
    this.completedAt,
    this.interpretation,
  });
  final String readingId;
  final String question;
  final String category;
  final TarotSpread spread;
  final String status;
  final List<TarotCard> selectedCards;
  final List<String> selectableTokens;
  final DateTime createdAt;
  final DateTime? completedAt;
  final TarotInterpretation? interpretation;
  bool get canDraw => status == 'DRAWING' && selectedCards.length < 3;
  bool get isComplete => status == 'COMPLETED';
  bool get interpretationRetryable => status == 'INTERPRETATION_RETRYABLE';
  factory TarotReading.fromJson(Map<String, dynamic> json) {
    final spreadRaw = json['spread'];
    final interpretationRaw = json['interpretation'];
    return TarotReading(
      readingId: json['readingId'] as String? ?? '',
      question: json['question'] as String? ?? '',
      category: json['category'] as String? ?? 'GENERAL_GUIDANCE',
      spread: TarotSpread.fromJson(
        spreadRaw is Map ? Map<String, dynamic>.from(spreadRaw) : const {},
      ),
      status: json['status'] as String? ?? 'DRAWING',
      selectedCards: (json['selectedCards'] as List? ?? const [])
          .whereType<Map>()
          .map((e) => TarotCard.fromJson(Map<String, dynamic>.from(e)))
          .toList(growable: false),
      selectableTokens: (json['selectableTokens'] as List? ?? const [])
          .whereType<String>()
          .toList(growable: false),
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      completedAt: DateTime.tryParse(json['completedAt'] as String? ?? ''),
      interpretation: interpretationRaw is Map
          ? TarotInterpretation.fromJson(
              Map<String, dynamic>.from(interpretationRaw),
            )
          : null,
    );
  }
}

class TarotSafetyBoundary {
  const TarotSafetyBoundary({required this.message, this.suggestedQuestion});
  final String message;
  final String? suggestedQuestion;
}

class TarotPack {
  const TarotPack({
    required this.key,
    required this.quantity,
    required this.priceMinor,
    required this.currency,
  });
  final String key;
  final int quantity;
  final int priceMinor;
  final String currency;
}

sealed class TarotStartResult {
  const TarotStartResult();
}

class TarotStartReady extends TarotStartResult {
  const TarotStartReady(this.reading);
  final TarotReading reading;
}

class TarotStartSafety extends TarotStartResult {
  const TarotStartSafety(this.boundary);
  final TarotSafetyBoundary boundary;
}

class TarotStartPurchaseRequired extends TarotStartResult {
  const TarotStartPurchaseRequired(this.entitlement, this.products);
  final TarotEntitlement entitlement;
  final List<TarotPack> products;
}

class TarotHistoryPage {
  const TarotHistoryPage({required this.readings, this.nextCursor});
  final List<TarotReading> readings;
  final String? nextCursor;
}
