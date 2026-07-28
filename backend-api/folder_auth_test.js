/**
 * SmartForm Folder 越權存取測試腳本
 * 
 * 驗證 Member 帳號是否能繞過 allowedFolders 限制，存取或操作不屬於自己的資料夾。
 */

const { createClient } = require('@libsql/client');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DB_PATH = process.env.DB_PATH || `file:${path.resolve(__dirname, 'app_data.sqlite')}`;
const client = createClient({ url: DB_PATH });

const TEST_MASTER = 'test_folder_master';
const TEST_MEMBER_A = 'test_folder_member_a'; // 被允許存取 Folder A
const TEST_MEMBER_B = 'test_folder_member_b'; // 被允許存取 Folder B
const FOLDER_A_ID = 'test_folder_a';
const FOLDER_B_ID = 'test_folder_b';
const TEMPLATE_IN_B = 'test_template_in_b';

async function setup() {
  console.log('⚙️  設定測試資料...');
  
  // 清理
  await client.execute({ sql: 'DELETE FROM tokens WHERE token IN (?, ?, ?)', args: [TEST_MASTER, TEST_MEMBER_A, TEST_MEMBER_B] });
  await client.execute({ sql: 'DELETE FROM export_folders WHERE id IN (?, ?)', args: [FOLDER_A_ID, FOLDER_B_ID] });
  await client.execute({ sql: 'DELETE FROM templates WHERE id = ?', args: [TEMPLATE_IN_B] });

  // 建立 Master
  await client.execute({
    sql: 'INSERT INTO tokens (token, data) VALUES (?, ?)',
    args: [TEST_MASTER, JSON.stringify({ token: TEST_MASTER, role: 'master', createdAt: new Date().toISOString() })]
  });

  // 建立 Folders
  await client.execute({
    sql: 'INSERT INTO export_folders (id, masterToken, name, parentId, createdAt) VALUES (?, ?, ?, ?, ?)',
    args: [FOLDER_A_ID, TEST_MASTER, 'Folder A', null, new Date().toISOString()]
  });
  await client.execute({
    sql: 'INSERT INTO export_folders (id, masterToken, name, parentId, createdAt) VALUES (?, ?, ?, ?, ?)',
    args: [FOLDER_B_ID, TEST_MASTER, 'Folder B', null, new Date().toISOString()]
  });

  // 建立 Members
  await client.execute({
    sql: 'INSERT INTO tokens (token, data) VALUES (?, ?)',
    args: [TEST_MEMBER_A, JSON.stringify({ token: TEST_MEMBER_A, role: 'member', masterToken: TEST_MASTER, allowedFolders: [FOLDER_A_ID], createdAt: new Date().toISOString() })]
  });
  await client.execute({
    sql: 'INSERT INTO tokens (token, data) VALUES (?, ?)',
    args: [TEST_MEMBER_B, JSON.stringify({ token: TEST_MEMBER_B, role: 'member', masterToken: TEST_MASTER, allowedFolders: [FOLDER_B_ID], createdAt: new Date().toISOString() })]
  });

  // 建立 Template 在 Folder B
  await client.execute({
    sql: 'INSERT INTO templates (id, data) VALUES (?, ?)',
    args: [TEMPLATE_IN_B, JSON.stringify({ id: TEMPLATE_IN_B, masterToken: TEST_MASTER, folder: FOLDER_B_ID, title: 'Secret in B', config: {}, excelBase64: '', updatedAt: new Date().toISOString() })]
  });

  console.log('  ✔ 測試資料注入完成');
}

async function teardown() {
  console.log('\n🧹 清理測試資料...');
  await client.execute({ sql: 'DELETE FROM tokens WHERE token IN (?, ?, ?)', args: [TEST_MASTER, TEST_MEMBER_A, TEST_MEMBER_B] });
  await client.execute({ sql: 'DELETE FROM export_folders WHERE id IN (?, ?)', args: [FOLDER_A_ID, FOLDER_B_ID] });
  await client.execute({ sql: 'DELETE FROM templates WHERE id = ?', args: [TEMPLATE_IN_B] });
  console.log('  ✔ 清理完成');
}

async function runTest() {
  let passed = 0;
  let failed = 0;

  console.log('\n【測試一】 Member A 嘗試獲取 Folder B 內的範本列表 (GET /api/templates)');
  const res1 = await fetch(`${BASE_URL}/api/templates?token=${TEST_MEMBER_A}`);
  const data1 = await res1.json();
  const hasFolderBTemplate = Array.isArray(data1) && data1.some(t => t.folder === FOLDER_B_ID);
  
  // 原本的 db.getTemplatesForToken() 可能已經有處理 allowedFolders？我們來驗證
  if (!hasFolderBTemplate) {
    console.log('  ✅ PASS: 成功阻擋 Member A 獲取 Folder B 的範本');
    passed++;
  } else {
    console.log(`  ❌ FAIL: Member A 竟然可以獲取 Folder B 的範本!`);
    failed++;
  }

  console.log('\n【測試二】 Member A 嘗試獲取 Folder B 內的已導出檔案列表 (GET /api/exported-files/:folderId)');
  const res2 = await fetch(`${BASE_URL}/api/exported-files/${FOLDER_B_ID}`, {
    headers: { 'Authorization': `Bearer ${TEST_MEMBER_A}` }
  });
  if (res2.status === 403 || res2.status === 401) {
    console.log('  ✅ PASS: 成功阻擋 Member A 讀取 Folder B 的檔案');
    passed++;
  } else {
    console.log(`  ❌ FAIL: Member A 竟然可以讀取 Folder B 的檔案! 狀態碼: ${res2.status}`);
    failed++;
  }

  console.log('\n【測試三】 Member A 嘗試刪除 Folder B (DELETE /api/export-folders/:id)');
  const res3 = await fetch(`${BASE_URL}/api/export-folders/${FOLDER_B_ID}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${TEST_MEMBER_A}` }
  });
  if (res3.status === 403 || res3.status === 401) {
    console.log('  ✅ PASS: 成功阻擋 Member A 刪除 Folder B');
    passed++;
  } else {
    console.log(`  ❌ FAIL: Member A 竟然可以刪除 Folder B! 狀態碼: ${res3.status}`);
    failed++;
  }

  console.log(`\n📊 測試結果: ${passed} 通過 / ${failed} 失敗`);
  return failed === 0;
}

async function main() {
  try {
    await setup();
    const passed = await runTest();
    await teardown();
    process.exit(passed ? 0 : 1);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
main();
