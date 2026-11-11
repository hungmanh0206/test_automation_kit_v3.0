#!/usr/bin/env node
/**
 * tc_semantic.js — CHẤM NGỮ NGHĨA bộ testcase: đối chiếu từng case với RÀNG BUỘC trong bảng trường của đặc tả.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ MÁY NÀY
 *
 * Người review (P1): *"Phải đo testcase AI có expected đúng nghiệp vụ, có thiếu negative/boundary và có
 * giả định sai không."* Kiểm kê 11/11/2026 cho thấy ba trục đó có máy theo HÌNH THỨC, không theo NỘI DUNG:
 *   · `output_gate` / `domain_rules` — expected có NGUỒN, không tautology. `expected_ledger` gác việc ĐỔI
 *     expected (chụp mốc, đòi lý do). Cả ba nhìn nguồn và lịch sử của expected; phần đối chiếu NỘI DUNG
 *     expected với ràng buộc đặc tả (đặc tả "tối đa 150", case kỳ vọng 250) là việc của máy này.
 *   · `design_gate` — đếm ≥1 `[Negative]` cho CẢ BỘ. Một bộ 300 case có đúng một case negative là "đạt".
 *   · giả định sai (case coi một trường là bắt buộc trong khi đặc tả ghi N) — không máy nào đo.
 *
 * Nguồn sự thật ở đây là bảng trường của đặc tả (`requirements/*.md`, cột Bắt buộc + mô tả ràng buộc) —
 * ĐỘC LẬP với bộ case và với app. Máy không đọc app, nên không thể "app == app".
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * BA ĐẦU RA, đúng ba trục của người review
 *
 *   ① NGHĨA VỤ CHƯA PHỦ (thiếu negative/boundary) — mỗi trường SỬA ĐƯỢC có ràng buộc sinh nghĩa vụ:
 *        bắt buộc      → phải có case bỏ trống và kỳ vọng bị chặn
 *        tối đa N ký tự → phải có case thử N+1
 *        chỉ nhận số   → phải có case nhập chữ / ký tự đặc biệt
 *        tối đa N chữ số → phải có case thử N+1 chữ số
 *   ② MÂU THUẪN ĐẶC TẢ (expected sai nghiệp vụ) — case thử biên độ dài ở một con số KHÔNG phải N, N+1
 *      (cũng không phải N-1) của đặc tả, mà không khai đó là chủ đích ("mâu thuẫn", "xác minh giới hạn").
 *   ③ GIẢ ĐỊNH SAI — case coi trường là BẮT BUỘC (kỳ vọng "báo bắt buộc") trong khi đặc tả ghi N; hoặc
 *      case bỏ trống trường bắt buộc mà kỳ vọng LƯU THÀNH CÔNG.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * NEO CASE ↔ TRƯỜNG — và vì sao không chỉ neo bằng `Stt`
 *
 * Đo 11/11/2026: case nhắc `Stt N` ở 9001 150/223 · 9002 29/150 · 9003 **0/291** · 9004 5/298. Chỉ neo bằng
 * Stt thì 9003 "đạt" vì máy KHÔNG THẤY GÌ — đúng lỗi đo trên tập con đã mắc hai lần trong một phiên. Nên neo
 * thêm bằng TÊN trường khi tên đó DUY NHẤT trong đặc tả và đủ dài; tên trùng ("Máy để bàn" ×3) thì KHÔNG
 * đoán — ghi vào "không neo được".
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * "KHÔNG PHÁN ĐƯỢC" ≠ "ĐẠT"
 *
 * Không tìm thấy bảng trường (task biểu báo cáo như 4008) ⇒ exit 2, KHÔNG PHÁN ĐƯỢC. Trường không có ràng
 * buộc đọc được ⇒ không sinh nghĩa vụ, và được ĐẾM ra để người đọc biết mẫu số. Giai đoạn 1: chỉ BÁO CÁO.
 *
 * Dùng:
 *   node scripts/qa/tc_semantic.js --task CSDL-9001 [--project-output outputs/CSDL] [--json] [--chi-tiet]
 *   node scripts/qa/tc_semantic.js --spec <đặc tả.md> --cases <testcase.md> [--json]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');

/* ─────────────────────────────── đọc bảng markdown ─────────────────────────────── */

const tachO = (dong) => {
  const s = dong.trim().replace(/^\|/, '').replace(/\|$/, '');
  return s.split('|').map((x) => x.trim());
};
const chuan = (s) => String(s || '').normalize('NFC').replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

/** Bảng trường của đặc tả: tìm tiêu đề có cột Stt + Bắt buộc, đọc cột THEO TÊN (tiêu đề khác nhau giữa task). */
function docBangTruong(md) {
  const dong = md.split(/\r?\n/);
  const truong = [];
  for (let i = 0; i < dong.length; i += 1) {
    if (!/^\|/.test(dong[i])) continue;
    const h = tachO(dong[i]).map(chuan);
    const iStt = h.findIndex((x) => x === 'stt');
    const iBb = h.findIndex((x) => x.startsWith('bắt buộc'));
    /* Chỉ BẢNG TRƯỜNG ("Trường trên màn hình"). Đặc tả 9004 còn một bảng "bắt buộc khi…" cũng có cột Stt —
     * đọc nhầm nó thì Stt 15 "Tôn giáo" bị đè bằng "Mức phụ cấp ưu đãi nghề" (đọc tay 11/11/2026). */
    const iTen = h.findIndex((x) => x.startsWith('trường trên màn hình') || x.startsWith('tên trường'));
    if (iStt < 0 || iBb < 0 || iTen < 0) continue;
    const iCtl = h.findIndex((x) => x.startsWith('control') || x.startsWith('kiểu control'));
    for (let j = i + 2; j < dong.length && /^\|/.test(dong[j]); j += 1) {
      const o = tachO(dong[j]);
      const stt = (o[iStt] || '').trim();
      if (!/^\d+[a-z]?$/i.test(stt)) continue;
      const conLai = o.filter((_, k) => ![iStt, iTen, iBb].includes(k)).join(' · ');
      if (truong.some((t) => t.stt === stt)) continue; // Stt trùng ⇒ giữ dòng đầu, không đè
      truong.push({
        stt, ten: (o[iTen] || '').replace(/\*\*/g, '').trim(), control: iCtl >= 0 ? (o[iCtl] || '') : '',
        batBuoc: (o[iBb] || '').trim(), rangBuoc: conLai,
      });
    }
    i += 1;
  }
  return truong;
}

/** Bảng case canonical: cột TC ID + các cột nội dung, đọc theo tên. */
function docBangCase(md) {
  const dong = md.split(/\r?\n/);
  const ca = [];
  let cot = null;
  for (const d of dong) {
    if (!/^\|/.test(d)) { continue; }
    const o = tachO(d);
    if (!cot) {
      const h = o.map(chuan);
      if (h[0] === 'tc id' || h.includes('tc id')) cot = h;
      continue;
    }
    if (/^-+$/.test((o[0] || '').replace(/[:\s]/g, ''))) continue;
    if (chuan(o[0]) === 'tc id') { cot = o.map(chuan); continue; }
    const id = (o[cot.indexOf('tc id')] || '').trim();
    if (!/_TC_\d+/.test(id)) continue;
    const lay = (ten) => { const k = cot.findIndex((x) => x.startsWith(ten)); return k >= 0 ? (o[k] || '') : ''; };
    ca.push({
      id, tag: lay('tag'), tieuDe: lay('trường hợp'), tienDe: lay('tiền điều kiện'), duLieu: lay('dữ liệu'),
      buoc: lay('các bước'), kyVong: lay('kết quả mong đợi'),
    });
  }
  return ca;
}

/* ─────────────────────────────── ràng buộc → nghĩa vụ ─────────────────────────────── */

/* `Y (đk)` / `Y khi …` là bắt buộc CÓ ĐIỀU KIỆN, không phải tuyệt đối — 9004 có nhiều trường như vậy, đọc thành
 * tuyệt đối thì mọi case "nhánh không áp điều kiện, để trống vẫn lưu được" thành giả định sai (đọc tay 11/11). */
const CO_DIEU_KIEN = /đk|điều kiện|\bkhi\b|nếu/i;
const LA_BAT_BUOC = (s) => /^(y|yes|có|x|✓|✔|bắt buộc)\b/i.test(String(s).trim()) && !CO_DIEU_KIEN.test(String(s));
/* "Chỉ view" và "trường không tự sửa" thêm 11/11/2026 sau khi đọc tay 9001: Stt 1/6/7 bị gán nghĩa vụ
 * "bỏ trống phải bị chặn" trong khi màn trường không sửa được chúng. */
const CHI_DOC = /chỉ đọc|🔒|tự tính|tự sinh|hệ thống tự|không nhập tay|chỉ xem|chỉ view|không tự sửa|readonly|disabled|tự động (lấy|điền|sinh)/i;
/* Nghĩa vụ độ dài / kiểu số chỉ có nghĩa ở ô GÕ được. Combobox `nvarchar(20)` là kiểu cột DB, không ai gõ vào
 * — đọc tay 9001: 5 nghĩa vụ "biên độ dài" giả ở Stt 6/7/9/20/24, cả năm là combobox. */
const O_GO_DUOC = /^(textbox|textarea|text|input|ô nhập|numeric|number)/i;

function rangBuocCua(t) {
  const r = chuan(t.rangBuoc);
  const goDuoc = O_GO_DUOC.test(t.control.trim());
  const out = {
    batBuoc: LA_BAT_BUOC(t.batBuoc),
    /* Bắt buộc CÓ ĐIỀU KIỆN: cột ghi N nhưng mô tả có câu "bắt buộc" (vd "Riêng sở HCM đây là yêu cầu bắt
     * buộc" — Stt 28 9001). Không sinh nghĩa vụ, và KHÔNG coi case "báo bắt buộc" là giả định sai. */
    batBuocCoDieuKien: (/^y/i.test(String(t.batBuoc).trim()) && CO_DIEU_KIEN.test(String(t.batBuoc)))
      || (!LA_BAT_BUOC(t.batBuoc) && /bắt buộc/.test(r.replace(/không bắt buộc/g, ''))),
    chiDoc: CHI_DOC.test(t.rangBuoc) || /^label$|^hiển thị$/i.test(t.control.trim()),
    goDuoc,
  };
  /* MÔ TẢ THẮNG KIỂU CỘT DB. Stt 3 9001: `nvarchar(50)` nhưng mô tả "đủ 12 chữ số" — biên thật là 12. */
  const mDigDu = r.match(/đủ\s*(\d+)\s*chữ số/);
  const mDig = r.match(/tối đa\s*(\d+)\s*chữ số/);
  /* MỌI biên độ dài, không chỉ biên đầu: 9002 Tên lớp "Mầm non tối đa 50, phổ thông tối đa 200" — lấy mỗi số
   * đầu thì case thử 200 ở cấp THCS bị gán "lệch đặc tả" (đọc tay 11/11/2026). */
  const lens = [...r.matchAll(/(?:tối đa|không quá)\s*(\d+)\s*ký tự/g)].map((m) => Number(m[1]));
  if (mDigDu) { out.maxDigits = Number(mDigDu[1]); out.duChuSo = true; } else if (mDig) out.maxDigits = Number(mDig[1]);
  if (lens.length) { out.maxLens = [...new Set(lens)]; out.nguonLen = 'mô tả'; }
  else if (!out.maxDigits) { const mDb = r.match(/n?varchar\s*\(\s*(\d+)\s*\)/); if (mDb) { out.maxLens = [Number(mDb[1])]; out.nguonLen = 'kiểu cột DB'; } }
  if (out.maxLens) out.maxLen = Math.max(...out.maxLens);
  if (/chỉ nhận số|chỉ được nhập số|số nguyên|số dương|chỉ nhập số|kiểu số|chỉ chữ số|chỉ gồm chữ số/.test(r) || out.maxDigits) out.so = true;
  return out;
}

function nghiaVuCua(t, rb) {
  if (rb.chiDoc) return [];
  const nv = [];
  if (rb.batBuoc) nv.push('bat_buoc_bo_trong');
  if (!rb.goDuoc) return nv;
  if (rb.maxLen) nv.push('bien_do_dai');
  if (rb.so) nv.push('nhap_chu_vao_o_so');
  if (rb.maxDigits) nv.push('bien_chu_so');
  return nv;
}

/* ─────────────────────────────── neo case ↔ trường ─────────────────────────────── */

const SAN_TEN = 8; // tên ngắn hơn thì dễ khớp nhầm ("Fax", "Email") — chỉ neo bằng Stt

function lapChiMuc(truong) {
  const demTen = new Map();
  for (const t of truong) demTen.set(chuan(t.ten), (demTen.get(chuan(t.ten)) || 0) + 1);
  return { theoStt: new Map(truong.map((t) => [t.stt, t])), demTen };
}

function neoCase(c, truong, cm) {
  const van = [c.tieuDe, c.duLieu, c.buoc, c.kyVong].join(' ');
  const ra = new Map();
  for (const m of van.matchAll(/Stt\s*(\d+[a-z]?)/gi)) { const t = cm.theoStt.get(m[1]); if (t) ra.set(t.stt, 'stt'); }
  /* TÊN DÀI NHẤT TRƯỚC, và tiêu thụ chỗ đã khớp: "Mã định danh" (Stt 2) nằm lọt trong "Mã định danh tổ chức"
   * (Stt 3) — khớp tên ngắn trước thì case của Stt 3 bị neo cả vào Stt 2 (9001 TC_019/020, đọc tay 11/11/2026). */
  let vanC = chuan(van);
  for (const t of [...truong].sort((a, b) => chuan(b.ten).length - chuan(a.ten).length)) {
    const ten = chuan(t.ten);
    if (ten.length < SAN_TEN || cm.demTen.get(ten) > 1) continue;
    if (vanC.includes(ten)) { if (!ra.has(t.stt)) ra.set(t.stt, 'ten'); vanC = vanC.split(ten).join(' ⟂ '); }
  }
  return ra;
}

/* ─────────────────────────────── đọc ý của một case ─────────────────────────────── */

const BI_CHAN = /chặn|không cho lưu|không lưu được|báo lỗi|thông báo .*(bắt buộc|lỗi|không hợp lệ)|bắt buộc nhập|yêu cầu nhập|không hợp lệ|từ chối/i;
const LUU_DUOC = /lưu thành công|cập nhật thành công|ghi thành công|cho lưu/i;
const CHU_VAO_SO = /nhập chữ|chữ cái|ký tự chữ|ký tự đặc biệt|không phải số|`[a-z]{2,}`|abc/i;
const KHAI_CHU_DICH = /mâu thuẫn|xác minh giới hạn|lệch (giữa|với) đặc tả|khác đặc tả|giới hạn thật/i;

/**
 * Case có BỎ TRỐNG ĐÚNG TRƯỜNG NÀY không — dấu trống phải nằm SÁT tên trường hoặc `Stt N`.
 * Bản đầu chỉ hỏi "câu nào đó có chữ rỗng": 9003 TC_112 ("bảng vẫn rỗng") và 9004 TC_127 (bỏ trống Email,
 * nhưng neo vào CCCD) đều bị gán "bỏ trống trường bắt buộc mà cho lưu" (đọc tay 11/11/2026).
 */
/*
 * Lần sửa thứ hai (cùng ngày): chỉ đọc CỘT DỮ LIỆU và TIÊU ĐỀ, tách TỪNG DÒNG theo `<br>`/`;`, và dòng đó phải
 * chứa đúng trường mà KHÔNG có "nhập/điền/gõ/dán/chọn". Lý do, đọc tay:
 *   · 9001 TC_023 — bước "Xoá trắng ô Stt 18 Vĩ tuyến, nhập `8.0`" là cách viết THAY giá trị, không phải bỏ trống;
 *   · 9004 TC_031 — `Môn dạy: ""` đứng ngay trước `Số CMND/CCCD: 000…`; `chuan()` đổi `<br>` thành dấu cách nên
 *     ranh giới hai dòng biến mất và CCCD bị coi là bỏ trống.
 */
const thoatRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
/* Tên trường hoặc `Stt N` như một TỪ trọn — `stt 1` không được khớp vào giữa `stt 14` (9003 TC_024, đọc tay). */
const mauNhan = (t) => [chuan(t.ten), `stt ${t.stt}`].filter((x) => x.length >= 4)
  .map((n) => `${thoatRe(n)}(?![0-9a-zà-ỹ])`);
/*
 * Lần sửa thứ ba: trong TIÊU ĐỀ, dấu trống phải đứng NGAY TRƯỚC tên trường ("Để trống Nhóm chức vụ"); một tiêu đề
 * nhắc hai trường thì trường kia không bị kéo theo (9004 TC_033: "Vị trí việc làm = Giáo viên - Để trống Nhóm
 * chức vụ" bị gán bỏ trống Vị trí việc làm). Trong CỘT DỮ LIỆU, khuôn là "Trường: `""`" trên cùng một dòng.
 */
function boTrongTruong(c, t) {
  const m = mauNhan(t);
  const TRONG = '(""|`""`|để trống|bỏ trống|xoá trắng|xóa trắng|để rỗng|không nhập|giá trị rỗng)';
  const tieuDe = chuan(c.tieuDe);
  if (m.some((n) => new RegExp(`${TRONG}[^-–|]{0,12}["“]?${n}`).test(tieuDe))) return true;
  const dong = String(c.duLieu).split(/<br\s*\/?>|;|\n/i).map(chuan).filter(Boolean);
  return dong.some((d) => m.some((n) => new RegExp(`(^|[^0-9a-zà-ỹ])${n}[^0-9a-zà-ỹ]{0,4}[^|]{0,30}${TRONG}`).test(d))
    && !/nhập\s*`|điền|gõ\s|dán|chọn\s/.test(d.replace(/không nhập/g, '')));
}

function phuNghiaVu(nv, t, rb, c) {
  const van = [c.tieuDe, c.duLieu, c.buoc].join(' ');
  const kv = c.kyVong;
  if (nv === 'bat_buoc_bo_trong') return boTrongTruong(c, t) && BI_CHAN.test(kv);
  if (nv === 'nhap_chu_vao_o_so') return CHU_VAO_SO.test(van) && BI_CHAN.test(kv);
  if (nv === 'bien_do_dai') {
    return rb.maxLens.some((n) => new RegExp(`(^|[^0-9])${n + 1}([^0-9]|$)`).test(van));
  }
  if (nv === 'bien_chu_so') {
    const n1 = rb.maxDigits + 1;
    const nTru = rb.maxDigits - 1;
    /* "đủ N chữ số" thì thiếu MỘT chữ số cũng là biên; "tối đa N" thì chỉ N+1. */
    const mau = [`(^|[^0-9])${n1}\\s*chữ số`, `1${'0'.repeat(rb.maxDigits)}([^0-9]|$)`];
    if (rb.duChuSo && nTru > 0) mau.push(`(^|[^0-9])${nTru}\\s*chữ số`);
    return new RegExp(mau.join('|')).test(van);
  }
  return false;
}

/**
 * Con số biên độ dài mà case KHẲNG ĐỊNH — chỉ ở tiêu đề và kỳ vọng, KHÔNG ở cột dữ liệu: dữ liệu hay GHÉP chuỗi
 * ("`6A` + 198 ký tự `x`, tổng đúng 200") và 198 không phải biên (9002 TC_010, đọc tay 11/11/2026).
 */
function soBienDoDai(c) {
  const van = [c.tieuDe, c.kyVong].join(' ');
  const so = new Map(); // số → có được case KHẲNG ĐỊNH là giới hạn không
  /* Từ giới hạn phải đứng NGAY TRƯỚC con số, không con số nào chen giữa: trong '"không quá 250 ký tự") thì 26 ký tự
   * PHẢI lưu được', chữ "không quá" là của 250, không phải của 26 (9003 TC_025, đọc tay 11/11/2026). */
  const GIOI_HAN = /(tối đa|giới hạn|biên|chặn|cắt|không quá|vượt)[^0-9.<]{0,14}$/i;
  for (const m of van.matchAll(/(\d{2,4})\s*(?:ký tự|lần)/gi)) {
    const truoc = van.slice(Math.max(0, m.index - 40), m.index);
    so.set(Number(m[1]), (so.get(Number(m[1])) || false) || GIOI_HAN.test(truoc));
  }
  return [...so.entries()].map(([n, laGioiHan]) => ({ n, laGioiHan }));
}

/* ─────────────────────────────── chấm ─────────────────────────────── */

function cham(specMd, casesMd) {
  const truong = docBangTruong(specMd);
  const ca = docBangCase(casesMd);
  if (!truong.length) return { phanDuoc: false, lyDo: 'không tìm thấy bảng trường (cột Stt + Trường + Bắt buộc) trong đặc tả' };
  if (!ca.length) return { phanDuoc: false, lyDo: 'không đọc được case nào (thiếu cột TC ID)' };

  const cm = lapChiMuc(truong);
  const neo = new Map(ca.map((c) => [c.id, neoCase(c, truong, cm)]));
  const caTheoTruong = new Map();
  for (const c of ca) for (const stt of neo.get(c.id).keys()) {
    if (!caTheoTruong.has(stt)) caTheoTruong.set(stt, []);
    caTheoTruong.get(stt).push(c);
  }

  const nghiaVu = [];
  const mauThuan = [];
  const giaDinhSai = [];
  let truongCoRangBuoc = 0;
  let truongChiDoc = 0;

  for (const t of truong) {
    const rb = rangBuocCua(t);
    if (rb.chiDoc) truongChiDoc += 1;
    const nv = nghiaVuCua(t, rb);
    if (nv.length) truongCoRangBuoc += 1;
    const cac = caTheoTruong.get(t.stt) || [];
    for (const v of nv) {
      const phu = cac.filter((c) => phuNghiaVu(v, t, rb, c)).map((c) => c.id);
      /* Case có KHAI CHỦ ĐÍCH xét biên của trường (vd "xác minh giới hạn thật là 20 hay 250") là đã XÉT nghĩa
       * vụ — không đếm vào thiếu, nhưng tách riêng để người đọc thấy nó không thử đúng N+1 của đặc tả. */
      const daKhai = v === 'bien_do_dai' && !phu.length
        ? cac.filter((c) => KHAI_CHU_DICH.test([c.tieuDe, c.kyVong].join(' '))).map((c) => c.id) : [];
      /* Neo được bằng TÊN = tên đủ dài và duy nhất. Trường như vậy mà 0 case nhắc tới thì đó là THIẾU thật
       * (không case nào chạm trường). Chỉ trường KHÔNG neo được bằng tên mới là "máy không phán được".
       * Cấy lỗi 11/11/2026: xoá TC_111 thì 3 trường còn 0 case và bản trước xếp chúng vào "không neo" — lỗi
       * cấy vào bị nuốt im lặng. */
      const neoDuoc = chuan(t.ten).length >= SAN_TEN && cm.demTen.get(chuan(t.ten)) === 1;
      nghiaVu.push({ stt: t.stt, ten: t.ten, nghiaVu: v, phu, daKhai, soCaNeo: cac.length, neoDuoc,
        ...(v === 'bien_do_dai' ? { maxLens: rb.maxLens, nguon: rb.nguonLen } : {}), ...(v === 'bien_chu_so' ? { maxDigits: rb.maxDigits } : {}) });
    }
    /* ③ giả định sai về tính bắt buộc. */
    /* Case QUAN SÁT ("ghi lại chặn hay cho lưu", "nếu bị chặn thì…") không khẳng định gì về tính bắt buộc —
     * 9004 TC_217 bị gán "coi là bắt buộc" vì kỳ vọng nhắc nguyên văn thông báo "bắt buộc nhập" ở nhánh "nếu". */
    const quanSat = (c) => /\[observation\]/i.test(c.tag) || /ghi (lại|nhận)|nếu bị chặn|hay cho lưu|chặn hay/i.test(c.kyVong);
    for (const c of cac.filter((x) => !quanSat(x) && boTrongTruong(x, t))) {
      const kv = c.kyVong;
      const noiBatBuoc = /(báo|thông báo|yêu cầu)[^.]{0,30}bắt buộc|là (trường|ô) bắt buộc|bắt buộc nhập/i.test(kv)
        && !/không bắt buộc/i.test(kv);
      if (!rb.batBuoc && !rb.batBuocCoDieuKien && noiBatBuoc && !rb.chiDoc) {
        /* Case DẪN một BR (tag `[BR-…]`) cho tính bắt buộc mà bảng trường ghi N ⇒ hai NGUỒN của đặc tả lệch nhau,
         * không phải case tự giả định (9003 TC_018 dẫn BR-11). Tách loại: người phải đối chiếu, máy không phán. */
        const coBR = /\[BR-[A-Z0-9-]+\]/i.test(c.tag) || /\bBR-\d+/i.test(kv);
        giaDinhSai.push({ id: c.id, stt: t.stt, ten: t.ten, loai: coBR ? 'lech_nguon_can_doi_chieu' : 'coi_la_bat_buoc', dacTa: t.batBuoc || '(trống)' });
      }
      if (rb.batBuoc && !rb.chiDoc && LUU_DUOC.test(kv) && !BI_CHAN.test(kv)) {
        giaDinhSai.push({ id: c.id, stt: t.stt, ten: t.ten, loai: 'bo_trong_ma_cho_luu', dacTa: t.batBuoc });
      }
    }
  }

  /*
   * ② BIÊN ĐỘ DÀI LỆCH ĐẶC TẢ — xét THEO CASE, so con số với MỌI trường case neo vào.
   * Bản trước chỉ xét case neo đúng một trường: TC_111 neo bốn ô 150 ký tự nên sửa 150 → 300 trong nó KHÔNG bị
   * bắt (cấy lỗi 11/11/2026). Chỉ case CÓ Ý THỬ BIÊN — TC_105 (cắt khoảng trắng) nhắc "21 ký tự", "17 ký tự"
   * là độ dài chuỗi thử, không phải biên (đọc tay).
   */
  const rbTheoStt = new Map(truong.map((t) => [t.stt, rangBuocCua(t)]));
  const yBien = (c) => /\[boundary\]/i.test(c.tag) || /biên|tối đa|giới hạn|vượt/i.test(c.tieuDe);
  for (const c of ca.filter(yBien)) {
    const stts = [...neo.get(c.id).keys()].filter((s) => { const r = rbTheoStt.get(s); return r && r.maxLens && r.goDuoc; });
    if (!stts.length) continue;
    const bien = [...new Set(stts.flatMap((s) => rbTheoStt.get(s).maxLens))];
    const hopLe = new Set(bien.flatMap((n) => [n - 1, n, n + 1]));
    /* LỆCH = con số case KHẲNG ĐỊNH là giới hạn mà không khớp biên đặc tả, HOẶC con số VƯỢT biên đặc tả.
     * Con số DƯỚI biên mà không xưng là giới hạn là ca "trong biên phải lưu được" — đồng ý với đặc tả, không
     * lệch (9003 TC_025 thử 26, TC_060 thử 151 dưới giới hạn 250 — đọc tay 11/11/2026). */
    const lech = soBienDoDai(c).filter(({ n, laGioiHan }) => !hopLe.has(n) && (laGioiHan || n > Math.max(...bien) + 1)).map((x) => x.n);
    if (lech.length) {
      mauThuan.push({ id: c.id, stt: stts.join(','), ten: stts.map((s) => cm.theoStt.get(s).ten).join(' / '),
        dacTa: bien.join('/'), caThu: lech, khaiChuDich: KHAI_CHU_DICH.test([c.tieuDe, c.kyVong].join(' ')) });
    }
  }

  const khongNeo = ca.filter((c) => neo.get(c.id).size === 0).map((c) => c.id);
  const tenTrung = [...cm.demTen.entries()].filter(([, n]) => n > 1).length;
  /* BỐN TRẠNG THÁI, không gộp: phủ · đã khai chủ đích · THIẾU (có case chạm trường mà không case nào làm nghĩa
   * vụ) · KHÔNG NEO (0 case chạm trường — có thể vì tên ngắn/khác chữ, máy KHÔNG phán được là thiếu). */
  const trangThai = (x) => (x.phu.length ? 'phu' : (x.daKhai.length ? 'da_khai' : ((x.soCaNeo || x.neoDuoc) ? 'thieu' : 'khong_neo')));
  for (const x of nghiaVu) x.trangThai = trangThai(x);
  const dem = (k) => nghiaVu.filter((x) => x.trangThai === k).length;
  return {
    phanDuoc: true,
    mauSo: { truong: truong.length, truongChiDoc, truongCoRangBuoc, ca: ca.length, caKhongNeo: khongNeo.length, tenTruongTrung: tenTrung },
    nghiaVu, nvPhu: dem('phu'), nvDaKhai: dem('da_khai'), nvThieu: dem('thieu'), nvKhongNeo: dem('khong_neo'),
    mauThuan, giaDinhSai, khongNeo,
  };
}

/* ─────────────────────────────── CLI ─────────────────────────────── */

function timTep(task, po) {
  const goc = path.join(REPO, po, 'tasks', task);
  const req = path.join(goc, 'requirements');
  const tc = path.join(goc, 'test-cases');
  const spec = fs.existsSync(req) ? fs.readdirSync(req).filter((f) => f.endsWith('.md') && !/ui_catalog|scope_inventory|ambiguity/i.test(f))
    .map((f) => path.join(req, f)).find((f) => docBangTruong(fs.readFileSync(f, 'utf8')).length) : null;
  const cases = fs.existsSync(tc) ? fs.readdirSync(tc).filter((f) => f.endsWith('.md')).map((f) => path.join(tc, f)) : [];
  return { spec, cases };
}

function main() {
  const a = process.argv.slice(2);
  const lay = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : ''; };
  const task = lay('--task') || process.env.TASK_KEY || '';
  const po = lay('--project-output') || process.env.PROJECT_OUTPUT_DIR || 'outputs/CSDL';
  let spec = lay('--spec'); let cases = lay('--cases') ? [lay('--cases')] : [];
  if (!spec && task) { const t = timTep(task, po); spec = t.spec; cases = t.cases; }
  if (!spec || !cases.length) {
    console.log(`[tc-semantic] KHÔNG PHÁN ĐƯỢC — ${!spec ? 'không có đặc tả mang bảng trường (Stt + Trường + Bắt buộc)' : 'không có testcase .md'}${task ? ` cho ${task}` : ''}. Đây KHÔNG đồng nghĩa với "đạt".`);
    process.exit(2);
  }
  const kq = cham(fs.readFileSync(spec, 'utf8'), cases.map((f) => fs.readFileSync(f, 'utf8')).join('\n'));
  if (a.includes('--json')) { console.log(JSON.stringify(kq, null, 2)); process.exit(kq.phanDuoc ? 0 : 2); }
  if (!kq.phanDuoc) { console.log(`[tc-semantic] KHÔNG PHÁN ĐƯỢC — ${kq.lyDo}.`); process.exit(2); }
  const m = kq.mauSo;
  console.log(`[tc-semantic] ${task || path.basename(spec)} · ${m.truong} trường (${m.truongChiDoc} chỉ đọc, ${m.truongCoRangBuoc} có ràng buộc sinh nghĩa vụ) · ${m.ca} case (${m.caKhongNeo} không neo được vào trường nào; ${m.tenTruongTrung} tên trường trùng — không neo bằng tên)`);
  console.log(`  ① nghĩa vụ negative/boundary: ${kq.nghiaVu.length} · phủ ${kq.nvPhu} · có khai chủ đích ${kq.nvDaKhai} · THIẾU ${kq.nvThieu} · không neo được ${kq.nvKhongNeo} (máy KHÔNG phán là thiếu)`);
  const theoLoai = {};
  for (const x of kq.nghiaVu) { const k = x.nghiaVu; theoLoai[k] = theoLoai[k] || { n: 0, phu: 0, thieu: 0 }; theoLoai[k].n += 1; if (x.trangThai === 'phu') theoLoai[k].phu += 1; if (x.trangThai === 'thieu') theoLoai[k].thieu += 1; }
  for (const [k, v] of Object.entries(theoLoai)) console.log(`     · ${k.padEnd(20)} phủ ${v.phu}/${v.n} · thiếu ${v.thieu}`);
  const mtThat = kq.mauThuan.filter((x) => !x.khaiChuDich);
  console.log(`  ② biên độ dài lệch đặc tả: ${mtThat.length} (thêm ${kq.mauThuan.length - mtThat.length} case có khai chủ đích)`);
  const gdThat = kq.giaDinhSai.filter((x) => x.loai !== 'lech_nguon_can_doi_chieu');
  console.log(`  ③ giả định sai về tính bắt buộc: ${gdThat.length} (thêm ${kq.giaDinhSai.length - gdThat.length} case dẫn BR lệch bảng trường — cần đối chiếu nguồn)`);
  if (a.includes('--chi-tiet')) {
    const NHAN = { thieu: 'THIẾU  ', da_khai: 'CÓ KHAI', khong_neo: 'KHÔNG NEO' };
    for (const x of kq.nghiaVu.filter((y) => y.trangThai !== 'phu')) console.log(`     ${NHAN[x.trangThai]} Stt ${x.stt} ${x.ten} · ${x.nghiaVu}${x.maxLens ? ` (≤${x.maxLens.join('/')} theo ${x.nguon})` : ''}${x.maxDigits ? ` (${x.maxDigits} chữ số)` : ''} · ${x.soCaNeo} case neo vào trường`);
    for (const x of kq.mauThuan) console.log(`     ${x.khaiChuDich ? 'CÓ KHAI' : 'LỆCH  '} ${x.id} · Stt ${x.stt} ${x.ten}: đặc tả ≤${x.dacTa}, case thử ${x.caThu.join('/')}`);
    for (const x of kq.giaDinhSai) console.log(`     GIẢ ĐỊNH ${x.id} · Stt ${x.stt} ${x.ten}: ${x.loai} (đặc tả Bắt buộc = ${x.dacTa})`);
  }
  console.log('  Giai đoạn 1: CHỈ BÁO CÁO. Con số là chặn trên của "đã phủ" — máy thấy case NHẮC đúng dữ liệu, chưa thấy case ĐÚNG.');
  process.exit(0);
}

if (require.main === module) main();
module.exports = { cham, docBangTruong, docBangCase, rangBuocCua, neoCase };
