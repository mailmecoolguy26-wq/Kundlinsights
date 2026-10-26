import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../career_decision_controller.dart';
import '../domain/career_decision.dart';

class CareerDecisionScreen extends StatefulWidget {
  const CareerDecisionScreen({super.key, required this.controller});
  final CareerDecisionController controller;
  @override
  State<CareerDecisionScreen> createState() => _CareerDecisionScreenState();
}

class _CareerDecisionScreenState extends State<CareerDecisionScreen> {
  final _form = GlobalKey<FormState>();
  final _offer = TextEditingController(),
      _current = TextEditingController(),
      _joining = TextEditingController(),
      _role = TextEditingController(),
      _concerns = TextEditingController();
  String _move = 'NEW_COMPANY';
  final _priorities = <String>{};
  @override
  void dispose() {
    for (final c in [_offer, _current, _joining, _role, _concerns]) {
      c.dispose();
    }
    super.dispose();
  }

  void _submit() {
    if (!(_form.currentState?.validate() ?? false)) {
      return;
    }
    final context = <String, Object?>{
      'offerReceivedDate': _offer.text,
      'currentSituation': _current.text,
      'moveType': _move,
      'priority': _priorities.join(', '),
    };
    if (_joining.text.isNotEmpty) {
      context['joiningDate'] = _joining.text;
    }
    if (_role.text.isNotEmpty) {
      context['role'] = _role.text;
    }
    if (_concerns.text.isNotEmpty) {
      context['concerns'] = _concerns.text;
    }
    widget.controller.submit(context);
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.controller,
    builder: (context, _) {
      final c = widget.controller;
      if (c.state == CareerDecisionLoadState.loading) {
        return const Scaffold(body: Center(child: CircularProgressIndicator()));
      }
      if (c.state == CareerDecisionLoadState.loaded) {
        return _Result(
          decision: c.decision!,
          joiningKnown: _joining.text.isNotEmpty,
          priorities: _priorities.toList(growable: false),
          moveType: _move,
          hasRole: _role.text.trim().isNotEmpty,
        );
      }
      return Scaffold(
        appBar: AppBar(title: const Text('JOB OFFER')),
        body: Form(
          key: _form,
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              const Text(
                'I have a job offer',
                style: TextStyle(fontSize: 25, fontWeight: FontWeight.bold),
              ),
              _field(_offer, 'Offer received date', true),
              _field(_current, 'Current employment situation', true),
              DropdownButtonFormField<String>(
                initialValue: _move,
                items: const [
                  DropdownMenuItem(
                    value: 'NEW_COMPANY',
                    child: Text('New company'),
                  ),
                  DropdownMenuItem(
                    value: 'INTERNAL_MOVE',
                    child: Text('Internal move'),
                  ),
                ],
                onChanged: (v) => setState(() => _move = v!),
              ),
              _field(_joining, 'Expected joining date (optional)', false),
              _field(_role, 'Role / designation (optional)', false),
              const Text('WHAT MATTERS MOST?'),
              Wrap(
                children:
                    [
                          'Career growth',
                          'Higher compensation',
                          'Stability',
                          'Better role/title',
                          'Learning',
                          'Leadership',
                          'Work-life balance',
                          'Location',
                          'Company/brand',
                        ]
                        .map(
                          (x) => FilterChip(
                            label: Text(x),
                            selected: _priorities.contains(x),
                            onSelected: (_) => setState(() {
                              if (_priorities.contains(x)) {
                                _priorities.remove(x);
                              } else {
                                _priorities.add(x);
                              }
                            }),
                          ),
                        )
                        .toList(),
              ),
              _field(_concerns, 'Concerns (optional)', false, 3),
              if (c.state == CareerDecisionLoadState.error)
                const Text(
                  'We could not prepare your decision view. Please try again.',
                ),
              FilledButton(
                onPressed: _submit,
                child: Text(
                  c.state == CareerDecisionLoadState.error
                      ? 'RETRY'
                      : 'CONTINUE',
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
  Widget _field(
    TextEditingController c,
    String label,
    bool required, [
    int lines = 1,
  ]) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: TextFormField(
      controller: c,
      maxLines: lines,
      decoration: InputDecoration(labelText: label),
      validator: required
          ? (v) => v == null || v.trim().isEmpty ? 'Required' : null
          : null,
    ),
  );
}

class _Result extends StatelessWidget {
  const _Result({
    required this.decision,
    required this.joiningKnown,
    required this.priorities,
    required this.moveType,
    required this.hasRole,
  });
  final CareerDecision decision;
  final bool joiningKnown;
  final List<String> priorities;
  final String moveType;
  final bool hasRole;

  @override
  Widget build(BuildContext context) {
    final timing = decision.timing;
    final whatToDo = _unique(decision.whatToDo);
    final practicalFactors = _unique([
      ..._contextualPracticalFactors(),
      ...decision.practicalFactors.where(
        (factor) => !_contains(whatToDo, factor),
      ),
    ]);
    return Scaffold(
      appBar: AppBar(title: const Text('JOB OFFER')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Overall View',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          Text(_stateLabel(decision.state)),
          if (decision.overall.isNotEmpty) Text(decision.overall),
          _section(
            'Offer Timing',
            timing == null
                ? 'TaraVerse does not have a supported timing window for this decision.'
                : [
                    '${DateFormat('d MMM y').format(timing.start)} – ${DateFormat('d MMM y').format(timing.end)}',
                    'This period is more supportive for evaluating and progressing a new Career opportunity.',
                  ],
          ),
          _section(
            'Joining Timing',
            joiningKnown
                ? 'Your expected joining date is included in this decision view. Review it alongside the offer timing and practical conditions.'
                : 'Joining timing can be assessed once you know the expected joining date.',
          ),
          if (priorities.isNotEmpty)
            _section(
              'Alignment With Your Priorities',
              priorities.map(_priorityGuidance).toList(growable: false),
            ),
          _section('What Supports This', _customerSupport(timing)),
          if (decision.cautions.isNotEmpty)
            _section('What Needs Caution', _unique(decision.cautions)),
          if (practicalFactors.isNotEmpty)
            _section('Practical Decision Factors', practicalFactors),
          if (whatToDo.isNotEmpty) _section('What To Do', whatToDo),
          _DetailedAstrology(
            detailed: decision.detailedAstrology,
            limitation: decision.limitation,
          ),
        ],
      ),
    );
  }

  String _stateLabel(String state) => switch (state) {
    'MORE_SUPPORTIVE' => 'More Supportive',
    'SUPPORTIVE_WITH_CONDITIONS' => 'Supportive With Conditions',
    'MIXED' => 'Mixed',
    'CAUTIOUS' => 'Cautious',
    _ => 'Insufficient Evidence',
  };

  List<String> _customerSupport(CareerDecisionTiming? timing) {
    if (timing == null) {
      return const [
        'TaraVerse is using the saved Career evidence available for this decision.',
      ];
    }
    final agreement = decision.detailedAstrology?.agreement;
    if ((agreement?.alignedMajorSignals ?? 0) > 1) {
      return const [
        'Multiple Career timing signals are aligned around this opportunity.',
      ];
    }
    return const ['The offer overlaps with a saved Career timing period.'];
  }

  List<String> _contextualPracticalFactors() => [
    'Role scope and responsibilities',
    'Manager and team',
    'Compensation and benefits',
    if (moveType == 'NEW_COMPANY') 'Company stability and work environment',
    if (hasRole) 'Whether the role matches the stated designation and scope',
    'Joining terms and notice-period implications',
  ];

  String _priorityGuidance(String priority) => switch (priority) {
    'Career growth' => 'Career growth is your main priority. Compare whether this role meaningfully increases scope, learning, responsibility or future opportunities.',
    'Higher compensation' => 'Compensation is one of your stated priorities. Compare fixed pay, variable pay, benefits and long-term upside.',
    'Stability' => 'Stability is important to you. Review company stability, role clarity and the likelihood of sustained responsibility.',
    'Better role/title' => 'Role and title matter to you. Compare the scope, decision-making responsibility and how the role supports your next step.',
    'Learning' => 'Learning is a stated priority. Compare the skills, mentorship and exposure this role can realistically provide.',
    'Leadership' => 'Leadership is a stated priority. Clarify team responsibility, decision rights and the path to greater ownership.',
    'Work-life balance' => 'Work-life balance is important to you. Clarify expectations, travel, flexibility and the likely day-to-day workload.',
    'Location' => 'Location is a stated priority. Compare commute, relocation, remote flexibility and the practical impact on your routine.',
    'Company/brand' => 'Company and brand matter to you. Compare the organisation’s reputation, business direction and what the experience adds to your profile.',
    _ => 'Compare this offer against your stated priority before making a decision.',
  };

  static List<String> _unique(Iterable<String> values) {
    final seen = <String>{};
    return values
        .where((value) => value.trim().isNotEmpty)
        .where((value) => seen.add(value.trim().toLowerCase()))
        .toList(growable: false);
  }

  static bool _contains(Iterable<String> values, String candidate) => values
      .map((value) => value.trim().toLowerCase())
      .contains(candidate.trim().toLowerCase());

  Widget _section(String title, Object body) => Padding(
    padding: const EdgeInsets.only(top: 18),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
        Text(
          body is List ? body.map((x) => '• $x').join('\n') : body.toString(),
        ),
      ],
    ),
  );
}

class _DetailedAstrology extends StatelessWidget {
  const _DetailedAstrology({required this.detailed, required this.limitation});

  final CareerDecisionDetailedAstrology? detailed;
  final String limitation;

  @override
  Widget build(BuildContext context) {
    final evidence = detailed?.evidence ?? const <CareerDecisionEvidence>[];
    final timing = evidence
        .where(
          (item) =>
              item.family != 'DASHA' &&
              item.family != 'TRANSIT' &&
              item.family != 'D1_CAREER_FOUNDATION' &&
              item.family != 'ASHTAKAVARGA' &&
              item.family != 'D10' &&
              item.family != 'HISTORICAL_PATTERN',
        )
        .toList(growable: false);
    final dashaAndTransit = evidence
        .where((item) => item.family == 'DASHA' || item.family == 'TRANSIT')
        .toList(growable: false);
    final foundation = evidence
        .where((item) => item.family == 'D1_CAREER_FOUNDATION')
        .toList(growable: false);
    final ashtakavarga = evidence
        .where((item) => item.family == 'ASHTAKAVARGA')
        .toList(growable: false);
    final d10 = evidence
        .where((item) => item.family == 'D10')
        .toList(growable: false);
    final calibration = evidence
        .where((item) => item.family == 'HISTORICAL_PATTERN')
        .toList(growable: false);

    return ExpansionTile(
      title: const Text('View Detailed Astrology'),
      children: [
        if (timing.isNotEmpty || detailed?.agreement != null)
          _EvidenceSection(
            title: 'Timing Evidence',
            evidence: timing,
            agreement: detailed?.agreement,
          ),
        if (dashaAndTransit.isNotEmpty)
          _EvidenceSection(title: 'Dasha & Transit', evidence: dashaAndTransit),
        if (foundation.isNotEmpty)
          _EvidenceSection(
            title: 'D1 / Career Foundation',
            evidence: foundation,
          ),
        if (ashtakavarga.isNotEmpty)
          _EvidenceSection(title: 'Ashtakavarga', evidence: ashtakavarga),
        if (d10.isNotEmpty)
          _EvidenceSection(title: 'D10 Career Analysis', evidence: d10),
        if (calibration.isNotEmpty || limitation.isNotEmpty)
          _EvidenceSection(
            title: 'Calibration',
            evidence: calibration,
            limitation: limitation,
          ),
      ],
    );
  }
}

class _EvidenceSection extends StatelessWidget {
  const _EvidenceSection({
    required this.title,
    required this.evidence,
    this.agreement,
    this.limitation,
  });

  final String title;
  final List<CareerDecisionEvidence> evidence;
  final CareerDecisionEvidenceAgreement? agreement;
  final String? limitation;

  @override
  Widget build(BuildContext context) {
    final available = agreement?.availableMajorSignals;
    final aligned = agreement?.alignedMajorSignals;
    final eligible = agreement?.primaryEligibility;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
          for (final item in evidence)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text('• ${item.summary}'),
            ),
          if (available != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                aligned != null
                    ? '$aligned of $available major Career timing signals currently align.'
                    : 'Major Career timing signals available: $available',
              ),
            ),
          if (available == null && aligned != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text('Aligned primary Career signals: $aligned'),
            ),
          if (eligible != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                eligible ? 'Primary Career timing evidence is available.' : 'Primary Career timing evidence is not currently available.',
              ),
            ),
          if (agreement?.supportSignals.isNotEmpty == true)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'Supporting evidence is also present from ${agreement!.supportSignals.map(_supportSignalLabel).join(' and ')}.',
              ),
            ),
          if (limitation?.isNotEmpty == true)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(limitation!),
            ),
        ],
      ),
    );
  }

  static String _supportSignalLabel(String value) => switch (value) {
    'ASHTAKAVARGA' => 'Ashtakavarga',
    'HISTORICAL_PATTERN' => 'historical Career patterns',
    _ => value.replaceAll('_', ' '),
  };
}
