import 'wealth_answer.dart';

abstract interface class WealthAnswerRepository {
  Future<WealthAnswer> getAnswer({required String birthProfileId, required WealthIntent intent});
}

class UnavailableWealthAnswerRepository implements WealthAnswerRepository {
  const UnavailableWealthAnswerRepository();
  @override
  Future<WealthAnswer> getAnswer({required String birthProfileId, required WealthIntent intent}) =>
      Future<WealthAnswer>.error(StateError('Wealth insights are unavailable.'));
}
