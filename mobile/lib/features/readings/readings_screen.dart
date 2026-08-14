import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import '../../shared/widgets/states.dart';

class ReadingsScreen extends StatelessWidget {
  const ReadingsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return SafeArea(
      child: EmptyState(
        icon: Icons.menu_book_outlined,
        title: t.detailedReadings,
        body: t.readingsBody,
      ),
    );
  }
}
