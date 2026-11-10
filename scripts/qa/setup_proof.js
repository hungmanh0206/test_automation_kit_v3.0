#!/usr/bin/env node
/**
 * setup_proof — case GIẢ ĐỊNH một trạng thái thì lượt chạy có GHI LẠI việc kiểm trạng thái đó không?
 *
 * Dùng:
 *   node scripts/qa/setup_proof.js --task CSDL-4008 [--goc outputs/CSDL] [--json]
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ MÁY NÀY
 *
 * Vế còn lại của điều #2 chủ dự án nêu: *"chưa chứng minh Agent … dựng đúng state"*. Hai vế kia đã có
 * máy — `exec:proof` (đủ bước) và `write:proof` (dữ liệu có đổi thật). Vế này thì chưa.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * HAI LẦN ĐO SAI TRƯỚC KHI RA ĐƯỢC PHÉP ĐO NÀY — ghi lại vì nó là lý do tồn tại của cách làm hiện tại
 *
 * Lượt đầu tôi định ĐỌC SPEC: khối `beforeAll` có dựng tiền đề không, có nghiệm thu không.
 *   · Bản chặt (đòi `expect` ngay trong thân `beforeAll`): gắn cờ **267/303 case** của CSDL-4008.
 *     Tố oan — khối dựng gọi `damBaoDonVi()`, `bamLayDuLieu()` trong `lib/`, và CHÍNH helper đó mới
 *     là chỗ ném lỗi. Vế ÂM không đáng tin thì cả phép đo không dùng được.
 *   · Bản nới (đi theo đường nhập, chấp nhận `throw` ở bất kỳ lib nào spec nhập): gắn cờ **0**.
 *     Vô nghĩa theo chiều ngược lại — gần như lib nào cũng có một `throw` ở đâu đó.
 *   · Và bộ cắt khối của tôi còn cắt nhầm: `test.beforeAll(async ({ browser }) => {…})` thì dấu `{`
 *     đầu tiên là THAM SỐ, không phải thân. Hai lượt đo đầu đo nhầm chỗ mà vẫn in ra số.
 *
 * 267 hay 0 tuỳ cách viết regex ⇒ phép đo đang đo chính regex, không đo tiền đề. Bỏ hướng đọc spec.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * PHÉP ĐO HIỆN TẠI, và ranh giới của nó
 *
 * Trạng thái ấy có THẬT lúc chạy hay không là chuyện chỉ lượt chạy biết. Nên máy này đo **việc GHI
 * LẠI**: case nào khai tiền điều kiện cần DỰNG (`[ui] [api] [factory] [test_hook]`) thì trong
 * `testcase-status.json` phải có ít nhất một step mang dấu tiền đề — `EvidenceRecorder.tienDe()`.
 *
 * Nó KHÔNG nói "chạy sai state". Nó nói: **không artifact nào cho phép ai kiểm lại tiền đề**. Cùng
 * giọng với `exec:proof`, và vì cùng một lý do: nói quá một phép đo là cách nhanh nhất để mất nó.
 *
 * MỨC BÁO CÁO, KHÔNG CHẶN. Mọi task đã chạy đều có 0% — `tienDe()` mới có. Một cửa làm đỏ toàn bộ
 * task cũ sẽ bị tắt trong một ngày, và lúc đó luật mất hẳn. Cùng tiền lệ với `_truoc_la_canh_bao`
 * trong `handoff.json`. Siết lên chặn khi một task MỚI đạt trên ngưỡng trong `_cach_siet`.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const arg = (t) => {
  const i = process.argv.indexOf(`--${t}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : '';
};
const JSONRA = process.argv.includes('--json');
const TASK = arg('task');
if (!TASK) { console.error('[setup-proof] cần `--task <TASK_KEY>`'); process.exit(2); }
const T = path.join(path.resolve(arg('goc') || process.env.PROJECT_OUTPUT_DIR || path.join(REPO, 'outputs', 'CSDL')), 'tasks', TASK);

/* Tiền điều kiện phải DỰNG. `pre_existing` và `manual` cố ý không tính: cái đầu không dựng gì, cái
 * sau never-auto nên không có lượt chạy để ghi. */
const CAN_DUNG = /\[(ui|api|factory|test_hook)\]/;

/** tcId → có tiền điều kiện cần dựng không, đọc từ bộ .md canonical. */
function docCase() {
  const d = path.join(T, 'test-cases');
  let ds = [];
  try { ds = fs.readdirSync(d).filter((f) => f.endsWith('.md')); } catch (e) { return null; }
  const canDung = new Set();
  let tong = 0;
  for (const f of ds) {
    const dong = fs.readFileSync(path.join(d, f), 'utf8').split('\n').filter((l) => l.startsWith('|'));
    if (!dong.length) continue;
    const head = dong[0].split('|').map((s) => s.trim());
    const iTc = head.findIndex((x) => /^TC ?ID$/i.test(x));
    const iTd = head.findIndex((x) => /tiền điều kiện/i.test(x));
    if (iTc < 0 || iTd < 0) continue;
    for (const l of dong.slice(2)) {
      const c = l.split('|').map((s) => s.trim());
      if (!c[iTc] || !/_TC_|_[A-Z]{2,}$/.test(c[iTc])) continue;
      tong += 1;
      if (CAN_DUNG.test(c[iTd] || '')) canDung.add(c[iTc]);
    }
  }
  return { tong, canDung };
}

const bo = docCase();
if (!bo || !bo.tong) {
  console.log(`[setup-proof] KHÔNG PHÁN ĐƯỢC — không đọc được bộ case .md của \`${TASK}\` (cột "Tiền điều kiện").`);
  console.log('  Đây KHÔNG phải là đạt: không có mẫu số thì không nói được gì về tiền đề.');
  process.exit(2);
}
if (!bo.canDung.size) {
  console.log(`[setup-proof] KHÔNG PHÁN ĐƯỢC — ${bo.tong} case nhưng KHÔNG case nào khai tiền điều kiện cần dựng.`);
  console.log('  Hoặc bộ case thật sự chỉ dùng dữ liệu có sẵn, hoặc ô `Tiền điều kiện` thiếu tag `[<method>]`.');
  console.log('  Hai khả năng đó khác hẳn nhau, và máy không phân biệt được — nên nó không phán.');
  process.exit(2);
}

const sf = path.join(T, 'test-results', 'testcase-status.json');
let ds;
try {
  const raw = JSON.parse(fs.readFileSync(sf, 'utf8'));
  ds = Array.isArray(raw) ? raw : (raw.tests || []);
} catch (e) {
  console.log(`[setup-proof] KHÔNG PHÁN ĐƯỢC — không đọc được \`${path.relative(REPO, sf)}\`. Task chưa chạy?`);
  process.exit(2);
}
if (!ds.length) {
  console.log('[setup-proof] KHÔNG PHÁN ĐƯỢC — sổ kết quả không có mục nào.');
  process.exit(2);
}

/* Dấu tiền đề: cờ `tienDe` do `EvidenceRecorder.tienDe()` đặt, HOẶC tên bước mang tiền tố quy ước —
 * nhận cả hai để spec viết tay trước khi có API vẫn được tính.
 *
 * KHÔNG dùng `\b` sau chữ có dấu: trong regex JS, `Ề` KHÔNG phải ký tự từ, nên `/^TIỀN ĐỀ\b/` không
 * bao giờ khớp — hai bên ranh giới đều là "không phải chữ" thì không có ranh giới nào. Đây là bẫy đã
 * làm trượt phép so ở chỗ khác của kit; ở đây nó làm cửa đếm 0 và trông y như "chưa ai ghi". */
const laTienDe = (s) => s && (s.tienDe === true || String(s.name || '').startsWith('TIỀN ĐỀ'));

const daChay = new Set(ds.map((e) => e.tcId));
const r = { coGhi: [], khongGhi: [], chuaChay: [] };
for (const id of bo.canDung) {
  if (!daChay.has(id)) { r.chuaChay.push(id); continue; }
  const e = ds.find((x) => x.tcId === id);
  if ((e.steps || []).some(laTienDe)) r.coGhi.push(id); else r.khongGhi.push(id);
}

const mau = r.coGhi.length + r.khongGhi.length;
const tiLe = mau ? Math.round((r.coGhi.length / mau) * 1000) / 10 : 0;

if (JSONRA) {
  console.log(JSON.stringify({
    task: TASK,
    case_tong: bo.tong,
    can_dung_tien_de: bo.canDung.size,
    da_chay: mau,
    co_ghi_tien_de: r.coGhi.length,
    khong_ghi: r.khongGhi.length,
    chua_chay: r.chuaChay.length,
    ti_le_phan_tram: tiLe,
    _luu_y: 'KHÔNG phải "dựng sai state" — đây là đo việc GHI LẠI, không đo trạng thái lúc chạy.',
  }, null, 2));
  process.exit(0);
}

console.log(`[setup-proof] task ${TASK} — ${bo.tong} case · ${bo.canDung.size} case khai tiền điều kiện CẦN DỰNG`);
console.log(`  đã chạy (có trong sổ kết quả)      : ${mau}`);
console.log(`  có GHI bằng chứng tiền đề          : ${r.coGhi.length}  (${tiLe}%)`);
console.log(`  KHÔNG ghi                          : ${r.khongGhi.length}`);
console.log(`  chưa chạy — không tính vào mẫu số  : ${r.chuaChay.length}`);

if (r.khongGhi.length) {
  console.log('');
  console.log('  >>> case giả định một trạng thái mà KHÔNG artifact nào cho phép kiểm lại tiền đề <<<');
  console.log(`      ${r.khongGhi.slice(0, 8).join(' ')}${r.khongGhi.length > 8 ? ` … và ${r.khongGhi.length - 8} case nữa` : ''}`);
  console.log('      Dựng xong thì ghi lại: `await ca.tienDe(page, "<trạng thái>", { assert: () => … })`.');
}

console.log('');
console.log('  ĐỌC CON SỐ NÀY CHO ĐÚNG:');
console.log('    · Đây là đo việc GHI LẠI, KHÔNG phải đo trạng thái lúc chạy. "Không ghi" nghĩa là');
console.log('      không ai kiểm lại được tiền đề — KHÔNG có nghĩa là tiền đề đã sai.');
console.log('    · Đã thử đo bằng cách ĐỌC SPEC và bỏ: bản chặt gắn cờ 267/303 case (tố oan vì helper');
console.log('      trong lib/ mới là chỗ ném lỗi), bản nới gắn cờ 0. Số đổi theo regex thì nó đang đo regex.');
console.log('    · Mức BÁO CÁO, không chặn: `tienDe()` mới có nên mọi task cũ đều 0%.');

/* Dòng cho BÓ GATE đọc — xem chú thích cùng loại ở `exec_proof.js`. */
if (r.khongGhi.length) {
  console.log(`~ setup:proof — ${r.khongGhi.length} case giả định một trạng thái mà KHÔNG artifact nào cho phép kiểm lại tiền đề (CẦN REVIEW)`);
}

/* Ghi sổ đo để lượt sau so được — cùng chỗ với `exec:proof`. */
const so = path.join(REPO, 'knowledge', 'metrics', 'setup-proof.json');
try {
  let cu = {};
  try { cu = JSON.parse(fs.readFileSync(so, 'utf8')); } catch { /* lần đầu */ }
  cu[TASK] = {
    do_luc: new Date().toISOString().slice(0, 16),
    can_dung: bo.canDung.size,
    da_chay: mau,
    co_ghi: r.coGhi.length,
    ti_le_phan_tram: tiLe,
  };
  cu._luu_y = 'Đo việc GHI LẠI bằng chứng tiền đề, KHÔNG đo trạng thái lúc chạy. Xem header setup_proof.js.';
  fs.mkdirSync(path.dirname(so), { recursive: true });
  fs.writeFileSync(so, `${JSON.stringify(cu, null, 2)}\n`, 'utf8');
  console.log(`\n  đã ghi sổ: ${path.relative(REPO, so).split(path.sep).join('/')}`);
} catch (e) { console.log(`\n  (không ghi được sổ đo: ${e.message})`); }
