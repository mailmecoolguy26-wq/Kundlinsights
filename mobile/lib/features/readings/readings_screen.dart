import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/theme/app_theme.dart';
import '../../l10n/app_localizations.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/app_page_scaffold.dart';
import '../../shared/widgets/states.dart';
import 'domain/reading.dart';
import 'reading_controller.dart';
import 'career_reading_generation_controller.dart';
import '../payments/career_premium_product_controller.dart';
import '../payments/career_premium_purchase_controller.dart';
import '../payments/razorpay_career_premium_controller.dart';
import '../payments/presentation/career_premium_paywall.dart';

class ReadingsScreen extends StatefulWidget {
  const ReadingsScreen({
    super.key,
    required this.controller,
    this.generation,
    this.premiumProduct,
    this.premiumPurchase,
    this.razorpayPremium,
    this.activeProfileLabel,
  });
  final ReadingController controller;
  final CareerReadingGenerationController? generation;
  final CareerPremiumProductController? premiumProduct;
  final CareerPremiumPurchaseController? premiumPurchase;
  final RazorpayCareerPremiumController? razorpayPremium;
  final String? activeProfileLabel;

  @override
  State<ReadingsScreen> createState() => _ReadingsScreenState();
}

class _ReadingsScreenState extends State<ReadingsScreen> {
  String? _navigatedReadingId;
  bool _premiumRouteRequested = false;
  String? _dismissedPremiumProfileId;
  String? _lastHydratedProfileId;
  final Set<String> _hydratingProfileIds = {};

  @override
  void initState() {
    super.initState();
    widget.generation?.addListener(_onGenerationChanged);
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _maybeHydrateRazorpay(),
    );
  }

  @override
  void dispose() {
    widget.generation?.removeListener(_onGenerationChanged);
    super.dispose();
  }

  void _onGenerationChanged() {
    final activeProfileId = widget.generation?.activeBirthProfileId;
    if (activeProfileId != _lastHydratedProfileId) {
      _dismissedPremiumProfileId = null;
    }
    _maybeHydrateRazorpay();
    final generation = widget.generation;
    final id = generation?.createdReadingId;
    if (generation?.generationState != CareerGenerationState.success ||
        id == null ||
        _navigatedReadingId == id) {
      return;
    }
    _navigatedReadingId = id;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        context.pushNamed('reading-detail', pathParameters: {'id': id});
      }
    });
  }

  void _maybeHydrateRazorpay() {
    if (!mounted) return;
    final profileId = widget.generation?.activeBirthProfileId?.trim();
    final razorpay = widget.razorpayPremium;
    if (profileId == null ||
        profileId.isEmpty ||
        razorpay == null ||
        _lastHydratedProfileId == profileId ||
        _hydratingProfileIds.contains(profileId)) {
      return;
    }
    _lastHydratedProfileId = profileId;
    _hydratingProfileIds.add(profileId);
    razorpay.hydrate(birthProfileId: profileId).whenComplete(() {
      _hydratingProfileIds.remove(profileId);
    });
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: Listenable.merge(
      widget.generation == null
          ? [
              widget.controller,
              if (widget.razorpayPremium != null) widget.razorpayPremium!,
            ]
          : [
              widget.controller,
              widget.generation!,
              if (widget.razorpayPremium != null) widget.razorpayPremium!,
            ],
    ),
    builder: (context, child) {
      final existingCareer = _careerReading(widget.controller.readings);
      final isDedicatedRazorpayPaywall =
          widget.generation?.eligibilityState ==
              CareerEligibilityState.ineligible &&
          widget.controller.listState == ReadingListState.loaded &&
          existingCareer == null &&
          widget.razorpayPremium != null &&
          widget.premiumProduct != null;
      final profileId = widget.generation?.activeBirthProfileId;
      final wasDismissedForProfile =
          profileId != null && _dismissedPremiumProfileId == profileId;
      if (isDedicatedRazorpayPaywall &&
          !_premiumRouteRequested &&
          !wasDismissedForProfile) {
        _premiumRouteRequested = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          context.push('/career-premium').whenComplete(() {
            if (!mounted) return;
            _premiumRouteRequested = false;
            _dismissedPremiumProfileId = profileId;
            setState(() {});
          });
        });
      }
      if (isDedicatedRazorpayPaywall) {
        // Razorpay has one presentation only: the top-level premium route.
        // Never fall through to the legacy My Readings paywall while a push is
        // pending or after the user deliberately returns from that route.
        if (wasDismissedForProfile) {
          return Scaffold(
            backgroundColor: const Color(0xFF0B071B),
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: const Color(0xFF181335),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: const Color(0xFFC5A059).withValues(alpha: .45),
                    ),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'READINGS',
                        style: TextStyle(
                          color: Color(0xFFF4BF50),
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      const Text(
                        'Career Reading',
                        style: TextStyle(
                          color: Color(0xFFFAF7F2),
                          fontSize: 28,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      const Text(
                        'Your personalized Career Reading is ready',
                        style: TextStyle(
                          color: Color(0xFFFAF7F2),
                          fontSize: 20,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      const Text(
                        'Continue securely to unlock your complete career forecast and upcoming career windows.',
                        style: TextStyle(color: Color(0xFF9E9AA9)),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      const Row(
                        children: [
                          Icon(
                            Icons.auto_awesome,
                            color: Color(0xFFC5A059),
                            size: 16,
                          ),
                          SizedBox(width: 7),
                          Text(
                            'Career calibration ready',
                            style: TextStyle(
                              color: Color(0xFFF4BF50),
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      FilledButton(
                        onPressed: () {
                          _dismissedPremiumProfileId = null;
                          setState(() {});
                        },
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFFF4BF50),
                          foregroundColor: const Color(0xFF0B071B),
                        ),
                        child: const Text('CONTINUE TO CAREER READING →'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        }
        return const Scaffold(backgroundColor: Color(0xFF0B071B));
      }
      final t = AppLocalizations.of(context)!;
      final hasCareerReading =
          widget.controller.listState == ReadingListState.loaded &&
          _careerReading(widget.controller.readings) != null;
      if (hasCareerReading) {
        return Scaffold(
          backgroundColor: const Color(0xFF0B071B),
          body: SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 12, 8),
                  child: Row(
                    children: [
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'READINGS',
                              style: TextStyle(
                                color: Color(0xFFF4BF50),
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            Text(
                              'My Readings',
                              style: TextStyle(
                                color: Color(0xFFFAF7F2),
                                fontSize: 30,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(
                          Icons.refresh,
                          color: Color(0xFFC5A059),
                        ),
                        onPressed: widget.controller.refresh,
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: _ReadingList(
                    controller: widget.controller,
                    generation: widget.generation,
                    premiumProduct: widget.premiumProduct,
                    premiumPurchase: widget.premiumPurchase,
                    razorpayPremium: widget.razorpayPremium,
                  ),
                ),
              ],
            ),
          ),
        );
      }
      final screen = AppPageScaffold(
        title: t.myReadings,
        actions: [
          Semantics(
            label: t.refresh,
            button: true,
            child: IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: widget.controller.refresh,
            ),
          ),
        ],
        body: RefreshIndicator(
          onRefresh: widget.controller.refresh,
          child: _ReadingList(
            controller: widget.controller,
            generation: widget.generation,
            premiumProduct: widget.premiumProduct,
            premiumPurchase: widget.premiumPurchase,
            razorpayPremium: widget.razorpayPremium,
          ),
        ),
      );
      return screen;
    },
  );
}

class _ReadingList extends StatelessWidget {
  const _ReadingList({
    required this.controller,
    this.generation,
    this.premiumProduct,
    this.premiumPurchase,
    this.razorpayPremium,
  });
  final ReadingController controller;
  final CareerReadingGenerationController? generation;
  final CareerPremiumProductController? premiumProduct;
  final CareerPremiumPurchaseController? premiumPurchase;
  final RazorpayCareerPremiumController? razorpayPremium;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    if (controller.listState == ReadingListState.initial ||
        controller.listState == ReadingListState.loading) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          if (generation != null)
            _GenerationCard(
              generation: generation!,
              existingReading: _careerReading(controller.readings),
              premiumProduct: premiumProduct,
              premiumPurchase: premiumPurchase,
              razorpayPremium: razorpayPremium,
            ),
          const SizedBox(height: 240, child: LoadingState()),
        ],
      );
    }
    if (controller.listState == ReadingListState.error) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          if (generation != null)
            _GenerationCard(
              generation: generation!,
              existingReading: _careerReading(controller.readings),
              premiumProduct: premiumProduct,
              premiumPurchase: premiumPurchase,
            ),
          const SizedBox(height: AppSpacing.xxl),
          ErrorState(
            message: t.readingsUnavailable,
            onRetry: controller.refresh,
            retryLabel: t.retry,
          ),
        ],
      );
    }
    if (controller.readings.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          if (generation != null)
            Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: _GenerationCard(
                generation: generation!,
                existingReading: _careerReading(controller.readings),
                premiumProduct: premiumProduct,
                premiumPurchase: premiumPurchase,
                razorpayPremium: razorpayPremium,
              ),
            ),
          SizedBox(
            height: 360,
            child: EmptyState(
              icon: Icons.menu_book_outlined,
              title: t.noReadingsYet,
              body: t.noReadingsBody,
            ),
          ),
        ],
      );
    }
    final careerReadings = controller.readings
        .where((reading) => reading.domain == 'CAREER')
        .toList(growable: false);
    final suppressHeroDuplicate =
        generation != null && careerReadings.length == 1;
    final displayedReadings = suppressHeroDuplicate
        ? controller.readings
              .where((reading) => reading.domain != 'CAREER')
              .toList(growable: false)
        : controller.readings;
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(AppSpacing.md),
      itemCount: displayedReadings.length + (generation == null ? 0 : 1),
      separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
      itemBuilder: (context, index) => generation != null && index == 0
          ? _GenerationCard(
              generation: generation!,
              existingReading: _careerReading(controller.readings),
              premiumProduct: premiumProduct,
              premiumPurchase: premiumPurchase,
            )
          : _ReadingCard(
              reading: displayedReadings[index - (generation == null ? 0 : 1)],
            ),
    );
  }
}

ReadingSummary? _careerReading(List<ReadingSummary> readings) =>
    readings.where((reading) => reading.domain == 'CAREER').firstOrNull;

class _GenerationCard extends StatelessWidget {
  const _GenerationCard({
    required this.generation,
    this.existingReading,
    this.premiumProduct,
    this.premiumPurchase,
    this.razorpayPremium,
  });
  final CareerReadingGenerationController generation;
  final ReadingSummary? existingReading;
  final CareerPremiumProductController? premiumProduct;
  final CareerPremiumPurchaseController? premiumPurchase;
  final RazorpayCareerPremiumController? razorpayPremium;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    if (existingReading != null) {
      return Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: const Color(0xFF181335),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: const Color(0xFFC5A059).withValues(alpha: .45),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'CAREER READING',
              style: TextStyle(
                color: Color(0xFFF4BF50),
                fontSize: 11,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            const Text(
              'Your personalized Career Reading is ready',
              style: TextStyle(
                color: Color(0xFFFAF7F2),
                fontSize: 22,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            const Text(
              'Explore your career forecast, upcoming career windows, and personalized timing insights.',
              style: TextStyle(color: Color(0xFF9E9AA9)),
            ),
            const SizedBox(height: AppSpacing.sm),
            const Row(
              children: [
                Icon(Icons.auto_awesome, color: Color(0xFFC5A059), size: 16),
                SizedBox(width: 6),
                Text(
                  'Career Premium unlocked',
                  style: TextStyle(color: Color(0xFFF4BF50), fontSize: 12),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            FilledButton(
              onPressed: () => context.pushNamed(
                'reading-detail',
                pathParameters: {'id': existingReading!.readingId},
              ),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFF4BF50),
                foregroundColor: const Color(0xFF0B071B),
              ),
              child: const Text('VIEW CAREER READING →'),
            ),
          ],
        ),
      );
    }
    if (generation.eligibilityState == CareerEligibilityState.loading) {
      return AppCard(
        child: Semantics(
          container: true,
          excludeSemantics: true,
          label: t.checkingCareerReadingAvailability,
          liveRegion: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(t.checkingCareerReadingAvailability),
              const SizedBox(height: AppSpacing.sm),
              const LinearProgressIndicator(),
            ],
          ),
        ),
      );
    }
    if (generation.eligibilityState == CareerEligibilityState.ineligible) {
      if (premiumProduct != null) {
        return CareerPremiumPaywall(
          productController: premiumProduct!,
          hasAccess: false,
          entitlementMode: generation.eligibilityMode,
          purchaseController: premiumPurchase,
          razorpayController: razorpayPremium,
          razorpayState: generation.activeBirthProfileId == null
              ? null
              : razorpayPremium?.stateFor(generation.activeBirthProfileId!),
          onRazorpayStart: generation.activeBirthProfileId == null
              ? null
              : () => razorpayPremium?.start(
                  birthProfileId: generation.activeBirthProfileId!,
                ),
          onRazorpayRecover: generation.activeBirthProfileId == null
              ? null
              : () => razorpayPremium?.recover(
                  birthProfileId: generation.activeBirthProfileId!,
                ),
          onRazorpayReset: generation.activeBirthProfileId == null
              ? null
              : () => razorpayPremium?.returnToPaywall(
                  birthProfileId: generation.activeBirthProfileId!,
                ),
          onSubscribePressed: premiumPurchase?.startPurchase ?? () {},
          onContinuePressed: generation.generate,
          onBackHomePressed: () => context.go('/home'),
        );
      }
      return AppCard(
        child: Semantics(
          container: true,
          label: t.careerReadingProfileUnavailable,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.info_outline),
              const SizedBox(width: AppSpacing.sm),
              Expanded(child: Text(t.careerReadingProfileUnavailable)),
            ],
          ),
        ),
      );
    }
    if (generation.eligibilityState == CareerEligibilityState.error) {
      return AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(t.careerAvailabilityUnavailable),
            TextButton(
              onPressed: generation.refreshEligibility,
              child: Text(t.retry),
            ),
          ],
        ),
      );
    }
    final busy = generation.generationState == CareerGenerationState.generating;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (generation.eligibilityState == CareerEligibilityState.eligible)
            const Text(
              'Career Premium Active',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
          if (generation.eligibilityState == CareerEligibilityState.eligible)
            const SizedBox(height: AppSpacing.xs),
          Text(t.careerReadingEntryBody),
          const SizedBox(height: AppSpacing.sm),
          if (busy) ...[
            Semantics(
              liveRegion: true,
              label: t.generatingCareerReading,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(t.generatingCareerReading),
                  const SizedBox(height: AppSpacing.sm),
                  const LinearProgressIndicator(),
                ],
              ),
            ),
          ] else if (generation.generationState == CareerGenerationState.error)
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(t.careerGenerationFailed),
                const SizedBox(height: AppSpacing.sm),
                FilledButton(
                  onPressed: generation.canGenerate
                      ? generation.generate
                      : null,
                  child: Text(t.tryAgain),
                ),
              ],
            )
          else
            FilledButton(
              onPressed: generation.canGenerate ? generation.generate : null,
              child: Text(t.generateCareerReading),
            ),
        ],
      ),
    );
  }
}

class _ReadingCard extends StatelessWidget {
  const _ReadingCard({required this.reading});
  final ReadingSummary reading;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final date = DateFormat.yMMMd().add_jm().format(
      DateTime.parse(reading.createdAt).toLocal(),
    );
    return Semantics(
      label: '${t.careerReading}, $date',
      button: true,
      child: Material(
        color: const Color(0xFF181335),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(
            color: const Color(0xFFC5A059).withValues(alpha: .35),
          ),
        ),
        child: ListTile(
          contentPadding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.xs,
          ),
          title: Text(
            t.careerReading,
            style: const TextStyle(color: Color(0xFFFAF7F2)),
          ),
          subtitle: Text(
            '${t.createdOn}: $date',
            style: const TextStyle(color: Color(0xFF9E9AA9)),
          ),
          trailing: const Icon(Icons.chevron_right, color: Color(0xFFC5A059)),
          onTap: () => context.pushNamed(
            'reading-detail',
            pathParameters: {'id': reading.readingId},
          ),
        ),
      ),
    );
  }
}

class ReadingDetailScreen extends StatefulWidget {
  const ReadingDetailScreen({
    super.key,
    required this.controller,
    required this.readingId,
  });
  final ReadingController controller;
  final String readingId;

  @override
  State<ReadingDetailScreen> createState() => _ReadingDetailScreenState();
}

class _ReadingDetailScreenState extends State<ReadingDetailScreen> {
  @override
  void initState() {
    super.initState();
    if (widget.controller.detail?.readingId == widget.readingId) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.controller.loadDetail(widget.readingId);
    });
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.controller,
    builder: (context, child) {
      final t = AppLocalizations.of(context)!;
      final isLoaded =
          widget.controller.detailState == ReadingDetailState.loaded &&
          widget.controller.detail != null;
      return Scaffold(
        backgroundColor: isLoaded ? _CareerReadingColors.midnight : null,
        appBar: isLoaded
            ? AppBar(
                backgroundColor: _CareerReadingColors.midnight,
                foregroundColor: _CareerReadingColors.alabaster,
                surfaceTintColor: Colors.transparent,
                title: const Text('Career Timing Forecast'),
              )
            : AppBar(title: Text(t.careerReading)),
        body: SafeArea(
          child: _DetailBody(
            controller: widget.controller,
            readingId: widget.readingId,
          ),
        ),
      );
    },
  );
}

class _DetailBody extends StatelessWidget {
  const _DetailBody({required this.controller, required this.readingId});
  final ReadingController controller;
  final String readingId;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    if (controller.detailState == ReadingDetailState.loading) {
      return const LoadingState();
    }
    final detail = controller.detail;
    if (controller.detailState != ReadingDetailState.loaded || detail == null) {
      return ErrorState(
        message: t.readingUnavailable,
        onRetry: () => controller.loadDetail(readingId),
        retryLabel: t.retry,
      );
    }
    return _CareerReadingDetail(detail: detail);
  }
}

class _CareerReadingDetail extends StatelessWidget {
  const _CareerReadingDetail({required this.detail});
  final ReadingDetail detail;

  @override
  Widget build(BuildContext context) {
    final calibrated = detail.calibratedContent;
    final hasCalibrationContext =
        calibrated != null && calibrated.sections.isNotEmpty;
    final insights =
        detail.insights
            .where((insight) => insight.status != 'NOT_APPLICABLE')
            .toList()
          ..sort(
            (left, right) =>
                left.displayPriority.compareTo(right.displayPriority),
          );
    final createdAt = DateFormat.yMMMd().add_jm().format(
      DateTime.parse(detail.createdAt).toLocal(),
    );

    return ColoredBox(
      color: _CareerReadingColors.midnight,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 680),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _CareerReadingHero(
                    createdAt: createdAt,
                    hasCalibrationContext: hasCalibrationContext,
                  ),
                  const SizedBox(height: 28),
                  if (insights.isNotEmpty) ...[
                    _CareerInsightExperience(insights: insights),
                  ] else if (detail.content.sections.isNotEmpty) ...[
                    const _CareerReadingSectionLabel('CAREER INSIGHTS'),
                    const SizedBox(height: 12),
                    _CareerReadingContentSections(content: detail.content),
                  ],
                  if (hasCalibrationContext) ...[
                    const SizedBox(height: 12),
                    const _CareerReadingSectionLabel(
                      'CAREER HISTORY CALIBRATION',
                    ),
                    const SizedBox(height: 12),
                    _CareerReadingContentSections(content: calibrated),
                    const SizedBox(height: 6),
                    OutlinedButton.icon(
                      onPressed: () => context.push('/career-calibration'),
                      icon: const Icon(Icons.tune_rounded, size: 18),
                      label: const Text('Update Career History'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: _CareerReadingColors.alabaster,
                        side: const BorderSide(
                          color: _CareerReadingColors.goldBorder,
                        ),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 13,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CareerInsightExperience extends StatelessWidget {
  const _CareerInsightExperience({required this.insights});
  final List<CareerInsight> insights;

  @override
  Widget build(BuildContext context) {
    final primary = insights.first;
    final historical = insights
        .where((item) => item.family == 'HISTORICAL_CALIBRATION_RECURRENCE')
        .toList();
    final future = insights
        .where((item) => item.family == 'FUTURE_RECURRENCE_WINDOW')
        .toList();
    final supporting = insights
        .where(
          (item) =>
              item != primary &&
              !historical.contains(item) &&
              !future.contains(item),
        )
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _CareerReadingSectionLabel('CAREER INSIGHTS'),
        const SizedBox(height: 12),
        _CareerInsightCard(insight: primary, primary: true),
        if (supporting.isNotEmpty) ...[
          const SizedBox(height: 18),
          const _CareerReadingSectionLabel('SUPPORTING INSIGHTS'),
          const SizedBox(height: 12),
          for (final insight in supporting)
            _CareerInsightCard(insight: insight),
        ],
        if (historical.isNotEmpty) ...[
          const SizedBox(height: 18),
          const _CareerReadingSectionLabel('MATCHED WITH YOUR CAREER HISTORY'),
          const SizedBox(height: 12),
          for (final insight in historical)
            _CareerInsightCard(insight: insight),
          OutlinedButton.icon(
            onPressed: () => context.push('/career-calibration'),
            icon: const Icon(Icons.tune_rounded, size: 18),
            label: const Text('Update Career History'),
            style: OutlinedButton.styleFrom(
              foregroundColor: _CareerReadingColors.alabaster,
              side: const BorderSide(color: _CareerReadingColors.goldBorder),
            ),
          ),
        ],
        if (future.isNotEmpty) ...[
          const SizedBox(height: 18),
          const _CareerReadingSectionLabel('FUTURE CAREER TIMING'),
          const SizedBox(height: 12),
          for (final insight in future) _CareerInsightCard(insight: insight),
        ],
      ],
    );
  }
}

class _CareerInsightCard extends StatelessWidget {
  const _CareerInsightCard({required this.insight, this.primary = false});
  final CareerInsight insight;
  final bool primary;

  @override
  Widget build(BuildContext context) {
    final caveat =
        insight.status == 'MIXED' ||
        insight.status == 'CONTRADICTED' ||
        insight.status == 'INSUFFICIENT_EVIDENCE';
    final timing = _insightTiming(insight.timing);
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: EdgeInsets.all(primary ? 20 : 17),
      decoration: BoxDecoration(
        color: _CareerReadingColors.surface,
        borderRadius: BorderRadius.circular(primary ? 20 : 16),
        border: Border.all(
          color: primary
              ? _CareerReadingColors.goldBorder
              : _CareerReadingColors.cardBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _insightFamilyLabel(insight.family).toUpperCase(),
            style: _CareerReadingText.eyebrow,
          ),
          const SizedBox(height: 9),
          Text(
            _insightTitle(insight.family),
            style: primary
                ? _CareerReadingText.sectionTitle
                : _CareerReadingText.itemTitle,
          ),
          const SizedBox(height: 7),
          Text(_insightSummary(insight.family), style: _CareerReadingText.body),
          if (timing != null) ...[
            const SizedBox(height: 12),
            Text(timing, style: _CareerReadingText.meta),
          ],
          if (insight.calibrationContext != null &&
              insight.calibrationContext!.matchedEventCount != null) ...[
            const SizedBox(height: 12),
            Text(
              '${insight.calibrationContext!.matchedEventCount} past Career event${insight.calibrationContext!.matchedEventCount == 1 ? '' : 's'} matched this timing pattern.',
              style: _CareerReadingText.body,
            ),
            if (insight.calibrationContext!.mechanismFamilies.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                'Recurring timing: ${insight.calibrationContext!.mechanismFamilies.map(_calibrationMechanismLabel).join(', ')}',
                style: _CareerReadingText.meta,
              ),
            ],
            for (final event in insight.calibrationContext!.matchedEvents)
              Padding(
                padding: const EdgeInsets.only(top: 5),
                child: Text(
                  '${event.eventType} · ${_calibrationEventDate(event.eventDate)}',
                  style: _CareerReadingText.meta,
                ),
              ),
            if (insight.calibrationContext!.composite) ...[
              const SizedBox(height: 6),
              Text('Two historical pattern matches overlap in this period.', style: _CareerReadingText.meta),
            ],
          ],
          if (caveat) ...[
            const SizedBox(height: 14),
            const _CareerReadingSectionLabel('WHAT LIMITS THIS SIGNAL'),
            const SizedBox(height: 7),
            Text(
              _insightCaveat(insight.status),
              style: _CareerReadingText.body,
            ),
          ],
          if (insight.technicalContext != null && !insight.technicalContext!.isEmpty) ...[
          const SizedBox(height: 10),
          Material(
            color: Colors.transparent,
            child: Theme(
              data: Theme.of(context)
                  .copyWith(dividerColor: Colors.transparent),
              child: ExpansionTile(
                tilePadding: EdgeInsets.zero,
                title: Text(
                  'ASTROLOGY BEHIND THIS',
                  style: _CareerReadingText.source,
                ),
                iconColor: _CareerReadingColors.gold,
                collapsedIconColor: _CareerReadingColors.slate,
                children: [_TechnicalGroups(context: insight.technicalContext!)],
              ),
            ),
          ),
          ],
        ],
      ),
    );
  }
}

class _TechnicalGroups extends StatelessWidget {
  const _TechnicalGroups({required this.context});
  final CareerTechnicalContext context;
  @override
  Widget build(BuildContext buildContext) {
    final groups = <(String, List<Map<String, dynamic>>)>[('Natal Structure', context.natalStructure), ('D10 Career Chart', context.d10CareerChart), ('Timing', context.timing), ('Supporting Context', context.supportingContext), ('Career History', context.careerHistory), ('Classical Rule Context', context.classicalRuleContext)];
    return Padding(padding: const EdgeInsets.only(bottom: 8), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [for (final group in groups) if (group.$2.isNotEmpty) ...[Text(group.$1, style: _CareerReadingText.source), const SizedBox(height: 4), for (final row in group.$2) Text(_technicalRow(row), style: _CareerReadingText.meta), const SizedBox(height: 9)]]));
  }
}
String _technicalRow(Map<String, dynamic> row) {
  final kind = row['kind'];
  if (kind == 'D10_CAREER_CHART') return 'Career divisional chart included in this insight';
  if (kind == 'DASHA') return '${_dashaLabel(row['level'])}: ${row['planet'] ?? 'Current period'}';
  if (kind == 'TRANSIT') return '${row['transitPlanet'] ?? 'Current transit'}${row['natalHouseNumber'] is int ? ' · Natal ${row['natalHouseNumber']}th-house context' : ''}';
  if (kind == 'CONCURRENT_TIMING') return 'Timing relationship: ${_lineageLabel(row['lineageClassification'])}';
  if (kind == 'CAREER_HISTORY') return 'Calibration: ${row['calibrationLevel'] ?? 'Career history'}';
  if (kind == 'CLASSICAL_RULE_CONTEXT') return 'Classical rule evidence is not a guaranteed Career outcome.';
  if (row['sourceFamily'] == 'ASHTAKAVARGA') return '${row['houseNumber'] ?? ''}th-house ${row['scoreType'] ?? 'score'}: ${row['value'] ?? ''}';
  if (row['sourceFamily'] == 'PLANETARY_STATE') return '${row['planet'] ?? 'Planet'} — ${_stateLabel(row['state'])}';
  if (row['sourceFamily'] == 'PLANETARY_RELATIONSHIP') return '${row['subjectPlanet'] ?? 'Planet'} → ${row['targetPlanet'] ?? 'Planet'} · ${row['relationshipType'] ?? 'Relationship'}: ${row['relationship'] ?? ''}';
  return '';
}
String _dashaLabel(Object? value) => const {'MAHADASHA':'Mahadasha','ANTARDASHA':'Antardasha','PRATYANTAR_DASHA':'Pratyantar'}[value] ?? 'Dasha';
String _lineageLabel(Object? value) => const {'INDEPENDENT':'Independent mechanisms','PARTIALLY_OVERLAPPING':'Partially overlapping mechanisms'}[value] ?? 'Timing context';
String _stateLabel(Object? value) => const {'RETROGRADE':'Retrograde','COMBUST':'Combust','EXALTED':'Exalted','DEBILITATED':'Debilitated','OWN_SIGN':'Own Sign','MOOLATRIKONA':'Moolatrikona'}[value] ?? 'State';

String _insightFamilyLabel(String family) =>
    const {
      'CAREER_FOUNDATION': 'Career Foundation',
      'ACTIVE_CAREER_DASHA': 'Current Career Dasha',
      'CURRENT_CAREER_TRANSIT': 'Current Career Transits',
      'CONCURRENT_CAREER_TIMING': 'Career Timing Alignment',
      'HISTORICAL_CALIBRATION_RECURRENCE': 'Matched With Your Career History',
      'FUTURE_RECURRENCE_WINDOW': 'Future Career Timing',
      'AUDITED_CLASSICAL_PREDICATE': 'Classical Career Indicator',
    }[family] ??
    'Career Insight';
String _insightTitle(String family) => _insightFamilyLabel(family);
String _insightSummary(String family) =>
    const {
      'CAREER_FOUNDATION': 'Your natal Career structure is centered on the 10th-house factors identified in your chart.',
      'ACTIVE_CAREER_DASHA': 'Your current Dasha timing connects to Career-related factors in the natal chart.',
      'CURRENT_CAREER_TRANSIT': 'A current transit is activating a Career-related natal factor used by this reading.',
      'CONCURRENT_CAREER_TIMING': 'Career-related Dasha and transit evidence currently overlap.',
      'HISTORICAL_CALIBRATION_RECURRENCE': 'Similar timing appeared across your saved Career events.',
      'FUTURE_RECURRENCE_WINDOW': 'An upcoming period matches a timing pattern seen in your saved Career history.',
      'AUDITED_CLASSICAL_PREDICATE': 'The supplied evidence satisfies the existing audited classical predicate; this does not establish an outcome.',
    }[family] ??
    'This deterministic Career Insight is available from your stored reading.';
String _insightCaveat(String status) =>
    const {
      'MIXED': 'The supplied deterministic evidence contains both supporting and limiting context.',
      'CONTRADICTED': 'The relevant deterministic evidence contains an explicit contradiction.',
      'INSUFFICIENT_EVIDENCE': 'Available deterministic evidence is insufficient to evaluate this signal fully.',
    }[status] ??
    'Additional deterministic context is available.';
String? _insightTiming(CareerInsightTiming timing) {
  if (timing.instant != null) {
    return 'Timing: ${timing.instant}';
  }
  if (timing.from != null && timing.to != null) {
    return 'Timing: ${timing.from} to ${timing.to}';
  }
  if (timing.dashaIntervals.isNotEmpty) {
    return 'Current timing context is included in this reading.';
  }
  return null;
}

String _calibrationMechanismLabel(String value) => const {
  'DASHA_RECURRENCE': 'Dasha timing',
  'TRANSIT_RECURRENCE': 'Transit timing',
  'DASHA_TRANSIT_COACTIVATION_RECURRENCE': 'Dasha and transit timing',
  'CAREER_SUBJECT_RECURRENCE': 'Career subject timing',
  'STRUCTURAL_CONTEXT': 'Structural context',
}[value] ?? 'Timing pattern';

String _calibrationEventDate(Map<String, dynamic> date) {
  final year = date['year'];
  final month = date['month'];
  final day = date['day'];
  if (year is! int) return 'Saved Career event';
  if (month is! int) return '$year';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (month < 1 || month > 12) return '$year';
  return day is int ? '${months[month - 1]} $day, $year' : '${months[month - 1]} $year';
}

class _CareerReadingHero extends StatelessWidget {
  const _CareerReadingHero({
    required this.createdAt,
    required this.hasCalibrationContext,
  });
  final String createdAt;
  final bool hasCalibrationContext;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(22),
    decoration: BoxDecoration(
      color: _CareerReadingColors.surface,
      borderRadius: BorderRadius.circular(22),
      border: Border.all(color: _CareerReadingColors.goldBorder),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(
              Icons.auto_awesome_rounded,
              color: _CareerReadingColors.gold,
              size: 16,
            ),
            const SizedBox(width: 8),
            Text('CAREER READING', style: _CareerReadingText.eyebrow),
            const Spacer(),
            if (hasCalibrationContext) const _CareerReadingStatusChip(),
          ],
        ),
        const SizedBox(height: 18),
        Text('Career Timing Forecast', style: _CareerReadingText.headline),
        const SizedBox(height: 8),
        Text(
          hasCalibrationContext
              ? 'Personalized using your birth chart and available career-history context.'
              : 'Personalized using your birth chart.',
          style: _CareerReadingText.body,
        ),
        const SizedBox(height: 18),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
          decoration: BoxDecoration(
            color: _CareerReadingColors.midnight,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: _CareerReadingColors.cardBorder),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.schedule_rounded,
                color: _CareerReadingColors.gold,
                size: 15,
              ),
              const SizedBox(width: 7),
              Text('Created $createdAt', style: _CareerReadingText.meta),
            ],
          ),
        ),
      ],
    ),
  );
}

class _CareerReadingStatusChip extends StatelessWidget {
  const _CareerReadingStatusChip();

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
    decoration: BoxDecoration(
      color: const Color(0x1FC5A059),
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: _CareerReadingColors.goldBorder),
    ),
    child: Text('CALIBRATION CONTEXT', style: _CareerReadingText.chip),
  );
}

class _CareerReadingSectionLabel extends StatelessWidget {
  const _CareerReadingSectionLabel(this.label);
  final String label;

  @override
  Widget build(BuildContext context) => Semantics(
    header: true,
    child: Row(
      children: [
        Container(
          width: 4,
          height: 18,
          decoration: BoxDecoration(
            color: _CareerReadingColors.gold,
            borderRadius: BorderRadius.circular(10),
          ),
        ),
        const SizedBox(width: 9),
        Text(label, style: _CareerReadingText.eyebrow),
      ],
    ),
  );
}

class _CareerReadingContentSections extends StatelessWidget {
  const _CareerReadingContentSections({required this.content});
  final ReadingContent content;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      for (final section in content.sections) ...[
        Semantics(
          header: true,
          child: Text(section.headline, style: _CareerReadingText.sectionTitle),
        ),
        const SizedBox(height: 10),
        for (final item in section.items)
          _CareerReadingEvidenceCard(
            item: item,
            showHeadline: item.headline != section.headline,
          ),
        const SizedBox(height: 18),
      ],
    ],
  );
}

class _CareerReadingEvidenceCard extends StatelessWidget {
  const _CareerReadingEvidenceCard({
    required this.item,
    required this.showHeadline,
  });
  final ReadingSectionItem item;
  final bool showHeadline;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    margin: const EdgeInsets.only(bottom: 10),
    padding: const EdgeInsets.all(17),
    decoration: BoxDecoration(
      color: _CareerReadingColors.surface,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: _CareerReadingColors.cardBorder),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (showHeadline) ...[
          Text(item.headline, style: _CareerReadingText.itemTitle),
          const SizedBox(height: 7),
        ],
        Text(item.sentence, style: _CareerReadingText.body),
        if (item.sourceTitle != null &&
            item.sourceTitle!.trim().isNotEmpty) ...[
          const SizedBox(height: 12),
          _CareerReadingSourceChip(title: item.sourceTitle!),
        ],
      ],
    ),
  );
}

class _CareerReadingSourceChip extends StatelessWidget {
  const _CareerReadingSourceChip({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(
      color: _CareerReadingColors.midnight,
      borderRadius: BorderRadius.circular(99),
      border: Border.all(color: _CareerReadingColors.cardBorder),
    ),
    child: Text(title, style: _CareerReadingText.source),
  );
}

abstract final class _CareerReadingColors {
  static const midnight = Color(0xFF0B071B);
  static const surface = Color(0xFF17112F);
  static const alabaster = Color(0xFFFAF7F2);
  static const slate = Color(0xFF9E9AA9);
  static const gold = Color(0xFFC5A059);
  static const goldBorder = Color(0x66C5A059);
  static const cardBorder = Color(0x665E4A87);
}

abstract final class _CareerReadingText {
  static const eyebrow = TextStyle(
    color: _CareerReadingColors.gold,
    fontSize: 11,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.1,
  );
  static const headline = TextStyle(
    color: _CareerReadingColors.alabaster,
    fontFamily: 'EBGaramond',
    fontSize: 31,
    fontWeight: FontWeight.w600,
    height: 1.06,
  );
  static const sectionTitle = TextStyle(
    color: _CareerReadingColors.alabaster,
    fontFamily: 'EBGaramond',
    fontSize: 24,
    fontWeight: FontWeight.w600,
    height: 1.1,
  );
  static const itemTitle = TextStyle(
    color: _CareerReadingColors.alabaster,
    fontSize: 16,
    fontWeight: FontWeight.w600,
    height: 1.25,
  );
  static const body = TextStyle(
    color: _CareerReadingColors.slate,
    fontSize: 15,
    height: 1.45,
  );
  static const meta = TextStyle(
    color: _CareerReadingColors.slate,
    fontSize: 12,
    height: 1.2,
  );
  static const chip = TextStyle(
    color: _CareerReadingColors.gold,
    fontSize: 9,
    fontWeight: FontWeight.w700,
    letterSpacing: .6,
  );
  static const source = TextStyle(
    color: _CareerReadingColors.slate,
    fontSize: 11,
    height: 1.2,
  );
}
