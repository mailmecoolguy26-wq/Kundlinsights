import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/readings/astrology_presentation_copy.dart';
import 'package:kundlinsights_mobile/features/readings/career_explanation_language.dart';

void main() {
  const english = AstrologyPresentationCopy(CareerExplanationLanguage.english);
  const hinglish = AstrologyPresentationCopy(
    CareerExplanationLanguage.hinglish,
  );

  test('English remains the default factual presentation', () {
    expect(english.planet('Saturn'), 'Saturn');
    expect(english.planet('Jupiter'), 'Jupiter');
    expect(english.houseContext(10), '10th House');
    expect(english.retrograde, 'Retrograde');
    expect(
      english.insightsTransitDescription,
      'See how today’s planetary movements interact with your birth chart.',
    );
    expect(
      english.transitSnapshotDescription,
      'These are the planetary movements currently active against your natal chart.',
    );
  });

  test('Hinglish maps only bounded astrology terminology', () {
    expect(hinglish.planet('Saturn'), 'Shani Dev');
    expect(hinglish.planet('Jupiter'), 'Guru Dev');
    expect(hinglish.planet('Mercury'), 'Budh');
    expect(hinglish.houseContext(10), '10th Bhav');
    expect(hinglish.ascendant, 'Lagna');
    expect(hinglish.retrograde, 'Vakri');
    expect(hinglish.combust, 'Asta');
    expect(hinglish.state('unknown backend state'), 'unknown backend state');
    expect(hinglish.planet('Unknown planet'), 'Unknown planet');
  });

  test(
    'Hinglish deterministic prose is Roman script and does not expand meaning',
    () {
      final prose = [
        hinglish.insightsTransitDescription,
        hinglish.transitSnapshotDescription,
      ].join(' ');
      expect(
        prose,
        'Dekhiye aaj ke planetary Gochar aapki Janam Kundli ke saath kaise interact kar rahe hain. Yeh woh planetary Gochar hain jo abhi aapki Janam Kundli ke context mein active hain.',
      );
      expect(prose, isNot(contains(RegExp(r'[\u0900-\u097F]'))));
      for (final forbidden in const [
        'strong',
        'favorable',
        'weak',
        'chances',
        'likely',
        'promotion',
        'job change',
        'salary growth',
        'opportunity',
        'confidence',
      ]) {
        expect(prose.toLowerCase(), isNot(contains(forbidden)));
      }
    },
  );
}
