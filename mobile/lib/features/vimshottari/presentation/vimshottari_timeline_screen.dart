import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../profiles/profile_controller.dart';
import '../../readings/astrology_presentation_copy.dart';
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
  }

  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    return ListenableBuilder(
      listenable: Listenable.merge([
        widget.controller,
        widget.profileController,
      ]),
      builder: (_, child) {
        final insightContext = widget.controller.current?.insightContext;
        return Scaffold(
          backgroundColor: _C.midnight,
          body: SafeArea(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
              children: [
                Row(
                  children: [
                    Material(
                      color: _C.violet,
                      shape: const CircleBorder(),
                      child: IconButton(
                        onPressed: () => Navigator.of(context).maybePop(),
                        icon: const Icon(Icons.arrow_back, color: _C.alabaster),
                      ),
                    ),
                    const Spacer(),
                    _ProfilePill(
                      widget.profileController.activeProfile?.label ??
                          'Active profile',
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                const Text('DASHA', style: _S.eyebrow),
                const SizedBox(height: 5),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        widget.controller.timelineLevel == VimshottariLevel.ad
                            ? 'Antardasha Timeline'
                            : widget.controller.timelineLevel ==
                                  VimshottariLevel.pd
                            ? 'Pratyantar Timeline'
                            : 'Vimshottari',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: _S.title,
                      ),
                    ),
                    const SizedBox(width: 10),
                    const _Chip('VIMSHOTTARI'),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  widget.controller.timelineLevel == VimshottariLevel.ad &&
                          widget.controller.current != null
                      ? 'WITHIN ${copy.planet(widget.controller.current!.mahadasha.lord).toUpperCase()} MAHADASHA'
                      : widget.controller.timelineLevel ==
                                VimshottariLevel.pd &&
                            widget.controller.current != null
                      ? 'WITHIN ${copy.planet(widget.controller.current!.antardasha.lord).toUpperCase()} ANTARDASHA'
                      : 'Planetary Timing Cycles',
                  style: _S.body,
                ),
                const SizedBox(height: 22),
                _ActivePeriods(current: widget.controller.current),
                if (insightContext?.currentPhase case final phase?) ...[
                  const SizedBox(height: 20),
                  _CurrentPhase(phase: phase),
                ],
                const SizedBox(height: 22),
                _OverviewTimeline(
                  onViewMahadasha: () => context.push('/vimshottari/mahadasha'),
                ),
                if (insightContext?.nextTransition case final transition?) ...[
                  const SizedBox(height: 20),
                  _NextTransition(transition: transition),
                ],
                if (insightContext?.careerRelevance case final relevance?) ...[
                  const SizedBox(height: 20),
                  _CareerRelevance(
                    relevance: relevance,
                    onSeeCareerTiming: () => context.go('/readings'),
                  ),
                ],
                if (insightContext?.classicalContext case final classical?) ...[
                  const SizedBox(height: 20),
                  _ClassicalContext(context: classical),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

// ignore: unused_element
class _AntardashaTimeline extends StatelessWidget {
  const _AntardashaTimeline({required this.controller});
  final VimshottariController controller;
  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    final current = controller.current;
    final timeline = controller.timeline;
    if (current == null || timeline == null) {
      return _Timeline(controller: controller);
    }
    final at = DateTime.parse(current.at).toUtc();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _DarkCard(
          emphasis: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('PARENT CYCLE', style: _S.eyebrow),
              const SizedBox(height: 8),
              Text(
                '${copy.planet(current.mahadasha.lord)} Mahadasha',
                style: _S.cardTitle,
              ),
              Text(
                '${_date(current.mahadasha.startUtc)} — ${_date(current.mahadasha.endUtc)}',
                style: _S.body,
              ),
              const Divider(color: Color(0x335E4A87), height: 22),
              Text(
                'Currently in ${copy.planet(current.antardasha.lord)} Antardasha',
                style: _S.gold,
              ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        const Text('ANTARDASHA SEQUENCE', style: _S.eyebrow),
        const SizedBox(height: 10),
        for (final period in timeline.periods)
          _AntardashaPeriod(
            period: period,
            current: current.antardasha,
            at: at,
            pratyantar: current.pratyantardasha,
          ),
      ],
    );
  }
}

// ignore: unused_element
class _PratyantarTimeline extends StatelessWidget {
  const _PratyantarTimeline({required this.controller});
  final VimshottariController controller;
  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    final current = controller.current;
    final timeline = controller.timeline;
    if (current == null || timeline == null) {
      return _Timeline(controller: controller);
    }
    final at = DateTime.parse(current.at).toUtc();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _DarkCard(
          emphasis: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('PARENT CYCLE CONTEXT', style: _S.eyebrow),
              const SizedBox(height: 8),
              Text(
                '${copy.planet(current.mahadasha.lord)} Mahadasha',
                style: _S.cardTitle,
              ),
              Text(
                '${_date(current.mahadasha.startUtc)} — ${_date(current.mahadasha.endUtc)}',
                style: _S.body,
              ),
              const Divider(color: Color(0x335E4A87), height: 20),
              Text(
                '${copy.planet(current.antardasha.lord)} Antardasha',
                style: _S.cardTitle,
              ),
              Text(
                '${_date(current.antardasha.startUtc)} — ${_date(current.antardasha.endUtc)}',
                style: _S.body,
              ),
              const SizedBox(height: 8),
              Text(
                'You are currently in ${copy.planet(current.pratyantardasha.lord)} Pratyantar',
                style: _S.gold,
              ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        const Text('PRATYANTAR SEQUENCE', style: _S.eyebrow),
        const SizedBox(height: 10),
        for (final p in timeline.periods)
          _PratyantarPeriod(
            period: p,
            current: current.pratyantardasha,
            at: at,
          ),
      ],
    );
  }
}

class _PratyantarPeriod extends StatelessWidget {
  const _PratyantarPeriod({
    required this.period,
    required this.current,
    required this.at,
  });
  final DashaPeriod period, current;
  final DateTime at;
  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    final currentPeriod =
        period.lord == current.lord &&
        period.start == current.start &&
        period.end == current.end;
    final status = currentPeriod
        ? 'CURRENT PERIOD'
        : period.endUtc.isBefore(at)
        ? 'COMPLETED'
        : period.startUtc.isAfter(at)
        ? 'UPCOMING'
        : 'CURRENT PERIOD';
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 12,
            height: 12,
            margin: const EdgeInsets.only(top: 18, right: 10),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: currentPeriod ? _C.gold : _C.slate,
            ),
          ),
          Expanded(
            child: InkWell(
              onTap: () => context.push(
                '/vimshottari/period-insight?pratyantarStart=${Uri.encodeComponent(period.start)}',
              ),
              child: _DarkCard(
                emphasis: currentPeriod,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${copy.planet(period.lord)} Pratyantar',
                            style: _S.cardTitle,
                          ),
                        ),
                        _Chip(status),
                      ],
                    ),
                    Text(
                      '${_date(period.startUtc)} — ${_date(period.endUtc)}',
                      style: _S.body,
                    ),
                    if (currentPeriod) ...[
                      const SizedBox(height: 10),
                      _Progress(period: period, at: at),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AntardashaPeriod extends StatelessWidget {
  const _AntardashaPeriod({
    required this.period,
    required this.current,
    required this.at,
    required this.pratyantar,
  });
  final DashaPeriod period, current, pratyantar;
  final DateTime at;
  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    final isCurrent =
        period.lord == current.lord &&
        period.start == current.start &&
        period.end == current.end;
    final status = isCurrent
        ? 'CURRENT'
        : period.endUtc.isBefore(at)
        ? 'COMPLETED'
        : 'UPCOMING';
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 12,
            height: 12,
            margin: const EdgeInsets.only(top: 18, right: 10),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isCurrent ? _C.gold : _C.slate,
            ),
          ),
          Expanded(
            child: _DarkCard(
              emphasis: isCurrent,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${copy.planet(period.lord)} Antardasha',
                          style: _S.cardTitle,
                        ),
                      ),
                      _Chip(status),
                    ],
                  ),
                  Text(
                    '${_date(period.startUtc)} — ${_date(period.endUtc)}',
                    style: _S.body,
                  ),
                  if (isCurrent) ...[
                    const SizedBox(height: 12),
                    const Text('ANTARDASHA LIFECYCLE', style: _S.eyebrow),
                    _Progress(period: period, at: at),
                    const SizedBox(height: 6),
                    Text(
                      'Active window: ${copy.planet(pratyantar.lord)} Pratyantar',
                      style: _S.gold,
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

class _ActivePeriods extends StatelessWidget {
  const _ActivePeriods({required this.current});
  final VimshottariCurrent? current;
  @override
  Widget build(BuildContext context) {
    if (current == null) {
      return const _DarkCard(
        child: Center(child: CircularProgressIndicator(color: _C.gold)),
      );
    }
    return _DarkCard(
      emphasis: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('ACTIVE PLANETARY PERIOD', style: _S.eyebrow),
          const SizedBox(height: 12),
          _Period('Mahadasha', current!.mahadasha),
          _Period('Antardasha', current!.antardasha),
          InkWell(
            onTap: () => context.push(
              '/vimshottari/period-insight?pratyantarStart=${Uri.encodeComponent(current!.pratyantardasha.start)}',
            ),
            child: _Period(
              'Pratyantar · Active Now',
              current!.pratyantardasha,
              active: true,
            ),
          ),
          const SizedBox(height: 10),
          _Progress(
            period: current!.pratyantardasha,
            at: DateTime.parse(current!.at).toUtc(),
          ),
        ],
      ),
    );
  }
}

class _OverviewTimeline extends StatelessWidget {
  const _OverviewTimeline({required this.onViewMahadasha});
  final VoidCallback onViewMahadasha;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Text('YOUR DASHA TIMELINE', style: _S.eyebrow),
      const SizedBox(height: 10),
      SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          onPressed: onViewMahadasha,
          icon: const Icon(Icons.timeline_outlined),
          label: const Text('View Mahadasha Timeline'),
          style: OutlinedButton.styleFrom(
            foregroundColor: _C.gold,
            side: const BorderSide(color: _C.gold),
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
        ),
      ),
    ],
  );
}

class _CurrentPhase extends StatelessWidget {
  const _CurrentPhase({required this.phase});
  final DashaCurrentPhase phase;

  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('YOUR CURRENT PHASE', style: _S.eyebrow),
        const SizedBox(height: 10),
        _DarkCard(
          emphasis: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '${_timingLevelLabel(phase.timingLevel)} · ${copy.planet(phase.lord)}',
                      style: _S.cardTitle,
                    ),
                  ),
                  _StatusChip(phase.status),
                ],
              ),
              const SizedBox(height: 8),
              Text(_presentation(context, phase.presentation), style: _S.body),
            ],
          ),
        ),
      ],
    );
  }
}

class _NextTransition extends StatelessWidget {
  const _NextTransition({required this.transition});
  final DashaNextTransition transition;

  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('WHAT COMES NEXT', style: _S.eyebrow),
        const SizedBox(height: 10),
        _DarkCard(
          child: Row(
            children: [
              const Icon(Icons.schedule_outlined, color: _C.gold),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'NEXT ${_timingLevelLabel(transition.level).toUpperCase()}',
                      style: _S.body,
                    ),
                    Text(copy.planet(transition.lord), style: _S.cardTitle),
                    Text(
                      'Starts ${_date(DateTime.parse(transition.starts).toUtc())}',
                      style: _S.body,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _CareerRelevance extends StatelessWidget {
  const _CareerRelevance({
    required this.relevance,
    required this.onSeeCareerTiming,
  });
  final DashaCareerRelevance relevance;
  final VoidCallback onSeeCareerTiming;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Text('CAREER RELEVANCE', style: _S.eyebrow),
      const SizedBox(height: 10),
      _DarkCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.work_outline, color: _C.gold, size: 19),
                const SizedBox(width: 8),
                _StatusChip(relevance.status),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              _presentation(context, relevance.presentation),
              style: _S.body,
            ),
            const SizedBox(height: 6),
            TextButton.icon(
              onPressed: onSeeCareerTiming,
              icon: const Icon(Icons.arrow_forward, size: 16),
              label: const Text('See Career Timing'),
              style: TextButton.styleFrom(foregroundColor: _C.gold),
            ),
          ],
        ),
      ),
    ],
  );
}

class _ClassicalContext extends StatelessWidget {
  const _ClassicalContext({required this.context});
  final DashaClassicalContext context;

  @override
  Widget build(BuildContext buildContext) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Text('CLASSICAL CONTEXT', style: _S.eyebrow),
      const SizedBox(height: 10),
      _DarkCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.auto_awesome_outlined,
                  color: _C.gold,
                  size: 19,
                ),
                const SizedBox(width: 8),
                _StatusChip(context.status),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              _presentation(buildContext, context.presentation),
              style: _S.body,
            ),
            const SizedBox(height: 8),
            Text(_presentation(buildContext, context.caution), style: _S.muted),
          ],
        ),
      ),
    ],
  );
}

class _StatusChip extends StatelessWidget {
  const _StatusChip(this.status);
  final String status;

  @override
  Widget build(BuildContext context) => _Chip(_statusLabel(status));
}

String _presentation(
  BuildContext context,
  DashaPresentationCopy presentation,
) => AstrologyPresentationCopy.of(context).isHinglish
    ? presentation.hinglish
    : presentation.english;

String _statusLabel(String status) => switch (status) {
  'SUPPORTED' => 'Supported',
  'MIXED' => 'Mixed evidence',
  'CONTRADICTED' => 'Not consistently supported',
  'INSUFFICIENT_EVIDENCE' => 'Limited evidence',
  _ => 'Status unavailable',
};

String _timingLevelLabel(String level) => switch (level) {
  'MAHADASHA' => 'Mahadasha',
  'ANTARDASHA' => 'Antardasha',
  'PRATYANTAR' => 'Pratyantar',
  _ => level,
};

class _Period extends StatelessWidget {
  const _Period(this.label, this.period, {this.active = false});
  final String label;
  final DashaPeriod period;
  final bool active;
  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        color: active ? _C.violet : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: active ? const Color(0x77C5A059) : const Color(0x335E4A87),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: _S.body),
                Text(copy.planet(period.lord), style: _S.cardTitle),
                Text(
                  '${_date(period.startUtc)} — ${_date(period.endUtc)}',
                  style: _S.body,
                ),
              ],
            ),
          ),
          if (active) const _Chip('ACTIVE'),
        ],
      ),
    );
  }
}

class _Progress extends StatelessWidget {
  const _Progress({required this.period, required this.at});
  final DashaPeriod period;
  final DateTime at;
  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    final total = period.endUtc.difference(period.startUtc).inMilliseconds;
    final elapsed = at.difference(period.startUtc).inMilliseconds;
    final progress = total <= 0 ? 0.0 : (elapsed / total).clamp(0.0, 1.0);
    final remaining = period.endUtc.difference(at).inDays;
    final remainingDays = remaining < 0 ? 0 : remaining;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('${copy.planet(period.lord)} timing progress', style: _S.gold),
        const SizedBox(height: 6),
        LinearProgressIndicator(
          value: progress,
          backgroundColor: _C.abyss,
          color: _C.gold,
        ),
        const SizedBox(height: 5),
        Text(
          '$remainingDays days remaining · Ends ${_date(period.endUtc)}',
          style: _S.body,
        ),
      ],
    );
  }
}

// ignore: unused_element
class _Selectors extends StatelessWidget {
  const _Selectors({required this.controller});
  final VimshottariController controller;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Text('YOUR DASHA TIMELINE', style: _S.eyebrow),
      const SizedBox(height: 10),
      SegmentedButton<VimshottariLevel>(
        segments: const [
          ButtonSegment(value: VimshottariLevel.md, label: Text('Mahadasha')),
          ButtonSegment(value: VimshottariLevel.ad, label: Text('Antardasha')),
          ButtonSegment(
            value: VimshottariLevel.pd,
            label: Text('Pratyantardasha'),
          ),
        ],
        selected: {controller.timelineLevel},
        onSelectionChanged: (v) => controller.loadTimeline(level: v.first),
        style: _segment,
      ),
      const SizedBox(height: 10),
      SegmentedButton<int>(
        segments: const [
          ButtonSegment(value: 365, label: Text('1 year')),
          ButtonSegment(value: 1095, label: Text('3 years')),
          ButtonSegment(value: 1825, label: Text('5 years')),
        ],
        selected: {controller.timelineWindowDays},
        onSelectionChanged: (v) => controller.loadTimeline(windowDays: v.first),
        style: _segment,
      ),
    ],
  );
}

final _segment = ButtonStyle(
  foregroundColor: const WidgetStatePropertyAll(_C.alabaster),
  backgroundColor: const WidgetStatePropertyAll(_C.violet),
  side: const WidgetStatePropertyAll(BorderSide(color: Color(0x55C5A059))),
);

class _Timeline extends StatelessWidget {
  const _Timeline({required this.controller});
  final VimshottariController controller;
  @override
  Widget build(BuildContext context) {
    final timeline = controller.timeline;
    if (controller.timelineState == VimshottariLoadState.loading ||
        controller.timelineState == VimshottariLoadState.initial) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(28),
          child: CircularProgressIndicator(color: _C.gold),
        ),
      );
    }
    if (timeline == null) {
      return _DarkCard(
        child: Text(
          'Vimshottari timeline is unavailable right now.',
          style: _S.body,
        ),
      );
    }
    return _DarkCard(
      child: Column(
        children: [
          for (final p in timeline.periods)
            _Period(
              '${timeline.level.apiValue.toUpperCase()} period',
              p,
              active: _contains(p, controller.current),
            ),
        ],
      ),
    );
  }
}

bool _contains(DashaPeriod period, VimshottariCurrent? current) {
  final p = current == null
      ? null
      : switch (current.mahadasha) {
          final d when d.lord == period.lord => d,
          _ => null,
        };
  return p != null;
}

class _DarkCard extends StatelessWidget {
  const _DarkCard({required this.child, this.emphasis = false});
  final Widget child;
  final bool emphasis;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: emphasis ? _C.violet : _C.abyss,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(
        color: emphasis ? const Color(0x77C5A059) : const Color(0x335E4A87),
      ),
    ),
    child: child,
  );
}

class _Chip extends StatelessWidget {
  const _Chip(this.label);
  final String label;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
    decoration: BoxDecoration(
      color: const Color(0x332F2413),
      borderRadius: BorderRadius.circular(99),
      border: Border.all(color: const Color(0x66C5A059)),
    ),
    child: Text(label, style: _S.chip),
  );
}

class _ProfilePill extends StatelessWidget {
  const _ProfilePill(this.label);
  final String label;
  @override
  Widget build(BuildContext context) => Container(
    constraints: const BoxConstraints(maxWidth: 140),
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
    decoration: BoxDecoration(
      color: _C.abyss,
      borderRadius: BorderRadius.circular(99),
      border: Border.all(color: const Color(0x55C5A059)),
    ),
    child: Text(
      label,
      overflow: TextOverflow.ellipsis,
      style: const TextStyle(color: _C.alabaster, fontSize: 12),
    ),
  );
}

String _date(DateTime d) => DateFormat('d MMM yyyy').format(d.toLocal());

abstract final class _C {
  static const midnight = Color(0xFF0B071B),
      abyss = Color(0xFF120D29),
      violet = Color(0xFF1B1234),
      alabaster = Color(0xFFFAF7F2),
      slate = Color(0xFF9E9AA9),
      gold = Color(0xFFC5A059);
}

abstract final class _S {
  static const eyebrow = TextStyle(
        color: _C.gold,
        fontSize: 10,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.6,
      ),
      title = TextStyle(
        color: _C.alabaster,
        fontFamily: 'EBGaramond',
        fontSize: 32,
        fontWeight: FontWeight.w600,
      ),
      body = TextStyle(color: _C.slate, fontSize: 12.5, height: 1.35),
      cardTitle = TextStyle(
        color: _C.alabaster,
        fontSize: 17,
        fontWeight: FontWeight.w600,
      ),
      gold = TextStyle(
        color: _C.gold,
        fontSize: 12,
        fontWeight: FontWeight.w600,
      ),
      muted = TextStyle(color: _C.slate, fontSize: 11.5, height: 1.35),
      chip = TextStyle(
        color: _C.gold,
        fontSize: 9,
        fontWeight: FontWeight.w700,
        letterSpacing: .8,
      );
}
