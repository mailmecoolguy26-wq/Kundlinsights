import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/relationships/domain/relationship_answer.dart';

void main() {
  for (final state in const [
    'Supportive',
    'Improving',
    'Mixed',
    'Consolidation',
    'Cautious',
    'Insufficient Evidence',
  ]) {
    test('preserves server-owned $state without deriving another verdict', () {
      final answer = RelationshipAnswer.fromJson({
        'intent': 'RELATIONSHIP_OUTLOOK',
        'answerability': 'SUPPORTED',
        'state': state,
        'summary': 'Server-provided relationship interpretation.',
      });
      expect(answer.state, state);
    });
  }

  test('keeps Marriage Outlook calibrated and window data server-owned', () {
    final answer = RelationshipAnswer.fromJson({
      'intent': 'RELATIONSHIP_OUTLOOK',
      'answerability': 'SUPPORTED',
      'state': 'Supportive',
      'marriageOutlook': {
        'state': 'COMMITMENT_SUPPORTIVE',
        'message': 'This period is relatively supportive for commitment.',
        'window': {
          'start': '2026-10-01T00:00:00.000Z',
          'end': '2026-11-20T00:00:00.000Z',
          'state': 'Supportive',
          'temporalStatus': 'UPCOMING',
        },
        'limitations': ['NO_GUARANTEED_MARRIAGE', 'NO_EXACT_MARRIAGE_DATE'],
      },
    });
    expect(answer.marriageOutlook?.message, contains('relatively supportive'));
    expect(
      answer.marriageOutlook?.limitations,
      contains('NO_GUARANTEED_MARRIAGE'),
    );
    expect(
      answer.marriageOutlook?.window?.start,
      DateTime.parse('2026-10-01T00:00:00.000Z'),
    );
  });
}
