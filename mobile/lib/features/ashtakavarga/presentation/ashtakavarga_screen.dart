import 'package:flutter/material.dart';

import '../../profiles/profile_controller.dart';
import '../../readings/astrology_presentation_copy.dart';
import '../ashtakavarga_controller.dart';
import '../domain/ashtakavarga.dart';

class AshtakavargaScreen extends StatefulWidget {
  const AshtakavargaScreen({
    super.key,
    required this.profileController,
    required this.controller,
  });
  final ProfileController profileController;
  final AshtakavargaController controller;
  @override
  State<AshtakavargaScreen> createState() => _AshtakavargaScreenState();
}

class _AshtakavargaScreenState extends State<AshtakavargaScreen> {
  String _body = 'Sun';
  bool _technical = false;
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: Listenable.merge([widget.controller, widget.profileController]),
    builder: (_, child) {
      final d = widget.controller.data;
      return Scaffold(
        backgroundColor: _C.midnight,
        body: SafeArea(
          child: RefreshIndicator(
            onRefresh: () async => widget.controller.refresh(),
            color: _C.gold,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
              children: [
                Row(
                  children: [
                    _Back(
                      key: const ValueKey('ashtakavarga_back_button'),
                      () => Navigator.of(context).maybePop(),
                    ),
                    const Spacer(),
                    _Pill(
                      widget.profileController.activeProfile?.label ??
                          'Active profile',
                    ),
                  ],
                ),
                const SizedBox(height: 22),
                const Text('ASHTAKAVARGA', style: _S.eyebrow),
                const SizedBox(height: 5),
                const Text('Planetary Point Distribution', style: _S.title),
                const SizedBox(height: 20),
                if (widget.controller.state == AshtakavargaLoadState.loading)
                  const _Card(
                    Center(child: CircularProgressIndicator(color: _C.gold)),
                  )
                else if (d == null)
                  _Card(
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Ashtakavarga unavailable', style: _S.body),
                        TextButton(
                          onPressed: widget.controller.refresh,
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  )
                else
                  _Content(
                    d,
                    _body,
                    _technical,
                    (v) => setState(() => _body = v),
                    () => setState(() => _technical = !_technical),
                  ),
              ],
            ),
          ),
        ),
      );
    },
  );
}

class _Content extends StatelessWidget {
  const _Content(this.d, this.body, this.technical, this.change, this.toggle);
  final Ashtakavarga d;
  final String body;
  final bool technical;
  final ValueChanged<String> change;
  final VoidCallback toggle;
  @override
  Widget build(BuildContext context) {
    final c = AstrologyPresentationCopy.of(context),
        bhav = d.lagnaRashiIndex != null,
        selected = d.bav.firstWhere((x) => x.body == body);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _Head(
          'ASHTAKAVARGA OVERVIEW',
          c.isHinglish
              ? 'Ashtakavarga Vedic astrology ka point-based framework hai jo signs aur Bhav mein bindu distribution record karta hai.'
              : 'Ashtakavarga is a point-based Vedic astrology framework that records bindu distribution across signs and Bhavs.',
        ),
        const SizedBox(height: 20),
        _Head(
          'SARVASHTAKAVARGA',
          c.isHinglish
              ? '12 Bhav mein combined bindu distribution.'
              : 'Combined bindu distribution across the 12 Bhavs.',
        ),
        const SizedBox(height: 10),
        _Grid(bhav ? d.byHouse(d.sav) : d.sav, bhav, 'SAV'),
        if (d.careerContext case final x?) ...[
          const SizedBox(height: 22),
          _Head(
            'CAREER CONTEXT',
            c.isHinglish
                ? 'Yeh factual Ashtakavarga values aapki Career analysis mein use hote hain.'
                : 'Factual Ashtakavarga values used in your Career analysis.',
          ),
          const SizedBox(height: 10),
          _Career(x, c),
        ],
        const SizedBox(height: 22),
        _Head(
          'PLANETARY BAV',
          c.isHinglish
              ? 'Har classical graha ka bindu distribution.'
              : 'Bindu distribution for each classical graha.',
        ),
        const SizedBox(height: 10),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final x in d.bav)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(c.planet(x.body)),
                    selected: x.body == body,
                    onSelected: (_) => change(x.body),
                    selectedColor: _C.gold,
                    backgroundColor: _C.abyss,
                    labelStyle: TextStyle(
                      color: x.body == body ? _C.midnight : _C.alabaster,
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Text('${c.planet(body).toUpperCase()} BAV', style: _S.eyebrow),
        const SizedBox(height: 10),
        _Grid(
          bhav ? d.byHouse(selected.signScores) : selected.signScores,
          bhav,
          'BAV',
        ),
        const SizedBox(height: 22),
        _Head(
          'LAGNA BAV',
          c.isHinglish
              ? '12 Bhav mein Lagna bindu distribution.'
              : 'Lagna bindu distribution across the 12 Bhavs.',
        ),
        const SizedBox(height: 10),
        _Grid(
          bhav ? d.byHouse(d.lagnaBav.signScores) : d.lagnaBav.signScores,
          bhav,
          'Lagna BAV',
        ),
        const SizedBox(height: 22),
        InkWell(
          onTap: toggle,
          child: _Card(
            Row(
              children: [
                const Expanded(
                  child: Text('TECHNICAL DETAILS', style: _S.eyebrow),
                ),
                Icon(
                  technical ? Icons.expand_less : Icons.expand_more,
                  color: _C.gold,
                ),
              ],
            ),
          ),
        ),
        if (technical) _Raw(d, selected),
      ],
    );
  }
}

class _Grid extends StatelessWidget {
  const _Grid(this.s, this.bhav, this.label);
  final List<SignScore> s;
  final bool bhav;
  final String label;
  @override
  Widget build(BuildContext context) => GridView.builder(
    shrinkWrap: true,
    physics: const NeverScrollableScrollPhysics(),
    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
      crossAxisCount: 2,
      mainAxisExtent: 114,
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
    ),
    itemCount: s.length,
    itemBuilder: (_, i) {
      final x = s[i];
      return _Card(
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(bhav ? '${_ord(i + 1)} Bhav' : x.sanskritName, style: _S.card),
            if (bhav) Text(x.sanskritName, style: _S.body),
            const Spacer(),
            Text('$label ${x.score}', style: _S.gold),
          ],
        ),
      );
    },
  );
}

class _Career extends StatelessWidget {
  const _Career(this.x, this.c);
  final AshtakavargaCareerContext x;
  final AstrologyPresentationCopy c;
  @override
  Widget build(BuildContext context) => _Card(
    Column(
      children: [
        _r('2nd Bhav', 'SAV · ${x.h2Sav.bindu}'),
        _r('10th Bhav', 'SAV · ${x.h10Sav.bindu}'),
        _r('11th Bhav', 'SAV · ${x.h11Sav.bindu}'),
        _r('10th Bhav', 'Lagna BAV · ${x.h10LagnaBav.bindu}'),
        if (x.h10LordBav case final v?)
          _r('${c.planet(v.planet!)} BAV', '10th Bhav · ${v.bindu}'),
      ],
    ),
  );
  Widget _r(String a, String b) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(
      children: [
        Expanded(child: Text(a, style: _S.card)),
        Text(b, style: _S.body),
      ],
    ),
  );
}

class _Raw extends StatelessWidget {
  const _Raw(this.d, this.b);
  final Ashtakavarga d;
  final Bav b;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 10),
    child: _Card(
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Sarvashtakavarga by Rashi', style: _S.card),
          for (final x in d.sav)
            Text('${x.sanskritName}  ${x.score}', style: _S.body),
          const SizedBox(height: 10),
          Text('${b.body} BAV by Rashi', style: _S.card),
          for (final x in b.signScores)
            Text('${x.sanskritName}  ${x.score}', style: _S.body),
        ],
      ),
    ),
  );
}

class _Head extends StatelessWidget {
  const _Head(this.a, this.b);
  final String a, b;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(a, style: _S.eyebrow),
      const SizedBox(height: 6),
      Text(b, style: _S.body),
    ],
  );
}

class _Card extends StatelessWidget {
  const _Card(this.child);
  final Widget child;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: _C.abyss,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: const Color(0x335E4A87)),
    ),
    child: child,
  );
}

class _Back extends StatelessWidget {
  const _Back(this.tap, {super.key});
  final VoidCallback tap;
  @override
  Widget build(BuildContext context) => SizedBox(
    width: 48,
    height: 48,
    child: Material(
      color: _C.violet,
      shape: const CircleBorder(),
      child: IconButton(
        onPressed: tap,
        icon: const Icon(Icons.arrow_back, color: _C.alabaster),
      ),
    ),
  );
}

class _Pill extends StatelessWidget {
  const _Pill(this.label);
  final String label;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
    decoration: BoxDecoration(
      color: _C.abyss,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: const Color(0x55C5A059)),
    ),
    child: Text(label, style: _S.body),
  );
}

String _ord(int x) => x == 1
    ? '1st'
    : x == 2
    ? '2nd'
    : x == 3
    ? '3rd'
    : '${x}th';

abstract final class _C {
  static const midnight = Color(0xFF0B071B),
      abyss = Color(0xFF120D29),
      violet = Color(0xFF1B1234),
      alabaster = Color(0xFFFAF7F2),
      slate = Color(0xFF9E9AA9),
      gold = Color(0xFFC5A059);
}

abstract final class _S {
  static const eyebrow = TextStyle(
        color: _C.gold,
        fontSize: 10,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.4,
      ),
      title = TextStyle(
        color: _C.alabaster,
        fontFamily: 'EBGaramond',
        fontSize: 32,
        fontWeight: FontWeight.w600,
      ),
      card = TextStyle(
        color: _C.alabaster,
        fontSize: 14,
        fontWeight: FontWeight.w600,
      ),
      body = TextStyle(color: _C.slate, fontSize: 12.5, height: 1.35),
      gold = TextStyle(
        color: _C.gold,
        fontSize: 16,
        fontWeight: FontWeight.w700,
      );
}
