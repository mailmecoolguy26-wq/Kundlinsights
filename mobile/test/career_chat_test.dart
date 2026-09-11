import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/career_chat/domain/career_chat.dart';
import 'package:kundlinsights_mobile/features/career_chat/presentation/career_chat_presentation.dart';

void main() {
  test('parses the public Career Chat response defensively', () {
    final response = CareerChatResponse.fromJson({
      'profileId': 'profile-a',
      'domain': 'CAREER',
      'language': 'HINGLISH',
      'intent': {'type': 'NEXT_JOB_TIMING', 'clarificationNeeded': false},
      'answer': {
        'answerability': 'SUPPORTED',
        'headlineFact': 'A supported timing window is available.',
        'timingWindows': [
          {'start': '2026-10-01T00:00:00.000Z'},
        ],
        'evidenceSummary': ['CAREER_TIMING'],
        'caveats': ['EXACT_JOB_DATE'],
        'followUpOptions': ['Show my next Career timing window'],
      },
    });

    expect(response.profileId, 'profile-a');
    expect(response.language, CareerChatLanguage.hinglish);
    expect(response.answer.answerability, CareerChatAnswerability.supported);
    expect(response.answer.timingWindows, hasLength(1));
  });

  test('accepts omitted optional answer lists', () {
    final answer = CareerChatAnswer.fromJson({
      'answerability': 'UNSUPPORTED',
      'headlineFact': 'Outside Career scope.',
    });
    expect(answer.timingWindows, isEmpty);
    expect(answer.followUpOptions, isEmpty);
  });

  test(
    'sanitizes internal policy enums from a Hinglish no-reading outcome',
    () {
      final response = CareerChatResponse.fromJson({
        'profileId': 'profile-a',
        'domain': 'CAREER',
        'language': 'HINGLISH',
        'intent': {'type': 'NEXT_JOB_TIMING', 'clarificationNeeded': false},
        'answer': {
          'answerability': 'INSUFFICIENT_EVIDENCE',
          'headlineFact': 'Internal fallback.',
          'evidenceSummary': ['CAREER_TIMING'],
          'caveats': [
            'EXACT_JOB_DATE',
            'GUARANTEED_JOB',
            'GUARANTEED_PROMOTION',
            'GUARANTEED_SALARY_GROWTH',
            'EMPLOYER_IDENTITY',
            'SALARY_AMOUNT',
            'PROBABILITY',
            'PLANET_CAUSED_OFFICE_POLITICS',
          ],
          'followUpOptions': ['Generate your Career Reading'],
        },
      });

      final presentation = CareerChatPresentation.fromResponse(response);
      expect(
        presentation.headline,
        'Abhi enough Career timing evidence available nahi hai',
      );
      expect(presentation.evidence, isEmpty);
      expect(presentation.caveats, isEmpty);
      expect(presentation.shouldOfferGeneration, isTrue);
    },
  );

  test('keeps only human-readable evidence and caveat text', () {
    final response = CareerChatResponse.fromJson({
      'profileId': 'profile-a',
      'domain': 'CAREER',
      'language': 'ENGLISH',
      'intent': {'type': 'PROMOTION_TIMING'},
      'answer': {
        'answerability': 'SUPPORTED',
        'headlineFact': 'A relevant period is available.',
        'evidenceSummary': [
          'A current timing window is available.',
          'CAREER_TIMING',
        ],
        'caveats': [
          'Timing does not guarantee an outcome.',
          'GUARANTEED_PROMOTION',
        ],
      },
    });

    final presentation = CareerChatPresentation.fromResponse(response);
    expect(presentation.evidence, ['A current timing window is available.']);
    expect(presentation.caveats, ['Timing does not guarantee an outcome.']);
    expect(presentation.shouldOfferGeneration, isFalse);
  });

  test('localizes only known Hinglish follow-up labels', () {
    final response = CareerChatResponse.fromJson({
      'profileId': 'profile-a',
      'domain': 'CAREER',
      'language': 'HINGLISH',
      'intent': {'type': 'NEXT_JOB_TIMING'},
      'answer': {
        'answerability': 'SUPPORTED',
        'headlineFact': 'A supported period is available.',
        'followUpOptions': [
          'Show my next Career timing window',
          'Compare current vs upcoming Career period',
          'An unknown backend option',
        ],
      },
    });

    final followUps = CareerChatPresentation.fromResponse(response).followUps;
    expect(followUps[0].label, 'Mera next Career timing window dikhao');
    expect(
      followUps[1].label,
      'Current aur upcoming Career period compare karo',
    );
    expect(followUps[2].label, 'An unknown backend option');
    expect(followUps[0].requestText, 'Show my next Career timing window');
  });

  test('keeps canonical labels in English', () {
    final response = CareerChatResponse.fromJson({
      'profileId': 'profile-a',
      'domain': 'CAREER',
      'language': 'ENGLISH',
      'intent': {'type': 'WORKPLACE_PRESSURE'},
      'answer': {
        'answerability': 'SUPPORTED',
        'headlineFact': 'A supported period is available.',
        'followUpOptions': [
          'Show current Career timing',
          'Check job-switch timing',
        ],
      },
    });

    final followUps = CareerChatPresentation.fromResponse(response).followUps;
    expect(followUps.map((item) => item.label), [
      'Show current Career timing',
      'Check job-switch timing',
    ]);
  });

  test(
    'uses a valid rendered Hinglish answer without duplicate fallback copy',
    () {
      final response = CareerChatResponse.fromJson({
        'profileId': 'profile-a',
        'domain': 'CAREER',
        'language': 'HINGLISH',
        'intent': {'type': 'NEXT_JOB_TIMING'},
        'answer': {
          'answerability': 'INSUFFICIENT_EVIDENCE',
          'headlineFact': 'Fallback.',
          'followUpOptions': [
            'Show my next Career timing window',
            'Compare current vs upcoming Career period',
          ],
        },
        'renderedAnswer': {
          'message': 'Available Career timing evidence insufficient hai.',
          'followUpLabels': [
            'Show my next Career timing window',
            'Compare current vs upcoming Career period',
          ],
        },
      });
      final presentation = CareerChatPresentation.fromResponse(response);
      expect(
        presentation.headline,
        'Available Career timing evidence insufficient hai.',
      );
      expect(presentation.body, isNull);
      expect(
        presentation.followUps.first.requestText,
        'Show my next Career timing window',
      );
      expect(
        presentation.followUps.first.label,
        'Mera next Career timing window dikhao',
      );
      expect(
        presentation.followUps.last.label,
        'Current aur upcoming Career period compare karo',
      );
    },
  );

  test(
    'keeps deterministic insufficient-evidence fallback without rendering',
    () {
      final response = CareerChatResponse.fromJson({
        'profileId': 'profile-a',
        'domain': 'CAREER',
        'language': 'HINGLISH',
        'intent': {'type': 'NEXT_JOB_TIMING'},
        'answer': {
          'answerability': 'INSUFFICIENT_EVIDENCE',
          'headlineFact': 'Fallback.',
        },
      });

      final presentation = CareerChatPresentation.fromResponse(response);
      expect(
        presentation.headline,
        'Abhi enough Career timing evidence available nahi hai',
      );
      expect(
        presentation.body,
        'Aapke available Career data se is question ka supported timing window abhi determine nahi kiya ja sakta.',
      );
    },
  );

  test(
    'keeps distinct deterministic timing windows with a rendered answer',
    () {
      final response = CareerChatResponse.fromJson({
        'profileId': 'profile-a',
        'domain': 'CAREER',
        'language': 'ENGLISH',
        'intent': {'type': 'NEXT_JOB_TIMING'},
        'answer': {
          'answerability': 'SUPPORTED',
          'headlineFact': 'Fallback.',
          'timingWindows': [
            {'start': '2026-10-01T00:00:00.000Z'},
          ],
        },
        'renderedAnswer': {
          'message': 'A supported Career timing window is available.',
          'followUpLabels': [],
        },
      });

      final presentation = CareerChatPresentation.fromResponse(response);
      expect(
        presentation.headline,
        'A supported Career timing window is available.',
      );
      expect(presentation.body, isNull);
      expect(presentation.timingWindows, hasLength(1));
    },
  );
}
