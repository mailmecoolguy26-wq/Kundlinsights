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
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, child) {
      final t = AppLocalizations.of(context)!;
      if (controller.state == ProfileLoadState.loading) {
        return const Scaffold(body: LoadingState());
      }
      if (controller.state == ProfileLoadState.error) {
        return Scaffold(
          appBar: AppBar(title: Text(t.birthProfiles)),
          body: ErrorState(
            message: t.profileRequestFailed,
            onRetry: controller.load,
            retryLabel: t.retry,
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
        body: controller.profiles.isEmpty
            ? EmptyState(
                icon: Icons.person_outline,
                title: t.noBirthProfilesTitle,
                body: t.noBirthProfilesBody,
                actionLabel: t.addProfile,
                onAction: () => context.go('/profiles/add'),
              )
            : ListView(
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
    },
  );
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
          Text(t.birthDetails, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          _ProfileTile(
            profile: profile,
            active: controller.activeProfile?.id == profile.id,
            onTap: () => controller.select(profile),
            formattedBirthDetails: true,
          ),
          const SizedBox(height: AppSpacing.md),
          Card(
            child: ListTile(
              title: Text(t.careerCalibration),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.go('/career-calibration'),
            ),
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
    this.formattedBirthDetails = false,
  });
  final BirthProfile profile;
  final bool active;
  final VoidCallback onTap;
  final bool formattedBirthDetails;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return Card(
      child: ListTile(
        title: Text(profile.label),
        subtitle: Text(_birthDetails(context, profile, formattedBirthDetails)),
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

  String _birthDetails(
    BuildContext context,
    BirthProfile profile,
    bool formatted,
  ) {
    final date = profile.birthData.localDate;
    final time = profile.birthData.localTime;
    if (!formatted) return '$date · $time';
    final parsedDate = DateTime.tryParse(date);
    final parts = time.split(':');
    final hour = parts.isNotEmpty ? int.tryParse(parts[0]) : null;
    final minute = parts.length > 1 ? int.tryParse(parts[1]) : null;
    if (parsedDate == null || hour == null || minute == null) {
      return '$date · $time';
    }
    return '${MaterialLocalizations.of(context).formatMediumDate(parsedDate)} · ${MaterialLocalizations.of(context).formatTimeOfDay(TimeOfDay(hour: hour, minute: minute))}';
  }
}
