'use strict';
/*
 * pii_mask — NGUỒN DUY NHẤT của mẫu nhận biết PII và hàm che (v2.8.0 §0b).
 *
 * VÌ SAO GỘP, có số đo. Trước v2.8.0 kit có **năm** bản `EMAIL_RE`/`PHONE_RE` rời nhau — `decisions.js`,
 * `domain_rules.js`, `howto_store.js`, `system_map.js`, `screen_snapshot.js` — và chúng KHÔNG giống nhau:
 *
 *     bốn bản          /\b0\d{8,10}\b/          ⇒ bắt 0 + 8..10 chữ số
 *     screen_snapshot  /(?<!\d)0\d{9,10}(?!\d)/ ⇒ chỉ bắt 0 + 9..10
 *
 * Hệ quả cụ thể: một số 9 chữ số dạng `0xxxxxxxx` (định dạng di động cũ trước 2018, vẫn còn đầy trong
 * dữ liệu) ĐƯỢC che ở báo cáo và sổ tri thức, nhưng KHÔNG được che trong ảnh chụp màn. Đó là non-negotiable
 * §1 bị hở ở đúng nơi khó phát hiện nhất, vì không ai so hai bản với nhau bao giờ.
 *
 * LUẬT CHỌN KHI HAI BẢN LỆCH: lấy bản BẮT RỘNG HƠN. Che nhầm một mã số không phải SĐT thì mất một chút
 * thông tin trong báo cáo; bỏ sót một SĐT thật thì lộ dữ liệu khách. Hai sai lầm đó không cùng hạng.
 *
 * `(?<!\d)…(?!\d)` thay cho `\b…\b`, cũng theo luật đó: `\b` KHÔNG khớp khi số dính ngay sau một chữ cái
 * (`ID0912345678`), vì chữ và số đều là ký tự từ nên không có biên. Lookaround theo CHỮ SỐ thì khớp, tức
 * bắt được nhiều hơn.
 *
 * GIỚI HẠN, phải nói: email và SĐT có MẪU nên nhận được bằng regex. Họ tên, địa chỉ, ngày sinh thì KHÔNG
 * — chúng chỉ nhận ra được qua NHÃN đứng cạnh (xem `PII_LABEL`). Nên che bằng regex là lớp sàn, không
 * phải lớp đủ.
 */

/** Email. Không cờ `g` — dùng cho `.test()`. Bản `_G` ở dưới dùng cho `.replace()`. */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

/**
 * SĐT Việt Nam: `0` + 8 tới 10 chữ số (9–11 ký tự).
 *
 * Biên dùng lookaround theo CHỮ SỐ, không dùng `\b`: xem ghi chú đầu file. Dải 8..10 là HỢP của hai bản
 * cũ, cố ý chọn bản rộng hơn.
 */
const PHONE_RE = /(?<!\d)0\d{8,10}(?!\d)/;

/** Bản có cờ `g` để thay thế toàn chuỗi. Tách hẳn vì regex có `g` mang `lastIndex` — dùng chung sẽ lỗi. */
const EMAIL_RE_G = new RegExp(EMAIL_RE.source, 'g');
const PHONE_RE_G = new RegExp(PHONE_RE.source, 'g');

/**
 * NHÃN cho biết ô bên cạnh là PII. Dùng cho dữ liệu có cặp nhãn-giá trị (form, bảng, kết quả truy vấn):
 * họ tên và địa chỉ không có mẫu nhận biết, nên chỉ nhận ra được qua nhãn.
 */
/*
 * HAI DẠNG NHÃN, và dạng thứ hai suýt bị bỏ quên.
 *
 * Nhãn trên MÀN là tiếng Việt có dấu, có khoảng trắng: "Họ và tên", "Ngày sinh", "Địa chỉ".
 * Tên CỘT trong DB của dự án này thì không dấu và nối bằng gạch dưới: `HO_TEN`, `DIA_CHI`, `NGAY_SINH`,
 * `SO_CMTND`, `SO_DIEN_THOAI`.
 *
 * Lượt viết đầu của file này chỉ phủ dạng thứ nhất, và `cheHang({HO_TEN: 'Nguyễn Văn A'})` trả về nguyên
 * văn họ tên. Đó là non-negotiable §1 hở ở đúng đường mà `db:query` sẽ dùng nhiều nhất — một phép thử ba
 * dòng bắt được, còn đọc code thì không.
 *
 * Nên chuẩn hoá nhãn trước khi so: bỏ dấu, đổi `_` thành khoảng trắng.
 */
const PII_LABEL = new RegExp(
  '^('
  + 'ho\\s*(va\\s*)?ten|full\\s?name|ten\\s*(day\\s*du|khach|nguoi|hoc\\s*sinh|can\\s*bo|phu\\s*huynh)'
  + '|email|e-?mail'
  + '|phone(\\s*number)?|mobile|dien\\s*thoai|so\\s*dien\\s*thoai|sdt'
  + '|dia\\s*chi|address'
  + '|ngay\\s*sinh|ngay\\s*thang\\s*nam\\s*sinh|d\\.?o\\.?b|birth'
  + '|cmnd|cmtnd|cccd|so\\s*cmtnd|so\\s*cccd|can\\s*cuoc|so\\s*dinh\\s*danh|ma\\s*dinh\\s*danh'
  + '|ho\\s*chieu|passport'
  + ')',
  'i',
);

/** Bỏ dấu tiếng Việt và đổi `_`/`-` thành khoảng trắng, để một mẫu phủ cả nhãn màn lẫn tên cột DB. */
function chuanHoaNhan(nhan) {
  return String(nhan || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    /* `/g` chứ KHÔNG `/gi`: cờ `i` làm `Đ` thành `d` THƯỜNG, tức bộ chuẩn hoá đổi luôn chữ hoa.
     * Hai bản (Node và bản dựng trong trình duyệt) từng lệch đúng ở đây, và test so hai bên bắt được. */
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[_-]+/g, ' ')
    .trim();
}

const DAU_EMAIL = '<email-masked>';
const DAU_PHONE = '<phone-masked>';
const DAU_O = '<masked>';

/** Che email và SĐT trong một chuỗi bất kỳ. */
function cheChuoi(v) {
  if (v === null || v === undefined) return v;
  return String(v).replace(EMAIL_RE_G, DAU_EMAIL).replace(PHONE_RE_G, DAU_PHONE);
}

/** Nhãn này có trỏ tới dữ liệu cá nhân không. */
function laNhanPii(nhan) {
  return PII_LABEL.test(chuanHoaNhan(nhan));
}

/**
 * Che một GIÁ TRỊ theo nhãn của nó. Nhãn là PII thì che HẲN — họ tên, địa chỉ, ngày sinh không có mẫu
 * nhận biết nên không thể che một phần.
 */
function cheTheoNhan(nhan, v) {
  if (laNhanPii(nhan)) return v === null || v === undefined || v === '' ? v : DAU_O;
  return cheChuoi(v);
}

/** Che mọi ô của một hàng kết quả (object cột → giá trị), theo TÊN CỘT làm nhãn. */
function cheHang(hang) {
  const ra = {};
  for (const [k, v] of Object.entries(hang || {})) ra[k] = cheTheoNhan(k, v);
  return ra;
}

/** Có PII lộ trong chuỗi không — dùng để gác, không dùng để che. */
function coPii(v) {
  const s = String(v || '');
  return EMAIL_RE.test(s) || PHONE_RE.test(s);
}

/*
 * MÃ NGUỒN của bộ chuẩn hoá, dạng chuỗi — để dùng được BÊN TRONG trình duyệt.
 *
 * Vì sao cần: `PII_LABEL` viết ở dạng KHÔNG DẤU (để phủ cả "Họ và tên" lẫn `HO_TEN`), nên nó chỉ khớp
 * khi nhãn đã được chuẩn hoá. Nhưng hai chỗ áp nó lại nằm TRONG `page.evaluate`
 * (`screen_snapshot.snapshotScreen` và `discovery/crawl.oCanChe`), mà hàm không qua được biên đó.
 *
 * Lượt gộp một nguồn đầu tiên bỏ qua chuyện này, và hậu quả đo được ngay: hai test che PII trong ảnh
 * chụp màn tụt từ "che 3 ô" xuống "che 1 ô" rồi "che 0 ô" — tức ảnh evidence bắt đầu mang họ tên và SĐT
 * thật. Chép tay bộ chuẩn hoá vào từng chỗ thì lại thành hai bản trôi khỏi nhau, đúng lỗi đang sửa.
 *
 * Nên truyền MÃ NGUỒN qua biên rồi `new Function` dựng lại. Có test so hai bên để chúng không lệch.
 */
const CHUAN_HOA_NHAN_SRC = `
  return String(l == null ? '' : l)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[_-]+/g, ' ')
    .trim();
`;

module.exports = {
  CHUAN_HOA_NHAN_SRC,
  EMAIL_RE, PHONE_RE, EMAIL_RE_G, PHONE_RE_G, PII_LABEL,
  DAU_EMAIL, DAU_PHONE, DAU_O,
  cheChuoi, laNhanPii, cheTheoNhan, cheHang, coPii, chuanHoaNhan,
};
