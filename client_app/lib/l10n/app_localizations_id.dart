// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Indonesian (`id`).
class AppLocalizationsId extends AppLocalizations {
  AppLocalizationsId([String locale = 'id']) : super(locale);

  @override
  String get appTitle => 'Otomatisasi Formulir Konstruksi';

  @override
  String get homeTitle => 'Formulir Pemeriksaan Lapangan';

  @override
  String get syncStatus => 'Status Sinkronisasi';

  @override
  String get online => 'Tersambung';

  @override
  String get offline => 'Luring (Draf disimpan lokal)';

  @override
  String syncPending(int count) {
    return 'Menunggu sinkronisasi: $count formulir';
  }

  @override
  String get saveDraft => 'Simpan Draf';

  @override
  String get submitForm => 'Kirim Formulir';

  @override
  String get noForms => 'Tidak ada draf tersedia';

  @override
  String get formSaved => 'Formulir disimpan ke draf lokal';

  @override
  String get formSynced => 'Sinkronisasi formulir luring berhasil!';

  @override
  String get photoField => 'Ketuk untuk mengambil foto / unggah';

  @override
  String get cropPhoto => 'Potong Foto';

  @override
  String get compressing => 'Mengompres foto...';

  @override
  String get selectLanguage => 'Pilih Bahasa';
}
