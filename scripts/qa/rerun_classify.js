#!/usr/bin/env node
/**
 * rerun:classify — verdict ĐỔI giữa hai lượt: bằng chứng nói được gì, và KHÔNG nói được gì.
 *
 * Dùng:
 *   node scripts/qa/rerun_classify.js --task CSDL-4008 [--goc outputs/CSDL] [--json]
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ MÁY NÀY
 *
 * Chủ dự án nêu (ưu tiên #4): *"Phân biệt verdict thay đổi vì fix bug, thay đổi môi trường, sửa
 * automation hay flaky."* Trước đó sổ chỉ có `reruns` — một con số đếm, không nói được vì sao.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * MÁY CHỈ XẾP ĐƯỢC HAI LOẠI. HAI LOẠI CÒN LẠI PHẢI NGƯỜI KHAI — và đó không phải thiếu sót.
 *
 *   ① FLAKY, đo được chắc chắn: verdict đổi TRONG CÙNG MỘT LƯỢT (`cungLuot`). Mã và môi trường chưa
 *      kịp đổi giữa hai lần chấm, nên không còn lời giải thích nào khác.
 *   ② AUTOMATION ĐÃ ĐỔI, đo được: vân tay spec khác lượt trước (`specDoi`). Nhưng đây là ĐIỀU KIỆN
 *      CẦN, không phải nguyên nhân: sửa một dòng chú thích trong spec cũng làm vân tay đổi.
 *   ③/④ FIX BUG hay ĐỔI MÔI TRƯỜNG: cả hai để lại **cùng một dấu vết đo được** — verdict đổi mà spec
 *      không đổi. Máy không phân biệt được, và chọn bừa một trong hai là bịa nguyên nhân. Đúng thứ
 *      `failureLayer` đã cấm, và đúng thứ `SUSPECT_REAL_BUG` sinh ra để chống: dán nhãn flaky cho một
 *      lượt chưa giải thích được cơ chế là CHÔN BUG THẬT.
 *
 * Nên máy đếm, xếp hai loại đo được, rồi liệt kê phần CẦN NGƯỜI KHAI. Khai bằng:
 *   `finish(status, { lyDoDoiVerdict: '<vì sao verdict đổi>' })`
 *
 * MỨC BÁO CÁO, không chặn: mọi bản ghi có trước 11/11/2026 đều không có `doiVerdict`, vì trường đó
 * mới có. Chặn ngay là làm đỏ việc đã xong.
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
if (!TASK) { console.error('[rerun-classify] cần `--task <TASK_KEY>`'); process.exit(2); }
const T = path.join(path.resolve(arg('goc') || process.env.PROJECT_OUTPUT_DIR || path.join(REPO, 'outputs', 'CSDL')), 'tasks', TASK);

const sf = path.join(T, 'test-results', 'testcase-status.json');
let ds;
try {
  const raw = JSON.parse(fs.readFileSync(sf, 'utf8'));
  ds = Array.isArray(raw) ? raw : (raw.tests || []);
} catch (e) {
  console.log(`[rerun-classify] KHÔNG PHÁN ĐƯỢC — không đọc được \`${path.relative(REPO, sf)}\`. Task chưa chạy?`);
  console.log('  Đây KHÔNG phải là đạt: không có sổ kết quả thì không biết verdict nào đã đổi.');
  process.exit(2);
}
if (!ds.length) {
  console.log('[rerun-classify] KHÔNG PHÁN ĐƯỢC — sổ kết quả không có mục nào.');
  process.exit(2);
}

const doi = ds.filter((e) => e && e.doiVerdict && e.doiVerdict.tu && e.doiVerdict.sang);

/* Bao nhiêu bản ghi CÓ KHẢ NĂNG mang dấu đổi verdict — mẫu số để biết con số 0 nghĩa là gì. */
const coDauLuot = ds.filter((e) => e && e.run).length;

const nhom = { flaky: [], automation: [], canKhai: [], khongPhanDuoc: [], daKhai: [] };
for (const e of doi) {
  const d = e.doiVerdict;
  const mo = { tcId: e.tcId, tu: d.tu, sang: d.sang, lyDo: d.lyDo || '' };
  if (d.lyDo) nhom.daKhai.push(mo);
  if (d.cungLuot) nhom.flaky.push(mo);
  else if (d.specDoi === true) nhom.automation.push(mo);
  else if (d.specDoi === false) { if (!d.lyDo) nhom.canKhai.push(mo); }
  else nhom.khongPhanDuoc.push(mo);
}

const ra = {
  task: TASK,
  case_trong_so: ds.length,
  co_dau_luot_chay: coDauLuot,
  verdict_da_doi: doi.length,
  flaky_do_duoc: nhom.flaky.length,
  automation_da_doi: nhom.automation.length,
  can_nguoi_khai: nhom.canKhai.length,
  khong_phan_duoc: nhom.khongPhanDuoc.length,
  da_khai_ly_do: nhom.daKhai.length,
  chi_tiet: nhom,
  _luu_y: 'Máy xếp được HAI loại: flaky (đổi trong cùng một lượt) và automation đã đổi (vân tay spec khác). '
    + '"Fix bug" và "đổi môi trường" để lại CÙNG dấu vết đo được, nên máy KHÔNG phân biệt — phải người khai.',
};

if (JSONRA) { console.log(JSON.stringify(ra, null, 2)); process.exit(0); }

console.log(`[rerun-classify] task ${TASK} — ${ds.length} case trong sổ · ${coDauLuot} case có dấu lượt chạy`);
if (!coDauLuot) {
  console.log('');
  console.log('  KHÔNG PHÁN ĐƯỢC — không bản ghi nào mang dấu `run`, nên không so được hai lượt.');
  console.log('  Trường đó mới có từ 11/11/2026; lượt chạy mới sẽ tự có. Đây KHÔNG phải là đạt.');
  process.exit(2);
}
console.log(`  verdict ĐÃ ĐỔI giữa hai lượt      : ${doi.length}`);
console.log(`    ① flaky — đổi trong CÙNG một lượt : ${nhom.flaky.length}`);
console.log(`    ② automation đã đổi (vân tay spec): ${nhom.automation.length}`);
console.log(`    ③/④ cần NGƯỜI khai lý do          : ${nhom.canKhai.length}`);
console.log(`    không phán được (lượt trước thiếu vân tay): ${nhom.khongPhanDuoc.length}`);
console.log(`  đã khai lý do                      : ${nhom.daKhai.length}`);

if (nhom.canKhai.length) {
  console.log('');
  console.log('  >>> verdict đổi mà spec KHÔNG đổi — "fix bug" hay "đổi môi trường"? Máy không phân biệt được <<<');
  for (const x of nhom.canKhai.slice(0, 10)) console.log(`      ${x.tcId}: ${x.tu} → ${x.sang}`);
  if (nhom.canKhai.length > 10) console.log(`      … và ${nhom.canKhai.length - 10} case nữa`);
  console.log('      Khai bằng: `finish(status, { lyDoDoiVerdict: "<vì sao verdict đổi>" })`.');
  console.log(`~ rerun:classify — ${nhom.canKhai.length} verdict đổi chưa khai lý do (CẦN REVIEW)`);
}
if (nhom.flaky.length) {
  console.log('');
  console.log(`~ rerun:classify — ${nhom.flaky.length} case đổi verdict TRONG CÙNG một lượt ⇒ flaky đo được (CẦN REVIEW)`);
  console.log('  Nhắc: `SUSPECT_REAL_BUG` tồn tại cho đúng lúc này — chỉ đổi sang `failureLayer=flaky` khi');
  console.log('  nêu được CƠ CHẾ cụ thể. Không nêu được thì giữ nghi vấn, đừng dán nhãn rồi bỏ qua.');
}

console.log('');
console.log('  ĐỌC CON SỐ NÀY CHO ĐÚNG: máy xếp được HAI loại — flaky (đổi trong cùng một lượt) và');
console.log('  automation đã đổi (vân tay spec khác). "Fix bug" và "đổi môi trường" để lại CÙNG một');
console.log('  dấu vết đo được, nên máy KHÔNG phân biệt; chọn bừa một trong hai là bịa nguyên nhân.');
console.log('  Và `specDoi` chỉ nói automation CÓ ĐỔI, không nói đổi đó GÂY RA verdict mới.');

/* Sổ đo, cùng chỗ với các máy proof. */
const so = path.join(REPO, 'knowledge', 'metrics', 'rerun-classify.json');
try {
  let cu = {};
  try { cu = JSON.parse(fs.readFileSync(so, 'utf8')); } catch { /* lần đầu */ }
  cu[TASK] = {
    do_luc: new Date().toISOString().slice(0, 16),
    verdict_da_doi: doi.length,
    flaky_do_duoc: nhom.flaky.length,
    automation_da_doi: nhom.automation.length,
    can_nguoi_khai: nhom.canKhai.length,
  };
  cu._luu_y = ra._luu_y;
  fs.mkdirSync(path.dirname(so), { recursive: true });
  fs.writeFileSync(so, `${JSON.stringify(cu, null, 2)}\n`, 'utf8');
  console.log(`\n  đã ghi sổ: ${path.relative(REPO, so).split(path.sep).join('/')}`);
} catch (e) { console.log(`\n  (không ghi được sổ đo: ${e.message})`); }
