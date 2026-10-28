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
  bool get _isCompareOffers => widget.decisionType == 'compare-offers';
  bool get _isPromotionGrowth => widget.decisionType == 'promotion-growth';
  bool get _isStartBusiness => widget.decisionType == 'start-business';
  bool get _isCareerAbroad => widget.decisionType == 'career-abroad';
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
        return CareerDecisionResultScreen(decision: c.decision!);
      }
      if (_isCompareOffers) return _CompareOffersForm(controller: c);
      if (_isSwitchJob) return _SwitchJobForm(controller: c);
      if (_isPromotionGrowth) return _PromotionGrowthForm(controller: c);
      if (_isStartBusiness) return _StartBusinessForm(controller: c);
      if (_isCareerAbroad) return _CareerAbroadForm(controller: c);
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

/// Shared renderer for both a just-generated decision and an immutable saved
/// decision returned by the detail API. It never invokes generation itself.
class CareerDecisionResultScreen extends StatelessWidget {
  const CareerDecisionResultScreen({
    super.key,
    required this.decision,
    this.savedCreatedAt,
  });
  final CareerDecision decision;
  final DateTime? savedCreatedAt;

  @override
  Widget build(BuildContext context) {
    final body = _Result(decision: decision);
    final created = savedCreatedAt;
    if (created == null) return body;
    return Stack(
      children: [
        body,
        Positioned(
          top: 58,
          right: 16,
          child: SafeArea(
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: Colors.teal.shade700,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 5,
                ),
                child: Text(
                  'Saved Career Decision · Created ${DateFormat('d MMM y').format(created)}',
                  style: const TextStyle(color: Colors.white, fontSize: 11),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _Result extends StatelessWidget {
  const _Result({required this.decision});
  final CareerDecision decision;

  bool get _isSwitchJob => decision.decisionType == 'SWITCH_JOB';
  bool get _isCompareOffers => decision.decisionType == 'COMPARE_OFFERS';
  bool get _isPromotionGrowth => decision.decisionType == 'PROMOTION_GROWTH';
  bool get _isStartBusiness => decision.decisionType == 'START_BUSINESS';
  bool get _isCareerAbroad => decision.decisionType == 'CAREER_ABROAD';

  @override
  Widget build(BuildContext context) {
    final timing = decision.timing;
    if (_isCompareOffers) {
      return _CompareOffersResult(decision: decision);
    }
    if (_isSwitchJob) return _SwitchJobResult(decision: decision);
    if (_isPromotionGrowth || _isStartBusiness || _isCareerAbroad) {
      return _ContextualDecisionResult(decision: decision);
    }
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

class _CompareOffersForm extends StatefulWidget {
  const _CompareOffersForm({required this.controller});
  final CareerDecisionController controller;

  @override
  State<_CompareOffersForm> createState() => _CompareOffersFormState();
}

class _CompareOffersFormState extends State<_CompareOffersForm> {
  final _form = GlobalKey<FormState>();
  final _priorities = <String>{};
  final _a = _OfferInput(), _b = _OfferInput();

  @override
  void dispose() {
    _a.dispose();
    _b.dispose();
    super.dispose();
  }

  void _submit() {
    if (!(_form.currentState?.validate() ?? false) || _priorities.isEmpty) {
      setState(() {});
      return;
    }
    widget.controller.submit(
      decisionType: 'COMPARE_OFFERS',
      context: {
        'offerA': _a.toContext(),
        'offerB': _b.toContext(),
        'priorities': _priorities.toList(growable: false),
      },
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('COMPARE OFFERS')),
    body: Form(
      key: _form,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Compare two offers',
            style: TextStyle(fontSize: 25, fontWeight: FontWeight.bold),
          ),
          const Text(
            'Add only the practical details you want TaraVerse to use in the comparison.',
          ),
          _OfferBlock(
            title: 'Offer A',
            input: _a,
            onChanged: () => setState(() {}),
          ),
          _OfferBlock(
            title: 'Offer B',
            input: _b,
            onChanged: () => setState(() {}),
          ),
          const Padding(
            padding: EdgeInsets.only(top: 20),
            child: Text('WHAT MATTERS MOST TO YOU?'),
          ),
          Wrap(
            children: _comparisonPriorities
                .map(
                  (priority) => FilterChip(
                    label: Text(priority),
                    selected: _priorities.contains(priority),
                    onSelected: (_) => setState(() {
                      if (_priorities.contains(priority)) {
                        _priorities.remove(priority);
                      } else {
                        _priorities.add(priority);
                      }
                    }),
                  ),
                )
                .toList(),
          ),
          if (_priorities.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 6),
              child: Text('Choose at least one priority.'),
            ),
          if (widget.controller.state == CareerDecisionLoadState.error)
            const Padding(
              padding: EdgeInsets.only(top: 12),
              child: Text(
                'We could not prepare your comparison. Please try again.',
              ),
            ),
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: FilledButton(
              onPressed: _submit,
              child: Text(
                widget.controller.state == CareerDecisionLoadState.error
                    ? 'RETRY'
                    : 'COMPARE OFFERS',
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

const _comparisonPriorities = [
  'Career growth',
  'Higher compensation',
  'Stability',
  'Better role/title',
  'Learning',
  'Leadership',
  'Work-life balance',
  'Location',
  'Company/brand',
  'Long-term trajectory',
];

class _OfferInput {
  final offerDate = TextEditingController();
  final joiningDate = TextEditingController();
  final role = TextEditingController();
  final companyLabel = TextEditingController();
  final workModel = TextEditingController();
  final noticePeriod = TextEditingController();
  final strengths = TextEditingController();
  final concerns = TextEditingController();
  String moveType = 'NEW_COMPANY';
  String compensationContext = 'NOT_SHARED';

  Map<String, Object?> toContext() => {
    'offerDate': offerDate.text.trim(),
    'role': role.text.trim(),
    'moveType': moveType,
    if (joiningDate.text.trim().isNotEmpty)
      'joiningDate': joiningDate.text.trim(),
    if (companyLabel.text.trim().isNotEmpty)
      'companyLabel': companyLabel.text.trim(),
    if (compensationContext != 'NOT_SHARED')
      'compensationContext': compensationContext,
    if (workModel.text.trim().isNotEmpty)
      'locationOrWorkModel': workModel.text.trim(),
    if (noticePeriod.text.trim().isNotEmpty)
      'noticePeriodImpact': noticePeriod.text.trim(),
    if (strengths.text.trim().isNotEmpty) 'strengths': [strengths.text.trim()],
    if (concerns.text.trim().isNotEmpty) 'concerns': [concerns.text.trim()],
  };

  void dispose() {
    for (final controller in [
      offerDate,
      joiningDate,
      role,
      companyLabel,
      workModel,
      noticePeriod,
      strengths,
      concerns,
    ]) {
      controller.dispose();
    }
  }
}

class _OfferBlock extends StatelessWidget {
  const _OfferBlock({
    required this.title,
    required this.input,
    required this.onChanged,
  });
  final String title;
  final _OfferInput input;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 22),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
        ),
        _field(input.offerDate, 'Offer received date', required: true),
        _field(input.role, 'Role / designation', required: true),
        DropdownButtonFormField<String>(
          initialValue: input.moveType,
          decoration: const InputDecoration(labelText: 'Move type'),
          items: const [
            DropdownMenuItem(value: 'NEW_COMPANY', child: Text('New company')),
            DropdownMenuItem(
              value: 'INTERNAL_MOVE',
              child: Text('Internal move'),
            ),
          ],
          onChanged: (value) {
            input.moveType = value!;
            onChanged();
          },
        ),
        _field(input.joiningDate, 'Expected joining date (if known)'),
        _field(input.companyLabel, 'Company label (optional)'),
        DropdownButtonFormField<String>(
          initialValue: input.compensationContext,
          decoration: const InputDecoration(labelText: 'Compensation context'),
          items: const [
            DropdownMenuItem(
              value: 'NOT_SHARED',
              child: Text('Prefer not to share'),
            ),
            DropdownMenuItem(value: 'LOWER', child: Text('Lower')),
            DropdownMenuItem(value: 'SIMILAR', child: Text('Similar')),
            DropdownMenuItem(value: 'HIGHER', child: Text('Higher')),
          ],
          onChanged: (value) {
            input.compensationContext = value!;
            onChanged();
          },
        ),
        _field(input.workModel, 'Location / work model (optional)'),
        _field(input.noticePeriod, 'Notice-period impact (optional)'),
        _field(input.strengths, 'Perceived strengths (optional)', lines: 2),
        _field(input.concerns, 'Perceived concerns (optional)', lines: 2),
      ],
    ),
  );

  Widget _field(
    TextEditingController controller,
    String label, {
    bool required = false,
    int lines = 1,
  }) => Padding(
    padding: const EdgeInsets.only(top: 10),
    child: TextFormField(
      controller: controller,
      maxLines: lines,
      decoration: InputDecoration(labelText: label),
      validator: required
          ? (value) => value == null || value.trim().isEmpty ? 'Required' : null
          : null,
    ),
  );
}

class _CompareOffersResult extends StatelessWidget {
  const _CompareOffersResult({required this.decision});
  final CareerDecision decision;

  @override
  Widget build(BuildContext context) {
    final comparison = decision.comparison;
    final contextData = decision.context;
    return Scaffold(
      appBar: AppBar(title: const Text('COMPARE OFFERS')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Overall Comparison',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          Text(_outcomeLabel(comparison?.outcome ?? 'INSUFFICIENT_EVIDENCE')),
          Text(comparison?.summary ?? decision.limitation),
          if (comparison != null) ...[
            _section(
              'Offer A',
              _offerCopy('Offer A', comparison.offerA, contextData?.offerA),
            ),
            _section(
              'Offer B',
              _offerCopy('Offer B', comparison.offerB, contextData?.offerB),
            ),
            _section('Timing Comparison', comparison.timingComparison),
          ],
          if (contextData?.priorities.isNotEmpty == true)
            _section('Alignment With Your Priorities', [
              'Your priorities: ${contextData!.priorities.join(', ')}.',
              if (comparison != null) ..._priorityCopy(comparison),
            ]),
          _section('Practical Trade-offs', _practicalTradeoffs(contextData)),
          if (comparison != null) ...[
            if (_hasPositiveSupport(comparison.offerA))
              _section(
                'What Supports Offer A',
                comparison.offerA.timing.message,
              ),
            if (_hasPositiveSupport(comparison.offerB))
              _section(
                'What Supports Offer B',
                comparison.offerB.timing.message,
              ),
          ],
          if (comparison != null && _meaningfulCautions(comparison).isNotEmpty)
            _section('What Needs Caution', [
              ..._meaningfulCautions(comparison),
            ]),
          _section(
            'Decision Summary',
            comparison?.summary ?? decision.limitation,
          ),
          _DetailedAstrology(
            detailed: decision.detailedAstrology,
            limitation: decision.limitation,
          ),
        ],
      ),
    );
  }

  static String _outcomeLabel(String outcome) => switch (outcome) {
    'OFFER_A_MORE_ALIGNED' => 'Offer A More Aligned',
    'OFFER_B_MORE_ALIGNED' => 'Offer B More Aligned',
    'SIMILAR_ALIGNMENT' => 'Similar Alignment',
    'INSUFFICIENT_EVIDENCE' => 'Insufficient Evidence',
    _ => 'Mixed',
  };

  static List<String> _offerCopy(
    String label,
    CareerOfferComparisonDetail detail,
    CareerDecisionOffer? offer,
  ) => [
    if (offer?.strengths.isNotEmpty == true)
      '$label strengths: ${offer!.strengths.join(', ')}.',
    if (offer?.strengths.isEmpty ?? true)
      'No additional offer-specific strengths were added.',
  ];

  static List<String> _priorityCopy(CareerOfferComparison comparison) {
    final a = comparison.offerA.priority;
    final b = comparison.offerB.priority;
    if (a.state == 'NOT_ASSESSED' && b.state == 'NOT_ASSESSED') {
      return const [
        'Based on the details provided, neither offer has a clear advantage against your selected priorities.',
      ];
    }
    return [
      if (a.state != 'NOT_ASSESSED') 'Offer A: ${a.message}',
      if (b.state != 'NOT_ASSESSED') 'Offer B: ${b.message}',
    ];
  }

  static bool _hasPositiveSupport(CareerOfferComparisonDetail detail) =>
      detail.timing.state == 'WITHIN_CURRENT_WINDOW' ||
      detail.priority.state == 'SUPPORTS_PRIORITY';

  static List<String> _meaningfulCautions(CareerOfferComparison comparison) => [
    ...comparison.offerA.cautions
        .where((item) => !item.toLowerCase().contains('joining date'))
        .map((item) => 'Offer A: $item'),
    ...comparison.offerB.cautions
        .where((item) => !item.toLowerCase().contains('joining date'))
        .map((item) => 'Offer B: $item'),
  ];

  static List<String> _practicalTradeoffs(CareerDecisionContext? context) => [
    'Role scope and responsibilities',
    'Compensation and benefits',
    'Learning and long-term trajectory',
    'Location, work model and joining terms',
    if (context?.offerA?.noticePeriodImpact?.isNotEmpty == true)
      'Offer A notice-period impact: ${context!.offerA!.noticePeriodImpact}',
    if (context?.offerB?.noticePeriodImpact?.isNotEmpty == true)
      'Offer B notice-period impact: ${context!.offerB!.noticePeriodImpact}',
  ];

  static Widget _section(String title, Object body) => Padding(
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

class _PromotionGrowthForm extends StatefulWidget {
  const _PromotionGrowthForm({required this.controller});
  final CareerDecisionController controller;
  @override
  State<_PromotionGrowthForm> createState() => _PromotionGrowthFormState();
}

class _PromotionGrowthFormState extends State<_PromotionGrowthForm> {
  final _form = GlobalKey<FormState>();
  final _goals = <String>{};
  final _review = TextEditingController(),
      _current = TextEditingController(),
      _desired = TextEditingController(),
      _concerns = TextEditingController();
  String? _discussions, _timeline;
  @override
  void dispose() {
    for (final c in [_review, _current, _desired, _concerns]) {
      c.dispose();
    }
    super.dispose();
  }

  void _submit() {
    if (!(_form.currentState?.validate() ?? false) ||
        _goals.isEmpty ||
        _discussions == null ||
        _timeline == null) {
      setState(() {});
      return;
    }
    widget.controller.submit(
      decisionType: 'PROMOTION_GROWTH',
      context: {
        'growthTypes': _goals.toList(growable: false),
        'managerDiscussionStatus': _discussions,
        'preferredTimeline': _timeline,
        if (_review.text.trim().isNotEmpty) 'reviewDate': _review.text.trim(),
        if (_current.text.trim().isNotEmpty)
          'currentRole': _current.text.trim(),
        if (_desired.text.trim().isNotEmpty) 'targetRole': _desired.text.trim(),
        if (_concerns.text.trim().isNotEmpty) 'concerns': _concerns.text.trim(),
      },
    );
  }

  @override
  Widget build(BuildContext context) => _DecisionFormScaffold(
    formKey: _form,
    title: 'Promotion / growth',
    controller: widget.controller,
    onSubmit: _submit,
    submitLabel: 'CONTINUE',
    children: [
      const Text('WHAT KIND OF GROWTH ARE YOU LOOKING FOR?'),
      Wrap(
        children: _growthGoals
            .map(
              (goal) => FilterChip(
                label: Text(goal),
                selected: _goals.contains(goal),
                onSelected: (_) => setState(
                  () => _goals.contains(goal)
                      ? _goals.remove(goal)
                      : _goals.add(goal),
                ),
              ),
            )
            .toList(),
      ),
      if (_goals.isEmpty) const Text('Choose at least one growth goal.'),
      _choice('Have discussions already started?', _discussions, const [
        ('YES', 'Yes'),
        ('NO', 'No'),
        ('INFORMALLY', 'Informally'),
        ('NOT_SURE', 'Not sure'),
      ], (value) => setState(() => _discussions = value)),
      _choice('Preferred / expected timeline', _timeline, const [
        ('THIS_MONTH', 'This month'),
        ('ONE_TO_THREE_MONTHS', 'Next 1–3 months'),
        ('THREE_TO_SIX_MONTHS', 'Next 3–6 months'),
        ('NO_FIXED_TIMELINE', 'No fixed timeline'),
      ], (value) => setState(() => _timeline = value)),
      _text(_review, 'Expected appraisal / review date (optional)'),
      _text(_current, 'Current role (optional)'),
      _text(_desired, 'Desired role / title (optional)'),
      _text(_concerns, 'Concerns (optional)', lines: 3),
    ],
  );
}

class _StartBusinessForm extends StatefulWidget {
  const _StartBusinessForm({required this.controller});
  final CareerDecisionController controller;
  @override
  State<_StartBusinessForm> createState() => _StartBusinessFormState();
}

class _StartBusinessFormState extends State<_StartBusinessForm> {
  final _form = GlobalKey<FormState>();
  final _category = TextEditingController(),
      _traction = TextEditingController(),
      _concerns = TextEditingController();
  String? _mode, _stage, _timeline, _founder, _reason, _runway;
  @override
  void dispose() {
    for (final c in [_category, _traction, _concerns]) {
      c.dispose();
    }
    super.dispose();
  }

  void _submit() {
    if (!(_form.currentState?.validate() ?? false) ||
        [
          _mode,
          _stage,
          _timeline,
          _founder,
          _reason,
        ].any((item) => item == null)) {
      setState(() {});
      return;
    }
    widget.controller.submit(
      decisionType: 'START_BUSINESS',
      context: {
        'startMode': _mode,
        'businessStage': _stage,
        'preferredTimeline': _timeline,
        'founderMode': _founder,
        'businessReason': _reason,
        if (_runway != null) 'runway': _runway,
        if (_category.text.trim().isNotEmpty)
          'businessCategory': _category.text.trim(),
        if (_traction.text.trim().isNotEmpty)
          'tractionSummary': _traction.text.trim(),
        if (_concerns.text.trim().isNotEmpty) 'concerns': _concerns.text.trim(),
      },
    );
  }

  @override
  Widget build(BuildContext context) => _DecisionFormScaffold(
    formKey: _form,
    title: 'Should I start a business?',
    controller: widget.controller,
    onSubmit: _submit,
    submitLabel: 'CONTINUE',
    children: [
      _choice('How are you planning to start?', _mode, const [
        ('FULL_TIME', 'Full-time'),
        ('ALONGSIDE_CURRENT_JOB', 'Alongside current job'),
        ('NOT_SURE', 'Not sure'),
      ], (value) => setState(() => _mode = value)),
      _choice('Current stage', _stage, const [
        ('IDEA', 'Idea'),
        ('RESEARCHING', 'Researching'),
        ('MVP_PROTOTYPE', 'MVP / prototype'),
        ('EARLY_CUSTOMERS', 'Early customers'),
        ('REVENUE_ALREADY', 'Revenue already'),
        ('EXISTING_BUSINESS', 'Existing business'),
      ], (value) => setState(() => _stage = value)),
      _choice('When are you considering starting?', _timeline, const [
        ('NOW', 'Now'),
        ('ONE_TO_THREE_MONTHS', 'Within 1–3 months'),
        ('THREE_TO_SIX_MONTHS', 'Within 3–6 months'),
        ('SIX_TO_TWELVE_MONTHS', 'Within 6–12 months'),
        ('NO_FIXED_TIMELINE', 'No fixed timeline'),
      ], (value) => setState(() => _timeline = value)),
      _choice('Starting', _founder, const [
        ('SOLO', 'Solo'),
        ('COFOUNDER', 'Cofounder'),
        ('NOT_DECIDED', 'Not decided'),
      ], (value) => setState(() => _founder = value)),
      _choice('Main reason', _reason, const [
        ('Independence', 'Independence'),
        ('Long-term ambition', 'Long-term ambition'),
        ('Income upside', 'Income upside'),
        ('Existing traction', 'Existing traction'),
        ('Current job dissatisfaction', 'Current job dissatisfaction'),
        ('Opportunity identified', 'Opportunity identified'),
        ('Other', 'Other'),
      ], (value) => setState(() => _reason = value)),
      _choice(
        'Runway (optional)',
        _runway,
        const [
          ('UNDER_THREE_MONTHS', '<3 months'),
          ('THREE_TO_SIX_MONTHS', '3–6 months'),
          ('SIX_TO_TWELVE_MONTHS', '6–12 months'),
          ('TWELVE_PLUS_MONTHS', '12+ months'),
          ('PREFER_NOT_TO_SAY', 'Prefer not to say'),
        ],
        (value) => setState(() => _runway = value),
        required: false,
      ),
      _text(_category, 'Business category (optional)'),
      _text(_traction, 'Traction summary (optional)', lines: 2),
      _text(_concerns, 'Concerns (optional)', lines: 3),
    ],
  );
}

class _CareerAbroadForm extends StatefulWidget {
  const _CareerAbroadForm({required this.controller});
  final CareerDecisionController controller;
  @override
  State<_CareerAbroadForm> createState() => _CareerAbroadFormState();
}

class _CareerAbroadFormState extends State<_CareerAbroadForm> {
  final _form = GlobalKey<FormState>();
  final _region = TextEditingController(),
      _stage = TextEditingController(),
      _movement = TextEditingController(),
      _concerns = TextEditingController();
  String? _path, _applying, _timeline, _priority;
  @override
  void dispose() {
    for (final c in [_region, _stage, _movement, _concerns]) {
      c.dispose();
    }
    super.dispose();
  }

  void _submit() {
    if (!(_form.currentState?.validate() ?? false) ||
        [_path, _applying, _timeline, _priority].any((item) => item == null)) {
      setState(() {});
      return;
    }
    widget.controller.submit(
      decisionType: 'CAREER_ABROAD',
      context: {
        'abroadPath': _path,
        'activelyInterviewing': _applying,
        'preferredTimeline': _timeline,
        'priority': _priority,
        if (_region.text.trim().isNotEmpty) 'targetRegion': _region.text.trim(),
        if (_stage.text.trim().isNotEmpty)
          'applicationStage': _stage.text.trim(),
        if (_movement.text.trim().isNotEmpty)
          'movementDate': _movement.text.trim(),
        if (_concerns.text.trim().isNotEmpty) 'concerns': _concerns.text.trim(),
      },
    );
  }

  @override
  Widget build(BuildContext context) => _DecisionFormScaffold(
    formKey: _form,
    title: 'Career abroad',
    controller: widget.controller,
    onSubmit: _submit,
    submitLabel: 'CONTINUE',
    children: [
      _choice('What kind of international move?', _path, const [
        ('OVERSEAS_JOB', 'Overseas job'),
        ('RELOCATION', 'Relocation'),
        ('REMOTE_FOREIGN_COMPANY', 'Remote role for foreign company'),
        ('INTERNAL_INTERNATIONAL_TRANSFER', 'Internal international transfer'),
        ('STUDY_TO_WORK', 'Study-to-work path'),
      ], (value) => setState(() => _path = value)),
      _choice('Are you already applying?', _applying, const [
        ('YES', 'Yes'),
        ('NO', 'No'),
        ('EXPLORING', 'Just exploring'),
      ], (value) => setState(() => _applying = value)),
      _choice('Target timeline', _timeline, const [
        ('IMMEDIATELY', 'Immediately'),
        ('ONE_TO_THREE_MONTHS', 'Within 1–3 months'),
        ('THREE_TO_SIX_MONTHS', 'Within 3–6 months'),
        ('SIX_TO_TWELVE_MONTHS', 'Within 6–12 months'),
        ('NO_FIXED_TIMELINE', 'No fixed timeline'),
      ], (value) => setState(() => _timeline = value)),
      _choice('Priority', _priority, const [
        ('Career growth', 'Career growth'),
        ('Compensation', 'Compensation'),
        ('Immigration / settlement', 'Immigration / settlement'),
        ('Lifestyle', 'Lifestyle'),
        ('International exposure', 'International exposure'),
        ('Long-term career path', 'Long-term career path'),
      ], (value) => setState(() => _priority = value)),
      _text(_region, 'Target country / region (optional)'),
      _text(_stage, 'Application stage (optional)'),
      _text(_movement, 'Expected joining / movement date (optional)'),
      _text(_concerns, 'Concerns (optional)', lines: 3),
    ],
  );
}

const _growthGoals = [
  'Promotion',
  'Salary increase',
  'Bigger responsibilities',
  'Leadership role',
  'Internal transfer',
  'Recognition / visibility',
  'Role expansion',
];

class _DecisionFormScaffold extends StatelessWidget {
  const _DecisionFormScaffold({
    required this.formKey,
    required this.title,
    required this.controller,
    required this.onSubmit,
    required this.submitLabel,
    required this.children,
  });
  final GlobalKey<FormState> formKey;
  final String title, submitLabel;
  final CareerDecisionController controller;
  final VoidCallback onSubmit;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(title.toUpperCase())),
    body: Form(
      key: formKey,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 25, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 18),
          ...children,
          if (controller.state == CareerDecisionLoadState.error)
            const Padding(
              padding: EdgeInsets.only(top: 12),
              child: Text(
                'We could not prepare your decision view. Please try again.',
              ),
            ),
          Padding(
            padding: const EdgeInsets.only(top: 18),
            child: FilledButton(
              onPressed: onSubmit,
              child: Text(
                controller.state == CareerDecisionLoadState.error
                    ? 'RETRY'
                    : submitLabel,
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

Widget _choice(
  String label,
  String? value,
  List<(String, String)> choices,
  ValueChanged<String?> onChanged, {
  bool required = true,
}) => Padding(
  padding: const EdgeInsets.only(top: 12),
  child: DropdownButtonFormField<String>(
    initialValue: value,
    decoration: InputDecoration(labelText: label),
    items: choices
        .map((item) => DropdownMenuItem(value: item.$1, child: Text(item.$2)))
        .toList(),
    validator: required ? (item) => item == null ? 'Required' : null : null,
    onChanged: onChanged,
  ),
);
Widget _text(TextEditingController controller, String label, {int lines = 1}) =>
    Padding(
      padding: const EdgeInsets.only(top: 12),
      child: TextFormField(
        controller: controller,
        maxLines: lines,
        decoration: InputDecoration(labelText: label),
      ),
    );

class _ContextualDecisionResult extends StatelessWidget {
  const _ContextualDecisionResult({required this.decision});
  final CareerDecision decision;
  bool get _promotion => decision.decisionType == 'PROMOTION_GROWTH';
  bool get _business => decision.decisionType == 'START_BUSINESS';
  bool get _abroad => decision.decisionType == 'CAREER_ABROAD';
  @override
  Widget build(BuildContext context) {
    final data = decision.context;
    final timing = decision.timing;
    final labels = _promotion
        ? (
            'PROMOTION / GROWTH',
            'Current Growth Context',
            'Stronger Growth Window',
            'What Type of Growth Looks Better Supported',
            'What Supports Growth',
            'What May Slow Progress',
            'Practical Growth Factors',
            'What To Do',
          )
        : _business
        ? (
            'START A BUSINESS',
            'Entrepreneurial Context',
            'Stronger Business-Building Window',
            'Build Now vs Prepare First',
            'What Supports Entrepreneurship',
            'What Needs Caution',
            'Practical Readiness',
            'Suggested Next Step',
          )
        : (
            'CAREER ABROAD',
            'International Career Outlook',
            'Application / Exploration Timing',
            'Movement / Joining Timing',
            'What Supports International Opportunities',
            'What Needs Caution',
            'Practical Preparation',
            'What To Do',
          );
    final contextual = _promotion
        ? [
            if (data?.growthTypes.isNotEmpty == true)
              'Growth focus: ${data!.growthTypes.join(', ')}.',
            if (data?.managerDiscussionStatus != null)
              'Discussion status: ${data!.managerDiscussionStatus}.',
          ]
        : _business
        ? [
            if (data?.startMode != null) 'Start plan: ${data!.startMode}.',
            if (data?.businessStage != null)
              'Current stage: ${data!.businessStage}.',
            if (data?.runway != null) 'Runway shared: ${data!.runway}.',
          ]
        : [
            if (data?.abroadPath != null) 'Path: ${data!.abroadPath}.',
            if (data?.activelyInterviewing != null)
              'Application status: ${data!.activelyInterviewing}.',
            if (data?.priority != null) 'Priority: ${data!.priority}.',
          ];
    final movementKnown = data?.movementDate?.isNotEmpty == true;
    return Scaffold(
      appBar: AppBar(title: Text(labels.$1)),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Overall View',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          Text(_Result._stateLabel(decision.state)),
          if (decision.overall.isNotEmpty) Text(decision.overall),
          _resultSection(
            labels.$2,
            contextual.isEmpty ? decision.limitation : contextual,
          ),
          _resultSection(
            labels.$3,
            timing == null
                ? 'TaraVerse does not have a supported Career timing window for this decision.'
                : '${DateFormat('d MMM y').format(timing.start)} – ${DateFormat('d MMM y').format(timing.end)}',
          ),
          if (_abroad)
            _resultSection(
              labels.$4,
              movementKnown
                  ? 'Your expected movement or joining date is included for practical planning.'
                  : 'Movement or joining timing can be assessed once you know the expected date.',
            ),
          if (!_abroad)
            _resultSection(
              labels.$4,
              _business
                  ? 'Timing may support building and testing, but it is not sufficient on its own to justify leaving stable income.'
                  : 'The saved Career evidence does not distinguish a guaranteed outcome between these growth paths.',
            ),
          _resultSection(
            labels.$5,
            decision.supports.isEmpty
                ? [
                    'TaraVerse is using the saved Career evidence available for this decision.',
                  ]
                : decision.supports,
          ),
          if (decision.cautions.isNotEmpty)
            _resultSection(labels.$6, decision.cautions),
          _resultSection(labels.$7, decision.practicalFactors),
          _resultSection(labels.$8, decision.whatToDo),
          _DetailedAstrology(
            detailed: decision.detailedAstrology,
            limitation: decision.limitation,
          ),
        ],
      ),
    );
  }

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
