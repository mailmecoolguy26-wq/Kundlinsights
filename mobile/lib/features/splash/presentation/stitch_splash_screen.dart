import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// A visual-only route. GoRouter remains responsible for leaving the splash.
class StitchSplashScreen extends StatefulWidget {
  const StitchSplashScreen({super.key});

  @override
  State<StitchSplashScreen> createState() => _StitchSplashScreenState();
}

class _StitchSplashScreenState extends State<StitchSplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _orbitController;

  @override
  void initState() {
    super.initState();
    _orbitController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 84),
    )..repeat();
  }

  @override
  void dispose() {
    _orbitController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final disableAnimations = MediaQuery.of(context).disableAnimations;
    return Scaffold(
      backgroundColor: _SplashPalette.midnight,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final width = constraints.maxWidth;
            final height = constraints.maxHeight;
            final compact = height < 620;
            final emblemSize = (width * .22).clamp(78.0, 86.0).toDouble();
            return Stack(
              fit: StackFit.expand,
              children: [
                RepaintBoundary(
                  child: AnimatedBuilder(
                    animation: _orbitController,
                    builder: (context, child) => CustomPaint(
                      painter: _OrbitalGeometryPainter(
                        rotation: disableAnimations
                            ? 0
                            : _orbitController.value * math.pi * 2,
                      ),
                    ),
                  ),
                ),
                const Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: _TopLabels(),
                ),
                Align(
                  alignment: Alignment(0, compact ? -.10 : -.08),
                  child: _CentralLockup(
                    compact: compact,
                    emblemSize: emblemSize,
                  ),
                ),
                const Positioned(
                  left: 24,
                  right: 24,
                  bottom: 18,
                  child: _BottomStatus(),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _TopLabels extends StatelessWidget {
  const _TopLabels();

  @override
  Widget build(BuildContext context) => Padding(
    key: const ValueKey('splash-header-labels'),
    padding: const EdgeInsets.fromLTRB(24, 8, 24, 0),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text('JYOTISH SHASTRA', style: _labelStyle()),
        Text('NIRAYANA 23° 51\'', style: _labelStyle()),
      ],
    ),
  );
}

class _CentralLockup extends StatelessWidget {
  const _CentralLockup({required this.compact, required this.emblemSize});

  final bool compact;
  final double emblemSize;

  @override
  Widget build(BuildContext context) => Column(
    key: const ValueKey('splash-central-lockup'),
    mainAxisSize: MainAxisSize.min,
    children: [
      _KundliEmblem(size: emblemSize),
      SizedBox(height: compact ? 15 : 18),
      _BrandLockup(compact: compact),
    ],
  );
}

class _BrandLockup extends StatelessWidget {
  const _BrandLockup({required this.compact});

  final bool compact;

  @override
  Widget build(BuildContext context) => Column(
    key: const ValueKey('splash-brand-lockup'),
    mainAxisSize: MainAxisSize.min,
    children: [
      ShaderMask(
        blendMode: BlendMode.srcIn,
        shaderCallback: (bounds) => const LinearGradient(
          colors: [_SplashPalette.alabaster, _SplashPalette.gold],
        ).createShader(bounds),
        child: Text(
          'KundliInsights',
          textAlign: TextAlign.center,
          style: GoogleFonts.ebGaramond(
            fontSize: compact ? 38 : 43,
            height: .94,
            fontWeight: FontWeight.w500,
            letterSpacing: -.5,
          ),
        ),
      ),
      SizedBox(height: compact ? 12 : 14),
      Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const _DividerLine(),
          const SizedBox(width: 10),
          Flexible(
            child: Text(
              'ANCIENT WISDOM. MODERN PRECISION.',
              maxLines: 1,
              overflow: TextOverflow.fade,
              softWrap: false,
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                color: _SplashPalette.champagne,
                fontSize: compact ? 8.2 : 9,
                fontWeight: FontWeight.w600,
                letterSpacing: 1.35,
              ),
            ),
          ),
          const SizedBox(width: 10),
          const _DividerLine(),
        ],
      ),
    ],
  );
}

class _DividerLine extends StatelessWidget {
  const _DividerLine();

  @override
  Widget build(BuildContext context) => Container(
    width: 28,
    height: 1,
    color: _SplashPalette.gold.withValues(alpha: .52),
  );
}

class _KundliEmblem extends StatelessWidget {
  const _KundliEmblem({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) => Column(
    key: const ValueKey('splash-emblem'),
    mainAxisSize: MainAxisSize.min,
    children: [
      const _GoldPoint(),
      const SizedBox(height: 6),
      Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: _SplashPalette.gold.withValues(alpha: .22),
              blurRadius: 28,
              spreadRadius: 4,
            ),
          ],
          gradient: const RadialGradient(
            colors: [Color(0xFF3A2A42), Color(0xFF171025)],
          ),
          border: Border.all(color: _SplashPalette.gold.withValues(alpha: .78)),
        ),
        child: CustomPaint(painter: const _KundliEmblemPainter()),
      ),
      const SizedBox(height: 6),
      const _GoldPoint(),
    ],
  );
}

class _GoldPoint extends StatelessWidget {
  const _GoldPoint();

  @override
  Widget build(BuildContext context) => Container(
    width: 4,
    height: 4,
    decoration: const BoxDecoration(
      color: _SplashPalette.gold,
      shape: BoxShape.circle,
    ),
  );
}

class _BottomStatus extends StatelessWidget {
  const _BottomStatus();

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: const [
          _IndicatorDot(),
          SizedBox(width: 8),
          _IndicatorDot(active: true),
          SizedBox(width: 8),
          _IndicatorDot(),
        ],
      ),
      const SizedBox(height: 12),
      Text(
        'VEDIC EPHEMERIS SYNCHRONIZED',
        textAlign: TextAlign.center,
        style: GoogleFonts.inter(
          color: _SplashPalette.champagne.withValues(alpha: .76),
          fontSize: 9,
          fontWeight: FontWeight.w600,
          letterSpacing: 1.6,
        ),
      ),
    ],
  );
}

class _IndicatorDot extends StatelessWidget {
  const _IndicatorDot({this.active = false});

  final bool active;

  @override
  Widget build(BuildContext context) => Container(
    width: active ? 6 : 4,
    height: active ? 6 : 4,
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      color: _SplashPalette.gold.withValues(alpha: active ? 1 : .42),
    ),
  );
}

class _OrbitalGeometryPainter extends CustomPainter {
  const _OrbitalGeometryPainter({required this.rotation});

  final double rotation;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height * .5);
    final radius = math.min(size.width, size.height) * .39;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = _SplashPalette.gold.withValues(alpha: .055);
    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.rotate(rotation);
    for (final factor in [.46, .7, 1.0, 1.26]) {
      canvas.drawCircle(Offset.zero, radius * factor, paint);
    }
    canvas.drawLine(Offset(-radius * 1.3, 0), Offset(radius * 1.3, 0), paint);
    canvas.drawLine(Offset(0, -radius * 1.3), Offset(0, radius * 1.3), paint);
    final diagonal = radius * .92;
    canvas.drawLine(
      Offset(-diagonal, -diagonal),
      Offset(diagonal, diagonal),
      paint,
    );
    canvas.drawLine(
      Offset(-diagonal, diagonal),
      Offset(diagonal, -diagonal),
      paint,
    );
    final diamond = Path()
      ..moveTo(0, -radius * 1.06)
      ..lineTo(radius * 1.06, 0)
      ..lineTo(0, radius * 1.06)
      ..lineTo(-radius * 1.06, 0)
      ..close();
    canvas.drawPath(diamond, paint);
    final dotPaint = Paint()
      ..color = _SplashPalette.gold.withValues(alpha: .16);
    for (var index = 0; index < 12; index++) {
      final angle = (math.pi * 2 / 12) * index;
      final point = Offset(math.cos(angle) * radius, math.sin(angle) * radius);
      canvas.drawCircle(point, 2, dotPaint);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _OrbitalGeometryPainter oldDelegate) =>
      oldDelegate.rotation != rotation;
}

class _KundliEmblemPainter extends CustomPainter {
  const _KundliEmblemPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = size.shortestSide * .37;
    final line = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = _SplashPalette.gold.withValues(alpha: .76);
    canvas.drawCircle(center, radius, line);
    final diamond = Path()
      ..moveTo(center.dx, center.dy - radius)
      ..lineTo(center.dx + radius, center.dy)
      ..lineTo(center.dx, center.dy + radius)
      ..lineTo(center.dx - radius, center.dy)
      ..close();
    canvas.drawPath(diamond, line);
    canvas.drawLine(
      Offset(center.dx - radius, center.dy),
      Offset(center.dx + radius, center.dy),
      line,
    );
    canvas.drawLine(
      Offset(center.dx, center.dy - radius),
      Offset(center.dx, center.dy + radius),
      line,
    );
    final star = Paint()..color = _SplashPalette.alabaster;
    canvas.drawCircle(center, 2.2, star);
  }

  @override
  bool shouldRepaint(covariant _KundliEmblemPainter oldDelegate) => false;
}

TextStyle _labelStyle() => GoogleFonts.inter(
  color: const Color(0xFFBFA875),
  fontSize: 8,
  fontWeight: FontWeight.w600,
  letterSpacing: 1.3,
);

abstract final class _SplashPalette {
  static const midnight = Color(0xFF0B071B);
  static const gold = Color(0xFFD1AD5E);
  static const champagne = Color(0xFFE5D2A4);
  static const alabaster = Color(0xFFF7F1E3);
}
