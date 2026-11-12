import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_theme.dart';
import '../../../shared/widgets/app_page_scaffold.dart';
import '../domain/tarot.dart';
import '../tarot_controller.dart';
import 'tarot_card_artwork.dart';

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
            tooltip: c.isHinglish ? 'Tarot History' : 'Tarot history',
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
                  ? 'Ek sawaal poochhein aur reflection aur guidance ke liye teen cards choose karein.'
                  : 'Ask a question and choose three cards for reflection and guidance.',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 18),
            _Entitlement(c.entitlement, hinglish: c.isHinglish),
            const SizedBox(height: 18),
            TextField(
              key: const ValueKey('tarot-question'),
              controller: question,
              maxLength: 1000,
              minLines: 3,
              maxLines: 6,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                labelText: c.isHinglish
                    ? 'Aap kis baare mein guidance chahte hain?'
                    : 'What would you like guidance on?',
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
              _Safety(boundary, hinglish: c.isHinglish),
            ],
            if (c.error != null) ...[
              const SizedBox(height: 12),
              Text(
                c.isHinglish
                    ? 'Reading shuru nahi ho saki. Aapka sawaal yahin hai; dobara try karein.'
                    : 'We could not start the reading. Your question is still here; please retry.',
                style: TextStyle(color: Color(0xFFE6B8A2)),
              ),
            ],
            const SizedBox(height: 16),
            Text(
              c.isHinglish
                  ? 'Tarot reflection aur guidance ke liye hai, certainty ya professional advice ke liye nahi.'
                  : 'Tarot is intended for reflection and guidance, not certainty or professional advice.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFF9CB7B3)),
            ),
            const SizedBox(height: 8),
            TextButton.icon(
              onPressed: () => context.push('/tarot/history'),
              icon: const Icon(Icons.history),
              label: Text(
                c.isHinglish ? 'Tarot History Dekhein' : 'View Tarot History',
              ),
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
  String? _lastSelectionToken;

  Future<void> _select(TarotController controller, String token) async {
    _lastSelectionToken = token;
    await controller.select(token);
  }

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
      if (r.isComplete) return _Completed(r, hinglish: c.isHinglish);
      if (r.interpretationRetryable) {
        return _Retry(r, c, hinglish: c.isHinglish);
      }
      if (r.status == 'INTERPRETING') {
        return AppPageScaffold(
          title: 'Tarot Reading',
          body: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                const CircularProgressIndicator(),
                const SizedBox(height: 12),
                Text(
                  c.isHinglish
                      ? 'Aapki reading taiyaar ho rahi hai…'
                      : 'Preparing your reading…',
                ),
              ],
            ),
          ),
        );
      }
      return AppPageScaffold(
        title: c.isHinglish ? 'Apne Cards Chunein' : 'Choose your cards',
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
                  Text(
                    c.isHinglish
                        ? '${r.selectedCards.length}/3 cards selected'
                        : '${r.selectedCards.length} of 3 cards selected',
                  ),
                  const SizedBox(height: 6),
                  LinearProgressIndicator(value: r.selectedCards.length / 3),
                  if (_isTimingQuestion(r.question)) ...[
                    const SizedBox(height: 12),
                    _TimingNote(hinglish: c.isHinglish),
                  ],
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
            LayoutBuilder(
              builder: (context, constraints) {
                final cardWidth = ((constraints.maxWidth - 40) / 3).clamp(
                  104.0,
                  150.0,
                );
                return SizedBox(
                  height: 184,
                  child: ListView.separated(
                    key: const ValueKey('tarot-card-choices'),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    scrollDirection: Axis.horizontal,
                    itemCount: r.selectableTokens.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 8),
                    itemBuilder: (_, i) => SizedBox(
                      width: cardWidth,
                      child: TarotFaceDownCard(
                        enabled: !c.selecting,
                        onTap: () => _select(c, r.selectableTokens[i]),
                      ),
                    ),
                  ),
                );
              },
            ),
            if (c.selecting)
              Padding(
                padding: const EdgeInsets.all(12),
                child: Center(
                  child: Text(
                    c.isHinglish
                        ? 'Aapka card reveal ho raha hai…'
                        : 'Revealing your card…',
                  ),
                ),
              ),
            if (c.error != null)
              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    Text(
                      c.isHinglish
                          ? 'Card reveal nahi hua. Isi card ko dobara safely try karein.'
                          : 'The card was not revealed. Retry the same card safely.',
                    ),
                    TextButton(
                      onPressed: _lastSelectionToken == null
                          ? null
                          : () => _select(c, _lastSelectionToken!),
                      child: Text(
                        c.isHinglish
                            ? 'Selection Dobara Try Karein'
                            : 'Retry selection',
                      ),
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
        return AppPageScaffold(
          title: 'Tarot History',
          body: const Center(child: CircularProgressIndicator()),
        );
      }
      return AppPageScaffold(
        title: 'Tarot History',
        body: c.history.isEmpty
            ? Center(
                child: Text(
                  c.isHinglish
                      ? 'Abhi koi Tarot reading nahi hai.'
                      : 'No Tarot readings yet.',
                ),
              )
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: c.history.length + (c.nextCursor == null ? 0 : 1),
                itemBuilder: (context, i) {
                  if (i == c.history.length) {
                    return TextButton(
                      onPressed: c.historyLoading
                          ? null
                          : () => c.loadHistory(more: true),
                      child: Text(
                        c.historyLoading
                            ? (c.isHinglish ? 'Load ho raha hai…' : 'Loading…')
                            : (c.isHinglish ? 'Aur dekhein' : 'Load more'),
                      ),
                    );
                  }
                  final r = c.history[i];
                  final status = r.isComplete
                      ? (c.isHinglish ? 'Complete' : 'Completed')
                      : r.interpretationRetryable
                      ? (c.isHinglish
                            ? 'Interpretation complete karein'
                            : 'Complete interpretation')
                      : (c.isHinglish
                            ? 'Reading continue karein'
                            : 'Continue reading');
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
  const _Completed(this.r, {required this.hinglish});
  final TarotReading r;
  final bool hinglish;
  @override
  Widget build(BuildContext context) {
    final result = r.interpretation;
    return AppPageScaffold(
      title: hinglish ? 'Aapki Tarot Reading' : 'Your Tarot Reading',
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            hinglish ? 'Sawaal' : 'Question',
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
          Text(_readingLabel(r.category)),
          if (_isTimingQuestion(r.question)) ...[
            const SizedBox(height: 12),
            _TimingNote(hinglish: hinglish),
          ],
          const SizedBox(height: 18),
          _SectionTitle(hinglish ? 'Aapke Teen Cards' : 'Your Three Cards'),
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
            _Section(
              hinglish ? 'Iska Kya Matlab Ho Sakta Hai' : 'What This May Mean',
              result.combinedMessage,
            ),
            _Section(
              hinglish ? 'Kis Baat Par Sochna Hai' : 'What To Reflect On',
              result.practicalReflection,
            ),
            if (result.nextStep.isNotEmpty)
              _Section(hinglish ? 'Agla Step' : 'Next Step', result.nextStep),
            if (_isSpecificCaution(result.caution, result.disclaimer))
              _Section(
                hinglish ? 'Kya Dhyan Rakhein' : 'What To Keep In Mind',
                result.caution,
              ),
          ],
          _Section(
            'Note',
            result?.disclaimer.isNotEmpty == true
                ? result!.disclaimer
                : (hinglish
                      ? 'Tarot reflection aur guidance ke liye hai, certainty ya professional advice ke liye nahi.'
                      : 'Tarot is intended for reflection and guidance, not certainty or professional advice.'),
          ),
          const SizedBox(height: 8),
          Text(
            'Saved · ${MaterialLocalizations.of(context).formatMediumDate(r.createdAt.toLocal())}',
            style: const TextStyle(color: Color(0xFF9CB7B3)),
          ),
        ],
      ),
    );
  }
}

class _Retry extends StatelessWidget {
  const _Retry(this.r, this.c, {required this.hinglish});
  final TarotReading r;
  final TarotController c;
  final bool hinglish;
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
        Text(
          hinglish
              ? 'Aapke cards save hain. Interpretation abhi taiyaar nahi ho saki.'
              : 'Your cards are saved. The interpretation could not be prepared yet.',
        ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: c.interpreting ? null : c.retryInterpretation,
          child: Text(
            c.interpreting
                ? (hinglish ? 'Dobara try ho raha hai…' : 'Retrying…')
                : (hinglish
                      ? 'Interpretation Dobara Try Karein'
                      : 'Retry interpretation'),
          ),
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

  Future<void> _showDetail(BuildContext context) => showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: const Color(0xFF092725),
    builder: (context) => SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Align(
              alignment: Alignment.centerRight,
              child: IconButton(
                tooltip: 'Close card details',
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close),
              ),
            ),
            Center(
              child: SizedBox(
                key: ValueKey('tarot-card-detail-art-${card.cardId}'),
                width: 210,
                child: TarotCardArt(
                  cardId: card.cardId,
                  cardName: card.cardName,
                  fit: BoxFit.contain,
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              card.positionName,
              style: const TextStyle(color: _gold, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            Text(
              card.cardName,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (card.coreTheme case final theme?) ...[
              const SizedBox(height: 10),
              Text(theme, style: const TextStyle(color: Color(0xFFB7CDC9))),
            ],
            if (interpretation case final value?) ...[
              const SizedBox(height: 16),
              Text(value),
            ],
          ],
        ),
      ),
    ),
  );

  @override
  Widget build(BuildContext context) => AnimatedSwitcher(
    duration: const Duration(milliseconds: 320),
    child: InkWell(
      key: ValueKey(card.cardId),
      onTap: () => _showDetail(context),
      borderRadius: BorderRadius.circular(18),
      child: Container(
        width: compact ? 150 : null,
        padding: EdgeInsets.all(compact ? 10 : 14),
        decoration: BoxDecoration(
          color: const Color(0xFF103B38),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: _gold),
        ),
        child: compact
            ? Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    height: 92,
                    child: TarotCardArt(
                      cardId: card.cardId,
                      cardName: card.cardName,
                    ),
                  ),
                  const SizedBox(height: 9),
                  _TarotCardCopy(
                    card: card,
                    compact: true,
                    interpretation: interpretation,
                  ),
                ],
              )
            : Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 92,
                    child: TarotCardArt(
                      cardId: card.cardId,
                      cardName: card.cardName,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: _TarotCardCopy(
                      card: card,
                      compact: false,
                      interpretation: interpretation,
                    ),
                  ),
                ],
              ),
      ),
    ),
  );
}

class _TarotCardCopy extends StatelessWidget {
  const _TarotCardCopy({
    required this.card,
    required this.compact,
    required this.interpretation,
  });

  final TarotCard card;
  final bool compact;
  final String? interpretation;

  @override
  Widget build(BuildContext context) => Column(
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
      const SizedBox(height: 5),
      Text(
        card.cardName,
        style: TextStyle(
          fontSize: compact ? 14 : 18,
          fontWeight: FontWeight.w700,
        ),
      ),
      if (card.coreTheme case final theme?) ...[
        const SizedBox(height: 5),
        Text(
          theme,
          maxLines: compact ? 2 : null,
          overflow: compact ? TextOverflow.ellipsis : null,
          style: const TextStyle(color: Color(0xFFB7CDC9)),
        ),
      ],
      if (interpretation != null) ...[
        const SizedBox(height: 8),
        Text(
          interpretation!,
          maxLines: compact ? 3 : null,
          overflow: compact ? TextOverflow.ellipsis : null,
        ),
      ],
    ],
  );
}

class _Entitlement extends StatelessWidget {
  const _Entitlement(this.value, {required this.hinglish});
  final TarotEntitlement? value;
  final bool hinglish;
  @override
  Widget build(BuildContext context) => _Panel(
    value == null
        ? Text(
            hinglish
                ? 'Reading availability check ho rahi hai…'
                : 'Checking reading availability…',
          )
        : Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value!.freeReadingAvailableToday
                    ? (hinglish
                          ? 'Aaj 1 free Tarot reading available hai'
                          : '1 free reading available today')
                    : (hinglish
                          ? 'Aaj ki free reading use ho chuki hai'
                          : "Today's free reading has been used"),
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              if (value!.paidCreditsRemaining > 0)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    hinglish
                        ? '${value!.paidCreditsRemaining} Tarot readings available hain'
                        : '${value!.paidCreditsRemaining} Tarot readings available',
                  ),
                ),
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  hinglish
                      ? 'Har din 1 free reading'
                      : '1 free reading per day',
                  style: const TextStyle(color: Color(0xFF9CB7B3)),
                ),
              ),
            ],
          ),
  );
}

class _Safety extends StatelessWidget {
  const _Safety(this.value, {required this.hinglish});
  final TarotSafetyBoundary value;
  final bool hinglish;
  @override
  Widget build(BuildContext context) => _Panel(
    Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          hinglish ? 'Sawaal poochhne ka safer tareeka' : 'A safer way to ask',
          style: const TextStyle(fontWeight: FontWeight.w700, color: _gold),
        ),
        const SizedBox(height: 6),
        Text(value.message),
        if (value.suggestedQuestion != null) ...[
          const SizedBox(height: 8),
          Text(
            hinglish
                ? 'Aap is tarah poochh sakte hain: “${value.suggestedQuestion}”'
                : 'You can instead ask: “${value.suggestedQuestion}”',
          ),
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

bool _isTimingQuestion(String question) => RegExp(
  r'\b(when|kab|kitne time|how soon|exact date|what date|which date|timing)\b',
  caseSensitive: false,
).hasMatch(question);

String _readingLabel(String category) => switch (category) {
  'CAREER' => 'Career Reading',
  'RELATIONSHIP' => 'Relationship Reading',
  'MONEY' => 'Money Reading',
  'PERSONAL_GROWTH' => 'Personal Growth Reading',
  'DECISION' => 'Decision Reading',
  _ => 'General Reading',
};

bool _isSpecificCaution(String caution, String disclaimer) {
  final value = caution.trim().toLowerCase();
  if (value.isEmpty) return false;
  if (value == disclaimer.trim().toLowerCase()) return false;
  return !value.contains('certainty') &&
      !value.contains('professional advice') &&
      !value.contains('doosre vyakti ke baare mein fact');
}

class _TimingNote extends StatelessWidget {
  const _TimingNote({required this.hinglish});
  final bool hinglish;

  @override
  Widget build(BuildContext context) => _Panel(
    Text(
      hinglish
          ? 'Tarot exact date predict nahi karta. Yeh reading aapki current situation, challenges aur next direction par reflection deti hai.'
          : 'Tarot does not predict an exact date. This reading reflects your current situation, challenges and next direction.',
      style: const TextStyle(color: Color(0xFFB7CDC9)),
    ),
  );
}
