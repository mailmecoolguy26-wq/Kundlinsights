import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'apple_store_purchase_service.dart';

enum DebugStoreKitEnvironment { xcode, sandbox, production, unknown }

class DebugStoreKitTransactionClassification {
  const DebugStoreKitTransactionClassification({
    required this.environment,
    required this.isStoreKit2Jws,
    required this.productMatches,
  });

  final DebugStoreKitEnvironment environment;
  final bool isStoreKit2Jws;
  final bool productMatches;

  bool get isQualifyingXcodeTransaction =>
      isStoreKit2Jws &&
      productMatches &&
      environment == DebugStoreKitEnvironment.xcode;
}

/// Memory-only debug support for an Xcode StoreKit configuration.
///
/// It deliberately accepts only a StoreKit 2 JWS that identifies itself as
/// `Xcode`. Sandbox, Production, StoreKit 1 receipts, and malformed values
/// continue through the normal server-verification flow.
class DebugLocalStoreKitEntitlementSession extends ChangeNotifier {
  DebugLocalStoreKitEntitlementSession({required this.enabled});

  final bool enabled;
  final Set<_DebugProfileScope> _entitledProfiles = {};
  final Map<_DebugProfileScope, String> _entitlementSources = {};
  final Map<String, _DebugProfileScope> _transactionScopes = {};
  final Set<String> _handledTransactionKeys = {};
  final Set<String> _completedTransactionKeys = {};
  String? _authenticatedSubject;

  bool isActiveFor({
    required String? authenticatedSubject,
    required String? birthProfileId,
  }) {
    if (!enabled ||
        authenticatedSubject == null ||
        authenticatedSubject.isEmpty ||
        birthProfileId == null ||
        birthProfileId.isEmpty) {
      return false;
    }
    return _entitledProfiles.contains(
      _DebugProfileScope(authenticatedSubject, birthProfileId),
    );
  }

  /// Whether this subject has any active local primary subscription, regardless
  /// of which birth profile is currently selected.
  bool hasActivePrimarySubscription(String? authenticatedSubject) {
    if (!enabled ||
        authenticatedSubject == null ||
        authenticatedSubject.isEmpty) {
      return false;
    }
    return _entitledProfiles.any(
      (scope) =>
          scope.authenticatedSubject == authenticatedSubject &&
          _entitlementSources[scope] == 'PRIMARY_SUBSCRIPTION',
    );
  }

  /// Debug-only provenance for the selected profile. It is never persisted or
  /// sent to the backend.
  String? localEntitlementSourceFor({
    required String? authenticatedSubject,
    required String? birthProfileId,
  }) {
    if (!enabled || authenticatedSubject == null || birthProfileId == null) {
      return null;
    }
    final scope = _DebugProfileScope(authenticatedSubject, birthProfileId);
    return _entitledProfiles.contains(scope)
        ? _entitlementSources[scope]
        : null;
  }

  /// Supplements only the backend purchase mode in the explicit local Xcode
  /// seam. It never changes server entitlement state or provider verification.
  /// The only local-StoreKit purchase-mode resolver. Callers must carry its
  /// result from eligibility through product loading and StoreKit invocation;
  /// no UI or purchase layer should infer mode from a plan duration/product.
  String? resolvePurchaseMode({
    required String? authenticatedSubject,
    required String? birthProfileId,
    required String? backendPurchaseMode,
  }) {
    if (!enabled || authenticatedSubject == null || birthProfileId == null) {
      return backendPurchaseMode ?? 'PRIMARY_SUBSCRIPTION';
    }
    final current = _DebugProfileScope(authenticatedSubject, birthProfileId);
    if (_entitledProfiles.contains(current)) return null;
    return hasActivePrimarySubscription(authenticatedSubject)
        ? 'ADDON'
        : (backendPurchaseMode ?? 'PRIMARY_SUBSCRIPTION');
  }

  @Deprecated('Use resolvePurchaseMode for all purchase-mode decisions.')
  String? effectivePurchaseMode({
    required String? authenticatedSubject,
    required String? birthProfileId,
    required String? backendPurchaseMode,
  }) => resolvePurchaseMode(
    authenticatedSubject: authenticatedSubject,
    birthProfileId: birthProfileId,
    backendPurchaseMode: backendPurchaseMode,
  );

  /// Debug entitlements are intentionally session-only. Logging out clears
  /// every local association so a later account cannot inherit them.
  void synchronizeAuthenticatedSubject(String? authenticatedSubject) {
    final normalized = authenticatedSubject?.trim();
    if (normalized == _authenticatedSubject) return;
    _authenticatedSubject = normalized;
    if (normalized == null || normalized.isEmpty) {
      clear();
      return;
    }
    if (_entitledProfiles.isNotEmpty || _transactionScopes.isNotEmpty) {
      clear();
    }
  }

  void clear() {
    final changed =
        _entitledProfiles.isNotEmpty ||
        _transactionScopes.isNotEmpty ||
        _handledTransactionKeys.isNotEmpty ||
        _completedTransactionKeys.isNotEmpty;
    _entitledProfiles.clear();
    _entitlementSources.clear();
    _transactionScopes.clear();
    _handledTransactionKeys.clear();
    _completedTransactionKeys.clear();
    if (changed) notifyListeners();
  }

  bool activateIfLocalXcodeTransaction({
    required StorePurchaseUpdate purchase,
    required String expectedProductId,
    required String authenticatedSubject,
    required String birthProfileId,
    String entitlementSource = 'PRIMARY_SUBSCRIPTION',
  }) {
    final classification = classify(
      purchase: purchase,
      expectedProductId: expectedProductId,
    );
    if (!enabled || !classification.isQualifyingXcodeTransaction) {
      return false;
    }
    final scope = _DebugProfileScope(authenticatedSubject, birthProfileId);
    if (entitlementSource == 'PRIMARY_SUBSCRIPTION' &&
        !_entitledProfiles.contains(scope) &&
        hasActivePrimarySubscription(authenticatedSubject)) {
      // A local StoreKit session represents one primary subscription per
      // authenticated subject. Additional profiles must use add-on products.
      return false;
    }
    final key = _transactionKey(purchase);
    _handledTransactionKeys.add(key);
    _transactionScopes[key] = scope;
    _entitlementSources[scope] = entitlementSource;
    if (_entitledProfiles.add(scope)) {
      notifyListeners();
    }
    return true;
  }

  bool hasProfileAssociationForTransaction(StorePurchaseUpdate purchase) =>
      _transactionScopes.containsKey(_transactionKey(purchase));

  bool activateAssociatedProfileForLocalXcodeTransaction({
    required StorePurchaseUpdate purchase,
    required String expectedProductId,
    required String authenticatedSubject,
  }) {
    final classification = classify(
      purchase: purchase,
      expectedProductId: expectedProductId,
    );
    if (!enabled || !classification.isQualifyingXcodeTransaction) {
      return false;
    }
    final scope = _transactionScopes[_transactionKey(purchase)];
    if (scope == null || scope.authenticatedSubject != authenticatedSubject) {
      return false;
    }
    _handledTransactionKeys.add(_transactionKey(purchase));
    if (_entitledProfiles.add(scope)) notifyListeners();
    return true;
  }

  DebugStoreKitTransactionClassification classify({
    required StorePurchaseUpdate purchase,
    required String expectedProductId,
  }) {
    final parts = purchase.serverVerificationData.split('.');
    if (parts.length != 3 || parts.any((part) => part.isEmpty)) {
      return DebugStoreKitTransactionClassification(
        environment: DebugStoreKitEnvironment.unknown,
        isStoreKit2Jws: false,
        productMatches: purchase.productId == expectedProductId,
      );
    }
    try {
      final payload = utf8.decode(
        base64Url.decode(base64Url.normalize(parts[1])),
      );
      final decoded = jsonDecode(payload);
      if (decoded is! Map) {
        return DebugStoreKitTransactionClassification(
          environment: DebugStoreKitEnvironment.unknown,
          isStoreKit2Jws: false,
          productMatches: purchase.productId == expectedProductId,
        );
      }
      return DebugStoreKitTransactionClassification(
        environment: switch (decoded['environment']) {
          'Xcode' => DebugStoreKitEnvironment.xcode,
          'Sandbox' => DebugStoreKitEnvironment.sandbox,
          'Production' => DebugStoreKitEnvironment.production,
          _ => DebugStoreKitEnvironment.unknown,
        },
        isStoreKit2Jws: true,
        productMatches:
            purchase.productId == expectedProductId &&
            decoded['productId'] == expectedProductId,
      );
    } catch (_) {
      return DebugStoreKitTransactionClassification(
        environment: DebugStoreKitEnvironment.unknown,
        isStoreKit2Jws: false,
        productMatches: purchase.productId == expectedProductId,
      );
    }
  }

  bool hasHandledTransaction(StorePurchaseUpdate purchase) =>
      _handledTransactionKeys.contains(_transactionKey(purchase));

  bool wasTransactionCompletionRecorded(StorePurchaseUpdate purchase) =>
      _completedTransactionKeys.contains(_transactionKey(purchase));

  void recordTransactionCompletion(StorePurchaseUpdate purchase) {
    _completedTransactionKeys.add(_transactionKey(purchase));
  }

  /// Safe only for debug diagnostics: this never exposes the raw transaction
  /// identifier or signed transaction.
  String debugDedupeKey(StorePurchaseUpdate purchase) {
    final transactionId = purchase.transactionId?.trim();
    return transactionId?.isNotEmpty == true
        ? 'transaction:${transactionId.hashCode}'
        : 'evidence:${purchase.serverVerificationData.hashCode}';
  }

  String _transactionKey(StorePurchaseUpdate purchase) {
    final transactionId = purchase.transactionId?.trim();
    final identity = transactionId?.isNotEmpty == true
        ? 'transaction:$transactionId'
        : 'evidence:${purchase.serverVerificationData}';
    return '${purchase.productId}:$identity';
  }
}

class _DebugProfileScope {
  const _DebugProfileScope(this.authenticatedSubject, this.birthProfileId);

  final String authenticatedSubject;
  final String birthProfileId;

  @override
  bool operator ==(Object other) =>
      other is _DebugProfileScope &&
      other.authenticatedSubject == authenticatedSubject &&
      other.birthProfileId == birthProfileId;

  @override
  int get hashCode => Object.hash(authenticatedSubject, birthProfileId);
}

/// This is deliberately nullable by default. Bootstrap supplies an in-memory
/// session only for an explicitly opted-in debug build.
final debugLocalStoreKitEntitlementSessionProvider =
    Provider<DebugLocalStoreKitEntitlementSession?>((ref) => null);
