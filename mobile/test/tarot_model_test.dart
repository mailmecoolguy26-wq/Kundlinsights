import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/tarot/domain/tarot.dart';

void main() {
  test('parses resumable account-scoped reading without profile data', () {
    final reading = TarotReading.fromJson({
      'readingId': 'reading-a',
      'question': 'What should I reflect on?',
      'category': 'GENERAL_GUIDANCE',
      'spread': {
        'spreadType': 'GENERAL_GUIDANCE',
        'positions': [
          {'position': 1, 'name': 'Situation'},
        ],
      },
      'status': 'DRAWING',
      'selectedCards': [
        {
          'position': 1,
          'positionName': 'Situation',
          'cardId': 'MAJOR_FOOL',
          'cardName': 'The Fool',
          'orientation': 'UPRIGHT',
        },
      ],
      'selectableTokens': ['opaque-token'],
      'createdAt': '2026-11-05T00:00:00.000Z',
    });
    expect(reading.selectedCards.single.cardName, 'The Fool');
    expect(reading.selectableTokens, ['opaque-token']);
    expect(reading.canDraw, isTrue);
  });
}
