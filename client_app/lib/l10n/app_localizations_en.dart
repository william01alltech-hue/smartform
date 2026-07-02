// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'Site Form Automation';

  @override
  String get homeTitle => 'Site Inspection Forms';

  @override
  String get syncStatus => 'Sync Status';

  @override
  String get online => 'Connected';

  @override
  String get offline => 'Offline (Drafts saved locally)';

  @override
  String syncPending(int count) {
    return 'Pending sync: $count forms';
  }

  @override
  String get saveDraft => 'Save Draft';

  @override
  String get submitForm => 'Submit Form';

  @override
  String get noForms => 'No drafts available';

  @override
  String get formSaved => 'Form saved to local drafts';

  @override
  String get formSynced => 'Offline forms synced successfully!';

  @override
  String get photoField => 'Tap to take photo / upload';

  @override
  String get cropPhoto => 'Crop Photo';

  @override
  String get compressing => 'Compressing photo...';

  @override
  String get selectLanguage => 'Select Language';
}
