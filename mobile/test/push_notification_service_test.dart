import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/core/push/push_notification_service.dart';

void main() {
  test(
    'allowlisted queue waits for readiness, deduplicates, and drains once',
    () async {
      final queue = PushIntentQueue();
      final intent = PushDestinationIntent.parse({
        'destinationType': 'HOME',
        'notificationType': 'READING_READY',
      })!;
      queue.enqueue(intent, identity: 'message-1');
      queue.enqueue(intent, identity: 'message-1');
      var navigations = 0;
      final drain = PushIntentDrain(
        queue: queue,
        navigate: (_) async {
          navigations++;
          return true;
        },
      );
      expect(await drain.drain(), isFalse);
      drain.markReady();
      expect(await drain.drain(), isTrue);
      expect(await drain.drain(), isFalse);
      expect(navigations, 1);
    },
  );
  test(
    'push intent parser rejects raw routes and incomplete reading detail',
    () {
      expect(
        PushDestinationIntent.parse({'destinationType': '/admin'}),
        isNull,
      );
      expect(
        PushDestinationIntent.parse({'destinationType': 'READING_DETAIL'}),
        isNull,
      );
      expect(
        PushDestinationIntent.parse({
          'destinationType': 'READING_DETAIL',
          'readingId': 'reading-1',
        }),
        isNotNull,
      );
    },
  );
}
