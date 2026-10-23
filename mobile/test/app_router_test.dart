import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

void main() {
  testWidgets('reopening a timeline route uses separate route-instance keys', (
    tester,
  ) async {
    final router = GoRouter(
      initialLocation: '/career',
      routes: [
        GoRoute(
          path: '/career',
          builder: (context, state) => Scaffold(
            body: TextButton(
              onPressed: () => context.push('/career/timeline/reading-a'),
              child: const Text('Open timeline'),
            ),
          ),
          routes: [
            GoRoute(
              path: 'timeline/:id',
              pageBuilder: (context, state) => MaterialPage<void>(
                key: state.pageKey,
                child: Scaffold(
                  appBar: AppBar(),
                  body: const Text('Career Timeline'),
                ),
              ),
            ),
          ],
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.tap(find.text('Open timeline'));
    await tester.pumpAndSettle();
    expect(find.text('Career Timeline'), findsOneWidget);

    router.pop();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Open timeline'));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text('Career Timeline'), findsOneWidget);
  });
}
