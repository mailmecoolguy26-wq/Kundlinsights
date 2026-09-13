import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';
import '../../l10n/app_localizations.dart';

const _midnight = Color(0xFF0B071B);
const _abyss = Color(0xFF120D29);
const _alabaster = Color(0xFFFAF7F2);
const _slate = Color(0xFF9E9AA9);
const _gold = Color(0xFFC5A059);
const _border = Color(0x665E4A87);

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
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 360),
          padding: const EdgeInsets.all(AppSpacing.xl),
          decoration: BoxDecoration(
            color: _abyss,
            borderRadius: AppRadius.medium,
            border: Border.all(color: _border),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 40, color: _gold),
              const SizedBox(height: AppSpacing.md),
              Text(
                title,
                style: const TextStyle(
                  color: _alabaster,
                  fontSize: 21,
                  height: 1.25,
                  fontWeight: FontWeight.w600,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                body,
                style: const TextStyle(
                  color: _slate,
                  fontSize: 14,
                  height: 1.45,
                ),
                textAlign: TextAlign.center,
              ),
              if (actionLabel != null && onAction != null) ...[
                const SizedBox(height: AppSpacing.lg),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: onAction,
                    style: FilledButton.styleFrom(
                      backgroundColor: _gold,
                      foregroundColor: _midnight,
                    ),
                    child: Text(actionLabel!),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    ),
  );
}

class LoadingState extends StatelessWidget {
  const LoadingState({super.key, this.label});
  final String? label;
  @override
  Widget build(BuildContext context) => Container(
    color: _midnight,
    alignment: Alignment.center,
    child: Semantics(
      container: true,
      label: label ?? AppLocalizations.of(context)!.loading,
      liveRegion: true,
      child: ExcludeSemantics(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
              height: 26,
              width: 26,
              child: CircularProgressIndicator(strokeWidth: 2.5, color: _gold),
            ),
            if (label != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(label!, style: const TextStyle(color: _slate, fontSize: 14)),
            ],
          ],
        ),
      ),
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
