class CareerPremiumProduct {
  const CareerPremiumProduct({
    required this.logicalSku,
    required this.storeProductId,
    required this.title,
    required this.description,
    required this.localizedPrice,
    required this.rawPrice,
    required this.currencyCode,
  });

  final String logicalSku;
  final String storeProductId;
  final String title;
  final String description;
  final String localizedPrice;
  final double rawPrice;
  final String currencyCode;
}

enum CareerPremiumProductLoadState {
  idle,
  loading,
  available,
  unavailable,
  error,
}
