import 'package:flutter/material.dart';

import '../auth/auth_controller.dart';
import '../../l10n/app_localizations.dart';
import '../profiles/profile_controller.dart';
import '../readings/career_explanation_language.dart';

import 'package:go_router/go_router.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({
    super.key,
    required this.authController,
    required this.profileController,
    this.careerExplanationLanguage,
  });

  final AuthController authController;
  final ProfileController profileController;
  final CareerExplanationLanguageController? careerExplanationLanguage;

  static const _midnight = Color(0xFF0B071B);
  static const _alabaster = Color(0xFFFAF7F2);
  static const _slate = Color(0xFF9E9AA9);
  static const _gold = Color(0xFFC5A059);

  @override
  Widget build(BuildContext context) {
    final listenables = <Listenable>[authController, profileController];
    if (careerExplanationLanguage != null) {
      listenables.add(careerExplanationLanguage!);
    }
    return AnimatedBuilder(
      animation: Listenable.merge(listenables),
      builder: (context, child) {
        final t = AppLocalizations.of(context)!;
        final activeProfile = profileController.activeProfile;
        final profileLabel = activeProfile?.label ?? t.unavailable;
        return Scaffold(
          backgroundColor: _midnight,
          body: SafeArea(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
              children: [
                const Text(
                  'PROFILE',
                  style: TextStyle(
                    color: _gold,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.8,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Profile & Settings',
                  style: TextStyle(
                    color: _alabaster,
                    fontFamily: 'EBGaramond',
                    fontSize: 32,
                    height: 1.05,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Manage your birth profiles and account',
                  style: TextStyle(color: _slate, fontSize: 14, height: 1.45),
                ),
                const SizedBox(height: 28),
                Semantics(
                  button: true,
                  label: 'Active birth profile: $profileLabel',
                  child: _ActiveProfileCard(
                    profileLabel: profileLabel,
                    onTap: () => context.push('/profiles'),
                  ),
                ),
                const SizedBox(height: 16),
                _SettingsRow(
                  title: t.birthProfiles,
                  subtitle: 'Manage saved birth profiles',
                  onTap: () => context.push('/profiles'),
                ),
                if (careerExplanationLanguage != null) ...[
                  const SizedBox(height: 12),
                  _CareerReadingLanguageSelector(
                    controller: careerExplanationLanguage!,
                  ),
                ],
                const SizedBox(height: 44),
                if (authController.signOutError != null)
                  Semantics(
                    liveRegion: true,
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(
                        authController.signOutError!,
                        style: const TextStyle(
                          color: Color(0xFFF2A7A7),
                          fontSize: 13,
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
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: _gold,
                          ),
                        )
                      : const Icon(Icons.logout_outlined, color: _alabaster),
                  label: Text(
                    authController.isSigningOut ? t.signingOut : t.signOut,
                  ),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(50),
                    foregroundColor: _alabaster,
                    side: const BorderSide(color: Color(0x665E4A87)),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    textStyle: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _CareerReadingLanguageSelector extends StatelessWidget {
  const _CareerReadingLanguageSelector({required this.controller});
  final CareerExplanationLanguageController controller;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: const Color(0xFF160E2C),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: const Color(0x335E4A87)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Astrology Language',
          style: TextStyle(
            color: Color(0xFFFAF7F2),
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 10),
        SegmentedButton<CareerExplanationLanguage>(
          segments: const [
            ButtonSegment(
              value: CareerExplanationLanguage.english,
              label: Text('English'),
            ),
            ButtonSegment(
              value: CareerExplanationLanguage.hinglish,
              label: Text('Hinglish'),
            ),
          ],
          selected: {controller.language},
          onSelectionChanged: (selection) =>
              controller.setLanguage(selection.first),
          style: ButtonStyle(
            foregroundColor: WidgetStateProperty.resolveWith(
              (states) => states.contains(WidgetState.selected)
                  ? const Color(0xFF0B071B)
                  : const Color(0xFFFAF7F2),
            ),
            backgroundColor: WidgetStateProperty.resolveWith(
              (states) => states.contains(WidgetState.selected)
                  ? const Color(0xFFF4BF50)
                  : const Color(0xFF1B1234),
            ),
          ),
        ),
      ],
    ),
  );
}

class _ActiveProfileCard extends StatelessWidget {
  const _ActiveProfileCard({required this.profileLabel, required this.onTap});

  final String profileLabel;
  final VoidCallback onTap;

  static const _surface = Color(0xFF1B1234);
  static const _alabaster = Color(0xFFFAF7F2);
  static const _gold = Color(0xFFC5A059);

  @override
  Widget build(BuildContext context) => Material(
    color: _surface,
    borderRadius: BorderRadius.circular(18),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0x66C5A059)),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                color: Color(0xFF2A1B4C),
                shape: BoxShape.circle,
              ),
              child: Text(
                _initials(profileLabel),
                style: const TextStyle(
                  color: _gold,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    profileLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: _alabaster,
                      fontSize: 17,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 5),
                  const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.circle, size: 7, color: _gold),
                      SizedBox(width: 6),
                      Text(
                        'ACTIVE PROFILE',
                        style: TextStyle(
                          color: _gold,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.25,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: _gold),
          ],
        ),
      ),
    ),
  );

  static String _initials(String label) {
    final words = label
        .trim()
        .split(RegExp(r'\s+'))
        .where((word) => word.isNotEmpty);
    final initials = words.take(2).map((word) => word[0]).join();
    return initials.isEmpty ? '?' : initials.toUpperCase();
  }
}

class _SettingsRow extends StatelessWidget {
  const _SettingsRow({
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: const Color(0xFF160E2C),
    borderRadius: BorderRadius.circular(16),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0x335E4A87)),
        ),
        child: Row(
          children: [
            const Icon(Icons.account_circle_outlined, color: Color(0xFFC5A059)),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: Color(0xFFFAF7F2),
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      color: Color(0xFF9E9AA9),
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Color(0xFFC5A059)),
          ],
        ),
      ),
    ),
  );
}
