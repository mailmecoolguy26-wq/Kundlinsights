import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/core/config/development_flags.dart';
import 'package:kundlinsights_mobile/features/payments/data/apple_store_purchase_service.dart';
import 'package:kundlinsights_mobile/features/payments/data/debug_local_storekit_entitlement_session.dart';

const _productId = 'com.taraverse.career.premium.annual';
const _primarySixMonthProductId = 'com.taraverse.career.premium.6month';
const _addOnSixMonthProductId = 'com.taraverse.career.addon.6month';

void main() {
  test('development gate is default-off and cannot activate outside debug', () {
    expect(
      DevelopmentFlags.isAppleLocalStoreKitTestingEnabled(
        debugMode: true,
        buildFlag: false,
      ),
      isFalse,
    );
    expect(
      DevelopmentFlags.isAppleLocalStoreKitTestingEnabled(
        debugMode: false,
        buildFlag: true,
      ),
      isFalse,
    );
    expect(
      DevelopmentFlags.isAppleLocalStoreKitTestingEnabled(
        debugMode: true,
        buildFlag: true,
      ),
      isTrue,
    );
  });

  test(
    'Xcode StoreKit 2 JWS activates only its authenticated profile scope',
    () {
      final first = DebugLocalStoreKitEntitlementSession(enabled: true);
      expect(_active(first, 'user-a', 'profile-a'), isFalse);
      expect(
        first.activateIfLocalXcodeTransaction(
          purchase: _purchase(
            _jws({'environment': 'Xcode', 'productId': _productId}),
          ),
          expectedProductId: _productId,
          authenticatedSubject: 'user-a',
          birthProfileId: 'profile-a',
        ),
        isTrue,
      );
      expect(_active(first, 'user-a', 'profile-a'), isTrue);
      expect(_active(first, 'user-a', 'profile-b'), isFalse);
      expect(_active(first, 'user-b', 'profile-a'), isFalse);

      final restarted = DebugLocalStoreKitEntitlementSession(enabled: true);
      expect(_active(restarted, 'user-a', 'profile-a'), isFalse);
    },
  );

  test(
    'rejects a wrong product, non-Xcode environment, and malformed receipt',
    () {
      for (final evidence in [
        _jws({'environment': 'Sandbox', 'productId': _productId}),
        _jws({'environment': 'Production', 'productId': _productId}),
        'not-a-jws',
        base64Encode(utf8.encode('storekit-1-receipt')),
      ]) {
        final session = DebugLocalStoreKitEntitlementSession(enabled: true);
        expect(
          session.activateIfLocalXcodeTransaction(
            purchase: _purchase(evidence),
            expectedProductId: _productId,
            authenticatedSubject: 'user-a',
            birthProfileId: 'profile-a',
          ),
          isFalse,
        );
        expect(_active(session, 'user-a', 'profile-a'), isFalse);
      }

      final session = DebugLocalStoreKitEntitlementSession(enabled: true);
      expect(
        session.activateIfLocalXcodeTransaction(
          purchase: _purchase(
            _jws({'environment': 'Xcode', 'productId': 'other.product'}),
          ),
          expectedProductId: _productId,
          authenticatedSubject: 'user-a',
          birthProfileId: 'profile-a',
        ),
        isFalse,
      );
    },
  );

  test('logout clears local debug profile entitlements', () {
    final session = DebugLocalStoreKitEntitlementSession(enabled: true);
    session.activateIfLocalXcodeTransaction(
      purchase: _purchase(
        _jws({'environment': 'Xcode', 'productId': _productId}),
      ),
      expectedProductId: _productId,
      authenticatedSubject: 'user-a',
      birthProfileId: 'profile-a',
    );

    session.synchronizeAuthenticatedSubject('user-a');
    session.synchronizeAuthenticatedSubject(null);

    expect(_active(session, 'user-a', 'profile-a'), isFalse);
  });

  test('one local primary makes every later unpaid profile an add-on', () {
    final session = DebugLocalStoreKitEntitlementSession(enabled: true);

    expect(
      session.activateIfLocalXcodeTransaction(
        purchase: _purchase(
          _jws({
            'environment': 'Xcode',
            'productId': _primarySixMonthProductId,
          }),
          productId: _primarySixMonthProductId,
          transactionId: 'primary-a',
        ),
        expectedProductId: _primarySixMonthProductId,
        authenticatedSubject: 'user-a',
        birthProfileId: 'profile-a',
      ),
      isTrue,
    );
    expect(session.hasActivePrimarySubscription('user-a'), isTrue);
    expect(
      session.resolvePurchaseMode(
        authenticatedSubject: 'user-a',
        birthProfileId: 'profile-b',
        backendPurchaseMode: null,
      ),
      'ADDON',
    );
    // A later backend refresh cannot override the local-primary precedence.
    expect(
      session.resolvePurchaseMode(
        authenticatedSubject: 'user-a',
        birthProfileId: 'profile-b',
        backendPurchaseMode: 'ADDON',
      ),
      'ADDON',
    );

    expect(
      session.activateIfLocalXcodeTransaction(
        purchase: _purchase(
          _jws({'environment': 'Xcode', 'productId': _addOnSixMonthProductId}),
          productId: _addOnSixMonthProductId,
          transactionId: 'addon-b',
        ),
        expectedProductId: _addOnSixMonthProductId,
        authenticatedSubject: 'user-a',
        birthProfileId: 'profile-b',
        entitlementSource: 'ADDON_PURCHASE',
      ),
      isTrue,
    );
    for (final profile in ['profile-c', 'profile-d']) {
      expect(
        session.resolvePurchaseMode(
          authenticatedSubject: 'user-a',
          birthProfileId: profile,
          backendPurchaseMode: 'PRIMARY_SUBSCRIPTION',
        ),
        'ADDON',
      );
    }
    expect(
      session.localEntitlementSourceFor(
        authenticatedSubject: 'user-a',
        birthProfileId: 'profile-b',
      ),
      'ADDON_PURCHASE',
    );
  });

  test('cannot create a second local primary for the same subject', () {
    final session = DebugLocalStoreKitEntitlementSession(enabled: true);
    for (final profile in ['profile-a', 'profile-b']) {
      final activated = session.activateIfLocalXcodeTransaction(
        purchase: _purchase(
          _jws({
            'environment': 'Xcode',
            'productId': _primarySixMonthProductId,
          }),
          productId: _primarySixMonthProductId,
          transactionId: 'primary-$profile',
        ),
        expectedProductId: _primarySixMonthProductId,
        authenticatedSubject: 'user-a',
        birthProfileId: profile,
      );
      expect(activated, profile == 'profile-a');
    }
    expect(_active(session, 'user-a', 'profile-a'), isTrue);
    expect(_active(session, 'user-a', 'profile-b'), isFalse);
  });
}

bool _active(
  DebugLocalStoreKitEntitlementSession session,
  String subject,
  String profile,
) =>
    session.isActiveFor(authenticatedSubject: subject, birthProfileId: profile);

StorePurchaseUpdate _purchase(
  String evidence, {
  String productId = _productId,
  String? transactionId,
}) => StorePurchaseUpdate(
  productId: productId,
  status: StorePurchaseStatus.purchased,
  serverVerificationData: evidence,
  pendingCompletePurchase: false,
  transactionId: transactionId,
);

String _jws(Map<String, Object> payload) {
  final encoded = base64Url
      .encode(utf8.encode(jsonEncode(payload)))
      .replaceAll('=', '');
  return 'header.$encoded.signature';
}
