import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'data/apple_store_purchase_service.dart';
import 'data/career_premium_product_loader.dart';
import 'domain/career_premium_product.dart';

class CareerPremiumProductController extends ChangeNotifier {
  CareerPremiumProductController(this._service);
  final CareerPremiumProductLoader _service;

  CareerPremiumProductLoadState _state = CareerPremiumProductLoadState.idle;
  CareerPremiumProduct? _product;

  CareerPremiumProductLoadState get state => _state;
  CareerPremiumProduct? get product => _product;

  Future<void> load() async {
    _state = CareerPremiumProductLoadState.loading;
    _product = null;
    notifyListeners();
    final result = await _service.loadCareerPremiumProduct();
    _state = result.state;
    _product = result.product;
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
