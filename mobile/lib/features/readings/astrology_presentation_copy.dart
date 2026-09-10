import 'package:flutter/widgets.dart';

import 'career_explanation_language.dart';

/// Bounded display terminology for factual astrology presentation. It never
/// interprets chart data, translates stored prose, or changes raw values.
class AstrologyPresentationCopy {
  const AstrologyPresentationCopy(this.language);
  final CareerExplanationLanguage language;
  bool get isHinglish => language == CareerExplanationLanguage.hinglish;

  static AstrologyPresentationCopy of(BuildContext context) {
    final controller = context
        .dependOnInheritedWidgetOfExactType<AstrologyPresentationScope>()
        ?.notifier;
    return AstrologyPresentationCopy(
      controller?.language ?? CareerExplanationLanguage.english,
    );
  }

  /// Backend identifiers are factual transport values. Canonicalize only for
  /// display so casing never leaks into user-facing astrology terminology.
  String planet(String value) {
    final canonical = _canonicalPlanets[value.trim().toLowerCase()] ?? value;
    return isHinglish
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
              }[canonical] ??
              canonical
        : canonical;
  }

  String house(int value) => isHinglish ? '${value}th Bhav' : 'House $value';
  String houseContext(int value) =>
      isHinglish ? '${value}th Bhav' : '${ordinal(value)} House';
  String get ascendant => isHinglish ? 'Lagna' : 'Ascendant';
  String get retrograde => isHinglish ? 'Vakri' : 'Retrograde';
  String get combust => isHinglish ? 'Asta' : 'Combust';
  String state(String value) => switch (value) {
    'Retrograde' || 'RETROGRADE' => retrograde,
    'Combust' || 'COMBUST' => combust,
    _ => value,
  };

  String get insightsTransitDescription => isHinglish
      ? 'Dekhiye aaj ke planetary Gochar aapki Janam Kundli ke saath kaise interact kar rahe hain.'
      : 'See how today’s planetary movements interact with your birth chart.';
  String get transitSnapshotDescription => isHinglish
      ? 'Yeh woh planetary Gochar hain jo abhi aapki Janam Kundli ke context mein active hain.'
      : 'These are the planetary movements currently active against your natal chart.';

  String ordinal(int value) {
    final lastTwo = value % 100;
    if (lastTwo >= 11 && lastTwo <= 13) return '${value}th';
    return switch (value % 10) {
      1 => '${value}st',
      2 => '${value}nd',
      3 => '${value}rd',
      _ => '${value}th',
    };
  }
}

const _canonicalPlanets = {
  'sun': 'Sun',
  'moon': 'Moon',
  'mars': 'Mars',
  'mercury': 'Mercury',
  'jupiter': 'Jupiter',
  'venus': 'Venus',
  'saturn': 'Saturn',
  'rahu': 'Rahu',
  'ketu': 'Ketu',
};

/// Reuses the existing app-owned explanation-language preference without
/// changing Flutter's global locale.
class AstrologyPresentationScope
    extends InheritedNotifier<CareerExplanationLanguageController> {
  const AstrologyPresentationScope({
    super.key,
    required CareerExplanationLanguageController controller,
    required super.child,
  }) : super(notifier: controller);
}
