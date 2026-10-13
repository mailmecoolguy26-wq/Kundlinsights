import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'data/apple_store_purchase_service.dart';
import 'data/career_premium_product_loader.dart';
import 'domain/career_premium_product.dart';

class CareerPremiumProductController extends ChangeNotifier {
  CareerPremiumProductController(this._service);
  final CareerPremiumProductLoader _service;

  CareerPremiumProductLoadState _state = CareerPremiumProductLoadState.idle;
  List<CareerPremiumProduct> _products = const [];
  String? _loadedPurchaseMode;

  CareerPremiumProductLoadState get state => _state;
  List<CareerPremiumProduct> get products => _products;
  String? get loadedPurchaseMode => _loadedPurchaseMode;
  CareerPremiumProduct? get product =>
      _products.isEmpty ? null : _products.first;

  Future<void> load({String? purchaseMode}) async {
    _state = CareerPremiumProductLoadState.loading;
    _products = const [];
    _loadedPurchaseMode = purchaseMode;
    notifyListeners();
    final result = await _service.loadCareerPremiumProduct(
      purchaseMode: purchaseMode,
    );
    _state = result.state;
    _products = List.unmodifiable(result.products);
    notifyListeners();
  }
}

final careerPremiumProductControllerProvider =
    Provider<CareerPremiumProductController>((ref) {
      final controller = CareerPremiumProductController(
        ref.watch(careerPremiumProductLoaderProvider),
      );
      ref.onDispose(controller.dispose);
      return controller;
    });

final careerPremiumProductLoaderProvider = Provider<CareerPremiumProductLoader>(
  (ref) => ref.watch(appleStorePurchaseServiceProvider),
);
