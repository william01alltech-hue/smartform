// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Korean (`ko`).
class AppLocalizationsKo extends AppLocalizations {
  AppLocalizationsKo([String locale = 'ko']) : super(locale);

  @override
  String get appTitle => '현장 양식 자동화';

  @override
  String get homeTitle => '현장 점검 양식';

  @override
  String get syncStatus => '동기화 상태';

  @override
  String get online => '온라인';

  @override
  String get offline => '오프라인 (로컬에 저장됨)';

  @override
  String syncPending(int count) {
    return '대기 중인 동기화: $count개';
  }

  @override
  String get saveDraft => '임시 저장';

  @override
  String get submitForm => '양식 제출';

  @override
  String get noForms => '사용 가능한 임시 저장이 없습니다';

  @override
  String get formSaved => '양식이 로컬 임시 저장에 저장되었습니다';

  @override
  String get formSynced => '오프라인 양식이 성공적으로 동기화되었습니다!';

  @override
  String get photoField => '탭하여 사진 촬영 / 업로드';

  @override
  String get cropPhoto => '사진 자르기';

  @override
  String get compressing => '사진 압축 중...';

  @override
  String get selectLanguage => '언어 선택';
}
