import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';
import '../auth/auth_controller.dart';
import '../../l10n/app_localizations.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/app_page_scaffold.dart';
import '../../shared/widgets/section_header.dart';
import '../profiles/profile_controller.dart';

import 'package:go_router/go_router.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({
    super.key,
    required this.authController,
    required this.profileController,
  });

  final AuthController authController;
  final ProfileController profileController;
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: authController,
    builder: (context, child) {
      final t = AppLocalizations.of(context)!;
      return AppPageScaffold(
        body: ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            SectionHeader(title: t.settings),
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: AppCard(
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(t.birthProfiles),
                  subtitle: Text(
                    profileController.activeProfile?.label ?? t.unavailable,
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.go('/profiles'),
                ),
              ),
            ),
            for (final label in [t.language, t.privacy, t.terms])
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: AppCard(
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(label),
                    subtitle: Text(t.unavailable),
                    trailing: const Icon(Icons.chevron_right),
                    enabled: false,
                  ),
                ),
              ),
            const SizedBox(height: AppSpacing.md),
            if (authController.signOutError != null)
              Semantics(
                liveRegion: true,
                child: Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: Text(
                    authController.signOutError!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              ),
            OutlinedButton.icon(
              onPressed: authController.isSigningOut
                  ? null
                  : authController.logout,
              icon: authController.isSigningOut
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.logout),
              label: Text(
                authController.isSigningOut ? 'Signing out…' : t.signOut,
              ),
            ),
          ],
        ),
      );
    },
  );
}
