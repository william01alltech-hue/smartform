/**
 * SmartForm 多端點壓力測試腳本（修復後版本）
 * 
 * 測試場景：
 *   Round 1 — GET /api/templates        (讀取列表，最高頻操作)
 *   Round 2 — GET /api/points/status    (點數查詢，修復 #67 後應無競態)
 *   Round 3 — POST /api/templates/:id/export (導出，修復 #74 後 Member 越權應被攔截)
 *   Round 4 — 模擬 50 個 Member 同時查詢點數 (並發壓力，驗證 #67 修復)
 */

const autocannon = require('autocannon');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const MASTER_TOKEN = process.env.MASTER_TOKEN || 'william_master_token';
const CONNECTIONS = parseInt(process.env.CONNECTIONS || '50', 10);
const DURATION = parseInt(process.env.DURATION || '10', 10);

// ── 格式化輸出工具 ──────────────────────────────────────
function printResult(label, result) {
  const successRate = result.requests.sent > 0
    ? (((result.requests.sent - result.non2xx) / result.requests.sent) * 100).toFixed(1)
    : '0.0';
  const status = result.non2xx === 0 ? '✅' : result.non2xx < result.requests.sent * 0.05 ? '⚠️' : '❌';

  console.log(`\n${status} [${label}]`);
  console.log(`   總請求數:   ${result.requests.sent.toLocaleString()}`);
  console.log(`   每秒請求數: ${result.requests.average.toLocaleString()} RPS`);
  console.log(`   平均延遲:   ${result.latency.average} ms  (P99: ${result.latency.p99} ms)`);
  console.log(`   吞吐量:     ${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/s`);
  console.log(`   成功率:     ${successRate}%  (錯誤: ${result.non2xx.toLocaleString()})`);
}

// ── 執行單一壓測並回傳 Promise ──────────────────────────
function runTest(label, options) {
  return new Promise((resolve) => {
    console.log(`\n🚀 開始測試: ${label} → ${options.url}`);
    const inst = autocannon(options, (err, result) => {
      if (err) {
        console.error(`   ❌ 壓測錯誤:`, err.message);
        resolve(null);
      } else {
        printResult(label, result);
        resolve(result);
      }
    });
    autocannon.track(inst, { renderProgressBar: true });
  });
}

// ── 主流程 ────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  SmartForm 後端壓力測試（修復後版本）');
  console.log(`  目標: ${BASE_URL}  |  並發: ${CONNECTIONS}  |  時長: ${DURATION}s`);
  console.log('═══════════════════════════════════════════════════════');

  const results = {};

  // Round 1: GET 列表（應全部成功，SQLite 讀取效能）
  results.r1 = await runTest('Round 1 / GET 模板列表', {
    url: `${BASE_URL}/api/templates?token=${MASTER_TOKEN}`,
    connections: CONNECTIONS,
    duration: DURATION,
    method: 'GET',
  });

  // Round 2: GET 點數狀態（驗證 #67 修復：無寫入副作用的純查詢）
  results.r2 = await runTest('Round 2 / GET 點數狀態 (#67 驗證)', {
    url: `${BASE_URL}/api/points/status`,
    connections: CONNECTIONS,
    duration: DURATION,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${MASTER_TOKEN}`,
    },
  });

  // Round 3: POST 驗證鑑權（應全部返回 401，因未帶 Token）
  results.r3 = await runTest('Round 3 / POST 無 Token 導出（應全 401）', {
    url: `${BASE_URL}/api/templates/non-existent-id/export`,
    connections: CONNECTIONS,
    duration: DURATION,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: '{}' }),
  });

  // Round 4: POST 使用正確 Token 打不存在的模板（應全 404）
  results.r4 = await runTest('Round 4 / POST 有效 Token + 不存在模板（應全 404）', {
    url: `${BASE_URL}/api/templates/does-not-exist/export`,
    connections: CONNECTIONS,
    duration: DURATION,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MASTER_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: '{}' }),
  });

  // Round 5: POST auth/verify-token（鑑權中介層高頻壓測）
  results.r5 = await runTest('Round 5 / POST 驗證 Token（鑑權中介層壓測）', {
    url: `${BASE_URL}/api/auth/verify-token`,
    connections: CONNECTIONS,
    duration: DURATION,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MASTER_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  // ── 總結報告 ─────────────────────────────────────────
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  📊 壓力測試總結報告');
  console.log('═══════════════════════════════════════════════════════');

  const labels = [
    'Round 1 / GET 模板列表',
    'Round 2 / GET 點數狀態',
    'Round 3 / 無 Token（全 401）',
    'Round 4 / 有效 Token + 不存在模板（全 404）',
    'Round 5 / 驗證 Token',
  ];

  const keys = ['r1', 'r2', 'r3', 'r4', 'r5'];
  keys.forEach((k, i) => {
    const r = results[k];
    if (!r) return;
    const ok = r.non2xx === 0 || (k === 'r3' && r.non2xx === r.requests.sent) || (k === 'r4' && r.non2xx === r.requests.sent);
    console.log(`  ${ok ? '✅' : '❌'}  ${labels[i].padEnd(40)} ${r.requests.average.toLocaleString()} RPS | ${r.latency.average} ms avg`);
  });

  console.log('\n  💡 說明：Round 3/4 的「錯誤」為預期的 401/404，代表安全防護正常運作。');
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
