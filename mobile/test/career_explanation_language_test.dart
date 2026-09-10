import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/readings/career_explanation_language.dart';
import 'package:kundlinsights_mobile/features/readings/career_reading_presentation_copy.dart';

void main() {
  test(
    'defaults to English and persists an explicit language choice',
    () async {
      final storage = _Storage();
      final controller = CareerExplanationLanguageController(storage);
      expect(controller.language, CareerExplanationLanguage.english);

      await controller.setLanguage(CareerExplanationLanguage.hinglish);
      expect(controller.language, CareerExplanationLanguage.hinglish);
      expect(storage.value, 'hinglish');

      final restored = CareerExplanationLanguageController(storage);
      await restored.load();
      expect(restored.language, CareerExplanationLanguage.hinglish);
    },
  );

  test(
    'switching language changes deterministic prose, not structured facts',
    () {
      const english = CareerReadingPresentationCopy(
        CareerExplanationLanguage.english,
      );
      const hinglish = CareerReadingPresentationCopy(
        CareerExplanationLanguage.hinglish,
      );
      expect(
        english.insightSummary('ACTIVE_CAREER_DASHA'),
        'Your current Dasha timing connects to Career-related factors in the natal chart.',
      );
      expect(
        hinglish.insightSummary('ACTIVE_CAREER_DASHA'),
        'Aapki current Dasha timing Janam Kundli ke Career-related factors se connect ho rahi hai.',
      );
      expect(
        hinglish.insightSummary('CURRENT_CAREER_TRANSIT'),
        contains('Gochar'),
      );
      expect(
        hinglish.insightSummary('CONCURRENT_CAREER_TIMING'),
        contains('sufficient nahi hai'),
      );
      expect(
        hinglish.insightSummary('CURRENT_CAREER_TRANSIT'),
        isNot(contains('Promotion')),
      );
      expect(
        hinglish.insightSummary('CURRENT_CAREER_TRANSIT'),
        isNot(contains(RegExp(r'[\u0900-\u097F]'))),
      );
    },
  );

  test('Hinglish uses only the locked technical terminology mappings', () {
    const copy = CareerReadingPresentationCopy(
      CareerExplanationLanguage.hinglish,
    );
    expect(copy.planet('Saturn'), 'Shani Dev');
    expect(copy.planet('Jupiter'), 'Guru Dev');
    expect(copy.planet('Mercury'), 'Budh');
    expect(copy.house(10), '10th Bhav');
    expect(copy.state('RETROGRADE'), 'Vakri');
    expect(copy.state('COMBUST'), 'Asta');
    expect(copy.dasha('PRATYANTAR_DASHA'), 'Pratyantar Dasha');
  });
}

class _Storage implements CareerExplanationLanguageStorage {
  String? value;
  @override
  Future<String?> readLanguage() async => value;
  @override
  Future<void> writeLanguage(CareerExplanationLanguage language) async {
    value = language.name;
  }
}
