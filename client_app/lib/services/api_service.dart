import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';

import '../config/env.dart';

class ApiService {
  static String get baseUrl => '${Env.serverBaseUrl}/api';
  static String? _token;

  static void setToken(String token) {
    _token = token;
  }

  static Map<String, String> get _headers {
    return {
      'Content-Type': 'application/json',
      if (_token != null) 'Authorization': _token!,
    };
  }

  /// 取得目前點數狀態與訂閱資訊
  static Future<Map<String, dynamic>?> getPointsStatus() async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/points/status'), headers: _headers);
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return null;
    } catch (e) {
      debugPrint('API Error (getPointsStatus): $e');
      return null;
    }
  }

  /// 領取看廣告的獎勵點數
  static Future<Map<String, dynamic>> rewardPoints() async {
    try {
      final response = await http.post(Uri.parse('$baseUrl/points/reward'), headers: _headers);
      return jsonDecode(response.body);
    } catch (e) {
      debugPrint('API Error (rewardPoints): $e');
      return {'success': false, 'error': 'Network error'};
    }
  }

  /// 購買點數
  static Future<Map<String, dynamic>> purchasePoints(int amount) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/points/purchase'),
        headers: _headers,
        body: jsonEncode({'amount': amount}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      debugPrint('API Error (purchasePoints): $e');
      return {'success': false, 'error': 'Network error'};
    }
  }

  /// 扣除點數
  static Future<Map<String, dynamic>> consumePoints(int amount) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/points/consume'),
        headers: _headers,
        body: jsonEncode({'amount': amount}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      debugPrint('API Error (consumePoints): $e');
      return {'success': false, 'error': 'Network error'};
    }
  }

  /// 查詢明細與到期日
  static Future<Map<String, dynamic>?> getPointsLedger() async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/points/ledger'), headers: _headers);
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return null;
    } catch (e) {
      debugPrint('API Error (getPointsLedger): $e');
      return null;
    }
  }
}
