import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../career_events/career_event_controller.dart';
import '../career_chat/career_chat_controller.dart';
import '../profiles/domain/birth_profile.dart';
import '../profiles/profile_controller.dart';
import '../readings/career_reading_generation_controller.dart';
import '../readings/reading_controller.dart';

/// Home is presentation-only: every astrological value is supplied by the
/// profile, natal, Vimshottari, or career-event controllers already in scope.
class HomeScreen extends StatelessWidget {
  const HomeScreen({
    super.key,
    required this.profileController,
    required this.careerEventController,
    required this.readingController,
    required this.careerGenerationController,
    required this.careerChatController,
  });

  final ProfileController profileController;
  final CareerEventController careerEventController;
  final ReadingController readingController;
  final CareerReadingGenerationController careerGenerationController;
  final CareerChatController careerChatController;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: Listenable.merge([
      profileController,
      careerEventController,
      readingController,
      careerGenerationController,
      careerChatController,
    ]),
    builder: (context, child) => Scaffold(
      backgroundColor: _HomeColors.background,
      floatingActionButton: FloatingActionButton.extended(
        key: const ValueKey('home-ask-tara-fab'),
        onPressed: () => context.push('/career-chat'),
        backgroundColor: const Color(0xFF0D756E),
        foregroundColor: _HomeColors.alabaster,
        icon: const Icon(Icons.auto_awesome),
        label: Text(
          'Ask Tara',
          style: GoogleFonts.inter(fontWeight: FontWeight.w700),
        ),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          color: _HomeColors.gold,
          onRefresh: () async {
            await careerEventController.refresh();
          },
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
            children: [
              _HomeHeader(profile: profileController.activeProfile),
              const SizedBox(height: 22),
              _Greeting(profile: profileController.activeProfile),
              const SizedBox(height: 14),
              _ProfileSelector(profile: profileController.activeProfile),
              const SizedBox(height: 22),
              _WhatMattersNowHero(
                careerEvents: careerEventController,
                readings: readingController,
              ),
              const SizedBox(height: 30),
              const _SectionTitle('What do you want clarity on?'),
              const SizedBox(height: 12),
              _LifeAreaCards(controller: careerGenerationController),
              const SizedBox(height: 30),
              _CareerPremiumCard(controller: careerGenerationController),
            ],
          ),
        ),
      ),
    ),
  );
}

abstract final class _HomeColors {
  static const background = Color(0xFF061A1A);
  static const abyss = Color(0xFF082625);
  static const violet = Color(0xFF0B2626);
  static const gold = Color(0xFFD6B15A);
  static const champagne = Color(0xFFD6B15A);
  static const alabaster = Color(0xFFF7F4EC);
  static const slate = Color(0xFFA8B7B4);
}

class _HomeHeader extends StatelessWidget {
  const _HomeHeader({required this.profile});
  final BirthProfile? profile;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      const Icon(Icons.auto_awesome, color: _HomeColors.gold, size: 20),
      const SizedBox(width: 8),
      Semantics(
        header: true,
        label: 'TaraVerse',
        child: ExcludeSemantics(
          child: RichText(
            text: TextSpan(
              style: GoogleFonts.ebGaramond(fontSize: 25, height: 1),
              children: const [
                TextSpan(
                  text: 'Tara',
                  style: TextStyle(color: _HomeColors.alabaster),
                ),
                TextSpan(
                  text: 'Verse',
                  style: TextStyle(
                    color: _HomeColors.gold,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      const Spacer(),
      Semantics(
        button: true,
        label: 'Open profile',
        child: InkWell(
          key: const ValueKey('home-profile-avatar'),
          onTap: () => context.go('/profile'),
          borderRadius: BorderRadius.circular(999),
          child: Container(
            width: 38,
            height: 38,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: _HomeColors.violet,
              shape: BoxShape.circle,
              border: Border.all(
                color: _HomeColors.gold.withValues(alpha: .55),
              ),
            ),
            child: Text(
              _initials(profile?.label),
              style: GoogleFonts.inter(
                color: _HomeColors.champagne,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ),
    ],
  );
}

class _Greeting extends StatelessWidget {
  const _Greeting({required this.profile});
  final BirthProfile? profile;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        '${_daypart()}, ${profile?.label ?? 'there'}',
        style: GoogleFonts.ebGaramond(
          color: _HomeColors.alabaster,
          fontSize: 34,
          height: .95,
          fontWeight: FontWeight.w500,
        ),
      ),
      const SizedBox(height: 8),
      Text(
        'Here’s what your chart indicates right now',
        style: GoogleFonts.inter(color: _HomeColors.slate, fontSize: 13),
      ),
    ],
  );
}

class _ProfileSelector extends StatelessWidget {
  const _ProfileSelector({required this.profile});
  final BirthProfile? profile;

  @override
  Widget build(BuildContext context) {
    final date = _birthDate(profile);
    return Align(
      alignment: Alignment.centerLeft,
      child: InkWell(
        key: const ValueKey('home-profile-selector'),
        onTap: () => context.go('/profiles'),
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
          decoration: BoxDecoration(
            color: _HomeColors.violet,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: _HomeColors.gold.withValues(alpha: .25)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.person_outline,
                color: _HomeColors.gold,
                size: 16,
              ),
              const SizedBox(width: 7),
              Text(
                date == null
                    ? (profile?.label ?? 'Birth profile')
                    : '${profile!.label} · $date',
                style: GoogleFonts.inter(
                  color: _HomeColors.alabaster,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: 6),
              const Icon(
                Icons.expand_more,
                color: _HomeColors.champagne,
                size: 17,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _WhatMattersNowHero extends StatelessWidget {
  const _WhatMattersNowHero({
    required this.careerEvents,
    required this.readings,
  });
  final CareerEventController careerEvents;
  final ReadingController readings;

  @override
  Widget build(BuildContext context) {
    final state = _whatMattersNowState(careerEvents, readings);
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF082625), Color(0xFF0B3D3B), Color(0xFF0F5C55)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFF3F8179)),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'WHAT MATTERS NOW',
            style: _labelStyle(color: _HomeColors.champagne),
          ),
          const SizedBox(height: 11),
          Text(state.headline, style: _headlineStyle(fontSize: 28)),
          const SizedBox(height: 10),
          Text(
            state.body,
            style: GoogleFonts.inter(
              color: _HomeColors.slate,
              fontSize: 12,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 18),
          if (!state.isLoading)
            TextButton(
              key: const ValueKey('home-what-matters-ask-tara-cta'),
              onPressed: () => context.push('/career-chat'),
              style: TextButton.styleFrom(
                foregroundColor: _HomeColors.abyss,
                backgroundColor: const Color(0xFF35B9AC),
                padding: const EdgeInsets.symmetric(
                  horizontal: 15,
                  vertical: 12,
                ),
              ),
              child: Text(
                'ASK TARA  →',
                style: _labelStyle(color: _HomeColors.abyss),
              ),
            ),
        ],
      ),
    );
  }
}

class _CareerHeroContent {
  const _CareerHeroContent({
    required this.headline,
    required this.body,
    this.isLoading = false,
  });

  final String headline;
  final String body;
  final bool isLoading;
}

_CareerHeroContent _whatMattersNowState(
  CareerEventController careerEvents,
  ReadingController readings,
) {
  // Both controllers clear their scoped data before fetching a newly selected
  // profile. Render neutral copy until both loads have completed so Profile A
  // can never briefly appear as Profile B with zero events or no reading.
  if (careerEvents.state != CareerEventLoadState.loaded ||
      readings.listState != ReadingListState.loaded) {
    return const _CareerHeroContent(
      headline: 'Your chart has new insights to explore',
      body: 'Preparing this profile’s available insights.',
      isLoading: true,
    );
  }
  final hasCareerReading = readings.readings.any(
    (reading) => reading.domain == 'CAREER',
  );
  if (hasCareerReading) {
    return const _CareerHeroContent(
      headline: 'Your Career Reading is ready',
      body: 'Ask Tara about the current Career context in this reading.',
    );
  }
  return const _CareerHeroContent(
    headline: 'Your chart has new insights to explore',
    body: 'Ask Tara, or choose an area of life below.',
  );
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title);
  final String title;
  @override
  Widget build(BuildContext context) =>
      Row(children: [Text(title, style: _headlineStyle(fontSize: 26))]);
}

class _LifeAreaCards extends StatelessWidget {
  const _LifeAreaCards({required this.controller});
  final CareerReadingGenerationController controller;

  @override
  Widget build(BuildContext context) {
    final active =
        controller.eligibilityState == CareerEligibilityState.eligible;
    String destination(String route) => active ? route : '/premium';
    return Column(
      children: [
        _LifeAreaCard(
          key: const ValueKey('home-life-area-career'),
          icon: Icons.work_outline,
          title: 'Career & Business',
          subtitle: 'Career · Business',
          onTap: () => context.push(destination('/career')),
        ),
        const SizedBox(height: 10),
        _LifeAreaCard(
          key: const ValueKey('home-life-area-vehicle'),
          icon: Icons.directions_car_outlined,
          title: 'Vehicle & Mobility',
          subtitle: 'See when vehicle-related factors are more supportive.',
          onTap: () => context.push(destination('/vehicle')),
        ),
        const SizedBox(height: 10),
        _LifeAreaCard(
          key: ValueKey('home-life-area-wealth'),
          icon: Icons.account_balance_wallet_outlined,
          title: 'Wealth & Money',
          subtitle: 'Wealth timing and financial structure insights.',
          onTap: () => context.push(destination('/wealth')),
        ),
        const SizedBox(height: 10),
        const _LifeAreaCard(
          key: ValueKey('home-life-area-relationships'),
          icon: Icons.favorite_border,
          title: 'Relationships & Family',
          subtitle: 'Marriage · Child Birth',
          comingSoon: true,
        ),
        const SizedBox(height: 10),
        const _LifeAreaCard(
          key: ValueKey('home-life-area-tarot'),
          icon: Icons.auto_awesome_outlined,
          title: 'Tarot',
          subtitle: 'A new way to explore guidance, coming soon.',
          comingSoon: true,
        ),
      ],
    );
  }
}

class _LifeAreaCard extends StatelessWidget {
  const _LifeAreaCard({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    this.onTap,
    this.comingSoon = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;
  final bool comingSoon;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: comingSoon ? const Color(0xFF08211F) : null,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: comingSoon ? const Color(0xFF255C57) : const Color(0xFF3F8179),
        ),
      ),
      child: Row(
        children: [
          Icon(
            icon,
            color: comingSoon ? _HomeColors.slate : const Color(0xFF35B9AC),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: GoogleFonts.inter(
                          color: comingSoon
                              ? _HomeColors.slate
                              : _HomeColors.alabaster,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    if (comingSoon)
                      Text(
                        'COMING NEXT',
                        style: _labelStyle(
                          fontSize: 8,
                          color: _HomeColors.slate,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: GoogleFonts.inter(
                    color: _HomeColors.slate,
                    fontSize: 12,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
          if (!comingSoon)
            const Icon(Icons.chevron_right, color: _HomeColors.slate),
        ],
      ),
    );
    if (comingSoon) return card;
    return Material(
      color: const Color(0xFF103B38),
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: card,
      ),
    );
  }
}

class _CareerPremiumCard extends StatelessWidget {
  const _CareerPremiumCard({required this.controller});
  final CareerReadingGenerationController controller;

  @override
  Widget build(BuildContext context) {
    final loading =
        controller.eligibilityState == CareerEligibilityState.initial ||
        controller.eligibilityState == CareerEligibilityState.loading;
    final active =
        controller.eligibilityState == CareerEligibilityState.eligible;
    final title = active ? 'TaraVerse Premium is active' : 'TaraVerse Premium';
    final body = loading
        ? 'Checking access for this birth profile…'
        : active
        ? 'Your selected birth profile can explore personalized insights.'
        : 'Unlock all personalized insights for this profile.';
    return _DarkCard(
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: active ? const Color(0xFF0E514B) : _HomeColors.violet,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(
              active
                  ? Icons.verified_outlined
                  : Icons.workspace_premium_outlined,
              color: active ? const Color(0xFF35B9AC) : _HomeColors.gold,
            ),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'ACCESS FOR THIS PROFILE',
                  style: _labelStyle(color: _HomeColors.slate, fontSize: 8),
                ),
                const SizedBox(height: 4),
                Text(
                  title,
                  style: GoogleFonts.inter(
                    color: _HomeColors.alabaster,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  body,
                  style: GoogleFonts.inter(
                    color: _HomeColors.slate,
                    fontSize: 12,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
          if (!loading)
            TextButton(
              key: const ValueKey('home-career-premium-cta'),
              onPressed: () => context.push(active ? '/career' : '/premium'),
              child: Text(
                active ? 'ACTIVE' : 'VIEW / UNLOCK',
                style: _labelStyle(color: _HomeColors.gold, fontSize: 9),
              ),
            ),
        ],
      ),
    );
  }
}

class _DarkCard extends StatelessWidget {
  const _DarkCard({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: _HomeColors.abyss,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: _HomeColors.gold.withValues(alpha: .16)),
    ),
    child: child,
  );
}

String _daypart() {
  final hour = DateTime.now().hour;
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

String _initials(String? name) {
  final parts = (name ?? '')
      .trim()
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .toList();
  if (parts.isEmpty) return 'KI';
  return parts.take(2).map((part) => part[0].toUpperCase()).join();
}

String? _birthDate(BirthProfile? profile) {
  final raw = profile?.birthData.localDate;
  final date = raw == null ? null : DateTime.tryParse(raw);
  return date == null ? null : DateFormat('dd MMM yyyy').format(date);
}

TextStyle _labelStyle({
  double fontSize = 10,
  Color color = _HomeColors.alabaster,
}) => GoogleFonts.inter(
  color: color,
  fontSize: fontSize,
  fontWeight: FontWeight.w700,
  letterSpacing: 1.0,
);

TextStyle _headlineStyle({double fontSize = 28}) => GoogleFonts.ebGaramond(
  color: _HomeColors.alabaster,
  fontSize: fontSize,
  height: .98,
  fontWeight: FontWeight.w500,
);
