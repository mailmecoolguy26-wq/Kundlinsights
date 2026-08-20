import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/theme/app_theme.dart';
import '../../l10n/app_localizations.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/states.dart';
import 'domain/reading.dart';
import 'reading_controller.dart';
import 'career_reading_generation_controller.dart';

class ReadingsScreen extends StatefulWidget {
  const ReadingsScreen({super.key, required this.controller, this.generation});
  final ReadingController controller;
  final CareerReadingGenerationController? generation;

  @override
  State<ReadingsScreen> createState() => _ReadingsScreenState();
}

class _ReadingsScreenState extends State<ReadingsScreen> {
  String? _navigatedReadingId;

  @override
  void initState() {
    super.initState();
    widget.generation?.addListener(_onGenerationChanged);
  }

  @override
  void dispose() {
    widget.generation?.removeListener(_onGenerationChanged);
    super.dispose();
  }

  void _onGenerationChanged() {
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

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: Listenable.merge(
      widget.generation == null
          ? [widget.controller]
          : [widget.controller, widget.generation!],
    ),
    builder: (context, child) {
      final t = AppLocalizations.of(context)!;
      final screen = Scaffold(
        appBar: AppBar(
          title: Text(t.myReadings),
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
        ),
        body: SafeArea(
          child: RefreshIndicator(
            onRefresh: widget.controller.refresh,
            child: _ReadingList(
              controller: widget.controller,
              generation: widget.generation,
            ),
          ),
        ),
      );
      return screen;
    },
  );
}

class _ReadingList extends StatelessWidget {
  const _ReadingList({required this.controller, this.generation});
  final ReadingController controller;
  final CareerReadingGenerationController? generation;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    if (controller.listState == ReadingListState.initial ||
        controller.listState == ReadingListState.loading) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          if (generation != null) _GenerationCard(generation: generation!),
          const SizedBox(height: 240, child: LoadingState()),
        ],
      );
    }
    if (controller.listState == ReadingListState.error) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          if (generation != null) _GenerationCard(generation: generation!),
          const SizedBox(height: AppSpacing.xxl),
          ErrorState(message: t.readingsUnavailable),
          Center(
            child: TextButton(
              onPressed: controller.refresh,
              child: Text(t.retry),
            ),
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
              child: _GenerationCard(generation: generation!),
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
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(AppSpacing.md),
      itemCount: controller.readings.length + (generation == null ? 0 : 1),
      separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
      itemBuilder: (context, index) => generation != null && index == 0
          ? _GenerationCard(generation: generation!)
          : _ReadingCard(
              reading:
                  controller.readings[index - (generation == null ? 0 : 1)],
            ),
    );
  }
}

class _GenerationCard extends StatelessWidget {
  const _GenerationCard({required this.generation});
  final CareerReadingGenerationController generation;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
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
      return AppCard(child: Text(t.careerReadingUnavailable));
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
          if (busy) ...[
            Text(t.generatingCareerReading),
            const SizedBox(height: AppSpacing.sm),
            const LinearProgressIndicator(),
          ] else
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
      child: AppCard(
        padding: EdgeInsets.zero,
        child: ListTile(
          contentPadding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.xs,
          ),
          title: Text(t.careerReading),
          subtitle: Text('${t.createdOn}: $date'),
          trailing: const Icon(Icons.chevron_right),
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
      return Scaffold(
        appBar: AppBar(title: Text(t.careerReading)),
        body: SafeArea(child: _DetailBody(controller: widget.controller)),
      );
    },
  );
}

class _DetailBody extends StatelessWidget {
  const _DetailBody({required this.controller});
  final ReadingController controller;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    if (controller.detailState == ReadingDetailState.loading) {
      return const LoadingState();
    }
    final detail = controller.detail;
    if (controller.detailState != ReadingDetailState.loaded || detail == null) {
      return ErrorState(message: t.readingUnavailable);
    }
    final date = DateFormat.yMMMd().add_jm().format(
      DateTime.parse(detail.createdAt).toLocal(),
    );
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.md),
      children: [
        Text(
          t.careerReading,
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: AppSpacing.xs),
        Text('${t.createdOn}: $date'),
        const SizedBox(height: AppSpacing.lg),
        for (final section in detail.content.sections) ...[
          Semantics(
            header: true,
            child: Text(
              section.headline,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          for (final item in section.items) _StoredReadingItem(item: item),
          const SizedBox(height: AppSpacing.lg),
        ],
      ],
    );
  }
}

class _StoredReadingItem extends StatelessWidget {
  const _StoredReadingItem({required this.item});
  final ReadingSectionItem item;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
    child: AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(item.headline, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.xs),
          Text(item.sentence),
          if (item.sourceTitle != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              item.sourceTitle!,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ],
      ),
    ),
  );
}
