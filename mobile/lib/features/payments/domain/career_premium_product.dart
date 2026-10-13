enum StoreSubscriptionPeriodUnit { day, week, month, year }

class StoreSubscriptionPeriod {
  const StoreSubscriptionPeriod({required this.value, required this.unit});

  final int value;
  final StoreSubscriptionPeriodUnit unit;
}

class CareerPremiumProduct {
  const CareerPremiumProduct({
    required this.logicalSku,
    required this.storeProductId,
    required this.title,
    required this.description,
    required this.localizedPrice,
    required this.rawPrice,
    required this.currencyCode,
    this.subscriptionPeriod,
  });

  final String logicalSku;
  final String storeProductId;
  final String title;
  final String description;
  final String localizedPrice;
  final double rawPrice;
  final String currencyCode;
  final StoreSubscriptionPeriod? subscriptionPeriod;
}

enum CareerPremiumProductLoadState {
  idle,
  loading,
  available,
  unavailable,
  error,
}
