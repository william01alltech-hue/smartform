import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:http/http.dart' as http;
import 'l10n/app_localizations.dart';
import 'services/offline_service.dart';
import 'services/sync_service.dart';
import 'services/ad_service.dart';
import 'utils/downloader.dart';
import 'widgets/dynamic_form_screen.dart';
import 'widgets/ad_banner_widget.dart';
import 'widgets/account_panel.dart';


void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Google Mobile Ads
  if (!kIsWeb) {
    await AdService.initialize();
  }
  
  // Initialize Offline Database Box store
  await OfflineService.init();
  
  // Start background connectivity observer
  SyncService().startMonitoring();


  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  static void setLocale(BuildContext context, Locale newLocale) {
    _MyAppState? state = context.findAncestorStateOfType<_MyAppState>();
    state?.changeLocale(newLocale);
  }

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  Locale _locale = const Locale('zh', 'TW');

  void changeLocale(Locale locale) {
    setState(() {
      _locale = locale;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '智表通 SmartForm',
      debugShowCheckedModeBanner: false,
      locale: _locale,
      localizationsDelegates: [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('zh', 'TW'), // Traditional Chinese
        Locale('zh', 'CN'), // Simplified Chinese
        Locale('en'),       // English
        Locale('vi'),       // Vietnamese
        Locale('id'),       // Indonesian
        Locale('th'),       // Thai
        Locale('ja'),       // Japanese
        Locale('ko'),       // Korean
        Locale('es'),       // Spanish
        Locale('fr'),       // French
        Locale('de'),       // German
        Locale('pt'),       // Portuguese
        Locale('ru'),       // Russian
        Locale('ar'),       // Arabic
      ],
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF0F172A), // Slate 900
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6366F1), // Indigo 500
          brightness: Brightness.dark,
          primary: const Color(0xFF6366F1),
          secondary: const Color(0xFF10B981), // Emerald 500
        ),
      ),
      home: const MyHomePage(),
    );
  }
}

class MyHomePage extends StatefulWidget {
  const MyHomePage({super.key});

  @override
  State<MyHomePage> createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  bool _isOnline = true;
  int _pendingSyncCount = 0;
  List<Map> _drafts = [];




  @override
  void initState() {
    super.initState();
    _refreshSyncData();
    // Monitor server sync status
    SyncService().syncStatusStream.listen((isSyncing) {
      if (!isSyncing) {
        _refreshSyncData();
      }
    });

    SyncService().syncErrorStream.listen((errorMsg) {
      if (mounted) {
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('⚠️ 上傳暫停：點數不足！', style: TextStyle(color: Colors.red)),
            content: Text(errorMsg),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('我知道了'),
              )
            ],
          ),
        );
      }
    });

    // Removed legacy _checkTrialStatus call

  }



  void _downloadExcelReport(String format) async {
    if (kIsWeb) {
      final queue = OfflineService.getSyncQueue();
      if (queue.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('沒有待處理的表單可以匯出！')),
        );
        return;
      }
      
      final item = queue.first;
      final templateId = item['templateId'] as String?;
      if (templateId == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('無法取得範本 ID，無法匯出。')),
        );
        return;
      }

      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => const Center(child: CircularProgressIndicator()),
      );

      try {
        final token = OfflineService.getUserToken();
        final baseUrl = SyncService().serverBaseUrl;
        final uri = Uri.parse('$baseUrl/api/templates/$templateId/export?format=$format');
        final request = http.MultipartRequest('POST', uri);
        if (token != null) {
          request.headers['Authorization'] = 'Bearer $token';
        }
        
        final dataMap = Map<String, String>.from(item['data'] ?? {});
        request.fields['data'] = jsonEncode(dataMap);
        
        final fieldsMap = item['fields'] ?? [];
        request.fields['fields'] = jsonEncode(fieldsMap);

        // Upload images if any
        final imagesMap = Map<String, String>.from(item['images'] ?? {});
        for (var entry in imagesMap.entries) {
          final fileBytes = await http.readBytes(Uri.parse(entry.value)); // On web, this might be a blob url or local path, but actually picking images on web yields blob URLs. We can fetch them.
          request.files.add(http.MultipartFile.fromBytes(entry.key, fileBytes, filename: '${entry.key}.jpg'));
        }

        final response = await request.send();
        
        if (response.statusCode == 402) {
          final bodyStr = await response.stream.bytesToString();
          int requiredPoints = 1;
          try {
            final jsonBody = jsonDecode(bodyStr);
            if (jsonBody['requiredPoints'] != null) {
              requiredPoints = jsonBody['requiredPoints'];
            }
          } catch (_) {}

          if (mounted) Navigator.of(context).pop(); // Close loading dialog
          if (mounted) {
            showDialog(
              context: context,
              builder: (ctx) => AlertDialog(
                title: const Text('點數不足'),
                content: Text('您需要 $requiredPoints 點才能匯出此表單。\n請至首頁右上角的「帳戶」購買金幣或觀看廣告獲取點數！'),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.of(ctx).pop(),
                    child: const Text('我知道了'),
                  )
                ],
              ),
            );
          }
          return;
        }

        if (response.statusCode == 200) {
          final bytes = await response.stream.toBytes();
          final filename = format == 'pdf' 
              ? 'compiled_report_$templateId.pdf' 
              : 'compiled_report_$templateId.xlsx';
          downloadFileWeb(bytes.toList(), filename);
          
          // Successfully exported, remove from queue
          final itemId = item['id'] as String?;
          if (itemId != null) {
            await OfflineService.dequeueSubmission(itemId);
          }
          
          if (mounted) Navigator.of(context).pop(); // Close loading dialog
          if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('下載成功！')));
          _refreshSyncData();
        } else if (response.statusCode == 404) {
          // Template not found on server, remove from queue so it doesn't block future exports
          final itemId = item['id'] as String?;
          if (itemId != null) {
            await OfflineService.dequeueSubmission(itemId);
          }
          throw Exception('伺服器找不到該範本 (404)，已將此無效表單從序列移除。請重新填寫最新的表單！');
        } else {
          throw Exception('伺服器錯誤 ${response.statusCode}');
        }
      } catch (e) {
        if (mounted) Navigator.of(context).pop();
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('匯出失敗：$e')));
        _refreshSyncData();
      }
      return;
    }

    // MacOS Mockup
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF1E293B),
          title: const Row(
            children: [
              Icon(Icons.check_circle, color: Colors.green),
              SizedBox(width: 8),
              Text('下載成功', style: TextStyle(color: Colors.white)),
            ],
          ),
          content: Text(
            '已成功扣除 1 點金幣/點數！\n\n最新的表單報告已匯出並儲存至：\n/Users/william/Desktop/last_compiled_report.${format == 'pdf' ? 'pdf' : 'xlsx'}',
            style: const TextStyle(color: Colors.white70, height: 1.4),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('確定'),
            )
          ],
        );
      },
    );
  }

  void _refreshSyncData() {
    setState(() {
      _pendingSyncCount = OfflineService.getSyncCount();
      _drafts = OfflineService.getAllDrafts();
    });
  }

  void _toggleNetwork() {
    setState(() {
      _isOnline = !_isOnline;
    });
    if (_isOnline) {
      // Simulate trigger sync when online
      SyncService().triggerSync();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final primaryColor = Theme.of(context).colorScheme.primary;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        title: Text(
          l10n.homeTitle,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 22),
        ),
        actions: [
          PopupMenuButton<Locale>(
            icon: const Icon(Icons.language, color: Colors.white),
            tooltip: l10n.selectLanguage,
            onSelected: (Locale locale) {
              MyApp.setLocale(context, locale);
            },
            itemBuilder: (BuildContext context) => <PopupMenuEntry<Locale>>[
              const PopupMenuItem<Locale>(
                value: Locale('zh', 'TW'),
                child: Text('繁體中文 (zh-TW)'),
              ),
              const PopupMenuItem<Locale>(
                value: Locale('en'),
                child: Text('English (en-US)'),
              ),
              const PopupMenuItem<Locale>(
                value: Locale('zh', 'CN'),
                child: Text('简体中文 (zh-CN)'),
              ),
              const PopupMenuItem<Locale>(
                value: Locale('vi'),
                child: Text('Tiếng Việt (vi-VN)'),
              ),
              const PopupMenuItem<Locale>(
                value: Locale('id'),
                child: Text('Bahasa Indonesia (id-ID)'),
              ),
              const PopupMenuItem<Locale>(
                value: Locale('th'),
                child: Text('ไทย (th-TH)'),
              ),
              const PopupMenuItem<Locale>(
                value: Locale('ja'),
                child: Text('日本語 (ja-JP)'),
              ),
              const PopupMenuItem<Locale>(
                value: Locale('ko'),
                child: Text('한국어 (ko-KR)'),
              ),
              const PopupMenuItem<Locale>(
                value: Locale('es'),
                child: Text('Español (es-ES)'),
              ),
              const PopupMenuItem<Locale>(
                value: Locale('fr'),
                child: Text('Français (fr-FR)'),
              ),
              const PopupMenuItem<Locale>(
                value: Locale('de'),
                child: Text('Deutsch (de-DE)'),
              ),
              const PopupMenuItem<Locale>(
                value: Locale('pt'),
                child: Text('Português (pt-BR)'),
              ),
              const PopupMenuItem<Locale>(
                value: Locale('ru'),
                child: Text('Русский (ru-RU)'),
              ),
              const PopupMenuItem<Locale>(
                value: Locale('ar'),
                child: Text('العربية (ar-SA)'),
              ),
            ],
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [

            // Network & Sync status panel (Glassmorphism design style)
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: _isOnline
                      ? [primaryColor.withValues(alpha: 0.15), const Color(0xFF1E293B)]
                      : [Colors.orange.withValues(alpha: 0.15), const Color(0xFF1E293B)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: _isOnline ? primaryColor.withValues(alpha: 0.3) : Colors.orange.withValues(alpha: 0.3),
                  width: 1.5,
                ),
              ),
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        l10n.syncStatus,
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: Colors.white70),
                      ),
                      Row(
                        children: [
                          Icon(
                            _isOnline ? Icons.wifi : Icons.wifi_off,
                            color: _isOnline ? const Color(0xFF10B981) : Colors.orange,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _isOnline ? l10n.online : l10n.offline,
                            style: TextStyle(
                              color: _isOnline ? const Color(0xFF10B981) : Colors.orange,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      )
                    ],
                  ),
                  const Divider(color: Colors.white24, height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        l10n.syncPending(_pendingSyncCount),
                        style: const TextStyle(fontSize: 16, color: Colors.white70),
                      ),
                      ElevatedButton.icon(
                        onPressed: _toggleNetwork,
                        icon: Icon(_isOnline ? Icons.cloud_queue : Icons.cloud_off, size: 18),
                        label: Text(_isOnline ? '模擬離線' : '切換為線上模式'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _isOnline ? Colors.redAccent.withValues(alpha: 0.8) : const Color(0xFF10B981),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      )
                    ],
                  ),
                  const Divider(color: Colors.white24, height: 24),

                ],
              ),
            ),
            const SizedBox(height: 16),
            AccountPanel(
              onStateChanged: () {
                _refreshSyncData();
              },
            ),
            const SizedBox(height: 24),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  '本地草稿清單',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                IconButton(
                  icon: const Icon(Icons.refresh),
                  onPressed: _refreshSyncData,
                )
              ],
            ),
            const SizedBox(height: 12),
            // Draft list
            if (_drafts.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 32.0),
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.description_outlined, size: 64, color: Colors.white24),
                      const SizedBox(height: 16),
                      Text(l10n.noForms, style: const TextStyle(color: Colors.white30, fontSize: 16)),
                    ],
                  ),
                ),
              )
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _drafts.length,
                itemBuilder: (context, index) {
                  final draft = _drafts[index];
                  final fields = draft['fields'] as Map? ?? {};
                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: primaryColor.withValues(alpha: 0.2),
                        child: Icon(Icons.edit, color: primaryColor),
                      ),
                      title: Text(draft['title'] ?? '無標題'),
                      subtitle: Text('督導員: ${fields['Inspector_Name'] ?? '無'}  |  日期: ${fields['Inspection_Date'] ?? '無'}'),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete_outline, color: Colors.redAccent),
                        onPressed: () async {
                          final id = draft['id'] as String;
                          await OfflineService.deleteDraft(id);
                          await OfflineService.dequeueSubmission(id);
                          _refreshSyncData();
                        },
                      ),
                    ),
                  );
                },
              ),
            const SizedBox(height: 16),
            Card(
              color: const Color(0xFF1E293B),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    const Text(
                      '匯出已送出的報表檔案',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () => _downloadExcelReport('pdf'),
                            icon: const Icon(Icons.picture_as_pdf, color: Colors.white),
                            label: const Text('下載 PDF', style: TextStyle(fontSize: 13)),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFE11D48),
                              foregroundColor: Colors.white,
                              minimumSize: const Size.fromHeight(48),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () => _downloadExcelReport('excel'),
                            icon: const Icon(Icons.table_chart, color: Colors.white),
                            label: const Text('下載 Excel', style: TextStyle(fontSize: 13)),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF10B981),
                              foregroundColor: Colors.white,
                              minimumSize: const Size.fromHeight(48),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            if (OfflineService.getUserRole() == 'master' || OfflineService.isSubaccount()) ...[
              (() {
                final syncedTemplates = OfflineService.getSyncedTemplates();
                if (syncedTemplates.isEmpty) {
                  return Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.amber.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
                    ),
                    child: const Column(
                      children: [
                        Icon(Icons.warning_amber_rounded, color: Colors.amber, size: 36),
                        SizedBox(height: 8),
                        Text(
                          '目前尚未同步任何雲端表單範本！',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                        ),
                        SizedBox(height: 4),
                        Text(
                          '請先點擊上方「同步雲端表單範本」進行下載。',
                          style: TextStyle(color: Colors.white70, fontSize: 12),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  );
                }

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Padding(
                      padding: EdgeInsets.only(bottom: 8.0, left: 4.0),
                      child: Text(
                        '選擇雲端同步表單填寫：',
                        style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                    ),
                    ...(() {
                      final Map<String, List<Map>> grouped = {};
                      for (final t in syncedTemplates) {
                        final folderStr = t['folder']?.toString().trim() ?? '';
                        final folderName = folderStr.isEmpty ? '未分類' : folderStr;
                        grouped.putIfAbsent(folderName, () => []).add(t);
                      }
                      
                      return grouped.entries.map((entry) {
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 8.0),
                          child: Container(
                            decoration: BoxDecoration(
                              color: Colors.indigo.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.indigo.withValues(alpha: 0.4)),
                            ),
                            child: Theme(
                              data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                              child: ExpansionTile(
                                initiallyExpanded: true,
                                iconColor: Colors.white,
                                collapsedIconColor: Colors.white70,
                                title: Text(
                                  '📁 ${entry.key}',
                                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                                ),
                                children: [
                                  Padding(
                                    padding: const EdgeInsets.only(left: 12, right: 12, bottom: 12),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.stretch,
                                      children: entry.value.map((template) {
                                        return Padding(
                                          padding: const EdgeInsets.only(bottom: 8.0),
                                          child: ElevatedButton.icon(
                                            onPressed: () {
                                              Navigator.of(context).push(
                                                MaterialPageRoute(
                                                  builder: (context) => DynamicFormScreen(
                                                    formConfig: Map<String, dynamic>.from(template['config']),
                                                    templatePath: template['localExcelPath'] as String,
                                                    templateId: template['id'] as String,
                                                  ),
                                                ),
                                              ).then((_) => _refreshSyncData());
                                            },
                                            icon: const Icon(Icons.cloud_download, size: 20),
                                            label: Text(
                                              template['title'] ?? '未命名表單',
                                              style: const TextStyle(fontWeight: FontWeight.bold),
                                            ),
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: Colors.indigo,
                                              foregroundColor: Colors.white,
                                              padding: const EdgeInsets.symmetric(vertical: 14),
                                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                            ),
                                          ),
                                        );
                                      }).toList(),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      });
                    })(),
                  ],
                );
              })()
            ] else ...[
              ElevatedButton(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (context) => const DynamicFormScreen(
                        templateId: 'local_default',
                        formConfig: {
                          "title": "工地表單檢驗",
                          "fields": [
                            {
                              "name": "name",
                              "type": "text",
                              "label": "姓名",
                              "sheetName": "工作表2",
                              "rangeStr": "工作表2!\$B\$2",
                              "widthPx": 360,
                              "heightPx": 60,
                              "aspectRatio": 1.3333,
                              "resolutionTag": "medium",
                              "required": true
                            },
                            {
                              "name": "birthday",
                              "type": "date",
                              "label": "生日",
                              "sheetName": "工作表2",
                              "rangeStr": "工作表2!\$B\$3",
                              "widthPx": 360,
                              "heightPx": 60,
                              "aspectRatio": 1.3333,
                              "resolutionTag": "medium",
                              "required": true
                            },
                            {
                              "name": "phone",
                              "type": "tel",
                              "label": "電話",
                              "sheetName": "工作表2",
                              "rangeStr": "工作表2!\$B\$4",
                              "widthPx": 360,
                              "heightPx": 60,
                              "aspectRatio": 1.3333,
                              "resolutionTag": "medium",
                              "required": true
                            },
                            {
                              "name": "mobile",
                              "type": "mobile",
                              "label": "手機",
                              "sheetName": "工作表2",
                              "rangeStr": "工作表2!\$B\$6",
                              "widthPx": 360,
                              "heightPx": 60,
                              "aspectRatio": 1.3333,
                              "resolutionTag": "medium",
                              "required": true
                            },
                            {
                              "name": "photo 1",
                              "type": "image",
                              "label": "相片",
                              "sheetName": "工作表2",
                              "rangeStr": "工作表2!\$B\$5",
                              "widthPx": 360,
                              "heightPx": 60,
                              "aspectRatio": 1.3333,
                              "resolutionTag": "medium",
                              "required": true
                            }
                          ]
                        },
                        templatePath: "/Users/william/Desktop/個人資料.xlsx",
                      ),
                    ),
                  ).then((_) => _refreshSyncData());
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryColor,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 4,
                ),
                child: const Text(
                  '填寫新工地表單 (動態 UI 範例)',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
            ],

            const SizedBox(height: 16),
            const AdBannerWidget(),
          ],
        ),
        ),
      ),
    );
  }
}
