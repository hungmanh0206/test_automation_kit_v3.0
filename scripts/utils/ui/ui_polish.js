/**
 * ui_polish.js — đo ĐỘ CHỈN CHU UI xuyên màn: khoảng cách có theo một THANG không, cùng một loại thành phần
 * có giống nhau ở mọi màn không, hệ thống dùng bao nhiêu font / cỡ chữ / màu.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ FILE NÀY
 *
 * `geometry.js` đo TỪNG element theo bất biến tự thân (bị đè, tràn, cắt chữ). `screen_snapshot.js` chụp NỘI
 * DUNG (nhãn, cột, đơn vị). Không cái nào hỏi: nút "Ghi" ở màn này cao 32px, ở màn kia 28px, padding 7px ở
 * một chỗ duy nhất trong hệ thống — tức độ chuẩn hoá giữa các màn. Lớp lỗi đó người dùng THẤY ngay ("trông
 * lôm côm") mà mọi assertion vẫn xanh.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * ORACLE — và giới hạn của nó (CLAUDE.md §3)
 *
 *   · CÓ thang thiết kế (`thang: [4, 8, 12, 16, 24, 32]` từ Figma / design token) ⇒ so với nguồn ĐỘC LẬP.
 *   · KHÔNG có ⇒ "chuẩn" là ĐA SỐ trong chính hệ thống: bước khoảng cách phủ nhiều nhất, giá trị chiếm đa số của
 *     từng thuộc tính. Lệch đa số KHÔNG phải bug — là OBSERVATION. Đa số có thể chính là cái sai.
 * Máy không bao giờ tự gọi một độ lệch là bug.
 *
 * KHÔNG ĐỌC GIÁ TRỊ Ô NHẬP. Chỉ đọc style và hình học; chữ của NÚT giữ ≤ 20 ký tự để chỉ ra nút nào. Ô nhập trên
 * màn thật có thể đang chứa PII khách.
 */
'use strict';

/* Chạy TRONG TRANG. Không tham chiếu biến ngoài — Playwright tuần tự hoá thân hàm. */
function thuThapTrongTrang(opts) {
  const LOAI = {
    nut: 'button, input[type=submit], input[type=button], input[type=reset], a.btn, .btn, .RadButton, .rbButton',
    o_nhap: 'input[type=text], input[type=number], input[type=email], input[type=tel], input[type=password], input[type=search], input[type=date], input:not([type]), textarea, select, .rcbInput, .riTextBox',
    nhan: 'label, .label, .control-label',
    tieu_de: 'h1, h2, h3, h4, h5, .title, .page-title',
  };
  const hienThi = (e) => {
    if (!e || !e.getBoundingClientRect) return false;
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(e);
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0;
  };
  const px = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.round(n * 2) / 2 : null; };
  const ten = (e) => {
    const id = e.id && e.id.length <= 60 ? `#${e.id}` : '';
    const cls = (e.className && typeof e.className === 'string') ? e.className.trim().split(/\s+/)[0] : '';
    return `${e.tagName.toLowerCase()}${id}${cls && !id ? `.${cls}` : ''}`;
  };
  const daThay = new Set();
  const theoLoai = {};
  for (const [loai, sel] of Object.entries(LOAI)) {
    theoLoai[loai] = [];
    for (const e of document.querySelectorAll(sel)) {
      if (daThay.has(e) || !hienThi(e)) continue;
      daThay.add(e);
      const s = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      const chu = loai === 'nut' ? String((e.value && e.tagName === 'INPUT') ? e.value : e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 20) : '';
      theoLoai[loai].push({
        ten: ten(e), chu,
        cao: px(r.height),
        padding: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(px).join(' '),
        coChu: px(s.fontSize), dam: s.fontWeight,
        font: String(s.fontFamily || '').split(',')[0].replace(/["']/g, '').trim().toLowerCase(),
        boGoc: px(s.borderTopLeftRadius), mau: s.color, nen: s.backgroundColor,
      });
    }
  }
  /* Thang khoảng cách: mọi padding / margin / gap > 0 của element đang hiện. */
  const khoangCach = {};
  const viDu = {};
  const tatCa = [...document.body.querySelectorAll('*')].slice(0, opts.toiDa || 4000);
  for (const e of tatCa) {
    if (!hienThi(e)) continue;
    const s = getComputedStyle(e);
    for (const p of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'rowGap', 'columnGap']) {
      const v = px(s[p]);
      if (!v || v <= 0) continue;
      khoangCach[v] = (khoangCach[v] || 0) + 1;
      if (!viDu[v]) viDu[v] = [];
      if (viDu[v].length < 3) viDu[v].push(`${ten(e)} ${p}`);
    }
  }
  const font = {}; const coChu = {}; const mau = {};
  for (const e of tatCa) {
    if (!hienThi(e) || !e.childNodes || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const s = getComputedStyle(e);
    const f = String(s.fontFamily || '').split(',')[0].replace(/["']/g, '').trim().toLowerCase();
    font[f] = (font[f] || 0) + 1;
    const c = px(s.fontSize); coChu[c] = (coChu[c] || 0) + 1;
    mau[s.color] = (mau[s.color] || 0) + 1;
  }
  return { man: opts.man || location.pathname, duongDan: location.pathname, theoLoai, khoangCach, viDu, font, coChu, mau };
}

async function thuThap(page, opts = {}) {
  return page.evaluate(thuThapTrongTrang, { man: opts.man || '', toiDa: opts.toiDa || 4000 });
}

/* ─────────────────────────────── phân tích — HÀM THUẦN ─────────────────────────────── */

const SAN_PHU = 0.8; // bước được coi là thang khi phủ ≥ 80% số lần dùng
const BUOC_UNG_VIEN = [8, 6, 5, 4, 2];
const THUOC_TINH = ['cao', 'padding', 'coChu', 'font', 'boGoc'];

function congDon(maus, khoa) {
  const ra = {};
  for (const m of maus) for (const [v, n] of Object.entries(m[khoa] || {})) ra[v] = (ra[v] || 0) + n;
  return ra;
}

/**
 * @param maus mảng kết quả `thuThap` của nhiều màn
 * @param opts.thang  thang khoảng cách THIẾT KẾ (px) — có thì so với nó, không thì suy bước từ đa số
 */
function phanTich(maus, opts = {}) {
  /* ① thang khoảng cách */
  const kc = congDon(maus, 'khoangCach');
  const tongLan = Object.values(kc).reduce((a, b) => a + b, 0);
  const tinhChinh = Object.entries(kc).filter(([v]) => Number(v) <= 1).reduce((a, [, n]) => a + n, 0);
  const giaTri = Object.entries(kc).filter(([v]) => Number(v) > 1).map(([v, n]) => ({ v: Number(v), n }));
  const tongXet = giaTri.reduce((a, x) => a + x.n, 0);
  let nguon; let buoc = null; let hopLe;
  if (Array.isArray(opts.thang) && opts.thang.length) {
    nguon = 'thang thiết kế';
    const t = new Set(opts.thang.map(Number));
    hopLe = (v) => t.has(v);
  } else {
    nguon = 'suy từ đa số';
    for (const b of BUOC_UNG_VIEN) {
      const phu = giaTri.filter((x) => x.v % b === 0).reduce((a, x) => a + x.n, 0);
      if (tongXet && phu / tongXet >= SAN_PHU) { buoc = b; break; }
    }
    hopLe = (v) => (buoc ? v % buoc === 0 : true);
  }
  const viDuKc = {};
  for (const m of maus) for (const [v, ds] of Object.entries(m.viDu || {})) { if (!viDuKc[v]) viDuKc[v] = []; for (const d of ds) if (viDuKc[v].length < 4) viDuKc[v].push(`${m.man}: ${d}`); }
  const leThang = giaTri.filter((x) => !hopLe(x.v)).sort((a, b) => b.n - a.n).map((x) => ({ ...x, viDu: viDuKc[x.v] || [] }));

  /* ② đồng nhất theo loại thành phần, xuyên màn */
  const dongNhat = {};
  for (const loai of ['nut', 'o_nhap', 'nhan', 'tieu_de']) {
    const els = maus.flatMap((m) => (m.theoLoai && m.theoLoai[loai] ? m.theoLoai[loai].map((e) => ({ ...e, man: m.man })) : []));
    if (els.length < 3) continue; // dưới 3 thì "đa số" không có nghĩa
    dongNhat[loai] = {};
    for (const tt of THUOC_TINH) {
      const dem = {};
      for (const e of els) { const k = String(e[tt]); dem[k] = (dem[k] || 0) + 1; }
      const xep = Object.entries(dem).sort((a, b) => b[1] - a[1]);
      const [mode, nMode] = xep[0];
      const lech = els.filter((e) => String(e[tt]) !== mode).map((e) => `${e.man}: ${e.ten}${e.chu ? ` "${e.chu}"` : ''} = ${e[tt]}`);
      dongNhat[loai][tt] = { daSo: mode, tiLe: Math.round((nMode / els.length) * 100), bienThe: xep.length, lech: lech.slice(0, 8), soLech: lech.length };
    }
  }

  /* ③ kích thước hệ thống */
  const dem = (k) => Object.keys(congDon(maus, k)).filter((x) => x && x !== 'null').length;
  return {
    soMan: maus.length,
    khoangCach: { nguon, buoc, thang: opts.thang || null, tongLan, tinhChinh, soGiaTri: giaTri.length, leThang },
    dongNhat,
    heThong: { soFont: dem('font'), soCoChu: dem('coChu'), soMau: dem('mau'), font: congDon(maus, 'font'), coChu: congDon(maus, 'coChu') },
  };
}

module.exports = { thuThap, thuThapTrongTrang, phanTich, BUOC_UNG_VIEN, SAN_PHU };
