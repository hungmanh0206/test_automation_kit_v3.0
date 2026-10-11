'use strict';

/*
 * GỘP NGUỒN VÀ BẢN ĐỒ PHỦ TÀI LIỆU (v2.6.0 §A6) — điểm số 4 trong 10 điểm vượt kit A.
 *
 * A chỉ so với tài liệu dạng văn bản. Ở đây gộp: lượt bò (màn + dấu vân tay), danh mục API, tài liệu
 * (FSD/Backlog/Doc), và `knowledge/` nếu có. OpenAPI đi qua `api_inventory` nên không đọc lại ở đây.
 *
 * BỐN Ô, và ô quan trọng nhất là ô thứ hai:
 *   `documented_present`    có tài liệu + quan sát được  → đối chiếu chi tiết, lệch thì thành câu hỏi
 *   `undocumented_present`  KHÔNG tài liệu + quan sát được → **VÙNG MÙ CHÍNH**, phải hỏi BA
 *   `documented_missing`    có tài liệu + KHÔNG quan sát được → chưa build / bị ẩn với vai trò này / lỗi
 *   (ô thứ tư — không tài liệu, không quan sát được — theo định nghĩa là thứ không ai biết tới, nên trống)
 *
 * ĐỘ PHỦ TÍNH THEO MỤC CÓ TIÊU ĐỀ, KHÔNG THEO CHUỖI XUẤT HIỆN. Đây là quyết định đắt nhất của file này,
 * và nó đến từ một phép đo: `fsd.md` của fixture CỐ Ý không có mục nào cho `/bao-cao`, nhưng chuỗi
 * `/bao-cao` vẫn xuất hiện một lần — trong chính câu banner nói rằng màn đó bị thiếu. Đếm theo chuỗi thì
 * màn bị bỏ sót lại được tính là đã có tài liệu, tức bẫy tự vô hiệu hoá. Đây là lần thứ TÁM trong dự án
 * một phép quét bắt đúng câu nói VỀ chính nó.
 *
 * Mà xét về nghiệp vụ thì đếm theo mục cũng đúng hơn: một tài liệu "phủ" một màn khi nó có MỤC cho màn
 * đó, không phải khi nó nhắc tên màn trong một câu. Chuỗi nhắc trong văn xuôi vẫn được giữ lại ở
 * `nhac_trong_van_xuoi` — đó là tín hiệu thật ("tài liệu có biết màn này tồn tại"), chỉ không phải độ phủ.
 */
const fs = require('fs');
const path = require('path');

/** Route xuất hiện trong một chuỗi: `/truong`, `/truong/{id}`, `/truong/:id`. */
const ROUTE_RE = /\/[a-z0-9][a-z0-9\-_/]*(?:\{[^}]+\}|:[a-z]+)?/gi;

/** Chuẩn hoá route của tài liệu về dạng của crawler: `{id}` và `:bat_ky` thành `:id`. */
function chuanHoaRouteTaiLieu(r) {
  return String(r).replace(/\{[^}]+\}/g, ':id').replace(/:[a-z_]+/gi, ':id').replace(/\/+$/, '') || '/';
}

/**
 * Đọc một tài liệu Markdown, trả về route khai ở MỤC CÓ TIÊU ĐỀ, route trong Ô BẢNG, và route chỉ nhắc
 * trong văn xuôi.
 *
 * Ô bảng được tính là có tài liệu: ma trận phân quyền của FSD liệt kê route trong ô, và đó là một lời
 * khai thật về màn đó. Chỉ văn xuôi thì không.
 */
function docTaiLieu(duongDan) {
  const src = fs.readFileSync(duongDan, 'utf8');
  const dong = src.split(/\r?\n/);
  const theoTieuDe = new Map();   // route -> {file, line, tieu_de}
  const trongBang = new Map();
  const vanXuoi = new Map();
  let trongKhoiCode = false;

  for (let i = 0; i < dong.length; i += 1) {
    const d = dong[i];
    if (/^\s*```/.test(d)) { trongKhoiCode = !trongKhoiCode; continue; }
    if (trongKhoiCode) continue;

    const laTieuDe = /^#{1,6}\s+/.test(d);
    const laOBang = /^\s*\|/.test(d);
    /*
     * Dòng blockquote (`>`) KHÔNG tính là tiêu đề hay ô bảng. Chính banner "tệp này cố ý thiếu màn X" là
     * một blockquote, và nếu tính nó thì bẫy của fixture tự vô hiệu hoá.
     */
    const ra = d.match(ROUTE_RE) || [];
    /*
     * ROUTE GỐC `/` phải bắt riêng. `ROUTE_RE` đòi có ký tự theo sau dấu gạch, nên một dấu `/` đứng một
     * mình KHÔNG BAO GIỜ khớp — và đo được hậu quả: màn gốc của fixture có mục `### 2.1. Tổng quan — /`
     * trong tài liệu mà vẫn bị xếp vào `undocumented_present`, tức một dương tính giả ngay ở màn đầu tiên.
     *
     * Chỉ bắt khi nó nằm trong CẶP BACKTICK (`` `/` ``): một dấu gạch trần trong câu là nhiễu (ngày tháng,
     * phân số, "và/hoặc"), còn đặt trong backtick thì người viết đang cố ý trỏ tới một đường dẫn.
     */
    if ((laTieuDe || laOBang) && /`\/`/.test(d)) ra.push('/');
    for (const tho of ra) {
      const r = chuanHoaRouteTaiLieu(tho);
      if (r === '/' && !laTieuDe && !laOBang) continue;   // dấu `/` lẻ trong văn xuôi là nhiễu
      const ban = { file: path.basename(duongDan), line: i + 1, text: d.trim().slice(0, 140) };
      if (laTieuDe) { if (!theoTieuDe.has(r)) theoTieuDe.set(r, { ...ban, tieu_de: d.replace(/^#+\s*/, '').trim() }); continue; }
      if (laOBang) { if (!trongBang.has(r)) trongBang.set(r, ban); continue; }
      if (!vanXuoi.has(r)) vanXuoi.set(r, ban);
    }
  }
  return { theoTieuDe, trongBang, vanXuoi, soDong: dong.length };
}

/**
 * Mức phủ của một màn. Máy CHỈ chia được hai mức, và nói thẳng chuyện đó.
 *
 * A có bốn mức (`đầy đủ` · `một phần` · `trắng` · `nghi lỗi thời`). Máy không chấm được hai mức kia:
 *   · "đầy đủ" cần biết tài liệu có nêu ĐỦ validation, message, phân quyền hay chưa — một mục dài vẫn có
 *     thể thiếu hẳn phần validation, nên độ dài mục không suy ra được điều gì;
 *   · "nghi lỗi thời" cần so NGÀY tài liệu với ngày build, và cần người đọc thấy mô tả không khớp UI.
 *
 * Nên `mot_phan` là lời khai bảo thủ và ĐÚNG cho mọi màn có mục: nó nói "có tài liệu, chưa biết đủ chưa".
 * Nâng lên `day_du` hay hạ xuống `nghi_loi_thoi` là việc của người, và phải ghi lý do.
 */
function mucPhu(mucTaiLieu) {
  return mucTaiLieu ? 'mot_phan' : 'trang';
}

/**
 * Gộp và lập bản đồ phủ.
 *
 * @param {{crawl:any, api?:any, taiLieu?:string[], knowledgeDir?:string}} o
 */
function gop(o) {
  const screens = ((o.crawl || {}).screens) || [];
  const quanSat = new Map(screens.map((s) => [s.route, s]));

  const nguonTaiLieu = [];
  const theoTieuDe = new Map();
  const trongBang = new Map();
  const vanXuoi = new Map();
  for (const f of (o.taiLieu || [])) {
    if (!fs.existsSync(f)) { nguonTaiLieu.push({ file: f, doc_duoc: false, vi_sao: 'không có file' }); continue; }
    const d = docTaiLieu(f);
    nguonTaiLieu.push({ file: path.basename(f), doc_duoc: true, so_dong: d.soDong, so_muc_co_route: d.theoTieuDe.size });
    for (const [k, v] of d.theoTieuDe) if (!theoTieuDe.has(k)) theoTieuDe.set(k, v);
    for (const [k, v] of d.trongBang) if (!trongBang.has(k)) trongBang.set(k, v);
    for (const [k, v] of d.vanXuoi) if (!vanXuoi.has(k)) vanXuoi.set(k, v);
  }
  const coTaiLieu = (r) => theoTieuDe.get(r) || trongBang.get(r) || null;

  const o4 = [];
  // ① + ②: mọi màn QUAN SÁT ĐƯỢC
  for (const [route, s] of quanSat) {
    const tl = coTaiLieu(route);
    const chiNhacVanXuoi = !tl && vanXuoi.has(route);
    o4.push({
      loai: 'man',
      vung: route,
      o: tl ? 'documented_present' : 'undocumented_present',
      muc_phu: mucPhu(tl),
      nguon_tai_lieu: tl ? { ...tl } : null,
      nhac_trong_van_xuoi: chiNhacVanXuoi ? vanXuoi.get(route) : undefined,
      quan_sat: { title: s.title_observed, so_field: (s.fields || []).length, components: s.components || [] },
      chien_luoc: tl
        ? 'Đối chiếu: mở màn, kiểm từng điều tài liệu nêu. Lệch thì thành câu hỏi, KHÔNG tự sửa expected.'
        : 'VÙNG MÙ: hỏi BA trước. Chưa có nguồn thì mọi expected ở đây là quan sát từ app, tức tautology.',
      status: 'observed',
    });
  }
  // ③: màn TÀI LIỆU CÓ mà KHÔNG quan sát được
  for (const [route, tl] of [...theoTieuDe, ...trongBang]) {
    if (quanSat.has(route)) continue;
    if (o4.some((x) => x.vung === route && x.o === 'documented_missing')) continue;
    o4.push({
      loai: 'man',
      vung: route,
      o: 'documented_missing',
      muc_phu: 'co_tai_lieu_chua_do_duoc',
      nguon_tai_lieu: { ...tl },
      quan_sat: null,
      /*
       * BA cách đọc, và KHÔNG được chọn bừa một cách. "Chưa build" là cách đọc hấp dẫn nhất và cũng dễ
       * sai nhất: lượt bò có thể chưa tới, hoặc màn bị ẩn với vai trò đang dùng. Ma trận vai trò
       * (`roles.js`) phân xử được vế thứ hai; `crawl_completeness` phân xử vế thứ ba.
       */
      chien_luoc: 'BA cách đọc: (a) chưa build, (b) bị ẩn với vai trò đã dùng để bò, (c) lượt bò chưa tới. Đối chiếu `role_route_matrix` và `crawl_completeness` TRƯỚC khi kết luận.',
      status: 'observed',
    });
  }

  // API: cùng bốn ô, nhưng nguồn "tài liệu" của API là OpenAPI, đã đối chiếu ở `api_inventory`.
  const apiDoiChieu = ((o.api || {}).doi_chieu_openapi) || null;

  const dem = o4.reduce((m, x) => { m[x.o] = (m[x.o] || 0) + 1; return m; }, {});
  const vungMu = o4.filter((x) => x.o === 'undocumented_present').map((x) => x.vung);

  const cauHoi = [
    ...vungMu.map((r) => ({
      muc: 'High',
      cau_hoi: `Màn \`${r}\` quan sát được trên app nhưng KHÔNG có mục nào trong tài liệu. Đây là tính năng ngoài tài liệu, hay tài liệu thiếu?`,
      vi_sao: 'Không có nguồn thì expected của màn này chỉ còn là "app đang hiện thế" — tautology, và nó nhân lên theo số case.',
    })),
    ...o4.filter((x) => x.o === 'documented_missing').map((x) => ({
      muc: 'Medium',
      cau_hoi: `Tài liệu khai màn \`${x.vung}\` (${x.nguon_tai_lieu.file}:${x.nguon_tai_lieu.line}) nhưng lượt bò không thấy. Chưa build, bị ẩn theo quyền, hay lượt bò chưa tới?`,
      vi_sao: 'Ba cách đọc dẫn tới ba hành động khác nhau. Chọn bừa một cách là bỏ sót hoặc báo nhầm.',
    })),
  ];

  return {
    nguon_tai_lieu: nguonTaiLieu,
    doc_coverage: o4.sort((a, b) => a.vung.localeCompare(b.vung)),
    tong: { ...dem, tong_vung: o4.length },
    vung_mu: vungMu,
    /*
     * Cảnh báo bắt buộc khi lượt bò chưa đầy đủ: ô `documented_missing` lúc đó KHÔNG đọc được là "chưa
     * build". Không có dòng này thì bản đồ phủ trông như một kết luận, trong khi nó là một ảnh chụp dở.
     */
    canh_bao_do_day_du: ((o.crawl || {}).crawl_completeness || {}).canh_bao || null,
    doi_chieu_openapi: apiDoiChieu,
    cau_hoi_ambiguity: cauHoi,
    _cach_tinh_do_phu: 'Độ phủ tính theo MỤC CÓ TIÊU ĐỀ và Ô BẢNG, KHÔNG theo chuỗi xuất hiện trong văn xuôi. Route chỉ được nhắc trong một câu thì vào `nhac_trong_van_xuoi` — tín hiệu thật, nhưng không phải độ phủ.',
    status: 'observed',
  };
}

module.exports = { gop, docTaiLieu, chuanHoaRouteTaiLieu };
