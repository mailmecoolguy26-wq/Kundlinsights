import 'package:flutter/material.dart';

/// Small dark-state surface shared by Dasha loading, retry, and invalid-link
/// states. It intentionally contains no astrology interpretation.
class DashaStatusView extends StatelessWidget {
  const DashaStatusView.loading({super.key})
    : title = null,
      body = null,
      actionLabel = null,
      onAction = null;

  const DashaStatusView.error({
    super.key,
    required this.title,
    required this.body,
    required this.actionLabel,
    required this.onAction,
  });

  final String? title;
  final String? body;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    if (title == null) {
      return const Center(
        child: CircularProgressIndicator(color: _DashaColors.gold),
      );
    }
    return Center(
      child: Container(
        constraints: const BoxConstraints(maxWidth: 420),
        margin: const EdgeInsets.all(20),
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: _DashaColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: _DashaColors.border),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.info_outline, color: _DashaColors.gold, size: 32),
            const SizedBox(height: 12),
            Text(
              title!,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: _DashaColors.alabaster,
                fontSize: 22,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              body!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: _DashaColors.slate, height: 1.45),
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: onAction,
              style: FilledButton.styleFrom(
                backgroundColor: _DashaColors.gold,
                foregroundColor: _DashaColors.midnight,
              ),
              child: Text(actionLabel!),
            ),
          ],
        ),
      ),
    );
  }
}

class DashaInvalidLinkScreen extends StatelessWidget {
  const DashaInvalidLinkScreen({super.key, required this.onBackToDasha});

  final VoidCallback onBackToDasha;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: _DashaColors.midnight,
    body: SafeArea(
      child: DashaStatusView.error(
        title: 'Dasha link unavailable',
        body: 'This Dasha link is incomplete or no longer valid.',
        actionLabel: 'Back to Dasha',
        onAction: onBackToDasha,
      ),
    ),
  );
}

abstract final class _DashaColors {
  static const midnight = Color(0xFF0B071B);
  static const surface = Color(0xFF181335);
  static const alabaster = Color(0xFFFAF7F2);
  static const slate = Color(0xFF9E9AA9);
  static const gold = Color(0xFFF4BF50);
  static const border = Color(0x66C5A059);
}
