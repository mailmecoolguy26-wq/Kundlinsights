import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/core/config/development_flags.dart';
import 'package:kundlinsights_mobile/features/career_answers/data/debug_job_favourability_preview_repository.dart';
import 'package:kundlinsights_mobile/features/career_answers/domain/career_answer.dart';
import 'package:kundlinsights_mobile/features/career_answers/domain/career_answer_repository.dart';

void main() {
  test('Career Premium UI preview defaults off without its explicit flag', () {
    expect(
      DevelopmentFlags.isCareerPremiumUiPreviewEnabled(
        debugMode: true,
        buildFlag: false,
      ),
      isFalse,
    );
  });

  test('Career Premium UI preview requires both debug mode and its flag', () {
    expect(
      DevelopmentFlags.isCareerPremiumUiPreviewEnabled(
        debugMode: true,
        buildFlag: true,
      ),
      isTrue,
    );
  });

  test('profile and release builds ignore the preview flag', () {
    expect(
      DevelopmentFlags.isCareerPremiumUiPreviewEnabled(
        debugMode: false,
        buildFlag: true,
      ),
      isFalse,
    );
  });

  test(
    'intercepts only Job Favourability with synthetic entitled data',
    () async {
      final delegate = _RecordingRepository();
      final repository = DebugJobFavourabilityPreviewRepository(delegate);

      final answer = await repository.getAnswer(
        birthProfileId: 'profile-a',
        questionType: CareerQuestionType.jobFavourabilityTiming,
      );

      expect(delegate.calls, isEmpty);
      expect(answer.questionType, CareerQuestionType.jobFavourabilityTiming);
      expect(answer.answerability, CareerAnswerability.supported);
      expect(answer.jobFavourability, isNotNull);
      expect(answer.sourceReadingId, isNull);
      expect(answer.rulesetVersion, 'debug-synthetic-ui-preview-only');
    },
  );

  test(
    'delegates every non-Job-Favourability Career question unchanged',
    () async {
      final delegate = _RecordingRepository();
      final repository = DebugJobFavourabilityPreviewRepository(delegate);

      final answer = await repository.getAnswer(
        birthProfileId: 'profile-a',
        questionType: CareerQuestionType.currentCareerPhase,
        readingId: 'reading-a',
      );

      expect(answer, same(delegate.answer));
      expect(delegate.calls, [
        (
          birthProfileId: 'profile-a',
          questionType: CareerQuestionType.currentCareerPhase,
          readingId: 'reading-a',
        ),
      ]);
    },
  );
}

class _RecordingRepository implements CareerAnswerRepository {
  final List<
    ({
      String birthProfileId,
      CareerQuestionType questionType,
      String? readingId,
    })
  >
  calls = [];

  final CareerAnswer answer = CareerAnswer.fromJson(const {
    'questionType': 'CURRENT_CAREER_PHASE',
    'answerability': 'INSUFFICIENT_EVIDENCE',
    'answer': {
      'headline': 'Unavailable',
      'summary': 'Unavailable',
      'limitation': 'Unavailable',
    },
    'agreement': {
      'availableMajorSignals': 0,
      'alignedMajorSignals': 0,
      'primaryEligibility': false,
      'supportSignals': [],
    },
    'evidence': [],
    'sourceReadingId': null,
    'rulesetVersion': 'test',
  });

  @override
  Future<CareerAnswer> getAnswer({
    required String birthProfileId,
    required CareerQuestionType questionType,
    String? readingId,
  }) {
    calls.add((
      birthProfileId: birthProfileId,
      questionType: questionType,
      readingId: readingId,
    ));
    return Future<CareerAnswer>.value(answer);
  }
}
