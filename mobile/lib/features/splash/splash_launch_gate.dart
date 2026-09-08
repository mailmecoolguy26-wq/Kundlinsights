import 'dart:async';

import 'package:flutter/foundation.dart';

/// Holds the launch screen until its minimum visual duration has elapsed.
///
/// This is deliberately app-scoped and one-shot: router refreshes after the
/// launch gate opens do not replay the splash screen.
class SplashLaunchGate extends ChangeNotifier {
  SplashLaunchGate({
    this.minimumDuration = const Duration(milliseconds: 1300),
  }) {
    if (minimumDuration == Duration.zero) {
      _isOpen = true;
      return;
    }
    _timer = Timer(minimumDuration, _open);
  }

  final Duration minimumDuration;
  Timer? _timer;
  bool _isOpen = false;

  bool get isOpen => _isOpen;

  void _open() {
    if (_isOpen) return;
    _isOpen = true;
    notifyListeners();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}
