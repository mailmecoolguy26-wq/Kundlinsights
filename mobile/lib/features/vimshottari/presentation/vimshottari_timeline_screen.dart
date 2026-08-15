import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../app/theme/app_theme.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/widgets/app_card.dart';
import '../../profiles/profile_controller.dart';
import '../domain/vimshottari.dart';
import '../vimshottari_controller.dart';

class VimshottariTimelineScreen extends StatefulWidget {
  const VimshottariTimelineScreen({
    super.key,
    required this.profileController,
    required this.controller,
  });

  final ProfileController profileController;
  final VimshottariController controller;

  @override
  State<VimshottariTimelineScreen> createState() =>
      _VimshottariTimelineScreenState();
}

class _VimshottariTimelineScreenState extends State<VimshottariTimelineScreen> {
  @override
  void initState() {
    super.initState();
    widget.controller.loadTimeline();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.controller,
    builder: (context, child) {
      final t = AppLocalizations.of(context)!;
      return Scaffold(
        appBar: AppBar(title: Text(t.vimshottariTimeline)),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              Text(
                widget.profileController.activeProfile?.label ??
                    t.activeProfile,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: AppSpacing.md),
              Semantics(
                label: t.dashaLevel,
                child: SegmentedButton<VimshottariLevel>(
                  segments: [
                    ButtonSegment(
                      value: VimshottariLevel.md,
                      label: Text(t.mahadasha),
                    ),
                    ButtonSegment(
                      value: VimshottariLevel.ad,
                      label: Text(t.antardasha),
                    ),
                    ButtonSegment(
                      value: VimshottariLevel.pd,
                      label: Text(t.pratyantardasha),
                    ),
                  ],
                  selected: {widget.controller.timelineLevel},
                  onSelectionChanged: (selection) =>
                      widget.controller.loadTimeline(level: selection.first),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Semantics(
                label: t.timelineWindow,
                child: SegmentedButton<int>(
                  segments: [
                    ButtonSegment(value: 365, label: Text(t.nextOneYear)),
                    ButtonSegment(value: 1095, label: Text(t.nextThreeYears)),
                    ButtonSegment(value: 1825, label: Text(t.nextFiveYears)),
                  ],
                  selected: {widget.controller.timelineWindowDays},
                  onSelectionChanged: (selection) => widget.controller
                      .loadTimeline(windowDays: selection.first),
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              _TimelineBody(controller: widget.controller),
            ],
          ),
        ),
      );
    },
  );
}

class _TimelineBody extends StatelessWidget {
  const _TimelineBody({required this.controller});
  final VimshottariController controller;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    if (controller.timelineState == VimshottariLoadState.loading ||
        controller.timelineState == VimshottariLoadState.initial) {
      return Semantics(
        label: t.vimshottariTimelineLoading,
        child: const Center(child: CircularProgressIndicator()),
      );
    }
    if (controller.timelineState == VimshottariLoadState.error ||
        controller.timeline == null) {
      return AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(t.vimshottariUnavailable),
            const SizedBox(height: AppSpacing.sm),
            TextButton(
              onPressed: controller.loadTimeline,
              child: Text(t.retry),
            ),
          ],
        ),
      );
    }
    return Column(
      children: controller.timeline!.periods
          .map((period) => _TimelineRow(period: period))
          .toList(growable: false),
    );
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({required this.period});
  final DashaPeriod period;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final dateFormat = DateFormat.yMMMd().add_jm();
    final parents = [
      if (period.mahadashaLord != null)
        '${t.mahadasha}: ${period.mahadashaLord}',
      if (period.antardashaLord != null)
        '${t.antardasha}: ${period.antardashaLord}',
    ];
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Semantics(
        label:
            '${period.lord}, ${t.starts} ${dateFormat.format(period.startUtc.toLocal())}, ${t.ends} ${dateFormat.format(period.endUtc.toLocal())}${parents.isEmpty ? '' : ', ${parents.join(', ')}'}',
        child: AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(period.lord, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: AppSpacing.xs),
              _DateLine(
                label: t.starts,
                value: dateFormat.format(period.startUtc.toLocal()),
              ),
              _DateLine(
                label: t.ends,
                value: dateFormat.format(period.endUtc.toLocal()),
              ),
              for (final parent in parents) Text(parent),
            ],
          ),
        ),
      ),
    );
  }
}

class _DateLine extends StatelessWidget {
  const _DateLine({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: AppSpacing.xs),
    child: Text('$label: $value'),
  );
}
