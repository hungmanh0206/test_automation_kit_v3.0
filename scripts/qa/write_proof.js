#!/usr/bin/env node
/**
 * write_proof — case có hành động GHI thì lượt chạy có nghiệm thu bằng KÊNH ĐỘC LẬP không?
 *
 * Dùng:
 *   node scripts/qa/write_proof.js --task CSDL-4008 [--goc outputs/CSDL] [--json]
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ MÁY NÀY
 *
 * Vế thứ hai của điều #2 chủ dự án nêu: *"xác nhận dữ liệu thực sự thay đổi như expected"*.
 *
 * Kit đã có doctrine cho đúng chuyện này — `packs/qemis.md` mục 1: *toast `thành công` KHÔNG chứng
 * minh đã ghi*, với NĂM cơ chế từng cho cùng triệu chứng đó. Nhưng doctrine nằm ở **lời dặn trong
 * skill**, không ở **máy**. Máy này đếm xem lời dặn ấy có được làm theo không.
 *
 * ĐO TRÊN CSDL-4008: 184 case có hành động ghi · 120 nằm trong spec CÓ cơ chế nghiệm thu độc lập ·
 * **40 nằm trong spec KHÔNG có cơ chế nào** · 24 không tìm thấy spec.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * GIỚI HẠN PHẢI IN MỖI LƯỢT — phép đo này ở MỨC FILE, không ở mức case
 *
 * Một spec có `reload()` cho case này chưa chắc dùng cho case kia. Nên:
 *   · con số "có cơ chế" là **"file có"**, KHÔNG phải "case đã nghiệm thu" — đừng đọc nó thành đã đạt;
 *   · con số "không có cơ chế" thì CHẮC CHẮN: file đó không có đường nào để nghiệm thu độc lập, nên
 *     mọi case ghi trong đó chỉ dựa vào màn hình ngay sau thao tác.
 *
 * Nói cách khác: vế ÂM đáng tin, vế DƯƠNG chỉ là chặn trên. Gộp hai vế thành một tỉ lệ "đã nghiệm
 * thu 65%" là nói quá — và đó đúng là cách một con số thật trở thành một câu sai.
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
if (!TASK) { console.error('[write-proof] cần `--task <TASK_KEY>`'); process.exit(2); }
const T = path.join(path.resolve(arg('goc') || process.env.PROJECT_OUTPUT_DIR || path.join(REPO, 'outputs', 'CSDL')), 'tasks', TASK);

/* Hành động làm ĐỔI DỮ LIỆU — bấm một nút ghi, không phải chữ "lưu" trong câu kỳ vọng.
 * Lượt đầu dò theo chữ trong cột Kết quả mong đợi và bắt 248/312 case, kể cả case chỉ MỞ MÀN. Một
 * phép đo bắt gần hết thì nó không phân biệt được gì. */
const HANH_DONG = /b[ấâ]m\s*\[?"?(Ghi|Lưu|Cập nhật|Xóa|Xoá|Tổng hợp dữ liệu|Lấy dữ liệu|Gửi|Khóa|Khoá|Duyệt|Từ chối)/i;
/* Kênh ĐỘC LẬP với màn hình ngay sau thao tác: hỏi DB chỉ-đọc, hoặc tải lại trang rồi đọc lại. */
const DOC_LAP = /uatDbClient|queryUatReadonly|sqlOracle|\.reload\(\)/;

function docCase() {
  const d = path.join(T, 'test-cases');
  let ds = [];
  try { ds = fs.readdirSync(d).filter((f) => f.endsWith('.md')); } catch (e) { return null; }
  const ghi = new Set();
  let tong = 0;
  for (const f of ds) {
    const dong = fs.readFileSync(path.join(d, f), 'utf8').split('\n').filter((l) => l.startsWith('|'));
    if (!dong.length) continue;
    const head = dong[0].split('|').map((s) => s.trim());
    const iTc = head.findIndex((x) => /^TC ?ID$/i.test(x));
    const iB = head.findIndex((x) => /các bước/i.test(x));
    if (iTc < 0 || iB < 0) continue;
    for (const l of dong.slice(2)) {
      const c = l.split('|').map((s) => s.trim());
      if (!c[iTc] || !/_TC_|_[A-Z]{2,}$/.test(c[iTc])) continue;
      tong += 1;
      if (HANH_DONG.test(c[iB] || '')) ghi.add(c[iTc]);
    }
  }
  return { tong, ghi };
}

/*
 * THEO ĐƯỜNG NHẬP, không chỉ đọc file spec.
 *
 * Lượt đầu chỉ grep trong chính file `.spec.ts` và gắn cờ "không có cơ chế" cho `c-ngan-sach.spec.ts`
 * — trong khi `lib/nganSach.ts` mà nó NHẬP VÀO có hẳn đường hỏi DB. Một spec nghiệm thu qua thư viện
 * vẫn là nghiệm thu; chỉ nhìn một file là tố oan.
 */
function libCoCoChe(d) {
  const ra = {};
  const di = (thu, tien) => {
    let es = [];
    try { es = fs.readdirSync(thu, { withFileTypes: true }); } catch (e) { return; }
    for (const e of es) {
      const rel = tien ? `${tien}/${e.name}` : e.name;
      if (e.isDirectory()) { di(path.join(thu, e.name), rel); continue; }
      if (!/\.ts$/.test(e.name)) continue;
      try { ra[rel] = DOC_LAP.test(fs.readFileSync(path.join(thu, e.name), 'utf8')); } catch (err) { /* bỏ file đọc không được */ }
    }
  };
  di(path.join(d, 'lib'), '');
  return ra;
}

function docSpec(dsId) {
  const d = path.join(T, 'automation');
  let ds = [];
  try { ds = fs.readdirSync(d).filter((f) => /\.spec\.ts$/.test(f) && !/\.probe\./.test(f)); } catch (e) { return null; }
  const lib = libCoCoChe(d);
  const ra = {};
  for (const f of ds) {
    const s = fs.readFileSync(path.join(d, f), 'utf8');
    /* Cơ chế nằm ở CHÍNH spec, hoặc ở bất kỳ lib nào nó nhập vào. */
    let coCoChe = DOC_LAP.test(s);
    if (!coCoChe) {
      for (const m of s.matchAll(/from\s+['"]\.\/lib\/([A-Za-z0-9_/-]+)['"]/g)) {
        if (lib[`${m[1]}.ts`]) { coCoChe = true; break; }
      }
    }
    /*
     * TÌM THEO DANH SÁCH ID ĐÃ ĐỌC ĐƯỢC, không dò bằng mẫu đoán.
     *
     * Lượt đầu dò `tcId` trong spec bằng regex tự nghĩ, và nó đòi tiền tố dài kiểu
     * `CSDL_EMISTH_TC_001` nên trượt mọi mã ngắn hơn — cửa khi đó báo "không đọc được spec nào", tức
     * nó biến một lỗi NHẬN DẠNG thành một kết luận về CÂY. Bộ case đã cho sẵn danh sách id; đoán lại
     * một lần nữa là tự tạo chỗ để sai.
     */
    for (const id of dsId) {
      if (!ra[id] && s.includes(id)) ra[id] = { file: f, coCoChe };
    }
  }
  return ra;
}

const bo = docCase();
if (!bo || !bo.ghi.size) {
  console.log(`[write-proof] KHÔNG PHÁN ĐƯỢC — không đọc được bộ case .md của \`${TASK}\`, hoặc không case nào có hành động ghi.`);
  console.log('  Đây KHÔNG phải là đạt: không có mẫu số thì không nói được gì về việc nghiệm thu.');
  process.exit(2);
}
const spec = docSpec([...bo.ghi]);
if (!spec || !Object.keys(spec).length) {
  console.log(`[write-proof] KHÔNG PHÁN ĐƯỢC — không đọc được spec nào trong \`${path.relative(REPO, path.join(T, 'automation'))}\`.`);
  process.exit(2);
}

const yeu = [];
let coCoChe = 0;
let khongThaySpec = 0;
for (const id of bo.ghi) {
  const s = spec[id];
  if (!s) { khongThaySpec += 1; continue; }
  if (s.coCoChe) coCoChe += 1;
  else yeu.push({ tcId: id, file: s.file });
}

if (JSONRA) {
  console.log(JSON.stringify({ task: TASK, case_tong: bo.tong, case_ghi: bo.ghi.size, file_co_co_che: coCoChe, khong_co_co_che: yeu, khong_thay_spec: khongThaySpec }, null, 2));
  process.exit(0);
}

console.log(`[write-proof] task ${TASK} — ${bo.tong} case, ${bo.ghi.size} case có HÀNH ĐỘNG ghi/xoá`);
console.log(`  nằm trong spec CÓ cơ chế nghiệm thu độc lập : ${coCoChe}`);
console.log(`  nằm trong spec KHÔNG có cơ chế nào          : ${yeu.length}`);
console.log(`  không tìm thấy spec                          : ${khongThaySpec}`);

if (yeu.length) {
  const theoFile = {};
  for (const v of yeu) (theoFile[v.file] = theoFile[v.file] || []).push(v.tcId);
  console.log('');
  console.log('  >>> case GHI mà spec của nó KHÔNG có đường nghiệm thu độc lập <<<');
  for (const [f, ids] of Object.entries(theoFile).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`      ${String(ids.length).padStart(2)} case  ${f}   (${ids.slice(0, 3).join(' ')}${ids.length > 3 ? '…' : ''})`);
  }
}

console.log('');
console.log('  ĐỌC CON SỐ NÀY CHO ĐÚNG — phép đo ở MỨC FILE, không ở mức case:');
console.log('    · "CÓ cơ chế" nghĩa là FILE có, KHÔNG phải case đó đã nghiệm thu. Một spec có');
console.log('      `reload()` cho case này chưa chắc dùng cho case kia ⇒ đây là CHẶN TRÊN, không phải đã đạt.');
console.log('    · "KHÔNG có cơ chế" thì CHẮC CHẮN: file đó không có đường nào hỏi DB hay đọc lại sau');
console.log('      tải trang, nên mọi case ghi trong đó chỉ dựa vào màn hình NGAY SAU thao tác.');
console.log('    · Vế ÂM đáng tin, vế DƯƠNG chỉ là chặn trên. Gộp hai vế thành một tỉ lệ "đã nghiệm thu');
console.log('      X%" là NÓI QUÁ — đó đúng là cách một con số thật trở thành một câu sai.');
console.log('    · Vì sao luật này tồn tại: `packs/qemis.md` mục 1 — toast "thành công" KHÔNG chứng minh');
console.log('      đã ghi; đã gặp NĂM cơ chế khác nhau cùng cho đúng triệu chứng đó.');

const so = path.join(REPO, 'knowledge', 'metrics', 'write-proof.json');
try {
  fs.mkdirSync(path.dirname(so), { recursive: true });
  let cu = {};
  try { cu = JSON.parse(fs.readFileSync(so, 'utf8')); } catch (e) { cu = {}; }
  cu[TASK] = {
    at: new Date().toISOString(),
    case_tong: bo.tong,
    case_ghi: bo.ghi.size,
    file_co_co_che: coCoChe,
    khong_co_co_che: yeu.length,
    khong_thay_spec: khongThaySpec,
    _luu_y: 'MỨC FILE. "có cơ chế" là chặn trên, KHÔNG phải "đã nghiệm thu".',
  };
  fs.writeFileSync(so, `${JSON.stringify(cu, null, 2)}\n`, 'utf8');
  console.log('');
  console.log(`  đã ghi sổ: ${path.relative(REPO, so).split(path.sep).join('/')}`);
} catch (e) { console.log(`  (không ghi được sổ: ${e.message})`); }
