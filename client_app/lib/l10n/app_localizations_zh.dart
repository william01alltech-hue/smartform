// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Chinese (`zh`).
class AppLocalizationsZh extends AppLocalizations {
  AppLocalizationsZh([String locale = 'zh']) : super(locale);

  @override
  String get appTitle => '智表通 - 萬用表單自動化系統';

  @override
  String get homeTitle => '智表通 SmartForm';

  @override
  String get syncStatus => '同步狀態';

  @override
  String get online => '已連線';

  @override
  String get offline => '離線中 (草稿將儲存於本地)';

  @override
  String syncPending(int count) {
    return '等待同步表單: $count 件';
  }

  @override
  String get saveDraft => '儲存草稿';

  @override
  String get submitForm => '上傳表單';

  @override
  String get noForms => '目前無表單草稿';

  @override
  String get formSaved => '表單已儲存至本地草稿';

  @override
  String get formSynced => '離線表單同步成功！';

  @override
  String get photoField => '點擊拍照/上傳相片';

  @override
  String get cropPhoto => '裁切相片';

  @override
  String get compressing => '相片壓縮中...';

  @override
  String get selectLanguage => '選擇語言';
}

/// The translations for Chinese, as used in China (`zh_CN`).
class AppLocalizationsZhCn extends AppLocalizationsZh {
  AppLocalizationsZhCn() : super('zh_CN');

  @override
  String get appTitle => '工地表单自动化系统';

  @override
  String get homeTitle => '工地现场表单';

  @override
  String get syncStatus => '同步状态';

  @override
  String get online => '已连接';

  @override
  String get offline => '离线中 (草稿将储存于本地)';

  @override
  String syncPending(int count) {
    return '等待同步表单: $count 件';
  }

  @override
  String get saveDraft => '储存草稿';

  @override
  String get submitForm => '上传表单';

  @override
  String get noForms => '目前无表单草稿';

  @override
  String get formSaved => '表单已储存至本地草稿';

  @override
  String get formSynced => '离线表单同步成功！';

  @override
  String get photoField => '点击拍照/上传相片';

  @override
  String get cropPhoto => '裁切相片';

  @override
  String get compressing => '相片压缩中...';

  @override
  String get selectLanguage => '选择语言';
}

/// The translations for Chinese, as used in Taiwan (`zh_TW`).
class AppLocalizationsZhTw extends AppLocalizationsZh {
  AppLocalizationsZhTw() : super('zh_TW');

  @override
  String get appTitle => '智表通 - 萬用表單自動化系統';

  @override
  String get homeTitle => '智表通 SmartForm';

  @override
  String get syncStatus => '同步狀態';

  @override
  String get online => '已連線';

  @override
  String get offline => '離線中 (草稿將儲存於本地)';

  @override
  String syncPending(int count) {
    return '等待同步表單: $count 件';
  }

  @override
  String get saveDraft => '儲存草稿';

  @override
  String get submitForm => '上傳表單';

  @override
  String get noForms => '目前無表單草稿';

  @override
  String get formSaved => '表單已儲存至本地草稿';

  @override
  String get formSynced => '離線表單同步成功！';

  @override
  String get photoField => '點擊拍照/上傳相片';

  @override
  String get cropPhoto => '裁切相片';

  @override
  String get compressing => '相片壓縮中...';

  @override
  String get selectLanguage => '選擇語言';
}
