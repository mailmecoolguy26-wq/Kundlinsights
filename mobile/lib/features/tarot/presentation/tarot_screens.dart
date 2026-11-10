import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_theme.dart';
import '../../../shared/widgets/app_page_scaffold.dart';
import '../domain/tarot.dart';
import '../tarot_controller.dart';

class TarotLandingScreen extends StatefulWidget {
  const TarotLandingScreen({super.key, required this.controller});
  final TarotController controller;
  @override
  State<TarotLandingScreen> createState() => _LandingState();
}

class _LandingState extends State<TarotLandingScreen> {
  final question = TextEditingController();
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => widget.controller.loadLanding(),
    );
  }

  @override
  void dispose() {
    question.dispose();
    super.dispose();
  }

  Future<void> start() async {
    final result = await widget.controller.start(question.text);
    if (!mounted) return;
    if (result case TarotStartReady(:final reading)) {
      await context.push(
        '/tarot/reading/${Uri.encodeComponent(reading.readingId)}',
      );
      if (mounted) await widget.controller.refreshEntitlement();
    }
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.controller,
    builder: (context, _) {
      final c = widget.controller;
      final busy = c.landingState == TarotLoadState.loading;
      final available =
          c.entitlement == null ||
          c.entitlement!.freeReadingAvailableToday ||
          c.entitlement!.paidCreditsRemaining > 0;
      return AppPageScaffold(
        title: 'Tarot',
        actions: [
          IconButton(
            tooltip: 'Tarot history',
            onPressed: () => context.push('/tarot/history'),
            icon: const Icon(Icons.history),
          ),
        ],
        body: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const Icon(Icons.auto_awesome, size: 42, color: _gold),
            const SizedBox(height: 12),
            Text(
              c.isHinglish
                  ? 'Ek sawaal poochhein aur reflection aur guidance ke liye teen cards draw karein.'
                  : 'Ask a question and draw three cards for reflection and guidance.',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 18),
            _Entitlement(c.entitlement),
            const SizedBox(height: 18),
            TextField(
              key: const ValueKey('tarot-question'),
              controller: question,
              maxLength: 1000,
              minLines: 3,
              maxLines: 6,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                labelText: 'What would you like guidance on?',
                alignLabelWithHint: true,
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              key: const ValueKey('tarot-start'),
              onPressed: busy || !available || question.text.trim().isEmpty
                  ? null
                  : start,
              icon: busy
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.style),
              label: Text(
                busy
                    ? (c.isHinglish
                          ? 'Cards draw ho rahe hain…'
                          : 'Drawing your cards…')
                    : (c.isHinglish ? 'Tarot Se Poochhein' : 'Ask Tarot'),
              ),
            ),
            if (c.safetyBoundary case final boundary?) ...[
              const SizedBox(height: 16),
              _Safety(boundary),
            ],
            if (c.error != null) ...[
              const SizedBox(height: 12),
              const Text(
                'We could not start the reading. Your question is still here; please retry.',
                style: TextStyle(color: Color(0xFFE6B8A2)),
              ),
            ],
            const SizedBox(height: 16),
            const Text(
              'Tarot is intended for reflection and guidance, not certainty or professional advice.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFF9CB7B3)),
            ),
            const SizedBox(height: 8),
            TextButton.icon(
              onPressed: () => context.push('/tarot/history'),
              icon: const Icon(Icons.history),
              label: const Text('View Tarot History'),
            ),
          ],
        ),
      );
    },
  );
}

class TarotReadingScreen extends StatefulWidget {
  const TarotReadingScreen({
    super.key,
    required this.controller,
    required this.readingId,
  });
  final TarotController controller;
  final String readingId;
  @override
  State<TarotReadingScreen> createState() => _ReadingState();
}

class _ReadingState extends State<TarotReadingScreen> {
  final page = PageController(viewportFraction: .62);
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (widget.controller.reading?.readingId != widget.readingId) {
        widget.controller.loadReading(widget.readingId);
      }
    });
  }

  @override
  void dispose() {
    page.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.controller,
    builder: (context, _) {
      final c = widget.controller;
      final r = c.reading;
      if (r == null) {
        return AppPageScaffold(
          title: 'Tarot Reading',
          body: Center(
            child: c.error == null
                ? const CircularProgressIndicator()
                : TextButton(
                    onPressed: () => c.loadReading(widget.readingId),
                    child: const Text('Retry'),
                  ),
          ),
        );
      }
      if (r.isComplete) return _Completed(r);
      if (r.interpretationRetryable) return _Retry(r, c);
      if (r.status == 'INTERPRETING') {
        return const AppPageScaffold(
          title: 'Tarot Reading',
          body: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircularProgressIndicator(),
                SizedBox(height: 12),
                Text('Preparing your interpretation…'),
              ],
            ),
          ),
        );
      }
      return AppPageScaffold(
        title: 'Choose your cards',
        body: ListView(
          padding: const EdgeInsets.symmetric(vertical: 16),
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    r.question,
                    style: Theme.of(context).textTheme.titleMedium
                        ?.copyWith(color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 8),
                  Text('${r.selectedCards.length} of 3 cards selected'),
                  const SizedBox(height: 12),
                  if (r.selectedCards.isNotEmpty)
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: r.selectedCards
                          .map(
                            (card) =>
                                TarotRevealedCard(card: card, compact: true),
                          )
                          .toList(),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 22),
            SizedBox(
              height: 270,
              child: PageView.builder(
                controller: page,
                itemCount: r.selectableTokens.length,
                itemBuilder: (_, i) => Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: TarotFaceDownCard(
                    enabled: !c.selecting,
                    onTap: () => c.select(r.selectableTokens[i]),
                  ),
                ),
              ),
            ),
            if (c.selecting)
              const Padding(
                padding: EdgeInsets.all(12),
                child: Center(child: Text('Revealing your card…')),
              ),
            if (c.error != null)
              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    const Text(
                      'The card was not revealed. Retry the same card safely.',
                    ),
                    TextButton(
                      onPressed: r.selectableTokens.isEmpty
                          ? null
                          : () => c.select(
                              r.selectableTokens[(page.hasClients
                                      ? page.page?.round() ?? 0
                                      : 0)
                                  .clamp(0, r.selectableTokens.length - 1)],
                            ),
                      child: const Text('Retry selection'),
                    ),
                  ],
                ),
              ),
          ],
        ),
      );
    },
  );
}

class TarotHistoryScreen extends StatefulWidget {
  const TarotHistoryScreen({super.key, required this.controller});
  final TarotController controller;
  @override
  State<TarotHistoryScreen> createState() => _HistoryState();
}

class _HistoryState extends State<TarotHistoryScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => widget.controller.loadHistory(),
    );
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.controller,
    builder: (_, _) {
      final c = widget.controller;
      if (c.historyLoading && c.history.isEmpty) {
        return const AppPageScaffold(
          title: 'Tarot History',
          body: Center(child: CircularProgressIndicator()),
        );
      }
      return AppPageScaffold(
        title: 'Tarot History',
        body: c.history.isEmpty
            ? const Center(child: Text('No Tarot readings yet.'))
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: c.history.length + (c.nextCursor == null ? 0 : 1),
                itemBuilder: (context, i) {
                  if (i == c.history.length) {
                    return TextButton(
                      onPressed: c.historyLoading
                          ? null
                          : () => c.loadHistory(more: true),
                      child: Text(c.historyLoading ? 'Loading…' : 'Load more'),
                    );
                  }
                  final r = c.history[i];
                  final status = r.isComplete
                      ? 'Completed'
                      : r.interpretationRetryable
                      ? 'Complete interpretation'
                      : 'Continue reading';
                  return Card(
                    child: ListTile(
                      onTap: () => context.push(
                        '/tarot/reading/${Uri.encodeComponent(r.readingId)}',
                      ),
                      title: Text(
                        r.question,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      subtitle: Text(
                        [
                          MaterialLocalizations.of(context)
                              .formatMediumDate(r.createdAt.toLocal()),
                          if (r.selectedCards.isNotEmpty)
                            r.selectedCards
                                .map((card) => card.cardName)
                                .join(', '),
                          status,
                        ].join(' · '),
                      ),
                      trailing: const Icon(Icons.chevron_right),
                    ),
                  );
                },
              ),
      );
    },
  );
}

class _Completed extends StatelessWidget {
  const _Completed(this.r);
  final TarotReading r;
  @override
  Widget build(BuildContext context) {
    final result = r.interpretation;
    return AppPageScaffold(
      title: 'Your Tarot Reading',
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'Question',
            style: Theme.of(context).textTheme.labelLarge
                ?.copyWith(color: _gold, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Text(
            r.question,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(r.spread.spreadType.replaceAll('_', ' ')),
          const SizedBox(height: 18),
          const _SectionTitle('Your Three Cards'),
          ...r.selectedCards.map((card) {
            final matches =
                result?.cards
                    .where((x) => x.position == card.position)
                    .toList() ??
                const [];
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: TarotRevealedCard(
                card: card,
                interpretation: matches.isEmpty
                    ? null
                    : matches.first.interpretation,
              ),
            );
          }),
          if (result != null) ...[
            _Section('Overall Reading', result.overview),
            _Section('What This May Mean', result.combinedMessage),
            _Section('What To Reflect On', result.practicalReflection),
            if (result.nextStep.isNotEmpty)
              _Section('What You Can Do Next', result.nextStep),
            _Section('Keep in Mind', result.caution),
          ],
          _Section(
            'Note',
            result?.disclaimer.isNotEmpty == true ? result!.disclaimer : 'Tarot is intended for reflection and guidance, not certainty or professional advice.',
          ),
          const SizedBox(height: 8),
          Text(
            'Saved ${MaterialLocalizations.of(context).formatMediumDate(r.createdAt.toLocal())}',
            style: const TextStyle(color: Color(0xFF9CB7B3)),
          ),
        ],
      ),
    );
  }
}

class _Retry extends StatelessWidget {
  const _Retry(this.r, this.c);
  final TarotReading r;
  final TarotController c;
  @override
  Widget build(BuildContext context) => AppPageScaffold(
    title: 'Tarot Reading',
    body: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        ...r.selectedCards.map(
          (card) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: TarotRevealedCard(card: card),
          ),
        ),
        const SizedBox(height: 20),
        const Text(
          'Your cards are saved. The interpretation could not be prepared yet.',
        ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: c.interpreting ? null : c.retryInterpretation,
          child: Text(c.interpreting ? 'Retrying…' : 'Retry interpretation'),
        ),
      ],
    ),
  );
}

class _Section extends StatelessWidget {
  const _Section(this.title, this.body);
  final String title, body;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 18),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(fontWeight: FontWeight.w700, color: _gold),
        ),
        const SizedBox(height: 6),
        Text(body),
      ],
    ),
  );
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title);
  final String title;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 18, bottom: 10),
    child: Text(
      title,
      style: const TextStyle(fontWeight: FontWeight.w700, color: _gold),
    ),
  );
}

class TarotFaceDownCard extends StatelessWidget {
  const TarotFaceDownCard({
    super.key,
    required this.enabled,
    required this.onTap,
  });
  final bool enabled;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: 'Select this face-down Tarot card',
    enabled: enabled,
    child: InkWell(
      onTap: enabled ? onTap : null,
      borderRadius: BorderRadius.circular(22),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          gradient: const LinearGradient(
            colors: [Color(0xFF123F3B), Color(0xFF071E1D)],
          ),
          border: Border.all(color: _gold, width: 1.4),
        ),
        child: const Center(
          child: Icon(Icons.auto_awesome, size: 58, color: _gold),
        ),
      ),
    ),
  );
}

class TarotRevealedCard extends StatelessWidget {
  const TarotRevealedCard({
    super.key,
    required this.card,
    this.compact = false,
    this.interpretation,
  });
  final TarotCard card;
  final bool compact;
  final String? interpretation;
  @override
  Widget build(BuildContext context) => AnimatedSwitcher(
    duration: const Duration(milliseconds: 320),
    child: Container(
      key: ValueKey(card.cardId),
      width: compact ? 150 : null,
      padding: EdgeInsets.all(compact ? 12 : 18),
      decoration: BoxDecoration(
        color: const Color(0xFF103B38),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _gold),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            card.positionName,
            style: const TextStyle(
              color: _gold,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            card.cardName,
            style: TextStyle(
              fontSize: compact ? 15 : 19,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (card.coreTheme case final theme?) ...[
            const SizedBox(height: 5),
            Text(theme, style: const TextStyle(color: Color(0xFFB7CDC9))),
          ],
          if (interpretation != null) ...[
            const SizedBox(height: 8),
            Text(interpretation!),
          ],
        ],
      ),
    ),
  );
}

class _Entitlement extends StatelessWidget {
  const _Entitlement(this.value);
  final TarotEntitlement? value;
  @override
  Widget build(BuildContext context) => _Panel(
    value == null
        ? const Text('Checking reading availability…')
        : Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value!.freeReadingAvailableToday
                    ? '1 free reading available today'
                    : "Today's free reading has been used",
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              if (value!.paidCreditsRemaining > 0)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    '${value!.paidCreditsRemaining} Tarot readings available',
                  ),
                ),
              const Padding(
                padding: EdgeInsets.only(top: 6),
                child: Text(
                  '1 free reading per day',
                  style: TextStyle(color: Color(0xFF9CB7B3)),
                ),
              ),
            ],
          ),
  );
}

class _Safety extends StatelessWidget {
  const _Safety(this.value);
  final TarotSafetyBoundary value;
  @override
  Widget build(BuildContext context) => _Panel(
    Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'A safer way to ask',
          style: TextStyle(fontWeight: FontWeight.w700, color: _gold),
        ),
        const SizedBox(height: 6),
        Text(value.message),
        if (value.suggestedQuestion != null) ...[
          const SizedBox(height: 8),
          Text('You can instead ask: “${value.suggestedQuestion}”'),
        ],
      ],
    ),
  );
}

class _Panel extends StatelessWidget {
  const _Panel(this.child);
  final Widget child;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: const Color(0xFF103B38),
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: const Color(0xFF356F69)),
    ),
    child: child,
  );
}

const _gold = Color(0xFFD7B86A);
