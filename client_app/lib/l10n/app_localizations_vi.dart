// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Vietnamese (`vi`).
class AppLocalizationsVi extends AppLocalizations {
  AppLocalizationsVi([String locale = 'vi']) : super(locale);

  @override
  String get appTitle => 'Hệ thống Tự động hóa Biểu mẫu Công trường';

  @override
  String get homeTitle => 'Biểu mẫu Kiểm tra Công trường';

  @override
  String get syncStatus => 'Trạng thái Đồng bộ';

  @override
  String get online => 'Đã kết nối';

  @override
  String get offline => 'Ngoại tuyến (Bản nháp đã lưu cục bộ)';

  @override
  String syncPending(int count) {
    return 'Đang chờ đồng bộ: $count biểu mẫu';
  }

  @override
  String get saveDraft => 'Lưu Bản nháp';

  @override
  String get submitForm => 'Gửi Biểu mẫu';

  @override
  String get noForms => 'Không có bản nháp';

  @override
  String get formSaved => 'Biểu mẫu đã được lưu vào bản nháp cục bộ';

  @override
  String get formSynced => 'Đồng bộ biểu mẫu ngoại tuyến thành công!';

  @override
  String get photoField => 'Nhấp để chụp ảnh / tải lên';

  @override
  String get cropPhoto => 'Cắt ảnh';

  @override
  String get compressing => 'Đang nén ảnh...';

  @override
  String get selectLanguage => 'Chọn Ngôn ngữ';
}
