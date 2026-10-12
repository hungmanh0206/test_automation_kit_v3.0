#!/usr/bin/env node
'use strict';
/*
 * steps:reverify — DANH MỤC PHẢN ỨNG VỚI MÀN ĐỔI VÀ VỚI BƯỚC KHÔNG AI DÙNG (v2.8.0 §E, dòng 2 và 4).
 *
 * Hai chuyển trạng thái:
 *
 *   `active` → `needs_reverify`  khi discovery `delta` thấy màn của bước đã đổi.
 *   `active` → `deprecated`      ĐỀ XUẤT khi không spec nào dùng bước đó — không tự xoá.
 *
 * BA CHỖ DỄ LÀM SAI, và cả ba đều làm tín hiệu thành vô dụng theo cách ngược nhau:
 *
 *   1. **Bước khai `screen: "*"` không được đổ đồng theo mọi màn.** Bước tầng widget áp cho mọi màn;
 *      nếu hễ màn nào đổi là chúng chuyển `needs_reverify` thì cả danh mục đỏ sau mỗi lượt discovery,
 *      và một tín hiệu luôn bật thì không còn là tín hiệu. Ở đây chúng chỉ bị đánh dấu khi chính
 *      WIDGET chúng khai biến mất khỏi một màn — mối liên hệ đó đo được, chứ không suy.
 *
 *   2. **`screen_fingerprint: null` là CHƯA CÓ DẤU, không phải "dấu vẫn khớp".** Bước chưa từng kiểm
 *      chứng thì không có gì để so; nói nó "không bị ảnh hưởng" là khai một kết luận từ một phép đo
 *      chưa làm. Chúng được xếp riêng vào `khong_ket_luan_duoc`.
 *
 *   3. **`deprecated` chỉ là ĐỀ XUẤT.** Quét 0 spec sinh tự động cũng ra "không ai dùng" — đúng chữ,
 *      sai nghĩa. Nên script từ chối đề xuất `deprecated` khi mẫu số spec bằng 0.
 *
 * Dùng:
 *   node scripts/qa/reuse/steps_reverify.js --delta <file-delta.json> [--ghi]
 *   node scripts/qa/reuse/steps_reverify.js --de-xuat-deprecated
 * Exit: 0 · 2 khi thiếu đầu vào để kết luận (CHƯA ĐƯỢC GÁC)
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const sm = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'steps_match.js'));
const si = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'steps_impact.js'));

/**
 * Bước nào bị ảnh hưởng bởi một khối delta?
 *
 * Trả ba nhóm — và ba nhóm, không phải hai: `anh_huong` · `khong_anh_huong` · `khong_ket_luan_duoc`.
 * Gộp nhóm thứ ba vào nhóm thứ hai là biến "chưa biết" thành "đã biết là không sao".
 */
function anhHuongTuDelta(danhMuc, delta) {
  const manDoi = new Set([
    ...(delta.man_doi || []).map((m) => m.route),
    ...(delta.man_mat || []),
  ]);
  /* Component biến mất ở BẤT KỲ màn nào — đây là đường duy nhất một bước `screen: "*"` bị đánh dấu. */
  const componentMat = new Set();
  for (const m of delta.man_doi || []) for (const c of m.component_mat || []) componentMat.add(sm.boDau(c));

  const anhHuong = [];
  const khongAnhHuong = [];
  const khongKetLuan = [];

  for (const b of danhMuc.buoc) {
    if (b.status !== 'active') {
      khongKetLuan.push({ id: b.id, vi_sao: `đang ở \`${b.status}\` — chuyển này chỉ áp cho \`active\`` });
      continue;
    }
    const dauCu = (b.thong_ke || {}).screen_fingerprint;
    if (dauCu === null || dauCu === undefined) {
      khongKetLuan.push({
        id: b.id,
        vi_sao: '`screen_fingerprint` là `null` (CHƯA CÓ DẤU) — không có gì để so, nên không kết luận được là có bị ảnh hưởng hay không.',
      });
      continue;
    }

    if (b.screen === '*') {
      const wTrung = (b.widget || []).filter((w) => componentMat.has(sm.boDau(w)));
      if (wTrung.length) anhHuong.push({ id: b.id, vi_sao: `widget \`${wTrung.join(', ')}\` biến mất khỏi màn đã đổi` });
      else khongAnhHuong.push({ id: b.id, vi_sao: '`screen: "*"` và widget vẫn còn — không đổ đồng theo mọi màn' });
      continue;
    }

    if (manDoi.has(b.screen)) anhHuong.push({ id: b.id, vi_sao: `màn \`${b.screen}\` đổi hoặc biến mất` });
    else khongAnhHuong.push({ id: b.id, vi_sao: `màn \`${b.screen}\` không nằm trong delta` });
  }

  return { anh_huong: anhHuong, khong_anh_huong: khongAnhHuong, khong_ket_luan_duoc: khongKetLuan };
}

function ghiNeedsReverify(ds) {
  const duong = sm.DUONG_DANH_MUC;
  const dm = JSON.parse(fs.readFileSync(duong, 'utf8'));
  const can = new Set(ds.map((x) => x.id));
  const doi = [];
  for (const b of dm.buoc) {
    if (!can.has(b.id) || b.status !== 'active') continue;
    b.status = 'needs_reverify';
    doi.push(b.id);
  }
  fs.writeFileSync(duong, `${JSON.stringify(dm, null, 2)}\n`, 'utf8');
  return doi;
}

/** ĐỀ XUẤT `deprecated`. Từ chối khi mẫu số spec bằng 0 — xem ghi chú 3 ở đầu file. */
function deXuatDeprecated() {
  const dm = sm.napDanhMuc();
  if (!dm) return { loi: 'không đọc được danh mục' };
  const { theo, so_file } = si.aiDangDung();
  if (!so_file) {
    return {
      loi: 'quét 0 spec sinh tự động ⇒ KHÔNG đề xuất `deprecated` cho bước nào. "Không ai dùng" và '
        + '"chưa có spec nào được sinh ra" cho cùng một con số 0, và chúng là hai chuyện khác hẳn nhau.',
    };
  }
  return {
    so_spec_quet: so_file,
    de_xuat: dm.buoc.filter((b) => b.status === 'active' && !(theo.get(b.id) || []).length)
      .map((b) => ({ id: b.id, vi_sao: `không case nào trong ${so_file} spec đang dùng` })),
    _chi_de_xuat: 'CHỈ ĐỀ XUẤT. Không xoá mục, không xoá file — cùng luật với `deXuatChayLai` của discovery.',
  };
}

function main() {
  const argv = process.argv;
  const val = (n) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
  };
  const json = argv.includes('--json');

  if (argv.includes('--de-xuat-deprecated')) {
    const d = deXuatDeprecated();
    if (json) { console.log(JSON.stringify(d, null, 2)); return; }
    if (d.loi) { console.error(`[steps-reverify] CHƯA ĐƯỢC GÁC — ${d.loi}`); process.exit(2); }
    console.log(`[steps-reverify] quét ${d.so_spec_quet} spec · đề xuất \`deprecated\`: ${d.de_xuat.length} bước`);
    for (const x of d.de_xuat) console.log(`  ${x.id}  — ${x.vi_sao}`);
    console.log('');
    console.log('CHỈ ĐỀ XUẤT. Không xoá mục khi còn spec tham chiếu.');
    return;
  }

  const fDelta = val('delta');
  if (!fDelta) {
    console.error('[steps-reverify] CHƯA ĐƯỢC GÁC — thiếu `--delta <file.json>`.');
    console.error('                Không có delta thì không biết màn nào đổi, và một lượt chạy không đầu vào');
    console.error('                sẽ in "0 bước bị ảnh hưởng" — đúng chữ, sai nghĩa.');
    process.exit(2);
  }
  let delta;
  try { delta = JSON.parse(fs.readFileSync(path.resolve(REPO, fDelta), 'utf8')); } catch (e) {
    console.error(`[steps-reverify] CHƯA ĐƯỢC GÁC — không đọc được delta: ${e.message}`);
    process.exit(2);
  }

  const dm = sm.napDanhMuc();
  if (!dm) { console.error('[steps-reverify] CHƯA ĐƯỢC GÁC — không đọc được danh mục.'); process.exit(2); }

  const d = anhHuongTuDelta(dm, delta);
  if (json) { console.log(JSON.stringify(d, null, 2)); return; }

  console.log(`[steps-reverify] ${dm.buoc.length} bước · ${d.anh_huong.length} bị ảnh hưởng · ${d.khong_anh_huong.length} không · ${d.khong_ket_luan_duoc.length} KHÔNG KẾT LUẬN ĐƯỢC`);

  if (d.anh_huong.length) {
    console.log('');
    console.log('→ `active` → `needs_reverify`:');
    for (const x of d.anh_huong) console.log(`  ${x.id}  — ${x.vi_sao}`);
  }

  if (d.khong_ket_luan_duoc.length) {
    console.log('');
    console.log('? Không kết luận được (KHÁC với "không bị ảnh hưởng"):');
    for (const x of d.khong_ket_luan_duoc) console.log(`  ${x.id}  — ${x.vi_sao}`);
  }

  if (argv.includes('--ghi')) {
    const doi = ghiNeedsReverify(d.anh_huong);
    console.log('');
    console.log(`✓ Đã chuyển ${doi.length} bước sang \`needs_reverify\`${doi.length ? `: ${doi.join(' · ')}` : ''}`);
  } else if (d.anh_huong.length) {
    console.log('');
    console.log('(chưa ghi — thêm `--ghi`)');
  }
}

if (require.main === module) main();

module.exports = { anhHuongTuDelta, ghiNeedsReverify, deXuatDeprecated };
