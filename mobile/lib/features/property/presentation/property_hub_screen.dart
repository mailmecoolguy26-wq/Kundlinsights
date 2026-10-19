import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/formatters/customer_date.dart';
import '../domain/property_answer.dart';
import '../property_answer_controller.dart';

/// A presentation-only projection of the server-owned Property Rules v1
/// answer. It never derives Property classifications or dates on-device.
class PropertyHubScreen extends StatefulWidget {
  const PropertyHubScreen({super.key, required this.controller});

  final PropertyAnswerController controller;

  @override
  State<PropertyHubScreen> createState() => _PropertyHubScreenState();
}

class _PropertyHubScreenState extends State<PropertyHubScreen> {
  bool _detailsOpen = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => widget.controller.load(),
    );
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.controller,
    builder: (context, _) => Scaffold(
      backgroundColor: _PropertyColors.background,
      appBar: AppBar(
        backgroundColor: _PropertyColors.background,
        foregroundColor: _PropertyColors.ivory,
        title: const Text('PROPERTY'),
      ),
      body: switch (widget.controller.state) {
        PropertyAnswerLoadState.initial ||
        PropertyAnswerLoadState.loading => const _Loading(),
        PropertyAnswerLoadState.error => _Error(
          onRetry: widget.controller.load,
        ),
        PropertyAnswerLoadState.loaded => _Result(
          answer: widget.controller.answer!,
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
        CircularProgressIndicator(color: _PropertyColors.turquoise),
        SizedBox(height: 16),
        Text('Calculating your Property timing…', style: _PropertyText.body),
      ],
    ),
  );
}

class _Error extends StatelessWidget {
  const _Error({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'We couldn’t calculate your Property timing right now. Please try again.',
            style: _PropertyText.body,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          FilledButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    ),
  );
}

class _Result extends StatelessWidget {
  const _Result({
    required this.answer,
    required this.detailsOpen,
    required this.onToggleDetails,
  });

  final PropertyAnswer answer;
  final bool detailsOpen;
  final VoidCallback onToggleDetails;

  @override
  Widget build(BuildContext context) {
    final window = answer.strongerWindow;
    final active = window?.temporalStatus == 'CURRENT';
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 36),
      children: [
        const Text(
          'Understand when Property-related factors are more supportive.',
          style: _PropertyText.body,
        ),
        const SizedBox(height: 22),
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'CURRENT PROPERTY SUPPORT',
                style: _PropertyText.eyebrow,
              ),
              const SizedBox(height: 8),
              Text(
                _classificationLabel(answer.classification),
                style: _PropertyText.title,
              ),
              const SizedBox(height: 8),
              Text(
                _currentMeaning(answer.classification),
                style: _PropertyText.body,
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        if (window != null && answer.windowStatus != 'NO_RELIABLE_WINDOW')
          _Card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  active
                      ? 'PROPERTY SUPPORT WINDOW'
                      : 'NEXT PROPERTY SUPPORT PERIOD',
                  style: _PropertyText.eyebrow,
                ),
                const SizedBox(height: 9),
                Text(
                  '${_date(window.start)} – ${_date(window.end)}',
                  style: _PropertyText.cardTitle,
                ),
                const SizedBox(height: 10),
                _Badge(active ? 'Active now' : 'Next supportive period'),
                const SizedBox(height: 10),
                Text(_windowMeaning(window), style: _PropertyText.body),
              ],
            ),
          )
        else
          const _Card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('NO STRONG PROPERTY WINDOW', style: _PropertyText.eyebrow),
                SizedBox(height: 8),
                Text(
                  'No sufficiently strong bounded Property window is reliably identified right now.',
                  style: _PropertyText.body,
                ),
              ],
            ),
          ),
        const SizedBox(height: 12),
        const _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('WHAT TO DO', style: _PropertyText.eyebrow),
              SizedBox(height: 8),
              Text(
                'Use this time to prepare, compare options, and plan practical financing and ownership details.',
                style: _PropertyText.body,
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('WHY THIS PERIOD', style: _PropertyText.eyebrow),
              const SizedBox(height: 8),
              const Text(
                'This view is based on your D1 Property promise, D4 confirmation, active Dasha, and calculated transit evidence.',
                style: _PropertyText.body,
              ),
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed: onToggleDetails,
                icon: Icon(detailsOpen ? Icons.expand_less : Icons.expand_more),
                label: Text(
                  detailsOpen
                      ? 'Hide detailed astrology'
                      : 'View detailed astrology',
                ),
              ),
              if (detailsOpen) _Details(evidence: answer.evidence),
            ],
          ),
        ),
        const SizedBox(height: 20),
        OutlinedButton.icon(
          onPressed: () =>
              context.push('/life-events?initialCategory=PROPERTY'),
          icon: const Icon(Icons.home_work_outlined),
          label: const Text('Property Life Events'),
        ),
        const SizedBox(height: 10),
        const Text(
          'Past Property events help TaraVerse understand recurring timing patterns. They do not change your birth chart.',
          style: _PropertyText.small,
        ),
      ],
    );
  }
}

class _Details extends StatelessWidget {
  const _Details({required this.evidence});
  final Map<String, dynamic> evidence;

  @override
  Widget build(BuildContext context) {
    final natal = evidence['natal'] as Map?;
    final d4 = evidence['d4'] as Map?;
    final dasha = evidence['dasha'] as Map?;
    final transit = evidence['transit'] as Map?;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _DetailRow(
            'D1 Property Promise',
            _friendly(natal?['classification']),
          ),
          _DetailRow('D4 Confirmation', _friendly(d4?['confirmation'])),
          _DetailRow('Dasha Support', _friendly(dasha?['classification'])),
          _DetailRow(
            'Current major transit confirmation',
            propertyTransitConfirmationLabel(transit?['active'] == true),
          ),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 7),
    child: Row(
      children: [
        Expanded(child: Text(label, style: _PropertyText.small)),
        Text(
          value,
          style: _PropertyText.small.copyWith(color: _PropertyColors.ivory),
        ),
      ],
    ),
  );
}

class _Card extends StatelessWidget {
  const _Card({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: _PropertyColors.card,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: _PropertyColors.border),
    ),
    child: child,
  );
}

class _Badge extends StatelessWidget {
  const _Badge(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(
      color: _PropertyColors.turquoise.withValues(alpha: .16),
      borderRadius: BorderRadius.circular(30),
    ),
    child: Text(
      text,
      style: _PropertyText.small.copyWith(color: _PropertyColors.turquoise),
    ),
  );
}

String _date(DateTime value) => formatCustomerLocalDate(value);

String propertyTransitConfirmationLabel(bool active) =>
    active ? 'Confirmed' : 'Not currently confirmed';

String _classificationLabel(String classification) => switch (classification) {
  'STRONG' => 'Strong support',
  'MODERATE' => 'Moderate support',
  'MIXED' => 'Mixed support',
  _ => 'No strong support',
};

String _currentMeaning(String classification) => switch (classification) {
  'STRONG' =>
    'Property-related factors show stronger support in the current picture.',
  'MODERATE' =>
    'Property-related factors show moderate support in the current picture.',
  'MIXED' =>
    'Property-related factors are active, with some mixed context to consider.',
  _ => 'No strong Property support is identified in the current picture.',
};

String _windowMeaning(PropertySupportWindow window) =>
    switch (window.timingClassification) {
      'BRIEF_ACTIVATION' =>
        'A brief calculated Property activation appears around this period.',
      _ =>
        window.temporalStatus == 'CURRENT'
            ? 'This calculated support period is active now.'
            : 'This is the next calculated support period identified by the Property evidence.',
    };

String _friendly(Object? value) => (value ?? 'Not available')
    .toString()
    .replaceAll('_', ' ')
    .toLowerCase()
    .split(' ')
    .map(
      (part) =>
          part.isEmpty ? part : '${part[0].toUpperCase()}${part.substring(1)}',
    )
    .join(' ');

abstract final class _PropertyColors {
  static const background = Color(0xFF041B19);
  static const card = Color(0xFF092B28);
  static const border = Color(0xFF2B665F);
  static const ivory = Color(0xFFFFF7E6);
  static const turquoise = Color(0xFF35B9AC);
}

abstract final class _PropertyText {
  static const body = TextStyle(
    color: _PropertyColors.ivory,
    fontSize: 15,
    height: 1.45,
  );
  static const small = TextStyle(
    color: Color(0xFFB6CEC9),
    fontSize: 12,
    height: 1.4,
  );
  static const eyebrow = TextStyle(
    color: _PropertyColors.turquoise,
    fontSize: 11,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.1,
  );
  static const title = TextStyle(
    color: _PropertyColors.ivory,
    fontSize: 23,
    fontWeight: FontWeight.w700,
  );
  static const cardTitle = TextStyle(
    color: _PropertyColors.ivory,
    fontSize: 18,
    fontWeight: FontWeight.w700,
  );
}
