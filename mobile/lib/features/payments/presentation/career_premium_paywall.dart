import 'package:flutter/material.dart';

import '../../../app/theme/app_theme.dart';
import '../../../shared/widgets/app_card.dart';
import '../career_premium_product_controller.dart';
import '../career_premium_purchase_controller.dart';
import '../domain/career_premium_product.dart';

class CareerPremiumPaywall extends StatefulWidget {
  const CareerPremiumPaywall({
    super.key,
    required this.productController,
    required this.hasAccess,
    required this.onSubscribePressed,
    required this.onContinuePressed,
    this.entitlementMode,
    this.purchaseController,
  });

  final CareerPremiumProductController productController;
  final bool hasAccess;
  final String? entitlementMode;
  final VoidCallback onSubscribePressed;
  final VoidCallback onContinuePressed;
  final CareerPremiumPurchaseController? purchaseController;

  @override
  State<CareerPremiumPaywall> createState() => _CareerPremiumPaywallState();
}

class _CareerPremiumPaywallState extends State<CareerPremiumPaywall> {
  @override
  void initState() {
    super.initState();
    if (!widget.hasAccess &&
        widget.productController.state == CareerPremiumProductLoadState.idle) {
      widget.productController.load();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.hasAccess) {
      return AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Career Premium Active',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: AppSpacing.xs),
            const Text('Your Career Premium access is available.'),
            const SizedBox(height: AppSpacing.sm),
            FilledButton(
              onPressed: widget.onContinuePressed,
              child: const Text('View Career Reading'),
            ),
          ],
        ),
      );
    }
    return ListenableBuilder(
      listenable: Listenable.merge([
        widget.productController,
        if (widget.purchaseController != null) widget.purchaseController!,
      ]),
      builder: (context, child) => AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Career Premium',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: AppSpacing.xs),
            const Text('Unlock your complete Career reading.'),
            const SizedBox(height: AppSpacing.sm),
            const _Benefits(),
            const SizedBox(height: AppSpacing.md),
            _ProductAction(
              controller: widget.productController,
              onSubscribePressed: widget.onSubscribePressed,
              purchaseController: widget.purchaseController,
            ),
            if (widget.purchaseController != null)
              TextButton(
                onPressed: _restoreEnabled(widget.purchaseController!)
                    ? widget.purchaseController!.restorePurchases
                    : null,
                child: const Text('Restore Purchases'),
              ),
            const SizedBox(height: AppSpacing.sm),
            const Text(
              'Annual subscription. Payment is managed through your Apple ID '
              'and renews automatically unless canceled in Apple account settings.',
              style: TextStyle(fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}

class _Benefits extends StatelessWidget {
  const _Benefits();

  @override
  Widget build(BuildContext context) => const Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text('• Detailed Career analysis and indicators'),
      Text('• Dasha-based Career timing'),
      Text('• Career opportunities and challenges'),
      Text('• Ongoing access to your saved Career reading'),
    ],
  );
}

class _ProductAction extends StatelessWidget {
  const _ProductAction({
    required this.controller,
    required this.onSubscribePressed,
    this.purchaseController,
  });
  final CareerPremiumProductController controller;
  final VoidCallback onSubscribePressed;
  final CareerPremiumPurchaseController? purchaseController;

  @override
  Widget build(BuildContext context) {
    final purchaseState = purchaseController?.state;
    final restoreState = purchaseController?.restoreState;
    if (restoreState == CareerPremiumRestoreState.restoring ||
        restoreState == CareerPremiumRestoreState.verifying) {
      final text = restoreState == CareerPremiumRestoreState.restoring
          ? 'Checking your App Store purchases…'
          : 'Restoring Career Premium…';
      return Semantics(
        liveRegion: true,
        label: text,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [Text(text), const LinearProgressIndicator()],
        ),
      );
    }
    if (restoreState == CareerPremiumRestoreState.notFound) {
      return const Text('No previous Career Premium purchase was found.');
    }
    if (restoreState == CareerPremiumRestoreState.error) {
      return const Text('Unable to restore purchases. Please try again.');
    }
    if (purchaseState == CareerPremiumPurchaseState.purchasing ||
        purchaseState == CareerPremiumPurchaseState.verifying) {
      final text = purchaseState == CareerPremiumPurchaseState.purchasing
          ? 'Starting purchase…'
          : 'Verifying purchase…';
      return Semantics(
        liveRegion: true,
        label: text,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(text),
            const SizedBox(height: AppSpacing.sm),
            const LinearProgressIndicator(),
          ],
        ),
      );
    }
    if (purchaseState == CareerPremiumPurchaseState.pending) {
      return Semantics(
        liveRegion: true,
        label: 'Purchase pending',
        child: Text(
          'Purchase pending. We will update access when Apple confirms it.',
        ),
      );
    }
    if (purchaseState == CareerPremiumPurchaseState.refreshFailed) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Your purchase was verified. Refresh access to continue.'),
          TextButton(
            onPressed: purchaseController?.retryEntitlementRefresh,
            child: const Text('Refresh access'),
          ),
        ],
      );
    }
    if (purchaseState == CareerPremiumPurchaseState.error) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Your purchase could not be verified yet. Please try again.',
          ),
          if (purchaseController?.canRetryVerification ?? false)
            TextButton(
              onPressed: purchaseController!.retryVerification,
              child: const Text('Retry verification'),
            ),
        ],
      );
    }
    switch (controller.state) {
      case CareerPremiumProductLoadState.idle:
      case CareerPremiumProductLoadState.loading:
        return Semantics(
          liveRegion: true,
          label: 'Loading subscription details',
          child: LinearProgressIndicator(),
        );
      case CareerPremiumProductLoadState.available:
        final product = controller.product!;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Annual subscription — ${product.localizedPrice} / year'),
            const SizedBox(height: AppSpacing.sm),
            Semantics(
              button: true,
              label:
                  'Unlock Career Premium — ${product.localizedPrice} per year',
              child: FilledButton(
                onPressed:
                    restoreState == null ||
                        restoreState == CareerPremiumRestoreState.idle
                    ? onSubscribePressed
                    : null,
                child: Text(
                  'Unlock Career Premium — ${product.localizedPrice}/year',
                ),
              ),
            ),
          ],
        );
      case CareerPremiumProductLoadState.unavailable:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Purchases are temporarily unavailable.'),
            const SizedBox(height: AppSpacing.sm),
            const FilledButton(
              onPressed: null,
              child: Text('Career Premium unavailable'),
            ),
          ],
        );
      case CareerPremiumProductLoadState.error:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Unable to load subscription details. Please try again.',
            ),
            TextButton(onPressed: controller.load, child: const Text('Retry')),
          ],
        );
    }
  }
}

bool _restoreEnabled(CareerPremiumPurchaseController controller) =>
    controller.state != CareerPremiumPurchaseState.purchasing &&
    controller.state != CareerPremiumPurchaseState.pending &&
    controller.state != CareerPremiumPurchaseState.verifying &&
    controller.restoreState != CareerPremiumRestoreState.restoring &&
    controller.restoreState != CareerPremiumRestoreState.verifying;
