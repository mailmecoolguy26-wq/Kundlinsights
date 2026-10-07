import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../career_answer_controller.dart';
import '../domain/career_answer.dart';

class CareerAnswerScreen extends StatefulWidget {
  const CareerAnswerScreen({
    super.key,
    required this.controller,
    required this.questionType,
  });
  final CareerAnswerController controller;
  final CareerQuestionType questionType;

  @override
  State<CareerAnswerScreen> createState() => _CareerAnswerScreenState();
}

class _CareerAnswerScreenState extends State<CareerAnswerScreen> {
  @override
  void initState() {
    super.initState();
    widget.controller.load(widget.questionType);
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.controller,
    builder: (context, _) {
      final showPrerequisite =
          widget.controller.state == CareerAnswerLoadState.loaded &&
          widget.controller.answer?.sourceReadingId == null;
      return Scaffold(
        backgroundColor: const Color(0xFF061A1A),
        appBar: AppBar(
          backgroundColor: const Color(0xFF061A1A),
          foregroundColor: const Color(0xFFF7F4EC),
          elevation: 0,
          title: Text(showPrerequisite ? 'CAREER & BUSINESS' : 'CAREER ANSWER'),
        ),
        body: switch (widget.controller.state) {
          CareerAnswerLoadState.initial || CareerAnswerLoadState.loading =>
            const Center(child: CircularProgressIndicator()),
          CareerAnswerLoadState.error => _Error(
            onRetry: () => widget.controller.load(widget.questionType),
          ),
          CareerAnswerLoadState.loaded =>
            widget.controller.answer!.sourceReadingId == null
                ? const _CareerReadingPrerequisite()
                : _AnswerBody(answer: widget.controller.answer!),
        },
      );
    },
  );
}

class _Error extends StatelessWidget {
  const _Error({required this.onRetry});
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'Career answer unavailable',
            style: TextStyle(color: Color(0xFFF7F4EC), fontSize: 20),
          ),
          const SizedBox(height: 10),
          const Text(
            'Please try again.',
            style: TextStyle(color: Color(0xFFA8B7B4)),
          ),
          const SizedBox(height: 16),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    ),
  );
}

class _CareerReadingPrerequisite extends StatelessWidget {
  const _CareerReadingPrerequisite();

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Create your Career Reading first',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Color(0xFFF7F4EC),
              fontSize: 24,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          const Text(
            'TaraVerse needs your Career Reading before it can answer personalized Career questions.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFFA8B7B4), height: 1.45),
          ),
          const SizedBox(height: 22),
          FilledButton(
            onPressed: () => context.go('/readings'),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFD6B15A),
              foregroundColor: const Color(0xFF061A1A),
              minimumSize: const Size.fromHeight(48),
            ),
            child: const Text('Generate Career Reading'),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () => context.push('/career-calibration'),
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFFD6B15A),
              side: const BorderSide(color: Color(0xFF3F8179)),
              minimumSize: const Size.fromHeight(48),
            ),
            child: const Text('Add Career History'),
          ),
        ],
      ),
    ),
  );
}

class _AnswerBody extends StatelessWidget {
  const _AnswerBody({required this.answer});
  final CareerAnswer answer;

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
    children: [
      const _Label('ANSWER'),
      const SizedBox(height: 8),
      _Card(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              answer.headline,
              style: const TextStyle(
                color: Color(0xFFF7F4EC),
                fontSize: 24,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              answer.summary,
              style: const TextStyle(color: Color(0xFFD7E1DE), height: 1.45),
            ),
            if (answer.currentPhase != null) ...[
              const SizedBox(height: 14),
              Text(
                answer.currentPhase!,
                style: const TextStyle(color: Color(0xFFD6B15A)),
              ),
            ],
            if (answer.window != null) ...[
              const SizedBox(height: 16),
              Text(
                _range(answer.window!),
                style: const TextStyle(
                  color: Color(0xFFD6B15A),
                  fontWeight: FontWeight.w800,
                  fontSize: 17,
                ),
              ),
              const SizedBox(height: 5),
              const Text(
                'POSSIBLE CAREER ACTIVITY SIGNAL',
                style: TextStyle(
                  color: Color(0xFFA8B7B4),
                  letterSpacing: .5,
                  fontSize: 11,
                ),
              ),
            ],
          ],
        ),
      ),
      const SizedBox(height: 22),
      const _Label('WHAT THIS MEANS'),
      const SizedBox(height: 8),
      _Card(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final item in answer.actionItems)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  '• $item',
                  style: const TextStyle(color: Color(0xFFD7E1DE), height: 1.4),
                ),
              ),
            Text(
              answer.limitation,
              style: const TextStyle(color: Color(0xFF8C9D99), height: 1.4),
            ),
          ],
        ),
      ),
      const SizedBox(height: 22),
      _Evidence(answer: answer),
      if (answer.historicalSummary != null) ...[
        const SizedBox(height: 16),
        const _Label('PATTERN SEEN BEFORE'),
        const SizedBox(height: 8),
        _Card(
          child: Text(
            answer.historicalSummary!,
            style: const TextStyle(color: Color(0xFFD7E1DE), height: 1.4),
          ),
        ),
      ] else ...[
        const SizedBox(height: 16),
        const _Label('MAKE TARAVERSE MORE PERSONAL'),
        const SizedBox(height: 8),
        _Card(
          child: const Text(
            'Add important Career events so TaraVerse can compare future periods with patterns that have appeared in your life.',
            style: TextStyle(color: Color(0xFFD7E1DE), height: 1.4),
          ),
        ),
      ],
      const SizedBox(height: 20),
      OutlinedButton.icon(
        onPressed: () => context.go('/readings'),
        icon: const Icon(Icons.auto_awesome_outlined),
        label: const Text('SEE DETAILED ASTROLOGY'),
        style: OutlinedButton.styleFrom(
          foregroundColor: const Color(0xFFD6B15A),
          side: const BorderSide(color: Color(0xFF3F8179)),
        ),
      ),
      const SizedBox(height: 8),
      TextButton(
        onPressed: () => context.push('/career-calibration'),
        child: const Text('Add career history'),
      ),
    ],
  );

  String _range(CareerAnswerWindow window) {
    final format = DateFormat('d MMM yyyy');
    return '${format.format(window.start)} – ${format.format(window.end)}';
  }
}

class _Evidence extends StatelessWidget {
  const _Evidence({required this.answer});
  final CareerAnswer answer;
  @override
  Widget build(BuildContext context) => ExpansionTile(
    collapsedIconColor: const Color(0xFFD6B15A),
    iconColor: const Color(0xFFD6B15A),
    title: const Text(
      'WHY TARAVERSE THINKS THIS',
      style: TextStyle(color: Color(0xFFF7F4EC), fontWeight: FontWeight.w700),
    ),
    subtitle: answer.availableMajorSignals == 0
        ? null
        : Text(
            '${answer.alignedMajorSignals} of ${answer.availableMajorSignals} available signals support this context',
            style: const TextStyle(color: Color(0xFFA8B7B4)),
          ),
    children: [
      for (final evidence in answer.evidence)
        ListTile(
          title: Text(
            evidence.summary,
            style: const TextStyle(color: Color(0xFFD7E1DE)),
          ),
          subtitle: Text(
            evidence.role == 'PRIMARY'
                ? 'Primary timing evidence'
                : 'Supporting context',
            style: const TextStyle(color: Color(0xFF8C9D99)),
          ),
        ),
    ],
  );
}

class _Label extends StatelessWidget {
  const _Label(this.value);
  final String value;
  @override
  Widget build(BuildContext context) => Text(
    value,
    style: const TextStyle(
      color: Color(0xFFD6B15A),
      fontWeight: FontWeight.w800,
      letterSpacing: 1.1,
      fontSize: 12,
    ),
  );
}

class _Card extends StatelessWidget {
  const _Card({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: const Color(0xFF0B2626),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: const Color(0xFF255C57)),
    ),
    child: child,
  );
}
