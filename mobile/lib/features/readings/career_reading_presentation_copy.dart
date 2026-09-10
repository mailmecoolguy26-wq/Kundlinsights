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
