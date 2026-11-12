'use strict';
/**
 * ui_polish_thu.js — THU THẬP độ chỉn chu UI trên màn thật, theo DANH SÁCH MÀN do task khai. Dùng chung cho mọi task.
 *
 * Spec của task (sinh bởi `ui:polish:gen`) chỉ đăng nhập rồi gọi `thuTheoDanhSach()`. Mọi quyết định "đo được hay
 * không" nằm ở đây, có ca kiểm thử giữ, thay vì chép lại trong spec từng task.
 *
 * CHỈ ĐỌC: mở màn, bấm NHÃN TAB (postback hiển thị, không lưu), đọc style tính được. Không bấm Ghi, không nhập gì,
 * không đọc giá trị ô nhập. Dù vậy, mở màn thật cần đăng nhập ⇒ chạm UAT ⇒ cần xác nhận trước (CLAUDE.md §2).
 *
 * BỐN BÀI HỌC TỪ LƯỢT ĐO 5 CẤP app mẫu (12/11/2026) — mỗi cái từng làm số liệu sai mà lượt chạy vẫn xanh:
 *   1. Màn không mở được (404, 500, bị đẩy về trang đăng nhập) phải được GHI RA kèm lý do, không lấp chỗ trống.
 *      Không đo được ≠ đạt. Danh sách đó nằm ở `_bo-qua.json` để CLI in ra cùng kết quả.
 *   2. Màn đọc ra 0 thành phần trong vùng (form nằm trong iframe, hoặc khai sai vùng) KHÔNG được tính là "đã đo":
 *      ghi nó thành một màn rỗng là kéo mẫu số lên mà không thêm dữ liệu nào.
 *   3. Tab đọc từ DOM, không viết cứng: số tab và tên tab khác nhau giữa các cấp (4 tab, GDTX chỉ 3).
 *   4. Bấm tab xong phải KIỂM tab đã chuyển. Tab Telerik không chuyển thì màn vẫn là tab cũ, và lượt đo ghi
 *      dữ liệu của tab 1 dưới tên tab 2.
 */
const fs = require('fs');
const path = require('path');
const { thuThap } = require('./ui_polish');

const TEN_HOP_LE = /^[a-z0-9][a-z0-9-]*$/;
const MA_CAP_HOP_LE = /^[A-Za-z0-9_-]+$/;
const TAB_MAC_DINH = '.rtsTxt';
const TAB_DANG_CHON = '.rtsSelected .rtsTxt';

function boDau(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

/**
 * Kiểm danh sách màn của task. Trả `{ loi: string[], canhBao: string[] }` — có lỗi thì không sinh, không chạy.
 *
 * Danh sách có dạng:
 *   vung       vùng nội dung (CSS). Bỏ trống thì thanh đầu trang và menu lặp ở mọi màn bị đếm như nội dung.
 *   cap        (tuỳ chọn) bảng tên cấp → { ma, tienTo }. Bắt buộc khi đường dẫn có `{CAP}`.
 *   hook       (tuỳ chọn) { module, ham } — hàm của task gọi SAU đăng nhập (vd. chọn đơn vị làm việc).
 *   man        [{ ten, duong, tab?, tabDangChon? }] — `duong` là ĐƯỜNG DẪN, không có host. `tab: true` là thanh tab
 *              Telerik (`.rtsTxt`); bộ chọn khác thì kèm `tabDangChon` để kiểm tab đã chuyển.
 */
function kiemDanhSach(ds) {
  const loi = [];
  const canhBao = [];
  if (!ds || typeof ds !== 'object') return { loi: ['danh sách màn không phải một object JSON'], canhBao };
  const man = Array.isArray(ds.man) ? ds.man : [];
  if (!man.length) loi.push('`man` rỗng — không có màn nào để đo');
  const daCo = new Set();
  for (const [i, m] of man.entries()) {
    const ten = m && m.ten;
    const nhan = ten ? `màn "${ten}"` : `màn thứ ${i + 1}`;
    if (!ten || !TEN_HOP_LE.test(ten)) loi.push(`${nhan}: \`ten\` phải là chữ thường không dấu, số và gạch nối (thành tên file)`);
    else if (daCo.has(ten)) loi.push(`${nhan}: trùng tên — lượt sau sẽ đè file của lượt trước`);
    else daCo.add(ten);
    const duong = m && m.duong;
    if (typeof duong !== 'string' || !duong.startsWith('/')) loi.push(`${nhan}: \`duong\` phải bắt đầu bằng "/"`);
    else if (/:\/\//.test(duong) || duong.startsWith('//')) loi.push(`${nhan}: \`duong\` chứa host — host lấy từ môi trường, không ghim vào file của task`);
    /* Bộ chọn tab riêng thì phải có bộ chọn "tab đang chọn" riêng: không có nó thì không kiểm được tab đã chuyển, và
     * "đã chuyển" thành một điều tự khai. */
    if (m && m.tab !== undefined && m.tab !== true && m.tab !== false) {
      if (typeof m.tab !== 'string' || !m.tab) loi.push(`${nhan}: \`tab\` là true (thanh tab Telerik) hoặc một bộ chọn CSS`);
      else if (typeof m.tabDangChon !== 'string' || !m.tabDangChon) loi.push(`${nhan}: \`tab\` là bộ chọn riêng thì phải khai \`tabDangChon\` — không có nó thì không kiểm được tab đã chuyển`);
    }
  }
  const canCap = man.some((m) => m && typeof m.duong === 'string' && m.duong.includes('{CAP}'));
  const cap = ds.cap;
  if (cap !== undefined) {
    if (!cap || typeof cap !== 'object' || !Object.keys(cap).length) loi.push('`cap` phải là bảng tên cấp → { ma, tienTo }');
    else {
      for (const [ten, v] of Object.entries(cap)) {
        if (!v || !MA_CAP_HOP_LE.test(String(v.ma || ''))) loi.push(`cấp "${ten}": \`ma\` phải là chữ/số không dấu (thành tên thư mục)`);
        if (canCap && (typeof v.tienTo !== 'string' || !v.tienTo)) loi.push(`cấp "${ten}": thiếu \`tienTo\` mà đường dẫn có {CAP}`);
      }
    }
  } else if (canCap) loi.push('đường dẫn có {CAP} nhưng không khai bảng `cap`');
  if (ds.hook !== undefined) {
    const h = ds.hook;
    const ham = h && (Array.isArray(h.ham) ? h.ham : [h.ham]);
    if (!h || typeof h.module !== 'string' || !h.module.startsWith('.') || !ham.length || ham.some((x) => typeof x !== 'string' || !x)) {
      loi.push('`hook` phải là { module: "./đường/tương/đối", ham: "tênHàm" | ["hàm1", "hàm2"] }');
    }
  }
  if (typeof ds.vung !== 'string' || !ds.vung.trim()) {
    canhBao.push('không khai `vung` — thanh đầu trang và menu lặp ở mọi màn sẽ bị đếm như nội dung (lượt GDTX đầu tiên báo "cbSoftware ×11" vì thế)');
  }
  return { loi, canhBao };
}

/** Cấp đang chạy → { ma, tienTo } hoặc { loi }. Không có bảng `cap` thì mã là tên cấp bỏ dấu (hoặc "chung"). */
function giaiCap(ds, tenCap) {
  if (ds.cap) {
    const v = ds.cap[tenCap];
    if (!v) return { loi: `cấp "${tenCap || '(chưa khai)'}" không có trong bảng \`cap\` (có: ${Object.keys(ds.cap).join(', ')}) — profile của task phải ghim biến cấp/đơn vị khai trong context_pins.json` };
    return { ma: v.ma, tienTo: v.tienTo || '' };
  }
  const ma = boDau(tenCap).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { ma: ma || 'chung', tienTo: '' };
}

function duongCua(m, cap) {
  return m.duong.split('{CAP}').join(cap.tienTo);
}

function soThanhPhan(mau) {
  return Object.values(mau.theoLoai || {}).reduce((a, x) => a + x.length, 0);
}

/**
 * Mở từng màn, đo, ghi `<ra>/<ten>.json` cho màn đo được và `<ra>/_bo-qua.json` cho cả lượt.
 * Xoá JSON cũ trong `ra` trước — `ra` là thư mục của MỘT cấp, nên lượt mới của cấp này không trộn với lượt cũ.
 * Trả `{ daDo: [{ ten, n }], boQua: [{ ten, duong, lyDo }] }`.
 */
async function thuTheoDanhSach(page, { ds, cap, goc, ra, log = console.log, choMs = 2000 }) {
  if (!goc) throw new Error('ui:polish: thiếu gốc URL — KHÔNG đoán host');
  fs.mkdirSync(ra, { recursive: true });
  for (const f of fs.readdirSync(ra)) if (f.endsWith('.json')) fs.unlinkSync(path.join(ra, f));
  const daDo = [];
  const boQua = [];

  const ghi = async (ten, duong) => {
    const mau = await thuThap(page, { man: `${cap.ma}/${ten}`, vung: ds.vung || '' });
    const n = soThanhPhan(mau);
    if (!n) {
      boQua.push({ ten, duong, lyDo: 'vùng nội dung không có thành phần nào — khai sai vùng, hoặc form nằm trong iframe' });
      log(`[ui-polish] ${cap.ma}/${ten}: 0 thành phần trong vùng — KHÔNG tính là đã đo`);
      return;
    }
    fs.writeFileSync(path.join(ra, `${ten}.json`), JSON.stringify(mau));
    daDo.push({ ten, n });
    log(`[ui-polish] ${cap.ma}/${ten.padEnd(24)} ${String(n).padStart(4)} thành phần`);
  };

  for (const m of ds.man) {
    const duong = duongCua(m, cap);
    const url = `${goc}${duong}`;
    const r = await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => null);
    await page.waitForTimeout(choMs);
    let lyDo = '';
    if (!r) lyDo = 'không mở được (lỗi mạng)';
    else if (r.status() >= 400) lyDo = `HTTP ${r.status()}`;
    else {
      /* Đích cuối phải đúng đường đã xin: phiên chết thì app đẩy về trang đăng nhập với mã 200, và lượt đo
       * đọc trang đăng nhập dưới tên màn cần đo. */
      const cuoi = new URL(page.url()).pathname.toLowerCase();
      const xin = new URL(url).pathname.toLowerCase();
      if (cuoi !== xin) lyDo = `chuyển hướng sang ${new URL(page.url()).pathname}`;
    }
    if (lyDo) { boQua.push({ ten: m.ten, duong, lyDo }); log(`[ui-polish] ${cap.ma}/${m.ten}: ${lyDo} — bỏ`); continue; }

    if (!m.tab) { await ghi(m.ten, duong); continue; }
    const chon = m.tab === true ? TAB_MAC_DINH : String(m.tab);
    const tabs = (await page.locator(chon).allInnerTexts().catch(() => [])).map((t) => t.trim()).filter(Boolean);
    log(`[ui-polish] ${cap.ma}/${m.ten}: ${tabs.length} tab — ${tabs.join(' · ') || '(không thấy thanh tab, đo như một trang)'}`);
    if (!tabs.length) { await ghi(m.ten, duong); continue; }
    for (const [i, t] of tabs.entries()) {
      const ten = `${m.ten}-tab${i + 1}`;
      if (i > 0) {
        const bam = await page.locator(chon, { hasText: t }).first().click({ timeout: 10000 }).then(() => true).catch(() => false);
        await page.waitForTimeout(choMs);
        const dangChon = (await page.locator(m.tab === true ? TAB_DANG_CHON : m.tabDangChon).first().innerText().catch(() => '')).trim();
        if (!bam || dangChon !== t) {
          boQua.push({ ten, duong, lyDo: bam ? `bấm tab "${t}" nhưng tab đang chọn vẫn là "${dangChon || '?'}"` : `không bấm được tab "${t}"` });
          log(`[ui-polish] ${cap.ma}/${ten}: tab không chuyển — bỏ, KHÔNG ghi dữ liệu tab cũ dưới tên tab mới`);
          continue;
        }
      }
      await ghi(ten, duong);
    }
  }

  fs.writeFileSync(path.join(ra, '_bo-qua.json'), JSON.stringify({ cap: cap.ma, daDo, boQua }, null, 1));
  return { daDo, boQua };
}

module.exports = { kiemDanhSach, giaiCap, duongCua, thuTheoDanhSach, soThanhPhan, TAB_DANG_CHON };
