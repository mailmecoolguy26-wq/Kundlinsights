import 'dart:convert';

import '../../../core/storage/secure_state_store.dart';

/// The minimum information needed to safely retry one StoreKit consumable
/// verification after an interruption.  It deliberately contains no session
/// credentials or profile data other than the immutable profile identifier.
class PendingApplePurchase {
  const PendingApplePurchase({
    this.transactionId,
    required this.birthProfileId,
    required this.productId,
    required this.evidence,
    required this.environment,
    required this.updatedAt,
    this.version = 1,
  });

  static const currentVersion = 1;

  final int version;
  final String? transactionId;
  final String birthProfileId;
  final String productId;
  final String evidence;
  final String environment;
  final DateTime updatedAt;

  Map<String, Object?> toJson() => {
    'version': currentVersion,
    'provider': 'APPLE',
    'logicalSku': 'career_profile_unlock',
    'transactionId': transactionId,
    'birthProfileId': birthProfileId,
    'productId': productId,
    'evidence': evidence,
    'environment': environment,
    'updatedAt': updatedAt.toUtc().toIso8601String(),
  };

  static PendingApplePurchase? tryParse(String value) {
    try {
      final decoded = jsonDecode(value);
      if (decoded is! Map<String, dynamic> ||
          decoded['version'] != currentVersion ||
          decoded['provider'] != 'APPLE' ||
          decoded['logicalSku'] != 'career_profile_unlock') {
        return null;
      }
      final transactionId = decoded['transactionId'];
      final birthProfileId = decoded['birthProfileId'];
      final productId = decoded['productId'];
      final evidence = decoded['evidence'];
      final environment = decoded['environment'];
      final updatedAt = decoded['updatedAt'];
      if ((transactionId != null &&
              (transactionId is! String || transactionId.isEmpty)) ||
          birthProfileId is! String ||
          birthProfileId.isEmpty ||
          productId is! String ||
          productId.isEmpty ||
          evidence is! String ||
          evidence.isEmpty ||
          environment is! String ||
          environment.isEmpty ||
          updatedAt is! String) {
        return null;
      }
      final timestamp = DateTime.tryParse(updatedAt);
      if (timestamp == null) return null;
      return PendingApplePurchase(
        transactionId: transactionId as String?,
        birthProfileId: birthProfileId,
        productId: productId,
        evidence: evidence,
        environment: environment,
        updatedAt: timestamp,
      );
    } catch (_) {
      return null;
    }
  }
}

abstract interface class PendingApplePurchaseStore {
  Future<PendingApplePurchase?> load();
  Future<void> save(PendingApplePurchase purchase);
  Future<void> clear();
}

class SecurePendingApplePurchaseStore implements PendingApplePurchaseStore {
  SecurePendingApplePurchaseStore(this._store);
  static const storageKey = 'taraverse.apple.pending_profile_unlock.v1';
  final SecureStateStore _store;

  @override
  Future<PendingApplePurchase?> load() async {
    final value = await _store.read(storageKey);
    if (value == null) return null;
    final pending = PendingApplePurchase.tryParse(value);
    if (pending == null) await _store.delete(storageKey);
    return pending;
  }

  @override
  Future<void> save(PendingApplePurchase purchase) =>
      _store.write(key: storageKey, value: jsonEncode(purchase.toJson()));

  @override
  Future<void> clear() => _store.delete(storageKey);
}

class InMemoryPendingApplePurchaseStore implements PendingApplePurchaseStore {
  PendingApplePurchase? value;

  @override
  Future<void> clear() async => value = null;

  @override
  Future<PendingApplePurchase?> load() async => value;

  @override
  Future<void> save(PendingApplePurchase purchase) async => value = purchase;
}
