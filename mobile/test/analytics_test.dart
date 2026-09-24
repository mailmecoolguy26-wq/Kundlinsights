import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/core/analytics/analytics.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';

void main() {
  test('records only approved privacy-safe analytics properties', () async {
    final provider = _Fake(); final analytics = Analytics(provider);
    await analytics.track(AnalyticsEvent.careerChatQuestionSent, {
      'source': 'career_chat', 'intent': 'PROMOTION_TIMING',
      'message': 'raw question', 'date_of_birth': '1990-01-01',
      'payment_token': 'secret', 'birth_profile_id': 'opaque-id',
    });
    expect(provider.events.single.name, 'career_chat_question_sent');
    expect(provider.events.single.properties, {'source': 'career_chat', 'intent': 'PROMOTION_TIMING', 'birth_profile_id': 'opaque-id'});
  });
  test('provider failures never break the calling flow', () async {
    await Analytics(_Failing()).track(AnalyticsEvent.careerOpened, {'screen': 'home'});
  });

  test('signup analytics is emitted only after a successful signup', () async {
    final provider = _Fake();
    final controller = AuthController(_Auth(signupCompletes: true),
        analytics: Analytics(provider));
    await controller.signup('person@example.test', 'safe-password');
    expect(provider.events.map((event) => event.name), ['signup_completed']);
    controller.dispose();

    final failedProvider = _Fake();
    final failed = AuthController(_Auth(signupCompletes: false),
        analytics: Analytics(failedProvider));
    await failed.signup('person@example.test', 'safe-password');
    expect(failedProvider.events, isEmpty);
    failed.dispose();
  });
}
class _Fake implements AnalyticsProvider {
  final events = <_Event>[];
  @override Future<void> track(String name, Map<String, Object?> properties) async => events.add(_Event(name, properties));
}
class _Failing implements AnalyticsProvider { @override Future<void> track(String eventName, Map<String, Object?> properties) => Future.error(StateError('analytics unavailable')); }
class _Event { const _Event(this.name, this.properties); final String name; final Map<String, Object?> properties; }

class _Auth implements AuthRepository {
  _Auth({required this.signupCompletes});
  final bool signupCompletes;
  final _states = StreamController<AuthSnapshot>.broadcast();
  @override Stream<AuthSnapshot> get states => _states.stream;
  @override Future<String?> accessToken() async => null;
  @override Future<String?> refreshAccessToken() async => null;
  @override Future<AuthSnapshot> restore() async => const AuthSnapshot(AuthStatus.unauthenticated);
  @override Future<void> signIn({required String email, required String password}) async {}
  @override Future<bool> signUp({required String email, required String password}) async => signupCompletes;
  @override Future<void> signOut() async {}
}
