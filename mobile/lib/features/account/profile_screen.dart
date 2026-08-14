import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';
import '../auth/auth_controller.dart';
import '../../l10n/app_localizations.dart';
import '../../shared/widgets/app_card.dart';
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
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return SafeArea(
      child: ListView(
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
          OutlinedButton.icon(
            onPressed: authController.logout,
            icon: const Icon(Icons.logout),
            label: Text(t.signOut),
          ),
        ],
      ),
    );
  }
}
