#!/usr/bin/env node
'use strict';

/*
 * exec_summary_tally.js — số trong `execution-summary.md` phải TRUY được về một sổ verdict có tên.
 *
 * VÌ SAO CẦN, và vì sao KHÔNG làm theo cách dễ đoán. `automation_reviewer` khai "bản summary có kể đúng
 * lượt chạy không" là chỗ **máy không phán được**, với lý lẽ: nó do người viết, máy không đối chiếu được
 * lời kể với artifact. Đo lại 29/10/2026 thì lý lẽ đó đúng một nửa — và nửa sai mới là chỗ làm được.
 *
 * ĐO TRƯỚC KHI DỰNG. Bốn `execution-summary.md` thật ghi số theo BỐN khuôn khác nhau:
 *   · TASK-4008: văn xuôi — "Đã chấm **146/273** case: **87 PASS · ~28 FAIL product_bug · …**"
 *   · TASK-9002: bảng `| \`PASSED\` | 60 | …` + `| Tổng case trong canonical | **139** |`
 *   · TASK-9003: bảng, tiêu đề khác — `| Tổng testcase canonical | **289** |`
 *   · TASK-9004: bảng, tiêu đề khác nữa — `| **PASS** | **31** |`
 * Nên một cửa dò "khuôn chuẩn" chỉ chạy được trên MỘT phần tư. Và `~28` là số cố ý XẤP XỈ: so khớp
 * nghiêm trên nó là vu oan một lời khai trung thực.
 *
 * VÀ SỐ THÌ LỆCH THẬT. TASK-9004 summary ghi PASS 31 · BLOCKED 27 · FAIL 3, trong khi sổ verdict có
 * PASSED 140 · BLOCKED_SETUP 62 · OBSERVATION 30 · FAILED 24. Nhưng KHÔNG kết luận "summary nói sai":
 * sổ có thể là của một lô hoặc một lượt, còn summary kể cả đợt. Chỗ hỏng thật là **không gì nói con số
 * đến từ đâu**, nên không ai phân xử được — kể cả người viết nó, ba tuần sau.
 *
 * NÊN MÁY NÀY KHÔNG CHẤM VĂN XUÔI. Nó SINH một khối có mốc, ghi rõ sổ nào · lúc nào · bao nhiêu, rồi
 * gác chính khối đó. Cùng khuôn `phase1:tables`, và cùng lý lẽ: bảng tự kẻ hỏng theo hai đường im lặng —
 * kẻ sai số, hoặc kẻ đúng rồi dữ liệu đổi mà bảng ở lại.
 *
 * Phần văn xuôi chỉ được ĐỐI CHIẾU và CẢNH BÁO, không chặn, và `~N` được bỏ qua.
 *
 * Dùng:
 *   npm run exec:tally                 # sinh/cập nhật khối
 *   npm run exec:tally:check           # khối thiếu hoặc lệch sổ ⇒ exit 1
 *   ... --dir <reports/>  --status <f> # trỏ tay (để dựng đối chứng)
 * Exit: 0 đạt · 1 đã đo và SAI · 2 KHÔNG PHÁN ĐƯỢC (thiếu sổ, hoặc sổ 0 case).
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const flag = (n) => process.argv.includes(`--${n}`);
const doiSo = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null;
};

const MOC_DAU = '<!-- exec-tally:bat-dau -->';
const MOC_CUOI = '<!-- exec-tally:ket-thuc -->';

/** Thư mục task, suy từ TASK_KEY + PROJECT_OUTPUT_DIR như mọi máy khác của kit. */
function thuMucTask() {
  return path.join(
    process.env.PROJECT_OUTPUT_DIR || path.join(REPO, 'outputs'),
    'tasks', process.env.TASK_KEY || '',
  );
}

/** Sổ verdict MỚI NHẤT. Nhiều `runs/<id>/` thì lấy theo mtime, và TÊN sổ được in ra. */
function timSo(goc) {
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
  di(path.join(goc, 'test-results'));
  if (!ra.length) return null;
  return ra.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

function demSo(duong) {
  const j = JSON.parse(fs.readFileSync(duong, 'utf8'));
  const tests = Array.isArray(j) ? j : (j.tests || []);
  const dem = new Map();
  for (const t of tests) {
    const id = t && (t.tcId || t.testKey || t.id);
    if (!id) continue;
    const s = String(t.status || '(không khai status)');
    dem.set(s, (dem.get(s) || 0) + 1);
  }
  return { tong: [...dem.values()].reduce((a, b) => a + b, 0), dem, runId: (j && j.runId) || null };
}

/** Khối SINH. Mọi con số ở đây truy được về một tên tệp và một mốc thời gian. */
function dungKhoi(duongSo, kq) {
  const st = fs.statSync(duongSo);
  const rel = path.relative(REPO, duongSo).split(path.sep).join('/');
  const L = [MOC_DAU,
    '',
    '### Số đã chấm — MÁY SINH, đừng sửa tay',
    '',
    `> Nguồn: \`${rel}\``,
    `> · sửa lần cuối ${st.mtime.toISOString().slice(0, 16).replace('T', ' ')}`
    + `${kq.runId ? ` · runId \`${kq.runId}\`` : ''}`,
    '>',
    '> Đây là số của **sổ verdict đó**, không phải mẫu số của cả bộ case. Mẫu số neo ở',
    '> `requirements/scope_inventory.md`; chênh giữa hai con số là chuyện cần giải thích bằng chữ,',
    '> không phải chuyện sửa một trong hai cho khớp.',
    '',
    '| Verdict | Số case |',
    '|---|---|'];
  for (const [k, v] of [...kq.dem.entries()].sort((a, b) => b[1] - a[1])) L.push(`| \`${k}\` | ${v} |`);
  L.push(`| **TỔNG** | **${kq.tong}** |`, '', MOC_CUOI);
  return L.join('\n');
}

/*
 * ĐỐI CHIẾU VĂN XUÔI — chỉ CẢNH BÁO.
 *
 * Bắt dạng `<số> PASS` / `<số> FAIL` / `<số> BLOCKED` nằm NGOÀI khối sinh, rồi so với tổng theo họ
 * verdict. Bỏ qua số có dấu `~` đứng trước: đó là lời khai xấp xỉ, và vu oan nó là dạy người ta bỏ dấu
 * `~` đi cho hết cảnh báo — tức làm lời khai KÉM trung thực hơn.
 */
/*
 * `(?<![A-Za-z_\d])` LÀ CHỖ QUAN TRỌNG NHẤT CỦA BA MẪU NÀY.
 *
 * Bản đầu không có nó, và nó đọc **mã testcase thành số đếm**: `TC_199 PASS` bị tính là "199 PASS".
 * Đo được 6 cảnh báo trên 4 file thật, trong đó có mã TC — và viết `TC_123 PASS` là cách kể bình thường
 * nhất trong các báo cáo này, nên lỗi đó nổ ở gần như mọi file.
 *
 * Dấu `/` cũng phải loại, và đây là lần siết THỨ HAI: `TC_184/185/206/215/217 PASS` là một DANH SÁCH mã,
 * nhưng ký tự trước `217` là `/` nên lần siết đầu không chặn được. Cái giá của việc loại `/` là một tỉ
 * lệ kiểu `3/4 PASS` sẽ bị bỏ qua — chấp nhận, vì bỏ sót ở một máy CẢNH BÁO rẻ hơn vu oan.
 */
const CHAN_TRUOC = String.raw`(?<![A-Za-z_\d/])`;
const HO = [
  { ten: 'PASS', re: new RegExp(`${CHAN_TRUOC}(~?)\\s*(\\d+)\\s*(?:case\\s*)?PASS(?![A-Z_])`, 'gi'), khop: (k) => /^PASS/i.test(k) },
  { ten: 'FAIL', re: new RegExp(`${CHAN_TRUOC}(~?)\\s*(\\d+)\\s*(?:case\\s*)?FAIL(?![A-Z_])`, 'gi'), khop: (k) => /^FAIL/i.test(k) },
  { ten: 'BLOCKED', re: new RegExp(`${CHAN_TRUOC}(~?)\\s*(\\d+)\\s*(?:case\\s*)?BLOCK(?:ED)?(?![A-Z_])`, 'gi'), khop: (k) => /^BLOCK/i.test(k) },
];

function doiChieuVanXuoi(vanXuoi, kq) {
  const ra = [];
  for (const h of HO) {
    const that = [...kq.dem.entries()].filter(([k]) => h.khop(k)).reduce((n, [, v]) => n + v, 0);
    h.re.lastIndex = 0;
    let m;
    while ((m = h.re.exec(vanXuoi))) {
      if (m[1] === '~') continue;                 // lời khai xấp xỉ: tôn trọng
      const khai = Number(m[2]);
      if (khai !== that) ra.push(`văn xuôi ghi ${khai} ${h.ten}, sổ verdict có ${that}`);
    }
  }
  return [...new Set(ra)];
}

function main() {
  const goc = doiSo('dir') ? path.resolve(path.dirname(path.resolve(doiSo('dir')))) : thuMucTask();
  const duongSo = doiSo('status') ? path.resolve(doiSo('status')) : timSo(goc);
  if (!duongSo || !fs.existsSync(duongSo)) {
    console.error('[exec-tally] KHÔNG PHÁN ĐƯỢC: không tìm được `testcase-status.json`.');
    console.error('  Chưa có lượt execute thì không có gì để đối soát — đó KHÔNG phải "đạt".');
    return 2;
  }
  let kq;
  try { kq = demSo(duongSo); } catch (e) {
    console.error(`[exec-tally] KHÔNG PHÁN ĐƯỢC: sổ verdict lỗi JSON — ${e.message}`);
    return 2;
  }
  if (kq.tong === 0) {
    console.error('[exec-tally] KHÔNG PHÁN ĐƯỢC: sổ verdict có 0 case.');
    console.error('  "không có gì để đối soát" KHÔNG đồng nghĩa với "đạt".');
    return 2;
  }

  const duongMd = path.join(goc, 'reports', 'execution-summary.md');
  const khoiMoi = dungKhoi(duongSo, kq);
  const relMd = path.relative(REPO, duongMd).split(path.sep).join('/');

  let cu = '';
  if (fs.existsSync(duongMd)) cu = fs.readFileSync(duongMd, 'utf8');
  const i = cu.indexOf(MOC_DAU);
  const j = cu.indexOf(MOC_CUOI);
  const coKhoi = i >= 0 && j > i;
  const khoiCu = coKhoi ? cu.slice(i, j + MOC_CUOI.length) : '';

  console.log(`[exec-tally] ${relMd}`);
  console.log(`[exec-tally] sổ: ${path.relative(REPO, duongSo).split(path.sep).join('/')} · ${kq.tong} case · `
    + `${kq.dem.size} loại verdict`);

  const canh = fs.existsSync(duongMd)
    ? doiChieuVanXuoi(coKhoi ? cu.slice(0, i) + cu.slice(j + MOC_CUOI.length) : cu, kq)
    : [];
  if (canh.length) {
    console.log(`\n[exec-tally] ⚠ ${canh.length} chỗ văn xuôi LỆCH sổ verdict (chỉ cảnh báo):`);
    for (const c of canh) console.log(`  - ${c}`);
    console.log('  Lệch KHÔNG tự nghĩa là sai: sổ có thể là của một lô hoặc một lượt, còn văn xuôi kể cả');
    console.log('  đợt. Nhưng chênh phải được GIẢI THÍCH bằng chữ, không để người đọc tự đoán.');
    console.log('  Số cố ý xấp xỉ thì ghi `~28` — máy này tôn trọng dấu `~` và bỏ qua.');
  }

  if (flag('check')) {
    if (!coKhoi) {
      console.error(`\n[exec-tally] ✗ ${relMd} CHƯA có khối số đã chấm.`);
      console.error('  Không có khối thì mọi con số trong báo cáo là số gõ tay, không truy được về sổ nào.');
      console.error('  Chạy `npm run exec:tally` rồi commit.');
      return 1;
    }
    if (khoiCu.trim() !== khoiMoi.trim()) {
      console.error(`\n[exec-tally] ✗ khối số trong ${relMd} LỆCH sổ verdict (sửa tay, hoặc sổ đã đổi).`);
      console.error('  Chạy `npm run exec:tally` rồi commit.');
      return 1;
    }
    console.log('\n[exec-tally] ✓ ĐẠT — khối số khớp sổ verdict.');
    return 0;
  }

  const moi = coKhoi
    ? cu.slice(0, i) + khoiMoi + cu.slice(j + MOC_CUOI.length)
    : `${cu.replace(/\s*$/, '')}\n\n${khoiMoi}\n`;
  fs.mkdirSync(path.dirname(duongMd), { recursive: true });
  fs.writeFileSync(duongMd, moi, 'utf8');
  console.log(`\n[exec-tally] ${coKhoi ? 'đã cập nhật' : 'đã thêm'} khối số vào ${relMd}`);
  console.log('[exec-tally] Giới hạn: máy này KHÔNG chấm phần văn xuôi có kể đúng hay không — nó chỉ bảo');
  console.log('[exec-tally] đảm con số trong báo cáo truy được về một sổ CÓ TÊN. Phần kể đúng vẫn là review tay.');
  return 0;
}

module.exports = { demSo, doiChieuVanXuoi, dungKhoi, MOC_DAU, MOC_CUOI };
if (require.main === module) process.exit(main());
