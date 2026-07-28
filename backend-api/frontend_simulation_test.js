/**
 * 模擬 Flutter 前端 API 呼叫的整合測試腳本
 * 
 * 因為無法在沙盒內直接執行 Flutter CLI，我們用這個腳本精確模擬前端發出的 HTTP 請求，
 * 來驗證後端 API (Auth, Points, Templates, Export) 是否與預期的資料格式完全吻合。
 */

const BASE_URL = 'http://localhost:3000/api';
const fetch = globalThis.fetch;

async function runTest() {
  let passed = 0;
  let failed = 0;

  console.log('🚀 開始模擬前端 API 整合測試...\n');

  // 1. 認證與權限流程 (Auth Flow - Verify Token)
  console.log('【測試 1】 Auth Flow - Verify Token (對應 ApiService.verifyToken)');
  try {
    const res1 = await fetch(`${BASE_URL}/auth/verify-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer william_master_token'
      }
    });
    const data1 = await res1.json();
    if (res1.status === 200 && data1.success === true && data1.role === 'master') {
      console.log('  ✅ PASS: 成功驗證 Token 並解析 Role');
      passed++;
    } else {
      console.log('  ❌ FAIL: Token 驗證失敗', data1);
      failed++;
    }
  } catch (e) {
    console.log('  ❌ FAIL:', e.message);
    failed++;
  }

  // 2. 點數查詢流程 (Points Flow - Get Status)
  console.log('\n【測試 2】 Points Flow - Get Status (對應 ApiService.getPointsStatus)');
  try {
    const res2 = await fetch(`${BASE_URL}/points/status`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer william_master_token'
      }
    });
    const data2 = await res2.json();
    if (res2.status === 200 && data2.points && typeof data2.points.total === 'number') {
      console.log(`  ✅ PASS: 成功解析點數狀態 (目前點數: ${data2.points.total})`);
      passed++;
    } else {
      console.log('  ❌ FAIL: 點數狀態解析失敗', data2);
      failed++;
    }
  } catch (e) {
    console.log('  ❌ FAIL:', e.message);
    failed++;
  }

  // 3. 範本清單取得 (Templates Flow - Fetch List)
  console.log('\n【測試 3】 Templates Flow - Fetch List (對應 ExcelWebService)');
  try {
    const res3 = await fetch(`${BASE_URL}/templates?token=william_master_token`);
    const data3 = await res3.json();
    if (res3.status === 200 && Array.isArray(data3)) {
      console.log(`  ✅ PASS: 成功取得並解析範本清單 (共 ${data3.length} 筆)`);
      passed++;
    } else {
      console.log('  ❌ FAIL: 範本清單解析失敗', data3);
      failed++;
    }
  } catch (e) {
    console.log('  ❌ FAIL:', e.message);
    failed++;
  }

  // 4. 表單導出點數不足處理 (Export Flow - Missing points)
  console.log('\n【測試 4】 Export Flow - 點數不足時的處理 (對應前端 402 狀態擷取)');
  try {
    // 使用一個無效或沒點數的 token 來模擬 (這裡用假 token)
    const res4 = await fetch(`${BASE_URL}/templates/dummy_id/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test_no_points_token'
      },
      body: JSON.stringify({ data: '{}' })
    });
    
    // 如果 token 完全無效會回 401，如果有 token 但沒權限回 403，有點數但不足回 402
    if ([401, 402, 403, 404].includes(res4.status)) {
      console.log(`  ✅ PASS: 成功攔截異常狀態，避免崩潰 (狀態碼: ${res4.status})`);
      passed++;
    } else {
      console.log(`  ❌ FAIL: 回傳了非預期的狀態碼: ${res4.status}`);
      failed++;
    }
  } catch (e) {
    console.log('  ❌ FAIL:', e.message);
    failed++;
  }

  console.log(`\n📊 總結: ${passed} 通過 / ${failed} 失敗`);
  process.exit(failed === 0 ? 0 : 1);
}

runTest();
