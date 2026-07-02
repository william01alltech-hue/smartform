// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for French (`fr`).
class AppLocalizationsFr extends AppLocalizations {
  AppLocalizationsFr([String locale = 'fr']) : super(locale);

  @override
  String get appTitle => 'Automatisation des Formulaires';

  @override
  String get homeTitle => 'Formulaires d\'Inspection';

  @override
  String get syncStatus => 'État de Synchronisation';

  @override
  String get online => 'Connecté';

  @override
  String get offline => 'Hors ligne (Enregistré)';

  @override
  String syncPending(int count) {
    return 'En attente: $count formulaires';
  }

  @override
  String get saveDraft => 'Enregistrer Brouillon';

  @override
  String get submitForm => 'Soumettre';

  @override
  String get noForms => 'Aucun brouillon disponible';

  @override
  String get formSaved => 'Enregistré dans les brouillons';

  @override
  String get formSynced => 'Synchronisés avec succès !';

  @override
  String get photoField => 'Appuyez pour prendre une photo';

  @override
  String get cropPhoto => 'Recadrer la Photo';

  @override
  String get compressing => 'Compression de la photo...';

  @override
  String get selectLanguage => 'Choisir la Langue';
}
