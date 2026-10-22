#!/usr/bin/env node
'use strict';

/*
 * Load check — wrapper MỎNG cho k6 (Loại B: load/stress/soak nhiều VU). Loại A (single-user) dùng perf_check.js.
 *
 * k6 KHÔNG phải npm dependency — là binary ngoài (cài choco/brew/apt/Docker). Script này chỉ orchestrate:
 * chạy k6 → parse summary JSON → reports/load-report.{md,json} → dashboard. Giữ Node-thuần: thiếu k6 → SKIP sạch.
 *
 * AN TOÀN (load test tạo TẢI THẬT — có thể làm nghẽn/sập chính UAT):
 *   - never-auto: PHẢI có --confirm-nonprod (hoặc LOAD_CHECK_CONFIRM=1). Không có → từ chối.
 *   - CHẶN prod: target trông giống prod → từ chối (không có cờ nào mở prod).
 *   - Cap khiêm tốn mặc định (--vus 5 --duration 30s); tăng có chủ đích. Đừng chạy tải lớn trên UAT dùng chung.
 *
 * PROFILE TẢI — vì sao wrapper KHÔNG được luôn nhét --vus/--duration:
 *   k6 cho CLI flag ĐÈ `options` khai trong script. Wrapper bản cũ luôn truyền --vus/--duration nên
 *   script khai `stages` (ramping) bị làm PHẲNG mà không báo gì — stress/spike/soak chạy ra load thường,
 *   report vẫn ghi "PASS". Đã đo: script khai stages 1→4 VU, chạy kèm `--vus 5 --duration 3s` → k6 giữ
 *   đúng 5/5 VU suốt run (ramp biến mất). Nay:
 *     - script có `stages`/`scenarios` + KHÔNG truyền --vus/--duration  → nhường profile cho script
 *     - script có profile NHƯNG truyền --vus/--duration                → vẫn đè (ý người chạy thắng) + CẢNH BÁO
 *     - script không khai profile                                      → giữ cap mặc định 5 VU / 30s như cũ
 *
 * BASELINE (`--baseline-id <id>`): append 1 dòng vào `knowledge/metrics/perf-baselines.jsonl` (LOCAL-only —
 *   knowledge/ không commit) kèm điều kiện đo (env/profile/k6 version) + cờ `clean`. Số perf chỉ có nghĩa khi
 *   SO SÁNH theo thời gian, mà report per-task nằm trong outputs/ (gitignore, xoá theo task) nên không so được.
 *   Lần đo sau in luôn delta p95 so với bản ghi `clean` gần nhất CÙNG id.
 *
 * ARTIFACT THEO LƯỢT + BÁO CÁO HTML (bổ sung 19/10/2026):
 *   Bản cũ ghi đè cùng `reports/k6-summary.json` mỗi lượt, nên lượt sau xoá sổ lượt trước — mà số
 *   hiệu năng chỉ có nghĩa khi so theo thời gian. Nay mỗi lượt có `reports/performance/<RUN_ID>/`
 *   chứa summary + time-series (`--out json`) + metadata + log đã khử secret, rồi `perf_report.js`
 *   dựng HTML có biểu đồ từ đó. Bản cũ cũng chưa từng xin `--out json`, nên KHÔNG có dữ liệu theo
 *   thời gian: mọi biểu đồ diễn biến đều không dựng được, chỉ có số tổng kết.
 *   `load-report.{md,json}` vẫn ở nguyên chỗ cũ để không gãy thứ đang gọi nó.
 *
 * Dùng:
 *   TASK_ENV=profiles/<TASK>/task.env node scripts/qa/load_check.js --script tests/load/example.load.js --confirm-nonprod
 *   [--base <url>] [--vus 5] [--duration 30s] [--docker] [--enforce] [--out <dir>] [--baseline-id <id>]
 *   [--run-id <id>] [--title "..."] [--cloud] [--no-report] [--trend-stats avg,p(95),p(99)]
 */

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const rc = require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));
/* Cloud + khử secret: tách ra lib để perf_report.js và test dùng chung một bản. */
const { khuSecret, trangThaiCloud } = require(path.resolve(__dirname, '..', 'lib', 'k6', 'cloud'));

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && (process.argv[i + 1] === undefined || String(process.argv[i + 1]).startsWith('--'))) return true;
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const SCRIPT = arg('script');
const CONFIRM = arg('confirm-nonprod', false) === true || process.env.LOAD_CHECK_CONFIRM === '1';
const USE_DOCKER = arg('docker', false) === true;
const ENFORCE = arg('enforce', false) === true;
const VUS = String(arg('vus', '5'));
const DURATION = String(arg('duration', '30s'));
const BASE = arg('base', process.env.LOAD_BASE_URL || process.env.OPS_BASE_URL || process.env.LMS_BASE_URL || '');
// Người chạy có CHỈ ĐỊNH RÕ tải hay không — khác hẳn với "đang dùng giá trị mặc định".
const CLI_SETS_LOAD = process.argv.includes('--vus') || process.argv.includes('--duration');
// --baseline-id: ghi thêm 1 dòng vào knowledge/metrics/perf-baselines.jsonl để so hồi quy giữa các lần đo.
const BASELINE_ID = arg('baseline-id');
const REPO_ROOT = rc.REPO_ROOT;

/*
 * Artifact theo LƯỢT CHẠY. Trước đây mọi lượt ghi đè cùng `reports/k6-summary.json` nên lượt sau xoá
 * sổ lượt trước — không truy ngược được, mà số hiệu năng thì chỉ có nghĩa khi so theo thời gian.
 * Mỗi lượt giờ có thư mục riêng; `load-report.{md,json}` vẫn ở chỗ cũ để không gãy thứ đang gọi nó.
 */
const RUN_ID = String(arg('run-id', rc.getRunId ? (rc.getRunId() || '') : '') || '')
  || new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
// --cloud: stream kết quả lên Grafana Cloud k6. TUỲ CHỌN — hỏng thì lượt local vẫn giữ nguyên.
const CLOUD = arg('cloud', false) === true;
// --no-report: bỏ bước dựng HTML (vd khi chỉ cần số thô trong CI).
const NO_REPORT = arg('no-report', false) === true;
// k6 mặc định KHÔNG xuất p(99). Không xin thì báo cáo phải để N/A — xin trước còn hơn thiếu.
const TREND_STATS = String(arg('trend-stats', 'avg,min,med,max,p(90),p(95),p(99)'));
/*
 * --khong-phai-sla: khai rằng threshold trong script là ngưỡng ĐÚNG-SAI (phép đo hợp lệ), KHÔNG phải
 * SLA hiệu năng. Báo cáo khi đó không được gắn nhãn PASS — đạt mấy ngưỡng "không được lỗi" rồi nói
 * hệ thống đạt yêu cầu hiệu năng là nói quá thứ mình đo được.
 */
const KHONG_PHAI_SLA = arg('khong-phai-sla', false) === true;
/* --ghi-chu "..." lặp được nhiều lần: điều kiện đo và cảnh báo diễn giải, hiện ở Phần A báo cáo. */
const GHI_CHU = process.argv.reduce((ds, v, i) => {
  if (v === '--ghi-chu' && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ds.push(process.argv[i + 1]);
  return ds;
}, []);

function tod() { try { return rc.getTaskOutputDir(); } catch (e) { return null; } }
const OUT = path.resolve(arg('out', tod() ? path.join(tod(), 'reports') : path.join(process.cwd(), 'reports')));
const RUN_DIR = path.join(OUT, 'performance', RUN_ID);

// --- Guards ---
if (!SCRIPT || !fs.existsSync(SCRIPT)) {
  console.error(`ERROR: cần --script <k6.js>. Không tồn tại: ${SCRIPT}\n(Template: tests/load/example.load.js)`);
  process.exit(2);
}
if (!CONFIRM) {
  console.error(
    '[load] TỪ CHỐI chạy: load test tạo TẢI THẬT, có thể làm nghẽn/sập môi trường.\n' +
      'Xác nhận target NON-PROD + được phép + không đụng ai đang dùng UAT chung, rồi chạy lại với\n' +
      '--confirm-nonprod (hoặc LOAD_CHECK_CONFIRM=1). TUYỆT ĐỐI không chạy trên production.',
  );
  process.exit(3);
}
if (/prod/i.test(BASE) && !/(uat|dev|stag|test|local)/i.test(BASE)) {
  console.error(`[load] TỪ CHỐI: target trông giống PRODUCTION (${BASE}). Load test chỉ chạy trên non-prod.`);
  process.exit(3);
}

// --- Profile tải: script tự khai (stages/scenarios) hay wrapper áp cap mặc định? ---
/**
 * Script có tự khai profile ramping không. Bỏ comment trước khi dò để `// stages: ...` trong chú thích
 * không bị tính là khai thật (guard `[^:]` để không cắt nhầm "https://").
 */
function scriptDeclaresProfile(file) {
  let src;
  try { src = fs.readFileSync(file, 'utf8'); } catch (e) { return false; }
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  return /\bstages\s*:/.test(code) || /\bscenarios\s*:/.test(code);
}
/**
 * Script khai `vus`/`duration` TRẦN (không phải stages/scenarios) thì cap của wrapper vẫn đè — đúng thiết kế
 * (giữ cap an toàn cho script không có profile). Nhưng đó là bẫy im lặng: viết soak `duration: '20m'` mà
 * chạy 30s thì mọi kết luận "không thấy degradation" đều vô nghĩa. Nên phải NÓI ra.
 */
function declaresPlainDuration(file) {
  let src;
  try { src = fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const m = code.match(/\bduration\s*:\s*['"]([^'"]+)['"]/);
  return m ? m[1] : null;
}
/**
 * VU lớn nhất script định dựng — để cảnh báo trước khi dội tải lên UAT dùng chung.
 * Với executor *-arrival-rate, `target` là RATE (req/s) chứ KHÔNG phải số VU; số VU thật khai ở `maxVUs`.
 * Đọc nhầm target thành VU là báo sai đơn vị (và sai cả độ lớn) → ưu tiên maxVUs khi có.
 */
function declaredPeakVus(file) {
  let src;
  try { src = fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
  const maxVus = [...src.matchAll(/\bmaxVUs\s*:\s*(\d+)/g)].map((m) => Number(m[1]));
  if (maxVus.length) return Math.max(...maxVus);
  if (/arrival-rate/.test(src)) return null; // arrival-rate mà không khai maxVUs → không suy được VU
  const nums = [...src.matchAll(/\btarget\s*:\s*(\d+)/g)].map((m) => Number(m[1]));
  return nums.length ? Math.max(...nums) : null;
}

const HAS_PROFILE = scriptDeclaresProfile(SCRIPT);
const USE_SCRIPT_PROFILE = HAS_PROFILE && !CLI_SETS_LOAD;
const PEAK = USE_SCRIPT_PROFILE ? declaredPeakVus(SCRIPT) : null;

if (HAS_PROFILE && CLI_SETS_LOAD) {
  console.warn(
    `[load] ⚠ ${path.basename(SCRIPT)} khai stages/scenarios NHƯNG bạn truyền --vus/--duration.\n` +
      `        k6 cho CLI ĐÈ options → ramping bị làm PHẲNG thành ${VUS} VU / ${DURATION} liên tục.\n` +
      '        Muốn chạy đúng profile stress/spike/soak trong script: BỎ --vus/--duration.',
  );
}
/**
 * Script khai `vus`/`iterations` TRẦN — cap của wrapper nuốt sạch, và đây là ca ÁC NHẤT trong ba ca.
 *
 * Đo 19/10/2026: một script nhập Excel khai `vus: 1, iterations: 1` (ý là "một người nhập một lần")
 * bị chạy thành `5 VU / 30s` liên tục. Mọi check vẫn xanh nên nhìn như lượt sạch, nhưng:
 *   · con số thời gian là của 5 người nhập đồng thời, đem so mốc một-người là sai hoàn toàn;
 *   · lượt nhập file lớn bị CẮT ở giây 30 trước khi kịp bước ghi, metric của bước đó biến mất khỏi
 *     summary mà không có lỗi nào được báo.
 * Cảnh báo cũ chỉ bắt `duration` trần, nên ca này đi lọt.
 */
function declaresPlainVus(file) {
  let src;
  try { src = fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const v = code.match(/\bvus\s*:\s*(\d+)/);
  const it = code.match(/\biterations\s*:\s*(\d+)/);
  return v || it ? { vus: v ? v[1] : null, iterations: it ? it[1] : null } : null;
}

// Chỉ cảnh báo khi cap là MẶC ĐỊNH; người chạy tự truyền --vus/--duration thì họ biết họ đang làm gì.
if (!HAS_PROFILE && !CLI_SETS_LOAD) {
  const tran = declaresPlainVus(SCRIPT);
  if (tran) {
    console.warn(
      `[load] ⚠ ${path.basename(SCRIPT)} khai ${tran.vus ? `vus: ${tran.vus}` : ''}${tran.vus && tran.iterations ? ' / ' : ''}${tran.iterations ? `iterations: ${tran.iterations}` : ''} TRẦN (không dùng scenarios)\n`
        + `        → wrapper đè bằng cap mặc định ${VUS} VU / ${DURATION} LIÊN TỤC. Lượt chạy KHÔNG phải cái script khai.\n`
        + '        Hậu quả im lặng: số đo thành của nhiều VU đồng thời, và lượt dài bị cắt giữa chừng mà check vẫn xanh.\n'
        + `        Sửa: đổi sang \`scenarios: { x: { executor: 'per-vu-iterations', vus: ${tran.vus || 1}, iterations: ${tran.iterations || 1}, maxDuration: '30m' } }\`.`,
    );
  }
  const want = declaresPlainDuration(SCRIPT);
  if (want && want !== DURATION) {
    console.warn(
      `[load] ⚠ ${path.basename(SCRIPT)} khai duration '${want}' nhưng KHÔNG dùng stages/scenarios → wrapper đè bằng cap '${DURATION}'.\n` +
        `        Chạy thật ${DURATION}, KHÔNG phải ${want}. Muốn giữ thời lượng: đổi sang \`stages: [{ duration: '${want}', target: <VU> }]\`\n` +
        `        (hoặc truyền --duration ${want} nếu cố ý).`,
    );
  }
}
// Cap mặc định biến mất khi nhường quyền cho script → phải nói rõ tải sắp dựng là bao nhiêu.
if (PEAK != null && PEAK > 50) {
  console.warn(`[load] ⚠ Profile trong script dựng tới ${PEAK} VU — tải lớn trên UAT dùng chung. Chắc chắn đã báo team trước khi chạy.`);
}

// --- Detect k6 (binary ngoài) → thiếu thì SKIP sạch, KHÔNG fail ---
let K6_VERSION = null;
function hasK6() {
  try {
    const r = spawnSync('k6', ['version'], { encoding: 'utf8' });
    // Giữ lại version: baseline đo bằng bản k6 khác nhau KHÔNG so thẳng với nhau được.
    if (r.status === 0) K6_VERSION = String(r.stdout || '').trim().split(/\s+/)[1] || null;
    return r.status === 0;
  } catch (e) { return false; }
}
function hasDocker() {
  try { const r = spawnSync('docker', ['version'], { encoding: 'utf8' }); return r.status === 0; } catch (e) { return false; }
}

fs.mkdirSync(RUN_DIR, { recursive: true });
const summaryPath = path.join(RUN_DIR, 'k6-summary.json');
const tsPath = path.join(RUN_DIR, 'k6-timeseries.ndjson');
const logPath = path.join(RUN_DIR, 'k6-stdout.log');
const metaPath = path.join(RUN_DIR, 'run-meta.json');

let runner = null;
if (!USE_DOCKER && hasK6()) runner = 'k6';
else if (USE_DOCKER || hasDocker()) runner = 'docker';

if (!runner) {
  console.warn(
    '[load] k6 CHƯA cài (và không có Docker) → BỎ QUA (không phải FAIL).\n' +
      'Cài k6: choco install k6 | brew install k6 | apt (xk6) — hoặc chạy với --docker (grafana/k6).\n' +
      'Loại B (load nhiều VU) là opt-in tool ngoài; Loại A single-user vẫn chạy được qua `npm run perf`.',
  );
  process.exit(0);
}

// --- Chạy k6 ---
// Nhường profile cho script = KHÔNG truyền --vus/--duration, nếu không k6 đè mất stages.
const loadArgs = USE_SCRIPT_PROFILE ? [] : ['--vus', VUS, '--duration', DURATION];
const PROFILE_LABEL = USE_SCRIPT_PROFILE
  ? `script tự khai (stages/scenarios${PEAK != null ? `, đỉnh ${PEAK} VU` : ''})`
  : `constant ${VUS} VU / ${DURATION}`;
/*
 * Output của k6, mỗi thứ một việc — thiếu cái nào thì báo cáo mất đúng phần đó:
 *   --summary-export     số TỔNG KẾT (percentile, threshold, checks)
 *   --out json=          TIME-SERIES kèm tags → bốn biểu đồ theo thời gian + bảng endpoint.
 *                        KHÔNG có nó thì báo cáo phải ghi N/A, cấm nội suy từ số trung bình.
 *   --summary-trend-stats xin thêm p(99); k6 mặc định không xuất.
 *   --out cloud          (tuỳ chọn) stream lên Grafana Cloud k6 và in ra URL run thật.
 */
const tuongDoi = (p) => path.relative(process.cwd(), p).replace(/\\/g, '/');
const outArgs = ['--out', `json=${tsPath}`];
if (CLOUD) outArgs.push('--out', 'cloud');
const k6Args = ['run', '--summary-export', summaryPath, '--summary-trend-stats', TREND_STATS,
  ...outArgs, ...loadArgs, '-e', `BASE_URL=${BASE}`, SCRIPT];
console.log(`[load] runner=${runner} · profile=${PROFILE_LABEL} · target=${BASE || '(script tự định)'}`);
console.log(`[load] artifact lượt này: ${RUN_DIR}`);

/**
 * Chạy k6 và VỪA in ra màn hình VỪA giữ lại log.
 * Bản cũ dùng `stdio: 'inherit'` nên toàn bộ output bay thẳng ra terminal và không còn gì để đính kèm
 * báo cáo; đổi hẳn sang `pipe` thì lượt chạy 20 phút lại im như thóc. Nên phải tee.
 */
function chayK6() {
  return new Promise((giai) => {
    const lenh = runner === 'k6' ? 'k6' : 'docker';
    const doiSo = runner === 'k6' ? k6Args
      : ['run', '--rm', '-i', '-v', `${process.cwd()}:/work`, '-w', '/work',
        ...(CLOUD && process.env.K6_CLOUD_TOKEN ? ['-e', 'K6_CLOUD_TOKEN'] : []),
        'grafana/k6', 'run',
        '--summary-export', tuongDoi(summaryPath), '--summary-trend-stats', TREND_STATS,
        '--out', `json=${tuongDoi(tsPath)}`, ...(CLOUD ? ['--out', 'cloud'] : []),
        ...loadArgs, '-e', `BASE_URL=${BASE}`, tuongDoi(SCRIPT)];
    const con = spawn(lenh, doiSo, { stdio: ['inherit', 'pipe', 'pipe'] });
    const gom = [];
    const noi = (luong, ra) => luong.on('data', (b) => { const s = b.toString(); gom.push(s); ra.write(s); });
    noi(con.stdout, process.stdout);
    noi(con.stderr, process.stderr);
    con.on('error', (e) => giai({ status: null, loiKhoiDong: e.message, output: gom.join('') }));
    con.on('close', (ma) => giai({ status: ma, output: gom.join('') }));
  });
}

/**
 * Threshold trong `--summary-export` có 2 dạng tuỳ bản k6 — và POLARITY NGƯỢC NHAU:
 *   - bản mới : `{"rate<0.01": true}`      → true = ĐÃ VI PHẠM (crossed)
 *   - bản cũ  : `{"rate<0.01": {ok:false}}` → ok=false = vi phạm
 * Code cũ chỉ đọc `v.ok !== false`, gặp boolean thì `v.ok` là undefined → LUÔN cho PASS: load test
 * vi phạm ngưỡng vẫn báo "0 FAIL" và `--enforce` không bao giờ chặn CI. Đã đo trên k6 đang cài:
 * threshold đạt → `false`, threshold trượt → `true`.
 */
function thresholdBreached(v) {
  if (v && typeof v === 'object') {
    if (typeof v.ok === 'boolean') return !v.ok;
    if (typeof v.fails === 'number') return v.fails > 0;
    return false;
  }
  return v === true;
}

/**
 * Metadata lượt chạy — `perf_report.js` đọc file này để dựng Phần A của báo cáo HTML.
 * Ghi TRƯỚC khi parse summary: lượt chạy hỏng cũng phải để lại dấu vết là nó đã chạy ở đâu, lúc nào,
 * bằng gì. Chỉ ghi thứ ĐO ĐƯỢC; cái không biết để `null` chứ không điền bừa.
 */
function ghiMeta({ batDau, ketThuc, res, cloud }) {
  const meta = {
    tenBaiTest: arg('title', `Load test · ${path.basename(SCRIPT)}`),
    runId: RUN_ID,
    script: path.relative(REPO_ROOT, path.resolve(SCRIPT)).replace(/\\/g, '/'),
    target: BASE || null,
    moiTruong: BASE ? (String(BASE).match(/uat|stag|dev|test|local/i) || ['không rõ'])[0].toLowerCase() : null,
    runner,
    k6Version: K6_VERSION,
    batDau: new Date(batDau).toISOString(),
    ketThuc: new Date(ketThuc).toISOString(),
    thoiLuongMs: ketThuc - batDau,
    profile: PROFILE_LABEL,
    profileSource: USE_SCRIPT_PROFILE ? 'script' : 'wrapper-cap',
    vus: USE_SCRIPT_PROFILE ? null : VUS,
    duration: USE_SCRIPT_PROFILE ? null : DURATION,
    peakVusDeclared: PEAK,
    executor: docExecutor(SCRIPT),
    k6ExitStatus: res.status,
    loiKhoiDong: res.loiKhoiDong || null,
    nguongLaSla: KHONG_PHAI_SLA ? false : null,
    ghiChuDoLuong: GHI_CHU,
    cloud,
  };
  try { fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8'); } catch (e) { /* best-effort */ }
  return meta;
}

/** Tên executor khai trong script, để Phần A nói đúng loại tải. Không khai → null (→ N/A ở báo cáo). */
function docExecutor(file) {
  try {
    const src = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const ds = [...src.matchAll(/\bexecutor\s*:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
    if (ds.length) return [...new Set(ds)].join(', ');
    return /\bstages\s*:/.test(src) ? 'ramping-vus (suy từ `stages`)' : null;
  } catch (e) { return null; }
}

// --- Parse summary → report ---
// vus/duration để null khi profile do script định — ghi số của wrapper vào đây là báo cáo SAI tải đã chạy.
function phanTich(res) {
let report = {
  source: SCRIPT, base: BASE, generatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
  profile: PROFILE_LABEL, profileSource: USE_SCRIPT_PROFILE ? 'script' : 'wrapper-cap',
  vus: USE_SCRIPT_PROFILE ? null : VUS, duration: USE_SCRIPT_PROFILE ? null : DURATION,
  peakVusDeclared: PEAK, runner, metrics: {}, thresholds: [], k6ExitStatus: res.status,
};
try {
  const s = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const m = s.metrics || {};
  const pick = (name, keys) => { const o = m[name] || {}; const out = {}; for (const k of keys) if (o[k] != null) out[k] = Math.round(o[k] * 100) / 100; return out; };
  report.metrics = {
    http_req_duration: pick('http_req_duration', ['min', 'avg', 'med', 'p(95)', 'p(99)', 'max']),
    http_reqs: pick('http_reqs', ['count', 'rate']),
    http_req_failed: pick('http_req_failed', ['rate', 'value']),
    iterations: pick('iterations', ['count', 'rate']),
    vus_max: pick('vus_max', ['value', 'max']),
  };
  for (const [name, obj] of Object.entries(m)) {
    if (obj && obj.thresholds) for (const [th, v] of Object.entries(obj.thresholds)) report.thresholds.push({ metric: name, threshold: th, ok: !thresholdBreached(v) });
  }
} catch (e) {
  report.parseError = e.message;
}

// Runner chết (daemon Docker không chạy, k6 lỗi khởi động…) → KHÔNG có summary. Nếu vẫn ghi report
// "0 threshold, 0 FAIL" + exit 0 thì một lượt KHÔNG HỀ CHẠY trông y hệt một lượt sạch — CI sẽ xanh.
// Phân biệt: k6 exit≠0 mà VẪN có summary = chạy thật nhưng trượt ngưỡng (hợp lệ, xử lý ở dưới).
if (report.parseError || !fs.existsSync(summaryPath)) {
  console.error(
    `\n[load] ✗ KHÔNG CHẠY ĐƯỢC — runner "${runner}" không sinh ra summary (exit ${res.status}).\n` +
      `        ${report.parseError ? `Lý do parse: ${report.parseError}\n        ` : ''}` +
      `${runner === 'docker' ? 'Docker: kiểm tra daemon đã chạy chưa (Docker Desktop), hoặc bỏ --docker để dùng k6 binary.\n        ' : ''}` +
      'Đây KHÔNG phải "load test đạt" — không có số liệu nào cả.',
  );
  try { fs.writeFileSync(path.join(OUT, 'load-report.json'), JSON.stringify({ ...report, ranSuccessfully: false }, null, 2), 'utf8'); } catch (e) { /* best-effort */ }
  process.exit(2);
}

fs.writeFileSync(path.join(OUT, 'load-report.json'), JSON.stringify(report, null, 2), 'utf8');
const failed = report.thresholds.filter((t) => !t.ok);
const L = ['# Load Report (k6)', '',
  `> ${report.generatedAt} · runner ${runner} · profile ${PROFILE_LABEL} · target ${BASE || '(script)'}`,
  '> Loại B (load/stress). Ngưỡng từ NFR khai trong k6 `thresholds`. Non-prod, never-auto.', '',
  '## Metrics', '```json', JSON.stringify(report.metrics, null, 2), '```', '',
  '## Thresholds (từ NFR, hoặc ngưỡng hồi quy suy từ baseline — xem comment trong k6 script)'];
if (!report.thresholds.length) L.push('- (script chưa khai threshold — thêm block `thresholds` theo NFR để ra verdict)');
else { L.push('| Metric | Threshold | Verdict |', '|---|---|---|'); for (const t of report.thresholds) L.push(`| ${t.metric} | ${t.threshold} | ${t.ok ? 'PASS' : 'FAIL'} |`); }
if (report.parseError) L.push('', `> Lưu ý: không parse được summary (${report.parseError}).`);
fs.writeFileSync(path.join(OUT, 'load-report.md'), L.join('\n'), 'utf8');

console.log(`[load] Đã tạo: ${path.join(OUT, 'load-report.md')} · ${report.thresholds.length} threshold, ${failed.length} FAIL`);

// --- Baseline (opt-in): 1 dòng/lần đo vào knowledge/metrics/perf-baselines.jsonl ---
// Số perf chỉ có nghĩa khi SO SÁNH theo thời gian; report per-task nằm trong outputs/ (bị xoá/gitignore)
// nên không dùng để so hồi quy được. Ghi kèm ĐIỀU KIỆN ĐO (env/profile/k6) — thiếu nó thì so nhầm bản ghi
// khác điều kiện, đúng kiểu tự lừa mình khi đọc số perf.
if (BASELINE_ID) {
  const d = report.metrics.http_req_duration || {};
  const envOf = (u) => (String(u).match(/uat|stag|dev|test|local/i) || ['unknown'])[0].toLowerCase();
  const rec = {
    id: BASELINE_ID,
    source: path.relative(REPO_ROOT, path.resolve(SCRIPT)).replace(/\\/g, '/'),
    base: BASE, env: envOf(BASE),
    profile: PROFILE_LABEL, profile_source: report.profileSource,
    runner, k6: K6_VERSION,
    measured_at: report.generatedAt,
    requests: (report.metrics.http_reqs || {}).count ?? null,
    rps: (report.metrics.http_reqs || {}).rate ?? null,
    error_rate: (report.metrics.http_req_failed || {}).value ?? null,
    min_ms: d.min ?? null, med_ms: d.med ?? null, avg_ms: d.avg ?? null,
    p95_ms: d['p(95)'] ?? null, max_ms: d.max ?? null,
    thresholds_total: report.thresholds.length, thresholds_failed: failed.length,
    // Chỉ bản ghi `clean` mới được dùng làm MỐC. Lượt có lỗi/trượt ngưỡng vẫn lưu (là dữ liệu), nhưng
    // lấy nó làm mốc là chốt mốc trên một lần chạy hỏng.
    clean: failed.length === 0 && ((report.metrics.http_req_failed || {}).value ?? 1) === 0,
  };
  const bFile = path.join(REPO_ROOT, 'knowledge', 'metrics', 'perf-baselines.jsonl');
  try {
    fs.mkdirSync(path.dirname(bFile), { recursive: true });
    fs.appendFileSync(bFile, `${JSON.stringify(rec)}\n`, 'utf8');
    const prev = fs.readFileSync(bFile, 'utf8').trim().split('\n').map((l) => { try { return JSON.parse(l); } catch (e) { return null; } })
      .filter((x) => x && x.id === BASELINE_ID && x.clean);
    console.log(`[load] baseline "${BASELINE_ID}" → ${path.relative(REPO_ROOT, bFile).replace(/\\/g, '/')} (${prev.length} bản ghi clean cho id này)`);
    if (rec.clean && prev.length > 1) {
      const before = prev[prev.length - 2];
      if (before.p95_ms && rec.p95_ms) {
        const delta = Math.round(((rec.p95_ms - before.p95_ms) / before.p95_ms) * 100);
        const sameCond = before.env === rec.env && before.profile === rec.profile;
        console.log(`[load] p95: ${before.p95_ms}ms (${before.measured_at}) → ${rec.p95_ms}ms · ${delta >= 0 ? '+' : ''}${delta}%${sameCond ? '' : ' ⚠ KHÁC điều kiện đo, không so thẳng được'}`);
      }
    }
    if (!rec.clean) console.log('[load] ⚠ lượt này KHÔNG clean (có lỗi hoặc trượt ngưỡng) → đã lưu nhưng đừng dùng làm mốc.');
  } catch (e) {
    console.warn(`[load] không ghi được baseline: ${e.message}`);
  }
}
if (ENFORCE && failed.length) { console.error(`[load] ENFORCE: threshold breach (${failed.length}).`); process.exit(1); }
process.exit(0);
}

/**
 * Dựng báo cáo HTML bằng TIẾN TRÌNH RIÊNG.
 * Cố ý không gọi trong tiến trình này: dựng báo cáo mà ném lỗi thì cũng không được phép làm mất số
 * liệu k6 vừa đo (artifact đã nằm trên đĩa rồi). Tiến trình con chết thì chỉ mất cái HTML.
 */
function dungBaoCao() {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'perf_report.js'), '--run-dir', RUN_DIR],
    { stdio: 'inherit', encoding: 'utf8' });
  if (r.status !== 0 && r.status !== 1) {
    console.warn(`[load] ⚠ không dựng được báo cáo HTML (mã ${r.status}) — artifact thô vẫn còn ở ${RUN_DIR}`);
  }
}

(async () => {
  const batDau = Date.now();
  const res = await chayK6();
  const ketThuc = Date.now();

  /* Log PHẢI qua khuSecret trước khi chạm đĩa — token không bao giờ được nằm trong artifact. */
  try { fs.writeFileSync(logPath, khuSecret(res.output || ''), 'utf8'); } catch (e) { /* best-effort */ }

  const cloud = await trangThaiCloud({ bat: CLOUD, output: res.output, loiChay: res.loiKhoiDong });
  if (CLOUD) console.log(`[load] Grafana Cloud k6: ${cloud.trangThai}${cloud.url ? ` → ${cloud.url}` : ''} (${cloud.ghiChu})`);

  ghiMeta({ batDau, ketThuc, res, cloud });
  if (!NO_REPORT) dungBaoCao();
  phanTich(res);
})().catch((e) => {
  console.error(`[load] lỗi ngoài dự tính: ${khuSecret(e.stack || e.message)}`);
  process.exit(2);
});
