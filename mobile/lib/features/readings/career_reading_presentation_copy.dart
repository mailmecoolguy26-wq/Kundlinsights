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
              'CURRENT_CAREER_TRANSIT': 'Abhi ka Gochar Janam Kundli ke ek Career-related factor ko activate kar raha hai, jise is Reading mein consider kiya gaya hai.',
              'CONCURRENT_CAREER_TIMING': 'Available Career timing evidence abhi is signal ko fully evaluate karne ke liye sufficient nahi hai.',
              'HISTORICAL_CALIBRATION_RECURRENCE': 'Aapke saved Career events mein similar timing pattern pehle bhi dikha hai.',
              'FUTURE_RECURRENCE_WINDOW': 'Aane wali ek timing window aapki saved Career History mein dekhe gaye pattern se match karti hai.',
              'AUDITED_CLASSICAL_PREDICATE': 'Supplied evidence existing audited classical predicate ko satisfy karta hai; isse koi Career outcome establish nahi hota.',
            }[family] ??
            'Yeh deterministic Career Insight aapki stored Reading se available hai.'
      : const {
              'CAREER_FOUNDATION': 'Your natal Career structure is centered on the 10th-house factors identified in your chart.',
              'ACTIVE_CAREER_DASHA': 'Your current Dasha timing connects to Career-related factors in the natal chart.',
              'CURRENT_CAREER_TRANSIT': 'A current transit is activating a Career-related natal factor used by this reading.',
              'CONCURRENT_CAREER_TIMING': 'Available Career timing evidence is insufficient to evaluate this signal fully.',
              'HISTORICAL_CALIBRATION_RECURRENCE':
                  'Similar timing appeared across your saved Career events.',
              'FUTURE_RECURRENCE_WINDOW': 'An upcoming period matches a timing pattern seen in your saved Career history.',
              'AUDITED_CLASSICAL_PREDICATE': 'The supplied evidence satisfies the existing audited classical predicate; this does not establish an outcome.',
            }[family] ??
            'This deterministic Career Insight is available from your stored reading.';

  String caveat(String status) => isHinglish
      ? const {
              'MIXED': 'Is waqt kuch Career indicators support kar rahe hain, lekin kuch evidence fully align nahi ho raha.',
              'CONTRADICTED': 'Current evidence is signal ko consistently support nahi kar raha.',
              'INSUFFICIENT_EVIDENCE': 'Available Career timing evidence abhi is signal ko fully evaluate karne ke liye sufficient nahi hai.',
            }[status] ??
            'Additional deterministic context available hai.'
      : const {
              'MIXED': 'The supplied deterministic evidence contains both supporting and limiting context.',
              'CONTRADICTED': 'The relevant deterministic evidence contains an explicit contradiction.',
              'INSUFFICIENT_EVIDENCE': 'Available deterministic evidence is insufficient to evaluate this signal fully.',
            }[status] ??
            'Additional deterministic context is available.';

  String careerHistory(String level, int? count) {
    if (!isHinglish) {
      return switch (level) {
        'NONE' => 'Add Career History to compare timing patterns.',
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
      'NONE' => 'Career History add karke aap apne past timing patterns compare kar sakte hain.',
      'LIMITED' =>
        'Abhi ${count ?? 1} Career event saved hai. Recurring-pattern comparison ke liye thodi aur Career History add karein.',
      'CALIBRATED' =>
        count == null
            ? 'Career History recurring timing patterns compare karne ke liye available hai.'
            : 'Aapke $count saved Career events recurring timing patterns compare karne ke liye available hain.',
      _ => 'Career History is Reading ke liye available hai.',
    };
  }

  String planet(Object? value) => isHinglish
      ? const {
              'Saturn': 'Shani Dev',
              'Jupiter': 'Guru Dev',
              'Mars': 'Mangal',
              'Mercury': 'Budh',
              'Venus': 'Shukra',
              'Sun': 'Surya Dev',
              'Moon': 'Chandra Dev',
              'Rahu': 'Rahu',
              'Ketu': 'Ketu',
            }[value] ??
            '${value ?? 'Planet'}'
      : '${value ?? 'Planet'}';
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
      ? 'Aapki Janam Kundli mein Career ka base 10th Bhav se jude factors par established hai.'
      : 'Your Career picture is anchored in the 10th House factors already identified in your birth chart.';
  String synthesisAshtakavarga(int sav) => isHinglish
      ? 'Ashtakavarga isi Career foundation ko additional context deta hai: 10th Bhav mein $sav SAV bindus hain. Yeh promotion, job change, income ya timing ka standalone prediction nahi.'
      : 'Ashtakavarga adds another layer of context: the 10th House carries $sav SAV bindus. This is not a standalone prediction of promotion, job change, income, or timing.';
  String synthesisTiming({required bool activeDasha, required bool currentTransit, required bool concurrent, required bool limited}) {
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
          ? 'Available Career timing evidence abhi limited hai, isliye koi direct timing conclusion nahi diya ja raha.'
          : 'Available Career timing evidence remains limited, so no direct timing conclusion is being made.';
    }
    return '';
  }
  String synthesisCalibration(String level, int? count) => isHinglish
      ? switch (level) {
          'CALIBRATED' => '${count ?? 'Saved'} recorded Career events similar patterns ke personal context ko add karte hain; yeh future outcome forecast nahi hai.',
          'LIMITED' => 'Aapki recorded Career History ka personal context abhi limited hai.',
          _ => '',
        }
      : switch (level) {
          'CALIBRATED' => '${count ?? 'Saved'} recorded Career events add personal context for how similar patterns appeared previously; this is not a future outcome forecast.',
          'LIMITED' => 'Your recorded Career History provides limited personal context at present.',
          _ => '',
        };
  String get synthesisFutureRecurrence => isHinglish
      ? 'Existing engine ne saved Career History se linked ek future recurrence window identify ki hai.'
      : 'The existing engine has identified a future recurrence window linked to your saved Career History.';
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
