import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/formatters/customer_date.dart';
import '../domain/relationship_answer.dart';
import '../relationship_answer_controller.dart';
import '../../family_expansion/family_expansion_answer_controller.dart';

/// Presentation-only projection of the server-owned Relationship & Marriage V1
/// response. It never derives relationship states, dates, or marriage claims.
class RelationshipHubScreen extends StatefulWidget {
  const RelationshipHubScreen({
    super.key,
    required this.controller,
    required this.familyController,
  });

  final RelationshipAnswerController controller;
  final FamilyExpansionAnswerController familyController;

  @override
  State<RelationshipHubScreen> createState() => _RelationshipHubScreenState();
}

class _RelationshipHubScreenState extends State<RelationshipHubScreen> {
  bool _detailsOpen = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => widget.controller.load(),
    );
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => widget.familyController.load(),
    );
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: Listenable.merge([widget.controller, widget.familyController]),
    builder: (context, _) => Scaffold(
      backgroundColor: _RelationshipColors.background,
      appBar: AppBar(
        backgroundColor: _RelationshipColors.background,
        foregroundColor: _RelationshipColors.ivory,
        title: const Text('RELATIONSHIPS & FAMILY'),
      ),
      body: switch (widget.controller.state) {
        RelationshipAnswerLoadState.initial ||
        RelationshipAnswerLoadState.loading => const _Loading(),
        RelationshipAnswerLoadState.error => _Message(
          message: 'We couldn’t load your Relationship outlook right now.',
          action: 'Retry',
          onAction: () => widget.controller.load(force: true),
        ),
        RelationshipAnswerLoadState.loaded
            when widget.controller.answer!.premiumRequired =>
          _Message(
            message: 'Unlock personalized insights for this birth profile.',
            action: 'Unlock TaraVerse Premium',
            onAction: () => context.push('/premium'),
          ),
        RelationshipAnswerLoadState.loaded => _Result(
          answer: widget.controller.answer!,
          familyController: widget.familyController,
          detailsOpen: _detailsOpen,
          onToggleDetails: () => setState(() => _detailsOpen = !_detailsOpen),
        ),
      },
    ),
  );
}

class _Loading extends StatelessWidget {
  const _Loading();

  @override
  Widget build(BuildContext context) => const Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        CircularProgressIndicator(color: _RelationshipColors.turquoise),
        SizedBox(height: 16),
        Text(
          'Preparing your Relationship outlook…',
          style: _RelationshipText.body,
        ),
      ],
    ),
  );
}

class _Message extends StatelessWidget {
  const _Message({
    required this.message,
    required this.action,
    required this.onAction,
  });

  final String message;
  final String action;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            message,
            style: _RelationshipText.body,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          FilledButton(onPressed: onAction, child: Text(action)),
        ],
      ),
    ),
  );
}

class _Result extends StatelessWidget {
  const _Result({
    required this.answer,
    required this.familyController,
    required this.detailsOpen,
    required this.onToggleDetails,
  });

  final RelationshipAnswer answer;
  final FamilyExpansionAnswerController familyController;
  final bool detailsOpen;
  final VoidCallback onToggleDetails;

  @override
  Widget build(BuildContext context) {
    final window = answer.strongerWindow;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 36),
      children: [
        const Text('Your Relationship Outlook', style: _RelationshipText.title),
        const SizedBox(height: 16),
        _Card(
          children: [
            const _Heading('CURRENT RELATIONSHIP OUTLOOK'),
            _StateChip(answer.state),
            if (answer.summary.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(answer.summary, style: _RelationshipText.body),
            ],
          ],
        ),
        if (window != null) ...[
          const SizedBox(height: 12),
          _Card(
            children: [
              const _Heading('STRONGER RELATIONSHIP WINDOW'),
              Text(
                '${formatCustomerLocalDate(window.start)} – ${formatCustomerLocalDate(window.end)}',
                style: _RelationshipText.cardTitle,
              ),
              const SizedBox(height: 8),
              Text(
                window.temporalStatus == 'CURRENT'
                    ? 'Active now · ${window.state}'
                    : 'Upcoming · ${window.state}',
                style: _RelationshipText.body,
              ),
            ],
          ),
        ],
        if (answer.marriageOutlook case final outlook?) ...[
          const SizedBox(height: 12),
          _Card(
            children: [
              const _Heading('MARRIAGE OUTLOOK'),
              Text(outlook.message, style: _RelationshipText.body),
              if (outlook.window case final marriageWindow?) ...[
                const SizedBox(height: 8),
                Text(
                  '${formatCustomerLocalDate(marriageWindow.start)} – ${formatCustomerLocalDate(marriageWindow.end)}',
                  style: _RelationshipText.subtle,
                ),
              ],
            ],
          ),
        ],
        const SizedBox(height: 20),
        _FamilyExpansionSection(controller: familyController),
        if (answer.whatThisCanMean.isNotEmpty)
          _Section(title: 'WHAT THIS CAN MEAN', items: answer.whatThisCanMean),
        if (answer.supportiveFactors.isNotEmpty)
          _Section(
            title: 'WHAT SUPPORTS THIS',
            items: answer.supportiveFactors,
          ),
        if (answer.cautionFactors.isNotEmpty)
          _Section(title: 'WHAT NEEDS ATTENTION', items: answer.cautionFactors),
        if (answer.practicalFocus.isNotEmpty)
          _Section(title: 'WHAT TO FOCUS ON', items: answer.practicalFocus),
        if (answer.historicalContext case final historical?) ...[
          const SizedBox(height: 12),
          _Card(
            children: [
              const _Heading('BASED ON YOUR RECORDED HISTORY'),
              Text(historical.summary, style: _RelationshipText.body),
            ],
          ),
        ],
        const SizedBox(height: 12),
        _Card(
          children: [
            InkWell(
              onTap: onToggleDetails,
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'VIEW DETAILED ASTROLOGY',
                      style: _RelationshipText.eyebrow,
                    ),
                  ),
                  Icon(
                    detailsOpen ? Icons.expand_less : Icons.expand_more,
                    color: _RelationshipColors.turquoise,
                  ),
                ],
              ),
            ),
            if (detailsOpen) ..._details(answer.detailedAstrology),
          ],
        ),
        const Padding(
          padding: EdgeInsets.only(top: 18),
          child: Text(
            'Relationship timing reflects relative astrological evidence. It does not guarantee marriage, commitment, or any specific relationship outcome.',
            style: _RelationshipText.subtle,
          ),
        ),
      ],
    );
  }

  List<Widget> _details(Map<String, dynamic> values) => values.entries
      .where(
        (entry) =>
            entry.value != null &&
            (entry.value is! Map || (entry.value as Map).isNotEmpty),
      )
      .map(
        (entry) => Padding(
          padding: const EdgeInsets.only(top: 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_detailLabel(entry.key), style: _RelationshipText.eyebrow),
              const SizedBox(height: 4),
              Text(_technical(entry.value), style: _RelationshipText.body),
            ],
          ),
        ),
      )
      .toList();

  String _detailLabel(String key) =>
      {
        'timingEvidence': 'Timing Evidence',
        'dashaAndTransit': 'Dasha & Transit',
        'd1RelationshipFoundation': 'D1 Relationship Foundation',
        'd9Navamsa': 'D9 / Navamsa',
        'ashtakavarga': 'Ashtakavarga',
        'calibration': 'Calibration',
      }[key] ??
      key;

  String _technical(Object value) => value is Map
      ? value.entries
            .map(
              (entry) =>
                  '${entry.key}: ${entry.value is Map || entry.value is List ? 'available' : entry.value}',
            )
            .join('\n')
      : value.toString();
}

class _FamilyExpansionSection extends StatefulWidget {
  const _FamilyExpansionSection({required this.controller});
  final FamilyExpansionAnswerController controller;
  @override
  State<_FamilyExpansionSection> createState() =>
      _FamilyExpansionSectionState();
}

class _FamilyExpansionSectionState extends State<_FamilyExpansionSection> {
  bool details = false;
  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    if (controller.state == FamilyExpansionLoadState.initial ||
        controller.state == FamilyExpansionLoadState.loading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 20),
        child: Center(
          child: CircularProgressIndicator(
            color: _RelationshipColors.turquoise,
          ),
        ),
      );
    }
    if (controller.state == FamilyExpansionLoadState.error) {
      return _Card(
        children: [
          const _Heading('FAMILY EXPANSION OUTLOOK'),
          const Text(
            'We couldn’t load Family Expansion insights right now.',
            style: _RelationshipText.body,
          ),
          const SizedBox(height: 10),
          FilledButton(
            onPressed: () => controller.load(force: true),
            child: const Text('Retry'),
          ),
        ],
      );
    }
    final answer = controller.answer;
    if (answer == null) return const SizedBox.shrink();
    if (answer.premiumRequired) {
      return _Card(
        children: [
          const _Heading('FAMILY EXPANSION OUTLOOK'),
          const Text(
            'Unlock personalized insights for this birth profile.',
            style: _RelationshipText.body,
          ),
          const SizedBox(height: 10),
          FilledButton(
            onPressed: () => context.push('/premium'),
            child: const Text('Unlock TaraVerse Premium'),
          ),
        ],
      );
    }
    final window = answer.strongerWindow;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _Heading('FAMILY EXPANSION OUTLOOK'),
        _Card(
          children: [
            _StateChip(answer.state),
            if (answer.summary.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(answer.summary, style: _RelationshipText.body),
            ],
          ],
        ),
        if (window != null) ...[
          const SizedBox(height: 12),
          _Card(
            children: [
              const _Heading('STRONGER FAMILY EXPANSION WINDOW'),
              Text(
                '${formatCustomerLocalDate(window.start)} – ${formatCustomerLocalDate(window.end)}',
                style: _RelationshipText.cardTitle,
              ),
              const SizedBox(height: 8),
              Text(
                window.temporalStatus == 'CURRENT'
                    ? 'Active now · ${window.state}'
                    : 'Upcoming · ${window.state}',
                style: _RelationshipText.body,
              ),
            ],
          ),
        ],
        if (answer.whatThisCanMean.isNotEmpty)
          _Section(title: 'WHAT THIS CAN MEAN', items: answer.whatThisCanMean),
        if (answer.supportiveFactors.isNotEmpty)
          _Section(
            title: 'WHAT SUPPORTS THIS',
            items: answer.supportiveFactors,
          ),
        if (answer.cautionFactors.isNotEmpty)
          _Section(title: 'WHAT NEEDS ATTENTION', items: answer.cautionFactors),
        if (answer.practicalFocus.isNotEmpty)
          _Section(title: 'WHAT TO FOCUS ON', items: answer.practicalFocus),
        if (answer.historicalContext case final historical?) ...[
          const SizedBox(height: 12),
          _Card(
            children: [
              const _Heading('BASED ON YOUR RECORDED HISTORY'),
              Text(historical.summary, style: _RelationshipText.body),
            ],
          ),
        ],
        const SizedBox(height: 12),
        _Card(
          children: [
            InkWell(
              onTap: () => setState(() => details = !details),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'VIEW FAMILY EXPANSION DETAILED ASTROLOGY',
                      style: _RelationshipText.eyebrow,
                    ),
                  ),
                  Icon(
                    details ? Icons.expand_less : Icons.expand_more,
                    color: _RelationshipColors.turquoise,
                  ),
                ],
              ),
            ),
            if (details) ..._familyDetails(answer.detailedAstrology),
          ],
        ),
        const Padding(
          padding: EdgeInsets.only(top: 18),
          child: Text(
            'This reflects broader astrological timing for family planning and expansion. It does not assess fertility, conception, pregnancy, or medical outcomes.',
            style: _RelationshipText.subtle,
          ),
        ),
      ],
    );
  }

  List<Widget> _familyDetails(Map<String, dynamic> values) => values.entries
      .where(
        (entry) =>
            entry.value != null &&
            (entry.value is! Map || (entry.value as Map).isNotEmpty),
      )
      .map(
        (entry) => Padding(
          padding: const EdgeInsets.only(top: 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                {
                      'timingEvidence': 'Timing Evidence',
                      'dashaAndTransit': 'Dasha & Transit',
                      'd1FamilyFoundation': 'D1 Family Foundation',
                      'd7Saptamsha': 'D7 / Saptamsa',
                      'ashtakavarga': 'Ashtakavarga',
                      'calibrationAndSafety': 'Calibration & Safety',
                    }[entry.key] ??
                    entry.key,
                style: _RelationshipText.eyebrow,
              ),
              const SizedBox(height: 4),
              Text(
                entry.value is Map
                    ? entry.value.entries
                          .map(
                            (item) =>
                                '${item.key}: ${item.value is Map || item.value is List ? 'available' : item.value}',
                          )
                          .join('\n')
                    : entry.value.toString(),
                style: _RelationshipText.body,
              ),
            ],
          ),
        ),
      )
      .toList();
}

class _StateChip extends StatelessWidget {
  const _StateChip(this.state);
  final String state;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    decoration: BoxDecoration(
      color: _RelationshipColors.stateColor(state).withValues(alpha: .17),
      borderRadius: BorderRadius.circular(100),
    ),
    child: Text(
      state,
      style: TextStyle(
        color: _RelationshipColors.stateColor(state),
        fontWeight: FontWeight.w700,
      ),
    ),
  );
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.items});
  final String title;
  final List<String> items;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 12),
    child: _Card(
      children: [
        _Heading(title),
        ...items
            .take(4)
            .map(
              (item) => Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text('• $item', style: _RelationshipText.body),
              ),
            ),
      ],
    ),
  );
}

class _Card extends StatelessWidget {
  const _Card({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: _RelationshipColors.card,
      borderRadius: BorderRadius.circular(16),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: children,
    ),
  );
}

class _Heading extends StatelessWidget {
  const _Heading(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Text(text, style: _RelationshipText.eyebrow),
  );
}

abstract final class _RelationshipColors {
  static const background = Color(0xff073b3b);
  static const card = Color(0xff0d5150);
  static const ivory = Color(0xfffff6df);
  static const turquoise = Color(0xff55ddd0);
  static const gold = Color(0xffd8b96d);
  static Color stateColor(String state) => switch (state) {
    'Supportive' => turquoise,
    'Improving' => const Color(0xff9ce5a8),
    'Consolidation' => gold,
    'Mixed' => const Color(0xffe8cb8b),
    'Cautious' => const Color(0xffd5b6a3),
    _ => const Color(0xffc6d5d0),
  };
}

abstract final class _RelationshipText {
  static const title = TextStyle(
    color: _RelationshipColors.ivory,
    fontSize: 27,
    fontWeight: FontWeight.w700,
  );
  static const cardTitle = TextStyle(
    color: _RelationshipColors.ivory,
    fontSize: 18,
    fontWeight: FontWeight.w600,
  );
  static const body = TextStyle(color: _RelationshipColors.ivory, height: 1.35);
  static const subtle = TextStyle(
    color: Color(0xffc6d5d0),
    fontSize: 12,
    height: 1.35,
  );
  static const eyebrow = TextStyle(
    color: _RelationshipColors.gold,
    fontWeight: FontWeight.w700,
    fontSize: 12,
    letterSpacing: 1,
  );
}
