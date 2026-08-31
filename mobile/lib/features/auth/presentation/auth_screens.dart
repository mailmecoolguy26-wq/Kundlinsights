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
  final _form = GlobalKey<FormState>();
  final _passwordFocus = FocusNode();
  bool _passwordVisible = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return _AuthFrame(
      title: t.signInTitle,
      action: t.signIn,
      controller: widget.controller,
      formKey: _form,
      onAction: () =>
          widget.controller.login(_email.text.trim(), _password.text),
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
          onSubmitted: () => _form.currentState?.validate() == true
              ? widget.controller.login(_email.text.trim(), _password.text)
              : null,
        ),
      ],
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
