'use strict';
/**
 * context_pins.js — BIẾN CHỌN NGỮ CẢNH mà app đang test mặc định NGẦM (đơn vị, cấp, năm…), đọc từ
 * `.agent/config/context_pins.json`.
 *
 * VÌ SAO LÀ CONFIG CỦA DỰ ÁN (v3.0.0): tên các biến này là của MỘT ứng dụng, không phải của kit. Bản trước
 * ghi cứng chúng trong `env_scope_check` · `preflight_gate` · `evidence_recorder` · `ui_polish_gen`, nên
 * mang kit sang dự án khác thì cửa phase2 CHẶN mọi task vì thiếu một biến của ứng dụng khác. Cơ chế thì
 * chung: "profile phải ghim mọi biến mà thiếu nó app lặng lẽ về mặc định và lượt chạy vẫn XANH trên ngữ
 * cảnh sai". Dữ liệu — biến nào, hậu quả gì — nằm ở lớp PROJECT.
 *
 * Không có file ⇒ không luật nào áp (kit vừa cài cho dự án chưa khai). File hỏng ⇒ NÉM: một cửa gác
 * đọc config hỏng rồi lặng lẽ đạt là cửa trang trí.
 *
 * Khuôn: xem `.agent/config/context_pins.example.json`.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const RONG = { nhan_dien: null, phai_ghim: [], nen_ghim: [], neo: [], dau_ngu_canh: {}, ma_ngan: {} };

/** Đọc config của gốc `root`. Trả bản rỗng (kèm `_nguon: null`) khi chưa khai. */
function docPins(root = REPO) {
  const f = path.join(root, '.agent', 'config', 'context_pins.json');
  if (!fs.existsSync(f)) return { ...RONG, _nguon: null };
  let j;
  try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) {
    throw new Error(`[context_pins] ${f} không phải JSON hợp lệ (${e.message}) — sửa file thay vì để cửa gác lặng lẽ đạt`);
  }
  return { ...RONG, ...j, _nguon: f };
}

/** Profile có thuộc ứng dụng mà luật ghim áp lên không: có ít nhất một khoá khớp `nhan_dien`. */
function apDung(pins, khoa) {
  if (!pins.nhan_dien) return false;
  const re = new RegExp(pins.nhan_dien);
  return [...khoa].some((k) => re.test(k));
}

/** Giá trị đầu tiên khác rỗng trong danh sách biến của một ngữ cảnh (vd `capHoc`). */
function giaTri(pins, ten, env = process.env) {
  for (const k of pins.dau_ngu_canh[ten] || []) {
    const v = env[k];
    if (v && String(v).trim()) return String(v).trim();
  }
  return undefined;
}

/** Mã ngắn an toàn cho tên thư mục, theo bảng `ma_ngan[ten]` = [[chuỗi-con, mã], …] (thứ tự có nghĩa). */
function maNgan(pins, ten, giaTriNgCanh) {
  const s = String(giaTriNgCanh || '').normalize('NFC').toLowerCase();
  if (!s) return null;
  for (const [con, ma] of pins.ma_ngan[ten] || []) if (s.includes(String(con).normalize('NFC').toLowerCase())) return ma;
  return null;
}

module.exports = { docPins, apDung, giaTri, maNgan };
