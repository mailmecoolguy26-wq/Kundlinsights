import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/analytics/analytics.dart';
import '../../../shared/formatters/customer_date.dart';
import '../../readings/career_explanation_language.dart';
import '../domain/vehicle_answer.dart';
import '../vehicle_answer_controller.dart';

/// Presentation-only Vehicle hub. Dates, states, and evidence are all supplied
/// by the server-owned Vehicle Rules v1 response; this widget never derives a
/// timing boundary or astrology classification.
class VehicleHubScreen extends StatefulWidget {
  const VehicleHubScreen({
    super.key,
    required this.controller,
    required this.language,
    required this.analytics,
  });
  final VehicleAnswerController controller;
  final CareerExplanationLanguageController language;
  final Analytics analytics;

  @override
  State<VehicleHubScreen> createState() => _VehicleHubScreenState();
}

class _VehicleHubScreenState extends State<VehicleHubScreen> {
  bool _detailsOpen = false;
  VehicleAnswerLoadState? _lastTrackedState;

  @override
  void initState() {
    super.initState();
    widget.analytics.track(AnalyticsEvent.vehicleHubViewed);
    widget.analytics.track(AnalyticsEvent.vehicleTimingRequested);
    widget.controller.addListener(_trackState);
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => widget.controller.load(),
    );
  }

  @override
  void dispose() {
    widget.controller.removeListener(_trackState);
    super.dispose();
  }

  void _trackState() {
    final state = widget.controller.state;
    if (state == _lastTrackedState) return;
    _lastTrackedState = state;
    if (state == VehicleAnswerLoadState.loaded) {
      widget.analytics.track(AnalyticsEvent.vehicleTimingLoaded);
      if (widget.controller.answer?.strongerWindow != null) {
        widget.analytics.track(AnalyticsEvent.vehicleWindowViewed);
      }
    } else if (state == VehicleAnswerLoadState.error) {
      widget.analytics.track(AnalyticsEvent.vehicleTimingFailed);
    }
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: Listenable.merge([widget.controller, widget.language]),
    builder: (context, _) {
      final hinglish =
          widget.language.language == CareerExplanationLanguage.hinglish;
      final state = widget.controller.state;
      return Scaffold(
        backgroundColor: _C.background,
        appBar: AppBar(
          backgroundColor: _C.background,
          foregroundColor: _C.ivory,
          title: const Text('VEHICLE'),
        ),
        body: switch (state) {
          VehicleAnswerLoadState.initial ||
          VehicleAnswerLoadState.loading => _Loading(hinglish: hinglish),
          VehicleAnswerLoadState.error => _Error(
            hinglish: hinglish,
            onRetry: widget.controller.load,
          ),
          VehicleAnswerLoadState.loaded
              when widget.controller.answer!.premiumRequired =>
            _PremiumLocked(onUnlock: () => context.push('/premium')),
          VehicleAnswerLoadState.loaded => _Result(
            answer: widget.controller.answer!,
            hinglish: hinglish,
            detailsOpen: _detailsOpen,
            onToggleDetails: () {
              setState(() => _detailsOpen = !_detailsOpen);
              if (_detailsOpen) {
                widget.analytics.track(
                  AnalyticsEvent.vehicleDetailedAstrologyOpened,
                );
              }
            },
            onOpenLifeEvents: () =>
                context.push('/life-events?initialCategory=VEHICLE'),
          ),
        },
      );
    },
  );
}

class _PremiumLocked extends StatelessWidget {
  const _PremiumLocked({required this.onUnlock});
  final VoidCallback onUnlock;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.lock_outline, color: _C.turquoise, size: 34),
          const SizedBox(height: 14),
          const Text('TaraVerse Premium', style: _T.title),
          const SizedBox(height: 8),
          const Text(
            'Unlock all personalized insights for this profile.',
            style: _T.body,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 18),
          FilledButton(
            onPressed: onUnlock,
            child: const Text('Unlock TaraVerse Premium'),
          ),
        ],
      ),
    ),
  );
}

class _Loading extends StatelessWidget {
  const _Loading({required this.hinglish});
  final bool hinglish;
  @override
  Widget build(BuildContext context) => Center(
    child: Semantics(
      liveRegion: true,
      label: hinglish
          ? 'Aapki Vehicle timing calculate ki ja rahi hai'
          : 'Calculating your Vehicle timing',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircularProgressIndicator(color: _C.turquoise),
          const SizedBox(height: 16),
          Text(
            hinglish
                ? 'Aapki Vehicle timing calculate ki ja rahi hai…'
                : 'Calculating your Vehicle timing…',
            style: _T.body,
          ),
        ],
      ),
    ),
  );
}

class _Error extends StatelessWidget {
  const _Error({required this.hinglish, required this.onRetry});
  final bool hinglish;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            hinglish
                ? 'Abhi aapki Vehicle timing calculate nahi ho paayi. Please dobara try karein.'
                : 'We couldn’t calculate your Vehicle timing right now. Please try again.',
            style: _T.body,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          FilledButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    ),
  );
}

class _Result extends StatelessWidget {
  const _Result({
    required this.answer,
    required this.hinglish,
    required this.detailsOpen,
    required this.onToggleDetails,
    required this.onOpenLifeEvents,
  });
  final VehicleAnswer answer;
  final bool hinglish;
  final bool detailsOpen;
  final VoidCallback onToggleDetails;
  final VoidCallback onOpenLifeEvents;

  @override
  Widget build(BuildContext context) {
    final window = answer.strongerWindow;
    final active = window?.temporalStatus == 'CURRENT';
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 36),
      children: [
        const Text(
          'Understand when vehicle-related factors are more supportive.',
          style: _T.body,
        ),
        const SizedBox(height: 22),
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('CURRENT VEHICLE SUPPORT', style: _T.eyebrow),
              const SizedBox(height: 8),
              Text(
                _strengthLabel(answer.candidateStrength, hinglish),
                style: _T.title,
              ),
              const SizedBox(height: 8),
              Text(
                _currentMeaning(answer.candidateStrength, hinglish),
                style: _T.body,
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        if (window != null && window.windowShape != 'NO_RELIABLE_WINDOW')
          _Card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  active
                      ? 'VEHICLE SUPPORT WINDOW'
                      : 'NEXT VEHICLE SUPPORT PERIOD',
                  style: _T.eyebrow,
                ),
                const SizedBox(height: 9),
                Text(
                  '${_date(window.start)} – ${_date(window.end)}',
                  style: _T.cardTitle,
                ),
                const SizedBox(height: 10),
                _Badge(
                  active
                      ? (hinglish ? 'Abhi active' : 'Active now')
                      : (hinglish
                            ? 'Next supportive period'
                            : 'Next supportive period'),
                ),
                const SizedBox(height: 10),
                Text(_windowMeaning(window, hinglish), style: _T.body),
              ],
            ),
          )
        else
          _Card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  hinglish
                      ? 'No strong Vehicle support abhi nahi dikh raha.'
                      : 'No strong Vehicle support right now.',
                  style: _T.cardTitle,
                ),
                const SizedBox(height: 8),
                Text(
                  hinglish
                      ? 'Aap research aur planning continue kar sakte hain aur stronger window ka wait kar sakte hain.'
                      : 'You can continue researching and preparing for a stronger window.',
                  style: _T.body,
                ),
              ],
            ),
          ),
        const SizedBox(height: 12),
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('WHAT TO DO', style: _T.eyebrow),
              const SizedBox(height: 8),
              Text(_action(answer.candidateStrength, hinglish), style: _T.body),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('WHY THIS PERIOD', style: _T.eyebrow),
              const SizedBox(height: 8),
              Text(
                hinglish
                    ? 'Yeh period aapke Vehicle structure, D16 confirmation, active Dasha aur calculated Jupiter/Saturn transit evidence se supported hai.'
                    : 'This period is supported by your Vehicle structure, D16 confirmation, active Dasha, and Jupiter/Saturn transit evidence.',
                style: _T.body,
              ),
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed: onToggleDetails,
                icon: Icon(detailsOpen ? Icons.expand_less : Icons.expand_more),
                label: Text(
                  detailsOpen
                      ? 'Hide detailed astrology'
                      : 'View detailed astrology',
                ),
              ),
              if (detailsOpen)
                _Details(evidence: answer.evidence, hinglish: hinglish),
            ],
          ),
        ),
        const SizedBox(height: 20),
        OutlinedButton.icon(
          onPressed: onOpenLifeEvents,
          icon: const Icon(Icons.directions_car_outlined),
          label: const Text('Vehicle Life Events'),
        ),
        const SizedBox(height: 10),
        Text(
          hinglish
              ? 'Past Vehicle events TaraVerse ko recurring timing patterns samajhne mein help karte hain. Yeh aapki birth chart calculations ko change nahi karte.'
              : 'Past Vehicle events help TaraVerse understand recurring timing patterns. They do not change your birth chart.',
          style: _T.small,
        ),
      ],
    );
  }
}

class _Details extends StatelessWidget {
  const _Details({required this.evidence, required this.hinglish});
  final Map<String, dynamic> evidence;
  final bool hinglish;
  @override
  Widget build(BuildContext context) {
    final natal = evidence['natal'] as Map?;
    final d16 = evidence['d16'] as Map?;
    final dasha = evidence['mdAd'] as Map?;
    final transit = evidence['transit'] as Map?;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _DetailRow(
            'D1 Vehicle Promise',
            _friendly(natal?['promise'] ?? natal?['classification']),
          ),
          _DetailRow('D16 Confirmation', _friendly(d16?['confirmation'])),
          _DetailRow('Dasha Support', _friendly(dasha?['classification'])),
          _DetailRow('Major Transit', _friendly(transit?['majorConfirmation'])),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow(this.label, this.value);
  final String label, value;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 7),
    child: Row(
      children: [
        Expanded(child: Text(label, style: _T.small)),
        Text(value, style: _T.small.copyWith(color: _C.ivory)),
      ],
    ),
  );
}

class _Card extends StatelessWidget {
  const _Card({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: _C.card,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: _C.border),
    ),
    child: child,
  );
}

class _Badge extends StatelessWidget {
  const _Badge(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(
      color: const Color(0x2235B9AC),
      borderRadius: BorderRadius.circular(20),
    ),
    child: Text(text, style: _T.small.copyWith(color: _C.turquoise)),
  );
}

String _date(DateTime date) => formatCustomerLocalDate(date);
String _strengthLabel(String value, bool hinglish) => switch (value) {
  'STRONG_CANDIDATE' => 'Strong support',
  'MODERATE_CANDIDATE' => 'Moderate support',
  'MIXED_CANDIDATE' => 'Mixed support',
  _ => hinglish ? 'Strong support nahi' : 'No strong support',
};
String _currentMeaning(String value, bool hinglish) => switch (value) {
  'STRONG_CANDIDATE' =>
    hinglish
        ? 'Is period mein Vehicle-related factors stronger support dikha rahe hain.'
        : 'Vehicle-related factors show stronger support during this period.',
  'MODERATE_CANDIDATE' =>
    hinglish
        ? 'Is period mein Vehicle-related factors moderate support dikha rahe hain.'
        : 'Vehicle-related factors show moderate support during this period.',
  'MIXED_CANDIDATE' =>
    hinglish
        ? 'Support hai, lekin kuch mixed factors bhi hain.'
        : 'Support is present, but some factors are mixed.',
  'NOT_SUPPORTED' =>
    hinglish
        ? 'Is period mein strong Vehicle timing support nahi dikh raha.'
        : 'Strong Vehicle timing support is not visible in this period.',
  _ =>
    hinglish
        ? 'Is period mein Vehicle-related factors strong support nahi dikha rahe hain.'
        : 'Vehicle-related factors are more supportive during this period.',
};

String _windowMeaning(VehicleSupportWindow window, bool hinglish) {
  if (!hinglish) {
    return window.temporalStatus == 'CURRENT'
        ? 'This calculated support period remains active until ${_date(window.end)}.'
        : 'The next calculated Vehicle support period starts on ${_date(window.start)}.';
  }
  return window.temporalStatus == 'CURRENT'
      ? 'Yeh calculated support period ${_date(window.end)} tak active hai.'
      : 'Next calculated Vehicle support period ${_date(window.start)} se shuru hota hai.';
}

String _action(String value, bool hinglish) => switch (value) {
  'MIXED_CANDIDATE' =>
    hinglish
        ? 'Support hai, lekin financing, maintenance ya expense-related factors ko extra dhyan se evaluate karein.'
        : 'Support is present, but financing, maintenance, or expense factors need extra attention.',
  'NOT_SUPPORTED' =>
    hinglish
        ? 'Is period mein strong Vehicle timing support nahi dikh raha. Aap research aur planning continue kar sakte hain aur stronger window ka wait kar sakte hain.'
        : 'This period does not show strong Vehicle timing support. You can continue researching and preparing for a stronger window.',
  _ =>
    hinglish
        ? 'Options compare karein aur cost, financing, maintenance aur possible expenses ko dhyan mein rakhkar planning karein.'
        : 'Compare options and plan practical costs, financing, maintenance, and expenses carefully.',
};
String _friendly(Object? value) => (value ?? 'Not available')
    .toString()
    .replaceAll('_', ' ')
    .toLowerCase()
    .split(' ')
    .map(
      (word) =>
          word.isEmpty ? word : '${word[0].toUpperCase()}${word.substring(1)}',
    )
    .join(' ');

abstract final class _C {
  static const background = Color(0xFF061A1A);
  static const card = Color(0xFF082625);
  static const ivory = Color(0xFFF7F4EC);
  static const slate = Color(0xFFA8B7B4);
  static const turquoise = Color(0xFF35B9AC);
  static const border = Color(0xFF3F8179);
}

abstract final class _T {
  static const eyebrow = TextStyle(
    color: Color(0xFFD6B15A),
    fontWeight: FontWeight.w700,
    fontSize: 11,
    letterSpacing: 1.1,
  );
  static const title = TextStyle(
    color: _C.ivory,
    fontSize: 26,
    fontWeight: FontWeight.w700,
  );
  static const cardTitle = TextStyle(
    color: _C.ivory,
    fontSize: 19,
    fontWeight: FontWeight.w700,
  );
  static const body = TextStyle(color: _C.slate, fontSize: 14, height: 1.45);
  static const small = TextStyle(color: _C.slate, fontSize: 12, height: 1.35);
}
