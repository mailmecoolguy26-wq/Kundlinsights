import '../domain/career_answer.dart';
import '../domain/career_answer_repository.dart';

/// Debug-only decorator for visually testing the entitled Job Favourability
/// presentation without a store purchase or an entitlement write.
///
/// App composition installs this only behind an explicit debug build flag.
/// It never changes backend enforcement: all other Career questions delegate
/// directly to the real repository, and this sample is neither persisted nor
/// sent to the API.
class DebugJobFavourabilityPreviewRepository implements CareerAnswerRepository {
  const DebugJobFavourabilityPreviewRepository(this._delegate);

  final CareerAnswerRepository _delegate;

  @override
  Future<CareerAnswer> getAnswer({
    required String birthProfileId,
    required CareerQuestionType questionType,
    String? readingId,
  }) {
    if (questionType == CareerQuestionType.jobFavourabilityTiming) {
      return Future<CareerAnswer>.value(_syntheticEntitledAnswer);
    }
    return _delegate.getAnswer(
      birthProfileId: birthProfileId,
      questionType: questionType,
      readingId: readingId,
    );
  }

  static final CareerAnswer _syntheticEntitledAnswer = CareerAnswer.fromJson(
    const {
      'questionType': 'JOB_FAVOURABILITY_TIMING',
      'answerability': 'SUPPORTED',
      'projectionStatus': 'DEBUG_SYNTHETIC_UI_PREVIEW_ONLY',
      'sourceReadingId': null,
      'broadWindow': {
        'start': '2027-04-01T00:00:00.000Z',
        'end': '2027-05-15T00:00:00.000Z',
      },
      'strongerConcentrationWindow': null,
      'strength': 'STRONGER',
      'evidenceAgreementCount': 3,
      'evidenceReasonCodes': [
        'CAREER_TIMING_ACTIVATED',
        'JUPITER_WORK_RELATED_AREA',
        'SUPPORTING_CHART_FACTORS_ALIGN',
      ],
      'recommendedActionCodes': ['PREPARE_CAREER_MATERIALS_AND_CONVERSATIONS'],
      'limitationCode': 'BETA_DESCRIPTIVE_CONVERGENCE_ONLY',
      'provenance': {
        'mode': 'DEBUG_SYNTHETIC_UI_PREVIEW_ONLY',
        'synthetic': true,
      },
      'rulesetVersion': 'debug-synthetic-ui-preview-only',
    },
  );

  /// Used only by the explicit debug-only StoreKit session seam. The backend
  /// remains authoritative for every real Sandbox and Production request.
  static CareerAnswer get syntheticEntitledAnswer => _syntheticEntitledAnswer;
}
