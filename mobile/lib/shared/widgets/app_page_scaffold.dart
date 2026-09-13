import 'package:flutter/material.dart';

/// Consistent lightweight page structure for standard app screens.
class AppPageScaffold extends StatelessWidget {
  const AppPageScaffold({
    super.key,
    required this.body,
    this.title,
    this.actions,
    this.floatingActionButton,
    this.bottomNavigationBar,
    this.safeArea = true,
  });

  final Widget body;
  final String? title;
  final List<Widget>? actions;
  final Widget? floatingActionButton;
  final Widget? bottomNavigationBar;
  final bool safeArea;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFF0B071B),
    appBar: title == null
        ? null
        : AppBar(
            backgroundColor: const Color(0xFF0B071B),
            foregroundColor: const Color(0xFFFAF7F2),
            surfaceTintColor: Colors.transparent,
            title: Text(title!),
            actions: actions,
          ),
    body: safeArea ? SafeArea(child: body) : body,
    floatingActionButton: floatingActionButton,
    bottomNavigationBar: bottomNavigationBar,
  );
}
