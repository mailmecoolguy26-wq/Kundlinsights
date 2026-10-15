import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../career_chat_controller.dart';
import '../domain/career_chat.dart';
import 'career_chat_presentation.dart';

class CareerChatScreen extends StatefulWidget {
  const CareerChatScreen({super.key, required this.controller});
  final CareerChatController controller;

  @override
  State<CareerChatScreen> createState() => _CareerChatScreenState();
}

class _CareerChatScreenState extends State<CareerChatScreen> {
  final _input = TextEditingController();

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  Future<void> _send([String? value]) async {
    final text = value ?? _input.text;
    if (text.trim().isEmpty || widget.controller.isSending) return;
    if (kDebugMode) {
      debugPrint(
        'TARA_SEND_TAP '
        'conversationId=${widget.controller.conversationId} '
        'birthProfileId=${widget.controller.activeProfileId} '
        'messageCount=${widget.controller.messages.length} '
        'sendState=${widget.controller.isSending ? 'sending' : 'idle'}',
      );
    }
    final accepted = await widget.controller.send(text);
    // Prompt chips do not own the composer text. For typed input, clear only
    // after the controller has accepted it into canonical conversation state.
    // Avoid erasing text the user entered while the request was in flight.
    if (accepted && value == null && mounted && _input.text == text) {
      if (kDebugMode) {
        debugPrint(
          'TARA_INPUT_CLEAR '
          'conversationId=${widget.controller.conversationId} '
          'birthProfileId=${widget.controller.activeProfileId} '
          'messageCount=${widget.controller.messages.length} '
          'sendState=${widget.controller.isSending ? 'sending' : 'idle'}',
        );
      }
      _input.clear();
    }
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.controller,
    builder: (context, _) {
      final hinglish =
          widget.controller.language == CareerChatLanguage.hinglish;
      return Scaffold(
        backgroundColor: _Colors.midnight,
        appBar: AppBar(
          backgroundColor: _Colors.midnight,
          foregroundColor: _Colors.alabaster,
          elevation: 0,
          titleSpacing: 0,
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('ASK TARA', style: _Styles.eyebrow),
              Text(
                widget.controller.activeProfileName ?? 'TaraVerse',
                style: _Styles.profile,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => _openHistory(context),
              child: const Text(
                'History',
                style: TextStyle(color: _Colors.gold),
              ),
            ),
          ],
        ),
        body: SafeArea(
          top: false,
          child: Column(
            children: [
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
                  children: [
                    const Text('Ask Tara', style: _Styles.title),
                    const SizedBox(height: 8),
                    Text(
                      'For ${widget.controller.activeProfileName ?? 'your active profile'}',
                      style: _Styles.body,
                    ),
                    const SizedBox(height: 16),
                    if (widget.controller.messages.isEmpty) ...[
                      Text(
                        hinglish
                            ? 'Apne selected profile ke liye Career, relationships, chart aur life timing ke baare mein pooch sakte hain.'
                            : 'Ask about Career, relationships, your chart, or life timing for this profile.',
                        style: _Styles.body,
                      ),
                      const SizedBox(height: 14),
                      _PromptWrap(
                        prompts: hinglish
                            ? const [
                                'Meri Career timing kab strong ho sakti hai?',
                                'Meri chart relationships ke baare mein kya dikhati hai?',
                                'Property ke liye supportive period hai?',
                                'Abhi mujhe kis baat par dhyan dena chahiye?',
                              ]
                            : const [
                                'When is my career likely to improve?',
                                'What does my chart indicate about relationships?',
                                'Is there a supportive period for property?',
                                'What should I pay attention to right now?',
                              ],
                        onTap: (prompt) => unawaited(_send(prompt)),
                      ),
                    ],
                    for (final message in widget.controller.messages) ...[
                      const SizedBox(height: 14),
                      _MessageBubble(
                        message: message,
                        onRetry: () => widget.controller.retry(message),
                        onFollowUp: (prompt) => unawaited(_send(prompt)),
                        onGenerate: () => context.go('/readings'),
                        onAction: _premiumAction(context, message),
                      ),
                    ],
                    if (widget.controller.requiresPremium) ...[
                      const SizedBox(height: 14),
                      _AccessRequired(
                        onUnlock: () => context.push('/career-premium'),
                      ),
                    ],
                    if (widget.controller.isSending)
                      Padding(
                        padding: EdgeInsets.only(top: 14),
                        child: _SendingBubble(hinglish: hinglish),
                      ),
                  ],
                ),
              ),
              _Composer(
                controller: _input,
                sending: widget.controller.isSending,
                placeholder: hinglish ? 'Tara se poochiye...' : 'Ask Tara...',
                onSend: () => unawaited(_send()),
              ),
            ],
          ),
        ),
      );
    },
  );

  VoidCallback? _premiumAction(
    BuildContext context,
    CareerChatMessage message,
  ) {
    final shouldRenderPremiumAction = widget.controller.canOpenCareerPremium(
      message,
    );
    if (kDebugMode && message.action != null) {
      debugPrint(
        'TARA_ACTION_RENDER '
        'actionType=${message.action?.type} '
        'messageBirthProfileId=${message.birthProfileId} '
        'activeBirthProfileId=${widget.controller.activeProfileId} '
        'profileIdsMatch=${message.birthProfileId == widget.controller.activeProfileId} '
        'shouldRenderPremiumAction=$shouldRenderPremiumAction',
      );
    }
    if (!shouldRenderPremiumAction) return null;
    return () async {
      await context.push('/career-premium');
      if (context.mounted) await widget.controller.refreshCurrentConversation();
    };
  }

  Future<void> _openHistory(BuildContext context) async {
    await widget.controller.loadHistory();
    if (!context.mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: _Colors.midnight,
      showDragHandle: true,
      builder: (sheetContext) => ListenableBuilder(
        listenable: widget.controller,
        builder: (_, _) => SafeArea(
          child: SizedBox(
            height: 440,
            child: Column(
              children: [
                ListTile(
                  title: const Text(
                    'Conversation history',
                    style: TextStyle(
                      color: _Colors.alabaster,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  trailing: TextButton(
                    onPressed: () {
                      widget.controller.startNewConversation();
                      Navigator.pop(sheetContext);
                    },
                    child: const Text('New'),
                  ),
                ),
                Expanded(
                  child: widget.controller.conversations.isEmpty
                      ? const Center(
                          child: Text(
                            'No conversations yet.',
                            style: _Styles.body,
                          ),
                        )
                      : ListView.builder(
                          itemCount: widget.controller.conversations.length,
                          itemBuilder: (_, index) {
                            final conversation =
                                widget.controller.conversations[index];
                            return ListTile(
                              title: Text(
                                conversation.title,
                                style: const TextStyle(
                                  color: _Colors.alabaster,
                                ),
                              ),
                              subtitle: Text(
                                conversation.lastMessagePreview ?? '',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: _Styles.body,
                              ),
                              onTap: () async {
                                await widget.controller.openConversation(
                                  conversation.conversationId,
                                );
                                if (sheetContext.mounted) {
                                  Navigator.pop(sheetContext);
                                }
                              },
                            );
                          },
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _AccessRequired extends StatelessWidget {
  const _AccessRequired({required this.onUnlock});
  final VoidCallback onUnlock;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: _Colors.abyss,
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: _Colors.border),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Career Premium is required for this Career question.',
          style: _Styles.body,
        ),
        const SizedBox(height: 8),
        TextButton(
          onPressed: onUnlock,
          style: TextButton.styleFrom(foregroundColor: _Colors.gold),
          child: const Text('UNLOCK CAREER PREMIUM'),
        ),
      ],
    ),
  );
}

class _PromptWrap extends StatelessWidget {
  const _PromptWrap({required this.prompts, required this.onTap});
  final List<String> prompts;
  final ValueChanged<String> onTap;
  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 8,
    runSpacing: 8,
    children: prompts
        .map(
          (prompt) => ActionChip(
            label: Text(prompt),
            labelStyle: _Styles.chip,
            backgroundColor: _Colors.violet,
            side: const BorderSide(color: _Colors.border),
            onPressed: () => onTap(prompt),
          ),
        )
        .toList(),
  );
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.onRetry,
    required this.onFollowUp,
    required this.onGenerate,
    this.onAction,
  });
  final CareerChatMessage message;
  final VoidCallback onRetry;
  final ValueChanged<String> onFollowUp;
  final VoidCallback onGenerate;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    if (message.role == CareerChatRole.user) {
      return Align(
        alignment: Alignment.centerRight,
        child: Container(
          constraints: const BoxConstraints(maxWidth: 300),
          padding: const EdgeInsets.all(13),
          decoration: BoxDecoration(
            color: const Color(0xFF114A46),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(message.text, style: _Styles.user),
              if (message.failed)
                TextButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh, size: 16),
                  label: const Text('Retry'),
                  style: TextButton.styleFrom(foregroundColor: _Colors.gold),
                ),
            ],
          ),
        ),
      );
    }
    if (message.response == null) {
      return Container(
        padding: const EdgeInsets.all(15),
        decoration: BoxDecoration(
          color: _Colors.abyss,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _Colors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(message.text, style: _Styles.body),
            if (message.action != null && onAction != null) ...[
              const SizedBox(height: 10),
              TextButton(
                key: const ValueKey('ask-tara-open-career-premium'),
                onPressed: onAction,
                style: TextButton.styleFrom(foregroundColor: _Colors.gold),
                child: Text(message.action!.label),
              ),
            ],
          ],
        ),
      );
    }
    final presentation = CareerChatPresentation.fromResponse(message.response!);
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: _Colors.abyss,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _Colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('ASK TARA', style: _Styles.eyebrow),
          const SizedBox(height: 7),
          Text(presentation.headline, style: _Styles.assistantTitle),
          if (presentation.body != null) ...[
            const SizedBox(height: 8),
            Text(presentation.body!, style: _Styles.body),
          ],
          for (final timing in presentation.timingWindows)
            _TimingWindow(data: timing),
          if (presentation.evidence.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(presentation.evidence.join(' · '), style: _Styles.body),
          ],
          if (presentation.caveats.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(presentation.caveats.join(' · '), style: _Styles.caveat),
          ],
          if (presentation.shouldOfferGeneration) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: onGenerate,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _Colors.gold,
                  foregroundColor: _Colors.midnight,
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  textStyle: const TextStyle(fontWeight: FontWeight.w800),
                ),
                child: const Text('GENERATE CAREER READING'),
              ),
            ),
          ],
          if (presentation.followUps.isNotEmpty) ...[
            const SizedBox(height: 12),
            _FollowUpWrap(prompts: presentation.followUps, onTap: onFollowUp),
          ],
        ],
      ),
    );
  }
}

class _FollowUpWrap extends StatelessWidget {
  const _FollowUpWrap({required this.prompts, required this.onTap});
  final List<CareerChatFollowUp> prompts;
  final ValueChanged<String> onTap;

  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 8,
    runSpacing: 8,
    children: prompts
        .map(
          (prompt) => ActionChip(
            label: Text(prompt.label),
            labelStyle: _Styles.chip,
            backgroundColor: _Colors.violet,
            side: const BorderSide(color: _Colors.border),
            onPressed: () => onTap(prompt.requestText),
          ),
        )
        .toList(),
  );
}

class _TimingWindow extends StatelessWidget {
  const _TimingWindow({required this.data});
  final Map<String, dynamic> data;
  @override
  Widget build(BuildContext context) {
    final start = data['start'] ?? data['from'] ?? data['instant'];
    final end = data['end'] ?? data['to'];
    if (start is! String && end is! String) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: _Colors.violet,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        [start, end].whereType<String>().join(' – '),
        style: _Styles.timing,
      ),
    );
  }
}

class _SendingBubble extends StatelessWidget {
  const _SendingBubble({required this.hinglish});
  final bool hinglish;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      const SizedBox(
        width: 16,
        height: 16,
        child: CircularProgressIndicator(strokeWidth: 2, color: _Colors.gold),
      ),
      const SizedBox(width: 10),
      Text(
        hinglish
            ? 'Tara aapke chart evidence ko check kar rahi hai…'
            : 'Tara is checking your chart evidence…',
        style: _Styles.body,
      ),
    ],
  );
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.sending,
    required this.placeholder,
    required this.onSend,
  });
  final TextEditingController controller;
  final bool sending;
  final String placeholder;
  final VoidCallback onSend;
  @override
  Widget build(BuildContext context) => SafeArea(
    top: false,
    child: Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      child: TextField(
        controller: controller,
        maxLength: 2000,
        minLines: 1,
        maxLines: 4,
        style: _Styles.user,
        textInputAction: TextInputAction.send,
        onSubmitted: (_) => onSend(),
        decoration: InputDecoration(
          counterText: '',
          hintText: placeholder,
          hintStyle: _Styles.body,
          filled: true,
          fillColor: _Colors.abyss,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: _Colors.border),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: _Colors.border),
          ),
          suffixIcon: IconButton(
            onPressed: sending ? null : onSend,
            icon: Icon(
              Icons.arrow_upward_rounded,
              color: sending ? _Colors.slate : _Colors.gold,
            ),
            tooltip: 'Send',
          ),
        ),
      ),
    ),
  );
}

abstract final class _Colors {
  static const midnight = Color(0xFF061A1A);
  static const abyss = Color(0xFF082625);
  static const violet = Color(0xFF0D312F);
  static const alabaster = Color(0xFFF7F4EC);
  static const slate = Color(0xFFA8B7B4);
  static const gold = Color(0xFFD6B15A);
  static const border = Color(0x66255C57);
}

abstract final class _Styles {
  static const eyebrow = TextStyle(
    color: _Colors.gold,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: FontWeight.w700,
  );
  static const title = TextStyle(
    color: _Colors.alabaster,
    fontSize: 30,
    height: 1.1,
    fontWeight: FontWeight.w600,
    fontFamily: 'EBGaramond',
  );
  static const profile = TextStyle(color: _Colors.slate, fontSize: 12);
  static const body = TextStyle(
    color: _Colors.slate,
    fontSize: 14,
    height: 1.4,
  );
  static const chip = TextStyle(color: _Colors.alabaster, fontSize: 12);
  static const user = TextStyle(
    color: _Colors.alabaster,
    fontSize: 15,
    height: 1.35,
  );
  static const assistantTitle = TextStyle(
    color: _Colors.alabaster,
    fontSize: 16,
    height: 1.35,
    fontWeight: FontWeight.w600,
  );
  static const caveat = TextStyle(
    color: _Colors.slate,
    fontSize: 12,
    height: 1.4,
  );
  static const timing = TextStyle(
    color: _Colors.gold,
    fontSize: 12,
    fontWeight: FontWeight.w600,
  );
}
