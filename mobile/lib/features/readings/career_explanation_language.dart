import 'package:flutter/foundation.dart';

import '../../core/storage/secure_state_store.dart';

enum CareerExplanationLanguage { english, hinglish }

abstract interface class CareerExplanationLanguageStorage {
  Future<String?> readLanguage();
  Future<void> writeLanguage(CareerExplanationLanguage language);
}

class SecureCareerExplanationLanguageStorage
    implements CareerExplanationLanguageStorage {
  const SecureCareerExplanationLanguageStorage(this._store);
  static const _key = 'career_explanation_language';
  final SecureStateStore _store;

  @override
  Future<String?> readLanguage() => _store.read(_key);

  @override
  Future<void> writeLanguage(CareerExplanationLanguage language) =>
      _store.write(key: _key, value: language.name);
}

/// App-owned presentation preference. It never changes a stored reading's
/// generation locale or requests a new reading from the backend.
class CareerExplanationLanguageController extends ChangeNotifier {
  CareerExplanationLanguageController(this._storage);
  final CareerExplanationLanguageStorage _storage;
  CareerExplanationLanguage _language = CareerExplanationLanguage.english;

  CareerExplanationLanguage get language => _language;

  Future<void> load() async {
    final stored = await _storage.readLanguage();
    final language = CareerExplanationLanguage.values.where(
      (item) => item.name == stored,
    );
    if (language.isEmpty || language.first == _language) return;
    _language = language.first;
    notifyListeners();
  }

  Future<void> setLanguage(CareerExplanationLanguage language) async {
    if (_language == language) return;
    _language = language;
    notifyListeners();
    await _storage.writeLanguage(language);
  }
}
