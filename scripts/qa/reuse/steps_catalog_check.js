#!/usr/bin/env node
'use strict';
/*
 * steps:catalog — GÁC DANH MỤC BƯỚC (v2.8.0 §C1 + §C3).
 *
 * Danh mục bước là thứ `steps:match` (§C2) và `compile:spec` (§D) cùng đọc. Một mục khai sai thì không ai
 * thấy ngay: §C2 vẫn khớp câu vào nó, §D vẫn sinh spec gọi nó, và cái đỏ hiện ra ở tầng Playwright với
 * thông báo lạc hướng ("locator không tìm thấy") thay vì ở chỗ sai thật (danh mục khai hàm không tồn tại).
 *
 * SÁU PHÉP KIỂM, và phép thứ hai là phép đáng giá nhất:
 *
 *   1. HÌNH DẠNG theo `.agent/config/step_catalog.schema.json` (qua `schema_mini`).
 *
 *   2. `impl` TRỎ TỚI HÀM CÓ THẬT — file tồn tại VÀ tên hàm được export. Một danh mục 60 mục nghe rất
 *      giàu, nhưng nếu 40 `impl` là hàm chưa viết thì nó là một bản kê ước nguyện, và tỉ lệ "dùng lại"
 *      tính trên nó là con số bịa. Đây là phép kiểm biến danh mục từ lời khai thành phép đo.
 *
 *   3. `params` KHỚP chỗ trống trong `phrases`. Khai lệch thì §C2 khớp được câu mà §D gọi hàm thiếu đối số.
 *
 *   4. TRÙNG `id` — JSON cho phép, và khoá sau ghi đè khoá trước, im lặng.
 *
 *   5. TRÙNG CÁCH DIỄN ĐẠT giữa hai bước khác nhau — khi hai bước cùng nhận một câu thì `steps:match`
 *      chọn theo thứ tự mảng, tức theo một chi tiết không ai cố ý. Đó là `steps:dup` mà §C3 yêu cầu.
 *
 *   6. `widget` trỏ tới tầng L0.5 có thật.
 *
 * Dùng: node scripts/qa/reuse/steps_catalog_check.js [--json]
 * Exit: 0 · 1 khi có vi phạm · 2 khi không đọc được danh mục hoặc schema (CHƯA ĐƯỢC GÁC)
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const schemaMini = require(path.join(REPO, 'scripts', 'qa', 'lib', 'schema_mini.js'));
const sm = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'steps_match.js'));

const DUONG_DANH_MUC = path.join(REPO, 'tests', 'fe', 'lib', 'step_catalog.json');
const DUONG_SCHEMA = path.join(REPO, '.agent', 'config', 'step_catalog.schema.json');

/** Chỗ trống tham số trong `phrases`: `{ten}`. */
const RE_CHO_TRONG = /\{([a-z0-9_]+)\}/gi;

/**
 * Hàm có được export từ file không.
 *
 * Dò bằng CHỮ, và nói thẳng ra là dò bằng chữ: đọc AST thì chắc hơn, nhưng `impl` chỉ trỏ tới hàm export ở
 * cấp ngoài cùng nên bốn dạng khai dưới đây phủ hết trường hợp thật. Dạng nào lạ hơn thì phép kiểm này
 * BÁO THIẾU chứ không bỏ qua — thà báo oan một mục để người ta sửa cách khai, hơn là để một `impl` chết
 * lọt qua. (Lỗi dương tính giả ở đây tốn một phút; lỗi âm tính giả tốn một lượt chạy UAT.)
 */
function coExport(src, ten) {
  const esc = ten.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mau = [
    new RegExp(`\\bexport\\s+(?:async\\s+)?function\\s+${esc}\\b`),
    new RegExp(`\\bexport\\s+(?:const|let|var|class|type|interface)\\s+${esc}\\b`),
    new RegExp(`\\bexport\\s*\\{[^}]*\\b${esc}\\b[^}]*\\}`),
    new RegExp(`\\bexport\\s+default\\s+(?:async\\s+)?function\\s+${esc}\\b`),
  ];
  return mau.some((re) => re.test(src));
}

/**
 * @param {{duongDanhMuc?: string, duongSchema?: string}} [opts]
 *   Hai đường dẫn nhận được từ ngoài CHỈ để spec chỉ vào fixture. Phép đối chứng ÂM là thứ duy nhất
 *   chứng minh gate này gác được gì — và nó cần một danh mục sai để chạy thử, nên không thể ghim cứng
 *   đường dẫn thật. Đợt này đã có một gate đọc sai tên khoá nên luôn mở, và chỉ phép đối chứng âm tìm ra.
 */
function kiem(opts = {}) {
  const duongDanhMuc = opts.duongDanhMuc || DUONG_DANH_MUC;
  const duongSchema = opts.duongSchema || DUONG_SCHEMA;
  const loi = [];
  const canhBao = [];

  let schema;
  try { schema = JSON.parse(fs.readFileSync(duongSchema, 'utf8')); } catch (e) {
    return { loi: 'khong-doc-duoc-schema', chiTiet: e.message };
  }
  let dm;
  try { dm = JSON.parse(fs.readFileSync(duongDanhMuc, 'utf8')); } catch (e) {
    return { loi: 'khong-doc-duoc-danh-muc', chiTiet: e.message };
  }

  /* 1 — HÌNH DẠNG. `schema_mini` NÉM khi schema có từ khoá nó không hiểu; để lỗi đó nổi lên nguyên văn. */
  const kq = schemaMini.kiem(dm, schema);
  for (const x of kq.loi) loi.push({ phep: 1, y: x });

  const buoc = Array.isArray(dm.buoc) ? dm.buoc : [];

  /*
   * 4 — TRÙNG `id` giữa hai MỤC của mảng `buoc`.
   *
   * Đọc từ đối tượng đã parse, không quét văn bản thô. Bản đầu của phép này quét
   * `/"id"\s*:\s*"([^"]+)"/g` trên cả file và báo `id "string" xuất hiện 4 lần` — vì nó ăn luôn
   * `"id": "string"` nằm trong các khối `params`. Đó là lần thứ sáu trong hai đợt này một bộ dò bằng
   * chữ của tôi khớp đúng chữ ở sai tầng.
   *
   * Khoá TRÙNG trong cùng một đối tượng là việc khác, và đã có máy khác gác: `khoaTrung()` trong
   * `scripts/qa/json_check.js` (v2.7.0 §A11). Không làm lại ở đây.
   */
  const demId = new Map();
  for (const b of buoc) {
    if (typeof b.id !== 'string') continue;
    demId.set(b.id, (demId.get(b.id) || 0) + 1);
  }
  for (const [id, n] of demId) {
    if (n > 1) loi.push({ phep: 4, y: `\`id\` "${id}" xuất hiện ${n} lần — mục sau GHI ĐÈ mục trước, im lặng.` });
  }

  const nguPhap = sm.napNguPhap();
  if (nguPhap.thieu) {
    canhBao.push({ phep: 5, y: 'thiếu `.agent/config/step_phrasing.json` ⇒ phép kiểm trùng cách diễn đạt đang chạy KHÔNG gộp đồng nghĩa, nên nó bỏ sót cặp chỉ khác động từ (`bấm nút {}` vs `kích nút {}`).' });
  }

  const mauDaThay = new Map(); /* câu đã chuẩn hoá -> [id bước] */

  for (const b of buoc) {
    const nhan = b.id || '(thiếu id)';

    /* 2 — `impl` TRỎ TỚI HÀM CÓ THẬT. */
    if (typeof b.impl === 'string' && b.impl.includes('#')) {
      const [relFile, tenHam] = b.impl.split('#');
      const abs = path.join(REPO, relFile);
      if (!fs.existsSync(abs)) {
        loi.push({ phep: 2, y: `${nhan}: \`impl\` trỏ tới file không tồn tại — ${relFile}` });
      } else if (!coExport(fs.readFileSync(abs, 'utf8'), tenHam)) {
        loi.push({ phep: 2, y: `${nhan}: ${relFile} không export \`${tenHam}\` — danh mục khai một hàm chưa viết.` });
      }
    }

    /* 3 — `params` KHỚP chỗ trống trong `phrases`. */
    const khaiParam = new Set(Object.keys(b.params || {}));
    const dungTrongCau = new Set();
    for (const p of b.phrases || []) {
      for (const m of String(p).matchAll(RE_CHO_TRONG)) dungTrongCau.add(m[1]);
    }
    for (const t of dungTrongCau) {
      if (!khaiParam.has(t)) loi.push({ phep: 3, y: `${nhan}: \`phrases\` dùng {${t}} mà \`params\` không khai — §D sẽ gọi hàm thiếu đối số.` });
    }
    for (const t of khaiParam) {
      if (!dungTrongCau.has(t)) {
        canhBao.push({ phep: 3, y: `${nhan}: \`params.${t}\` không xuất hiện trong \`phrases\` nào — câu khớp vào bước này sẽ không bao giờ điền được tham số đó.` });
      }
    }

    /* 5 — TRÙNG CÁCH DIỄN ĐẠT giữa hai bước. */
    for (const p of b.phrases || []) {
      const chuan = sm.chuanHoaMau(p, nguPhap);
      if (!mauDaThay.has(chuan)) mauDaThay.set(chuan, []);
      mauDaThay.get(chuan).push({ id: nhan, goc: p });
    }

    /* 6 — `widget` trỏ tới L0.5 có thật. */
    for (const w of b.widget || []) {
      const abs = path.join(REPO, 'tests', 'fe', 'lib', '_widget', `${w}.ts`);
      if (!fs.existsSync(abs)) {
        loi.push({ phep: 6, y: `${nhan}: \`widget\` khai "${w}" nhưng không có tests/fe/lib/_widget/${w}.ts` });
      }
    }

    /* `draft` không phải lỗi, nhưng mẫu số của nó phải hiện ra ở báo cáo. */
    if (b.status === 'active' && (b.thong_ke || {}).ti_le_on_dinh === null) {
      loi.push({ phep: 1, y: `${nhan}: \`status: active\` mà \`ti_le_on_dinh: null\` (CHƯA ĐO) — không thể thăng một bước chưa chạy lần nào.` });
    }
  }

  for (const [chuan, ds] of mauDaThay) {
    const idKhac = [...new Set(ds.map((x) => x.id))];
    if (idKhac.length > 1) {
      loi.push({
        phep: 5,
        y: `cách diễn đạt "${chuan}" thuộc ${idKhac.length} bước khác nhau (${idKhac.join(', ')}) — \`steps:match\` sẽ chọn theo THỨ TỰ MẢNG, tức theo một chi tiết không ai cố ý.`,
      });
    } else if (ds.length > 1) {
      canhBao.push({ phep: 5, y: `${idKhac[0]}: ${ds.length} \`phrases\` cùng quy về "${chuan}" (${ds.map((x) => JSON.stringify(x.goc)).join(' · ')}) — dư, không sai.` });
    }
  }

  return { so_buoc: buoc.length, so_phrases: [...mauDaThay.keys()].length, loi, canh_bao: canhBao };
}

function main() {
  let d;
  try { d = kiem(); } catch (e) {
    if (e instanceof schemaMini.SchemaMiniError) {
      console.error(`[steps-catalog] ✗ SCHEMA SAI, không phải dữ liệu sai:\n  ${e.message}`);
      process.exit(2);
    }
    throw e;
  }

  if (d.loi === 'khong-doc-duoc-schema' || d.loi === 'khong-doc-duoc-danh-muc') {
    console.error(`[steps-catalog] CHƯA ĐƯỢC GÁC — ${d.loi}: ${d.chiTiet}`);
    process.exit(2);
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(d, null, 2));
    process.exit(d.loi.length ? 1 : 0);
  }

  console.log(`[steps-catalog] ${d.so_buoc} bước · ${d.so_phrases} cách diễn đạt (sau chuẩn hoá) · ${d.loi.length} vi phạm · ${d.canh_bao.length} cảnh báo`);

  if (!d.so_buoc) {
    console.log('');
    console.log('○ Danh mục có 0 bước. Đây không phải "danh mục hợp lệ", mà là "chưa có gì để gác".');
  }

  if (d.canh_bao.length) {
    console.log('');
    console.log('~ Cảnh báo:');
    for (const c of d.canh_bao) console.log(`  [phép ${c.phep}] ${c.y}`);
  }

  if (d.loi.length) {
    console.error('');
    console.error('✗ CHẶN:');
    for (const c of d.loi) console.error(`  [phép ${c.phep}] ${c.y}`);
    console.error('');
    console.error('  Phép 2 (`impl` có thật) là phép đáng giá nhất ở đây: một danh mục mà `impl` là hàm chưa');
    console.error('  viết thì nó là bản kê ước nguyện, và mọi tỉ lệ "dùng lại" tính trên nó là con số bịa.');
    process.exit(1);
  }

  console.log('');
  console.log('✓ Hình dạng đúng schema · mọi `impl` trỏ tới hàm có thật · không có câu nào thuộc hai bước.');
}

if (require.main === module) main();

module.exports = { kiem, coExport, RE_CHO_TRONG, DUONG_DANH_MUC, DUONG_SCHEMA };
