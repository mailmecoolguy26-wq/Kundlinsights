import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/formatters/customer_date.dart';
import '../domain/wealth_answer.dart';
import '../wealth_answer_controller.dart';

/// Presentation-only: all Wealth states, dates, factors and evidence come
/// from the server-owned wealth-rules-v1 response.
class WealthHubScreen extends StatefulWidget {
  const WealthHubScreen({super.key, required this.controller});
  final WealthAnswerController controller;
  @override State<WealthHubScreen> createState() => _WealthHubScreenState();
}
class _WealthHubScreenState extends State<WealthHubScreen> {
  bool _detailsOpen = false;
  @override void initState() { super.initState(); WidgetsBinding.instance.addPostFrameCallback((_) => widget.controller.load()); }
  @override Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.controller,
    builder: (context, child) => Scaffold(
      backgroundColor: const Color(0xff073b3b),
      appBar: AppBar(backgroundColor: const Color(0xff073b3b), foregroundColor: const Color(0xfffff6df), title: const Text('WEALTH & MONEY')),
      body: switch (widget.controller.state) {
        WealthAnswerLoadState.initial || WealthAnswerLoadState.loading => const Center(child: CircularProgressIndicator()),
        WealthAnswerLoadState.error => _Message(message: 'We couldn’t load your Wealth outlook right now.', action: 'Retry', onAction: () => widget.controller.load(force: true)),
        WealthAnswerLoadState.loaded when widget.controller.answer!.premiumRequired => _Message(message: 'Unlock all personalized insights for this birth profile.', action: 'Unlock TaraVerse Premium', onAction: () => context.push('/premium')),
        WealthAnswerLoadState.loaded => _Result(answer: widget.controller.answer!, detailsOpen: _detailsOpen, onToggleDetails: () => setState(() => _detailsOpen = !_detailsOpen)),
      },
    ),
  );
}
class _Message extends StatelessWidget {
  const _Message({required this.message, required this.action, required this.onAction}); final String message, action; final VoidCallback onAction;
  @override Widget build(BuildContext context) => Center(child: Padding(padding: const EdgeInsets.all(28), child: Column(mainAxisSize: MainAxisSize.min, children:[Text(message, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xfffff6df))), const SizedBox(height:16), FilledButton(onPressed:onAction, child:Text(action))])));
}
class _Result extends StatelessWidget {
  const _Result({required this.answer, required this.detailsOpen, required this.onToggleDetails}); final WealthAnswer answer; final bool detailsOpen; final VoidCallback onToggleDetails;
  @override Widget build(BuildContext context) {
    final window = answer.strongerWindow;
    return ListView(padding: const EdgeInsets.fromLTRB(20, 12, 20, 36), children: [
      const Text('Your Wealth Outlook', style: TextStyle(color: Color(0xfffff6df), fontSize: 27, fontWeight: FontWeight.w700)), const SizedBox(height: 16),
      _Card(children:[const _Heading('CURRENT WEALTH OUTLOOK'), Text(answer.state, style: const TextStyle(color: Color(0xff55ddd0), fontSize: 21, fontWeight: FontWeight.w700)), if(answer.summary.isNotEmpty) ...[const SizedBox(height:8), Text(answer.summary, style:_body)]]),
      if (window != null) ...[const SizedBox(height:12), _Card(children:[const _Heading('STRONGER WEALTH WINDOW'), Text('${formatCustomerLocalDate(window.start)} – ${formatCustomerLocalDate(window.end)}', style: const TextStyle(color: Color(0xfffff6df), fontSize:18,fontWeight:FontWeight.w600)), const SizedBox(height:8), Text(window.state, style:_body)])],
      if (answer.whatThisCanMean.isNotEmpty) _Section(title:'WHAT THIS CAN MEAN', items:answer.whatThisCanMean),
      if (answer.supportiveFactors.isNotEmpty) _Section(title:'WHAT SUPPORTS WEALTH GROWTH', items:answer.supportiveFactors),
      if (answer.cautionFactors.isNotEmpty) _Section(title:'WHAT NEEDS CAUTION', items:answer.cautionFactors),
      if (answer.practicalFocus.isNotEmpty) _Section(title:'WHAT TO FOCUS ON', items:answer.practicalFocus),
      const SizedBox(height:12), _Card(children:[InkWell(onTap:onToggleDetails, child: Row(children:[const Expanded(child: Text('VIEW DETAILED ASTROLOGY', style: TextStyle(color: Color(0xfffff6df),fontWeight:FontWeight.w700))), Icon(detailsOpen?Icons.expand_less:Icons.expand_more,color:const Color(0xff55ddd0))])), if(detailsOpen) ..._details(answer.detailedAstrology)]),
      const Padding(padding: EdgeInsets.only(top:18), child: Text('Wealth timing reflects relative astrological evidence. Financial activity does not guarantee financial gain and is not investment advice.', style: TextStyle(color: Color(0xffc6d5d0), fontSize:12))),
    ]);
  }
  List<Widget> _details(Map<String,dynamic> values) => values.entries.where((entry) => entry.value != null && (entry.value is! Map || (entry.value as Map).isNotEmpty)).map((entry) => Padding(padding:const EdgeInsets.only(top:14),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Text(_label(entry.key),style:const TextStyle(color:Color(0xffd8b96d),fontWeight:FontWeight.w700)),const SizedBox(height:4),Text(_technical(entry.value),style:_body)]))).toList();
  String _label(String key) => {'timingEvidence':'Timing Evidence','dashaAndTransit':'Dasha & Transit','d1WealthFoundation':'D1 Wealth Foundation','d2Hora':'D2 / Hora','ashtakavarga':'Ashtakavarga','calibration':'Calibration'}[key] ?? key;
  String _technical(Object value) => value is Map ? value.entries.map((entry) => '${entry.key}: ${entry.value is Map || entry.value is List ? 'available' : entry.value}').join('\n') : value.toString();
}
class _Section extends StatelessWidget { const _Section({required this.title,required this.items}); final String title; final List<String> items; @override Widget build(BuildContext context)=>Padding(padding:const EdgeInsets.only(top:12),child:_Card(children:[_Heading(title),...items.take(4).map((item)=>Padding(padding:const EdgeInsets.only(top:8),child:Text('• $item',style:_body)))])); }
class _Card extends StatelessWidget { const _Card({required this.children}); final List<Widget> children; @override Widget build(BuildContext context)=>Container(padding:const EdgeInsets.all(18),decoration:BoxDecoration(color:const Color(0xff0d5150),borderRadius:BorderRadius.circular(16)),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:children)); }
class _Heading extends StatelessWidget { const _Heading(this.text); final String text; @override Widget build(BuildContext context)=>Padding(padding:const EdgeInsets.only(bottom:8),child:Text(text,style:const TextStyle(color:Color(0xffd8b96d),fontWeight:FontWeight.w700,fontSize:12,letterSpacing:1))); }
const _body=TextStyle(color:Color(0xfffff6df),height:1.35);
