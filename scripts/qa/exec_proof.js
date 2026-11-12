#!/usr/bin/env node
/**
 * exec_proof — artifact có ĐỦ ĐỂ CHỨNG MINH một case PASSED đã chạy hết bước không?
 *
 * Dùng:
 *   node scripts/qa/exec_proof.js --task TASK-4008 [--goc outputs/DEMO] [--json]
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ MÁY NÀY — và vì sao nó KHÔNG nói "đã chạy thiếu bước"
 *
 * Chủ dự án nêu điều thứ hai: *"chưa chứng minh Agent thực thi đúng toàn bộ steps"*. Chữ quan trọng
 * là **CHƯA CHỨNG MINH**, không phải **SAI**. Máy này đo đúng chữ đó.
 *
 * Đo trên TASK-4008: 282 case so được, **105 case ghi ít bước hơn số bước case khai**, trong đó
 * **61 case mang verdict PASSED** — có cái chỉ ghi 2/6 bước.
 *
 * NHƯNG KHÔNG ĐƯỢC GỌI ĐÓ LÀ "CHẠY THIẾU BƯỚC". Đọc `evidence_recorder.step()`: nó LUÔN chụp ảnh và
 * LUÔN đẩy một bản ghi, nên số bước trong manifest = **số lần spec gọi `step()`**, không phải số bước
 * đã thực thi. Một spec hoàn toàn có thể làm bước 1–3 của case trong MỘT lần ghi.
 *
 * Tức phép đo này **không phân biệt được** "chạy thiếu" với "ghi gộp". Nói nó là "chạy thiếu" sẽ là
 * một tuyên bố sai — đúng lớp lỗi mà cả đợt này đi sửa.
 *
 * ĐIỀU NÓ NÓI ĐƯỢC, và nó đủ: với những case đó, **artifact không cho phép ai kiểm lại từng bước**.
 * Người đọc hồ sơ không có cách nào biết bước 4, 5, 6 có xảy ra hay không. Đó CHÍNH LÀ "chưa chứng
 * minh" — không phải lời buộc tội, mà là một lỗ hổng truy vết đo được.
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
const GOC = arg('goc') || process.env.PROJECT_OUTPUT_DIR || path.join(REPO, 'outputs', 'DEMO');
if (!TASK) { console.error('[exec-proof] cần `--task <TASK_KEY>`'); process.exit(2); }

const T = path.join(path.resolve(GOC), 'tasks', TASK);

/** Số bước case KHAI, đọc từ cột `Các bước thực hiện` của bộ .md canonical. */
function buocKhai() {
  const d = path.join(T, 'test-cases');
  let ds = [];
  try { ds = fs.readdirSync(d).filter((f) => f.endsWith('.md')); } catch (e) { return null; }
  const ra = {};
  for (const f of ds) {
    const md = fs.readFileSync(path.join(d, f), 'utf8');
    const dong = md.split('\n').filter((l) => l.startsWith('|'));
    if (!dong.length) continue;
    const head = dong[0].split('|').map((s) => s.trim());
    const iTc = head.findIndex((x) => /^TC ?ID$/i.test(x));
    const iBuoc = head.findIndex((x) => /các bước/i.test(x));
    if (iTc < 0 || iBuoc < 0) continue;
    for (const l of dong.slice(2)) {
      const c = l.split('|').map((s) => s.trim());
      const id = c[iTc];
      if (!id || !/_TC_|_[A-Z]{2,}$/.test(id)) continue;
      const n = String(c[iBuoc] || '').split('<br>').filter((x) => /^\d+\./.test(x.trim())).length;
      if (n) ra[id] = n;
    }
  }
  return ra;
}

const khai = buocKhai();
if (!khai || !Object.keys(khai).length) {
  console.log(`[exec-proof] KHÔNG PHÁN ĐƯỢC — không đọc được bộ case .md của \`${TASK}\` (cột "Các bước thực hiện").`);
  console.log('  Đây KHÔNG phải là đạt: không có số bước KHAI thì không so được với số bước GHI.');
  process.exit(2);
}

const mf = path.join(T, 'test-results', 'evidence-manifest.json');
if (!fs.existsSync(mf)) {
  console.log(`[exec-proof] KHÔNG PHÁN ĐƯỢC — không có \`${path.relative(REPO, mf)}\`. Task chưa chạy, hoặc chạy mà không ghi manifest.`);
  process.exit(2);
}
let entries = [];
try { entries = JSON.parse(fs.readFileSync(mf, 'utf8')).entries || []; } catch (e) { entries = []; }
if (!entries.length) {
  console.log('[exec-proof] KHÔNG PHÁN ĐƯỢC — manifest không có mục nào.');
  process.exit(2);
}

const theoVerdict = {};
const yeu = [];
let soSanh = 0;
let duBuoc = 0;
for (const e of entries) {
  const k = khai[e.tcId];
  if (!k) continue;
  soSanh += 1;
  const c = (e.steps || []).length;
  if (c >= k) { duBuoc += 1; continue; }
  theoVerdict[e.status || '(trống)'] = (theoVerdict[e.status || '(trống)'] || 0) + 1;
  if (e.status === 'PASSED') yeu.push({ tcId: e.tcId, khai: k, ghi: c, ti: c / k });
}

if (JSONRA) {
  console.log(JSON.stringify({ task: TASK, so_sanh: soSanh, du_buoc: duBuoc, theo_verdict: theoVerdict, passed_thieu: yeu }, null, 2));
  process.exit(0);
}

console.log(`[exec-proof] task ${TASK} — so ${soSanh} case có cả số bước KHAI lẫn bản ghi lượt chạy`);
console.log(`  ghi ĐỦ số bước khai: ${duBuoc}/${soSanh}`);
console.log('  ghi ÍT hơn số bước khai, theo verdict:');
for (const [k, v] of Object.entries(theoVerdict).sort((a, b) => b[1] - a[1])) console.log(`    ${String(v).padStart(3)}  ${k}`);

console.log('');
console.log(`  >>> ${yeu.length} case PASSED mà artifact KHÔNG đủ để kiểm lại từng bước <<<`);
for (const v of yeu.sort((a, b) => a.ti - b.ti).slice(0, 12)) {
  console.log(`      ${v.tcId}  khai ${String(v.khai).padStart(2)} → ghi ${String(v.ghi).padStart(2)}  (${Math.round(v.ti * 100)}%)`);
}
if (yeu.length > 12) console.log(`      … và ${yeu.length - 12} case nữa`);

/*
 * GIỚI HẠN IN MỖI LƯỢT. Đây là phần dễ bị cắt nhất, và cắt nó đi là biến một lỗ hổng TRUY VẾT thành
 * một lời buộc tội THỰC THI.
 */
console.log('');
console.log('  ĐỌC CON SỐ NÀY CHO ĐÚNG:');
console.log('    · Đây KHÔNG phải "chạy thiếu bước". `evidence_recorder.step()` LUÔN ghi một bản ghi,');
console.log('      nên số bước ở đây là SỐ LẦN SPEC GỌI `step()` — một spec có thể làm 3 bước của case');
console.log('      trong MỘT lần ghi, và như thế là hợp lệ.');
console.log('    · Phép đo này KHÔNG phân biệt được "chạy thiếu" với "ghi gộp".');
console.log('    · Điều nó nói được: với những case đó, artifact KHÔNG cho phép ai kiểm lại từng bước.');
console.log('      Đó đúng là "CHƯA CHỨNG MINH" — một lỗ hổng truy vết, không phải một kết luận về lỗi.');
console.log('    · BLOCKED_SETUP ghi ít bước là ĐÚNG: chúng dừng sớm có chủ ý.');

/* Dòng cho BÓ GATE đọc: `check.js` chỉ nhặt dòng mở đầu bằng `~` làm cảnh báo. Không có dòng này
 * thì nối vào bó gate chỉ tạo ra một ô PASS im lặng. Vẫn thoát 0 — đây là mức BÁO CÁO. */
if (yeu.length) {
  console.log(`~ exec:proof — ${yeu.length} case PASSED mà artifact KHÔNG đủ để kiểm lại từng bước (CẦN REVIEW, không phải "chạy sai")`);
}

const so = path.join(REPO, 'knowledge', 'metrics', 'exec-proof.json');
try {
  fs.mkdirSync(path.dirname(so), { recursive: true });
  let cu = {};
  try { cu = JSON.parse(fs.readFileSync(so, 'utf8')); } catch (e) { cu = {}; }
  cu[TASK] = {
    at: new Date().toISOString(),
    so_sanh: soSanh,
    du_buoc: duBuoc,
    theo_verdict: theoVerdict,
    passed_khong_kiem_lai_duoc: yeu.length,
    _luu_y: 'KHÔNG phải "chạy thiếu bước" — manifest đếm số lần gọi step(), không đếm bước đã thực thi.',
  };
  fs.writeFileSync(so, `${JSON.stringify(cu, null, 2)}\n`, 'utf8');
  console.log('');
  console.log(`  đã ghi sổ: ${path.relative(REPO, so).split(path.sep).join('/')}`);
} catch (e) { console.log(`  (không ghi được sổ: ${e.message})`); }
