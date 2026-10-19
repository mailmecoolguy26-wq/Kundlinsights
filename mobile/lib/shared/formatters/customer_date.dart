import 'package:intl/intl.dart';

/// Keeps all customer-facing timing dates on the device's local calendar.
/// The server-provided UTC instant itself is never changed.
String formatCustomerLocalDate(DateTime instant) =>
    DateFormat('d MMM y').format(instant.toLocal());
