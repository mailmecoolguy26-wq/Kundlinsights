import '../data/tarot_card_assets.dart';

import 'package:flutter/material.dart';

/// Stable server card IDs mapped to bundled artwork locations.
///
/// Artwork is deliberately resolved from [cardId], never customer-facing text.
abstract final class TarotCardArtwork {
  static String? pathFor(String cardId) => TarotCardAssets.pathFor(cardId);
}

class TarotCardArt extends StatefulWidget {
  const TarotCardArt({
    super.key,
    required this.cardId,
    required this.cardName,
    this.fit = BoxFit.cover,
  });

  final String cardId;
  final String cardName;
  final BoxFit fit;

  @override
  State<TarotCardArt> createState() => _TarotCardArtState();
}

class _TarotCardArtState extends State<TarotCardArt> {
  bool _diagnosticEmitted = false;

  Widget _fallback() {
    if (!_diagnosticEmitted) {
      _diagnosticEmitted = true;
      debugPrint('TAROT_CARD_ART_MISSING cardId=${widget.cardId}');
    }
    return Container(
      key: ValueKey('tarot-art-fallback-${widget.cardId}'),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF174D48), Color(0xFF071E1D)],
        ),
      ),
      child: const Center(
        child: Icon(Icons.auto_awesome, color: Color(0xFFD7B86A), size: 38),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final path = TarotCardArtwork.pathFor(widget.cardId);
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: AspectRatio(
        aspectRatio: 2 / 3,
        child: path == null
            ? _fallback()
            : Image.asset(
                path,
                key: ValueKey('tarot-art-${widget.cardId}'),
                semanticLabel: '${widget.cardName} Tarot artwork',
                fit: widget.fit,
                errorBuilder: (_, _, _) => _fallback(),
              ),
      ),
    );
  }
}
