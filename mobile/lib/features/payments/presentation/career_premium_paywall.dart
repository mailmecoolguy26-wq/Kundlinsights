import 'dart:async';

import 'package:flutter/material.dart';

import '../../../app/theme/app_theme.dart';
import '../../../core/analytics/analytics.dart';
import '../../../shared/widgets/app_card.dart';
import '../career_premium_product_controller.dart';
import '../../readings/career_reading_generation_controller.dart';
import '../career_premium_purchase_controller.dart';
import '../data/apple_store_purchase_service.dart';
import '../razorpay_career_premium_controller.dart';
import '../domain/career_premium_product.dart';

class CareerPremiumPaywall extends StatefulWidget {
  const CareerPremiumPaywall({
    super.key,
    required this.productController,
    required this.hasAccess,
    required this.onSubscribePressed,
    this.onPlanSelected,
    required this.onContinuePressed,
    this.onBackHomePressed,
    this.entitlementMode,
    this.purchaseMode,
    this.purchaseController,
    this.razorpayController,
    this.onRazorpayStart,
    this.onRazorpayStartForPlan,
    this.razorpayState,
    this.onRazorpayRecover,
    this.onRazorpayReset,
    this.dedicatedRazorpaySurface = false,
    this.activeProfileLabel,
    this.razorpayProfileId,
    this.generationController,
    this.analytics,
    this.onPaywallDisplayed,
    this.onLocalDebugEntitlementActivated,
  });

  final CareerPremiumProductController productController;
  final bool hasAccess;
  final String? entitlementMode;
  final String? purchaseMode;
  final VoidCallback onSubscribePressed;
  final ValueChanged<CareerPremiumProduct>? onPlanSelected;
  final VoidCallback onContinuePressed;
  final VoidCallback? onBackHomePressed;
  final CareerPremiumPurchaseController? purchaseController;
  final RazorpayCareerPremiumController? razorpayController;
  final VoidCallback? onRazorpayStart;
  final ValueChanged<String>? onRazorpayStartForPlan;
  final RazorpayCareerPremiumState? razorpayState;
  final VoidCallback? onRazorpayRecover;
  final VoidCallback? onRazorpayReset;
  final bool dedicatedRazorpaySurface;
  final String? activeProfileLabel;
  final String? razorpayProfileId;
  final CareerReadingGenerationController? generationController;
  final Analytics? analytics;
  final Future<void> Function(String birthProfileId)? onPaywallDisplayed;
  final VoidCallback? onLocalDebugEntitlementActivated;

  @override
  State<CareerPremiumPaywall> createState() => _CareerPremiumPaywallState();
}

class _CareerPremiumPaywallState extends State<CareerPremiumPaywall> {
  bool _viewRecorded = false;
  bool _localDebugEntitlementHandled = false;
  String? _selectedStoreProductId;
  @override
  void initState() {
    super.initState();
    widget.purchaseController?.addListener(_onPurchaseControllerChanged);
    if (widget.razorpayController == null &&
        !widget.hasAccess &&
        (widget.productController.state == CareerPremiumProductLoadState.idle ||
            widget.productController.loadedPurchaseMode !=
                widget.purchaseMode)) {
      widget.productController.load(purchaseMode: widget.purchaseMode);
    }
    if (!widget.hasAccess) {
      widget.analytics?.track(AnalyticsEvent.careerPaywallViewed, {
        if (widget.razorpayProfileId != null)
          'birth_profile_id': widget.razorpayProfileId,
        'screen': 'career_paywall',
      });
    }
    if (!widget.hasAccess && widget.razorpayProfileId != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_viewRecorded || !mounted) return;
        _viewRecorded = true;
        widget.onPaywallDisplayed
            ?.call(widget.razorpayProfileId!)
            .catchError((_) {});
      });
    }
  }

  @override
  void didUpdateWidget(covariant CareerPremiumPaywall oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.purchaseMode != widget.purchaseMode) {
      // StoreKit products are mode-specific. A local debug primary purchase
      // can change another profile to ADDON while this paywall stays mounted.
      // Do not leave stale primary plans selected in that case.
      _selectedStoreProductId = null;
      if (widget.razorpayController == null && !widget.hasAccess) {
        unawaited(
          widget.productController.load(purchaseMode: widget.purchaseMode),
        );
      }
    }
    if (oldWidget.purchaseController != widget.purchaseController) {
      oldWidget.purchaseController?.removeListener(
        _onPurchaseControllerChanged,
      );
      widget.purchaseController?.addListener(_onPurchaseControllerChanged);
    }
  }

  void _onPurchaseControllerChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    widget.purchaseController?.removeListener(_onPurchaseControllerChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final localDebugActive =
        widget.purchaseController?.state ==
            CareerPremiumPurchaseState.success &&
        widget.purchaseController?.hasLocalDebugEntitlement == true;
    if (localDebugActive && !_localDebugEntitlementHandled) {
      _localDebugEntitlementHandled = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) widget.onLocalDebugEntitlementActivated?.call();
      });
    }
    final usesRazorpay = widget.razorpayController != null;
    final isAddOnPurchase = widget.purchaseMode == 'ADDON';
    if (usesRazorpay && widget.dedicatedRazorpaySurface) {
      return Scaffold(
        backgroundColor: const Color(0xFF061A1A),
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    IconButton(
                      onPressed: () => Navigator.of(context).maybePop(),
                      icon: const Icon(
                        Icons.arrow_back,
                        color: Color(0xFFF7F4EC),
                      ),
                      style: IconButton.styleFrom(
                        backgroundColor: const Color(0xFF0B2626),
                      ),
                    ),
                    const Spacer(),
                    _ProfilePill(label: widget.activeProfileLabel),
                  ],
                ),
                const SizedBox(height: 28),
                Text(
                  widget.activeProfileLabel == null ||
                          widget.activeProfileLabel!.trim().isEmpty
                      ? 'Career Premium'
                      : 'Career Premium for ${widget.activeProfileLabel}',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: const Color(0xFFF7F4EC),
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                ListenableBuilder(
                  listenable: Listenable.merge([
                    widget.razorpayController!,
                    if (widget.generationController != null)
                      widget.generationController!,
                  ]),
                  builder: (context, child) => _ProductAction(
                    controller: widget.productController,
                    onSubscribePressed: widget.onSubscribePressed,
                    onPlanSelected: widget.onPlanSelected,
                    onContinuePressed: widget.onContinuePressed,
                    onBackHomePressed: widget.onBackHomePressed,
                    purchaseController: widget.purchaseController,
                    razorpayController: widget.razorpayController,
                    onRazorpayStart: widget.onRazorpayStart,
                    onRazorpayStartForPlan: widget.onRazorpayStartForPlan,
                    razorpayState: widget.razorpayProfileId == null
                        ? widget.razorpayState
                        : widget.razorpayController!.stateFor(
                            widget.razorpayProfileId!,
                          ),
                    onRazorpayRecover: widget.onRazorpayRecover,
                    razorpayCanRetry:
                        widget.razorpayProfileId != null &&
                        widget.razorpayController != null &&
                        widget.razorpayController!.canRetryFor(
                          widget.razorpayProfileId!,
                        ),
                    razorpayLogicalSku: widget.razorpayProfileId == null
                        ? null
                        : widget.razorpayController!.logicalSkuFor(
                            widget.razorpayProfileId!,
                          ),
                    razorpayAmountMinor: widget.razorpayProfileId == null
                        ? null
                        : widget.razorpayController!.amountMinorFor(
                            widget.razorpayProfileId!,
                          ),
                    razorpayBaseAmountMinor: widget.razorpayProfileId == null
                        ? null
                        : widget.razorpayController!.baseAmountMinorFor(
                            widget.razorpayProfileId!,
                          ),
                    razorpayGstAmountMinor: widget.razorpayProfileId == null
                        ? null
                        : widget.razorpayController!.gstAmountMinorFor(
                            widget.razorpayProfileId!,
                          ),
                    razorpayGstRateBasisPoints:
                        widget.razorpayProfileId == null
                        ? null
                        : widget.razorpayController!.gstRateBasisPointsFor(
                            widget.razorpayProfileId!,
                          ),
                    generationState:
                        widget.generationController?.generationState,
                    isAddOnPurchase: isAddOnPurchase,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }
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
    return Scaffold(
      backgroundColor: const Color(0xFF061A1A),
      body: SafeArea(
        child: ListenableBuilder(
          listenable: Listenable.merge([
            widget.productController,
            if (widget.purchaseController != null) widget.purchaseController!,
            if (widget.razorpayController != null) widget.razorpayController!,
          ]),
          builder: (context, child) => SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(22, 20, 22, 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Career Premium',
                  style: TextStyle(
                    color: Color(0xFFF7F4EC),
                    fontSize: 28,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                const Text(
                  'Unlock deeper Career insights, timing and guidance.',
                  style: TextStyle(color: Color(0xFFA8B7B4), fontSize: 16),
                ),
                if (widget.activeProfileLabel != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Career Premium for ${widget.activeProfileLabel}',
                    style: const TextStyle(
                      color: Color(0xFF63D7CF),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'This subscription unlocks Career Premium for this birth profile.',
                    style: TextStyle(color: Color(0xFFA8B7B4)),
                  ),
                ],
                const SizedBox(height: AppSpacing.lg),
                const _Benefits(),
                const SizedBox(height: AppSpacing.lg),
                const Text(
                  'Choose your plan',
                  style: TextStyle(
                    color: Color(0xFFF7F4EC),
                    fontWeight: FontWeight.w700,
                    fontSize: 18,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                _ProductAction(
                  controller: widget.productController,
                  onSubscribePressed: widget.onSubscribePressed,
                  onPlanSelected: widget.onPlanSelected,
                  selectedStoreProductId: _selectedStoreProductId,
                  onPlanChanged: (product) => setState(
                    () => _selectedStoreProductId = product.storeProductId,
                  ),
                  onContinuePressed: widget.onContinuePressed,
                  onBackHomePressed: widget.onBackHomePressed,
                  purchaseController: widget.purchaseController,
                  razorpayController: widget.razorpayController,
                  onRazorpayStart: widget.onRazorpayStart,
                  onRazorpayStartForPlan: widget.onRazorpayStartForPlan,
                  razorpayState: widget.razorpayState,
                  onRazorpayRecover: widget.onRazorpayRecover,
                  razorpayCanRetry:
                      widget.razorpayProfileId != null &&
                      widget.razorpayController != null &&
                        widget.razorpayController!.canRetryFor(
                          widget.razorpayProfileId!,
                        ),
                  razorpayLogicalSku: widget.razorpayProfileId == null || widget.razorpayController == null
                      ? null
                      : widget.razorpayController!.logicalSkuFor(
                          widget.razorpayProfileId!,
                        ),
                  razorpayAmountMinor: widget.razorpayProfileId == null || widget.razorpayController == null
                      ? null
                      : widget.razorpayController!.amountMinorFor(
                          widget.razorpayProfileId!,
                        ),
                  razorpayBaseAmountMinor: widget.razorpayProfileId == null || widget.razorpayController == null
                      ? null
                      : widget.razorpayController!.baseAmountMinorFor(
                          widget.razorpayProfileId!,
                        ),
                  razorpayGstAmountMinor: widget.razorpayProfileId == null || widget.razorpayController == null
                      ? null
                      : widget.razorpayController!.gstAmountMinorFor(
                          widget.razorpayProfileId!,
                        ),
                  razorpayGstRateBasisPoints: widget.razorpayProfileId == null || widget.razorpayController == null
                      ? null
                      : widget.razorpayController!.gstRateBasisPointsFor(
                          widget.razorpayProfileId!,
                        ),
                  isAddOnPurchase: isAddOnPurchase,
                ),
                if (widget.purchaseController != null && !usesRazorpay)
                  TextButton(
                    onPressed: _restoreEnabled(widget.purchaseController!)
                        ? widget.purchaseController!.restorePurchases
                        : null,
                    child: const Text('Restore Purchases'),
                  ),
                if (!usesRazorpay) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    isAddOnPurchase
                        ? 'One-time purchase for this birth profile. Access does not renew automatically.'
                        : 'Subscription renews automatically unless canceled in Apple account settings.',
                    style: TextStyle(color: Color(0xFFA8B7B4), fontSize: 12),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ProfilePill extends StatelessWidget {
  const _ProfilePill({this.label});
  final String? label;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
    decoration: BoxDecoration(
      color: const Color(0xFF0B2626),
      borderRadius: BorderRadius.circular(999),
      border: Border.all(color: const Color(0xFFD6B15A).withValues(alpha: .45)),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.circle, size: 8, color: Color(0xFFD6B15A)),
        const SizedBox(width: 6),
        Text(
          label?.toUpperCase() ?? 'BIRTH PROFILE',
          style: const TextStyle(
            color: Color(0xFFF7F4EC),
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    ),
  );
}

class _Benefits extends StatelessWidget {
  const _Benefits();

  @override
  Widget build(BuildContext context) => const Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text('✓ Detailed Career analysis and indicators'),
      Text('✓ Career timing and stronger windows'),
      Text('✓ Career opportunities and challenges'),
      Text('✓ Access to saved Career insights'),
    ],
  );
}

class _ProductAction extends StatelessWidget {
  const _ProductAction({
    required this.controller,
    required this.onSubscribePressed,
    this.onPlanSelected,
    this.selectedStoreProductId,
    this.onPlanChanged,
    required this.onContinuePressed,
    this.onBackHomePressed,
    this.purchaseController,
    this.razorpayController,
    this.onRazorpayStart,
    this.onRazorpayStartForPlan,
    this.razorpayState,
    this.onRazorpayRecover,
    this.razorpayCanRetry = false,
    this.razorpayLogicalSku,
    this.razorpayAmountMinor,
    this.razorpayBaseAmountMinor,
    this.razorpayGstAmountMinor,
    this.razorpayGstRateBasisPoints,
    this.generationState,
    this.isAddOnPurchase = false,
  });
  final CareerPremiumProductController controller;
  final VoidCallback onSubscribePressed;
  final ValueChanged<CareerPremiumProduct>? onPlanSelected;
  final String? selectedStoreProductId;
  final ValueChanged<CareerPremiumProduct>? onPlanChanged;
  final VoidCallback onContinuePressed;
  final VoidCallback? onBackHomePressed;
  final CareerPremiumPurchaseController? purchaseController;
  final RazorpayCareerPremiumController? razorpayController;
  final VoidCallback? onRazorpayStart;
  final ValueChanged<String>? onRazorpayStartForPlan;
  final RazorpayCareerPremiumState? razorpayState;
  final VoidCallback? onRazorpayRecover;
  final bool razorpayCanRetry;
  final String? razorpayLogicalSku;
  final int? razorpayAmountMinor;
  final int? razorpayBaseAmountMinor;
  final int? razorpayGstAmountMinor;
  final int? razorpayGstRateBasisPoints;
  final CareerGenerationState? generationState;
  final bool isAddOnPurchase;

  @override
  Widget build(BuildContext context) {
    if (generationState == CareerGenerationState.generating) {
      return const _CareerCalibrationProcessing();
    }
    final razorpay = razorpayController;
    final razorpayState = this.razorpayState;
    if (razorpay != null &&
        razorpayState != null &&
        razorpayState != RazorpayCareerPremiumState.idle) {
      switch (razorpayState) {
        case RazorpayCareerPremiumState.creatingOrder:
        case RazorpayCareerPremiumState.verifying:
          return _RazorpayProcessing(
            planLabel: _razorpayPlanLabel(razorpayLogicalSku),
            amountLabel: _razorpayAmountLabel(razorpayAmountMinor),
            baseAmountLabel: _razorpayAmountLabel(razorpayBaseAmountMinor),
            gstAmountLabel: _razorpayAmountLabel(razorpayGstAmountMinor),
            gstRateBasisPoints: razorpayGstRateBasisPoints,
          );
        case RazorpayCareerPremiumState.checkoutOpen:
          return const SizedBox.shrink();
        case RazorpayCareerPremiumState.success:
          return _RazorpaySuccess(
            onContinue: onContinuePressed,
            onHome: onBackHomePressed ?? () {},
            planLabel: _razorpayPlanLabel(razorpayLogicalSku),
            amountLabel: _razorpayAmountLabel(razorpayAmountMinor),
            baseAmountLabel: _razorpayAmountLabel(razorpayBaseAmountMinor),
            gstAmountLabel: _razorpayAmountLabel(razorpayGstAmountMinor),
            gstRateBasisPoints: razorpayGstRateBasisPoints,
          );
        case RazorpayCareerPremiumState.definitiveFailure:
          return _RazorpayFailure(
            canRetry: razorpayCanRetry,
            onRetry: onRazorpayStart ?? () {},
            onCheck: onRazorpayRecover ?? () {},
            onHome: onBackHomePressed ?? () {},
            amountLabel: _razorpayAmountLabel(razorpayAmountMinor),
            baseAmountLabel: _razorpayAmountLabel(razorpayBaseAmountMinor),
            gstAmountLabel: _razorpayAmountLabel(razorpayGstAmountMinor),
            gstRateBasisPoints: razorpayGstRateBasisPoints,
          );
        case RazorpayCareerPremiumState.paymentStatusUnknown:
          return _RazorpayUnknown(
            onCheck: onRazorpayRecover ?? () {},
            onHome: onBackHomePressed ?? () {},
          );
        case RazorpayCareerPremiumState.idle:
          break;
      }
    }
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
    if (restoreState == CareerPremiumRestoreState.reconciliationRequired) {
      return const Text(
        'This local StoreKit restore needs the original debug profile association.',
      );
    }
    if (restoreState == CareerPremiumRestoreState.error) {
      return const Text('Unable to restore purchases. Please try again.');
    }
    if (purchaseState == CareerPremiumPurchaseState.initializing) {
      return Semantics(
        liveRegion: true,
        label: 'Checking purchase status',
        child: const LinearProgressIndicator(),
      );
    }
    if (purchaseState == CareerPremiumPurchaseState.paymentStatusUnknown) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'We are checking a previous Apple payment. Please do not make another payment yet.',
          ),
          TextButton(
            onPressed: purchaseController?.retryPendingAppleVerification,
            child: const Text('Check payment status'),
          ),
        ],
      );
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
    if (purchaseState == CareerPremiumPurchaseState.success &&
        purchaseController?.hasLocalDebugEntitlement == true) {
      return const Text(
        'Career Premium is active for this local debug session.',
      );
    }
    if (razorpay != null) {
      return _RazorpayIdle(
        onStart: onRazorpayStartForPlan ?? (_) => onRazorpayStart?.call(),
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
        final products = controller.products;
        final selected = products.firstWhere(
          (product) => product.storeProductId == selectedStoreProductId,
          orElse: () => products.firstWhere(
            (product) =>
                product.logicalSku == careerPremium12MonthLogicalSku ||
                product.logicalSku == careerPremiumAddOn12MonthLogicalSku,
            orElse: () => products.first,
          ),
        );
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ...products.map(
              (product) => Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: _PlanCard(
                  product: product,
                  selected: product.storeProductId == selected.storeProductId,
                  isAddOnPurchase: isAddOnPurchase,
                  onTap: () => onPlanChanged?.call(product),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            FilledButton(
              onPressed:
                  restoreState == null ||
                      restoreState == CareerPremiumRestoreState.idle
                  ? () {
                      if (onPlanSelected != null) {
                        onPlanSelected!(selected);
                      } else {
                        onSubscribePressed();
                      }
                    }
                  : null,
              child: const Text('Continue'),
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

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    required this.product,
    required this.selected,
    required this.isAddOnPurchase,
    required this.onTap,
  });
  final CareerPremiumProduct product;
  final bool selected;
  final bool isAddOnPurchase;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isTwelveMonth =
        product.logicalSku == careerPremium12MonthLogicalSku ||
        product.logicalSku == careerPremiumAddOn12MonthLogicalSku ||
        product.subscriptionPeriod?.unit == StoreSubscriptionPeriodUnit.year ||
        (product.subscriptionPeriod?.unit ==
                StoreSubscriptionPeriodUnit.month &&
            product.subscriptionPeriod?.value == 12);
    final period = product.subscriptionPeriod;
    final label = isTwelveMonth ? '12 Months' : '6 Months';
    final renewal = isAddOnPurchase
        ? isTwelveMonth
              ? 'Access for 12 months'
              : 'Access for 6 months'
        : isTwelveMonth
        ? 'Renews every year'
        : 'Renews every 6 months';
    return Semantics(
      button: true,
      selected: selected,
      label: '$label plan',
      child: InkWell(
        key: ValueKey('career-premium-plan-${product.storeProductId}'),
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: selected ? const Color(0xFF123B3B) : const Color(0xFF0B2626),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: selected
                  ? const Color(0xFF36D1C4)
                  : const Color(0xFF1E4B49),
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            label,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Color(0xFFF7F4EC),
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        if (isTwelveMonth) ...[
                          const SizedBox(width: 8),
                          const _BestValueChip(),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      product.localizedPrice,
                      style: const TextStyle(
                        color: Color(0xFFF7F4EC),
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      period == null
                          ? isAddOnPurchase
                                ? 'Access details available at checkout'
                                : 'Subscription details available at checkout'
                          : renewal,
                      style: const TextStyle(color: Color(0xFFA8B7B4)),
                    ),
                  ],
                ),
              ),
              Icon(
                selected ? Icons.check_circle : Icons.radio_button_unchecked,
                color: selected
                    ? const Color(0xFF36D1C4)
                    : const Color(0xFFA8B7B4),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BestValueChip extends StatelessWidget {
  const _BestValueChip();
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
    decoration: BoxDecoration(
      color: const Color(0xFFD6B15A).withValues(alpha: .16),
      borderRadius: BorderRadius.circular(999),
    ),
    child: const Text(
      'BEST VALUE',
      style: TextStyle(
        color: Color(0xFFD6B15A),
        fontSize: 10,
        fontWeight: FontWeight.w700,
      ),
    ),
  );
}

class _CareerCalibrationProcessing extends StatelessWidget {
  const _CareerCalibrationProcessing();
  @override
  Widget build(BuildContext context) => const Column(
    crossAxisAlignment: CrossAxisAlignment.center,
    children: [
      Text(
        'CALIBRATION',
        style: TextStyle(color: Color(0xFFD6B15A), fontWeight: FontWeight.w800),
      ),
      SizedBox(height: 4),
      Text(
        'Career Calibration',
        style: TextStyle(color: Color(0xFFF7F4EC), fontSize: 22),
      ),
      SizedBox(height: 28),
      Icon(Icons.autorenew, color: Color(0xFFD6B15A), size: 52),
      SizedBox(height: 20),
      Text(
        'Calibrating your career timeline',
        style: TextStyle(
          color: Color(0xFFF7F4EC),
          fontSize: 27,
          fontWeight: FontWeight.w600,
        ),
      ),
      SizedBox(height: 8),
      Text(
        'We’re comparing your past career events with your birth chart and timing patterns.',
        textAlign: TextAlign.center,
        style: TextStyle(color: Color(0xFFA8B7B4)),
      ),
      SizedBox(height: 20),
      _CalibrationStage(
        'Matching career events',
        'Cross-referencing your submitted career milestones',
        'COMPLETED',
      ),
      _CalibrationStage(
        'Analyzing timing patterns',
        'Comparing the timing of your major career milestones',
        'ACTIVE',
      ),
      _CalibrationStage(
        'Personalizing career forecast',
        'Building your calibrated career timeline and forecast',
        'PENDING',
      ),
    ],
  );
}

class _CalibrationStage extends StatelessWidget {
  const _CalibrationStage(this.title, this.body, this.status);
  final String title;
  final String body;
  final String status;
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    margin: const EdgeInsets.only(bottom: 8),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: const Color(0xFF0B2626),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: const Color(0xFFD6B15A)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          status,
          style: const TextStyle(color: Color(0xFFD6B15A), fontSize: 10),
        ),
        Text(title, style: const TextStyle(color: Color(0xFFF7F4EC))),
        Text(
          body,
          style: const TextStyle(color: Color(0xFFA8B7B4), fontSize: 12),
        ),
      ],
    ),
  );
}

String _razorpayPlanLabel(String? logicalSku) {
  switch (logicalSku) {
    case 'career_premium_razorpay_6_month':
      return '6-MONTH ACCESS';
    case 'career_premium_razorpay_12_month':
      return '12-MONTH ACCESS';
    default:
      return 'CAREER PREMIUM';
  }
}

String? _razorpayAmountLabel(int? amountMinor) {
  if (amountMinor == null || amountMinor < 0) return null;
  final rupees = amountMinor ~/ 100;
  final paise = amountMinor % 100;
  return paise == 0
      ? '₹$rupees'
      : '₹$rupees.${paise.toString().padLeft(2, '0')}';
}

class _RazorpayProcessing extends StatelessWidget {
  const _RazorpayProcessing({
    required this.planLabel,
    required this.amountLabel,
    required this.baseAmountLabel,
    required this.gstAmountLabel,
    required this.gstRateBasisPoints,
  });
  final String planLabel;
  final String? amountLabel;
  final String? baseAmountLabel;
  final String? gstAmountLabel;
  final int? gstRateBasisPoints;
  @override
  Widget build(BuildContext c) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        'CAREER PREMIUM',
        style: TextStyle(
          color: Color(0xFFD6B15A),
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
      SizedBox(height: 10),
      Icon(Icons.auto_awesome, color: Color(0xFFD6B15A), size: 34),
      SizedBox(height: 10),
      Text(
        'Processing your payment',
        style: TextStyle(
          color: Color(0xFFF7F4EC),
          fontSize: 25,
          fontWeight: FontWeight.w600,
        ),
      ),
      SizedBox(height: AppSpacing.xs),
      Text(
        'Please wait while we securely confirm your payment.',
        style: TextStyle(color: Color(0xFFA8B7B4)),
      ),
      SizedBox(height: AppSpacing.sm),
      Text(
        'CAREER PREMIUM · $planLabel',
        style: const TextStyle(color: Color(0xFFD6B15A)),
      ),
      _RazorpayAmountBreakdown(
        baseAmountLabel: baseAmountLabel,
        gstAmountLabel: gstAmountLabel,
        gstRateBasisPoints: gstRateBasisPoints,
        totalAmountLabel: amountLabel,
        largeTotal: true,
      ),
      SizedBox(height: AppSpacing.sm),
      LinearProgressIndicator(),
      Text('Confirming payment…', style: TextStyle(color: Color(0xFFF7F4EC))),
      SizedBox(height: AppSpacing.xs),
      Text(
        'Please do not close the app or press back while your payment is being confirmed.',
        style: TextStyle(color: Color(0xFFA8B7B4), fontSize: 12),
      ),
    ],
  );
}

class _RazorpaySuccess extends StatelessWidget {
  const _RazorpaySuccess({
    required this.onContinue,
    required this.onHome,
    required this.planLabel,
    required this.amountLabel,
    required this.baseAmountLabel,
    required this.gstAmountLabel,
    required this.gstRateBasisPoints,
  });
  final VoidCallback onContinue;
  final VoidCallback onHome;
  final String planLabel;
  final String? amountLabel;
  final String? baseAmountLabel;
  final String? gstAmountLabel;
  final int? gstRateBasisPoints;
  @override
  Widget build(BuildContext c) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Text(
        'PAYMENT SUCCESSFUL',
        style: TextStyle(color: Color(0xFFD6B15A), fontWeight: FontWeight.w800),
      ),
      const SizedBox(height: 10),
      const Icon(Icons.verified_rounded, color: Color(0xFFD6B15A), size: 38),
      const SizedBox(height: 10),
      const Text(
        'Career Premium is now unlocked',
        style: TextStyle(
          color: Color(0xFFF7F4EC),
          fontSize: 24,
          fontWeight: FontWeight.w600,
        ),
      ),
      const Text(
        'You now have full access to your personalized career forecast and upcoming career windows.',
        style: TextStyle(color: Color(0xFFA8B7B4)),
      ),
      const SizedBox(height: AppSpacing.sm),
      Text('Career Premium\n$planLabel\nStatus: Payment confirmed'),
      _RazorpayAmountBreakdown(
        baseAmountLabel: baseAmountLabel,
        gstAmountLabel: gstAmountLabel,
        gstRateBasisPoints: gstRateBasisPoints,
        totalAmountLabel: amountLabel,
      ),
      FilledButton(
        onPressed: onContinue,
        child: const Text('View My Career Forecast'),
      ),
      TextButton(onPressed: onHome, child: const Text('Back to Home')),
    ],
  );
}

class _RazorpayFailure extends StatelessWidget {
  const _RazorpayFailure({
    required this.canRetry,
    required this.onRetry,
    required this.onCheck,
    required this.onHome,
    required this.amountLabel,
    required this.baseAmountLabel,
    required this.gstAmountLabel,
    required this.gstRateBasisPoints,
  });
  final bool canRetry;
  final VoidCallback onRetry;
  final VoidCallback onCheck;
  final VoidCallback onHome;
  final String? amountLabel;
  final String? baseAmountLabel;
  final String? gstAmountLabel;
  final int? gstRateBasisPoints;
  @override
  Widget build(BuildContext c) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Text(
        'PAYMENT FAILED',
        style: TextStyle(color: Color(0xFFD6B15A), fontWeight: FontWeight.w800),
      ),
      const SizedBox(height: 10),
      const Icon(Icons.error_outline, color: Color(0xFFD6B15A), size: 36),
      Text(
        canRetry
            ? 'Your payment couldn’t be completed'
            : 'Payment needs verification',
        style: TextStyle(color: Color(0xFFF7F4EC), fontSize: 22),
      ),
      Text(
        canRetry ? 'The payment was not completed.' : 'We already have a payment order for this attempt. Check its status before trying again.',
        style: TextStyle(color: Color(0xFFA8B7B4)),
      ),
      _RazorpayAmountBreakdown(
        baseAmountLabel: baseAmountLabel,
        gstAmountLabel: gstAmountLabel,
        gstRateBasisPoints: gstRateBasisPoints,
        totalAmountLabel: amountLabel,
      ),
      if (canRetry)
        const Text(
          'If money was deducted, we’ll verify the payment status before asking you to pay again.',
          style: TextStyle(color: Color(0xFFA8B7B4)),
        ),
      FilledButton(
        onPressed: canRetry ? onRetry : onCheck,
        style: FilledButton.styleFrom(
          backgroundColor: const Color(0xFFD6B15A),
          foregroundColor: const Color(0xFF061A1A),
        ),
        child: Text(canRetry ? 'TRY AGAIN' : 'CHECK PAYMENT STATUS'),
      ),
      TextButton(
        onPressed: onHome,
        style: TextButton.styleFrom(foregroundColor: const Color(0xFFD6B15A)),
        child: const Text('BACK TO HOME'),
      ),
    ],
  );
}

class _RazorpayAmountBreakdown extends StatelessWidget {
  const _RazorpayAmountBreakdown({
    required this.baseAmountLabel,
    required this.gstAmountLabel,
    required this.gstRateBasisPoints,
    required this.totalAmountLabel,
    this.largeTotal = false,
  });
  final String? baseAmountLabel;
  final String? gstAmountLabel;
  final int? gstRateBasisPoints;
  final String? totalAmountLabel;
  final bool largeTotal;

  @override
  Widget build(BuildContext context) {
    if (totalAmountLabel == null) return const SizedBox.shrink();
    final rate = gstRateBasisPoints == null
        ? null
        : (gstRateBasisPoints! / 100).toStringAsFixed(
            gstRateBasisPoints! % 100 == 0 ? 0 : 2,
          );
    return Padding(
      padding: const EdgeInsets.only(top: 6, bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (baseAmountLabel != null)
            Text('Base price: $baseAmountLabel'),
          if (gstAmountLabel != null)
            Text('GST${rate == null ? '' : ' @$rate%'}: $gstAmountLabel'),
          Text(
            'Total: $totalAmountLabel',
            style: TextStyle(
              color: const Color(0xFFF7F4EC),
              fontSize: largeTotal ? 28 : 18,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _RazorpayUnknown extends StatelessWidget {
  const _RazorpayUnknown({required this.onCheck, required this.onHome});
  final VoidCallback onCheck;
  final VoidCallback onHome;
  @override
  Widget build(BuildContext c) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Text(
        'CAREER PREMIUM',
        style: TextStyle(color: Color(0xFFD6B15A), fontWeight: FontWeight.w800),
      ),
      const SizedBox(height: 10),
      const Text(
        'We’re checking your payment',
        style: TextStyle(
          color: Color(0xFFF7F4EC),
          fontSize: 24,
          fontWeight: FontWeight.w600,
        ),
      ),
      const Text(
        'Your payment may have been completed, but we haven’t confirmed it yet.',
        style: TextStyle(color: Color(0xFFA8B7B4)),
      ),
      const Text(
        'Please don’t make another payment while we verify the status.',
        style: TextStyle(color: Color(0xFFA8B7B4)),
      ),
      FilledButton(
        onPressed: onCheck,
        style: FilledButton.styleFrom(
          backgroundColor: const Color(0xFFD6B15A),
          foregroundColor: const Color(0xFF061A1A),
        ),
        child: const Text('CHECK PAYMENT STATUS'),
      ),
      TextButton(
        onPressed: onHome,
        style: TextButton.styleFrom(foregroundColor: const Color(0xFFD6B15A)),
        child: const Text('Back to Home'),
      ),
    ],
  );
}

class _RazorpayIdle extends StatefulWidget {
  const _RazorpayIdle({required this.onStart});
  final ValueChanged<String> onStart;
  @override
  State<_RazorpayIdle> createState() => _RazorpayIdleState();
}

class _RazorpayIdleState extends State<_RazorpayIdle> {
  String _selectedPlan = 'career_premium_razorpay_12_month';
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        'CAREER PREMIUM',
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: const Color(0xFFD6B15A),
          fontWeight: FontWeight.w800,
          letterSpacing: 1.4,
        ),
      ),
      const SizedBox(height: AppSpacing.xs),
      Text(
        'Unlock your complete career forecast',
        style: const TextStyle(
          color: Color(0xFFF7F4EC),
          fontSize: 29,
          height: .98,
          fontWeight: FontWeight.w500,
        ),
      ),
      const SizedBox(height: AppSpacing.xs),
      const Text(
        'Get full access to your personalized career timing and upcoming career windows.',
        style: TextStyle(color: Color(0xFFA8B7B4)),
      ),
      const SizedBox(height: 12),
      Text(
        'Choose your plan',
        style: Theme.of(context).textTheme.titleMedium
            ?.copyWith(color: const Color(0xFFF7F4EC)),
      ),
      const SizedBox(height: AppSpacing.sm),
      _RazorpayPlanCard(
        title: '12 Months',
        price: '₹699 + applicable GST',
        detail: 'Access for 12 months',
        bestValue: true,
        selected: _selectedPlan == 'career_premium_razorpay_12_month',
        onTap: () =>
            setState(() => _selectedPlan = 'career_premium_razorpay_12_month'),
      ),
      const SizedBox(height: AppSpacing.sm),
      _RazorpayPlanCard(
        title: '6 Months',
        price: '₹399 + applicable GST',
        detail: 'Access for 6 months',
        selected: _selectedPlan == 'career_premium_razorpay_6_month',
        onTap: () =>
            setState(() => _selectedPlan = 'career_premium_razorpay_6_month'),
      ),
      const SizedBox(height: AppSpacing.md),
      const Row(
        children: [
          SizedBox(
            width: 3,
            height: 16,
            child: ColoredBox(color: Color(0xFFD6B15A)),
          ),
          SizedBox(width: 8),
          Text(
            'WHAT YOU’LL UNLOCK',
            style: TextStyle(
              color: Color(0xFFD6B15A),
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 1,
            ),
          ),
        ],
      ),
      const SizedBox(height: AppSpacing.sm),
      Container(
        decoration: BoxDecoration(
          color: const Color(0xFF0B2626),
          borderRadius: BorderRadius.circular(14),
        ),
        child: const Column(
          children: [
            _RazorpayBenefit(
              Icons.event_outlined,
              'Full Career Forecast',
              'Your complete personalized career timing',
            ),
            Divider(height: 1, color: Color(0x330D312F)),
            _RazorpayBenefit(
              Icons.bar_chart_outlined,
              'Upcoming Career Windows',
              'See important upcoming periods',
            ),
            Divider(height: 1, color: Color(0x330D312F)),
            _RazorpayBenefit(
              Icons.tune,
              'Career Calibration',
              'Forecast personalized using your career history',
            ),
          ],
        ),
      ),
      const SizedBox(height: AppSpacing.md),
      SizedBox(
        width: double.infinity,
        child: FilledButton(
          onPressed: () => widget.onStart(_selectedPlan),
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFFD6B15A),
            foregroundColor: const Color(0xFF061A1A),
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
          child: const Text('Continue'),
        ),
      ),
      const SizedBox(height: AppSpacing.xs),
      const Center(
        child: Text(
          'One-time payment for this birth profile.\nAccess does not renew automatically.',
          textAlign: TextAlign.center,
          style: TextStyle(color: Color(0xFFA8B7B4), fontSize: 12),
        ),
      ),
      const SizedBox(height: 14),
      const Divider(color: Color(0x330D312F)),
      const SizedBox(height: 8),
      const Center(
        child: Text(
          'PAY SECURELY WITH',
          style: TextStyle(
            color: Color(0xFFA8B7B4),
            fontSize: 10,
            fontWeight: FontWeight.w800,
            letterSpacing: 1,
          ),
        ),
      ),
      const SizedBox(height: AppSpacing.xs),
      const Wrap(
        spacing: 6,
        runSpacing: 6,
        alignment: WrapAlignment.center,
        children: [
          _PaymentChip('UPI'),
          _PaymentChip('PhonePe'),
          _PaymentChip('Google Pay'),
          _PaymentChip('Paytm'),
          _PaymentChip('Cards'),
        ],
      ),
      const SizedBox(height: AppSpacing.md),
      const Row(
        children: [
          Icon(Icons.lock_outline, size: 14, color: Color(0xFFD6B15A)),
          SizedBox(width: 6),
          Text(
            'Secure payment',
            style: TextStyle(color: Color(0xFFA8B7B4), fontSize: 12),
          ),
          Spacer(),
          Text(
            'Terms · Privacy',
            style: TextStyle(color: Color(0xFFD6B15A), fontSize: 12),
          ),
        ],
      ),
    ],
  );
}

class _RazorpayPlanCard extends StatelessWidget {
  const _RazorpayPlanCard({
    required this.title,
    required this.price,
    required this.detail,
    required this.selected,
    required this.onTap,
    this.bestValue = false,
  });
  final String title;
  final String price;
  final String detail;
  final bool selected;
  final VoidCallback onTap;
  final bool bestValue;
  @override
  Widget build(BuildContext context) => Semantics(
    selected: selected,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF103737) : const Color(0xFF0B2626),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected ? const Color(0xFF55D6D0) : const Color(0x3349B5AE),
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          color: Color(0xFFF7F4EC),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      if (bestValue) ...[
                        const SizedBox(width: 8),
                        const Text(
                          'BEST VALUE',
                          style: TextStyle(
                            color: Color(0xFFD6B15A),
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    detail,
                    style: const TextStyle(
                      color: Color(0xFFA8B7B4),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            Text(
              price,
              style: const TextStyle(
                color: Color(0xFFF7F4EC),
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (selected)
              const Padding(
                padding: EdgeInsets.only(left: 8),
                child: Icon(Icons.check_circle, color: Color(0xFF55D6D0)),
              ),
          ],
        ),
      ),
    ),
  );
}

class _RazorpayBenefit extends StatelessWidget {
  const _RazorpayBenefit(this.icon, this.title, this.body);
  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
    child: Row(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: const Color(0xFF0B2626),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, size: 17, color: const Color(0xFFD6B15A)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: RichText(
            text: TextSpan(
              children: [
                TextSpan(
                  text: '$title\n',
                  style: const TextStyle(
                    color: Color(0xFFF7F4EC),
                    fontWeight: FontWeight.w700,
                  ),
                ),
                TextSpan(
                  text: body,
                  style: const TextStyle(
                    color: Color(0xFFA8B7B4),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}

class _PaymentChip extends StatelessWidget {
  const _PaymentChip(this.label);
  final String label;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
    decoration: BoxDecoration(
      color: const Color(0xFF0B2626),
      border: Border.all(color: const Color(0xFFD6B15A).withValues(alpha: .35)),
      borderRadius: BorderRadius.circular(7),
    ),
    child: Text(
      label,
      style: const TextStyle(color: Color(0xFFF7F4EC), fontSize: 11),
    ),
  );
}

bool _restoreEnabled(CareerPremiumPurchaseController controller) =>
    controller.state != CareerPremiumPurchaseState.initializing &&
    controller.state != CareerPremiumPurchaseState.purchasing &&
    controller.state != CareerPremiumPurchaseState.pending &&
    controller.state != CareerPremiumPurchaseState.verifying &&
    controller.state != CareerPremiumPurchaseState.paymentStatusUnknown &&
    controller.restoreState != CareerPremiumRestoreState.restoring &&
    controller.restoreState != CareerPremiumRestoreState.verifying;
