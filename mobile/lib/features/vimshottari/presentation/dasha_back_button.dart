import 'package:flutter/material.dart';

/// Shared Dasha drill-down navigation control. Its explicit square bounds keep
/// the circular surface anchored to the page content grid inside scroll views.
class DashaBackButton extends StatelessWidget {
  const DashaBackButton({super.key, required this.onPressed});
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 48,
    height: 48,
    child: Material(
      color: const Color(0xFF1B1234),
      shape: const CircleBorder(),
      child: IconButton(
        onPressed: onPressed,
        icon: const Icon(Icons.arrow_back, color: Color(0xFFFAF7F2)),
        tooltip: 'Back',
      ),
    ),
  );
}
