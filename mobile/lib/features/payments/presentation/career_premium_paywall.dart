import 'package:flutter/material.dart';

import '../../../app/theme/app_theme.dart';
import '../../../shared/widgets/app_card.dart';
import '../career_premium_product_controller.dart';
import '../career_premium_purchase_controller.dart';
import '../razorpay_career_premium_controller.dart';
import '../domain/career_premium_product.dart';

class CareerPremiumPaywall extends StatefulWidget {
  const CareerPremiumPaywall({
    super.key,
    required this.productController,
    required this.hasAccess,
    required this.onSubscribePressed,
    required this.onContinuePressed,
    this.onBackHomePressed,
    this.entitlementMode,
    this.purchaseController,
    this.razorpayController,
    this.onRazorpayStart,
    this.razorpayState,
    this.onRazorpayRecover,
    this.onRazorpayReset,
  });

  final CareerPremiumProductController productController;
  final bool hasAccess;
  final String? entitlementMode;
  final VoidCallback onSubscribePressed;
  final VoidCallback onContinuePressed;
  final VoidCallback? onBackHomePressed;
  final CareerPremiumPurchaseController? purchaseController;
  final RazorpayCareerPremiumController? razorpayController;
  final VoidCallback? onRazorpayStart;
  final RazorpayCareerPremiumState? razorpayState;
  final VoidCallback? onRazorpayRecover;
  final VoidCallback? onRazorpayReset;

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
        if (widget.razorpayController != null) widget.razorpayController!,
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
              onContinuePressed: widget.onContinuePressed,
              onBackHomePressed: widget.onBackHomePressed,
              purchaseController: widget.purchaseController,
              razorpayController: widget.razorpayController,
              onRazorpayStart: widget.onRazorpayStart,
              razorpayState: widget.razorpayState,
              onRazorpayRecover: widget.onRazorpayRecover,
              onRazorpayReset: widget.onRazorpayReset,
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
    required this.onContinuePressed,
    this.onBackHomePressed,
    this.purchaseController,
    this.razorpayController,
    this.onRazorpayStart,
    this.razorpayState,
    this.onRazorpayRecover,
    this.onRazorpayReset,
  });
  final CareerPremiumProductController controller;
  final VoidCallback onSubscribePressed;
  final VoidCallback onContinuePressed;
  final VoidCallback? onBackHomePressed;
  final CareerPremiumPurchaseController? purchaseController;
  final RazorpayCareerPremiumController? razorpayController;
  final VoidCallback? onRazorpayStart;
  final RazorpayCareerPremiumState? razorpayState;
  final VoidCallback? onRazorpayRecover;
  final VoidCallback? onRazorpayReset;

  @override
  Widget build(BuildContext context) {
    final razorpay = razorpayController;
    final razorpayState = this.razorpayState;
    if (razorpay != null &&
        razorpayState != null &&
        razorpayState != RazorpayCareerPremiumState.idle) {
      switch (razorpayState) {
        case RazorpayCareerPremiumState.creatingOrder:
        case RazorpayCareerPremiumState.verifying:
          return const _RazorpayProcessing();
        case RazorpayCareerPremiumState.checkoutOpen:
          return const SizedBox.shrink();
        case RazorpayCareerPremiumState.success:
          return _RazorpaySuccess(
            onContinue: onContinuePressed,
            onHome: onBackHomePressed ?? () {},
          );
        case RazorpayCareerPremiumState.definitiveFailure:
          return _RazorpayFailure(
            onRetry: onRazorpayStart ?? () {},
            onReset: onRazorpayReset ?? () {},
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
    if (razorpay != null) {
      return _RazorpayIdle(onStart: onRazorpayStart ?? () {});
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
                    ? (razorpay == null ? onSubscribePressed : onRazorpayStart)
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

class _RazorpayProcessing extends StatelessWidget {
  const _RazorpayProcessing();
  @override
  Widget build(BuildContext c) => const Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        'Processing your payment',
        style: TextStyle(fontWeight: FontWeight.w700),
      ),
      SizedBox(height: AppSpacing.xs),
      Text('Please wait while we securely confirm your payment.'),
      SizedBox(height: AppSpacing.sm),
      Text('Career Premium · Annual access'),
      Text('₹588.82'),
      Text('₹588.82 total, including GST'),
      SizedBox(height: AppSpacing.sm),
      LinearProgressIndicator(),
      Text('Confirming payment…'),
      SizedBox(height: AppSpacing.xs),
      Text(
        'Please do not close the app or press back while your payment is being confirmed.',
        style: TextStyle(fontSize: 12),
      ),
    ],
  );
}

class _RazorpaySuccess extends StatelessWidget {
  const _RazorpaySuccess({required this.onContinue, required this.onHome});
  final VoidCallback onContinue;
  final VoidCallback onHome;
  @override
  Widget build(BuildContext c) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Text(
        'PAYMENT SUCCESSFUL',
        style: TextStyle(fontWeight: FontWeight.w700),
      ),
      const Text('Career Premium is now unlocked'),
      const Text(
        'You now have full access to your personalized career forecast and upcoming career windows.',
      ),
      const SizedBox(height: AppSpacing.sm),
      const Text(
        'Career Premium\nAnnual access\nAmount paid: ₹588.82\nTaxes: Including GST\nStatus: Payment confirmed',
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
  const _RazorpayFailure({required this.onRetry, required this.onReset});
  final VoidCallback onRetry;
  final VoidCallback onReset;
  @override
  Widget build(BuildContext c) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Text(
        'PAYMENT NOT COMPLETED',
        style: TextStyle(fontWeight: FontWeight.w700),
      ),
      const Text('Your payment couldn’t be completed'),
      const Text(
        'Career Premium has not been activated. You can safely try the payment again.',
      ),
      const Text('₹588.82'),
      const Text(
        'If money was deducted, we’ll verify the payment status before asking you to pay again.',
      ),
      FilledButton(onPressed: onRetry, child: const Text('Try Again')),
      TextButton(
        onPressed: onReset,
        child: const Text('Choose Another Payment Method'),
      ),
      TextButton(
        onPressed: onReset,
        child: const Text('Back to Career Premium'),
      ),
    ],
  );
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
        'We’re checking your payment',
        style: TextStyle(fontWeight: FontWeight.w700),
      ),
      const Text(
        'Your payment may have been completed, but we haven’t confirmed it yet.',
      ),
      const Text(
        'Please don’t make another payment while we verify the status.',
      ),
      FilledButton(
        onPressed: onCheck,
        child: const Text('Check Payment Status'),
      ),
      TextButton(onPressed: onHome, child: const Text('Back to Home')),
    ],
  );
}

class _RazorpayIdle extends StatelessWidget {
  const _RazorpayIdle({required this.onStart});
  final VoidCallback onStart;
  @override
  Widget build(BuildContext c) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Text(
        'CAREER PREMIUM',
        style: TextStyle(fontWeight: FontWeight.w700),
      ),
      const Text('Unlock your complete career forecast'),
      const Text(
        'Get full access to your personalized career timing and upcoming career windows.',
      ),
      const SizedBox(height: AppSpacing.sm),
      const Text(
        'Career Premium\n₹499 / year\n+ GST @ 18%\nTotal payable: ₹588.82',
      ),
      const SizedBox(height: AppSpacing.sm),
      const Text(
        'Full Career Forecast\nYour complete personalized career timing\n\nUpcoming Career Windows\nSee important upcoming periods\n\nCareer Calibration\nForecast personalized using your career history',
      ),
      const SizedBox(height: AppSpacing.sm),
      FilledButton(
        onPressed: onStart,
        child: const Text('Unlock Career Premium — ₹588.82'),
      ),
      const Text('₹588.82 total, including GST'),
      const SizedBox(height: AppSpacing.xs),
      const Text(
        'UPI · PhonePe · Google Pay · Paytm · Cards',
        style: TextStyle(fontSize: 12),
      ),
      const Text(
        'Restore Purchase · Terms · Privacy · Secure payment',
        style: TextStyle(fontSize: 12),
      ),
    ],
  );
}

bool _restoreEnabled(CareerPremiumPurchaseController controller) =>
    controller.state != CareerPremiumPurchaseState.purchasing &&
    controller.state != CareerPremiumPurchaseState.pending &&
    controller.state != CareerPremiumPurchaseState.verifying &&
    controller.restoreState != CareerPremiumRestoreState.restoring &&
    controller.restoreState != CareerPremiumRestoreState.verifying;
