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
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFF0B071B),
    appBar: AppBar(
      backgroundColor: const Color(0xFF0B071B),
      foregroundColor: const Color(0xFFFAF7F2),
      elevation: 0,
      title: const Text('CAREER ANSWER'),
    ),
    body: ListenableBuilder(
      listenable: widget.controller,
      builder: (context, _) => switch (widget.controller.state) {
        CareerAnswerLoadState.initial || CareerAnswerLoadState.loading =>
          const Center(child: CircularProgressIndicator()),
        CareerAnswerLoadState.error => _Error(
          onRetry: () => widget.controller.load(widget.questionType),
        ),
        CareerAnswerLoadState.loaded => _AnswerBody(
          answer: widget.controller.answer!,
        ),
      },
    ),
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
          const Text('Career answer unavailable',
              style: TextStyle(color: Color(0xFFFAF7F2), fontSize: 20)),
          const SizedBox(height: 10),
          const Text('Please try again.',
              style: TextStyle(color: Color(0xFFBBB6C6))),
          const SizedBox(height: 16),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
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
            Text(answer.headline,
                style: const TextStyle(
                  color: Color(0xFFFAF7F2),
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                )),
            const SizedBox(height: 10),
            Text(answer.summary,
                style: const TextStyle(color: Color(0xFFDDD8E4), height: 1.45)),
            if (answer.currentPhase != null) ...[
              const SizedBox(height: 14),
              Text(answer.currentPhase!,
                  style: const TextStyle(color: Color(0xFFF4BF50))),
            ],
            if (answer.window != null) ...[
              const SizedBox(height: 16),
              Text(_range(answer.window!),
                  style: const TextStyle(
                    color: Color(0xFFF4BF50),
                    fontWeight: FontWeight.w800,
                    fontSize: 17,
                  )),
              const SizedBox(height: 5),
              const Text('POSSIBLE CAREER ACTIVITY SIGNAL',
                  style: TextStyle(
                    color: Color(0xFFBBB6C6),
                    letterSpacing: .5,
                    fontSize: 11,
                  )),
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
                child: Text('• $item',
                    style: const TextStyle(
                      color: Color(0xFFDDD8E4),
                      height: 1.4,
                    )),
              ),
            Text(answer.limitation,
                style: const TextStyle(color: Color(0xFFAAA2B4), height: 1.4)),
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
          child: Text(answer.historicalSummary!,
              style: const TextStyle(color: Color(0xFFDDD8E4), height: 1.4)),
        ),
      ] else ...[
        const SizedBox(height: 16),
        const _Label('MAKE TARAVERSE MORE PERSONAL'),
        const SizedBox(height: 8),
        _Card(
          child: const Text(
            'Add important Career events so TaraVerse can compare future periods with patterns that have appeared in your life.',
            style: TextStyle(color: Color(0xFFDDD8E4), height: 1.4),
          ),
        ),
      ],
      const SizedBox(height: 20),
      OutlinedButton.icon(
        onPressed: () => context.go('/readings'),
        icon: const Icon(Icons.auto_awesome_outlined),
        label: const Text('SEE DETAILED ASTROLOGY'),
        style: OutlinedButton.styleFrom(
          foregroundColor: const Color(0xFFF4BF50),
          side: const BorderSide(color: Color(0xFF735A2E)),
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
    collapsedIconColor: const Color(0xFFF4BF50),
    iconColor: const Color(0xFFF4BF50),
    title: const Text('WHY TARAVERSE THINKS THIS',
        style: TextStyle(color: Color(0xFFFAF7F2), fontWeight: FontWeight.w700)),
    subtitle: answer.availableMajorSignals == 0
        ? null
        : Text(
            '${answer.alignedMajorSignals} of ${answer.availableMajorSignals} available signals support this context',
            style: const TextStyle(color: Color(0xFFBBB6C6)),
          ),
    children: [
      for (final evidence in answer.evidence)
        ListTile(
          title: Text(evidence.summary,
              style: const TextStyle(color: Color(0xFFDDD8E4))),
          subtitle: Text(evidence.role == 'PRIMARY' ? 'Primary timing evidence' : 'Supporting context',
              style: const TextStyle(color: Color(0xFFAAA2B4))),
        ),
    ],
  );
}

class _Label extends StatelessWidget {
  const _Label(this.value);
  final String value;
  @override
  Widget build(BuildContext context) => Text(value,
      style: const TextStyle(
        color: Color(0xFFF4BF50),
        fontWeight: FontWeight.w800,
        letterSpacing: 1.1,
        fontSize: 12,
      ));
}

class _Card extends StatelessWidget {
  const _Card({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: const Color(0xFF181335),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: const Color(0xFF413653)),
    ),
    child: child,
  );
}
