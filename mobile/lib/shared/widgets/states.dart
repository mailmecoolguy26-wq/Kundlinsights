import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';
import '../../l10n/app_localizations.dart';

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.body,
    this.actionLabel,
    this.onAction,
  });
  final IconData icon;
  final String title, body;
  final String? actionLabel;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) => Semantics(
    label: '$title. $body',
    child: Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 44),
            const SizedBox(height: AppSpacing.md),
            Text(
              title,
              style: Theme.of(context).textTheme.headlineSmall,
              textAlign: TextAlign.center,
            ),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: AppSpacing.md),
              FilledButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
            const SizedBox(height: AppSpacing.xs),
            Text(
              body,
              style: Theme.of(context).textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    ),
  );
}

class LoadingState extends StatelessWidget {
  const LoadingState({super.key, this.label});
  final String? label;
  @override
  Widget build(BuildContext context) => Center(
    child: Semantics(
      label: label ?? AppLocalizations.of(context)!.loading,
      liveRegion: true,
      child: const CircularProgressIndicator(),
    ),
  );
}

class ErrorState extends StatelessWidget {
  const ErrorState({
    super.key,
    required this.message,
    this.title,
    this.onRetry,
    this.retryLabel,
  });
  final String message;
  final String? title;
  final VoidCallback? onRetry;
  final String? retryLabel;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return EmptyState(
      icon: Icons.error_outline,
      title: title ?? t.somethingWentWrong,
      body: message,
      actionLabel: onRetry == null ? null : retryLabel ?? t.retry,
      onAction: onRetry,
    );
  }
}
