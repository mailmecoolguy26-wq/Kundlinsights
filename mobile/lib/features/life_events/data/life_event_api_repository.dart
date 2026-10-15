import 'package:flutter/foundation.dart';

import '../../../core/api/api_client.dart';
import '../../../core/errors/api_failure.dart';
import '../domain/life_event.dart';
import '../domain/life_event_repository.dart';

class LifeEventApiRepository implements LifeEventRepository {
  const LifeEventApiRepository(this.client);

  final ApiClient client;

  String _base(String profileId) => '/v1/birth-profiles/$profileId/life-events';

  @override
  Future<List<LifeEvent>> list(
    String profileId, {
    LifeEventCategory? category,
  }) async {
    final response = await client.get<Map<String, dynamic>>(
      _base(profileId),
      queryParameters: category == null ? null : {'category': category.wire},
    );
    final values = response.data?['lifeEvents'];
    if (values is! List) throw const FormatException('Malformed Life Events.');
    return values
        .map(
          (value) =>
              LifeEvent.fromJson(Map<String, dynamic>.from(value as Map)),
        )
        .toList(growable: false);
  }

  Future<LifeEvent> _write(
    Future<dynamic> request, {
    required String profileId,
    required LifeEventInput input,
  }) async {
    try {
      final response = await request;
      _logResponse(profileId, input, response.statusCode);
      final value = response.data?['lifeEvent'];
      if (value is! Map) throw const FormatException('Malformed Life Event.');
      return LifeEvent.fromJson(Map<String, dynamic>.from(value));
    } catch (exception) {
      _logResponse(profileId, input, null, exception: exception);
      rethrow;
    }
  }

  @override
  Future<LifeEvent> create(String profileId, LifeEventInput input) => _write(
    client.post<Map<String, dynamic>>(_base(profileId), data: input.toJson()),
    profileId: profileId,
    input: input,
  );

  @override
  Future<LifeEvent> update(String profileId, String id, LifeEventInput input) =>
      _write(
        client.patch<Map<String, dynamic>>(
          '${_base(profileId)}/$id',
          data: input.toJson(),
        ),
        profileId: profileId,
        input: input,
      );

  @override
  Future<void> delete(String profileId, String id) async {
    await client.delete<Map<String, dynamic>>('${_base(profileId)}/$id');
  }

  void _logResponse(
    String profileId,
    LifeEventInput input,
    int? status, {
    Object? exception,
  }) {
    if (!kDebugMode) return;
    final failure = exception is ApiFailure ? exception : null;
    final failureStatus = switch (failure?.kind) {
      ApiFailureKind.validation => 400,
      ApiFailureKind.unauthenticated => 401,
      ApiFailureKind.forbidden => 403,
      ApiFailureKind.notFound => 404,
      ApiFailureKind.payloadTooLarge => 413,
      ApiFailureKind.server => 500,
      _ => null,
    };
    debugPrint(
      'LIFE_EVENT_API_RESPONSE birthProfileId=$profileId'
      ' category=${input.category.wire}'
      ' eventType=${input.type.wire}'
      ' datePrecision=${input.date.precision.wire}'
      '${status == null && failureStatus == null ? '' : ' httpStatus=${status ?? failureStatus}'}'
      '${failure == null ? '' : ' errorClass=${failure.kind.name}'}'
      '${failure?.code == null ? '' : ' safeErrorCode=${failure!.code}'}'
      '${exception != null && failure == null ? ' errorClass=${exception.runtimeType}' : ''}',
    );
  }
}
