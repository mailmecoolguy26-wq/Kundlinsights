import 'family_expansion_answer.dart';
abstract interface class FamilyExpansionAnswerRepository { Future<FamilyExpansionAnswer> getAnswer({required String birthProfileId, required FamilyExpansionIntent intent}); }
class UnavailableFamilyExpansionAnswerRepository implements FamilyExpansionAnswerRepository { const UnavailableFamilyExpansionAnswerRepository(); @override Future<FamilyExpansionAnswer> getAnswer({required String birthProfileId, required FamilyExpansionIntent intent}) => Future.error(StateError('Family Expansion insights are unavailable.')); }
