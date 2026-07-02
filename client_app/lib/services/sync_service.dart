import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'offline_service.dart';

import '../config/env.dart';

class SyncService {
  static final SyncService _instance = SyncService._internal();
  factory SyncService() => _instance;
  SyncService._internal();

  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  bool _isSyncing = false;
  
  // URL automatically delegates to the centralized environment config
  String get serverBaseUrl => Env.serverBaseUrl;

  // Controller to notify UI about sync events
  final _syncStatusController = StreamController<bool>.broadcast();
  Stream<bool> get syncStatusStream => _syncStatusController.stream;

  final _syncErrorController = StreamController<String>.broadcast();
  Stream<String> get syncErrorStream => _syncErrorController.stream;

  /// Start monitoring connectivity to trigger sync automatically
  void startMonitoring() {
    _connectivitySubscription = Connectivity().onConnectivityChanged.listen((results) {
      if (results.any((result) => result != ConnectivityResult.none)) {
        // We have connection, trigger sync
        triggerSync();
      }
    });
  }

  void dispose() {
    _connectivitySubscription?.cancel();
    _syncStatusController.close();
    _syncErrorController.close();
  }

  /// Manually or automatically trigger the sync queue uploading
  Future<void> triggerSync() async {
    if (_isSyncing) return;
    
    if (kIsWeb) {
      debugPrint('Sync skipped on web platform.');
      return;
    }
    
    final queueIds = OfflineService.getSyncQueueIds();
    if (queueIds.isEmpty) return;

    _isSyncing = true;
    _syncStatusController.add(true);
    debugPrint('Starting sync of ${queueIds.length} forms...');

    for (final id in queueIds) {
      final actualPayload = OfflineService.getSyncQueue().firstWhere((element) => element['id'] == id, orElse: () => {});
      if (actualPayload.isEmpty) continue;
      
      final item = actualPayload;
      final templateId = item['templateId'] as String?;
      final templatePath = item['templatePath'] as String?;
      final dataMap = Map<String, String>.from(item['data'] ?? {});
      final imagesMap = Map<String, String>.from(item['images'] ?? {});

      if (templateId == null || templatePath == null || (kIsWeb == false && !File(templatePath).existsSync())) {
        debugPrint('Template file not found at $templatePath, skipping sync for $id');
        await OfflineService.dequeueSubmission(id);
        continue;
      }

      int statusCode = await _uploadForm(templateId, templatePath, dataMap, imagesMap);
      if (statusCode == 200) {
        debugPrint('Sync successful for form: $id');
        await OfflineService.dequeueSubmission(id);
      } else if (statusCode == 402) {
        debugPrint('Sync failed for form: $id. Insufficient points.');
        _syncErrorController.add('上傳暫停：點數不足！\\n\\n您目前的餘額不足，尚有未上傳的表單卡在手機中，請儘速補充點數以免資料遺失！');
        break; // Stop sync queue
      } else {
        debugPrint('Sync failed for form: $id with status $statusCode. Will retry later.');
        break; // Stop sync queue processing if server is down or error occurs
      }
    }

    _isSyncing = false;
    _syncStatusController.add(false);
  }

  /// Performs the actual HTTP multipart upload to macOS local server
  Future<int> _uploadForm(
    String templateId,
    String templatePath,
    Map<String, String> data,
    Map<String, String> images,
  ) async {
    try {
      final uri = Uri.parse('$serverBaseUrl/api/templates/$templateId/export');
      final request = http.MultipartRequest('POST', uri);

      final token = OfflineService.getUserToken();
      if (token != null) {
        request.headers['Authorization'] = 'Bearer $token';
      }

      // 1. Add Excel template file
      final templateFile = File(templatePath);
      request.files.add(await http.MultipartFile.fromPath('template', templateFile.path));

      // 2. Add text fields data payload as JSON string
      request.fields['data'] = jsonEncode(data);

      // 3. Add images
      for (final entry in images.entries) {
        final imageKey = entry.key;
        final imagePath = entry.value;
        if (File(imagePath).existsSync()) {
          request.files.add(await http.MultipartFile.fromPath(imageKey, imagePath));
        }
      }

      final response = await request.send();
      
      if (response.statusCode == 200) {
        // Successfully exported from backend server.
        // We can save the compiled file locally if needed, e.g. for user viewing.
        final responseBytes = await response.stream.toBytes();
        final exportDir = templateFile.parent.path;
        final outputFile = File('$exportDir/last_compiled_report.xlsx');
        await outputFile.writeAsBytes(responseBytes);
        debugPrint('Compiled report saved to: ${outputFile.path}');
        return 200;
      } else {
        debugPrint('Upload failed with status: ${response.statusCode}');
        return response.statusCode;
      }
    } catch (e) {
      debugPrint('Network sync error: $e');
      return 500;
    }
  }
}
