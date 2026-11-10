import 'career_explanation_language.dart';

/// Deterministic, presentation-only copy for structured Career Readings.
/// Structured facts, dates, ranking, and statuses stay backend-authoritative.
class CareerReadingPresentationCopy {
  const CareerReadingPresentationCopy(this.language);
  final CareerExplanationLanguage language;
  bool get isHinglish => language == CareerExplanationLanguage.hinglish;

  String insightSummary(String family) => isHinglish
      ? const {
              'CAREER_FOUNDATION': 'Aapki Janam Kundli mein Career ka base 10th Bhav se jude factors par based hai.',
              'ACTIVE_CAREER_DASHA': 'Aapki current Dasha timing Janam Kundli ke Career-related factors se connect ho rahi hai.',
              'CURRENT_CAREER_TRANSIT': 'Abhi ka Gochar aapke Career se jude ek important factor ko activate kar raha hai. Isliye yeh Gochar abhi Career ke current phase ko samajhne mein relevant hai.',
              'CONCURRENT_CAREER_TIMING': 'Yeh period available Career timing factors ko ek saath dekhne ka context deta hai.',
              'HISTORICAL_CALIBRATION_RECURRENCE': 'Aapke saved Career events mein similar timing pattern pehle bhi dikha hai.',
              'FUTURE_RECURRENCE_WINDOW': 'Aane wali ek timing window aapki saved Career History mein dekhe gaye pattern se match karti hai.',
              'AUDITED_CLASSICAL_PREDICATE': 'Supplied evidence existing audited classical predicate ko satisfy karta hai; isse koi Career outcome establish nahi hota.',
            }[family] ??
            'Yeh deterministic Career Insight aapki stored Reading se available hai.'
      : const {
              'CAREER_FOUNDATION': 'Your Career foundation is shaped by the 10th House and its lord. The detailed factors below add context rather than a standalone prediction.',
              'ACTIVE_CAREER_DASHA': 'Your current Dasha timing connects to Career-related factors in the natal chart.',
              'CURRENT_CAREER_TRANSIT': 'A current transit is activating a Career-related natal factor used by this reading.',
              'CONCURRENT_CAREER_TIMING': 'This period provides context from the available Career timing factors considered together.',
              'HISTORICAL_CALIBRATION_RECURRENCE':
                  'Similar timing appeared across your saved Career events.',
              'FUTURE_RECURRENCE_WINDOW': 'An upcoming period matches a timing pattern seen in your saved Career history.',
              'AUDITED_CLASSICAL_PREDICATE': 'An audited classical Career indicator is present; it does not establish a specific outcome.',
            }[family] ??
            'This deterministic Career Insight is available from your stored reading.';

  String caveat(String status) => isHinglish
      ? const {
              'MIXED': 'Is waqt kuch Career indicators supportive hain, lekin sabhi signals ek hi direction mein align nahi ho rahe.',
              'CONTRADICTED': 'Current evidence is signal ko consistently support nahi kar raha.',
              'INSUFFICIENT_EVIDENCE': 'Abhi timing ki picture poori tarah clear nahi hai, isliye is period ko lekar final baat nahi kahi ja rahi.',
            }[status] ??
            'Additional deterministic context available hai.'
      : const {
              'MIXED': 'The current reading contains both supportive and limiting Career context.',
              'CONTRADICTED': 'The relevant deterministic evidence contains an explicit contradiction.',
              'INSUFFICIENT_EVIDENCE': 'The available evidence is not strong enough for a firm timing conclusion, so treat this period as supporting context.',
            }[status] ??
            'Additional deterministic context is available.';

  String get limitationHeading =>
      isHinglish ? 'KYA DHYAN RAKHEIN' : 'WHAT TO KEEP IN MIND';

  String get noCurrentCareerTransit => isHinglish
      ? 'Abhi koi strong Career-specific Gochar activation identify nahi hui hai.'
      : 'No strong Career-specific transit activation is currently identified.';

  String transitRelevance(String? value) => isHinglish
      ? const {
              'DIRECT_10TH_HOUSE_TRANSIT': 'Direct Career-axis activation',
              'ASPECTS_10TH_HOUSE': 'Career axis par direct drishti',
              'ACTIVATES_10TH_LORD': '10th lord activation',
              'ACTIVATES_6TH_HOUSE': 'Work aur service context',
              'ACTIVATES_11TH_HOUSE': 'Professional gains context',
              'ACTIVATES_2ND_HOUSE': 'Income-related Career context',
              'D10_SUPPORT': 'Additional D10 context',
              'SECONDARY_CONTEXT': 'Secondary Career context',
            }[value] ??
            'Career context'
      : const {
              'DIRECT_10TH_HOUSE_TRANSIT': 'Direct Career-axis activation',
              'ASPECTS_10TH_HOUSE': 'Direct aspect to the Career axis',
              'ACTIVATES_10TH_LORD': '10th-lord activation',
              'ACTIVATES_6TH_HOUSE': 'Work and service context',
              'ACTIVATES_11TH_HOUSE': 'Professional gains context',
              'ACTIVATES_2ND_HOUSE': 'Income-related Career context',
              'D10_SUPPORT': 'Additional D10 context',
              'SECONDARY_CONTEXT': 'Secondary Career context',
            }[value] ??
            'Career context';

  String careerHistory(String level, int? count) {
    if (!isHinglish) {
      return switch (level) {
        'NONE' =>
          'Past Career Events can help personalize this reading further.',
        'LIMITED' =>
          '${count ?? 1} saved Career event${count == 1 ? '' : 's'}. Add more history for recurring-pattern comparison.',
        'CALIBRATED' =>
          count == null
              ? 'Career History is available for recurring-pattern comparison.'
              : '$count saved Career event${count == 1 ? '' : 's'} available for recurring-pattern comparison.',
        _ => 'Career History is available for this reading.',
      };
    }
    return switch (level) {
      'NONE' => 'Past Career Events is Reading ko aur personalize karne mein help kar sakte hain.',
      'LIMITED' =>
        'Abhi ${count ?? 1} Career event saved hai. Recurring-pattern comparison ke liye thodi aur Career History add karein.',
      'CALIBRATED' =>
        count == null
            ? 'Career History recurring timing patterns compare karne ke liye available hai.'
            : 'Aapke $count saved Career events recurring timing patterns compare karne ke liye available hain.',
      _ => 'Career History is Reading ke liye available hai.',
    };
  }

  String planet(Object? value) => '${value ?? 'Planet'}';
  String state(Object? value) => isHinglish
      ? const {
              'RETROGRADE': 'Vakri',
              'COMBUST': 'Asta',
              'EXALTED': 'Exalted',
              'DEBILITATED': 'Debilitated',
              'OWN_SIGN': 'Own Sign',
              'MOOLATRIKONA': 'Moolatrikona',
            }[value] ??
            'State'
      : const {
              'RETROGRADE': 'Retrograde',
              'COMBUST': 'Combust',
              'EXALTED': 'Exalted',
              'DEBILITATED': 'Debilitated',
              'OWN_SIGN': 'Own Sign',
              'MOOLATRIKONA': 'Moolatrikona',
            }[value] ??
            'State';
  String house(int value) =>
      isHinglish ? '${value}th Bhav' : '${ordinal(value)} House';

  String ashtakavargaCorroboration(int sav) => isHinglish
      ? 'Aapki Janam Kundli mein Career structure 10th Bhav factors se already identify hua hai. Ashtakavarga yahan additional context deta hai: 10th Bhav mein $sav SAV bindus hain.'
      : 'Your natal Career structure is already identified through 10th House factors in your birth chart. Ashtakavarga adds context here: the 10th House carries $sav SAV bindus.';

  String get ashtakavargaCorroborationLimitation => isHinglish
      ? 'Yeh corroborating structural context hai, promotion, job change, income ya timing ka standalone prediction nahi.'
      : 'This is corroborating structural context, not a standalone prediction of promotion, job change, income, or timing.';

  String synthesisFoundation() => isHinglish
      ? 'Aapka overall Career picture mainly 10th House aur uske lord se jude factors par based hai.'
      : 'Your overall Career picture is shaped primarily by the 10th House and its lord.';
  String synthesisAshtakavarga(int sav) => isHinglish
      ? 'Ashtakavarga isi Career foundation ko additional context deta hai: 10th Bhav mein $sav SAV bindus hain. Yeh promotion, job change, income ya timing ka standalone prediction nahi.'
      : 'Ashtakavarga adds another layer of context: the 10th House carries $sav SAV bindus. This is not a standalone prediction of promotion, job change, income, or timing.';
  String synthesisTiming({
    required bool activeDasha,
    required bool currentTransit,
    required bool concurrent,
    required bool limited,
  }) {
    if (concurrent) {
      return isHinglish
          ? 'Existing Career-related Dasha aur Gochar timing layers saath mein present hain. Isse outcome ki guarantee nahi banti.'
          : 'Existing Career-related Dasha and transit timing layers are present together. This does not establish an outcome.';
    }
    if (activeDasha && currentTransit) {
      return isHinglish
          ? 'Current Dasha aur Gochar dono Career-related context provide kar rahe hain. Isse direct outcome prediction nahi maana ja raha.'
          : 'Current Dasha and transit evidence both provide Career-related context. This is not being treated as a direct outcome prediction.';
    }
    if (activeDasha || currentTransit) {
      return isHinglish
          ? 'Available current timing evidence Career-related themes ko context deta hai, lekin ise standalone prediction ke roop mein read nahi kiya ja raha.'
          : 'Available current timing evidence provides context for Career-related themes, without being read as a standalone prediction.';
    }
    if (limited) {
      return isHinglish
          ? 'Abhi timing ki picture poori tarah clear nahi hai, isliye is period ko lekar final baat nahi kahi ja rahi.'
          : 'Available Career timing evidence remains limited, so no direct timing conclusion is being made.';
    }
    return '';
  }

  String synthesisCalibration(String level, int? count) => isHinglish
      ? switch (level) {
          'CALIBRATED' =>
            'Aapke ${count ?? 'saved'} recorded Career events historical context add karte hain aur recurring patterns samajhne mein help karte hain.',
          'LIMITED' => 'Aapki recorded Career History ka personal context abhi limited hai.',
          _ => '',
        }
      : switch (level) {
          'CALIBRATED' =>
            '${count ?? 'Saved'} recorded Career events add personal context for how similar patterns appeared previously; this is not a future outcome forecast.',
          'LIMITED' => 'Your recorded Career History provides limited personal context at present.',
          _ => '',
        };
  String get synthesisFutureRecurrence => isHinglish
      ? 'Existing engine ne saved Career History se linked ek future recurrence window identify ki hai.'
      : 'The existing engine has identified a future recurrence window linked to your saved Career History.';

  String get ashtakavargaStructureIntro => isHinglish
      ? 'Yeh aapki D1 Kundli ke Career se jude important Bhavon ke factual Ashtakavarga values hain.'
      : 'These are factual Ashtakavarga values for key Career-linked houses in your D1 chart.';

  String get ashtakavargaStructureNote => isHinglish
      ? 'Yeh scores relevant houses ki structural strength dikhate hain. Inhe standalone prediction ki tarah use nahi karna chahiye.'
      : 'These scores describe structural strength in the relevant houses. They are supporting evidence, not standalone predictions.';

  String get d10StructureIntro => isHinglish
      ? 'D10 snapshot professional structure ke relevant placements aur aspects dikhata hai.'
      : 'This D10 snapshot shows the relevant professional placements and aspects.';

  String get d10ThemesIntro => isHinglish
      ? 'Relevant D10 placements se yeh concise Career themes milte hain.'
      : 'The relevant D10 placements provide these concise Career themes.';

  String get d10ThemesLimitation => isHinglish
      ? 'Yeh D10 context Career ki overall picture ko samajhne mein help karta hai, lekin final prediction sirf D10 ke basis par nahi ki jaati.'
      : 'This supports the D1 Career foundation; it is not a standalone prediction.';

  String d10Theme(String theme, Object? planet) {
    final name = this.planet(planet);
    if (!isHinglish) {
      return switch (theme) {
        'AUTHORITY_ADMINISTRATION' =>
          '$name: authority, administration and public responsibility',
        'PEOPLE_CARE_PUBLIC' =>
          '$name: people-facing work, care and public interaction',
        'EXECUTION_TECHNICAL' =>
          '$name: execution, technical and operational work',
        'COMMUNICATION_COMMERCE_TECH' =>
          '$name: communication, technology and commercial work',
        'ADVISORY_KNOWLEDGE' =>
          '$name: advisory, teaching and knowledge-oriented work',
        'DESIGN_LUXURY_CLIENT' =>
          '$name: design, aesthetics and client-facing value',
        'STRUCTURE_OPERATIONS' => '$name: structure, discipline and operations',
        'UNCONVENTIONAL_TECH_GLOBAL' =>
          '$name: unconventional work, technology and global exposure',
        'RESEARCH_SPECIALIZATION' =>
          '$name: research, specialization and technical depth',
        _ => '',
      };
    }
    return switch (theme) {
      'AUTHORITY_ADMINISTRATION' =>
        '$name: authority, administration aur public responsibility',
      'PEOPLE_CARE_PUBLIC' =>
        '$name: people-facing work, care aur public interaction',
      'EXECUTION_TECHNICAL' =>
        '$name: execution, technical aur operational work',
      'COMMUNICATION_COMMERCE_TECH' =>
        '$name: communication, technology aur commercial work',
      'ADVISORY_KNOWLEDGE' =>
        '$name: teaching, guidance aur knowledge-based work',
      'DESIGN_LUXURY_CLIENT' =>
        '$name: design, aesthetics aur client-facing value',
      'STRUCTURE_OPERATIONS' => '$name: structure, discipline aur operations',
      'UNCONVENTIONAL_TECH_GLOBAL' =>
        '$name: unconventional work, technology aur global exposure',
      'RESEARCH_SPECIALIZATION' =>
        '$name: research, specialization aur technical depth',
      _ => '',
    };
  }

  String get forecastMeaning => isHinglish
      ? 'Is dauran interviews, networking, important Career conversations aur professional opportunities zyada relevant ho sakte hain.'
      : 'Interviews, networking, important Career conversations and professional opportunities may become more relevant during this period.';

  List<String> get forecastActions => isHinglish
      ? const [
          'Is window se pehle applications, interview preparation aur networking ko actively plan karein.',
          'Important Career conversations is period ke around schedule karna useful ho sakta hai.',
          'Supportive timing ko context ki tarah use karein, guarantee ki tarah nahi.',
          'Specific offer ya job-switch decision ke liye Career Decisions use karein.',
        ]
      : const [
          'Use the weeks before this window for applications, interview preparation and networking.',
          'Consider scheduling important Career conversations during this period.',
          'Treat supportive timing as context, not a guarantee.',
          'Use Career Decisions for a specific offer or job-switch decision.',
        ];

  String dasha(Object? value) => isHinglish
      ? const {
              'MAHADASHA': 'Mahadasha',
              'ANTARDASHA': 'Antardasha',
              'PRATYANTAR_DASHA': 'Pratyantar Dasha',
            }[value] ??
            'Dasha'
      : const {
              'MAHADASHA': 'Mahadasha',
              'ANTARDASHA': 'Antardasha',
              'PRATYANTAR_DASHA': 'Pratyantar',
            }[value] ??
            'Dasha';
  String ordinal(int value) {
    final tens = value % 100;
    if (tens >= 11 && tens <= 13) {
      return '${value}th';
    }
    return switch (value % 10) {
      1 => '${value}st',
      2 => '${value}nd',
      3 => '${value}rd',
      _ => '${value}th',
    };
  }
}
