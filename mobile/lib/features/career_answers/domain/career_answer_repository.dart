import 'career_answer.dart';

abstract interface class CareerAnswerRepository {
  Future<CareerAnswer> getAnswer({
    required String birthProfileId,
    required CareerQuestionType questionType,
    String? readingId,
  });
}

class UnavailableCareerAnswerRepository implements CareerAnswerRepository {
  const UnavailableCareerAnswerRepository();

  @override
  Future<CareerAnswer> getAnswer({
    required String birthProfileId,
    required CareerQuestionType questionType,
    String? readingId,
  }) => Future<CareerAnswer>.error(
    StateError('Configuration is required.'),
  );
}
