import 'property_answer.dart';

abstract interface class PropertyAnswerRepository {
  Future<PropertyAnswer> getAnswer({
    required String birthProfileId,
    required PropertyIntent intent,
  });
}

class UnavailablePropertyAnswerRepository implements PropertyAnswerRepository {
  const UnavailablePropertyAnswerRepository();

  @override
  Future<PropertyAnswer> getAnswer({
    required String birthProfileId,
    required PropertyIntent intent,
  }) => Future<PropertyAnswer>.error(
    StateError('Property timing is unavailable.'),
  );
}
