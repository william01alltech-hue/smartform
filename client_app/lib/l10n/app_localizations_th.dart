// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Thai (`th`).
class AppLocalizationsTh extends AppLocalizations {
  AppLocalizationsTh([String locale = 'th']) : super(locale);

  @override
  String get appTitle => 'ระบบอัตโนมัติแบบฟอร์มไซต์งาน';

  @override
  String get homeTitle => 'แบบฟอร์มตรวจสอบไซต์งาน';

  @override
  String get syncStatus => 'สถานะการซิงค์';

  @override
  String get online => 'เชื่อมต่อแล้ว';

  @override
  String get offline => 'ออฟไลน์ (บันทึกแบบร่างไว้ในเครื่อง)';

  @override
  String syncPending(int count) {
    return 'รอการซิงค์: $count แบบฟอร์ม';
  }

  @override
  String get saveDraft => 'บันทึกแบบร่าง';

  @override
  String get submitForm => 'ส่งแบบฟอร์ม';

  @override
  String get noForms => 'ไม่มีแบบร่าง';

  @override
  String get formSaved => 'บันทึกแบบฟอร์มลงในแบบร่างเครื่องแล้ว';

  @override
  String get formSynced => 'ซิงค์แบบฟอร์มออฟไลน์สำเร็จ!';

  @override
  String get photoField => 'แตะเพื่อถ่ายรูป / อัปโหลด';

  @override
  String get cropPhoto => 'ครอบตัดรูปภาพ';

  @override
  String get compressing => 'กำลังบีบอัดรูปภาพ...';

  @override
  String get selectLanguage => 'เลือกภาษา';
}
