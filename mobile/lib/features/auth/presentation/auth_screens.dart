import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../app/theme/app_theme.dart';
import '../../../l10n/app_localizations.dart';
import '../auth_controller.dart';
import '../domain/auth_repository.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.controller});

  final AuthController controller;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phone = TextEditingController();
  bool _otpRequested = false;

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  String get _digits => _phone.text.replaceAll(RegExp(r'\D'), '');
  bool get _isValidPhone => _digits.length == 10;

  Future<void> _continue() async {
    if (!_isValidPhone ||
        widget.controller.isRequestingPhoneOtp ||
        _otpRequested) {
      return;
    }
    setState(() => _otpRequested = true);
    final phoneNumber = '+91$_digits';
    await widget.controller.requestPhoneOtp(phoneNumber);
    if (!mounted || widget.controller.phoneOtpState != PhoneOtpState.sent) {
      if (mounted) setState(() => _otpRequested = false);
      return;
    }
    context.go(
      Uri(
        path: '/verify-otp',
        queryParameters: {'phone': phoneNumber},
      ).toString(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.controller,
      builder: (context, child) {
        final submitting =
            widget.controller.isRequestingPhoneOtp || _otpRequested;
        final message = widget.controller.state.status == AuthStatus.error
            ? widget.controller.state.message
            : null;
        return _PhoneAuthScaffold(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const _AuthBrandHeader(),
              const SizedBox(height: 28),
              Text('MOBILE NUMBER', style: _authLabelStyle()),
              const SizedBox(height: 10),
              _PhoneNumberField(
                controller: _phone,
                enabled: !submitting,
                onChanged: (_) => setState(() {}),
                onSubmitted: (_) => _continue(),
              ),
              const SizedBox(height: 12),
              const _OtpSecurityHint(),
              if (message != null) ...[
                const SizedBox(height: 14),
                Text(
                  message,
                  key: const ValueKey('phone-auth-error'),
                  style: GoogleFonts.inter(
                    color: const Color(0xFFF3A4A4),
                    fontSize: 13,
                  ),
                ),
              ],
              const SizedBox(height: 28),
              _GoldActionButton(
                key: const ValueKey('phone-continue'),
                label: 'CONTINUE',
                loading: submitting,
                enabled: _isValidPhone && !submitting,
                onPressed: _continue,
              ),
              const SizedBox(height: 28),
              const _AuthLegalFooter(),
            ],
          ),
        );
      },
    );
  }
}

class VerifyOtpScreen extends StatefulWidget {
  const VerifyOtpScreen({
    super.key,
    required this.controller,
    required this.phoneNumber,
    this.resendCooldown = const Duration(seconds: 30),
  });

  final AuthController controller;
  final String? phoneNumber;
  final Duration resendCooldown;

  @override
  State<VerifyOtpScreen> createState() => _VerifyOtpScreenState();
}

class _VerifyOtpScreenState extends State<VerifyOtpScreen>
    with SingleTickerProviderStateMixin {
  final _otpCells = List.generate(6, (_) => TextEditingController());
  late final _otpFocusNodes = List.generate(
    6,
    (index) =>
        FocusNode(onKeyEvent: (_, event) => _onOtpKeyEvent(index, event)),
  );
  late final AnimationController _motifRotation;
  Timer? _cooldownTimer;
  int _cooldownSeconds = 0;

  bool get _hasPhone =>
      (widget.phoneNumber ?? '').startsWith('+91') &&
      widget.phoneNumber!.length == 13;
  String get _otp => _otpCells.map((controller) => controller.text).join();

  @override
  void initState() {
    super.initState();
    _motifRotation = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 96),
    )..repeat();
    _startCooldown();
  }

  void _startCooldown() {
    _cooldownTimer?.cancel();
    _cooldownSeconds = widget.resendCooldown.inSeconds;
    if (_cooldownSeconds == 0) return;
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted || _cooldownSeconds <= 1) {
        timer.cancel();
        if (mounted) setState(() => _cooldownSeconds = 0);
        return;
      }
      setState(() => _cooldownSeconds--);
    });
  }

  void _onOtpChanged(int index, String value) {
    final digits = value.replaceAll(RegExp(r'\D'), '');
    if (digits.length > 1) {
      for (
        var offset = 0;
        offset < digits.length && index + offset < 6;
        offset++
      ) {
        _otpCells[index + offset].text = digits[offset];
      }
      final next = math.min(index + digits.length, 5);
      _otpFocusNodes[next].requestFocus();
    } else if (digits.isNotEmpty && index < 5) {
      _otpFocusNodes[index + 1].requestFocus();
    }
    setState(() {});
  }

  KeyEventResult _onOtpKeyEvent(int index, KeyEvent event) {
    if (event is KeyDownEvent &&
        event.logicalKey == LogicalKeyboardKey.backspace &&
        _otpCells[index].text.isEmpty &&
        index > 0) {
      _otpFocusNodes[index - 1].requestFocus();
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  Future<void> _verify() async {
    if (!_hasPhone ||
        _otp.length != 6 ||
        widget.controller.isVerifyingPhoneOtp) {
      return;
    }
    await widget.controller.verifyPhoneOtp(
      phoneNumber: widget.phoneNumber!,
      otp: _otp,
    );
  }

  Future<void> _resend() async {
    if (!_hasPhone || widget.controller.isRequestingPhoneOtp) return;
    await widget.controller.requestPhoneOtp(widget.phoneNumber!);
    if (mounted && widget.controller.phoneOtpState == PhoneOtpState.sent) {
      setState(_startCooldown);
    }
  }

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    _motifRotation.dispose();
    for (final controller in _otpCells) {
      controller.dispose();
    }
    for (final node in _otpFocusNodes) {
      node.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.controller,
    builder: (context, child) {
      final verifying = widget.controller.isVerifyingPhoneOtp;
      final requesting = widget.controller.isRequestingPhoneOtp;
      final message = widget.controller.state.status == AuthStatus.error
          ? widget.controller.state.message
          : null;
      return _OtpScaffold(
        header: _OtpTopNavigation(onBack: () => context.go('/login')),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _OtpHero(rotation: _motifRotation),
            const SizedBox(height: 18),
            Text(
              'Verify your mobile number',
              textAlign: TextAlign.center,
              style: _otpHeadlineStyle(),
            ),
            const SizedBox(height: 13),
            _RecipientRow(
              phoneNumber: _hasPhone
                  ? _maskedPhone(widget.phoneNumber!)
                  : 'Unavailable',
              onEdit: () => context.go('/login'),
            ),
            const SizedBox(height: 34),
            _OtpCells(
              controllers: _otpCells,
              focusNodes: _otpFocusNodes,
              enabled: _hasPhone && !verifying,
              onChanged: _onOtpChanged,
              onSubmitted: _verify,
            ),
            if (message != null) ...[
              const SizedBox(height: 12),
              Text(
                message,
                key: const ValueKey('otp-error'),
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                  color: const Color(0xFFF3A4A4),
                  fontSize: 13,
                ),
              ),
            ],
            const SizedBox(height: 24),
            const _OtpSecurityCard(),
            const SizedBox(height: 24),
            _GoldActionButton(
              key: const ValueKey('verify-otp'),
              label: 'VERIFY & CONTINUE',
              loading: verifying,
              enabled: _hasPhone && _otp.length == 6 && !verifying,
              onPressed: _verify,
            ),
            const SizedBox(height: 12),
            TextButton(
              key: const ValueKey('resend-otp'),
              onPressed:
                  !_hasPhone || requesting || verifying || _cooldownSeconds > 0
                  ? null
                  : _resend,
              child: Text(
                requesting
                    ? 'Sending OTP…'
                    : _cooldownSeconds > 0
                    ? 'Resend OTP in 00:${_cooldownSeconds.toString().padLeft(2, '0')}'
                    : 'Resend code now',
                style: GoogleFonts.inter(color: const Color(0xFFC5A059)),
              ),
            ),
            TextButton(
              key: const ValueKey('change-number'),
              onPressed: () => context.go('/login'),
              child: Text(
                'Change number',
                style: GoogleFonts.inter(color: const Color(0xFF9E9AA9)),
              ),
            ),
            const SizedBox(height: 20),
            const _OtpFooter(),
          ],
        ),
      );
    },
  );
}

class _OtpScaffold extends StatelessWidget {
  const _OtpScaffold({required this.header, required this.child});
  final Widget header;
  final Widget child;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFF0B071B),
    resizeToAvoidBottomInset: true,
    body: SafeArea(
      child: Column(
        children: [
          header,
          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(
                24,
                16,
                24,
                24 + MediaQuery.viewInsetsOf(context).bottom,
              ),
              child: child,
            ),
          ),
        ],
      ),
    ),
  );
}

class _OtpTopNavigation extends StatelessWidget {
  const _OtpTopNavigation({required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
    child: Row(
      children: [
        IconButton(
          key: const ValueKey('otp-back'),
          onPressed: onBack,
          icon: const Icon(Icons.arrow_back, color: Color(0xFFFAF7F2)),
          style: IconButton.styleFrom(backgroundColor: const Color(0xFF181335)),
        ),
        const Spacer(),
        const _AuthEmblem(size: 28),
        const SizedBox(width: 8),
        Text(
          'KundliInsights',
          style: GoogleFonts.ebGaramond(
            color: const Color(0xFFFAF7F2),
            fontSize: 23,
          ),
        ),
        const Spacer(),
        const Icon(Icons.auto_awesome, color: Color(0xFFC5A059), size: 18),
      ],
    ),
  );
}

class _OtpHero extends StatelessWidget {
  const _OtpHero({required this.rotation});
  final Animation<double> rotation;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 120,
    child: AnimatedBuilder(
      animation: rotation,
      builder: (context, child) => CustomPaint(
        painter: _OtpMotifPainter(rotation: rotation.value * math.pi * 2),
        child: Center(
          child: Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              color: const Color(0xFF181335),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: const Color(0xFFC5A059).withValues(alpha: .55),
              ),
            ),
            child: const Icon(
              Icons.lock_open_rounded,
              color: Color(0xFFC5A059),
              size: 27,
            ),
          ),
        ),
      ),
    ),
  );
}

class _RecipientRow extends StatelessWidget {
  const _RecipientRow({required this.phoneNumber, required this.onEdit});
  final String phoneNumber;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) => Wrap(
    alignment: WrapAlignment.center,
    crossAxisAlignment: WrapCrossAlignment.center,
    spacing: 8,
    runSpacing: 6,
    children: [
      Text(
        'Code dispatched to',
        style: GoogleFonts.inter(color: const Color(0xFF9E9AA9), fontSize: 12),
      ),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: const Color(0xFF181335),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          phoneNumber,
          style: GoogleFonts.inter(
            color: const Color(0xFFF4BF50),
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      TextButton.icon(
        key: const ValueKey('otp-edit-phone'),
        onPressed: onEdit,
        icon: const Icon(
          Icons.edit_outlined,
          color: Color(0xFFC5A059),
          size: 14,
        ),
        label: Text(
          'Edit',
          style: GoogleFonts.inter(
            color: const Color(0xFFC5A059),
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
        style: TextButton.styleFrom(
          minimumSize: const Size(30, 30),
          padding: const EdgeInsets.symmetric(horizontal: 4),
        ),
      ),
    ],
  );
}

class _OtpCells extends StatelessWidget {
  const _OtpCells({
    required this.controllers,
    required this.focusNodes,
    required this.enabled,
    required this.onChanged,
    required this.onSubmitted,
  });
  final List<TextEditingController> controllers;
  final List<FocusNode> focusNodes;
  final bool enabled;
  final void Function(int, String) onChanged;
  final VoidCallback onSubmitted;

  @override
  Widget build(BuildContext context) => Row(
    children: List.generate(
      6,
      (index) => Expanded(
        child: Padding(
          padding: EdgeInsets.only(right: index == 5 ? 0 : 7),
          child: TextField(
            key: ValueKey('otp-cell-$index'),
            controller: controllers[index],
            focusNode: focusNodes[index],
            enabled: enabled,
            textAlign: TextAlign.center,
            keyboardType: TextInputType.number,
            textInputAction: index == 5
                ? TextInputAction.done
                : TextInputAction.next,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(6),
            ],
            onChanged: (value) => onChanged(index, value),
            onSubmitted: (_) => onSubmitted(),
            style: GoogleFonts.inter(
              color: const Color(0xFFFAF7F2),
              fontSize: 20,
              fontWeight: FontWeight.w600,
            ),
            decoration: InputDecoration(
              hintText: '•',
              hintStyle: const TextStyle(color: Color(0xFF625A70)),
              counterText: '',
              filled: true,
              fillColor: const Color(0xFF120D29),
              contentPadding: const EdgeInsets.symmetric(vertical: 15),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(
                  color: Color(0xFF181335),
                  width: 3,
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

class _OtpSecurityCard extends StatelessWidget {
  const _OtpSecurityCard();

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: const Color(0xFF181335).withValues(alpha: .72),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: const Color(0xFFC5A059).withValues(alpha: .15)),
    ),
    child: Row(
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: const BoxDecoration(
            color: Color(0xFF251735),
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.shield_outlined,
            color: Color(0xFFC5A059),
            size: 18,
          ),
        ),
        const SizedBox(width: 11),
        Expanded(
          child: Text(
            'Vedic transit encryption ensures your celestial chart & planetary houses remain strictly sovereign.',
            style: GoogleFonts.inter(
              color: const Color(0xFF9E9AA9),
              fontSize: 11,
              height: 1.45,
            ),
          ),
        ),
      ],
    ),
  );
}

class _OtpFooter extends StatelessWidget {
  const _OtpFooter();
  @override
  Widget build(BuildContext context) => Column(
    children: [
      Row(
        children: [
          Expanded(
            child: Divider(
              color: const Color(0xFFC5A059).withValues(alpha: .3),
            ),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 12),
            child: Icon(
              Icons.nightlight_round,
              color: Color(0xFFC5A059),
              size: 15,
            ),
          ),
          Expanded(
            child: Divider(
              color: const Color(0xFFC5A059).withValues(alpha: .3),
            ),
          ),
        ],
      ),
      const SizedBox(height: 11),
      Text(
        'LAGNA • NAKSHATRA • KUNDLI',
        style: GoogleFonts.inter(
          color: const Color(0xFF9E9AA9),
          fontSize: 9,
          fontWeight: FontWeight.w600,
          letterSpacing: 1.2,
        ),
      ),
    ],
  );
}

TextStyle _otpHeadlineStyle() => GoogleFonts.ebGaramond(
  color: const Color(0xFFFAF7F2),
  fontSize: 37,
  height: .98,
  fontWeight: FontWeight.w500,
);

class _OtpMotifPainter extends CustomPainter {
  const _OtpMotifPainter({required this.rotation});
  final double rotation;
  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = const Color(0xFFC5A059).withValues(alpha: .2);
    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.rotate(rotation);
    for (final factor in [.42, .67, .92]) {
      canvas.drawCircle(Offset.zero, size.shortestSide * factor / 2, paint);
    }
    canvas.drawLine(Offset(-52, 0), const Offset(52, 0), paint);
    canvas.drawLine(const Offset(0, -52), const Offset(0, 52), paint);
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _OtpMotifPainter oldDelegate) =>
      oldDelegate.rotation != rotation;
}

class _PhoneAuthScaffold extends StatelessWidget {
  const _PhoneAuthScaffold({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFF0B071B),
    resizeToAvoidBottomInset: true,
    body: SafeArea(
      child: LayoutBuilder(
        builder: (context, constraints) => SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(
            24,
            20,
            24,
            24 + MediaQuery.viewInsetsOf(context).bottom,
          ),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight - 44),
            child: IntrinsicHeight(
              child: Column(children: [const Spacer(), child, const Spacer()]),
            ),
          ),
        ),
      ),
    ),
  );
}

class _AuthBrandHeader extends StatelessWidget {
  const _AuthBrandHeader();

  @override
  Widget build(BuildContext context) => Column(
    children: [
      const _AuthEmblem(size: 54),
      const SizedBox(height: 20),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 7),
        decoration: BoxDecoration(
          color: const Color(0xFF251735),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: const Color(0xFFD1AD5E).withValues(alpha: .2),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.auto_awesome, color: Color(0xFFD1AD5E), size: 13),
            const SizedBox(width: 7),
            Text('SACRED VEDIC ASTROLOGY', style: _authLabelStyle(fontSize: 8)),
          ],
        ),
      ),
      const SizedBox(height: 23),
      Text(
        'Welcome to',
        textAlign: TextAlign.center,
        style: GoogleFonts.ebGaramond(
          color: const Color(0xFFF7F1E3),
          fontSize: 38,
          height: .92,
          fontWeight: FontWeight.w500,
        ),
      ),
      Text(
        'KundliInsights',
        textAlign: TextAlign.center,
        style: GoogleFonts.ebGaramond(
          color: const Color(0xFFD1AD5E),
          fontSize: 42,
          height: .96,
          fontWeight: FontWeight.w500,
        ),
      ),
      const SizedBox(height: 16),
      Text(
        'Enter your mobile number to begin your\ncosmic alignment and natal analysis',
        textAlign: TextAlign.center,
        style: GoogleFonts.inter(
          color: const Color(0xFFB9B1C8),
          fontSize: 13,
          height: 1.55,
        ),
      ),
    ],
  );
}

class _AuthEmblem extends StatelessWidget {
  const _AuthEmblem({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      color: const Color(0xFF171025),
      border: Border.all(color: const Color(0xFFD1AD5E).withValues(alpha: .8)),
      boxShadow: [
        BoxShadow(
          color: const Color(0xFFD1AD5E).withValues(alpha: .2),
          blurRadius: 18,
          spreadRadius: 2,
        ),
      ],
    ),
    child: CustomPaint(painter: const _AuthEmblemPainter()),
  );
}

class _PhoneNumberField extends StatelessWidget {
  const _PhoneNumberField({
    required this.controller,
    required this.enabled,
    required this.onChanged,
    required this.onSubmitted,
  });

  final TextEditingController controller;
  final bool enabled;
  final ValueChanged<String> onChanged;
  final ValueChanged<String> onSubmitted;

  @override
  Widget build(BuildContext context) {
    final valid = controller.text.replaceAll(RegExp(r'\D'), '').length == 10;
    return TextField(
      key: const ValueKey('mobile-number-input'),
      controller: controller,
      enabled: enabled,
      keyboardType: TextInputType.phone,
      textInputAction: TextInputAction.done,
      autofillHints: const [AutofillHints.telephoneNumberNational],
      maxLength: 11,
      inputFormatters: [
        FilteringTextInputFormatter.digitsOnly,
        const _IndianPhoneFormatter(),
      ],
      onChanged: onChanged,
      onSubmitted: onSubmitted,
      style: GoogleFonts.inter(
        color: const Color(0xFFF7F1E3),
        fontSize: 18,
        fontWeight: FontWeight.w500,
        letterSpacing: 1.2,
      ),
      decoration: _darkInputDecoration(
        hint: '98765 43210',
        prefix: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('🇮🇳', style: TextStyle(fontSize: 18)),
            const SizedBox(width: 8),
            Text(
              '+91',
              style: GoogleFonts.inter(color: const Color(0xFFF7F1E3)),
            ),
            const SizedBox(width: 11),
            Container(width: 1, height: 24, color: const Color(0xFF6E627E)),
            const SizedBox(width: 11),
          ],
        ),
        suffix: valid
            ? const Icon(Icons.check_circle, color: Color(0xFFD1AD5E), size: 20)
            : null,
      ),
    );
  }
}

class _OtpSecurityHint extends StatelessWidget {
  const _OtpSecurityHint();

  @override
  Widget build(BuildContext context) => Row(
    children: [
      const Icon(
        Icons.verified_user_outlined,
        color: Color(0xFFD1AD5E),
        size: 15,
      ),
      const SizedBox(width: 8),
      Expanded(
        child: Text(
          'An encrypted OTP will be sent for confidential access',
          style: GoogleFonts.inter(
            color: const Color(0xFFB9B1C8),
            fontSize: 11,
          ),
        ),
      ),
    ],
  );
}

class _GoldActionButton extends StatelessWidget {
  const _GoldActionButton({
    super.key,
    required this.label,
    required this.loading,
    required this.enabled,
    required this.onPressed,
  });

  final String label;
  final bool loading;
  final bool enabled;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 54,
    child: FilledButton(
      onPressed: enabled ? onPressed : null,
      style: FilledButton.styleFrom(
        backgroundColor: const Color(0xFFD1AD5E),
        disabledBackgroundColor: const Color(0xFFD1AD5E).withValues(alpha: .28),
        foregroundColor: const Color(0xFF171025),
        disabledForegroundColor: const Color(0xFF171025).withValues(alpha: .42),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      child: loading
          ? const SizedBox.square(
              dimension: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Color(0xFF171025),
              ),
            )
          : Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  label,
                  style: _authLabelStyle(color: const Color(0xFF171025)),
                ),
                const SizedBox(width: 8),
                const Icon(Icons.arrow_forward, size: 17),
              ],
            ),
    ),
  );
}

class _AuthLegalFooter extends StatelessWidget {
  const _AuthLegalFooter();

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Row(
        children: [
          Expanded(
            child: Divider(
              color: const Color(0xFFD1AD5E).withValues(alpha: .24),
            ),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 12),
            child: Icon(
              Icons.shield_outlined,
              color: Color(0xFFD1AD5E),
              size: 16,
            ),
          ),
          Expanded(
            child: Divider(
              color: const Color(0xFFD1AD5E).withValues(alpha: .24),
            ),
          ),
        ],
      ),
      const SizedBox(height: 16),
      Text.rich(
        TextSpan(
          text: 'By continuing, you agree to our ',
          children: const [
            TextSpan(
              text: 'Terms of Service',
              style: TextStyle(decoration: TextDecoration.underline),
            ),
            TextSpan(text: ' and '),
            TextSpan(
              text: 'Privacy Policy.',
              style: TextStyle(decoration: TextDecoration.underline),
            ),
          ],
        ),
        textAlign: TextAlign.center,
        style: GoogleFonts.inter(
          color: const Color(0xFFD1AD5E),
          fontSize: 10.5,
          height: 1.5,
        ),
      ),
      const SizedBox(height: 19),
      Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            Icons.verified_user_outlined,
            color: Color(0xFF8D859D),
            size: 13,
          ),
          const SizedBox(width: 6),
          Text(
            '256-Bit Kundli Data Encryption',
            style: GoogleFonts.inter(
              color: const Color(0xFF8D859D),
              fontSize: 10,
            ),
          ),
        ],
      ),
    ],
  );
}

InputDecoration _darkInputDecoration({
  required String hint,
  Widget? prefix,
  Widget? suffix,
}) => InputDecoration(
  counterText: '',
  hintText: hint,
  hintStyle: GoogleFonts.inter(color: const Color(0xFF71687E), fontSize: 16),
  prefixIcon: prefix == null
      ? null
      : Padding(padding: const EdgeInsets.only(left: 16), child: prefix),
  prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
  suffixIcon: suffix,
  filled: true,
  fillColor: const Color(0xFF171025),
  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
  border: OutlineInputBorder(
    borderRadius: BorderRadius.circular(16),
    borderSide: BorderSide.none,
  ),
  enabledBorder: OutlineInputBorder(
    borderRadius: BorderRadius.circular(16),
    borderSide: const BorderSide(color: Color(0xFF30243F)),
  ),
  focusedBorder: OutlineInputBorder(
    borderRadius: BorderRadius.circular(16),
    borderSide: const BorderSide(color: Color(0xFFD1AD5E)),
  ),
);

TextStyle _authLabelStyle({
  double fontSize = 9,
  Color color = const Color(0xFFD1AD5E),
}) => GoogleFonts.inter(
  color: color,
  fontSize: fontSize,
  fontWeight: FontWeight.w700,
  letterSpacing: 1.35,
);

String _maskedPhone(String phoneNumber) =>
    '+91 ••••• ${phoneNumber.substring(phoneNumber.length - 4)}';

class _IndianPhoneFormatter extends TextInputFormatter {
  const _IndianPhoneFormatter();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final rawDigits = newValue.text.replaceAll(RegExp(r'\D'), '');
    final digits = rawDigits.length > 10
        ? rawDigits.substring(0, 10)
        : rawDigits;
    final formatted = digits.length <= 5
        ? digits
        : '${digits.substring(0, 5)} ${digits.substring(5)}';
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}

class _AuthEmblemPainter extends CustomPainter {
  const _AuthEmblemPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = size.shortestSide * .31;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = const Color(0xFFD1AD5E);
    canvas.drawCircle(center, radius, paint);
    final diamond = Path()
      ..moveTo(center.dx, center.dy - radius)
      ..lineTo(center.dx + radius, center.dy)
      ..lineTo(center.dx, center.dy + radius)
      ..lineTo(center.dx - radius, center.dy)
      ..close();
    canvas.drawPath(diamond, paint);
    canvas.drawLine(
      Offset(center.dx - radius, center.dy),
      Offset(center.dx + radius, center.dy),
      paint,
    );
    canvas.drawLine(
      Offset(center.dx, center.dy - radius),
      Offset(center.dx, center.dy + radius),
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant _AuthEmblemPainter oldDelegate) => false;
}

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key, required this.controller});

  final AuthController controller;

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirmation = TextEditingController();
  final _form = GlobalKey<FormState>();
  final _passwordFocus = FocusNode();
  final _confirmationFocus = FocusNode();
  String? _validationMessage;
  bool _passwordVisible = false;
  bool _confirmationVisible = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _confirmation.dispose();
    _passwordFocus.dispose();
    _confirmationFocus.dispose();
    super.dispose();
  }

  Future<void> _submit(AppLocalizations t) async {
    if (!(_form.currentState?.validate() ?? false)) {
      setState(() => _validationMessage = t.passwordRequirements);
      return;
    }
    setState(() => _validationMessage = null);
    await widget.controller.signup(_email.text.trim(), _password.text);
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return _AuthFrame(
      title: t.signUpTitle,
      action: t.signUp,
      controller: widget.controller,
      formKey: _form,
      onAction: () => _submit(t),
      validationMessage: _validationMessage,
      fields: [
        _emailField(
          t,
          _email,
          onSubmitted: () => _passwordFocus.requestFocus(),
        ),
        _passwordField(
          t,
          _password,
          focusNode: _passwordFocus,
          visible: _passwordVisible,
          onVisibilityChanged: () =>
              setState(() => _passwordVisible = !_passwordVisible),
          onSubmitted: () => _confirmationFocus.requestFocus(),
        ),
        _passwordField(
          t,
          _confirmation,
          label: t.confirmPassword,
          focusNode: _confirmationFocus,
          visible: _confirmationVisible,
          onVisibilityChanged: () =>
              setState(() => _confirmationVisible = !_confirmationVisible),
          confirmationOf: _password,
          onSubmitted: () => _submit(t),
        ),
      ],
      alternate: TextButton(
        onPressed: () => context.go('/login'),
        child: Text(t.alreadyHaveAccount),
      ),
    );
  }
}

bool _isValidEmail(String value) =>
    RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(value.trim());

Widget _emailField(
  AppLocalizations t,
  TextEditingController controller, {
  required VoidCallback onSubmitted,
}) => TextFormField(
  controller: controller,
  decoration: InputDecoration(labelText: t.email),
  keyboardType: TextInputType.emailAddress,
  autofillHints: const [AutofillHints.username],
  textInputAction: TextInputAction.next,
  onFieldSubmitted: (_) => onSubmitted(),
  validator: (value) {
    if (value == null || value.trim().isEmpty) return t.enterEmail;
    if (!_isValidEmail(value)) return t.enterValidEmail;
    return null;
  },
);

Widget _passwordField(
  AppLocalizations t,
  TextEditingController controller, {
  String? label,
  required FocusNode focusNode,
  required bool visible,
  required VoidCallback onVisibilityChanged,
  TextEditingController? confirmationOf,
  VoidCallback? onSubmitted,
}) => TextFormField(
  controller: controller,
  focusNode: focusNode,
  decoration: InputDecoration(
    labelText: label ?? t.password,
    suffixIcon: IconButton(
      tooltip: visible ? t.hidePassword : t.showPassword,
      onPressed: onVisibilityChanged,
      icon: Icon(
        visible ? Icons.visibility_off_outlined : Icons.visibility_outlined,
      ),
    ),
  ),
  obscureText: !visible,
  autofillHints: const [AutofillHints.password],
  textInputAction: onSubmitted == null
      ? TextInputAction.next
      : TextInputAction.done,
  onFieldSubmitted: (_) => onSubmitted?.call(),
  validator: (value) {
    if (value == null || value.isEmpty) {
      return label == null ? t.enterPassword : t.confirmPasswordRequired;
    }
    if (confirmationOf == null && value.length < 8) {
      return t.passwordMinimumLength;
    }
    if (confirmationOf != null && value != confirmationOf.text) {
      return t.passwordsDoNotMatch;
    }
    return null;
  },
);

class _AuthFrame extends StatelessWidget {
  const _AuthFrame({
    required this.title,
    required this.action,
    required this.controller,
    required this.formKey,
    required this.onAction,
    required this.fields,
    required this.alternate,
    this.validationMessage,
  });

  final String title;
  final String action;
  final AuthController controller;
  final GlobalKey<FormState> formKey;
  final Future<void> Function() onAction;
  final List<Widget> fields;
  final Widget alternate;
  final String? validationMessage;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return AnimatedBuilder(
      animation: controller,
      builder: (context, child) {
        final state = controller.state;
        final submitting = state.status == AuthStatus.loading;
        final message =
            validationMessage ??
            (state.status == AuthStatus.error
                ? state.message ?? t.authRequestFailed
                : null);
        return Scaffold(
          body: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Center(
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        t.appTitle,
                        style: Theme.of(context).textTheme.headlineLarge,
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      Text(
                        title,
                        style: Theme.of(context).textTheme.headlineMedium,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Form(
                        key: formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: fields
                              .map(
                                (field) => Padding(
                                  padding: const EdgeInsets.only(
                                    bottom: AppSpacing.sm,
                                  ),
                                  child: field,
                                ),
                              )
                              .toList(),
                        ),
                      ),
                      if (message != null)
                        Semantics(
                          liveRegion: true,
                          child: Padding(
                            padding: const EdgeInsets.only(
                              bottom: AppSpacing.sm,
                            ),
                            child: Text(
                              message,
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.error,
                              ),
                            ),
                          ),
                        ),
                      FilledButton(
                        onPressed: submitting
                            ? null
                            : () {
                                if (formKey.currentState?.validate() ?? false) {
                                  onAction();
                                }
                              },
                        child: submitting
                            ? const SizedBox.square(
                                dimension: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : Text(action),
                      ),
                      alternate,
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
