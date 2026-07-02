// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Japanese (`ja`).
class AppLocalizationsJa extends AppLocalizations {
  AppLocalizationsJa([String locale = 'ja']) : super(locale);

  @override
  String get appTitle => 'サイトフォーム自動化';

  @override
  String get homeTitle => '現場検査フォーム';

  @override
  String get syncStatus => '同期ステータス';

  @override
  String get online => 'オンライン';

  @override
  String get offline => 'オフライン (ローカルに保存)';

  @override
  String syncPending(int count) {
    return '保留中の同期: $count 件';
  }

  @override
  String get saveDraft => '下書きを保存';

  @override
  String get submitForm => 'フォームを送信';

  @override
  String get noForms => '利用可能な下書きはありません';

  @override
  String get formSaved => 'フォームをローカルの下書きに保存しました';

  @override
  String get formSynced => 'オフラインフォームの同期に成功しました！';

  @override
  String get photoField => 'タップして写真を撮影 / アップロード';

  @override
  String get cropPhoto => '写真を切り抜き';

  @override
  String get compressing => '写真を圧縮中...';

  @override
  String get selectLanguage => '言語を選択';
}
