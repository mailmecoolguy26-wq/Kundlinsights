import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/theme/app_theme.dart';
import '../../l10n/app_localizations.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/app_page_scaffold.dart';
import '../../shared/widgets/section_header.dart';
import '../natal/natal_summary_controller.dart';
import '../profiles/profile_controller.dart';
import '../vimshottari/domain/vimshottari.dart';
import '../vimshottari/vimshottari_controller.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({
    super.key,
    required this.profileController,
    required this.natalController,
    required this.vimshottariController,
  });

  final ProfileController profileController;
  final NatalSummaryController natalController;
  final VimshottariController vimshottariController;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: Listenable.merge([natalController, vimshottariController]),
    builder: (context, child) => AppPageScaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          await natalController.refresh();
          await vimshottariController.refreshCurrent();
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            SectionHeader(title: AppLocalizations.of(context)!.welcome),
            _ProfileCard(profileController: profileController),
            const SizedBox(height: AppSpacing.xl),
            _NatalSummaryCard(controller: natalController),
            const SizedBox(height: AppSpacing.xl),
            _CurrentDashaCard(controller: vimshottariController),
          ],
        ),
      ),
    ),
  );
}

class _CurrentDashaCard extends StatelessWidget {
  const _CurrentDashaCard({required this.controller});
  final VimshottariController controller;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    if (controller.currentState == VimshottariLoadState.loading ||
        controller.currentState == VimshottariLoadState.initial) {
      return Semantics(
        label: t.currentDashaLoading,
        child: const AppCard(
          child: SizedBox(
            height: 184,
            child: Center(child: CircularProgressIndicator()),
          ),
        ),
      );
    }
    if (controller.currentState == VimshottariLoadState.error ||
        controller.current == null) {
      return AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              t.currentDasha,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(t.vimshottariUnavailable),
            const SizedBox(height: AppSpacing.sm),
            TextButton(
              onPressed: controller.refreshCurrent,
              child: Text(t.retry),
            ),
          ],
        ),
      );
    }
    final current = controller.current!;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            t.currentDasha,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: AppSpacing.md),
          _DashaFact(label: t.currentMahadasha, period: current.mahadasha),
          _DashaFact(label: t.currentAntardasha, period: current.antardasha),
          _DashaFact(
            label: t.currentPratyantardasha,
            period: current.pratyantardasha,
          ),
          const SizedBox(height: AppSpacing.sm),
          TextButton(
            onPressed: () => context.push('/vimshottari'),
            child: Text(t.viewFullDashaTimeline),
          ),
        ],
      ),
    );
  }
}

class _DashaFact extends StatelessWidget {
  const _DashaFact({required this.label, required this.period});
  final String label;
  final DashaPeriod period;

  @override
  Widget build(BuildContext context) {
    final format = DateFormat.yMMMd().add_jm();
    final dates =
        '${format.format(period.startUtc.toLocal())} – ${format.format(period.endUtc.toLocal())}';
    return Semantics(
      label: '$label: ${period.lord}; $dates',
      child: Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: Theme.of(context).textTheme.bodyMedium),
            Text(period.lord, style: Theme.of(context).textTheme.titleMedium),
            Text(dates, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({required this.profileController});
  final ProfileController profileController;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            t.activeProfile,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(profileController.activeProfile?.label ?? t.profileBody),
        ],
      ),
    );
  }
}

class _NatalSummaryCard extends StatelessWidget {
  const _NatalSummaryCard({required this.controller});
  final NatalSummaryController controller;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    if (controller.state == NatalSummaryLoadState.loading ||
        controller.state == NatalSummaryLoadState.initial) {
      return const AppCard(child: _SummaryLoading());
    }
    if (controller.state == NatalSummaryLoadState.error ||
        controller.summary == null) {
      return AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              t.natalSummary,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(t.natalSummaryUnavailable),
            const SizedBox(height: AppSpacing.md),
            TextButton(onPressed: controller.refresh, child: Text(t.retry)),
          ],
        ),
      );
    }
    final summary = controller.summary!.summary;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            t.natalSummary,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: AppSpacing.md),
          _Fact(label: t.ascendant, value: summary.ascendant.sign.englishName),
          _Fact(label: t.moonSign, value: summary.moonSign.englishName),
          _Fact(label: t.nakshatra, value: summary.moonNakshatra.name),
          _Fact(label: t.pada, value: '${summary.moonPada}'),
          _Fact(label: t.sunSign, value: summary.sunSign.englishName),
        ],
      ),
    );
  }
}

class _SummaryLoading extends StatelessWidget {
  const _SummaryLoading();
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return Semantics(
      label: t.natalSummaryLoading,
      child: const SizedBox(
        height: 164,
        child: Center(child: CircularProgressIndicator()),
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: AppSpacing.xs),
    child: Row(
      children: [
        Expanded(
          child: Text(label, style: Theme.of(context).textTheme.bodyMedium),
        ),
        Text(value, style: Theme.of(context).textTheme.bodyLarge),
      ],
    ),
  );
}
