'use strict';

/*
 * CHẾ ĐỘ DELTA (v2.6.1) — điểm số 6 trong 10 điểm vượt kit A, và là điểm DUY NHẤT bản v2.6.0 khai mà
 * KHÔNG CÀI.
 *
 * Bản v2.6.0 chỉ đặt một trần token riêng cho `--mode delta` rồi coi như xong. Chạy `--mode delta` làm
 * đúng y như `--mode task`: không so với snapshot nào cả. Mà bảng "10 điểm vượt A" trong CHANGELOG đã
 * ghi nó là tính năng, cột bằng chứng điền "trần token riêng 1k" — một con số không nói gì về tính năng.
 * CHANGELOG đó đã tag và merge. File này trả lại lời hứa đó.
 *
 * SO CÁI GÌ, và vì sao đúng mấy thứ này:
 *   · MÀN thêm / mất      — thay đổi lớn nhất, và là thứ `scope_anchor` phải biết ngay;
 *   · FIELD thêm / mất / đổi RÀNG BUỘC — `maxlength` đổi từ 50 sang 20 là một case `[BVA]` phải chạy lại,
 *     mà không gì trên UI nói cho bạn biết;
 *   · COMPONENT thêm / mất — lưới mọc thêm phân trang là một lớp case mới;
 *   · API thêm / mất      — endpoint mới là bề mặt chưa ai test.
 *
 * KHÔNG so giá trị dữ liệu. Giá trị đổi mỗi ngày trên UAT; so nó thì mọi lượt đều "có khác biệt" và
 * người đọc thôi đọc. Chỉ so HÌNH DẠNG.
 */
const fs = require('fs');
const path = require('path');

/** Khoá so sánh của một field: tên trường nếu có, không thì nhãn. */
const khoaField = (f) => String(f.ten_truong || f.nhan || '').toLowerCase().trim();

/** Những ràng buộc mà đổi là phải chạy lại case. Giá trị mặc định KHÔNG nằm đây: nó là dữ liệu. */
const RANG_BUOC = ['code_loai', 'required', 'maxlength', 'minlength', 'pattern', 'min', 'max', 'so_option', 'disabled', 'readonly'];

/**
 * Tìm snapshot GẦN NHẤT TRƯỚC lượt này, cùng host và cùng phạm vi.
 *
 * Cùng phạm vi là điều kiện bắt buộc, không phải tuỳ chọn: so một lượt bò cả app với một lượt bò một
 * module thì mọi màn ngoài module đều hiện ra như "đã mất", và bản báo cáo đó vô dụng.
 */
function timSnapshotTruoc(thuMucGoc, { host, phamVi, boQuaBuild }) {
  if (!fs.existsSync(thuMucGoc)) return null;
  const ungVien = [];
  for (const d of fs.readdirSync(thuMucGoc)) {
    if (d === boQuaBuild) continue;
    const f = path.join(thuMucGoc, d, 'system_map.json');
    if (!fs.existsSync(f)) continue;
    let j;
    try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { continue; }
    if (host && ((j.target || {}).host) !== host) continue;
    if ((j.pham_vi || null) !== (phamVi || null)) continue;
    ungVien.push({ build: d, duong: f, map: j, luc: fs.statSync(f).mtimeMs });
  }
  if (!ungVien.length) return null;
  ungVien.sort((a, b) => b.luc - a.luc);
  return ungVien[0];
}

/** So hai bản đồ. Trả về khối `delta` máy đọc được. */
function soSanh(truoc, sau) {
  const mTruoc = new Map((truoc.screens || []).map((s) => [s.route, s]));
  const mSau = new Map((sau.screens || []).map((s) => [s.route, s]));

  const manThem = [...mSau.keys()].filter((r) => !mTruoc.has(r)).sort();
  const manMat = [...mTruoc.keys()].filter((r) => !mSau.has(r)).sort();

  const manDoi = [];
  for (const [route, s2] of mSau) {
    const s1 = mTruoc.get(route);
    if (!s1) continue;
    const f1 = new Map((s1.fields || []).map((f) => [khoaField(f), f]));
    const f2 = new Map((s2.fields || []).map((f) => [khoaField(f), f]));
    const fThem = [...f2.keys()].filter((k) => k && !f1.has(k)).sort();
    const fMat = [...f1.keys()].filter((k) => k && !f2.has(k)).sort();
    const fDoi = [];
    for (const [k, a] of f1) {
      const b = f2.get(k);
      if (!k || !b) continue;
      const khac = RANG_BUOC.filter((t) => JSON.stringify(a[t] === undefined ? null : a[t]) !== JSON.stringify(b[t] === undefined ? null : b[t]))
        .map((t) => ({ rang_buoc: t, truoc: a[t] === undefined ? null : a[t], sau: b[t] === undefined ? null : b[t] }));
      if (khac.length) fDoi.push({ field: k, khac });
    }
    const c1 = new Set(s1.components || []);
    const c2 = new Set(s2.components || []);
    const cThem = [...c2].filter((c) => !c1.has(c)).sort();
    const cMat = [...c1].filter((c) => !c2.has(c)).sort();
    if (fThem.length || fMat.length || fDoi.length || cThem.length || cMat.length) {
      manDoi.push({ route, field_them: fThem, field_mat: fMat, field_doi: fDoi, component_them: cThem, component_mat: cMat });
    }
  }

  const aTruoc = new Set((truoc.apis || []).map((a) => `${a.method} ${a.path_chuan}`));
  const aSau = new Set((sau.apis || []).map((a) => `${a.method} ${a.path_chuan}`));
  const apiThem = [...aSau].filter((x) => !aTruoc.has(x)).sort();
  const apiMat = [...aTruoc].filter((x) => !aSau.has(x)).sort();

  const soDoi = manThem.length + manMat.length + manDoi.length + apiThem.length + apiMat.length;
  return { man_them: manThem, man_mat: manMat, man_doi: manDoi, api_them: apiThem, api_mat: apiMat, so_thay_doi: soDoi };
}

/**
 * Đề xuất phạm vi chạy lại từ một khối delta (§B10).
 *
 * CHỈ ĐỀ XUẤT, không tự chạy — cùng luật với `reliability --promote`. Lý do giống nhau: máy biết CÁI GÌ
 * đổi, nhưng không biết thay đổi đó có đáng chạy lại hay không; một đổi nhãn hiển thị và một đổi
 * `maxlength` trông giống nhau trong diff mà hệ quả khác hẳn.
 */
function deXuatChayLai(delta) {
  const ra = [];
  for (const r of delta.man_them) ra.push({ route: r, vi_sao: 'màn MỚI — chưa có case nào', muc: 'cao' });
  for (const r of delta.man_mat) ra.push({ route: r, vi_sao: 'màn BIẾN MẤT — case trỏ vào nó sẽ đỏ vì lý do không phải lỗi sản phẩm', muc: 'cao' });
  for (const m of delta.man_doi) {
    if (m.field_doi.length) {
      const bva = m.field_doi.filter((f) => f.khac.some((k) => ['maxlength', 'minlength', 'min', 'max', 'pattern', 'required'].includes(k.rang_buoc)));
      if (bva.length) ra.push({ route: m.route, vi_sao: `${bva.length} field đổi RÀNG BUỘC (${bva.map((f) => f.field).join(', ')}) — case [BVA]/[Validation] của màn này phải chạy lại`, muc: 'cao' });
    }
    if (m.field_them.length) ra.push({ route: m.route, vi_sao: `${m.field_them.length} field mới (${m.field_them.join(', ')}) — chưa có case`, muc: 'cao' });
    if (m.component_them.length) ra.push({ route: m.route, vi_sao: `component mới: ${m.component_them.join(', ')} — một lớp case mới`, muc: 'trung bình' });
    if (m.field_mat.length || m.component_mat.length) ra.push({ route: m.route, vi_sao: 'có field hoặc component BIẾN MẤT — case cũ có thể đỏ vì lý do không phải lỗi', muc: 'trung bình' });
  }
  return {
    de_xuat: ra,
    _chi_de_xuat: 'CHỈ ĐỀ XUẤT, KHÔNG tự chạy. Máy biết CÁI GÌ đổi nhưng không biết thay đổi đó có đáng chạy lại hay không — một đổi nhãn hiển thị và một đổi `maxlength` trông giống nhau trong diff mà hệ quả khác hẳn. Người chốt, rồi dùng `npm run rerun:failed` hoặc nhánh partial-rerun.',
  };
}

module.exports = { timSnapshotTruoc, soSanh, deXuatChayLai, khoaField, RANG_BUOC };
