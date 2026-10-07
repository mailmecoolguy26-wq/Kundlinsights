import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../career_answer_controller.dart';
import '../domain/career_answer.dart';
import '../../readings/astrology_presentation_copy.dart';

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
                : widget.controller.answer!.questionType ==
                        CareerQuestionType.jobFavourabilityTiming
                    ? _JobFavourabilityBody(answer: widget.controller.answer!)
                    : _AnswerBody(answer: widget.controller.answer!),
        },
      );
    },
  );
}

class _JobFavourabilityBody extends StatelessWidget {
  const _JobFavourabilityBody({required this.answer});
  final CareerAnswer answer;

  @override
  Widget build(BuildContext context) {
    final beta = answer.jobFavourability;
    if (beta == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'A stronger Career window is not available in this beta yet.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFFA8B7B4)),
          ),
        ),
      );
    }
    final copy = _JobWindowCopy.of(context);
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        const _Label('ANSWER'),
        const SizedBox(height: 8),
        _Card(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(copy.title, style: const TextStyle(color: Color(0xFFF7F4EC), fontSize: 24, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            Text(copy.subtitle, style: const TextStyle(color: Color(0xFFD7E1DE), height: 1.45)),
          ]),
        ),
        const SizedBox(height: 22),
        const _Label('WINDOW'),
        const SizedBox(height: 8),
        _Card(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(_jobRange(beta.window), style: const TextStyle(color: Color(0xFFD6B15A), fontWeight: FontWeight.w800, fontSize: 18)),
            const SizedBox(height: 8),
            Text(beta.strength == 'STRONGER' ? copy.stronger : copy.moderate, style: const TextStyle(color: Color(0xFF35B9AC), fontWeight: FontWeight.w700)),
            if (beta.narrowerWindow != null) ...[
              const SizedBox(height: 10),
              Text(copy.narrower(_jobRange(beta.narrowerWindow!)), style: const TextStyle(color: Color(0xFFA8B7B4))),
            ],
          ]),
        ),
        const SizedBox(height: 22),
        const _Label('ACTION'),
        const SizedBox(height: 8),
        _Card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          for (final item in beta.actionCodes) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text('• ${copy.action(item)}', style: const TextStyle(color: Color(0xFFD7E1DE), height: 1.4))),
          Text(copy.disclaimer(beta.limitationCode), style: const TextStyle(color: Color(0xFF8C9D99), height: 1.4)),
        ])),
        const SizedBox(height: 22),
        ExpansionTile(
          collapsedIconColor: const Color(0xFFD6B15A), iconColor: const Color(0xFFD6B15A),
          title: Text(copy.whyTitle, style: const TextStyle(color: Color(0xFFF7F4EC), fontWeight: FontWeight.w700)),
          subtitle: Text(copy.agreement(beta.evidenceAgreementCount), style: const TextStyle(color: Color(0xFFA8B7B4))),
          children: [for (final reason in beta.reasonCodes) ListTile(title: Text(copy.reason(reason), style: const TextStyle(color: Color(0xFFD7E1DE))))],
        ),
      ],
    );
  }

  String _jobRange(JobFavourabilityWindow window) {
    final format = DateFormat('d MMM yyyy');
    return '${format.format(window.start)} – ${format.format(window.end)}';
  }
}

class _JobWindowCopy {
  const _JobWindowCopy._(
    this.language,
    this.title,
    this.subtitle,
    this.stronger,
    this.moderate,
    this.whyTitle,
    this._agreement,
    this._narrower,
  );
  final _JobCopyLanguage language;
  final String title; final String subtitle; final String stronger; final String moderate; final String whyTitle;
  final String Function(int) _agreement; final String Function(String) _narrower;
  String agreement(int count) => _agreement(count);
  String narrower(String range) => _narrower(range);
  String reason(String code) => switch (code) {
    'CAREER_TIMING_ACTIVATED' => _reasonCareerTiming,
    'JUPITER_WORK_RELATED_AREA' => _reasonJupiter,
    'MAJOR_CAREER_TRANSITS_ACTIVE' => _reasonTransits,
    'SUPPORTING_CHART_FACTORS_ALIGN' => _reasonSupport,
    _ => '',
  };
  String action(String code) => switch (code) {
    'PREPARE_CAREER_MATERIALS_AND_CONVERSATIONS' => _actionPrepare,
    'REVIEW_PRACTICAL_ROLES_OPPORTUNITIES_AND_DECISIONS' => _actionReview,
    _ => '',
  };
  String disclaimer(String code) => switch (code) {
    'BETA_DESCRIPTIVE_CONVERGENCE_ONLY' => _disclaimer,
    _ => _disclaimer,
  };
  static _JobWindowCopy of(BuildContext context) {
    final presentation = AstrologyPresentationCopy.of(context);
    if (presentation.isHinglish) {
      return const _JobWindowCopy._(
        _JobCopyLanguage.hinglish,
        'Stronger Career Window', 'Ek period jahan multiple Career-related signals align hote hain.',
        'Stronger Support', 'Moderate Support', 'WHY TARAVERSE THINKS THIS',
        _hinglishAgreement, _hinglishNarrower,
      );
    }
    if (Localizations.localeOf(context).languageCode == 'hi') {
      return const _JobWindowCopy._(
        _JobCopyLanguage.hindi,
        'मज़बूत करियर विंडो', 'एक अवधि जहाँ करियर से जुड़े कई संकेत एक साथ आते हैं।',
        'मज़बूत सहयोग', 'मध्यम सहयोग', 'तारावर्स ऐसा क्यों सोचता है',
        _hindiAgreement, _hindiNarrower,
      );
    }
    return const _JobWindowCopy._(
      _JobCopyLanguage.english,
      'Stronger Career Window', 'A period where multiple career-related signals align.',
      'Stronger Support', 'Moderate Support', 'WHY TARAVERSE THINKS THIS',
      _englishAgreement, _englishNarrower,
    );
  }
  static String _englishAgreement(int value) => '$value evidence signals align in this context';
  static String _englishNarrower(String value) => 'More focused context: $value';
  static String _hinglishAgreement(int value) => '$value evidence signals is context mein align hote hain';
  static String _hinglishNarrower(String value) => 'More focused context: $value';
  static String _hindiAgreement(int value) => 'इस संदर्भ में $value प्रमाण संकेत एक साथ आते हैं';
  static String _hindiNarrower(String value) => 'अधिक केंद्रित संदर्भ: $value';
  String get _reasonCareerTiming => _isHindi ? 'करियर टाइमिंग सक्रिय है' : _isHinglish ? 'Career timing active hai' : 'Career timing is activated';
  String get _reasonJupiter => _isHindi ? 'बृहस्पति काम से जुड़े क्षेत्र को सहारा देता है' : _isHinglish ? 'Guru Dev work-related area ko support karte hain' : 'Jupiter supports a work-related area';
  String get _reasonTransits => _isHindi ? 'मुख्य करियर गोचर सक्रिय हैं' : _isHinglish ? 'Major Career Gochar active hain' : 'Major career transits are active';
  String get _reasonSupport => _isHindi ? 'सहायक चार्ट कारक एक साथ आते हैं' : _isHinglish ? 'Supporting chart factors align hote hain' : 'Supporting chart factors align';
  String get _actionPrepare => _isHindi ? 'व्यावहारिक करियर सामग्री और बातचीत की तैयारी करें।' : _isHinglish ? 'Practical Career materials aur conversations ki preparation karein.' : 'Prepare practical Career materials and conversations.';
  String get _actionReview => _isHindi ? 'वर्तमान भूमिकाओं, अवसरों और निर्णयों को वास्तविक जानकारी के साथ देखें।' : _isHinglish ? 'Current roles, opportunities aur decisions ko real-world information ke saath review karein.' : 'Review current roles, opportunities, and decisions using real-world information.';
  String get _disclaimer => _isHindi ? 'यह बीटा कई करियर-संबंधित संकेतों के मेल का वर्णन करता है। यह रोजगार, प्रस्ताव या किसी निश्चित परिणाम की गारंटी नहीं देता।' : _isHinglish ? 'Yeh beta multiple Career-related signals ke alignment ko describe karta hai. Yeh employment, offer ya kisi specific outcome ki guarantee nahi deta.' : 'This beta describes multiple Career-related signals aligning. It does not guarantee employment, an offer, or a specific outcome.';
  bool get _isHinglish => language == _JobCopyLanguage.hinglish;
  bool get _isHindi => language == _JobCopyLanguage.hindi;
}

enum _JobCopyLanguage { english, hindi, hinglish }

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
