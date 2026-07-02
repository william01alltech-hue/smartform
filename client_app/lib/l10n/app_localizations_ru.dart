// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Russian (`ru`).
class AppLocalizationsRu extends AppLocalizations {
  AppLocalizationsRu([String locale = 'ru']) : super(locale);

  @override
  String get appTitle => 'Автоматизация Форм';

  @override
  String get homeTitle => 'Формы Проверок';

  @override
  String get syncStatus => 'Статус Синхронизации';

  @override
  String get online => 'В сети';

  @override
  String get offline => 'Не в сети (Сохранено)';

  @override
  String syncPending(int count) {
    return 'Ожидает: $count форм';
  }

  @override
  String get saveDraft => 'Сохранить Черновик';

  @override
  String get submitForm => 'Отправить Форму';

  @override
  String get noForms => 'Нет черновиков';

  @override
  String get formSaved => 'Сохранено в черновиках';

  @override
  String get formSynced => 'Успешно синхронизировано!';

  @override
  String get photoField => 'Нажмите, чтобы загрузить фото';

  @override
  String get cropPhoto => 'Обрезать Фото';

  @override
  String get compressing => 'Сжатие фото...';

  @override
  String get selectLanguage => 'Выбрать Язык';
}
