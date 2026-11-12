#!/usr/bin/env node
/**
 * tc_doi_chieu — đối chiếu bộ testcase của kit với BỘ NGƯỜI VIẾT, ở mức FIELD.
 *
 * Dùng:
 *   node scripts/qa/tc_doi_chieu.js --sheet "Hồ sơ trường" --bo outputs/DEMO/tasks/TASK-9001/test-cases/ho_so_truong.md
 *   … [--xlsx <đường dẫn>] [--json]
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ MÁY NÀY
 *
 * Chủ dự án nêu: *"chưa có phép đo đối chứng xem AI… phát hiện được bao nhiêu trường hợp quan trọng
 * bị bỏ sót"*. Đúng — nhưng không phải vì thiếu ground truth. **Ground truth CÓ THẬT và đang nằm trên
 * đĩa**: `Testcase_CSDL_2026-2027.xlsx`, 21 sheet, bộ case do NGƯỜI viết.
 *
 * Đã có một bản đối chiếu VIẾT TAY cho 2/21 sheet, và nó tốt. Nhưng nó chạy một lần, không lặp lại
 * được, và không để lại con số nào theo dõi được. Máy này biến việc đó thành phép đo chạy lại được.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO KHÔNG KHỚP THEO **NHÓM**, VÀ VÌ SAO KHÔNG KHỚP THEO **SỐ CASE**
 *
 * ① Hai bộ chia nhóm TRỰC GIAO nhau. Đo 09/11/2026 trên sheet "Hồ sơ trường": bộ người viết chia
 *    theo KHỐI FIELD (Định danh · Ban giám hiệu · Địa chỉ · Quy mô…, 12 nhóm), bộ kit chia theo HÀNH
 *    ĐỘNG (Xem · Cập nhật · Điểm trường phụ…, 6 nhóm). Chỉ 2/12 tên nhóm trùng. Khớp theo tên nhóm
 *    sẽ báo "10/12 nhóm không có case nào" — BÁO ĐỘNG GIẢ, vì kit CÓ phủ "Định danh trường học",
 *    chỉ xếp dưới "Cập nhật hồ sơ trường".
 *
 * ② So TỔNG SỐ CASE cũng vô nghĩa: bộ người viết phủ 1 cấp học, bộ kit phủ 5 cấp — một case của họ
 *    tương ứng 1→5 case của kit. "200 vs 223" không nói lên điều gì.
 *
 * Nên khớp ở mức **FIELD ĐƯỢC KIỂM** — thứ duy nhất hai bên cùng nói tới, dù xếp nhóm khác nhau.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * GIỚI HẠN PHẢI IN RA MỖI LƯỢT, KHÔNG ĐƯỢC GIẤU
 *
 * **"Kit không NHẮC tên field" ≠ "kit không KIỂM field đó".** Kit có thể kiểm nó dưới một tên khác.
 * Nên đầu ra của máy này là **DANH SÁCH ĐỂ NGƯỜI RÀ**, không phải một phán quyết. In nó như một kết
 * luận là lặp lại đúng lỗi mà cả đợt này đang đi sửa.
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

const XLSX_MAC_DINH = process.env.TC_HE_THONG_XLSX || 'D:/Tài liệu nghiệp vụ/Testcase_CSDL_2026-2027.xlsx';

const CHUAN = (s) => String(s == null ? '' : s)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/*
 * LỌC RÁC TRÍCH XUẤT, và ĐẾM nó.
 *
 * Lượt đo đầu cho 25 field "kit không nhắc", trong đó 2 là rác: một mảnh `· NT-02) Giá trị hiện tại:`
 * và một bản gần-trùng `ghi Vĩ tuyến` của field `Vĩ tuyến` vốn ĐÃ được phủ. Giấu rác đi thì con số
 * đẹp hơn sự thật; nên lọc, và IN RA đã lọc bao nhiêu.
 */
const LA_RAC = (ten) => {
  const c = CHUAN(ten);
  if (c.length < 3 || c.length > 45) return true;
  if (/^(ghi|doc|bam|click|nhap|chon|sua|xem|kiem|tra)\s/.test(c)) return true;  // động từ dẫn, không phải tên field
  if (/\b(nt|tc|req|br)\s*\d/.test(c)) return true;                               // mã tham chiếu lọt vào
  /* Mở đầu bằng gạch ⇒ mảnh câu, không phải tên field. `→` và `*` ⇒ chú thích kỳ vọng lọt vào. */
  if (/^[—–-]|[→*]|\bbug\b/i.test(ten)) return true;
  if (!/[a-z]/.test(c)) return true;
  /*
   * KHÔNG siết hơn nữa, có chủ ý. Lọc hăng tay sẽ giấu mất field THẬT, mà field thật bị giấu thì
   * con số "đã phủ" đẹp lên — hỏng đúng chiều nguy hiểm. Thà còn vài mảnh rác và ĐẾM chúng ra.
   */
  return false;
};

function docBoNguoiViet(duong, sheet) {
  let XLSX;
  try { XLSX = require('xlsx'); } catch (e) { return { loi: 'thiếu thư viện `xlsx`' }; }
  if (!fs.existsSync(duong)) return { loi: `không có workbook \`${duong}\`` };
  const wb = XLSX.readFile(duong);
  if (!wb.Sheets[sheet]) return { loi: `workbook không có sheet \`${sheet}\` (có: ${wb.SheetNames.join(' · ')})` };
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, blankrows: false, defval: '' });
  const h = rows.findIndex((r) => String(r[0]).trim() === 'ID_TC');
  if (h < 0) return { loi: `sheet \`${sheet}\` không có hàng tiêu đề \`ID_TC\`` };

  const field = new Map();
  const nhom = {};
  let soCase = 0;
  let rac = 0;
  let coKyHieu = 0;
  for (let i = h + 1; i < rows.length; i++) {
    const id = String(rows[i][0] || '').trim();
    if (!/^[A-Z]+\d+$/.test(id)) continue;
    soCase += 1;
    if (/#\d+\s/.test(rows[i].slice(1).map(String).join(' '))) coKyHieu += 1;
    const m = String(rows[i][1] || '').trim();
    if (m) nhom[m] = (nhom[m] || 0) + 1;
    const txt = rows[i].slice(1).map((x) => String(x)).join(' ');
    /* Field được trỏ bằng `#N <tên>` — quy ước của đội QA hệ thống (`#N` là chỉ số HIỂN THỊ). */
    for (const x of txt.matchAll(/#(\d+)\s+`?([^`#|,;\n=]{3,40})/g)) {
      const ten = x[2].replace(/`/g, '').trim();
      if (LA_RAC(ten)) { rac += 1; continue; }
      const k = CHUAN(ten);
      if (!field.has(k)) field.set(k, { ten, ids: new Set() });
      field.get(k).ids.add(id);
    }
  }
  /*
   * TỪ CHỐI PHÁN KHI QUY ƯỚC `#N` KHÔNG CÓ Ở SHEET NÀY.
   *
   * Đo 09/11/2026, tỉ lệ case có trỏ `#N`: "Hồ sơ trường" 72% · "Lớp" 21% · "Đội ngũ" 2% · "Học
   * sinh" 0 case đọc được. Quy ước đó là của RIÊNG vài sheet, không phải của cả workbook.
   *
   * Lượt đầu chưa có cửa này và nó in ra "PHỦ FIELD 1/24" cho sheet "Lớp" — một BÁO ĐỘNG GIẢ cỡ lớn,
   * vì 23 "field" kia thực ra là mảnh câu nhặt nhầm. Một con số như thế đủ để người ta không bao giờ
   * tin công cụ này nữa. Thà nói "không phán được".
   */
  const tiLe = soCase ? coKyHieu / soCase : 0;
  if (soCase === 0) return { loi: `sheet \`${sheet}\` không đọc được case nào (mã ca không khớp mẫu \`^[A-Z]+\\d+$\`)` };
  if (tiLe < 0.5) {
    return {
      loi: `sheet \`${sheet}\` chỉ có ${Math.round(tiLe * 100)}% case trỏ field bằng \`#N\` (${coKyHieu}/${soCase}) `
        + '— quy ước đó là của RIÊNG vài sheet. Dưới 50% thì phần trích được không đại diện, và con số '
        + 'phủ field sẽ là BÁO ĐỘNG GIẢ',
    };
  }
  return { soCase, nhom, field, rac, tiLe };
}

function docBoKit(duong) {
  if (!fs.existsSync(duong)) return { loi: `không có bộ case \`${duong}\`` };
  const md = fs.readFileSync(duong, 'utf8');
  const dong = md.split('\n').filter((l) => l.startsWith('|'));
  if (!dong.length) return { loi: `\`${duong}\` không có bảng Markdown nào` };
  const head = dong[0].split('|').map((s) => s.trim());
  const iMod = head.findIndex((x) => /^Module$/i.test(x));
  const nhom = {};
  let soCase = 0;
  for (const l of dong.slice(2)) {
    const c = l.split('|').map((s) => s.trim());
    if (!/TC_\d+/.test(c[1] || '')) continue;
    soCase += 1;
    if (iMod > 0) {
      const m = String(c[iMod] || '').split('/')[0].trim();
      if (m) nhom[m] = (nhom[m] || 0) + 1;
    }
  }
  return { soCase, nhom, text: CHUAN(md) };
}

/* ─── chạy ───────────────────────────────────────────────────────────────────────────────────────── */
const sheet = arg('sheet');
const boKit = arg('bo');
const duongXlsx = arg('xlsx') || XLSX_MAC_DINH;

if (!sheet || !boKit) {
  console.error('[doi-chieu] cần `--sheet <tên sheet>` và `--bo <đường dẫn .md canonical>`');
  process.exit(2);
}

const nguoi = docBoNguoiViet(duongXlsx, sheet);
const kit = docBoKit(path.resolve(REPO, boKit));

if (nguoi.loi || kit.loi) {
  /* "Không đọc được nguồn" KHÔNG thành "không có gì bỏ sót". Gói phát hành không chở workbook. */
  console.log(`[doi-chieu] KHÔNG PHÁN ĐƯỢC — ${nguoi.loi || kit.loi}.`);
  console.log('  Đây KHÔNG phải là đạt: không đọc được bộ đối chiếu thì không biết có bỏ sót gì không.');
  process.exit(2);
}

const phu = [];
const thieu = [];
for (const [k, v] of nguoi.field) (kit.text.includes(k) ? phu : thieu).push(v);

if (JSONRA) {
  console.log(JSON.stringify({
    sheet,
    bo_kit: boKit,
    nguoi: { so_case: nguoi.soCase, so_nhom: Object.keys(nguoi.nhom).length, so_field: nguoi.field.size, rac_da_loc: nguoi.rac },
    kit: { so_case: kit.soCase, so_nhom: Object.keys(kit.nhom).length },
    field_phu: phu.length,
    field_thieu: thieu.map((v) => ({ ten: v.ten, so_case: v.ids.size, ids: [...v.ids] })),
  }, null, 2));
  process.exit(0);
}

console.log(`[doi-chieu] sheet "${sheet}"  ↔  ${boKit}`);
console.log(`  bộ NGƯỜI VIẾT: ${nguoi.soCase} case · ${Object.keys(nguoi.nhom).length} nhóm · ${nguoi.field.size} field (đã lọc ${nguoi.rac} mảnh rác)`);
console.log(`  bộ KIT       : ${kit.soCase} case · ${Object.keys(kit.nhom).length} nhóm`);
console.log('');
console.log(`  PHỦ FIELD: ${phu.length}/${nguoi.field.size} field bộ người viết kiểm thì bộ kit có nhắc tới`);
console.log(`  ⚠ ${thieu.length} field bộ kit KHÔNG nhắc tới:`);
for (const v of thieu.sort((a, b) => b.ids.size - a.ids.size)) {
  console.log(`      ${String(v.ids.size).padStart(2)} case  ${v.ten}   (${[...v.ids].slice(0, 3).join(' ')}${v.ids.size > 3 ? '…' : ''})`);
}

console.log('');
console.log('  ĐỌC CON SỐ NÀY CHO ĐÚNG:');
console.log('    · "kit KHÔNG NHẮC tên field" ≠ "kit KHÔNG KIỂM field đó" — kit có thể kiểm nó dưới tên khác.');
console.log('      Đây là DANH SÁCH ĐỂ NGƯỜI RÀ, không phải một phán quyết.');
console.log(`    · KHÔNG so tổng số case (${nguoi.soCase} vs ${kit.soCase}): bộ người viết phủ 1 cấp học,`);
console.log('      bộ kit phủ 5 cấp — một case của họ tương ứng 1→5 case của kit.');
console.log('    · KHÔNG khớp theo tên NHÓM: hai bộ chia nhóm trực giao (khối field vs hành động).');

const so = path.join(REPO, 'knowledge', 'metrics', 'tc-doi-chieu.json');
try {
  fs.mkdirSync(path.dirname(so), { recursive: true });
  let cu = {};
  try { cu = JSON.parse(fs.readFileSync(so, 'utf8')); } catch (e) { cu = {}; }
  cu[sheet] = {
    at: new Date().toISOString(),
    bo_kit: boKit,
    nguoi_so_case: nguoi.soCase,
    kit_so_case: kit.soCase,
    field_tong: nguoi.field.size,
    field_phu: phu.length,
    field_thieu: thieu.length,
    rac_da_loc: nguoi.rac,
    _luu_y: 'field_thieu là DANH SÁCH ĐỂ RÀ, không phải số case bỏ sót đã xác nhận.',
  };
  fs.writeFileSync(so, `${JSON.stringify(cu, null, 2)}\n`, 'utf8');
  console.log('');
  console.log(`  đã ghi sổ: ${path.relative(REPO, so).split(path.sep).join('/')}`);
} catch (e) { console.log(`  (không ghi được sổ: ${e.message})`); }
