import 'package:hive_flutter/hive_flutter.dart';

class OfflineService {
  static const String configBoxName = 'form_configs';
  static const String draftBoxName = 'form_drafts';
  static const String syncQueueBoxName = 'sync_queue';

  static const String settingsBoxName = 'app_settings';

  /// Initialize Hive database
  static Future<void> init() async {
    await Hive.initFlutter();
    
    // Open standard boxes for dynamic schema-less map storage
    await Hive.openBox<Map>(configBoxName);
    await Hive.openBox<Map>(draftBoxName);
    await Hive.openBox<Map>(syncQueueBoxName);
    await Hive.openBox(settingsBoxName);
  }

  static Box get _settingsBox => Hive.box(settingsBoxName);

  static bool isTrialActivated() {
    return _settingsBox.get('trial_activated', defaultValue: false) == true;
  }

  static Future<void> activateTrial() async {
    await _settingsBox.put('trial_activated', true);
    await _settingsBox.put('trial_start_date', DateTime.now().toIso8601String());
  }

  static DateTime? getTrialStartDate() {
    final dateStr = _settingsBox.get('trial_start_date');
    if (dateStr == null) return null;
    return DateTime.tryParse(dateStr);
  }

  // --- Master/Sub-account Token and Role Operations ---

  static String? getUserToken() {
    return _settingsBox.get('user_token') as String?;
  }

  static Future<void> setUserToken(String? token) async {
    await _settingsBox.put('user_token', token);
  }

  static String getUserRole() {
    // Default to 'free' if no role has been bound yet
    return _settingsBox.get('user_role', defaultValue: 'free') as String;
  }

  static Future<void> setUserRole(String role) async {
    await _settingsBox.put('user_role', role);
  }

  static List<Map> getSyncedTemplates() {
    final raw = _settingsBox.get('synced_templates', defaultValue: []);
    if (raw is List) {
      return raw.map((item) => Map<String, dynamic>.from(item as Map)).toList();
    }
    return [];
  }

  static Future<void> saveSyncedTemplates(List<Map> templates) async {
    await _settingsBox.put('synced_templates', templates);
  }

  static bool isSubaccount() {
    return getUserRole() == 'member';
  }


  static bool isTrialExpired() {
    if (!isTrialActivated()) return true;
    final startDate = getTrialStartDate();
    if (startDate == null) return true;
    final difference = DateTime.now().difference(startDate).inDays;
    return difference >= 30;
  }

  static int getRemainingDays() {
    if (!isTrialActivated()) return 0;
    final startDate = getTrialStartDate();
    if (startDate == null) return 0;
    final difference = DateTime.now().difference(startDate).inDays;
    final remaining = 30 - difference;
    return remaining < 0 ? 0 : remaining;
  }

  static int getAccumulatedPoints() {
    return _settingsBox.get('accumulated_points', defaultValue: 0) as int;
  }

  static Future<void> addPoint() async {
    final currentPoints = getAccumulatedPoints();
    await _settingsBox.put('accumulated_points', currentPoints + 1);
    
    final List<String> raw = List<String>.from(_settingsBox.get('ad_watched_timestamps', defaultValue: []) ?? []);
    raw.add(DateTime.now().toIso8601String());
    await _settingsBox.put('ad_watched_timestamps', raw);
  }

  static List<DateTime> _cleanAndGetAdTimestamps() {
    final List<String> raw = List<String>.from(_settingsBox.get('ad_watched_timestamps', defaultValue: []) ?? []);
    final now = DateTime.now();
    final List<DateTime> dates = raw
        .map((s) => DateTime.tryParse(s))
        .where((d) => d != null && now.difference(d).inHours < 24)
        .cast<DateTime>()
        .toList();
    _settingsBox.put('ad_watched_timestamps', dates.map((d) => d.toIso8601String()).toList());
    return dates;
  }

  static bool canWatchRewardAd() {
    final dates = _cleanAndGetAdTimestamps();
    final now = DateTime.now();
    if (dates.length >= 12) return false;
    if (dates.isNotEmpty) {
      final lastAd = dates.last;
      if (now.difference(lastAd).inHours < 1) return false;
    }
    return true;
  }

  static String getAdCooldownMessage() {
    final dates = _cleanAndGetAdTimestamps();
    final now = DateTime.now();
    if (dates.length >= 12) {
      final oldestAd = dates.first;
      final timeToWait = oldestAd.add(const Duration(hours: 24)).difference(now);
      return '已達每日上限 (12次)，請於 ${timeToWait.inHours} 小時後再試';
    }
    if (dates.isNotEmpty) {
      final lastAd = dates.last;
      final nextAdTime = lastAd.add(const Duration(hours: 1));
      final diffMin = nextAdTime.difference(now).inMinutes;
      if (diffMin > 0) {
        return '看廣告間隔為 1 小時，請等待 $diffMin 分鐘';
      }
    }
    return '';
  }

  static bool isSubscribed() {
    return _settingsBox.get('is_subscribed', defaultValue: false) == true;
  }

  static Future<void> setSubscribed(bool subscribed) async {
    await _settingsBox.put('is_subscribed', subscribed);
  }



  // --- Configuration Box Operations ---
  
  static Box<Map> get _configBox => Hive.box<Map>(configBoxName);

  static Future<void> saveFormConfig(String templateId, Map config) async {
    await _configBox.put(templateId, config);
  }

  static Map? getFormConfig(String templateId) {
    return _configBox.get(templateId);
  }

  static List<String> getAllConfigIds() {
    return _configBox.keys.cast<String>().toList();
  }

  // --- Drafts Box Operations ---

  static Box<Map> get _draftBox => Hive.box<Map>(draftBoxName);

  static Future<void> saveDraft(String draftId, Map draftData) async {
    await _draftBox.put(draftId, draftData);
  }

  static Map? getDraft(String draftId) {
    return _draftBox.get(draftId);
  }

  static List<Map> getAllDrafts() {
    return _draftBox.values.toList();
  }

  static Future<void> deleteDraft(String draftId) async {
    await _draftBox.delete(draftId);
  }

  // --- Sync Queue Operations ---

  static Box<Map> get _syncQueueBox => Hive.box<Map>(syncQueueBoxName);

  /// Add a submission payload to sync queue
  static Future<void> enqueueSubmission(String queueId, Map payload) async {
    await _syncQueueBox.put(queueId, payload);
  }

  static List<Map> getSyncQueue() {
    return _syncQueueBox.values.toList();
  }

  static List<String> getSyncQueueIds() {
    return _syncQueueBox.keys.cast<String>().toList();
  }

  static Future<void> dequeueSubmission(String queueId) async {
    await _syncQueueBox.delete(queueId);
  }

  static int getSyncCount() {
    return _syncQueueBox.length;
  }
}
