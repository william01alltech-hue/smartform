/**
 * SmartForm 並發點數安全測試腳本（Race Condition 驗證）
 * 
 * 驗證修復 #67 後，高並發環境下的點數扣除是否安全。
 * 情境：帳號只有 5 點，但同時發起 50 個扣點請求。
 * 預期：剛好 5 個成功，45 個失敗 (402)，最後餘額為 0。
 */

const { createClient } = require('@libsql/client');
const ExcelJS = require('exceljs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DB_PATH = process.env.DB_PATH || `file:${path.resolve(__dirname, 'app_data.sqlite')}`;
const client = createClient({ url: DB_PATH });

const TEST_TOKEN = 'test_race_condition_token';
const TEST_TEMPLATE_ID = 'test_race_template_001';
const STARTING_POINTS = 5;
const CONCURRENT_REQUESTS = 50;

async function createMinimalExcel() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.getCell('A1').value = 'Test';
  return await wb.xlsx.writeBuffer();
}

async function setup() {
  console.log('⚙️  設定測試資料...');
  
  // 清理可能殘留的資料
  await client.execute({ sql: 'DELETE FROM tokens WHERE token = ?', args: [TEST_TOKEN] });
  await client.execute({ sql: 'DELETE FROM templates WHERE id = ?', args: [TEST_TEMPLATE_ID] });

  // 建立有 5 點的帳號
  const now = Date.now();
  const future = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
  
  const tokenInfo = {
    token: TEST_TOKEN,
    role: 'master',
    createdAt: new Date().toISOString(),
    subscriptionPlan: 'personal_ad', // 免費方案，不會吃到飽
    trialExpiresAt: new Date(now - 10000).toISOString(), // 試用期已過
    pointLedger: [
      { amount: STARTING_POINTS, type: 'paid', createdAt: new Date().toISOString(), expiresAt: future }
    ]
  };

  await client.execute({
    sql: 'INSERT INTO tokens (token, data) VALUES (?, ?)',
    args: [TEST_TOKEN, JSON.stringify(tokenInfo)]
  });

  // 建立測試模板
  const excelBuf = await createMinimalExcel();
  const excelBase64 = Buffer.from(excelBuf).toString('base64');
  const template = {
    id: TEST_TEMPLATE_ID,
    masterToken: TEST_TOKEN,
    title: 'Race Condition Test Template',
    config: { fields: [] }, // 空 config 避免 fillTemplate 錯誤
    excelBase64,
    updatedAt: new Date().toISOString(),
    folder: '',
    pages: 1, // 每次消耗 1 點
  };

  await client.execute({
    sql: 'INSERT INTO templates (id, data) VALUES (?, ?)',
    args: [TEST_TEMPLATE_ID, JSON.stringify(template)]
  });

  console.log(`  ✔ 已建立帳號 ${TEST_TOKEN}，初始點數: ${STARTING_POINTS}`);
}

async function teardown() {
  console.log('\n🧹 清理測試資料...');
  await client.execute({ sql: 'DELETE FROM tokens WHERE token = ?', args: [TEST_TOKEN] });
  await client.execute({ sql: 'DELETE FROM templates WHERE id = ?', args: [TEST_TEMPLATE_ID] });
  console.log('  ✔ 清理完成');
}

async function runTest() {
  console.log(`\n🚀 開始發送 ${CONCURRENT_REQUESTS} 個並發請求...`);
  
  const exportUrl = `${BASE_URL}/api/templates/${TEST_TEMPLATE_ID}/export`;
  const formBody = JSON.stringify({ data: '{}' });

  // 建立 50 個 Promise 同時發送
  const requests = Array.from({ length: CONCURRENT_REQUESTS }).map(() => {
    return fetch(exportUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: formBody
    }).then(res => res.status).catch(err => `Error: ${err.message}`);
  });

  const results = await Promise.all(requests);
  
  // 統計結果
  const successCount = results.filter(status => status === 200).length;
  const insufficientPointsCount = results.filter(status => status === 402).length;
  const otherCount = results.length - successCount - insufficientPointsCount;

  console.log('\n📊 請求結果統計：');
  console.log(`   成功 (200 OK): ${successCount}`);
  console.log(`   點數不足 (402): ${insufficientPointsCount}`);
  if (otherCount > 0) {
    console.log(`   其他狀態/錯誤: ${otherCount}`);
    console.log(results.filter(s => s !== 200 && s !== 402));
  }

  // 驗證最終點數
  const tokenRes = await fetch(`${BASE_URL}/api/points/status`, {
    headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
  });
  const tokenData = await tokenRes.json();
  const finalPoints = tokenData.points?.total;

  console.log('\n💰 最終點數餘額：', finalPoints);

  // 判斷是否通過
  let passed = true;
  if (successCount !== STARTING_POINTS) {
    console.log(`\n❌ 失敗：成功次數 (${successCount}) 不等於初始點數 (${STARTING_POINTS})，存在 Race Condition！`);
    passed = false;
  }
  if (finalPoints !== 0) {
    console.log(`\n❌ 失敗：最終點數 (${finalPoints}) 不為 0！`);
    passed = false;
  }

  if (passed) {
    console.log('\n✅ 測試通過！#67 的修復有效，高並發下點數扣除完全安全。');
  }
  
  return passed;
}

async function main() {
  try {
    await setup();
    const passed = await runTest();
    await teardown();
    process.exit(passed ? 0 : 1);
  } catch (err) {
    console.error('執行錯誤:', err);
    process.exit(1);
  }
}

main();
