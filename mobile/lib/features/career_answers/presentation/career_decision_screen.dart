import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../career_decision_controller.dart';
import '../domain/career_decision.dart';

class CareerDecisionScreen extends StatefulWidget {
  const CareerDecisionScreen({
    super.key,
    required this.controller,
    required this.decisionType,
  });
  final CareerDecisionController controller;
  final String decisionType;
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
  void initState() {
    super.initState();
    widget.controller.reset();
  }

  bool get _isSwitchJob => widget.decisionType == 'switch-job';
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
    widget.controller.submit(decisionType: 'JOB_OFFER', context: context);
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
        return _Result(decision: c.decision!);
      }
      if (_isSwitchJob) return _SwitchJobForm(controller: c);
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
  const _Result({required this.decision});
  final CareerDecision decision;

  bool get _isSwitchJob => decision.decisionType == 'SWITCH_JOB';

  @override
  Widget build(BuildContext context) {
    final timing = decision.timing;
    if (_isSwitchJob) return _SwitchJobResult(decision: decision);
    final priorities = (decision.context?.priority ?? '')
        .split(',')
        .map((value) => value.trim())
        .where((value) => value.isNotEmpty)
        .toList(growable: false);
    final joiningKnown = decision.context?.joiningDate?.isNotEmpty == true;
    final whatToDo = _unique(decision.whatToDo);
    final practicalFactors = _unique([
      ..._jobOfferPracticalFactors(),
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

  static String _stateLabel(String state) => switch (state) {
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

  List<String> _jobOfferPracticalFactors() => [
    'Role scope and responsibilities',
    'Manager and team',
    'Compensation and benefits',
    'Company stability and work environment',
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

class _SwitchJobForm extends StatefulWidget {
  const _SwitchJobForm({required this.controller});

  final CareerDecisionController controller;

  @override
  State<_SwitchJobForm> createState() => _SwitchJobFormState();
}

class _SwitchJobFormState extends State<_SwitchJobForm> {
  final _form = GlobalKey<FormState>();
  final _reasons = <String>{};
  final _notice = TextEditingController();
  final _currentRole = TextEditingController();
  final _targetRole = TextEditingController();
  final _workModel = TextEditingController();
  final _concerns = TextEditingController();
  String? _activelyInterviewing;
  String? _preferredTimeline;

  @override
  void dispose() {
    for (final controller in [
      _notice,
      _currentRole,
      _targetRole,
      _workModel,
      _concerns,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  void _submit() {
    if (!(_form.currentState?.validate() ?? false) ||
        _reasons.isEmpty ||
        _activelyInterviewing == null ||
        _preferredTimeline == null) {
      setState(() {});
      return;
    }
    final context = <String, Object?>{
      'reasons': _reasons.toList(growable: false),
      'activelyInterviewing': _activelyInterviewing,
      'preferredTimeline': _preferredTimeline,
    };
    _optional(context, 'noticePeriod', _notice.text);
    _optional(context, 'currentRole', _currentRole.text);
    _optional(context, 'targetRole', _targetRole.text);
    _optional(context, 'workModelPreference', _workModel.text);
    _optional(context, 'concerns', _concerns.text);
    widget.controller.submit(decisionType: 'SWITCH_JOB', context: context);
  }

  static void _optional(
    Map<String, Object?> context,
    String key,
    String value,
  ) {
    if (value.trim().isNotEmpty) context[key] = value.trim();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('SWITCH JOBS')),
    body: Form(
      key: _form,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Should I switch jobs?',
            style: TextStyle(fontSize: 25, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 18),
          const Text('WHY ARE YOU CONSIDERING A SWITCH?'),
          Wrap(
            children:
                [
                      'Better compensation',
                      'Career growth',
                      'Manager/team issues',
                      'Role mismatch',
                      'Company instability',
                      'Work-life balance',
                      'Relocation',
                      'Better opportunity',
                      'Lack of learning',
                      'Other',
                    ]
                    .map(
                      (reason) => FilterChip(
                        label: Text(reason),
                        selected: _reasons.contains(reason),
                        onSelected: (_) => setState(() {
                          if (_reasons.contains(reason)) {
                            _reasons.remove(reason);
                          } else {
                            _reasons.add(reason);
                          }
                        }),
                      ),
                    )
                    .toList(),
          ),
          if (_reasons.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 6),
              child: Text('Choose at least one reason.'),
            ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            initialValue: _activelyInterviewing,
            decoration: const InputDecoration(
              labelText: 'Are you actively interviewing?',
            ),
            items: const [
              DropdownMenuItem(value: 'YES', child: Text('Yes')),
              DropdownMenuItem(value: 'NO', child: Text('No')),
              DropdownMenuItem(
                value: 'EXPLORING',
                child: Text('Just exploring'),
              ),
            ],
            validator: (value) => value == null ? 'Required' : null,
            onChanged: (value) => setState(() => _activelyInterviewing = value),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _preferredTimeline,
            decoration: const InputDecoration(labelText: 'Preferred timeline'),
            items: const [
              DropdownMenuItem(
                value: 'IMMEDIATELY',
                child: Text('Immediately / as soon as possible'),
              ),
              DropdownMenuItem(
                value: 'ONE_TO_THREE_MONTHS',
                child: Text('Within 1–3 months'),
              ),
              DropdownMenuItem(
                value: 'THREE_TO_SIX_MONTHS',
                child: Text('Within 3–6 months'),
              ),
              DropdownMenuItem(
                value: 'NO_FIXED_TIMELINE',
                child: Text('No fixed timeline'),
              ),
            ],
            validator: (value) => value == null ? 'Required' : null,
            onChanged: (value) => setState(() => _preferredTimeline = value),
          ),
          _field(_notice, 'Notice period (optional)'),
          _field(_currentRole, 'Current role / designation (optional)'),
          _field(_targetRole, 'Target role (optional)'),
          _field(_workModel, 'Location / work-model preference (optional)'),
          _field(_concerns, 'Concerns (optional)', lines: 3),
          if (widget.controller.state == CareerDecisionLoadState.error)
            const Text(
              'We could not prepare your decision view. Please try again.',
            ),
          FilledButton(
            onPressed: _submit,
            child: Text(
              widget.controller.state == CareerDecisionLoadState.error
                  ? 'RETRY'
                  : 'CONTINUE',
            ),
          ),
        ],
      ),
    ),
  );

  Widget _field(
    TextEditingController controller,
    String label, {
    int lines = 1,
  }) => Padding(
    padding: const EdgeInsets.only(top: 12),
    child: TextFormField(
      controller: controller,
      maxLines: lines,
      decoration: InputDecoration(labelText: label),
    ),
  );
}

class _SwitchJobResult extends StatelessWidget {
  const _SwitchJobResult({required this.decision});

  final CareerDecision decision;

  @override
  Widget build(BuildContext context) {
    final timing = decision.timing;
    final decisionContext = decision.context;
    final reasons = decisionContext?.reasons ?? const <String>[];
    final whatToDo = _Result._unique(decision.whatToDo);
    return Scaffold(
      appBar: AppBar(title: const Text('SWITCH JOBS')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Overall View',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          Text(_Result._stateLabel(decision.state)),
          if (decision.overall.isNotEmpty) Text(decision.overall),
          if (reasons.isNotEmpty ||
              decisionContext?.activelyInterviewing != null ||
              decisionContext?.preferredTimeline != null)
            _resultSection('Current Switching Context', [
              if (reasons.isNotEmpty)
                'You are considering a switch for ${_joinReasons(reasons)}.',
              if (decisionContext?.activelyInterviewing != null)
                'Current stage: ${decisionContext!.activelyInterviewing}.',
              if (decisionContext?.preferredTimeline != null)
                'Preferred timeline: ${decisionContext!.preferredTimeline}.',
            ]),
          _resultSection(
            'Explore Timing',
            timing == null
                ? 'TaraVerse does not have a supported Career period for exploring a switch.'
                : [
                    '${DateFormat('d MMM y').format(timing.start)} – ${DateFormat('d MMM y').format(timing.end)}',
                    'Use this period for applications, networking, interviews and exploratory conversations.',
                  ],
          ),
          _resultSection(
            'Move / Joining Timing',
            decision.timingScope == 'EXPLORE_ONLY'
                ? 'The available Career evidence supports exploration timing only. It does not separately assess resignation, acceptance or joining timing.'
                : 'Move or joining timing is not separately available from the saved Career evidence.',
          ),
          if (reasons.isNotEmpty)
            _resultSection(
              'Alignment With Your Reasons',
              reasons.map(_reasonGuidance).toList(growable: false),
            ),
          _resultSection('What Supports a Switch', _supportCopy(timing)),
          if (decision.cautions.isNotEmpty)
            _resultSection(
              'What Needs Caution',
              _Result._unique(decision.cautions),
            ),
          _resultSection(
            'Practical Decision Factors',
            _practicalFactors(reasons, decisionContext),
          ),
          if (whatToDo.isNotEmpty) _resultSection('What To Do', whatToDo),
          _DetailedAstrology(
            detailed: decision.detailedAstrology,
            limitation: decision.limitation,
          ),
        ],
      ),
    );
  }

  static String _joinReasons(List<String> reasons) {
    if (reasons.length == 1) return reasons.single;
    if (reasons.length == 2) return '${reasons.first} and ${reasons.last}';
    return '${reasons.sublist(0, reasons.length - 1).join(', ')}, and ${reasons.last}';
  }

  static String _reasonGuidance(String reason) => switch (reason) {
    'Career growth' => 'Compare whether the next role meaningfully increases scope, learning or responsibility.',
    'Better compensation' =>
      'Compare total compensation, variable pay and long-term upside.',
    'Manager/team issues' => 'Assess reporting structure, manager quality and team stability before moving.',
    'Role mismatch' => 'Clarify whether the target role better matches your strengths, interests and intended direction.',
    'Company instability' => 'Review the company’s business stability, role clarity and realistic downside before moving.',
    'Work-life balance' =>
      'Clarify workload, flexibility, travel and day-to-day expectations.',
    'Relocation' => 'Compare relocation, commute and work-model implications before making a move.',
    'Better opportunity' => 'Compare the opportunity’s scope, learning and long-term direction against your reasons for switching.',
    'Lack of learning' => 'Check whether the target role offers meaningful learning, mentorship and exposure.',
    _ => 'Compare this opportunity carefully against your stated reason for considering a switch.',
  };

  static List<String> _supportCopy(CareerDecisionTiming? timing) {
    if (timing == null) {
      return const [
        'TaraVerse is using the saved Career evidence available for this decision.',
      ];
    }
    return const [
      'The current Career period is more supportive for exploring new opportunities.',
    ];
  }

  static List<String> _practicalFactors(
    List<String> reasons,
    CareerDecisionContext? context,
  ) => _Result._unique([
    'Role scope and responsibilities',
    'Compensation and benefits',
    'Manager and team',
    'Company stability',
    'Learning and growth',
    'Work-life balance',
    'Location and work model',
    'Notice-period implications',
    if (context?.noticePeriod?.trim().isNotEmpty ?? false)
      'Notice-period planning: ${context!.noticePeriod}',
    if (context?.targetRole?.trim().isNotEmpty ?? false)
      'How the target role (${context!.targetRole}) changes your scope and direction',
    if (context?.workModelPreference?.trim().isNotEmpty ?? false)
      'How the preferred work model (${context!.workModelPreference}) fits your needs',
    if (reasons.contains('Company instability'))
      'Financial runway before resigning without an offer',
  ]);

  static Widget _resultSection(String title, Object body) => Padding(
    padding: const EdgeInsets.only(top: 18),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
        Text(
          body is List
              ? body.map((item) => '• $item').join('\n')
              : body.toString(),
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
