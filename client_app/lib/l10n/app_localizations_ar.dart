// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Arabic (`ar`).
class AppLocalizationsAr extends AppLocalizations {
  AppLocalizationsAr([String locale = 'ar']) : super(locale);

  @override
  String get appTitle => 'أتمتة النماذج';

  @override
  String get homeTitle => 'نماذج الفحص';

  @override
  String get syncStatus => 'حالة المزامنة';

  @override
  String get online => 'متصل';

  @override
  String get offline => 'غير متصل (محفوظ)';

  @override
  String syncPending(int count) {
    return 'قيد الانتظار: $count';
  }

  @override
  String get saveDraft => 'حفظ كمسودة';

  @override
  String get submitForm => 'إرسال';

  @override
  String get noForms => 'لا توجد مسودات';

  @override
  String get formSaved => 'تم الحفظ محلياً';

  @override
  String get formSynced => 'تمت المزامنة بنجاح!';

  @override
  String get photoField => 'اضغط لإضافة صورة';

  @override
  String get cropPhoto => 'قص الصورة';

  @override
  String get compressing => 'جاري ضغط الصورة...';

  @override
  String get selectLanguage => 'اختر اللغة';
}
