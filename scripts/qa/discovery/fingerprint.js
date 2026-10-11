'use strict';

/*
 * DẤU VÂN TAY MÀN (v2.6.0 §A2) — field + component, đọc từ DOM.
 *
 * VÌ SAO KHÔNG DÙNG `screen_snapshot` MỘT MÌNH. Nó đã có và được tái dùng ở đây, nhưng `controls` của nó
 * trả `{label, kind, value, disabled}` — đủ để đối chiếu màn với tài liệu, KHÔNG đủ để làm mẫu số cho
 * chiều `[Validation]`/`[BVA]`. Thứ còn thiếu là RÀNG BUỘC: `required`, `maxlength`/`minlength`,
 * `pattern`, `min`/`max`, số `<option>` THẬT, giá trị mặc định, thứ tự focus. Không có chúng thì
 * `dimension_manifest` vẫn phải tự khai "màn này có mấy loại field", tức mẫu số vẫn là số tự nhận.
 *
 * NGUYÊN TẮC: mọi thứ ở đây là `observed`. Dấu vân tay KHÔNG phải oracle — `maxlength=50` đọc từ DOM nói
 * app đang giới hạn 50, nó không nói đặc tả yêu cầu 50. Dùng nó để biết CÓ GÌ PHẢI ĐO, không dùng để chấm.
 *
 * CHE PII TRƯỚC KHI TRẢ VỀ: nhãn PII thì che giá trị hẳn; mẫu email/SĐT thì thay thế. Cùng cách
 * `screen_snapshot` làm, và lý do giống nhau — đã từng rò 100 email + 100 SĐT ra một file requirements.
 */
const path = require('path');

const snapshot = require(path.resolve(__dirname, '..', '..', 'utils', 'ui', 'screen_snapshot.js'));
const CFG_PATH = path.resolve(__dirname, '..', '..', '..', '.agent', 'config', 'ui_components.json');

/** Suy `code` loại field (18 mã trong `ui_components.json`) từ thuộc tính DOM. */
function suyLoaiField(f) {
  const t = String(f.type || '').toLowerCase();
  const tag = String(f.tag || '').toLowerCase();
  if (tag === 'textarea') return 'textarea';
  if (f.contenteditable) return 'richtext';
  if (tag === 'select') return f.multiple ? 'multiselect' : 'dropdown';
  if (t === 'file') return 'file_upload';
  if (t === 'range') return 'slider';
  if (t === 'date') return 'date';
  if (t === 'month' || t === 'week') return 'date_month_filter';
  if (t === 'time') return 'time';
  if (t === 'datetime-local') return 'date_range';
  if (t === 'email') return 'email';
  if (t === 'tel') return 'phone';
  if (t === 'password') return 'password';
  if (t === 'number') return 'number';
  if (t === 'checkbox') return 'checkbox_radio';
  if (t === 'radio') return 'checkbox_radio';
  /*
   * OTP nhận theo HÌNH DẠNG, không theo nhãn: `maxlength` 4–8 cộng `inputmode=numeric` hoặc pattern toàn
   * số. Nhận theo nhãn ("OTP", "Mã xác thực") thì sai ở app tiếng Việt lẫn app đổi nhãn theo kênh gửi.
   */
  const ml = Number(f.maxlength);
  if (t === 'text' && ml >= 4 && ml <= 8 && (f.inputmode === 'numeric' || /^\[?0-9/.test(String(f.pattern || '')))) return 'otp';
  if (f.readonly && !f.disabled) return 'computed';
  return 'text';
}

/*
 * Nhãn mở đầu / kết thúc của một khoảng: `từ ngày` ↔ `đến ngày`, `from` ↔ `to`.
 *
 * DÙNG RANH GIỚI UNICODE `[^\p{L}]`, KHÔNG dùng `\b`. `\b` đặt sau một chữ có dấu thì KHÔNG BAO GIỜ khớp:
 * `ừ` nằm ngoài `\w` nên ranh giới từ ở đó luôn sai. Bản đầu của hàm này viết `/\b(t[uừ]|…)\b/i` và nó
 * im lặng không nhận ra ô "Khoảng ngày — từ" của chính fixture. Đây là lần thứ NĂM cái bẫy này đánh trúng
 * trong dự án, và lần nào nó cũng biểu hiện giống nhau: phép đo trả về rỗng mà không báo lỗi gì.
 */
const DAU_KHOANG = /(^|[^\p{L}])(từ|tu|from|start|bắt đầu|bat dau)([^\p{L}]|$)/iu;
const CUOI_KHOANG = /(^|[^\p{L}])(đến|den|to|end|kết thúc|ket thuc)([^\p{L}]|$)/iu;

/**
 * Suy `date_range` từ một CẶP ô ngày liền nhau có nhãn từ/đến. Sửa tại chỗ, gắn `_suy_dien: true`.
 *
 * VÌ SAO PHẢI SUY, và vì sao phải đánh dấu là suy: DOM một mình KHÔNG phân biệt được "hai ô ngày rời"
 * với "một khoảng ngày". Danh mục 18 loại field tách `date` và `date_range` thành hai mục, vì khoảng
 * ngày có một lớp case riêng (`từ > đến`, khoảng rỗng, khoảng quá dài) mà hai ô ngày rời không có. Chỉ
 * `<input type="datetime-local">` là khoảng theo ĐÚNG thuộc tính; còn cặp từ/đến — dạng phổ biến nhất
 * trong app thật — chỉ nhận ra được bằng nhãn.
 *
 * Nên đây là `inferred`, không phải `observed`. Nhãn đặt lạ thì suy sai, và lúc đó mẫu số `date_range`
 * sai theo — thà ghi rõ mức bằng chứng còn hơn để một con số không biết mình từ đâu ra.
 */
function suyKhoangNgay(fields) {
  for (let i = 0; i < fields.length - 1; i += 1) {
    const a = fields[i];
    const b = fields[i + 1];
    if (a.code_loai !== 'date' || b.code_loai !== 'date') continue;
    if (!DAU_KHOANG.test(a.nhan || '') || !CUOI_KHOANG.test(b.nhan || '')) continue;
    a.code_loai = 'date_range'; a._suy_dien = true; a._cap_voi = b.ten_truong || b.nhan;
    b.code_loai = 'date_range'; b._suy_dien = true; b._cap_voi = a.ten_truong || a.nhan;
  }
  return fields;
}

/**
 * Suy component có mặt trên màn. Chỉ trả mã CÓ KHAI trong `ui_components.json` — mã lạ thì đi vào
 * `component_chua_map` để người bổ sung config, chứ không im lặng bỏ.
 */
function suyComponent(th, maChoPhep) {
  const ra = [];
  const them = (ma) => { if (maChoPhep.has(ma) && !ra.includes(ma)) ra.push(ma); };
  if (th.coBang) them('data_table');
  if (th.coPhanTrang) them('pagination');
  if (th.coBoLoc) them('filter');
  if (th.soTab >= 2) them('tab');
  if (th.coModal) them('modal');
  if (th.coToast) them('toast');
  return ra;
}

/**
 * Đọc dấu vân tay của màn đang mở.
 * @returns {Promise<{route:string,title_observed:string,fields:any[],components:string[],component_chua_map:string[],thu_tu_focus:string[],so_field:number,snapshot:any}>}
 */
async function docDauVanTay(page, tuyChon = {}) {
  const cfg = JSON.parse(require('fs').readFileSync(tuyChon.cfgPath || CFG_PATH, 'utf8'));
  const maChoPhep = new Set(cfg.components.map((c) => c.code));
  const maField = new Set(cfg.field_types.map((f) => f.code));

  const tho = await page.evaluate(({ piiLabel, emailRe, phoneRe }) => {
    const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    const hien = (el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
    };
    const PII = new RegExp(piiLabel.source, piiLabel.flags);
    const cheText = (t) => String(t == null ? '' : t)
      .replace(new RegExp(emailRe.source, emailRe.flags), '<email-masked>')
      .replace(new RegExp(phoneRe.source, phoneRe.flags), '<phone-masked>');
    const cheGiaTri = (nhan, v) => (PII.test(String(nhan || '').trim()) ? '<masked>' : cheText(v));

    const nhanCua = (el) => {
      if (el.id) {
        const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (l) return norm(l.textContent).replace(/[:*]\s*$/, '').trim();
      }
      const boc = el.closest('label');
      if (boc) return norm(boc.textContent).replace(/[:*]\s*$/, '').trim();
      return norm(el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || '');
    };

    const dsField = [];
    const oField = [...document.querySelectorAll('input, select, textarea, [contenteditable="true"]')].filter(hien);
    for (const el of oField) {
      const tag = el.tagName.toLowerCase();
      const nhan = nhanCua(el);
      const soOption = tag === 'select' ? el.querySelectorAll('option').length : null;
      dsField.push({
        nhan: cheText(nhan),
        ten_truong: el.name || el.id || null,
        tag,
        type: tag === 'input' ? (el.getAttribute('type') || 'text') : null,
        contenteditable: el.getAttribute('contenteditable') === 'true',
        multiple: !!el.multiple,
        required: !!el.required || el.getAttribute('aria-required') === 'true',
        maxlength: el.getAttribute('maxlength') ? Number(el.getAttribute('maxlength')) : null,
        minlength: el.getAttribute('minlength') ? Number(el.getAttribute('minlength')) : null,
        pattern: el.getAttribute('pattern') || null,
        min: el.getAttribute('min') !== null ? el.getAttribute('min') : null,
        max: el.getAttribute('max') !== null ? el.getAttribute('max') : null,
        inputmode: el.getAttribute('inputmode') || null,
        accept: el.getAttribute('accept') || null,
        so_option: soOption,
        // Giá trị MẶC ĐỊNH, không phải giá trị người nhập — và che theo nhãn.
        mac_dinh: cheGiaTri(nhan, tag === 'select' ? norm((el.selectedOptions && el.selectedOptions[0] || {}).textContent || '') : (el.defaultValue !== undefined ? el.defaultValue : '')),
        disabled: !!el.disabled,
        readonly: !!el.readOnly,
        checked: (el.type === 'checkbox' || el.type === 'radio') ? !!el.defaultChecked : null,
      });
    }

    /*
     * THỨ TỰ FOCUS đọc theo thứ tự tài liệu của phần tử focus được, KHÔNG đọc `tabindex` dương rồi xếp
     * lại. Lý do: `tabindex` dương là thứ hiếm và thường là lỗi a11y; còn thứ tự thật mà người dùng gặp
     * là thứ tự DOM. Ghi lại để chiều `[A11y]` (mục 21) có mẫu số, không để chấm đúng/sai ở đây.
     */
    const thuTuFocus = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')]
      .filter((el) => hien(el) && !el.disabled && el.getAttribute('tabindex') !== '-1')
      .map((el) => cheText(nhanCua(el) || norm(el.textContent) || el.tagName.toLowerCase()))
      .slice(0, 40);

    const banHien = [...document.querySelectorAll('table')].filter(hien);
    const nhanLoc = /tìm|tim|lọc|loc|search|filter|từ ngày|den ngay|đến ngày/i;
    const th = {
      coBang: banHien.length > 0,
      soBang: banHien.length,
      // Phân trang: nhận theo VAI + theo cụm số trang, không theo class (class đổi theo theme).
      coPhanTrang: !!document.querySelector('[role="navigation"][aria-label*="age" i], nav[aria-label*="rang" i], .pagination, [aria-label*="phân trang" i]')
        || [...document.querySelectorAll('a,button')].filter((e) => hien(e) && /^\d{1,3}$/.test(norm(e.textContent))).length >= 2,
      coBoLoc: [...document.querySelectorAll('form input, form select, input, select')].filter(hien)
        .some((e) => nhanLoc.test(nhanCua(e) || '') || nhanLoc.test(e.getAttribute('placeholder') || '')),
      soTab: [...document.querySelectorAll('[role="tab"], .nav-tabs > li, [data-toggle="tab"]')].filter(hien).length,
      coModal: !!document.querySelector('dialog, [role="dialog"], [role="alertdialog"], .modal'),
      coToast: !!document.querySelector('[role="status"], [role="alert"], .toast, .notification'),
      coUpload: [...document.querySelectorAll('input[type="file"]')].length > 0,
    };

    return {
      title_observed: norm(document.title),
      h1: norm((document.querySelector('h1') || {}).textContent || ''),
      url: location.href,
      fields: dsField,
      thu_tu_focus: thuTuFocus,
      thanh_phan_tho: th,
    };
  }, {
    piiLabel: { source: snapshot.PII_LABEL.source, flags: snapshot.PII_LABEL.flags },
    emailRe: { source: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.source, flags: 'g' },
    phoneRe: { source: /(?:\+?84|0)(?:\d[ .-]?){8,10}\d/.source, flags: 'g' },
  });

  const fields = tho.fields.map((f) => {
    const code = suyLoaiField(f);
    return { ...f, code_loai: maField.has(code) ? code : 'text', _code_la: maField.has(code) ? undefined : code };
  });
  suyKhoangNgay(fields);

  const components = suyComponent(tho.thanh_phan_tho, maChoPhep);
  /*
   * `coUpload` KHÔNG thành component: upload là LOẠI FIELD (`file_upload`) trong 18 mã, không phải một
   * trong 9 component. Lẫn hai danh mục này là cách tạo ra một mã không ai khai — nên ghi riêng.
   */
  const chuaMap = [];
  if (tho.thanh_phan_tho.coUpload && !maChoPhep.has('upload')) chuaMap.push('upload→field_type:file_upload');

  return {
    route: tuyChon.route || new URL(tho.url).pathname,
    title_observed: tho.h1 || tho.title_observed,
    fields,
    so_field: fields.length,
    components,
    component_chua_map: chuaMap,
    thu_tu_focus: tho.thu_tu_focus,
    loai_field_quan_sat: [...new Set(fields.map((f) => f.code_loai))].sort(),
    // Snapshot gốc giữ lại: nhãn/bảng/đơn vị tiền đã có máy khác dùng, không đọc lại lần hai.
    snapshot: tuyChon.keoSnapshot === false ? null : await snapshot.snapshotScreen(page, { maskPii: true }),
    status: 'observed',
  };
}

module.exports = { docDauVanTay, suyLoaiField, suyComponent, suyKhoangNgay };
