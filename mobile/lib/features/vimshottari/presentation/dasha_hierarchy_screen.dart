// ignore_for_file: curly_braces_in_flow_control_structures

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../profiles/profile_controller.dart';
import '../../readings/astrology_presentation_copy.dart';
import 'dasha_back_button.dart';
import '../domain/vimshottari.dart';
import '../vimshottari_controller.dart';

enum DashaHierarchyLevel { mahadasha, antardasha, pratyantar }

class DashaHierarchyScreen extends StatefulWidget {
  const DashaHierarchyScreen({
    super.key,
    required this.profileController,
    required this.controller,
    required this.level,
    this.mahadashaStart,
    this.antardashaStart,
  });
  final ProfileController profileController;
  final VimshottariController controller;
  final DashaHierarchyLevel level;
  final DateTime? mahadashaStart, antardashaStart;
  @override
  State<DashaHierarchyScreen> createState() => _DashaHierarchyScreenState();
}

class _DashaHierarchyScreenState extends State<DashaHierarchyScreen> {
  late Future<DashaScopedTimeline?> _future;
  final _scrollController = ScrollController();
  final _currentRowKey = GlobalKey();
  bool _didAutoScroll = false;
  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<DashaScopedTimeline?> _load() => switch (widget.level) {
    DashaHierarchyLevel.mahadasha => widget.controller.loadMahadashaTimeline(),
    DashaHierarchyLevel.antardasha => widget.controller.loadAntardashaTimeline(
      widget.mahadashaStart!,
    ),
    DashaHierarchyLevel.pratyantar => widget.controller.loadPratyantarTimeline(
      widget.mahadashaStart!,
      widget.antardashaStart!,
    ),
  };

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _revealCurrent(DashaScopedTimeline timeline) {
    if (_didAutoScroll || !timeline.periods.any((p) => p.status == 'CURRENT')) {
      return;
    }
    _didAutoScroll = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final context = _currentRowKey.currentContext;
      if (mounted && context != null) {
        Scrollable.ensureVisible(
          context,
          alignment: .2,
          duration: Duration.zero,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: _C.midnight,
    body: SafeArea(
      child: FutureBuilder<DashaScopedTimeline?>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done)
            return const Center(
              child: CircularProgressIndicator(color: _C.gold),
            );
          final timeline = snapshot.data;
          if (timeline == null)
            return Center(
              child: TextButton(
                onPressed: () => setState(() => _future = _load()),
                child: const Text('Retry'),
              ),
            );
          _revealCurrent(timeline);
          return _Body(
            timeline: timeline,
            level: widget.level,
            scrollController: _scrollController,
            currentRowKey: _currentRowKey,
            backButtonKey: ValueKey(switch (widget.level) {
              DashaHierarchyLevel.mahadasha => 'mahadasha_timeline_back_button',
              DashaHierarchyLevel.antardasha =>
                'antardasha_timeline_back_button',
              DashaHierarchyLevel.pratyantar =>
                'pratyantar_timeline_back_button',
            }),
            onTap: (period) {
              switch (widget.level) {
                case DashaHierarchyLevel.mahadasha:
                  context.push(
                    '/vimshottari/antardasha?mahadashaStart=${Uri.encodeComponent(period.start)}',
                  );
                case DashaHierarchyLevel.antardasha:
                  context.push(
                    '/vimshottari/pratyantar?mahadashaStart=${Uri.encodeComponent(widget.mahadashaStart!.toIso8601String())}&antardashaStart=${Uri.encodeComponent(period.start)}',
                  );
                case DashaHierarchyLevel.pratyantar:
                  context.push(
                    '/vimshottari/period-insight?pratyantarStart=${Uri.encodeComponent(period.start)}',
                  );
              }
            },
          );
        },
      ),
    ),
  );
}

class _Body extends StatelessWidget {
  const _Body({
    required this.timeline,
    required this.level,
    required this.scrollController,
    required this.currentRowKey,
    required this.backButtonKey,
    required this.onTap,
  });
  final DashaScopedTimeline timeline;
  final DashaHierarchyLevel level;
  final ScrollController scrollController;
  final GlobalKey currentRowKey;
  final ValueKey<String> backButtonKey;
  final ValueChanged<DashaTimelinePeriod> onTap;
  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    final heading = switch (level) {
      DashaHierarchyLevel.mahadasha => 'MAHADASHA TIMELINE',
      DashaHierarchyLevel.antardasha => 'ANTARDASHA TIMELINE',
      DashaHierarchyLevel.pratyantar => 'PRATYANTAR TIMELINE',
    };
    final parent = timeline.parent ?? timeline.antardashaParent;
    return ListView(
      controller: scrollController,
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: DashaBackButton(
            key: backButtonKey,
            onPressed: () => Navigator.of(context).maybePop(),
          ),
        ),
        const SizedBox(height: 12),
        Text(heading, style: _S.eyebrow),
        const SizedBox(height: 6),
        Text(
          level == DashaHierarchyLevel.mahadasha
              ? 'Vimshottari major periods'
              : parent == null
              ? 'Vimshottari timeline'
              : 'Within ${copy.planet(parent.lord)} ${_levelLabel(parent.level)}',
          style: _S.subtitle,
        ),
        if (timeline.parent != null || timeline.parentsOrNull != null) ...[
          const SizedBox(height: 14),
          _ParentCard(timeline: timeline),
        ],
        const SizedBox(height: 18),
        Text(switch (level) {
          DashaHierarchyLevel.mahadasha => 'MAHADASHA SEQUENCE',
          DashaHierarchyLevel.antardasha => 'ANTARDASHA SEQUENCE',
          DashaHierarchyLevel.pratyantar => 'PRATYANTAR SEQUENCE',
        }, style: _S.eyebrow),
        const SizedBox(height: 10),
        for (final period in timeline.periods)
          _Row(
            key: period.status == 'CURRENT' ? currentRowKey : null,
            period: period,
            label:
                '${copy.planet(period.lord)} ${period.level[0]}${period.level.substring(1).toLowerCase()}',
            onTap: () => onTap(period),
          ),
      ],
    );
  }
}

extension on DashaScopedTimeline {
  Object? get parentsOrNull => mahadashaParent;
}

class _ParentCard extends StatelessWidget {
  const _ParentCard({required this.timeline});
  final DashaScopedTimeline timeline;
  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    final ps = [
      if (timeline.parent != null) timeline.parent!,
      if (timeline.mahadashaParent != null) timeline.mahadashaParent!,
      if (timeline.antardashaParent != null) timeline.antardashaParent!,
    ];
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: _box(true),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('PARENT CYCLE', style: _S.eyebrow),
          const SizedBox(height: 6),
          for (final p in ps)
            Padding(
              padding: const EdgeInsets.only(bottom: 5),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${copy.planet(p.lord)} ${_levelLabel(p.level)}',
                    style: _S.card,
                  ),
                  Text(
                    '${_date(p.startUtc)} — ${_date(p.endUtc)}',
                    style: _S.body,
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({
    super.key,
    required this.period,
    required this.label,
    required this.onTap,
  });
  final DashaTimelinePeriod period;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: '$label ${period.status}',
    child: Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(15),
          decoration: _box(period.status == 'CURRENT'),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: _S.card),
                    const SizedBox(height: 4),
                    Text(
                      '${_date(period.startUtc)} — ${_date(period.endUtc)}',
                      style: _S.body,
                    ),
                  ],
                ),
              ),
              _Badge(period.status),
              const SizedBox(width: 8),
              const Icon(Icons.chevron_right, color: _C.gold),
            ],
          ),
        ),
      ),
    ),
  );
}

class _Badge extends StatelessWidget {
  const _Badge(this.value);
  final String value;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(99),
      border: Border.all(color: _C.gold),
    ),
    child: Text(value, style: _S.badge),
  );
}

String _levelLabel(String value) =>
    '${value[0]}${value.substring(1).toLowerCase()}';

BoxDecoration _box(bool current) => BoxDecoration(
  color: current ? _C.violet : _C.abyss,
  borderRadius: BorderRadius.circular(14),
  border: Border.all(
    color: current ? const Color(0x99C5A059) : const Color(0x335E4A87),
  ),
);
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
        letterSpacing: 1.4,
      ),
      subtitle = TextStyle(color: _C.slate, fontSize: 15, height: 1.3),
      card = TextStyle(
        color: _C.alabaster,
        fontSize: 16,
        fontWeight: FontWeight.w600,
      ),
      body = TextStyle(color: _C.slate, fontSize: 13),
      badge = TextStyle(
        color: _C.alabaster,
        fontSize: 10,
        fontWeight: FontWeight.w700,
      );
}
