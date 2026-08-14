import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_theme.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/widgets/states.dart';
import '../domain/birth_profile.dart';
import '../profile_controller.dart';

class BirthProfilesScreen extends StatelessWidget {
  const BirthProfilesScreen({super.key, required this.controller});
  final ProfileController controller;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    if (controller.state == ProfileLoadState.loading) {
      return const Scaffold(body: LoadingState());
    }
    if (controller.state == ProfileLoadState.error) {
      return Scaffold(
        appBar: AppBar(title: Text(t.birthProfiles)),
        body: Center(
          child: FilledButton(onPressed: controller.load, child: Text(t.retry)),
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(title: Text(t.birthProfiles)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.go('/profiles/add'),
        icon: const Icon(Icons.add),
        label: Text(t.addProfile),
      ),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: controller.profiles
            .map(
              (profile) => _ProfileTile(
                profile: profile,
                active: controller.activeProfile?.id == profile.id,
                onTap: () {
                  controller.select(profile);
                  context.go('/profiles/${profile.id}');
                },
              ),
            )
            .toList(),
      ),
    );
  }
}

class ProfileDetailScreen extends StatelessWidget {
  const ProfileDetailScreen({
    super.key,
    required this.controller,
    required this.profileId,
  });
  final ProfileController controller;
  final String profileId;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final profile = controller.profiles
        .where((item) => item.id == profileId)
        .firstOrNull;
    if (profile == null) {
      return Scaffold(
        appBar: AppBar(title: Text(t.birthProfiles)),
        body: Center(child: Text(t.profileUnavailable)),
      );
    }
    return Scaffold(
      appBar: AppBar(title: Text(profile.label)),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          _ProfileTile(
            profile: profile,
            active: controller.activeProfile?.id == profile.id,
            onTap: () => controller.select(profile),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(t.editDeleteUnavailable),
        ],
      ),
    );
  }
}

class _ProfileTile extends StatelessWidget {
  const _ProfileTile({
    required this.profile,
    required this.active,
    required this.onTap,
  });
  final BirthProfile profile;
  final bool active;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return Card(
      child: ListTile(
        title: Text(profile.label),
        subtitle: Text(profile.birthData.localDate),
        trailing: active
            ? Semantics(
                label: t.activeProfileIndicator,
                child: Chip(label: Text(t.active)),
              )
            : const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}
