import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/shared/widgets/states.dart';

void main() {
  Widget frame(Widget child) => MaterialApp(home: Scaffold(body: child));

  testWidgets('shared loading and empty states render accessible copy', (
    tester,
  ) async {
    await tester.pumpWidget(
      frame(
        const Column(
          children: [
            Expanded(child: LoadingState(label: 'Loading readings')),
            Expanded(
              child: EmptyState(
                icon: Icons.inbox_outlined,
                title: 'Nothing here',
                body: 'Create an item to begin.',
              ),
            ),
          ],
        ),
      ),
    );

    expect(find.bySemanticsLabel('Loading readings'), findsOneWidget);
    expect(find.text('Nothing here'), findsOneWidget);
    expect(find.text('Create an item to begin.'), findsOneWidget);
  });

  testWidgets('shared error retry invokes its callback once', (tester) async {
    var retries = 0;
    await tester.pumpWidget(
      frame(
        ErrorState(
          title: 'Unable to load',
          message: 'Check your connection and try again.',
          retryLabel: 'Try again',
          onRetry: () => retries++,
        ),
      ),
    );

    expect(find.text('Unable to load'), findsOneWidget);
    expect(find.text('Check your connection and try again.'), findsOneWidget);
    await tester.tap(find.text('Try again'));
    expect(retries, 1);
  });

  testWidgets('shared states tolerate large text', (tester) async {
    await tester.pumpWidget(
      MediaQuery(
        data: const MediaQueryData(textScaler: TextScaler.linear(2)),
        child: frame(
          const ErrorState(
            message: 'The requested data is currently unavailable.',
            onRetry: _noop,
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
  });
}

void _noop() {}
