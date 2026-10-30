import 'relationship_answer.dart';

abstract interface class RelationshipAnswerRepository {
  Future<RelationshipAnswer> getAnswer({
    required String birthProfileId,
    required RelationshipIntent intent,
  });
}

class UnavailableRelationshipAnswerRepository
    implements RelationshipAnswerRepository {
  const UnavailableRelationshipAnswerRepository();

  @override
  Future<RelationshipAnswer> getAnswer({
    required String birthProfileId,
    required RelationshipIntent intent,
  }) => Future<RelationshipAnswer>.error(
    StateError('Relationship insights are unavailable.'),
  );
}
