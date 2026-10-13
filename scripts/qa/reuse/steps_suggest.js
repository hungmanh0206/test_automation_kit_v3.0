#!/usr/bin/env node
'use strict';
/*
 * steps:suggest — CHỈ RA CÂU BƯỚC NÀO NÊN VIẾT LẠI, VÀ VIẾT LẠI THẾ NÀO (v2.8.0 §K).
 *
 * KHÔNG GỌI MODEL. Luật và cách chữa lấy từ `scripts/qa/lib/step_phrasing_check.js` — cùng nguồn với
 * tiêu chí 9 của `tc:review`. Hai bản sẽ trôi khỏi nhau: một bên phạt, một bên gợi ý sửa, và người viết
 * sửa theo gợi ý rồi vẫn bị phạt.
 *
 * VÌ SAO MỤC NÀY ĐÁNG LÀM, có số: đo trên 951 case · 5.886 mệnh đề thật, khớp vào danh mục bước cho ra
 * 0–3%. Cùng bộ khớp, cùng danh mục, nhưng case viết ĐÚNG CHUẨN cho 79%. Khoảng cách đó không mua được
 * bằng một bộ khớp tốt hơn — nó nằm ở cách viết câu, và đây là chỗ chỉ ra từng câu một.
 *
 * SẮP THEO SỐ LƯỢT, KHÔNG THEO THỨ TỰ CASE. Một khung câu sai lặp 40 lượt thì sửa nó đáng hơn 40 câu
 * sai mỗi câu một lượt, và danh sách theo thứ tự case giấu mất điều đó.
 *
 * Dùng: node scripts/qa/reuse/steps_suggest.js [--task <K>] [--md <file>] [--json] [--het]
 * Exit: 0 · 2 khi không có case nào để soi (CHƯA ĐO ĐƯỢC)
 */
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const rc = require(path.join(REPO, 'scripts', 'utils', 'runtime_config'));
const sm = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'steps_match.js'));
const phrasing = require(path.join(REPO, 'scripts', 'qa', 'lib', 'step_phrasing_check.js'));

function dungDo({ taskKey, taskOutputDir, duongMd }) {
  const cases = sm.docCase(duongMd, taskOutputDir);
  if (!cases.length) return { loi: 'khong-co-case' };

  const ng = sm.napNguPhap();
  let soMenhDe = 0;
  let soCaseDinh = 0;
  /* Gom theo KHUNG câu đã chuẩn hoá: cùng một lỗi viết lặp nhiều lượt chỉ cần sửa một kiểu. */
  const theoKhung = new Map();

  for (const tc of cases) {
    const r = phrasing.chamCase(tc, ng);
    soMenhDe += r.so_menh_de;
    if (r.vi_pham.length) soCaseDinh += 1;
    for (const v of r.vi_pham) {
      const khung = `${v.ma}|${sm.chuanHoaCau(v.menh_de, ng).so}`;
      if (!theoKhung.has(khung)) theoKhung.set(khung, { ma: v.ma, chua: v.chua, so_luot: 0, vi_du: v.menh_de, case: new Set() });
      const x = theoKhung.get(khung);
      x.so_luot += 1;
      x.case.add(tc.tcId);
    }
  }

  const nhom = [...theoKhung.values()]
    .map((x) => ({ ma: x.ma, chua: x.chua, so_luot: x.so_luot, so_case: x.case.size, vi_du: x.vi_du }))
    .sort((a, b) => b.so_luot - a.so_luot);

  return {
    task: taskKey,
    so_case: cases.length,
    so_case_dinh: soCaseDinh,
    so_menh_de: soMenhDe,
    so_luot_vi_pham: nhom.reduce((s, x) => s + x.so_luot, 0),
    nhom,
  };
}

function main() {
  const argv = process.argv;
  const val = (n) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
  };
  const duongMd = val('md');
  let taskKey = val('task');
  let taskOutputDir = null;

  if (!duongMd) {
    try {
      rc.loadEnvFiles();
      taskKey = taskKey || process.env.TASK_KEY || rc.getTaskKey();
      taskOutputDir = rc.getTaskOutputDir({ taskKey });
    } catch (e) {
      console.error(`[steps-suggest] CHƯA ĐO ĐƯỢC — không xác định được task: ${e.message}`);
      process.exit(2);
    }
  }

  const d = dungDo({ taskKey: taskKey || '(theo --md)', taskOutputDir, duongMd });
  if (d.loi === 'khong-co-case') {
    console.error('[steps-suggest] CHƯA ĐO ĐƯỢC — 0 case đọc được.');
    process.exit(2);
  }

  if (argv.includes('--json')) { console.log(JSON.stringify(d, null, 2)); return; }

  const pc = (x, n) => (n ? `${Math.round((x / n) * 100)}%` : 'n/a');
  console.log(`[steps-suggest] Task ${d.task} · ${d.so_case} case · ${d.so_menh_de} mệnh đề`);
  console.log(`                ${d.so_luot_vi_pham} lượt lệch chuẩn (${pc(d.so_luot_vi_pham, d.so_menh_de)}) ở ${d.so_case_dinh}/${d.so_case} case (${pc(d.so_case_dinh, d.so_case)})`);

  if (!d.nhom.length) {
    console.log('');
    console.log('✓ Không mệnh đề nào lệch hai luật đang chấm (P1 bọc giá trị · P4 không dán đường dẫn màn).');
    console.log('  Đây KHÔNG phải "câu bước hoàn hảo" — chỉ hai luật này chấm được bằng máy; ba luật còn');
    console.log('  lại của `step_phrasing.json` cần người đọc. Lý do ở đầu `scripts/qa/lib/step_phrasing_check.js`.');
    return;
  }

  const het = argv.includes('--het');
  const ds = het ? d.nhom : d.nhom.slice(0, 12);
  console.log('');
  console.log('Sắp theo SỐ LƯỢT — sửa khung lặp nhiều trước thì rẻ hơn sửa từng câu lẻ:');
  console.log('');
  for (const x of ds) {
    console.log(`  ${String(x.so_luot).padStart(4)}× (${x.so_case} case)  [${x.ma}]  ${x.vi_du.slice(0, 92)}`);
    console.log(`         chữa: ${x.chua}`);
  }
  if (!het && d.nhom.length > ds.length) {
    console.log('');
    console.log(`  … +${d.nhom.length - ds.length} khung nữa (thêm \`--het\` để in hết)`);
  }

  console.log('');
  console.log('Đo trên 5 bộ case thật: khớp vào danh mục bước cho 0–3% với case viết tự do, và 79% với');
  console.log('case viết đúng chuẩn — cùng bộ khớp, cùng danh mục. Khoảng cách đó nằm ở cách viết câu.');
}

if (require.main === module) main();

module.exports = { dungDo };
