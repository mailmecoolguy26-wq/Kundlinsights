import 'package:flutter/material.dart';

import '../../../app/theme/app_theme.dart';
import '../../../shared/widgets/app_card.dart';
import '../career_premium_product_controller.dart';
import '../../readings/career_reading_generation_controller.dart';
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
    this.dedicatedRazorpaySurface = false,
    this.activeProfileLabel,
    this.razorpayProfileId,
    this.generationController,
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
  final bool dedicatedRazorpaySurface;
  final String? activeProfileLabel;
  final String? razorpayProfileId;
  final CareerReadingGenerationController? generationController;

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
    final usesRazorpay = widget.razorpayController != null;
    if (usesRazorpay && widget.dedicatedRazorpaySurface) {
      return Scaffold(
        backgroundColor: const Color(0xFF0B071B),
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
                        color: Color(0xFFFAF7F2),
                      ),
                      style: IconButton.styleFrom(
                        backgroundColor: const Color(0xFF181335),
                      ),
                    ),
                    const Spacer(),
                    _ProfilePill(label: widget.activeProfileLabel),
                  ],
                ),
                const SizedBox(height: 28),
                ListenableBuilder(
                  listenable: Listenable.merge([
                    widget.razorpayController!,
                    if (widget.generationController != null)
                      widget.generationController!,
                  ]),
                  builder: (context, child) => _ProductAction(
                    controller: widget.productController,
                    onSubscribePressed: widget.onSubscribePressed,
                    onContinuePressed: widget.onContinuePressed,
                    onBackHomePressed: widget.onBackHomePressed,
                    purchaseController: widget.purchaseController,
                    razorpayController: widget.razorpayController,
                    onRazorpayStart: widget.onRazorpayStart,
                    razorpayState: widget.razorpayProfileId == null
                        ? widget.razorpayState
                        : widget.razorpayController!.stateFor(
                            widget.razorpayProfileId!,
                          ),
                    onRazorpayRecover: widget.onRazorpayRecover,
                    onRazorpayReset: widget.onRazorpayReset,
                    generationState:
                        widget.generationController?.generationState,
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
            if (!usesRazorpay) ...[
              const Text(
                'Career Premium',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: AppSpacing.xs),
              const Text('Unlock your complete Career reading.'),
              const SizedBox(height: AppSpacing.sm),
              const _Benefits(),
              const SizedBox(height: AppSpacing.md),
            ],
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
            if (widget.purchaseController != null && !usesRazorpay)
              TextButton(
                onPressed: _restoreEnabled(widget.purchaseController!)
                    ? widget.purchaseController!.restorePurchases
                    : null,
                child: const Text('Restore Purchases'),
              ),
            if (!usesRazorpay) ...[
              const SizedBox(height: AppSpacing.sm),
              const Text(
                'Annual subscription. Payment is managed through your Apple ID '
                'and renews automatically unless canceled in Apple account settings.',
                style: TextStyle(fontSize: 12),
              ),
            ],
          ],
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
      color: const Color(0xFF181335),
      borderRadius: BorderRadius.circular(999),
      border: Border.all(color: const Color(0xFFC5A059).withValues(alpha: .45)),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.circle, size: 8, color: Color(0xFFC5A059)),
        const SizedBox(width: 6),
        Text(
          label?.toUpperCase() ?? 'BIRTH PROFILE',
          style: const TextStyle(
            color: Color(0xFFFAF7F2),
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
    this.generationState,
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
  final CareerGenerationState? generationState;

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

class _CareerCalibrationProcessing extends StatelessWidget {
  const _CareerCalibrationProcessing();
  @override
  Widget build(BuildContext context) => const Column(
    crossAxisAlignment: CrossAxisAlignment.center,
    children: [
      Text(
        'CALIBRATION',
        style: TextStyle(color: Color(0xFFF4BF50), fontWeight: FontWeight.w800),
      ),
      SizedBox(height: 4),
      Text(
        'Career Calibration',
        style: TextStyle(color: Color(0xFFFAF7F2), fontSize: 22),
      ),
      SizedBox(height: 28),
      Icon(Icons.autorenew, color: Color(0xFFC5A059), size: 52),
      SizedBox(height: 20),
      Text(
        'Calibrating your career timeline',
        style: TextStyle(
          color: Color(0xFFFAF7F2),
          fontSize: 27,
          fontWeight: FontWeight.w600,
        ),
      ),
      SizedBox(height: 8),
      Text(
        'We’re comparing your past career events with your birth chart and timing patterns.',
        textAlign: TextAlign.center,
        style: TextStyle(color: Color(0xFF9E9AA9)),
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
      color: const Color(0xFF181335),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: const Color(0xFFC5A059)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          status,
          style: const TextStyle(color: Color(0xFFF4BF50), fontSize: 10),
        ),
        Text(title, style: const TextStyle(color: Color(0xFFFAF7F2))),
        Text(
          body,
          style: const TextStyle(color: Color(0xFF9E9AA9), fontSize: 12),
        ),
      ],
    ),
  );
}

class _RazorpayProcessing extends StatelessWidget {
  const _RazorpayProcessing();
  @override
  Widget build(BuildContext c) => const Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        'CAREER PREMIUM',
        style: TextStyle(
          color: Color(0xFFF4BF50),
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
      SizedBox(height: 10),
      Icon(Icons.auto_awesome, color: Color(0xFFC5A059), size: 34),
      SizedBox(height: 10),
      Text(
        'Processing your payment',
        style: TextStyle(
          color: Color(0xFFFAF7F2),
          fontSize: 25,
          fontWeight: FontWeight.w600,
        ),
      ),
      SizedBox(height: AppSpacing.xs),
      Text(
        'Please wait while we securely confirm your payment.',
        style: TextStyle(color: Color(0xFF9E9AA9)),
      ),
      SizedBox(height: AppSpacing.sm),
      Text(
        'CAREER PREMIUM · ANNUAL ACCESS',
        style: TextStyle(color: Color(0xFFF4BF50)),
      ),
      Text('₹588.82', style: TextStyle(color: Color(0xFFFAF7F2), fontSize: 28)),
      Text(
        '₹588.82 total, including GST',
        style: TextStyle(color: Color(0xFF9E9AA9)),
      ),
      SizedBox(height: AppSpacing.sm),
      LinearProgressIndicator(),
      Text('Confirming payment…', style: TextStyle(color: Color(0xFFFAF7F2))),
      SizedBox(height: AppSpacing.xs),
      Text(
        'Please do not close the app or press back while your payment is being confirmed.',
        style: TextStyle(color: Color(0xFF9E9AA9), fontSize: 12),
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
        style: TextStyle(color: Color(0xFFF4BF50), fontWeight: FontWeight.w800),
      ),
      const SizedBox(height: 10),
      const Icon(Icons.verified_rounded, color: Color(0xFFC5A059), size: 38),
      const SizedBox(height: 10),
      const Text(
        'Career Premium is now unlocked',
        style: TextStyle(
          color: Color(0xFFFAF7F2),
          fontSize: 24,
          fontWeight: FontWeight.w600,
        ),
      ),
      const Text(
        'You now have full access to your personalized career forecast and upcoming career windows.',
        style: TextStyle(color: Color(0xFF9E9AA9)),
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
        'PAYMENT FAILED',
        style: TextStyle(color: Color(0xFFF4BF50), fontWeight: FontWeight.w800),
      ),
      const SizedBox(height: 10),
      const Icon(Icons.error_outline, color: Color(0xFFC5A059), size: 36),
      const Text(
        'Your payment couldn’t be completed',
        style: TextStyle(color: Color(0xFFFAF7F2), fontSize: 22),
      ),
      const Text(
        'Career Premium has not been activated. You can safely try the payment again.',
        style: TextStyle(color: Color(0xFF9E9AA9)),
      ),
      const Text(
        '₹588.82',
        style: TextStyle(color: Color(0xFFFAF7F2), fontSize: 20),
      ),
      const Text(
        'If money was deducted, we’ll verify the payment status before asking you to pay again.',
        style: TextStyle(color: Color(0xFF9E9AA9)),
      ),
      FilledButton(
        onPressed: onRetry,
        style: FilledButton.styleFrom(
          backgroundColor: const Color(0xFFF4BF50),
          foregroundColor: const Color(0xFF0B071B),
        ),
        child: const Text('TRY AGAIN'),
      ),
      TextButton(
        onPressed: onReset,
        style: TextButton.styleFrom(
          foregroundColor: const Color(0xFFFAF7F2),
          side: const BorderSide(color: Color(0xFFC5A059)),
        ),
        child: const Text('Choose Another Payment Method'),
      ),
      TextButton(
        onPressed: onReset,
        style: TextButton.styleFrom(foregroundColor: const Color(0xFFF4BF50)),
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
        'CAREER PREMIUM',
        style: TextStyle(color: Color(0xFFF4BF50), fontWeight: FontWeight.w800),
      ),
      const SizedBox(height: 10),
      const Text(
        'We’re checking your payment',
        style: TextStyle(
          color: Color(0xFFFAF7F2),
          fontSize: 24,
          fontWeight: FontWeight.w600,
        ),
      ),
      const Text(
        'Your payment may have been completed, but we haven’t confirmed it yet.',
        style: TextStyle(color: Color(0xFF9E9AA9)),
      ),
      const Text(
        'Please don’t make another payment while we verify the status.',
        style: TextStyle(color: Color(0xFF9E9AA9)),
      ),
      FilledButton(
        onPressed: onCheck,
        style: FilledButton.styleFrom(
          backgroundColor: const Color(0xFFF4BF50),
          foregroundColor: const Color(0xFF0B071B),
        ),
        child: const Text('CHECK PAYMENT STATUS'),
      ),
      TextButton(
        onPressed: onHome,
        style: TextButton.styleFrom(foregroundColor: const Color(0xFFF4BF50)),
        child: const Text('Back to Home'),
      ),
    ],
  );
}

class _RazorpayIdle extends StatelessWidget {
  const _RazorpayIdle({required this.onStart});
  final VoidCallback onStart;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        'CAREER PREMIUM',
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: const Color(0xFFF4BF50),
          fontWeight: FontWeight.w800,
          letterSpacing: 1.4,
        ),
      ),
      const SizedBox(height: AppSpacing.xs),
      Text(
        'Unlock your complete career forecast',
        style: const TextStyle(
          color: Color(0xFFFAF7F2),
          fontSize: 29,
          height: .98,
          fontWeight: FontWeight.w500,
        ),
      ),
      const SizedBox(height: AppSpacing.xs),
      const Text(
        'Get full access to your personalized career timing and upcoming career windows.',
        style: TextStyle(color: Color(0xFF9E9AA9)),
      ),
      const SizedBox(height: 12),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 15),
        decoration: BoxDecoration(
          color: const Color(0xFF181335),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: const Color(0xFFC5A059).withValues(alpha: .55),
          ),
        ),
        child: const Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                'CAREER PREMIUM\nAnnual access',
                style: TextStyle(color: Color(0xFFFAF7F2), fontSize: 13),
              ),
            ),
            Text(
              '₹499 / year\n+ GST @ 18%\nTotal payable: ₹588.82',
              textAlign: TextAlign.right,
              style: TextStyle(
                color: Color(0xFFFAF7F2),
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: AppSpacing.md),
      const Row(
        children: [
          SizedBox(
            width: 3,
            height: 16,
            child: ColoredBox(color: Color(0xFFF4BF50)),
          ),
          SizedBox(width: 8),
          Text(
            'WHAT YOU’LL UNLOCK',
            style: TextStyle(
              color: Color(0xFFF4BF50),
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
          color: const Color(0xFF141025),
          borderRadius: BorderRadius.circular(14),
        ),
        child: const Column(
          children: [
            _RazorpayBenefit(
              Icons.event_outlined,
              'Full Career Forecast',
              'Your complete personalized career timing',
            ),
            Divider(height: 1, color: Color(0x33211D32)),
            _RazorpayBenefit(
              Icons.bar_chart_outlined,
              'Upcoming Career Windows',
              'See important upcoming periods',
            ),
            Divider(height: 1, color: Color(0x33211D32)),
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
          onPressed: onStart,
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFFF4BF50),
            foregroundColor: const Color(0xFF0B071B),
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
          child: const Text('UNLOCK CAREER PREMIUM — ₹588.82 →'),
        ),
      ),
      const SizedBox(height: AppSpacing.xs),
      const Center(
        child: Text(
          '₹588.82 total, including GST',
          style: TextStyle(color: Color(0xFF9E9AA9), fontSize: 12),
        ),
      ),
      const SizedBox(height: 14),
      const Divider(color: Color(0x33211D32)),
      const SizedBox(height: 8),
      const Center(
        child: Text(
          'PAY SECURELY WITH',
          style: TextStyle(
            color: Color(0xFF9E9AA9),
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
          Icon(Icons.lock_outline, size: 14, color: Color(0xFFC5A059)),
          SizedBox(width: 6),
          Text(
            'Secure payment',
            style: TextStyle(color: Color(0xFF9E9AA9), fontSize: 12),
          ),
          Spacer(),
          Text(
            'Terms · Privacy',
            style: TextStyle(color: Color(0xFFC5A059), fontSize: 12),
          ),
        ],
      ),
    ],
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
            color: const Color(0xFF181335),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, size: 17, color: const Color(0xFFC5A059)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: RichText(
            text: TextSpan(
              children: [
                TextSpan(
                  text: '$title\n',
                  style: const TextStyle(
                    color: Color(0xFFFAF7F2),
                    fontWeight: FontWeight.w700,
                  ),
                ),
                TextSpan(
                  text: body,
                  style: const TextStyle(
                    color: Color(0xFF9E9AA9),
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
      color: const Color(0xFF141025),
      border: Border.all(color: const Color(0xFFC5A059).withValues(alpha: .35)),
      borderRadius: BorderRadius.circular(7),
    ),
    child: Text(
      label,
      style: const TextStyle(color: Color(0xFFFAF7F2), fontSize: 11),
    ),
  );
}

bool _restoreEnabled(CareerPremiumPurchaseController controller) =>
    controller.state != CareerPremiumPurchaseState.purchasing &&
    controller.state != CareerPremiumPurchaseState.pending &&
    controller.state != CareerPremiumPurchaseState.verifying &&
    controller.restoreState != CareerPremiumRestoreState.restoring &&
    controller.restoreState != CareerPremiumRestoreState.verifying;
