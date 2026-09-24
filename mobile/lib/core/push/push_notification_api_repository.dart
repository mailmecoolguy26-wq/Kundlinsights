import '../api/api_client.dart';
import 'push_notification_service.dart';

class PushNotificationApiRepository
    implements
        PushRegistrationApi,
        PushNotificationPreferencesApi,
        PushNotificationActivityApi {
  const PushNotificationApiRepository(this._api);
  final ApiClient _api;
  @override
  Future<void> register({
    required String deviceId,
    required String platform,
    required String token,
  }) async {
    await _api.post<void>(
      '/v1/me/devices',
      data: {
        'deviceId': deviceId,
        'platform': platform,
        'pushToken': token,
        'environment': const String.fromEnvironment(
          'APP_ENV',
          defaultValue: 'development',
        ),
      },
    );
  }

  @override
  Future<void> revoke({required String deviceId}) =>
      _api.post<void>('/v1/me/devices/revoke', data: {'deviceId': deviceId});
  @override
  Future<PushNotificationPreferences> getPreferences() async {
    final response = await _api.get<Map<String, dynamic>>(
      '/v1/me/notification-preferences',
    );
    return _preferencesFromJson(
      (response.data?['preferences'] as Map?)?.cast<String, dynamic>() ??
          const {},
    );
  }

  @override
  Future<PushNotificationPreferences> updatePreferences(
    PushNotificationPreferences value,
  ) async {
    final response = await _api.patch<Map<String, dynamic>>(
      '/v1/me/notification-preferences',
      data: _preferencesToJson(value),
    );
    return _preferencesFromJson(
      (response.data?['preferences'] as Map?)?.cast<String, dynamic>() ??
          const {},
    );
  }

  @override
  Future<void> recordAppActivity() =>
      _api.post<void>('/v1/me/notification-activity');
  @override
  Future<void> recordReadingViewed(String readingId) =>
      _api.post<void>('/v1/readings/$readingId/viewed');
  @override
  Future<void> recordCareerPaywallViewed(String birthProfileId) => _api
      .post<void>('/v1/birth-profiles/$birthProfileId/career-paywall-viewed');
}

PushNotificationPreferences _preferencesFromJson(Map<String, dynamic> json) =>
    PushNotificationPreferences(
      readingUpdates: json['readingUpdates'] != false,
      careerReminders: json['careerReminders'] != false,
      offersAndUpdates: json['offersAndUpdates'] == true,
    );

Map<String, dynamic> _preferencesToJson(PushNotificationPreferences value) => {
  'readingUpdates': value.readingUpdates,
  'careerReminders': value.careerReminders,
  'offersAndUpdates': value.offersAndUpdates,
};
