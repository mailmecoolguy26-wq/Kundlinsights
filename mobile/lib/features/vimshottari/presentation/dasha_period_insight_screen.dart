import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../profiles/profile_controller.dart';
import '../../readings/astrology_presentation_copy.dart';
import '../domain/vimshottari.dart';
import '../vimshottari_controller.dart';

class DashaPeriodInsightScreen extends StatefulWidget {
  const DashaPeriodInsightScreen({
    super.key,
    required this.profileController,
    required this.controller,
    required this.pratyantarStart,
  });
  final ProfileController profileController;
  final VimshottariController controller;
  final DateTime pratyantarStart;
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
      return Scaffold(
        backgroundColor: _C.midnight,
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              IconButton(
                onPressed: () => Navigator.of(context).maybePop(),
                icon: const Icon(Icons.arrow_back, color: _C.alabaster),
              ),
              if (detail == null)
                const Padding(
                  padding: EdgeInsets.all(32),
                  child: Center(
                    child: CircularProgressIndicator(color: _C.gold),
                  ),
                )
              else
                _Detail(detail: detail),
            ],
          ),
        ),
      );
    },
  );
}

class _Detail extends StatelessWidget {
  const _Detail({required this.detail});
  final DashaPeriodInsight detail;
  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    final p = detail.pratyantar;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '${copy.planet(p.lord).toUpperCase()} PRATYANTAR',
          style: _S.eyebrow,
        ),
        const SizedBox(height: 6),
        Text(
          'Within ${copy.planet(detail.antardasha.lord)} Antardasha',
          style: _S.title,
        ),
        const SizedBox(height: 16),
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(detail.status, style: _S.eyebrow),
              const SizedBox(height: 8),
              Text('${_date(p.startUtc)} — ${_date(p.endUtc)}', style: _S.card),
              const SizedBox(height: 12),
              Text('WHAT THIS PERIOD MEANS', style: _S.eyebrow),
              const SizedBox(height: 6),
              Text(
                copy.isHinglish
                    ? detail.presentation.hinglish
                    : detail.presentation.english,
                style: _S.body,
              ),
            ],
          ),
        ),
        if (detail.natalFacts.isNotEmpty ||
            detail.stateFacts.isNotEmpty ||
            detail.relationshipFacts.isNotEmpty ||
            detail.d10Facts.isNotEmpty) ...[
          const SizedBox(height: 20),
          Text('WHY THIS PERIOD MATTERS', style: _S.eyebrow),
          const SizedBox(height: 8),
          _Card(
            child: Text(
              '${detail.natalFacts.length} natal facts · ${detail.stateFacts.length} state facts · ${detail.relationshipFacts.length} relationship facts · ${detail.d10Facts.length} D10 facts',
              style: _S.body,
            ),
          ),
        ],
        if (detail.careerRelevance case final value?) ...[
          const SizedBox(height: 20),
          Text('CAREER RELEVANCE', style: _S.eyebrow),
          const SizedBox(height: 8),
          _Card(
            child: Text(
              copy.isHinglish
                  ? value.presentation.hinglish
                  : value.presentation.english,
              style: _S.body,
            ),
          ),
        ],
        if (detail.nextPeriod case final next?) ...[
          const SizedBox(height: 20),
          Text('WHAT COMES NEXT', style: _S.eyebrow),
          const SizedBox(height: 8),
          _Card(
            child: Text(
              '${copy.planet(next.lord)} Pratyantar · ${_date(next.startUtc)} — ${_date(next.endUtc)}',
              style: _S.body,
            ),
          ),
        ],
      ],
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: _C.violet,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: const Color(0x77C5A059)),
    ),
    child: child,
  );
}

String _date(DateTime v) => DateFormat('d MMM yyyy').format(v.toLocal());

abstract final class _C {
  static const midnight = Color(0xFF0B071B),
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
        letterSpacing: 1.5,
      ),
      title = TextStyle(
        color: _C.alabaster,
        fontFamily: 'EB Garamond',
        fontSize: 32,
        height: 1.05,
      ),
      card = TextStyle(
        color: _C.alabaster,
        fontSize: 16,
        fontWeight: FontWeight.w600,
      ),
      body = TextStyle(color: _C.slate, fontSize: 14, height: 1.4);
}
