import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../profiles/profile_controller.dart';
import '../../readings/astrology_presentation_copy.dart';
import 'dasha_back_button.dart';
import 'dasha_status_view.dart';
import '../domain/vimshottari.dart';
import '../vimshottari_controller.dart';

class DashaPeriodInsightScreen extends StatefulWidget {
  const DashaPeriodInsightScreen({
    super.key,
    required this.profileController,
    required this.controller,
    required this.pratyantarStart,
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now;
  final ProfileController profileController;
  final VimshottariController controller;
  final DateTime pratyantarStart;
  final DateTime Function() _now;

  @override
  State<DashaPeriodInsightScreen> createState() =>
      _DashaPeriodInsightScreenState();
}

class _DashaPeriodInsightScreenState extends State<DashaPeriodInsightScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.controller.loadPeriodInsight(widget.pratyantarStart);
    });
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.controller,
    builder: (_, _) {
      final detail = widget.controller.periodInsight;
      final failed = widget.controller.periodInsightError != null;
      return Scaffold(
        backgroundColor: _C.midnight,
        body: SafeArea(
          child: detail != null
              ? _Detail(detail: detail, now: widget._now().toUtc())
              : failed
              ? DashaStatusView.error(
                  title: 'Dasha unavailable',
                  body: 'We couldn\'t load this Dasha period right now.',
                  actionLabel: 'Retry',
                  onAction: () => widget.controller.loadPeriodInsight(
                    widget.pratyantarStart,
                  ),
                )
              : const DashaStatusView.loading(),
        ),
      );
    },
  );
}

class _Detail extends StatelessWidget {
  const _Detail({required this.detail, required this.now});
  final DashaPeriodInsight detail;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    final p = detail.pratyantar;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: DashaBackButton(
            key: const ValueKey('dasha_period_detail_back_button'),
            onPressed: () => Navigator.of(context).maybePop(),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          '${copy.planet(p.lord).toUpperCase()} PRATYANTAR',
          style: _S.eyebrow,
        ),
        const SizedBox(height: 6),
        Text(
          'Within ${copy.planet(detail.antardasha.lord)} Antardasha',
          style: _S.title,
        ),
        const SizedBox(height: 12),
        _Breadcrumb(detail: detail),
        const SizedBox(height: 20),
        _PeriodHero(period: p, status: detail.status, now: now),
        const SizedBox(height: 20),
        _Section(
          title: 'WHAT THIS PERIOD MEANS',
          child: Text(
            copy.isHinglish
                ? detail.presentation.hinglish
                : detail.presentation.english,
            style: _S.body,
          ),
        ),
        if (_hasFacts(detail)) ...[
          const SizedBox(height: 20),
          _Facts(detail: detail),
        ],
        if (detail.careerRelevance case final value?) ...[
          const SizedBox(height: 20),
          _ContextCard(
            title: 'CAREER RELEVANCE',
            status: value.status,
            body: copy.isHinglish
                ? value.presentation.hinglish
                : value.presentation.english,
            action: TextButton.icon(
              onPressed: () => context.go('/readings'),
              icon: const Icon(Icons.timeline_outlined),
              label: const Text('See Career Timing'),
            ),
          ),
        ],
        const SizedBox(height: 20),
        _TechnicalContext(detail: detail),
        if (detail.nextPeriod case final next?) ...[
          const SizedBox(height: 20),
          _NextPeriod(next: next),
        ],
      ],
    );
  }
}

bool _hasFacts(DashaPeriodInsight detail) =>
    detail.natalFacts.isNotEmpty ||
    detail.stateFacts.isNotEmpty ||
    detail.relationshipFacts.isNotEmpty ||
    detail.d10Facts.isNotEmpty;

class _Breadcrumb extends StatelessWidget {
  const _Breadcrumb({required this.detail});
  final DashaPeriodInsight detail;
  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    return Wrap(
      spacing: 4,
      runSpacing: 2,
      children: [
        Text(
          '${copy.planet(detail.mahadasha.lord)} Mahadasha',
          style: _S.breadcrumb,
        ),
        const Text('→', style: _S.breadcrumb),
        Text(
          '${copy.planet(detail.antardasha.lord)} Antardasha',
          style: _S.breadcrumb,
        ),
        const Text('→', style: _S.breadcrumb),
        Text(
          '${copy.planet(detail.pratyantar.lord)} Pratyantar',
          style: _S.breadcrumb,
        ),
      ],
    );
  }
}

class _PeriodHero extends StatelessWidget {
  const _PeriodHero({
    required this.period,
    required this.status,
    required this.now,
  });
  final DashaPeriod period;
  final String status;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    final current = status == 'CURRENT';
    final upcoming = status == 'UPCOMING';
    final start = period.startUtc;
    final end = period.endUtc;
    final total = end.difference(start).inMilliseconds;
    final elapsed = now.difference(start).inMilliseconds;
    final progress = total <= 0 ? 0.0 : (elapsed / total).clamp(0.0, 1.0);
    final remaining = end.difference(now).inDays.clamp(0, 1 << 30);
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: _box(true),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _StatusChip(status),
          const SizedBox(height: 12),
          const Text('PRATYANTAR', style: _S.eyebrow),
          const SizedBox(height: 6),
          Text(copy.planet(period.lord), style: _S.hero),
          const SizedBox(height: 6),
          Text(
            upcoming
                ? 'Starts ${_date(start)}\nEnds ${_date(end)}'
                : '${_date(start)} — ${_date(end)}',
            style: _S.body,
          ),
          if (current) ...[
            const SizedBox(height: 16),
            Semantics(
              label: 'Current period progress',
              value:
                  '${(progress * 100).round()} percent; $remaining days remaining',
              child: LinearProgressIndicator(
                value: progress,
                backgroundColor: _C.abyss,
                color: _C.gold,
                minHeight: 7,
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            const SizedBox(height: 8),
            Text('$remaining days remaining', style: _S.card),
            const SizedBox(height: 4),
            Text(
              'Started ${_date(start)} · Today · Ends ${_date(end)}',
              style: _S.body,
            ),
          ],
        ],
      ),
    );
  }
}

class _Facts extends StatelessWidget {
  const _Facts({required this.detail});
  final DashaPeriodInsight detail;

  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('WHY THIS PERIOD MATTERS', style: _S.eyebrow),
        const SizedBox(height: 10),
        if (detail.natalFacts.isNotEmpty)
          _FactGroup(
            title: 'NATAL CONTEXT',
            rows: detail.natalFacts.map((fact) {
              final value = fact.values;
              final owns = (value['ownsHouses'] as List<dynamic>).cast<int>();
              return _FactRow(
                copy.planet(value['planet'] as String),
                '${copy.house(value['house'] as int)} · ${value['sign'] as String}',
                owns.isEmpty
                    ? null
                    : 'Lord of ${owns.map(copy.house).join(', ')}',
              );
            }).toList(),
          ),
        if (detail.stateFacts.isNotEmpty) ...[
          const SizedBox(height: 10),
          _FactGroup(
            title: 'PLANETARY STATES',
            rows: detail.stateFacts.map((fact) {
              final value = fact.values;
              return _FactRow(
                copy.planet(value['planet'] as String),
                (value['states'] as List<dynamic>)
                    .cast<String>()
                    .map(copy.state)
                    .join(' · '),
                null,
              );
            }).toList(),
          ),
        ],
        if (detail.relationshipFacts.isNotEmpty) ...[
          const SizedBox(height: 10),
          _FactGroup(
            title: 'PLANETARY RELATIONSHIPS',
            rows: detail.relationshipFacts.map((fact) {
              final value = fact.values;
              return _FactRow(
                '${copy.planet(value['from'] as String)} → ${copy.planet(value['to'] as String)}',
                _label(value['relationship'] as String),
                null,
              );
            }).toList(),
          ),
        ],
        if (detail.d10Facts.isNotEmpty) ...[
          const SizedBox(height: 10),
          _FactGroup(
            title: 'D10 CAREER CHART',
            rows: detail.d10Facts.map((fact) {
              final value = fact.values;
              return _FactRow(
                copy.planet(value['planet'] as String),
                'D10 · ${copy.house(value['house'] as int)} · ${value['sign'] as String}',
                null,
              );
            }).toList(),
          ),
        ],
      ],
    );
  }
}

class _TechnicalContext extends StatelessWidget {
  const _TechnicalContext({required this.detail});
  final DashaPeriodInsight detail;
  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    return Container(
      decoration: _box(false),
      child: Material(
        color: Colors.transparent,
        child: ExpansionTile(
          collapsedIconColor: _C.gold,
          iconColor: _C.gold,
          title: const Text('ASTROLOGY BEHIND THIS', style: _S.eyebrow),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          children: [
            Text(
              '${copy.planet(detail.mahadasha.lord)} Mahadasha → '
              '${copy.planet(detail.antardasha.lord)} Antardasha → '
              '${copy.planet(detail.pratyantar.lord)} Pratyantar',
              style: _S.body,
            ),
            if (detail.calibrationContext case final context?) ...[
              const SizedBox(height: 14),
              _ContextCopy(title: 'CAREER HISTORY CONTEXT', context: context),
            ],
            if (detail.classicalContext case final context?) ...[
              const SizedBox(height: 14),
              _ContextCopy(title: 'CLASSICAL CONTEXT', context: context),
            ],
          ],
        ),
      ),
    );
  }
}

class _ContextCopy extends StatelessWidget {
  const _ContextCopy({required this.title, required this.context});
  final String title;
  final DashaOptionalContext context;
  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: _S.eyebrow),
        const SizedBox(height: 6),
        _StatusChip(this.context.status),
        const SizedBox(height: 8),
        Text(
          copy.isHinglish
              ? this.context.presentation.hinglish
              : this.context.presentation.english,
          style: _S.body,
        ),
      ],
    );
  }
}

class _NextPeriod extends StatelessWidget {
  const _NextPeriod({required this.next});
  final DashaPeriod next;
  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    return InkWell(
      onTap: () => context.push(
        '/vimshottari/period-insight?pratyantarStart=${Uri.encodeComponent(next.start)}',
      ),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: _box(false),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('WHAT COMES NEXT', style: _S.eyebrow),
                  const SizedBox(height: 8),
                  const Text('NEXT PRATYANTAR', style: _S.body),
                  Text(copy.planet(next.lord), style: _S.card),
                  Text(
                    '${_date(next.startUtc)} — ${_date(next.endUtc)}',
                    style: _S.body,
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: _C.gold),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.child});
  final String title;
  final Widget child;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(title, style: _S.eyebrow),
      const SizedBox(height: 8),
      Container(
        padding: const EdgeInsets.all(16),
        decoration: _box(false),
        child: child,
      ),
    ],
  );
}

class _ContextCard extends StatelessWidget {
  const _ContextCard({
    required this.title,
    required this.status,
    required this.body,
    required this.action,
  });
  final String title;
  final String status;
  final String body;
  final Widget action;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: _box(false),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: _S.eyebrow),
        const SizedBox(height: 8),
        _StatusChip(status),
        const SizedBox(height: 10),
        Text(body, style: _S.body),
        const SizedBox(height: 6),
        action,
      ],
    ),
  );
}

class _FactGroup extends StatelessWidget {
  const _FactGroup({required this.title, required this.rows});
  final String title;
  final List<_FactRow> rows;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: _box(false),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: _S.eyebrow),
        const SizedBox(height: 8),
        for (final row in rows) row,
      ],
    ),
  );
}

class _FactRow extends StatelessWidget {
  const _FactRow(this.title, this.detail, this.supporting);
  final String title;
  final String detail;
  final String? supporting;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: _S.card),
        Text(detail, style: _S.body),
        if (supporting != null) Text(supporting!, style: _S.body),
      ],
    ),
  );
}

class _StatusChip extends StatelessWidget {
  const _StatusChip(this.status);
  final String status;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(
      border: Border.all(color: _C.gold),
      borderRadius: BorderRadius.circular(99),
    ),
    child: Text(_statusLabel(status), style: _S.badge),
  );
}

String _statusLabel(String value) => switch (value) {
  'PAST' => 'COMPLETED',
  'SUPPORTED' => 'Supported',
  'MIXED' => 'Mixed evidence',
  'CONTRADICTED' => 'Not consistently supported',
  'INSUFFICIENT_EVIDENCE' => 'Limited evidence',
  _ => value,
};

String _label(String value) => value
    .toLowerCase()
    .split('_')
    .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
    .join(' ');
String _date(DateTime value) =>
    DateFormat('d MMM yyyy').format(value.toLocal());
BoxDecoration _box(bool emphasis) => BoxDecoration(
  color: emphasis ? _C.violet : _C.abyss,
  borderRadius: BorderRadius.circular(16),
  border: Border.all(
    color: emphasis ? const Color(0x99C5A059) : const Color(0x335E4A87),
  ),
);

abstract final class _C {
  static const midnight = Color(0xFF0B071B);
  static const abyss = Color(0xFF120D29);
  static const violet = Color(0xFF1B1234);
  static const alabaster = Color(0xFFFAF7F2);
  static const slate = Color(0xFF9E9AA9);
  static const gold = Color(0xFFC5A059);
}

abstract final class _S {
  static const eyebrow = TextStyle(
    color: _C.gold,
    fontSize: 10,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.5,
  );
  static const title = TextStyle(
    color: _C.alabaster,
    fontFamily: 'EB Garamond',
    fontSize: 30,
  );
  static const hero = TextStyle(
    color: _C.alabaster,
    fontFamily: 'EB Garamond',
    fontSize: 34,
  );
  static const card = TextStyle(
    color: _C.alabaster,
    fontSize: 16,
    fontWeight: FontWeight.w600,
  );
  static const body = TextStyle(color: _C.slate, fontSize: 13, height: 1.4);
  static const breadcrumb = TextStyle(
    color: _C.slate,
    fontSize: 12,
    height: 1.3,
  );
  static const badge = TextStyle(
    color: _C.alabaster,
    fontSize: 10,
    fontWeight: FontWeight.w700,
  );
}
