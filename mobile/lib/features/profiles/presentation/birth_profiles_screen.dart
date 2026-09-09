import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../l10n/app_localizations.dart';
import '../domain/birth_profile.dart';
import '../profile_controller.dart';

class BirthProfilesScreen extends StatelessWidget {
  const BirthProfilesScreen({super.key, required this.controller});
  final ProfileController controller;

  static const _midnight = Color(0xFF0B071B);
  static const _abyss = Color(0xFF120D29);
  static const _violet = Color(0xFF1B1234);
  static const _alabaster = Color(0xFFFAF7F2);
  static const _slate = Color(0xFF9E9AA9);
  static const _gold = Color(0xFFC5A059);

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, child) {
      if (controller.state == ProfileLoadState.loading) {
        return const Scaffold(
          backgroundColor: _midnight,
          body: Center(child: CircularProgressIndicator(color: _gold)),
        );
      }
      if (controller.state == ProfileLoadState.error) {
        return _ProfilesScaffold(
          onBack: () => _goBack(context),
          body: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.cloud_off_outlined, color: _gold, size: 32),
                  const SizedBox(height: 12),
                  Text(
                    AppLocalizations.of(context)!.profileRequestFailed,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: _slate),
                  ),
                  const SizedBox(height: 16),
                  OutlinedButton(
                    onPressed: controller.load,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: _alabaster,
                      side: const BorderSide(color: _gold),
                    ),
                    child: Text(AppLocalizations.of(context)!.retry),
                  ),
                ],
              ),
            ),
          ),
        );
      }
      return _ProfilesScaffold(
        onBack: () => _goBack(context),
        addLabel: AppLocalizations.of(context)!.addProfile,
        onAdd: () => context.go('/profiles/add'),
        body: controller.profiles.isEmpty
            ? const _EmptyProfilesState()
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 112),
                itemCount: controller.profiles.length,
                separatorBuilder: (_, index) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final profile = controller.profiles[index];
                  return _ProfileCard(
                    profile: profile,
                    active: controller.activeProfile?.id == profile.id,
                    onTap: () {
                      controller.select(profile);
                      context.go('/profiles/${profile.id}');
                    },
                  );
                },
              ),
      );
    },
  );

  void _goBack(BuildContext context) {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
      return;
    }
    context.go('/profile');
  }
}

class _ProfilesScaffold extends StatelessWidget {
  const _ProfilesScaffold({
    required this.onBack,
    required this.body,
    this.addLabel,
    this.onAdd,
  });

  final VoidCallback onBack;
  final Widget body;
  final String? addLabel;
  final VoidCallback? onAdd;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: BirthProfilesScreen._midnight,
    body: SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Material(
                  color: BirthProfilesScreen._violet,
                  shape: const CircleBorder(),
                  child: IconButton(
                    tooltip: MaterialLocalizations.of(context)
                        .backButtonTooltip,
                    onPressed: onBack,
                    icon: const Icon(
                      Icons.arrow_back,
                      color: BirthProfilesScreen._alabaster,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'PROFILES',
                        style: TextStyle(
                          color: BirthProfilesScreen._gold,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.7,
                        ),
                      ),
                      SizedBox(height: 3),
                      Text(
                        'Birth Profiles',
                        style: TextStyle(
                          color: BirthProfilesScreen._alabaster,
                          fontFamily: 'EBGaramond',
                          fontSize: 30,
                          height: 1.05,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Manage the people whose charts you follow',
                        style: TextStyle(
                          color: BirthProfilesScreen._slate,
                          fontSize: 13,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(child: body),
          if (addLabel != null && onAdd != null)
            SafeArea(
              top: false,
              minimum: const EdgeInsets.fromLTRB(20, 8, 20, 16),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: onAdd,
                  icon: const Icon(
                    Icons.add,
                    color: BirthProfilesScreen._midnight,
                  ),
                  label: Text(addLabel!),
                  style: FilledButton.styleFrom(
                    backgroundColor: BirthProfilesScreen._gold,
                    foregroundColor: BirthProfilesScreen._midnight,
                    minimumSize: const Size.fromHeight(50),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    textStyle: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      letterSpacing: .4,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    ),
  );
}

class _EmptyProfilesState extends StatelessWidget {
  const _EmptyProfilesState();

  @override
  Widget build(BuildContext context) => const Center(
    child: Padding(
      padding: EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.person_outline,
            color: BirthProfilesScreen._gold,
            size: 38,
          ),
          SizedBox(height: 14),
          Text(
            'No birth profiles yet',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: BirthProfilesScreen._alabaster,
              fontSize: 20,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: 8),
          Text(
            'Create a birth profile to get started.',
            textAlign: TextAlign.center,
            style: TextStyle(color: BirthProfilesScreen._slate, height: 1.4),
          ),
        ],
      ),
    ),
  );
}

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({
    required this.profile,
    required this.active,
    required this.onTap,
  });

  final BirthProfile profile;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: active,
    label: '${profile.label}${active ? ', active profile' : ''}',
    child: Material(
      color: active ? const Color(0xFF21153D) : BirthProfilesScreen._abyss,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          constraints: const BoxConstraints(minHeight: 76),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: active ? const Color(0x99C5A059) : const Color(0x335E4A87),
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 46,
                height: 46,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: Color(0xFF2A1B4C),
                  shape: BoxShape.circle,
                ),
                child: Text(
                  _initials(profile.label),
                  style: const TextStyle(
                    color: BirthProfilesScreen._gold,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      profile.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: BirthProfilesScreen._alabaster,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _formattedBirthDetails(profile),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: BirthProfilesScreen._slate,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              if (active)
                const _ActivePill()
              else
                const Icon(
                  Icons.chevron_right,
                  color: BirthProfilesScreen._gold,
                ),
            ],
          ),
        ),
      ),
    ),
  );

  static String _initials(String label) {
    final initials = label
        .trim()
        .split(RegExp(r'\s+'))
        .where((word) => word.isNotEmpty)
        .take(2)
        .map((word) => word[0])
        .join();
    return initials.isEmpty ? '?' : initials.toUpperCase();
  }

  static String _formattedBirthDetails(BirthProfile profile) {
    final parsedDate = DateTime.tryParse(profile.birthData.localDate);
    final timeParts = profile.birthData.localTime.split(':');
    final hour = timeParts.isNotEmpty ? int.tryParse(timeParts.first) : null;
    final minute = timeParts.length > 1 ? int.tryParse(timeParts[1]) : null;
    if (parsedDate == null || hour == null || minute == null) {
      return '${profile.birthData.localDate} · ${profile.birthData.localTime}';
    }
    return '${DateFormat('d MMM yyyy').format(parsedDate)} · ${DateFormat('h:mm a').format(DateTime(2000, 1, 1, hour, minute))}';
  }
}

class _ActivePill extends StatelessWidget {
  const _ActivePill();

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
    decoration: BoxDecoration(
      color: const Color(0x332F2413),
      borderRadius: BorderRadius.circular(999),
      border: Border.all(color: const Color(0x66C5A059)),
    ),
    child: const Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.circle, size: 6, color: BirthProfilesScreen._gold),
        SizedBox(width: 5),
        Text(
          'ACTIVE',
          style: TextStyle(
            color: BirthProfilesScreen._gold,
            fontSize: 10,
            fontWeight: FontWeight.w700,
            letterSpacing: 1,
          ),
        ),
      ],
    ),
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
        backgroundColor: BirthProfilesScreen._midnight,
        appBar: _profileDetailAppBar(t.birthProfiles),
        body: Center(
          child: Text(
            t.profileUnavailable,
            style: const TextStyle(color: BirthProfilesScreen._slate),
          ),
        ),
      );
    }
    return Scaffold(
      backgroundColor: BirthProfilesScreen._midnight,
      appBar: _profileDetailAppBar(profile.label),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 36),
          children: [
            Text(
              t.birthDetails,
              style: const TextStyle(
                color: BirthProfilesScreen._alabaster,
                fontFamily: 'EBGaramond',
                fontSize: 25,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),
            _ProfileDetailBirthCard(
              profile: profile,
              active: controller.activeProfile?.id == profile.id,
              onTap: () => controller.select(profile),
            ),
            const SizedBox(height: 24),
            _ProfileDetailCareerHistoryCard(
              label: t.careerCalibration,
              onTap: () => context.push('/career-calibration'),
            ),
            const SizedBox(height: 18),
            _ProfileDetailInfoNote(message: t.editDeleteUnavailable),
          ],
        ),
      ),
    );
  }

  AppBar _profileDetailAppBar(String title) => AppBar(
    backgroundColor: BirthProfilesScreen._midnight,
    foregroundColor: BirthProfilesScreen._alabaster,
    surfaceTintColor: Colors.transparent,
    title: Text(
      title,
      style: const TextStyle(
        color: BirthProfilesScreen._alabaster,
        fontFamily: 'EBGaramond',
        fontSize: 25,
        fontWeight: FontWeight.w600,
      ),
    ),
  );
}

class _ProfileDetailBirthCard extends StatelessWidget {
  const _ProfileDetailBirthCard({
    required this.profile,
    required this.active,
    required this.onTap,
  });
  final BirthProfile profile;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: BirthProfilesScreen._abyss,
    borderRadius: BorderRadius.circular(18),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: active ? const Color(0x99C5A059) : const Color(0x335E4A87),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    color: Color(0xFF2A1B4C),
                    shape: BoxShape.circle,
                  ),
                  child: Text(
                    _profileInitials(profile.label),
                    style: const TextStyle(
                      color: BirthProfilesScreen._gold,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    profile.label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: BirthProfilesScreen._alabaster,
                      fontSize: 17,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                if (active)
                  const _ProfileDetailActiveChip()
                else
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: BirthProfilesScreen._gold,
                  ),
              ],
            ),
            const SizedBox(height: 18),
            const Divider(color: Color(0x335E4A87), height: 1),
            const SizedBox(height: 15),
            _ProfileDetailValue(
              label: 'BIRTH DATE',
              value: _birthDate(context, profile),
            ),
            const SizedBox(height: 13),
            _ProfileDetailValue(
              label: 'BIRTH TIME',
              value: _birthTime(context, profile),
            ),
          ],
        ),
      ),
    ),
  );

  static String _birthDate(BuildContext context, BirthProfile profile) {
    final date = DateTime.tryParse(profile.birthData.localDate);
    return date == null
        ? profile.birthData.localDate
        : MaterialLocalizations.of(context).formatMediumDate(date);
  }

  static String _birthTime(BuildContext context, BirthProfile profile) {
    final parts = profile.birthData.localTime.split(':');
    final hour = parts.isNotEmpty ? int.tryParse(parts.first) : null;
    final minute = parts.length > 1 ? int.tryParse(parts[1]) : null;
    if (hour == null || minute == null) return profile.birthData.localTime;
    return MaterialLocalizations.of(context)
        .formatTimeOfDay(TimeOfDay(hour: hour, minute: minute));
  }

  static String _profileInitials(String label) {
    final initials = label
        .trim()
        .split(RegExp(r'\s+'))
        .where((word) => word.isNotEmpty)
        .take(2)
        .map((word) => word[0])
        .join();
    return initials.isEmpty ? '?' : initials.toUpperCase();
  }
}

class _ProfileDetailActiveChip extends StatelessWidget {
  const _ProfileDetailActiveChip();

  @override
  Widget build(BuildContext context) => Semantics(
    label: AppLocalizations.of(context)!.activeProfileIndicator,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0x1FC5A059),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0x66C5A059)),
      ),
      child: const Text(
        'ACTIVE',
        style: TextStyle(
          color: BirthProfilesScreen._gold,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 1,
        ),
      ),
    ),
  );
}

class _ProfileDetailValue extends StatelessWidget {
  const _ProfileDetailValue({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        label,
        style: const TextStyle(
          color: BirthProfilesScreen._gold,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.1,
        ),
      ),
      const SizedBox(height: 4),
      Text(
        value,
        style: const TextStyle(
          color: BirthProfilesScreen._alabaster,
          fontSize: 15,
          fontWeight: FontWeight.w500,
        ),
      ),
    ],
  );
}

class _ProfileDetailCareerHistoryCard extends StatelessWidget {
  const _ProfileDetailCareerHistoryCard({
    required this.label,
    required this.onTap,
  });
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: BirthProfilesScreen._violet,
    borderRadius: BorderRadius.circular(16),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        constraints: const BoxConstraints(minHeight: 64),
        padding: const EdgeInsets.symmetric(horizontal: 17, vertical: 13),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0x665E4A87)),
        ),
        child: Row(
          children: [
            const Icon(
              Icons.auto_awesome_outlined,
              color: BirthProfilesScreen._gold,
              size: 21,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  color: BirthProfilesScreen._alabaster,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              color: BirthProfilesScreen._gold,
            ),
          ],
        ),
      ),
    ),
  );
}

class _ProfileDetailInfoNote extends StatelessWidget {
  const _ProfileDetailInfoNote({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Padding(
        padding: EdgeInsets.only(top: 1),
        child: Icon(
          Icons.info_outline_rounded,
          color: BirthProfilesScreen._slate,
          size: 16,
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: Text(
          message,
          style: const TextStyle(
            color: BirthProfilesScreen._slate,
            fontSize: 12,
            height: 1.4,
          ),
        ),
      ),
    ],
  );
}
