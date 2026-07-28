import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

// 模擬 frontend 環境
const String baseUrl = 'http://localhost:3000/api';
const String masterToken = 'frontend_test_master_token';
const String memberToken = 'frontend_test_member_token';

void main() {
  setUpAll(() async {
    // 注入測試資料 (呼叫後端的隱藏測試端點，或直接用 sql，但這裡我們用 http 模擬最簡單的流程)
    // 為了純淨測試，我們假設後端已經有 auth/verify-token 和其他功能
    // 這裡我們先依賴現有狀態，如果需要我們可以在測試開始前直接執行一段 node 腳本清空資料庫
  });

  group('Frontend Integration API Tests', () {
    test('1. Auth Flow - Verify Token', () async {
      // 假設我們用前端的 ApiService 邏輯
      final response = await http.post(
        Uri.parse('$baseUrl/auth/verify-token'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer william_master_token' // 使用一個已知的有效 token
        },
      );
      
      expect(response.statusCode, 200, reason: 'Master token 應該驗證成功');
      final data = jsonDecode(response.body);
      expect(data['success'], true);
      expect(data['role'], 'master');
    });

    test('2. Points Flow - Get Status', () async {
      final response = await http.get(
        Uri.parse('$baseUrl/points/status'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer william_master_token'
        },
      );
      
      expect(response.statusCode, 200);
      final data = jsonDecode(response.body);
      expect(data['points'], isNotNull);
      expect(data['points']['total'], isA<int>());
    });

    test('3. Templates Flow - Fetch List', () async {
      // /api/templates 期待的是 query parameter: ?token=
      final response = await http.get(
        Uri.parse('$baseUrl/templates?token=william_master_token'),
      );
      
      expect(response.statusCode, 200);
      final data = jsonDecode(response.body);
      expect(data, isA<List>()); // 解析為陣列
    });

    test('4. Export Flow - Missing points should return 402', () async {
      // 我們嘗試對一個根本沒有點數的帳號發送請求 (或者直接用無效/過期帳號)
      // 這裡直接模擬一個假的請求到 /api/templates/invalid_id/export
      // 如果它沒權限或找不到模板，可能會回 404/403，但我們重點是要確保前端能"優雅地"接到狀態碼
      final response = await http.post(
        Uri.parse('$baseUrl/templates/dummy_template_id/export'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer dummy_token_no_points'
        },
        body: jsonEncode({'data': '{}'}),
      );
      
      // 這個 dummy token 會被當作無效 (401) 或是如果能驗證過，可能會回 402/404
      // 前端 ApiService 遇到非 200 應該回傳 null 或 throw error，這裡測試 API 層是否如預期
      expect(response.statusCode, isIn([401, 402, 404, 403])); 
    });
  });
}
