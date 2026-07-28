/**
 * SmartForm 商業邏輯整合測試腳本
 *
 * 測試所有計費與權限關鍵情境（需要後端伺服器在 localhost:3000 運行）
 *
 * 使用方式：
 *   MASTER_TOKEN=william_master_token DISABLE_RATE_LIMIT=true npm run dev
 *   （另一個終端）node integration_test.js
 */

const { createClient } = require('@libsql/client');
const ExcelJS = require('exceljs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SUPER_ADMIN_TOKEN = process.env.MASTER_TOKEN || 'william_master_token';
// 使用絕對路徑確保不論從哪個目錄執行都指向正確的 DB 檔案
const DB_PATH = process.env.DB_PATH || `file:${path.resolve(__dirname, 'app_data.sqlite')}`;

// ── 直接連接本地 SQLite 進行測試資料注入 ──────────────────
const client = createClient({ url: DB_PATH });

// ── 測試計數器 ──────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

// ── 工具函式 ────────────────────────────────────────────────

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${label}${detail ? ` → ${detail}` : ''}`);
    failed++;
    failures.push({ label, detail });
  }
}

async function apiGet(path, token) {
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function apiPost(path, token, body) {
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const resBody = await res.json().catch(() => ({}));
  return { status: res.status, body: resBody };
}

async function apiPostForm(path, token, formData) {
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  });
  const resBody = await res.json().catch(() => ({}));
  return { status: res.status, body: resBody };
}

// ── 直接注入測試 token 到 SQLite ───────────────────────────
async function injectToken(info) {
  await client.execute({
    sql: 'INSERT OR REPLACE INTO tokens (token, data) VALUES (?, ?)',
    args: [info.token, JSON.stringify(info)],
  });
}

async function deleteToken(token) {
  await client.execute({
    sql: 'DELETE FROM tokens WHERE token = ?',
    args: [token],
  });
}

async function deleteTemplate(id) {
  await client.execute({
    sql: 'DELETE FROM templates WHERE id = ?',
    args: [id],
  });
}

// ── 建立最小 xlsx 檔案 Buffer ──────────────────────────────
async function createMinimalExcel() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.getCell('A1').value = '姓名';
  ws.getCell('B1').value = '日期';
  return await wb.xlsx.writeBuffer();
}

// ══════════════════════════════════════════════════════════════
//  測試情境定義
// ══════════════════════════════════════════════════════════════

const NOW = Date.now();
const PAST = new Date(NOW - 60 * 24 * 60 * 60 * 1000).toISOString();       // 60 天前（已過期）
const FUTURE = new Date(NOW + 30 * 24 * 60 * 60 * 1000).toISOString();      // 30 天後（有效）

const TEST_TOKENS = {
  // 超級管理員（由 env 設定，應永遠吃到飽）
  superAdmin: SUPER_ADMIN_TOKEN,

  // 一般 Master：試用期內（14 天試用，仍有效）
  trialMaster: 'test_trial_master',

  // 一般 Master：試用已過期、無付費訂閱（免費帳號）
  freeMaster: 'test_free_master',

  // 一般 Master：有有效的 enterprise_5 付費訂閱
  paidMaster: 'test_paid_master',

  // 一般 Master：曾有訂閱但已過期
  expiredMaster: 'test_expired_master',

  // Member：隸屬於 paidMaster（應可繼承吃到飽）
  memberOfPaid: 'test_member_of_paid',

  // Member：隸屬於 expiredMaster（#74 修復點：不應繼承吃到飽）
  memberOfExpired: 'test_member_of_expired',

  // Master：點數充足（10 點）
  withPoints: 'test_master_with_points',

  // Master：點數為 0
  noPoints: 'test_master_no_points',
};

const TEST_TEMPLATE_ID = 'test_integration_template_001';

// ══════════════════════════════════════════════════════════════
//  Setup：注入測試資料
// ══════════════════════════════════════════════════════════════

async function setup() {
  console.log('\n⚙️  設定測試資料...');

  // 試用期內的 Master
  await injectToken({
    token: TEST_TOKENS.trialMaster,
    role: 'master',
    createdAt: new Date().toISOString(),
    subscriptionPlan: 'personal_ad',
    trialExpiresAt: FUTURE,
    pointLedger: [],
  });

  // 免費 Master（試用已過期）
  await injectToken({
    token: TEST_TOKENS.freeMaster,
    role: 'master',
    createdAt: new Date().toISOString(),
    subscriptionPlan: 'personal_ad',
    trialExpiresAt: PAST,
    pointLedger: [],
  });

  // 有效付費 Master
  await injectToken({
    token: TEST_TOKENS.paidMaster,
    role: 'master',
    createdAt: new Date().toISOString(),
    subscriptionPlan: 'enterprise_5',
    subscriptionExpiresAt: FUTURE,
    trialExpiresAt: PAST,
    pointLedger: [],
  });

  // 已過期 Master
  await injectToken({
    token: TEST_TOKENS.expiredMaster,
    role: 'master',
    createdAt: new Date().toISOString(),
    subscriptionPlan: 'enterprise_5',
    subscriptionExpiresAt: PAST,
    trialExpiresAt: PAST,
    pointLedger: [],
  });

  // Member of paid master
  await injectToken({
    token: TEST_TOKENS.memberOfPaid,
    role: 'member',
    masterToken: TEST_TOKENS.paidMaster,
    createdAt: new Date().toISOString(),
    pointLedger: [],
  });

  // Member of expired master（#74 重點測試對象）
  await injectToken({
    token: TEST_TOKENS.memberOfExpired,
    role: 'member',
    masterToken: TEST_TOKENS.expiredMaster,
    createdAt: new Date().toISOString(),
    pointLedger: [],
  });

  // Master with 10 points
  await injectToken({
    token: TEST_TOKENS.withPoints,
    role: 'master',
    createdAt: new Date().toISOString(),
    subscriptionPlan: 'personal_ad',
    trialExpiresAt: PAST,
    pointLedger: [
      { amount: 10, type: 'paid', createdAt: new Date().toISOString(), expiresAt: FUTURE },
    ],
  });

  // Master with 0 points
  await injectToken({
    token: TEST_TOKENS.noPoints,
    role: 'master',
    createdAt: new Date().toISOString(),
    subscriptionPlan: 'personal_ad',
    trialExpiresAt: PAST,
    pointLedger: [],
  });

  // 建立測試模板（直接寫入 DB，因 save API 需要 master token 且 capacity 限制）
  const excelBuf = await createMinimalExcel();
  const excelBase64 = Buffer.from(excelBuf).toString('base64');
  const template = {
    id: TEST_TEMPLATE_ID,
    masterToken: SUPER_ADMIN_TOKEN,  // 歸屬於超級管理員，所有有 access 的 token 都能導出
    title: '整合測試用範本',
    config: { fields: [{ name: 'name', type: 'text', label: '姓名', required: true }] },
    excelBase64,
    updatedAt: new Date().toISOString(),
    folder: '',
    pages: 1,
  };
  await client.execute({
    sql: 'INSERT OR REPLACE INTO templates (id, data) VALUES (?, ?)',
    args: [TEST_TEMPLATE_ID, JSON.stringify(template)],
  });

  console.log('  ✔ 測試資料注入完成\n');
}

// ══════════════════════════════════════════════════════════════
//  Teardown：清理測試資料
// ══════════════════════════════════════════════════════════════

async function teardown() {
  console.log('\n🧹 清理測試資料...');
  for (const token of Object.values(TEST_TOKENS)) {
    if (token !== SUPER_ADMIN_TOKEN) await deleteToken(token);
  }
  await deleteTemplate(TEST_TEMPLATE_ID);
  console.log('  ✔ 清理完成\n');
}

// ══════════════════════════════════════════════════════════════
//  實際測試案例
// ══════════════════════════════════════════════════════════════

async function runTests() {
  const exportUrl = `/api/templates/${TEST_TEMPLATE_ID}/export`;
  const formBody = JSON.stringify({ data: JSON.stringify({ name: '測試員工' }) });

  // ── Section A：鑑權基礎 ──────────────────────────────────
  console.log('\n【A】鑑權基礎測試');

  let r = await fetch(`${BASE_URL}${exportUrl}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: formBody });
  assert('A1 無 Token → 401', r.status === 401, `得到 ${r.status}`);

  r = await fetch(`${BASE_URL}${exportUrl}`, { method: 'POST', headers: { 'Authorization': 'Bearer invalid_fake_token_xyz', 'Content-Type': 'application/json' }, body: formBody });
  assert('A2 無效 Token → 401', r.status === 401, `得到 ${r.status}`);

  // ── Section B：超級管理員 ──────────────────────────────────
  console.log('\n【B】超級管理員測試');

  r = await fetch(`${BASE_URL}${exportUrl}`, { method: 'POST', headers: { 'Authorization': `Bearer ${TEST_TOKENS.superAdmin}`, 'Content-Type': 'application/json' }, body: formBody });
  assert('B1 超級管理員導出 → 成功 (2xx)', r.status >= 200 && r.status < 300, `得到 ${r.status}`);

  // ── Section C：Master 訂閱狀態 ────────────────────────────
  console.log('\n【C】Master 訂閱狀態測試');

  // C1: 試用期內 Master - 但 template 屬於 superAdmin，需確認 masterToken 一致
  // 為此我們用 superAdmin token 測試自己的模板就好（已在 B1 測試）
  // 接著測試 freeMaster 導出自己不擁有模板應 403
  r = await fetch(`${BASE_URL}${exportUrl}`, { method: 'POST', headers: { 'Authorization': `Bearer ${TEST_TOKENS.freeMaster}`, 'Content-Type': 'application/json' }, body: formBody });
  assert('C1 免費 Master 導出他人模板 → 403', r.status === 403, `得到 ${r.status}`);

  // C2: 為 freeMaster 建立自己的模板（直接注入）
  const freeMasterTemplateId = 'test_fm_template_001';
  const excelBuf2 = await createMinimalExcel();
  const freeMasterTemplate = {
    id: freeMasterTemplateId,
    masterToken: TEST_TOKENS.freeMaster,
    title: '免費 Master 測試範本',
    config: { fields: [{ name: 'x', type: 'text', label: 'X', required: false }] },
    excelBase64: Buffer.from(excelBuf2).toString('base64'),
    updatedAt: new Date().toISOString(),
    folder: '', pages: 1,
  };
  await client.execute({ sql: 'INSERT OR REPLACE INTO templates (id, data) VALUES (?, ?)', args: [freeMasterTemplateId, JSON.stringify(freeMasterTemplate)] });

  r = await fetch(`${BASE_URL}/api/templates/${freeMasterTemplateId}/export`, { method: 'POST', headers: { 'Authorization': `Bearer ${TEST_TOKENS.freeMaster}`, 'Content-Type': 'application/json' }, body: formBody });
  assert('C2 免費 Master（試用過期、無點數）導出自己模板 → 402', r.status === 402, `得到 ${r.status}`);

  r = await fetch(`${BASE_URL}/api/templates/${freeMasterTemplateId}/export`, { method: 'POST', headers: { 'Authorization': `Bearer ${TEST_TOKENS.withPoints}`, 'Content-Type': 'application/json' }, body: formBody });
  // withPoints token 不是此模板的 master，應 403
  assert('C3 withPoints Master 導出他人模板 → 403', r.status === 403, `得到 ${r.status}`);

  // 為 withPoints 建立自己的模板
  const withPointsTemplateId = 'test_wp_template_001';
  const wpTemplate = {
    id: withPointsTemplateId,
    masterToken: TEST_TOKENS.withPoints,
    title: '有點數 Master 測試範本',
    config: { fields: [{ name: 'x', type: 'text', label: 'X', required: false }] },
    excelBase64: Buffer.from(await createMinimalExcel()).toString('base64'),
    updatedAt: new Date().toISOString(),
    folder: '', pages: 1,
  };
  await client.execute({ sql: 'INSERT OR REPLACE INTO templates (id, data) VALUES (?, ?)', args: [withPointsTemplateId, JSON.stringify(wpTemplate)] });

  r = await fetch(`${BASE_URL}/api/templates/${withPointsTemplateId}/export`, { method: 'POST', headers: { 'Authorization': `Bearer ${TEST_TOKENS.withPoints}`, 'Content-Type': 'application/json' }, body: formBody });
  assert('C4 有點數 Master（10 點）導出自己模板 → 成功', r.status >= 200 && r.status < 300, `得到 ${r.status}`);

  r = await fetch(`${BASE_URL}/api/templates/${withPointsTemplateId}/export`, { method: 'POST', headers: { 'Authorization': `Bearer ${TEST_TOKENS.noPoints}`, 'Content-Type': 'application/json' }, body: formBody });
  // noPoints 不是此 template 的 master
  assert('C5 無點數 Master 導出他人模板 → 403', r.status === 403, `得到 ${r.status}`);

  // noPoints 的自己模板
  const noPointsTemplateId = 'test_np_template_001';
  const npTemplate = {
    id: noPointsTemplateId,
    masterToken: TEST_TOKENS.noPoints,
    title: '無點數 Master 測試範本',
    config: { fields: [{ name: 'x', type: 'text', label: 'X', required: false }] },
    excelBase64: Buffer.from(await createMinimalExcel()).toString('base64'),
    updatedAt: new Date().toISOString(),
    folder: '', pages: 1,
  };
  await client.execute({ sql: 'INSERT OR REPLACE INTO templates (id, data) VALUES (?, ?)', args: [noPointsTemplateId, JSON.stringify(npTemplate)] });

  r = await fetch(`${BASE_URL}/api/templates/${noPointsTemplateId}/export`, { method: 'POST', headers: { 'Authorization': `Bearer ${TEST_TOKENS.noPoints}`, 'Content-Type': 'application/json' }, body: formBody });
  assert('C6 無點數 Master 導出自己模板 → 402', r.status === 402, `得到 ${r.status}`);

  // ── Section D：#74 修復驗證（Member 越權繼承）─────────────
  console.log('\n【D】#74 Member 越權繼承修復驗證（核心）');

  // memberOfPaid 的 master 有有效訂閱，應可繼承
  // 需要 paidMaster 的模板
  const paidMasterTemplateId = 'test_pm_template_001';
  const pmTemplate = {
    id: paidMasterTemplateId,
    masterToken: TEST_TOKENS.paidMaster,
    title: '付費 Master 測試範本',
    config: { fields: [{ name: 'x', type: 'text', label: 'X', required: false }] },
    excelBase64: Buffer.from(await createMinimalExcel()).toString('base64'),
    updatedAt: new Date().toISOString(),
    folder: '', pages: 1,
  };
  await client.execute({ sql: 'INSERT OR REPLACE INTO templates (id, data) VALUES (?, ?)', args: [paidMasterTemplateId, JSON.stringify(pmTemplate)] });

  r = await fetch(`${BASE_URL}/api/templates/${paidMasterTemplateId}/export`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TEST_TOKENS.memberOfPaid}`, 'Content-Type': 'application/json' },
    body: formBody,
  });
  assert('D1 有效訂閱 Master 的 Member 導出 → 成功（繼承訂閱）', r.status >= 200 && r.status < 300, `得到 ${r.status}`);

  // expiredMaster 的模板
  const expiredMasterTemplateId = 'test_em_template_001';
  const emTemplate = {
    id: expiredMasterTemplateId,
    masterToken: TEST_TOKENS.expiredMaster,
    title: '過期 Master 測試範本',
    config: { fields: [{ name: 'x', type: 'text', label: 'X', required: false }] },
    excelBase64: Buffer.from(await createMinimalExcel()).toString('base64'),
    updatedAt: new Date().toISOString(),
    folder: '', pages: 1,
  };
  await client.execute({ sql: 'INSERT OR REPLACE INTO templates (id, data) VALUES (?, ?)', args: [expiredMasterTemplateId, JSON.stringify(emTemplate)] });

  r = await fetch(`${BASE_URL}/api/templates/${expiredMasterTemplateId}/export`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TEST_TOKENS.memberOfExpired}`, 'Content-Type': 'application/json' },
    body: formBody,
  });
  assert(
    'D2 【#74 核心】已過期 Master 的 Member 導出 → 402（不應繼承過期吃到飽）',
    r.status === 402,
    `得到 ${r.status}（若為 2xx 代表 #74 修復失敗！）`
  );

  // ── Section E：容量上限測試（#68 修復驗證）───────────────
  console.log('\n【E】#68 模板容量上限修復驗證');

  // 為 freeMaster 建立 2 個更多模板，讓總數達到 3（上限）
  for (let i = 2; i <= 3; i++) {
    const tid = `test_fm_template_00${i}`;
    await client.execute({
      sql: 'INSERT OR REPLACE INTO templates (id, data) VALUES (?, ?)',
      args: [tid, JSON.stringify({ ...freeMasterTemplate, id: tid, title: `免費 Master 模板 ${i}` })],
    });
  }

  // 現在嘗試儲存第 4 個模板（應被 403 拒絕）
  const excelBufE = await createMinimalExcel();
  const fd = new FormData();
  fd.append('token', TEST_TOKENS.freeMaster);
  fd.append('title', '第 4 個模板（超出上限）');
  fd.append('config', JSON.stringify({ fields: [] }));
  const blob = new Blob([excelBufE], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  fd.append('template', blob, 'test.xlsx');

  r = await fetch(`${BASE_URL}/api/templates/save`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TEST_TOKENS.freeMaster}` },
    body: fd,
  });
  assert('E1 免費 Master 存第 4 個模板 → 403（超出容量上限）', r.status === 403, `得到 ${r.status}`);

  // 清理 E 的模板
  for (let i = 2; i <= 3; i++) await deleteTemplate(`test_fm_template_00${i}`);
  await deleteTemplate(freeMasterTemplateId);
  await deleteTemplate(withPointsTemplateId);
  await deleteTemplate(noPointsTemplateId);
  await deleteTemplate(paidMasterTemplateId);
  await deleteTemplate(expiredMasterTemplateId);

  // ── Section F：點數查詢一致性 ────────────────────────────
  console.log('\n【F】點數查詢一致性測試');

  let res1 = await apiGet('/api/points/status', TEST_TOKENS.withPoints);
  // withPoints 在 C4 中消耗了 1 點，應剩 9
  assert('F1 導出後點數正確扣除（10 → 9）', res1.body.points?.total === 9, `剩餘點數: ${res1.body.points?.total}`);

  let res2 = await apiGet('/api/points/status', TEST_TOKENS.noPoints);
  assert('F2 無點數帳號查詢回傳 0', res2.body.points?.total === 0, `得到: ${res2.body.points?.total}`);
}

// ══════════════════════════════════════════════════════════════
//  主流程
// ══════════════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  SmartForm 商業邏輯整合測試');
  console.log(`  目標: ${BASE_URL}  |  DB: ${DB_PATH}`);
  console.log('═══════════════════════════════════════════════════════');

  // 確認伺服器在線
  try {
    await fetch(`${BASE_URL}/api/templates?token=${SUPER_ADMIN_TOKEN}`);
  } catch {
    console.error('\n❌ 無法連線到伺服器，請先啟動後端（npm run dev）再執行測試。\n');
    process.exit(1);
  }

  try {
    await setup();
    await runTests();
  } finally {
    await teardown();
  }

  // ── 最終報告 ───────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  📊 測試結果：${passed} 通過 / ${failed} 失敗 / ${passed + failed} 總計`);
  if (failures.length > 0) {
    console.log('\n  ❌ 失敗明細：');
    failures.forEach(f => console.log(`     - ${f.label}${f.detail ? `  (${f.detail})` : ''}`));
  } else {
    console.log('\n  🎉 所有商業邏輯測試全部通過！');
  }
  console.log('═══════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('測試執行時發生未預期錯誤:', err);
  process.exit(1);
});
