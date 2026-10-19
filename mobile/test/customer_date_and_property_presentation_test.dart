import 'package:flutter_test/flutter_test.dart';
import 'package:intl/intl.dart';
import 'package:kundlinsights_mobile/features/property/presentation/property_hub_screen.dart';
import 'package:kundlinsights_mobile/shared/formatters/customer_date.dart';

void main() {
  test(
    'Property and Vehicle shared formatter uses the device-local calendar',
    () {
      final instant = DateTime.parse('2026-07-18T21:55:32.729Z');
      expect(
        formatCustomerLocalDate(instant),
        DateFormat('d MMM y').format(instant.toLocal()),
      );
    },
  );

  test('Property transit wording never exposes raw boolean values', () {
    expect(propertyTransitConfirmationLabel(true), 'Confirmed');
    expect(propertyTransitConfirmationLabel(false), 'Not currently confirmed');
    expect(
      propertyTransitConfirmationLabel(false),
      isNot(anyOf('True', 'False')),
    );
  });
}
