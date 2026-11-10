import 'package:flutter/material.dart';

const domainHubIvory = Color(0xFFFFF6DF);
const domainHubGold = Color(0xFFD8B96D);
const domainHubTeal = Color(0xFF0D5150);
const domainHubBorder = Color(0x552E817A);

class DomainHubSectionTitle extends StatelessWidget {
  const DomainHubSectionTitle(this.title, {super.key, this.subtitle});

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 22, bottom: 10),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            color: domainHubIvory,
            fontSize: 23,
            fontWeight: FontWeight.w700,
          ),
        ),
        if (subtitle case final value?) ...[
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              color: Color(0xFFC6D5D0),
              fontSize: 13,
              height: 1.35,
            ),
          ),
        ],
      ],
    ),
  );
}

class DomainHubAskTara extends StatelessWidget {
  const DomainHubAskTara({
    super.key,
    required this.questions,
    required this.onOpen,
  });

  final List<String> questions;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const DomainHubSectionTitle(
        'Ask TaraVerse',
        subtitle: 'Continue with a question grounded in this birth profile.',
      ),
      Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: domainHubTeal,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: domainHubBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ...questions
                .take(4)
                .map(
                  (question) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      '• $question',
                      style: const TextStyle(
                        color: domainHubIvory,
                        height: 1.35,
                      ),
                    ),
                  ),
                ),
            const SizedBox(height: 4),
            FilledButton.icon(
              key: const ValueKey('domain-hub-ask-tara'),
              onPressed: onOpen,
              icon: const Icon(Icons.auto_awesome_outlined),
              label: const Text('Ask TaraVerse'),
            ),
          ],
        ),
      ),
    ],
  );
}

class DomainHubNavigationCard extends StatelessWidget {
  const DomainHubNavigationCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: domainHubTeal,
    borderRadius: BorderRadius.circular(16),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: domainHubBorder),
        ),
        child: Row(
          children: [
            Icon(icon, color: domainHubGold),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: domainHubIvory,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      color: Color(0xFFC6D5D0),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: domainHubGold),
          ],
        ),
      ),
    ),
  );
}

class DomainHubUnavailableCard extends StatelessWidget {
  const DomainHubUnavailableCard({
    super.key,
    required this.title,
    required this.message,
  });

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: domainHubTeal.withValues(alpha: .55),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: domainHubBorder),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            color: domainHubIvory,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          message,
          style: const TextStyle(color: Color(0xFFC6D5D0), fontSize: 12),
        ),
      ],
    ),
  );
}
