import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../domain/career_answer.dart';

class CareerHubScreen extends StatelessWidget {
  const CareerHubScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFF061A1A),
    appBar: AppBar(
      backgroundColor: const Color(0xFF061A1A),
      foregroundColor: const Color(0xFFF7F4EC),
      elevation: 0,
      title: const Text('CAREER & BUSINESS'),
    ),
    body: ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        const Text(
          'What do you want clarity on?',
          style: TextStyle(
            color: Color(0xFFF7F4EC),
            fontSize: 27,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        const Text(
          'TaraVerse uses your saved Career Reading as evidence. It does not guarantee an outcome.',
          style: TextStyle(color: Color(0xFFA8B7B4), height: 1.45),
        ),
        const SizedBox(height: 24),
        _QuestionCard(
          icon: Icons.track_changes_outlined,
          title: 'My current career phase',
          subtitle: 'Understand the current Career context in your reading.',
          onTap: () => context.push(
            '/career/answer/${CareerQuestionType.currentCareerPhase.wireName}',
          ),
        ),
        const SizedBox(height: 12),
        _QuestionCard(
          icon: Icons.calendar_month_outlined,
          title: 'When is career activity stronger?',
          subtitle: 'See periods containing more currently supported timing signals.',
          onTap: () => context.push(
            '/career/answer/${CareerQuestionType.careerActivityTiming.wireName}',
          ),
        ),
        const SizedBox(height: 28),
        const Text(
          'COMING SOON',
          style: TextStyle(
            color: Color(0xFFD6B15A),
            fontWeight: FontWeight.w800,
            letterSpacing: 1.1,
            fontSize: 12,
          ),
        ),
        const SizedBox(height: 10),
        const _ComingSoonCards(),
        const SizedBox(height: 28),
        OutlinedButton.icon(
          onPressed: () => context.push('/career-calibration'),
          icon: const Icon(Icons.history_outlined),
          label: const Text('ADD CAREER HISTORY'),
          style: OutlinedButton.styleFrom(
            foregroundColor: const Color(0xFFD6B15A),
            side: const BorderSide(color: Color(0xFF3F8179)),
          ),
        ),
        const SizedBox(height: 12),
        TextButton(
          onPressed: () => context.go('/readings'),
          child: const Text('See detailed astrology'),
        ),
      ],
    ),
  );
}

class _QuestionCard extends StatelessWidget {
  const _QuestionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: const Color(0xFF114A46),
    borderRadius: BorderRadius.circular(16),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          border: Border.all(color: const Color(0xFF3F8179)),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Icon(icon, color: const Color(0xFF35B9AC)),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(
                        color: Color(0xFFF7F4EC),
                        fontWeight: FontWeight.w700,
                        fontSize: 17,
                      )),
                  const SizedBox(height: 5),
                  Text(subtitle,
                      style: const TextStyle(
                        color: Color(0xFFA8B7B4),
                        height: 1.35,
                      )),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Color(0xFFA8B7B4)),
          ],
        ),
      ),
    ),
  );
}

class _ComingSoonCards extends StatelessWidget {
  const _ComingSoonCards();
  static const _items = [
    'Find my next job',
    'Should I switch jobs?',
    'Should I start a business?',
    'I have a job offer',
    'Compare two offers',
    'Promotion / growth',
    'Career abroad',
  ];

  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 8,
    runSpacing: 8,
    children: _items
        .map(
          (item) => Chip(
            label: Text(item),
            labelStyle: const TextStyle(color: Color(0xFF718582)),
            backgroundColor: const Color(0xFF082625),
            side: const BorderSide(color: Color(0xFF255C57)),
          ),
        )
        .toList(growable: false),
  );
}
