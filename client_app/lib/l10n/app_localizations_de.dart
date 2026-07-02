// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for German (`de`).
class AppLocalizationsDe extends AppLocalizations {
  AppLocalizationsDe([String locale = 'de']) : super(locale);

  @override
  String get appTitle => 'Formularautomatisierung';

  @override
  String get homeTitle => 'Inspektionsformulare';

  @override
  String get syncStatus => 'Synchronisationsstatus';

  @override
  String get online => 'Verbunden';

  @override
  String get offline => 'Offline (Gespeichert)';

  @override
  String syncPending(int count) {
    return 'Ausstehend: $count Formulare';
  }

  @override
  String get saveDraft => 'Entwurf speichern';

  @override
  String get submitForm => 'Absenden';

  @override
  String get noForms => 'Keine Entwürfe verfügbar';

  @override
  String get formSaved => 'In lokalen Entwürfen gespeichert';

  @override
  String get formSynced => 'Erfolgreich synchronisiert!';

  @override
  String get photoField => 'Tippen zum Fotografieren';

  @override
  String get cropPhoto => 'Foto zuschneiden';

  @override
  String get compressing => 'Foto wird komprimiert...';

  @override
  String get selectLanguage => 'Sprache auswählen';
}
