#!/usr/bin/env node
'use strict';

/*
 * data_chain_check.js — CHUỖI DỮ LIỆU giữa các case phải đứng được (v2.9.5 §6).
 *
 * VÌ SAO CẦN. Phần lớn case tự dựng tiền đề của mình. Nhưng có case khai thẳng rằng tiền đề của nó là
 * OUTPUT của case khác: `[pre_existing] Đã có "Hà Văn Tân Hiệu Trưởng" … (dựng ở TC_084)`. Đo 29/10/2026
 * trên bộ case thật: **9 ca** như vậy. Lúc đó bộ case không còn là một tập hợp mà là một CHUỖI, và
 * chuỗi thì có ba đường hỏng mà không máy nào trong kit nhìn thấy:
 *
 *   ① TRỎ VÀO HƯ KHÔNG — case nguồn đã bị xoá hoặc đổi mã trong một lượt sửa bộ. Tiền đề nay không có
 *     ai dựng, nhưng case vẫn chạy và vẫn ra một verdict.
 *   ② NGƯỢC THỨ TỰ — case phụ thuộc chạy TRƯỚC case nguồn. Chuỗi không thể đứng, và triệu chứng là
 *     "app thiếu dữ liệu" chứ không phải "tiền đề chưa dựng".
 *   ③ VERDICT KHÔNG ĐƯỢC PHÉP ĐỨNG — case nguồn FAILED/BLOCKED mà case phụ thuộc vẫn PASSED. Đây là
 *     đường hỏng ĐẮT NHẤT: nó đã sinh ra **2 product_bug bịa** trong một phiên, vì phép đo chạy trên
 *     một tình huống không tồn tại. Xem bài học `tiền đề chưa dựng đừng chấm tiếp`.
 *
 * PHẠM VI HẸP CÓ CHỦ Ý. Chỉ đọc ô `Tiền điều kiện`, và chỉ nhận mệnh đề có ĐỘNG TỪ DỰNG
 * (dựng/tạo/khai/chạy xong). Trong bộ case thật còn 16 lượt trỏ TC khác nữa, nhưng chúng là TRÍCH DẪN
 * ĐỂ ĐỌC — "đã kiểm ở TC_045", "SQL ở TC_088" — không phải phụ thuộc dữ liệu. Gác cả 25 lượt là gác
 * phần lớn dương tính giả, nên ranh giới nằm ở động từ, không ở việc có tên TC.
 *
 * GIỚI HẠN TỰ KHAI: máy đọc CHỮ trong ô tiền điều kiện. Case phụ thuộc case khác mà KHÔNG khai ra thì
 * máy không thấy — đó vẫn là "máy không phán được", và `automation_reviewer` giữ nó ở phần chấm tay.
 * Cửa này chỉ bảo đảm: chuỗi nào đã KHAI thì phải đứng được.
 *
 * Dùng:
 *   npm run data:chain              # in chuỗi + cảnh báo
 *   npm run data:chain:check        # thêm --enforce: ①②③ = exit 1
 *   ... --dir <test-cases/>         # đo trên thư mục khác (để dựng đối chứng)
 *   ... --status <file.json>        # đối soát verdict; thiếu file ⇒ KHÔNG phán ③, nói rõ
 * Exit: 0 đạt · 1 đã đo và SAI · 2 KHÔNG PHÁN ĐƯỢC (không đọc được case nào).
 */

const fs = require('fs');
const path = require('path');
const model = require('../lib/testcase/model.js');

const REPO = path.resolve(__dirname, '..', '..');
const flag = (n) => process.argv.includes(`--${n}`);
const doiSo = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null;
};

/*
 * ĐỘNG TỪ DỰNG là ranh giới giữa "phụ thuộc dữ liệu" và "trích dẫn để đọc".
 * Giữ `đã chạy xong` vì nó khai một phụ thuộc THỨ TỰ, dù không nói rõ dựng gì.
 */
const RE_PHU_THUOC = /(?:dựng|tạo|khai|đã\s+chạy\s+xong|chạy\s+trước|có\s+số\s+đo\s+mốc\s+của|dùng\s+lại\s+đúng\s+file\s+của)[^|]{0,80}?((?:[A-Z][A-Z0-9_]*_)?TC_\d+|APP_[A-Z]+_TC_\d+)/giu;
/* Trích dẫn để ĐỌC — không phải phụ thuộc. Giữ danh sách để còn giải thích được vì sao bỏ qua. */
const RE_CHI_DOC = /(?:đã\s+kiểm|đã\s+đo|đo\s+riêng|SQL\s+ở|xem\s+ở|so\s+với|khác\s+với)[^|]{0,40}TC_\d+/giu;

/** Mọi file .md testcase trong một thư mục (kể cả `parts/`). */
function quetMd(dir) {
  const ra = [];
  const di = (d) => {
    let es;
    try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) di(p);
      else if (e.name.endsWith('.md')) ra.push(p);
    }
  };
  di(dir);
  return ra.sort();
}

/**
 * Đọc bộ case: trả `[{ tcId, tienDieuKien, file, thuTu }]` theo ĐÚNG thứ tự xuất hiện trên đĩa.
 * Thứ tự xuất hiện là thứ tự chạy mặc định, nên nó mới là thứ để xét chiều của chuỗi.
 */
function docBoCase(dir) {
  const ra = [];
  for (const f of quetMd(dir)) {
    const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
    let cot = null;
    for (const l of lines) {
      if (!l.trim().startsWith('|')) continue;
      const o = model.splitMarkdownRow(l);
      if (model.isTestCaseHeader(o)) { cot = o.map((x) => model.normalizeHeader(x)); continue; }
      if (!cot || /^-{2,}$/.test((o[0] || '').trim())) continue;
      const iId = cot.indexOf(model.normalizeHeader('TC ID'));
      const iTd = cot.indexOf(model.normalizeHeader('Tiền điều kiện'));
      if (iId < 0 || iTd < 0) continue;
      const tcId = model.cleanCell(o[iId] || '').trim();
      if (!/^[A-Za-z]/.test(tcId)) continue;
      ra.push({
        tcId,
        tienDieuKien: model.cleanCell(o[iTd] || ''),
        file: path.relative(REPO, f).split(path.sep).join('/'),
        thuTu: ra.length,
      });
    }
  }
  return ra;
}

/** Rút mọi mã TC mà ô tiền điều kiện khai là NGUỒN dựng. */
function nguonCuaCase(td) {
  const ra = new Set();
  RE_PHU_THUOC.lastIndex = 0;
  let m;
  while ((m = RE_PHU_THUOC.exec(td))) ra.add(m[1]);
  return [...ra];
}

/** Khớp mã rút được với mã thật trong bộ: ô hay viết tắt `TC_084` cho `APP_NHANSU_TC_084`. */
function giaiMa(ma, tatCa) {
  if (tatCa.has(ma)) return ma;
  const duoi = [...tatCa].filter((x) => x.endsWith(`_${ma}`) || x === ma);
  return duoi.length === 1 ? duoi[0] : null;
}

/*
 * Tự tìm `testcase-status.json` ở đường dẫn chuẩn của task khi không truyền `--status`.
 *
 * Vì sao cần: phép kiểm ③ là phép kiểm đắt nhất của cửa này, mà nó chỉ chạy khi có file status. Bắt
 * người gọi tự truyền đường dẫn nghĩa là trong bó gate cuối phase nó sẽ KHÔNG BAO GIỜ chạy — một cửa
 * tắt theo mặc định. Lấy lượt MỚI NHẤT khi có nhiều `runs/<id>/`.
 */
function timStatus() {
  const goc = path.join(
    process.env.PROJECT_OUTPUT_DIR || path.join(REPO, 'outputs'),
    'tasks', process.env.TASK_KEY || '', 'test-results',
  );
  const ra = [];
  const di = (d, sau = 0) => {
    if (sau > 2) return;
    let es;
    try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) di(p, sau + 1);
      else if (e.name === 'testcase-status.json') ra.push(p);
    }
  };
  di(goc);
  if (ra.length === 0) return null;
  return ra.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

function napStatus(duong) {
  if (!duong) return null;
  try {
    const j = JSON.parse(fs.readFileSync(duong, 'utf8'));
    const ra = new Map();
    for (const t of (j.tests || [])) if (t && t.tcId) ra.set(t.tcId, String(t.status || ''));
    return ra;
  } catch { return null; }
}

function main() {
  const dir = path.resolve(doiSo('dir') || path.join(
    process.env.PROJECT_OUTPUT_DIR || path.join(REPO, 'outputs'),
    'tasks', process.env.TASK_KEY || '', 'test-cases',
  ));
  if (!fs.existsSync(dir)) {
    console.error(`[data-chain] KHÔNG PHÁN ĐƯỢC: không thấy thư mục ${dir}`);
    console.error('  Truyền --dir <test-cases/>, hoặc khai TASK_KEY + PROJECT_OUTPUT_DIR.');
    return 2;
  }
  const bo = docBoCase(dir);
  if (bo.length === 0) {
    console.error('[data-chain] KHÔNG PHÁN ĐƯỢC: 0 testcase đọc được.');
    console.error('  "không có gì để gác" KHÔNG đồng nghĩa với "đạt".');
    return 2;
  }

  const tatCa = new Set(bo.map((c) => c.tcId));
  const viTri = new Map(bo.map((c) => [c.tcId, c.thuTu]));
  const chuoi = [];
  const treo = [];
  const nguoc = [];
  let soChiDoc = 0;

  for (const c of bo) {
    RE_CHI_DOC.lastIndex = 0;
    soChiDoc += (c.tienDieuKien.match(RE_CHI_DOC) || []).length;
    for (const ma of nguonCuaCase(c.tienDieuKien)) {
      const that = giaiMa(ma, tatCa);
      if (!that) { treo.push({ c, ma }); continue; }
      if (that === c.tcId) continue;                       // tự trỏ chính nó: không phải chuỗi
      chuoi.push({ tu: that, den: c.tcId, file: c.file });
      if (viTri.get(that) > c.thuTu) nguoc.push({ c, nguon: that });
    }
  }

  /* Vòng: dò bằng DFS trên đồ thị `tu → den`. Vòng thì không thứ tự nào dựng được chuỗi. */
  const ke = new Map();
  for (const e of chuoi) ke.set(e.tu, [...(ke.get(e.tu) || []), e.den]);
  const vong = [];
  const mau = new Map();
  const di = (u, duong) => {
    mau.set(u, 1);
    for (const v of (ke.get(u) || [])) {
      if (mau.get(v) === 1) { vong.push([...duong, u, v].join(' → ')); continue; }
      if (!mau.has(v)) di(v, [...duong, u]);
    }
    mau.set(u, 2);
  };
  for (const u of ke.keys()) if (!mau.has(u)) di(u, []);

  const duongStatus = doiSo('status') || timStatus();
  const status = napStatus(duongStatus);
  const verdictHong = [];
  if (status) {
    for (const e of chuoi) {
      const sNguon = status.get(e.tu);
      const sDen = status.get(e.den);
      if (!sNguon || !sDen) continue;
      if (sDen === 'PASSED' && sNguon !== 'PASSED') verdictHong.push({ ...e, sNguon, sDen });
    }
  }

  console.log(`[data-chain] ${bo.length} testcase · ${chuoi.length} mắt chuỗi đã KHAI · ${soChiDoc} trích dẫn chỉ-để-đọc (bỏ qua)`);
  if (chuoi.length) {
    console.log('\n— Chuỗi dữ liệu đã khai —');
    for (const e of chuoi) console.log(`  ${e.tu}  →  ${e.den}`);
  }
  if (status) {
    console.log(`[data-chain] verdict đọc từ ${path.relative(REPO, duongStatus).split(path.sep).join('/')} (${status.size} case)`);
  } else {
    console.log('\n[data-chain] KHÔNG tìm được `testcase-status.json`: phép kiểm ③ (verdict không được phép');
    console.log('[data-chain] đứng) CHƯA chạy. Đó là phép kiểm đắt nhất của cửa này — chạy lại sau khi có');
    console.log('[data-chain] lượt execute, hoặc truyền `--status <file>`.');
  }

  let sai = 0;
  if (treo.length) {
    sai += treo.length;
    console.error(`\n[data-chain] ✗ ① ${treo.length} tiền đề TRỎ VÀO HƯ KHÔNG — case nguồn không có trong bộ:`);
    for (const x of treo) console.error(`  - ${x.c.tcId} khai nguồn \`${x.ma}\` · ${x.c.file}`);
    console.error('  Case nguồn bị xoá hoặc đổi mã thì tiền đề nay không ai dựng — mà case vẫn ra verdict.');
  }
  if (nguoc.length) {
    sai += nguoc.length;
    console.error(`\n[data-chain] ✗ ② ${nguoc.length} chuỗi NGƯỢC THỨ TỰ — case phụ thuộc đứng TRƯỚC case nguồn:`);
    for (const x of nguoc) console.error(`  - ${x.c.tcId} cần ${x.nguon} dựng trước, nhưng ${x.nguon} nằm SAU nó`);
    console.error('  Triệu chứng khi chạy là "app thiếu dữ liệu", không phải "tiền đề chưa dựng".');
  }
  if (vong.length) {
    sai += vong.length;
    console.error(`\n[data-chain] ✗ ${vong.length} VÒNG trong chuỗi — không thứ tự nào dựng được:`);
    for (const v of vong) console.error(`  - ${v}`);
  }
  if (verdictHong.length) {
    sai += verdictHong.length;
    console.error(`\n[data-chain] ✗ ③ ${verdictHong.length} verdict KHÔNG ĐƯỢC PHÉP ĐỨNG:`);
    for (const x of verdictHong) console.error(`  - ${x.den} = ${x.sDen}, nhưng nguồn ${x.tu} = ${x.sNguon}`);
    console.error('  Tiền đề chưa dựng thì phép đo chạy trên một tình huống KHÔNG TỒN TẠI. Lớp hỏng này đã');
    console.error('  sinh ra 2 product_bug bịa trong một phiên — verdict phải là BLOCKED, không phải PASSED.');
  }

  if (sai) {
    if (flag('enforce')) return 1;
    console.log('\n[data-chain] Chặn được bằng: npm run data:chain:check');
    return 0;
  }
  console.log('\n[data-chain] ✓ ĐẠT — mọi chuỗi đã khai đều đứng được.');
  console.log('[data-chain] Giới hạn: máy đọc CHỮ trong ô `Tiền điều kiện`. Case phụ thuộc case khác mà');
  console.log('[data-chain] KHÔNG khai ra thì máy không thấy — chỗ đó vẫn là phần chấm tay của `automation_reviewer`.');
  return 0;
}

module.exports = { docBoCase, nguonCuaCase, giaiMa };
if (require.main === module) process.exit(main());
