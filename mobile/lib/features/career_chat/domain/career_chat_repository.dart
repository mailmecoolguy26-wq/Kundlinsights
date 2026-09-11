import 'career_chat.dart';

abstract interface class CareerChatRepository {
  Future<CareerChatResponse> send({
    required String birthProfileId,
    required CareerChatRequest request,
  });
}

class UnavailableCareerChatRepository implements CareerChatRepository {
  const UnavailableCareerChatRepository();

  @override
  Future<CareerChatResponse> send({
    required String birthProfileId,
    required CareerChatRequest request,
  }) => Future<CareerChatResponse>.error(
    StateError('Configuration is required.'),
  );
}
