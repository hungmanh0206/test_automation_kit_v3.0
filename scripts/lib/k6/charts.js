'use strict';

/*
 * Biểu đồ SVG nội tuyến cho báo cáo hiệu năng. KHÔNG thư viện ngoài, KHÔNG CDN — báo cáo phải mở được
 * offline (yêu cầu: không phụ thuộc dịch vụ bên ngoài). Kit cũng không có chart lib trong dependencies,
 * và thêm một cái chỉ để vẽ 8 biểu đồ là đổi hợp đồng dependency của cả repo.
 *
 * SVG `viewBox` + `preserveAspectRatio` → co giãn theo khung cha, nên vẫn đọc được trên màn hình nhỏ.
 * Mọi hàm đều nhận đơn vị rõ ràng và tự in nhãn trục; biểu đồ không nhãn là biểu đồ không dùng được.
 *
 * Quy ước: hàm trả về chuỗi SVG. Không có dữ liệu → trả khối "không có dữ liệu" kèm LÝ DO, chứ không
 * vẽ một khung rỗng trông như đã đo mà bằng 0.
 */

const W = 760;
const H = 260;
const LE = { tren: 18, phai: 16, duoi: 38, trai: 62 };

const MAU = {
  muc: '#16161A', mo: '#79736A', luoi: '#E8E6E1', nen: '#FFFFFF',
  chinh: '#4F46E5', phu: '#0E9F6E', canh: '#D97706', do: '#DC2626',
  tim2: '#7C3AED', lam: '#0284C7', hong: '#DB2777', xam: '#6B7280',
};
const BANG_MAU = [MAU.chinh, MAU.phu, MAU.canh, MAU.do, MAU.lam, MAU.tim2, MAU.hong, MAU.xam];

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Làm tròn gọn để nhãn trục không ra 12 chữ số thập phân.
 *
 * PHẢI dùng CÙNG MỘT quy ước số cho cả trang. Bản đầu trộn `toFixed` (dấu chấm = thập phân) với
 * `toLocaleString('vi-VN')` (dấu chấm = hàng nghìn), nên cùng một báo cáo có `0.094 req/s` và
 * `35.138 ms` — một cái là chín mươi tư phần nghìn, một cái là ba mươi lăm nghìn, cùng một dấu chấm.
 * Người đọc không có cách nào biết. Nay tất cả đi qua vi-VN: thập phân là dấu phẩy, hàng nghìn là dấu chấm.
 */
function gon(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a === 0) return '0';
  let le;
  if (a >= 100) le = 0;
  else if (a >= 10) le = 1;
  else if (a >= 1) le = 2;
  else le = Math.min(6, Math.max(2, 1 - Math.floor(Math.log10(a))));
  return n.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: le });
}

/** Trục đẹp: chọn bước 1/2/5×10^k để vạch chia rơi vào số tròn. */
function thangDo(max, soVach = 4) {
  if (!Number.isFinite(max) || max <= 0) return { tran: 1, buoc: 0.25 };
  const tho = max / soVach;
  const bac = Math.pow(10, Math.floor(Math.log10(tho)));
  const buoc = [1, 2, 2.5, 5, 10].map((x) => x * bac).find((x) => x >= tho) || 10 * bac;
  return { tran: Math.ceil(max / buoc) * buoc, buoc };
}

function khungRong(tieuDe, lyDo) {
  return `<figure class="bd bd-rong">
  <figcaption>${esc(tieuDe)}</figcaption>
  <div class="rong"><strong>N/A</strong><span>${esc(lyDo)}</span></div>
</figure>`;
}

function gioPhutGiay(ms) {
  const d = new Date(ms);
  const p = (x) => String(x).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/* ───────────────────────── biểu đồ đường theo thời gian ───────────────────────── */

/**
 * Một hoặc nhiều chuỗi theo thời gian.
 * `chuoi`: [{ ten, mau?, diem: [{ t, v }] }] · `donVi`: nhãn trục tung · `nguong`: [{ gt, nhan }]
 */
function duongThoiGian({ tieuDe, moTa, chuoi, donVi, nguong = [], lyDoTrong = 'không có dữ liệu time-series' }) {
  const co = (chuoi || []).filter((c) => c.diem && c.diem.length);
  if (!co.length) return khungRong(tieuDe, lyDoTrong);

  const moiT = co.flatMap((c) => c.diem.map((d) => d.t));
  const t0 = Math.min(...moiT);
  const t1 = Math.max(...moiT);
  const nhipT = Math.max(1, t1 - t0);
  const dinhDl = Math.max(...co.flatMap((c) => c.diem.map((d) => d.v)), ...nguong.map((n) => n.gt));
  const { tran, buoc } = thangDo(dinhDl);

  const x = (t) => LE.trai + ((t - t0) / nhipT) * (W - LE.trai - LE.phai);
  const y = (v) => H - LE.duoi - (v / tran) * (H - LE.tren - LE.duoi);

  const luoi = [];
  for (let v = 0; v <= tran + 1e-9; v += buoc) {
    luoi.push(`<line x1="${LE.trai}" y1="${y(v).toFixed(1)}" x2="${W - LE.phai}" y2="${y(v).toFixed(1)}" stroke="${MAU.luoi}"/>`);
    luoi.push(`<text x="${LE.trai - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" class="tr">${gon(v)}</text>`);
  }

  const nhanX = [];
  for (let i = 0; i <= 4; i += 1) {
    const t = t0 + (nhipT * i) / 4;
    nhanX.push(`<text x="${x(t).toFixed(1)}" y="${H - LE.duoi + 16}" text-anchor="middle" class="tr">${gioPhutGiay(t)}</text>`);
  }

  const ve = co.map((c, i) => {
    const mau = c.mau || BANG_MAU[i % BANG_MAU.length];
    const d = c.diem.map((p, k) => `${k ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
    const vung = co.length === 1
      ? `<path d="${d} L${x(c.diem[c.diem.length - 1].t).toFixed(1)},${y(0).toFixed(1)} L${x(c.diem[0].t).toFixed(1)},${y(0).toFixed(1)} Z" fill="${mau}" opacity=".10"/>`
      : '';
    return `${vung}<path d="${d}" fill="none" stroke="${mau}" stroke-width="2" stroke-linejoin="round"/>`;
  }).join('');

  const vachNguong = nguong.map((n) => `<line x1="${LE.trai}" y1="${y(n.gt).toFixed(1)}" x2="${W - LE.phai}" y2="${y(n.gt).toFixed(1)}" stroke="${MAU.do}" stroke-width="1.5" stroke-dasharray="5 4"/>`
    + `<text x="${W - LE.phai}" y="${(y(n.gt) - 5).toFixed(1)}" text-anchor="end" class="tr nguong">${esc(n.nhan)}</text>`).join('');

  const chuThich = co.length > 1
    ? `<div class="chu-thich">${co.map((c, i) => `<span><i style="background:${c.mau || BANG_MAU[i % BANG_MAU.length]}"></i>${esc(c.ten)}</span>`).join('')}</div>`
    : '';

  return `<figure class="bd">
  <figcaption>${esc(tieuDe)}</figcaption>
  ${moTa ? `<p class="bd-mota">${esc(moTa)}</p>` : ''}
  <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(tieuDe)}">
    <rect width="${W}" height="${H}" fill="${MAU.nen}"/>
    ${luoi.join('')}
    ${ve}
    ${vachNguong}
    <line x1="${LE.trai}" y1="${H - LE.duoi}" x2="${W - LE.phai}" y2="${H - LE.duoi}" stroke="${MAU.mo}"/>
    ${nhanX.join('')}
    <text x="6" y="${LE.tren - 4}" text-anchor="start" class="tr dv">${esc(donVi)}</text>
  </svg>
  ${chuThich}
</figure>`;
}

/* ───────────────────────── biểu đồ cột ───────────────────────── */

/** Cột dọc so sánh số tổng kết. `cot`: [{ nhan, gt, mau? }] */
function cotSoSanh({ tieuDe, moTa, cot, donVi, nguong = [], lyDoTrong = 'không có số liệu' }) {
  const co = (cot || []).filter((c) => Number.isFinite(c.gt));
  if (!co.length) return khungRong(tieuDe, lyDoTrong);

  const { tran, buoc } = thangDo(Math.max(...co.map((c) => c.gt), ...nguong.map((n) => n.gt)));
  const vungX = W - LE.trai - LE.phai;
  const rong = Math.min(76, (vungX / co.length) * 0.55);
  const y = (v) => H - LE.duoi - (v / tran) * (H - LE.tren - LE.duoi);

  const luoi = [];
  for (let v = 0; v <= tran + 1e-9; v += buoc) {
    luoi.push(`<line x1="${LE.trai}" y1="${y(v).toFixed(1)}" x2="${W - LE.phai}" y2="${y(v).toFixed(1)}" stroke="${MAU.luoi}"/>`);
    luoi.push(`<text x="${LE.trai - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" class="tr">${gon(v)}</text>`);
  }

  const than = co.map((c, i) => {
    const cx = LE.trai + (vungX / co.length) * (i + 0.5);
    const mau = c.mau || BANG_MAU[i % BANG_MAU.length];
    const cao = Math.max(1, (H - LE.duoi) - y(c.gt));
    return `<rect x="${(cx - rong / 2).toFixed(1)}" y="${y(c.gt).toFixed(1)}" width="${rong.toFixed(1)}" height="${cao.toFixed(1)}" fill="${mau}" rx="3"/>`
      + `<text x="${cx.toFixed(1)}" y="${(y(c.gt) - 6).toFixed(1)}" text-anchor="middle" class="tr gt">${gon(c.gt)}</text>`
      + `<text x="${cx.toFixed(1)}" y="${H - LE.duoi + 16}" text-anchor="middle" class="tr">${esc(c.nhan)}</text>`;
  }).join('');

  const vachNguong = nguong.map((n) => `<line x1="${LE.trai}" y1="${y(n.gt).toFixed(1)}" x2="${W - LE.phai}" y2="${y(n.gt).toFixed(1)}" stroke="${MAU.do}" stroke-width="1.5" stroke-dasharray="5 4"/>`
    + `<text x="${W - LE.phai}" y="${(y(n.gt) - 5).toFixed(1)}" text-anchor="end" class="tr nguong">${esc(n.nhan)}</text>`).join('');

  return `<figure class="bd">
  <figcaption>${esc(tieuDe)}</figcaption>
  ${moTa ? `<p class="bd-mota">${esc(moTa)}</p>` : ''}
  <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(tieuDe)}">
    <rect width="${W}" height="${H}" fill="${MAU.nen}"/>
    ${luoi.join('')}
    ${than}
    ${vachNguong}
    <line x1="${LE.trai}" y1="${H - LE.duoi}" x2="${W - LE.phai}" y2="${H - LE.duoi}" stroke="${MAU.mo}"/>
    <text x="6" y="${LE.tren - 4}" text-anchor="start" class="tr dv">${esc(donVi)}</text>
  </svg>
</figure>`;
}

/** Thanh ngang xếp chồng — dùng cho phân rã thời lượng một request thành các chặng. */
function thanhXepChong({ tieuDe, moTa, phan, donVi, lyDoTrong = 'không có số liệu' }) {
  const co = (phan || []).filter((p) => Number.isFinite(p.gt) && p.gt > 0);
  if (!co.length) return khungRong(tieuDe, lyDoTrong);
  const tong = co.reduce((s, p) => s + p.gt, 0);
  const x0 = LE.trai;
  const rongVung = W - LE.trai - LE.phai;
  let chay = 0;
  const o = co.map((p, i) => {
    const w = (p.gt / tong) * rongVung;
    const x = x0 + chay;
    chay += w;
    const mau = p.mau || BANG_MAU[i % BANG_MAU.length];
    return `<rect x="${x.toFixed(1)}" y="60" width="${Math.max(1, w).toFixed(1)}" height="54" fill="${mau}"/>`;
  }).join('');
  const chu = co.map((p, i) => {
    const mau = p.mau || BANG_MAU[i % BANG_MAU.length];
    const pc = ((p.gt / tong) * 100).toFixed(1);
    return `<span><i style="background:${mau}"></i>${esc(p.nhan)} — ${gon(p.gt)} ${esc(donVi)} (${pc}%)</span>`;
  }).join('');
  return `<figure class="bd">
  <figcaption>${esc(tieuDe)}</figcaption>
  ${moTa ? `<p class="bd-mota">${esc(moTa)}</p>` : ''}
  <svg viewBox="0 0 ${W} 150" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(tieuDe)}">
    <rect width="${W}" height="150" fill="${MAU.nen}"/>
    <text x="${LE.trai}" y="44" class="tr dv">tổng ${gon(tong)} ${esc(donVi)} mỗi request (trung bình)</text>
    ${o}
  </svg>
  <div class="chu-thich">${chu}</div>
</figure>`;
}

module.exports = { BANG_MAU, MAU, cotSoSanh, duongThoiGian, esc, gon, khungRong, thanhXepChong, thangDo };
