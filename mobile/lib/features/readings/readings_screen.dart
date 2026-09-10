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
    this.generation,
    required this.readingId,
  });
  final ReadingController controller;
  final CareerReadingGenerationController? generation;
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
            generation: widget.generation,
            readingId: widget.readingId,
          ),
        ),
      );
    },
  );
}

class _DetailBody extends StatelessWidget {
  const _DetailBody({
    required this.controller,
    this.generation,
    required this.readingId,
  });
  final ReadingController controller;
  final CareerReadingGenerationController? generation;
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
    return _CareerReadingDetail(detail: detail, generation: generation);
  }
}

class _CareerReadingDetail extends StatelessWidget {
  const _CareerReadingDetail({required this.detail, this.generation});
  final ReadingDetail detail;
  final CareerReadingGenerationController? generation;

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
    final structuredCalibration =
        detail.calibrationContext ??
        insights
            .map((insight) => insight.calibrationContext)
            .whereType<CareerInsightCalibrationContext>()
            .map(
              (context) => context.calibrationLevel == null
                  ? null
                  : CareerReadingCalibrationSummary(
                      calibrationLevel: context.calibrationLevel!,
                      eventCount: context.eventCount,
                    ),
            )
            .whereType<CareerReadingCalibrationSummary>()
            .firstOrNull;

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
                  if (_CareerTimingSection.hasContent(insights)) ...[
                    const SizedBox(height: 18),
                    _CareerTimingSection(insights: insights),
                  ],
                  if (insights.isNotEmpty && structuredCalibration != null) ...[
                    const SizedBox(height: 18),
                    _CareerHistorySummary(summary: structuredCalibration),
                    const SizedBox(height: 8),
                    _UpdateCareerHistoryAction(),
                  ] else if (insights.isEmpty && hasCalibrationContext) ...[
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
                  if (insights.isNotEmpty &&
                      _hasCalculationNote(calibrated)) ...[
                    const SizedBox(height: 18),
                    _TechnicalNote(content: calibrated!),
                  ],
                  if (generation != null &&
                      generation!.activeBirthProfileId ==
                          detail.birthProfileId) ...[
                    const SizedBox(height: 22),
                    ListenableBuilder(
                      listenable: generation!,
                      builder: (context, child) =>
                          _GenerateUpdatedReadingAction(
                            generation: generation!,
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

class _GenerateUpdatedReadingAction extends StatelessWidget {
  const _GenerateUpdatedReadingAction({required this.generation});

  final CareerReadingGenerationController generation;

  @override
  Widget build(BuildContext context) {
    if (generation.eligibilityState != CareerEligibilityState.eligible) {
      return const SizedBox.shrink();
    }
    final generating =
        generation.generationState == CareerGenerationState.generating;
    final failed = generation.generationState == CareerGenerationState.error;
    if (generating) {
      return Semantics(
        liveRegion: true,
        label: 'Generating updated Career Reading',
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: _CareerReadingColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: _CareerReadingColors.goldBorder),
          ),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Generating updated Career Reading',
                style: TextStyle(
                  color: _CareerReadingColors.alabaster,
                  fontWeight: FontWeight.w700,
                ),
              ),
              SizedBox(height: 10),
              LinearProgressIndicator(color: _CareerReadingColors.gold),
            ],
          ),
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _CareerReadingColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _CareerReadingColors.goldBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('UPDATED READING', style: _CareerReadingText.eyebrow),
          const SizedBox(height: 7),
          const Text(
            'Generate a fresh reading using your current birth profile and the latest available Career analysis.',
            style: TextStyle(color: _CareerReadingColors.slate, height: 1.4),
          ),
          if (failed) ...[
            const SizedBox(height: 8),
            const Text(
              'The updated reading could not be generated. Please try again.',
              style: TextStyle(color: _CareerReadingColors.slate),
            ),
          ],
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: generation.canGenerate
                ? () => _confirmGeneration(context)
                : null,
            icon: const Icon(Icons.refresh_rounded, size: 18),
            label: const Text('GENERATE UPDATED READING'),
            style: OutlinedButton.styleFrom(
              foregroundColor: _CareerReadingColors.alabaster,
              side: const BorderSide(color: _CareerReadingColors.goldBorder),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmGeneration(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Generate updated Career Reading?'),
        content: const Text(
          'A new Career Reading will be created using your current birth profile. Your existing reading will remain available.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Generate'),
          ),
        ],
      ),
    );
    if (confirmed == true && generation.canGenerate) {
      generation.generate();
    }
  }
}

class _CareerInsightExperience extends StatelessWidget {
  const _CareerInsightExperience({required this.insights});
  final List<CareerInsight> insights;

  @override
  Widget build(BuildContext context) {
    final primary = insights.first;
    final trailing = insights.skip(1).toList(growable: false);
    final reasons = trailing
        .where(
          (insight) =>
              insight.family != 'FUTURE_RECURRENCE_WINDOW' &&
              insight.family != 'HISTORICAL_CALIBRATION_RECURRENCE',
        )
        .toList(growable: false);
    final history = trailing
        .where(
          (insight) => insight.family == 'HISTORICAL_CALIBRATION_RECURRENCE',
        )
        .toList(growable: false);
    final future = trailing
        .where((insight) => insight.family == 'FUTURE_RECURRENCE_WINDOW')
        .toList(growable: false);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _CareerReadingSectionLabel(_primaryTimingLabel(primary.family)),
        const SizedBox(height: 12),
        _CareerInsightCard(insight: primary, primary: true),
        if (reasons.isNotEmpty) ...[
          const SizedBox(height: 16),
          const _CareerReadingSectionLabel('WHY THIS PERIOD STANDS OUT'),
          const SizedBox(height: 10),
          Container(
            decoration: BoxDecoration(
              color: _CareerReadingColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: _CareerReadingColors.cardBorder),
            ),
            child: Column(
              children: [
                for (var index = 0; index < reasons.length; index++) ...[
                  _CareerReasonRow(insight: reasons[index]),
                  if (index < reasons.length - 1)
                    const Divider(
                      color: _CareerReadingColors.cardBorder,
                      height: 1,
                    ),
                ],
              ],
            ),
          ),
        ],
        if (history.isNotEmpty) ...[
          const SizedBox(height: 16),
          const _CareerReadingSectionLabel('MATCHED WITH YOUR CAREER HISTORY'),
          const SizedBox(height: 10),
          _CareerReasonRow(insight: history.first),
        ],
        if (future.isNotEmpty) ...[
          const SizedBox(height: 16),
          const _CareerReadingSectionLabel('UPCOMING CAREER TIMING'),
          const SizedBox(height: 10),
          _CareerInsightCard(insight: future.first),
        ],
      ],
    );
  }
}

class _CareerReasonRow extends StatelessWidget {
  const _CareerReasonRow({required this.insight});
  final CareerInsight insight;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          Icons.auto_awesome_rounded,
          size: 16,
          color: _CareerReadingColors.gold,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _insightFamilyLabel(insight.family),
                style: _CareerReadingText.itemTitle,
              ),
              const SizedBox(height: 3),
              Text(
                _insightSummary(insight.family),
                style: _CareerReadingText.meta,
              ),
              const SizedBox(height: 6),
              _CareerInsightStatusChip(status: insight.status),
              if (insight.status != 'SUPPORTED') ...[
                const SizedBox(height: 8),
                const Text(
                  'WHAT LIMITS THIS SIGNAL',
                  style: _CareerReadingText.source,
                ),
                const SizedBox(height: 3),
                Text(
                  _insightCaveat(insight.status),
                  style: _CareerReadingText.meta,
                ),
              ],
            ],
          ),
        ),
      ],
    ),
  );
}

String _primaryTimingLabel(String family) =>
    const {
      'CURRENT_CAREER_TRANSIT': 'CURRENT CAREER TRANSITS',
      'ACTIVE_CAREER_DASHA': 'CURRENT CAREER DASHA',
      'CONCURRENT_CAREER_TIMING': 'CAREER TIMING ALIGNMENT',
      'FUTURE_RECURRENCE_WINDOW': 'UPCOMING CAREER TIMING',
    }[family] ??
    'CAREER INSIGHT';

class _CareerTimingSection extends StatelessWidget {
  const _CareerTimingSection({required this.insights});
  final List<CareerInsight> insights;

  static bool hasContent(List<CareerInsight> insights) => insights.any(
    (insight) =>
        insight.timing.dashaPeriods.isNotEmpty ||
        insight.timing.transitContexts.isNotEmpty ||
        insight.timing.timingWindow != null,
  );

  @override
  Widget build(BuildContext context) {
    final dashas = <CareerDashaPeriod>[];
    final transits = <CareerTransitTiming>[];
    final windows = <(CareerTimingWindow, String?, String?)>[];
    final seen = <String>{};
    for (final insight in insights) {
      for (final period in insight.timing.dashaPeriods) {
        if (seen.add(
          'dasha:${period.level}:${period.planet}:${period.start}:${period.end}',
        )) {
          dashas.add(period);
        }
      }
      for (final transit in insight.timing.transitContexts) {
        if (seen.add(
          'transit:${transit.planet}:${transit.start}:${transit.end}',
        )) {
          transits.add(transit);
        }
      }
      final window = insight.timing.timingWindow;
      if (window != null &&
          seen.add(
            'window:${window.start}:${window.end}:${insight.timing.timingState}',
          )) {
        windows.add((
          window,
          insight.timing.timingState,
          insight.timing.lineageClassification,
        ));
      }
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _CareerReadingSectionLabel('CAREER TIMING'),
        const SizedBox(height: 12),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(15, 13, 15, 5),
          decoration: BoxDecoration(
            color: _CareerReadingColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: _CareerReadingColors.cardBorder),
          ),
          child: Column(
            children: [
              for (final period in dashas)
                _TimingRow(
                  title: _dashaLabel(period.level),
                  value: period.planet,
                  date: _dateRange(period.start, period.end),
                  state: period.isCurrent ? 'Active now' : null,
                ),
              for (final transit in transits)
                _TimingRow(
                  title: 'Current Transit',
                  value: transit.planet ?? 'Transit timing',
                  date: _dateRangeOrPoint(transit.start, transit.end),
                ),
              for (final window in windows)
                _TimingRow(
                  title: 'Timing Overlap',
                  date: _dateRange(window.$1.start, window.$1.end),
                  state: _timingStateLabel(
                    window.$2,
                    isCurrent: window.$1.isCurrent,
                  ),
                  detail: _lineageDetail(window.$3),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _TimingRow extends StatelessWidget {
  const _TimingRow({
    required this.title,
    this.value,
    required this.date,
    this.state,
    this.detail,
  });
  final String title;
  final String? value, state, detail;
  final String date;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: _CareerReadingText.source),
        if (value != null) ...[
          const SizedBox(height: 3),
          Text(value!, style: _CareerReadingText.itemTitle),
        ],
        const SizedBox(height: 3),
        Text(date, style: _CareerReadingText.body),
        if (state != null || detail != null) ...[
          const SizedBox(height: 4),
          Text(
            [state, detail].whereType<String>().join(' · '),
            style: _CareerReadingText.meta,
          ),
        ],
      ],
    ),
  );
}

class _CareerHistorySummary extends StatelessWidget {
  const _CareerHistorySummary({required this.summary});
  final CareerReadingCalibrationSummary summary;
  @override
  Widget build(BuildContext context) {
    final count = summary.eventCount;
    final level = summary.calibrationLevel;
    final text = switch (level) {
      'NONE' => 'Add Career History to compare timing patterns.',
      'LIMITED' =>
        '${count ?? 1} saved Career event${count == 1 ? '' : 's'}. Add more history for recurring-pattern comparison.',
      'CALIBRATED' =>
        count == null
            ? 'Career History is available for recurring-pattern comparison.'
            : '$count saved Career event${count == 1 ? '' : 's'} available for recurring-pattern comparison.',
      _ => 'Career History is available for this reading.',
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _CareerReadingSectionLabel('CAREER HISTORY'),
        const SizedBox(height: 12),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(17),
          decoration: BoxDecoration(
            color: _CareerReadingColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: _CareerReadingColors.cardBorder),
          ),
          child: Text(text, style: _CareerReadingText.body),
        ),
      ],
    );
  }
}

class _UpdateCareerHistoryAction extends StatelessWidget {
  @override
  Widget build(BuildContext context) => OutlinedButton.icon(
    onPressed: () => context.push('/career-calibration'),
    icon: const Icon(Icons.tune_rounded, size: 18),
    label: const Text('Update Career History'),
    style: OutlinedButton.styleFrom(
      foregroundColor: _CareerReadingColors.alabaster,
      side: const BorderSide(color: _CareerReadingColors.goldBorder),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
    ),
  );
}

bool _hasCalculationNote(ReadingContent? content) =>
    content?.sections.any((section) => section.section == 'calculation-note') ??
    false;

class _TechnicalNote extends StatelessWidget {
  const _TechnicalNote({required this.content});
  final ReadingContent content;

  @override
  Widget build(BuildContext context) {
    final note = content.sections
        .where((section) => section.section == 'calculation-note')
        .expand((section) => section.items)
        .map((item) => item.sentence)
        .firstOrNull;
    if (note == null) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: _CareerReadingColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _CareerReadingColors.cardBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.info_outline_rounded,
            size: 17,
            color: _CareerReadingColors.slate,
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('TECHNICAL NOTE', style: _CareerReadingText.source),
                const SizedBox(height: 3),
                Text(note, style: _CareerReadingText.meta),
              ],
            ),
          ),
        ],
      ),
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
          const SizedBox(height: 7),
          _CareerInsightStatusChip(status: insight.status),
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
              Text(
                'Two historical pattern matches overlap in this period.',
                style: _CareerReadingText.meta,
              ),
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
          if (insight.technicalContext != null &&
              !insight.technicalContext!.isEmpty) ...[
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
                  children: [
                    _TechnicalGroups(context: insight.technicalContext!),
                  ],
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
    final ashtakavarga = context.supportingContext
        .where((row) => row['sourceFamily'] == 'ASHTAKAVARGA')
        .toList(growable: false);
    final planetaryState = context.supportingContext
        .where((row) => row['sourceFamily'] == 'PLANETARY_STATE')
        .toList(growable: false);
    final planetaryRelationship = context.supportingContext
        .where((row) => row['sourceFamily'] == 'PLANETARY_RELATIONSHIP')
        .toList(growable: false);
    final hasSupportingContext =
        ashtakavarga.isNotEmpty ||
        planetaryState.isNotEmpty ||
        planetaryRelationship.isNotEmpty;
    final groups = <(String, List<Map<String, dynamic>>)>[
      ('Natal Structure', context.natalStructure),
      ('D10 Career Chart', context.d10CareerChart),
      ('Timing', context.timing),
      ('Ashtakavarga', ashtakavarga),
      ('Planetary State', planetaryState),
      ('Planetary Relationship', planetaryRelationship),
      ('Career History', context.careerHistory),
      ('Classical Rule Context', context.classicalRuleContext),
    ];
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (hasSupportingContext) ...[
            Text('Supporting Context', style: _CareerReadingText.source),
            const SizedBox(height: 4),
          ],
          for (final group in groups)
            if (group.$2.isNotEmpty) ...[
              Text(group.$1, style: _CareerReadingText.source),
              const SizedBox(height: 4),
              for (final row in group.$2)
                Text(_technicalRow(row), style: _CareerReadingText.meta),
              const SizedBox(height: 9),
            ],
        ],
      ),
    );
  }
}

String _technicalRow(Map<String, dynamic> row) {
  final kind = row['kind'];
  if (kind == 'D10_CAREER_CHART') {
    return 'Career divisional chart included in this insight';
  }
  if (kind == 'DASHA') {
    return '${_dashaLabel(row['level'])}: ${row['planet'] ?? 'Current period'}';
  }
  if (kind == 'TRANSIT') {
    return '${row['transitPlanet'] ?? 'Current transit'}${row['natalHouseNumber'] is int ? ' · Natal ${row['natalHouseNumber']}th-house context' : ''}';
  }
  if (kind == 'CONCURRENT_TIMING') {
    return 'Timing relationship: ${_lineageLabel(row['lineageClassification'])}';
  }
  if (kind == 'CAREER_HISTORY') {
    return 'Calibration: ${row['calibrationLevel'] ?? 'Career history'}';
  }
  if (kind == 'CLASSICAL_RULE_CONTEXT') {
    return 'Classical rule evidence is not a guaranteed Career outcome.';
  }
  if (row['sourceFamily'] == 'ASHTAKAVARGA') {
    final house = row['houseNumber'];
    final score = _ashtakavargaScoreLabel(row['scoreType']);
    final value = row['value'];
    final planet = row['planet'];
    final houseLabel = house is int ? '${_ordinal(house)} House' : 'House';
    return planet is String && planet.isNotEmpty
        ? '$planet $score · $houseLabel: $value'
        : '$houseLabel · $score: $value';
  }
  if (row['sourceFamily'] == 'PLANETARY_STATE') {
    return '${row['planet'] ?? 'Planet'} — ${_stateLabel(row['state'])}';
  }
  if (row['sourceFamily'] == 'PLANETARY_RELATIONSHIP') {
    return '${row['subjectPlanet'] ?? 'Planet'} → ${row['targetPlanet'] ?? 'Planet'} · ${row['relationshipType'] ?? 'Relationship'}: ${row['relationship'] ?? ''}';
  }
  return '';
}

String _ashtakavargaScoreLabel(Object? value) =>
    const {'LAGNA_BAV': 'Lagna BAV', 'SAV': 'SAV', 'BAV': 'BAV'}[value] ??
    'Score';

String _ordinal(int value) {
  final tens = value % 100;
  if (tens >= 11 && tens <= 13) return '${value}th';
  return switch (value % 10) {
    1 => '${value}st',
    2 => '${value}nd',
    3 => '${value}rd',
    _ => '${value}th',
  };
}

String _dashaLabel(Object? value) =>
    const {
      'MAHADASHA': 'Mahadasha',
      'ANTARDASHA': 'Antardasha',
      'PRATYANTAR_DASHA': 'Pratyantar',
    }[value] ??
    'Dasha';
String _lineageLabel(Object? value) =>
    const {
      'INDEPENDENT': 'Independent mechanisms',
      'PARTIALLY_OVERLAPPING': 'Partially overlapping mechanisms',
    }[value] ??
    'Timing context';
String _stateLabel(Object? value) =>
    const {
      'RETROGRADE': 'Retrograde',
      'COMBUST': 'Combust',
      'EXALTED': 'Exalted',
      'DEBILITATED': 'Debilitated',
      'OWN_SIGN': 'Own Sign',
      'MOOLATRIKONA': 'Moolatrikona',
    }[value] ??
    'State';

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
      'CONCURRENT_CAREER_TIMING': 'Available Career timing evidence is insufficient to evaluate this signal fully.',
      'HISTORICAL_CALIBRATION_RECURRENCE':
          'Similar timing appeared across your saved Career events.',
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
  final current = timing.dashaPeriods
      .where((period) => period.isCurrent)
      .toList();
  if (current.isNotEmpty) {
    return 'Active through ${_formatTimingDate(current.first.end)}';
  }
  if (timing.timingWindow != null) {
    return _dateRange(timing.timingWindow!.start, timing.timingWindow!.end);
  }
  if (timing.from != null && timing.to != null) {
    return _dateRange(timing.from, timing.to);
  }
  if (timing.instant != null) return _formatTimingDate(timing.instant!);
  if (timing.transitContexts.isNotEmpty) {
    return _dateRangeOrPoint(
      timing.transitContexts.first.start,
      timing.transitContexts.first.end,
    );
  }
  return null;
}

class _CareerInsightStatusChip extends StatelessWidget {
  const _CareerInsightStatusChip({required this.status});
  final String status;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(
      color: _CareerReadingColors.midnight,
      borderRadius: BorderRadius.circular(999),
      border: Border.all(color: _CareerReadingColors.cardBorder),
    ),
    child: Text(_statusLabel(status), style: _CareerReadingText.chip),
  );
}

String _statusLabel(String value) =>
    const {
      'SUPPORTED': 'Supported',
      'MIXED': 'Mixed evidence',
      'CONTRADICTED': 'Not consistently supported',
      'INSUFFICIENT_EVIDENCE': 'Limited evidence',
    }[value] ??
    'Context available';

String _formatTimingDate(String value) {
  final parsed = DateTime.tryParse(value);
  return parsed == null
      ? value
      : DateFormat('d MMM y').format(parsed.toLocal());
}

String _dateRange(String? start, String? end) {
  if (start != null && end != null) {
    return '${_formatTimingDate(start)} – ${_formatTimingDate(end)}';
  }
  if (start != null) return _formatTimingDate(start);
  if (end != null) return _formatTimingDate(end);
  return 'Timing context available';
}

String _dateRangeOrPoint(String? start, String? end) => _dateRange(start, end);

String? _timingStateLabel(String? state, {required bool isCurrent}) {
  if (isCurrent) return 'Active now';
  return const {
    'UPCOMING': 'Upcoming',
    'PAST': 'Past',
    'CURRENT': 'Active now',
  }[state];
}

String? _lineageDetail(String? value) => const {
  'INDEPENDENT': 'Independent timing mechanisms',
  'PARTIALLY_OVERLAPPING': 'Partially overlapping timing mechanisms',
}[value];

String _calibrationMechanismLabel(String value) =>
    const {
      'DASHA_RECURRENCE': 'Dasha timing',
      'TRANSIT_RECURRENCE': 'Transit timing',
      'DASHA_TRANSIT_COACTIVATION_RECURRENCE': 'Dasha and transit timing',
      'CAREER_SUBJECT_RECURRENCE': 'Career subject timing',
      'STRUCTURAL_CONTEXT': 'Structural context',
    }[value] ??
    'Timing pattern';

String _calibrationEventDate(Map<String, dynamic> date) {
  final year = date['year'];
  final month = date['month'];
  final day = date['day'];
  if (year is! int) return 'Saved Career event';
  if (month is! int) return '$year';
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  if (month < 1 || month > 12) return '$year';
  return day is int
      ? '${months[month - 1]} $day, $year'
      : '${months[month - 1]} $year';
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
