import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/theme/app_theme.dart';
import '../../l10n/app_localizations.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/states.dart';
import 'domain/reading.dart';
import 'reading_controller.dart';

class ReadingsScreen extends StatelessWidget {
  const ReadingsScreen({super.key, required this.controller});
  final ReadingController controller;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, child) {
      final t = AppLocalizations.of(context)!;
      return Scaffold(
        appBar: AppBar(
          title: Text(t.myReadings),
          actions: [
            Semantics(
              label: t.refresh,
              button: true,
              child: IconButton(
                icon: const Icon(Icons.refresh),
                onPressed: controller.refresh,
              ),
            ),
          ],
        ),
        body: SafeArea(
          child: RefreshIndicator(
            onRefresh: controller.refresh,
            child: _ReadingList(controller: controller),
          ),
        ),
      );
    },
  );
}

class _ReadingList extends StatelessWidget {
  const _ReadingList({required this.controller});
  final ReadingController controller;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    if (controller.listState == ReadingListState.initial ||
        controller.listState == ReadingListState.loading) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [SizedBox(height: 240, child: LoadingState())],
      );
    }
    if (controller.listState == ReadingListState.error) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
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
      itemCount: controller.readings.length,
      separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
      itemBuilder: (context, index) =>
          _ReadingCard(reading: controller.readings[index]),
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
    widget.controller.loadDetail(widget.readingId);
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
