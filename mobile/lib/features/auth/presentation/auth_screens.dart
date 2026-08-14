import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

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
  final _email = TextEditingController();
  final _password = TextEditingController();

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return _AuthFrame(
      title: t.signInTitle,
      action: t.signIn,
      controller: widget.controller,
      onAction: () =>
          widget.controller.login(_email.text.trim(), _password.text),
      fields: [_emailField(t, _email), _passwordField(t, _password)],
      alternate: TextButton(
        onPressed: () => context.go('/signup'),
        child: Text(t.createAccount),
      ),
    );
  }
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
  String? _validationMessage;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _confirmation.dispose();
    super.dispose();
  }

  Future<void> _submit(AppLocalizations t) async {
    if (!_isValidEmail(_email.text) ||
        _password.text.length < 8 ||
        _password.text != _confirmation.text) {
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
      onAction: () => _submit(t),
      validationMessage: _validationMessage,
      fields: [
        _emailField(t, _email),
        _passwordField(t, _password),
        _passwordField(t, _confirmation, label: t.confirmPassword),
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

Widget _emailField(AppLocalizations t, TextEditingController controller) =>
    TextField(
      controller: controller,
      decoration: InputDecoration(labelText: t.email),
      keyboardType: TextInputType.emailAddress,
      autofillHints: const [AutofillHints.username],
    );

Widget _passwordField(
  AppLocalizations t,
  TextEditingController controller, {
  String? label,
}) => TextField(
  controller: controller,
  decoration: InputDecoration(labelText: label ?? t.password),
  obscureText: true,
  autofillHints: const [AutofillHints.password],
);

class _AuthFrame extends StatelessWidget {
  const _AuthFrame({
    required this.title,
    required this.action,
    required this.controller,
    required this.onAction,
    required this.fields,
    required this.alternate,
    this.validationMessage,
  });

  final String title;
  final String action;
  final AuthController controller;
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
            (state.status == AuthStatus.error ? t.authRequestFailed : null);
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
                      ...fields.map(
                        (field) => Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: field,
                        ),
                      ),
                      if (message != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: Text(
                            message,
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.error,
                            ),
                          ),
                        ),
                      FilledButton(
                        onPressed: submitting ? null : () => onAction(),
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
