#!/usr/bin/env node
'use strict';

/*
 * Mục lục báo cáo hiệu năng THEO TESTCASE: liệt kê MỌI case Performance của bộ canonical, bấm vào
 * case nào thì mở báo cáo riêng của case đó.
 *
 * Vì sao liệt kê CẢ case chưa chạy: một trang chỉ hiện những case đã chạy sẽ trông như đã phủ hết.
 * Mẫu số phải là bộ canonical, không phải "những gì tôi chạy được" (CLAUDE.md §3). Case chưa chạy
 * hiện nguyên trạng thái `CHƯA CHẠY` kèm lý do, và lý do phải do người ghi vào `so-case.json` —
 * máy KHÔNG tự bịa ra lý do.
 *
 * Nguồn:
 *   · bộ canonical `test-cases/<module>.md`  → danh sách case + tiêu đề (mẫu số)
 *   · `<reports>/performance/<run>/performance-report.json` + `run-meta.json` → lượt đã chạy
 *   · `<reports>/performance/so-case.json` (tuỳ chọn) → trạng thái/lý do cho case chưa chạy
 *
 * Ghép lượt chạy ↔ case bằng mã `CSDL_..._TC_###` tìm trong `tenBaiTest` của `run-meta.json`.
 * Một case chạy nhiều lượt thì lấy lượt MỚI NHẤT làm liên kết chính, các lượt cũ liệt kê bên dưới —
 * không xoá lượt cũ, vì so theo thời gian mới là chỗ số hiệu năng có nghĩa.
 *
 * Dùng:
 *   node scripts/qa/perf_index.js --perf-dir <.../reports/performance> --testcases <.../x.md> [--loai Performance]
 */

const fs = require('fs');
const path = require('path');
const { esc, gon } = require('../lib/k6/charts');

function arg(ten, mac) {
  const i = process.argv.indexOf(`--${ten}`);
  if (i >= 0 && (process.argv[i + 1] === undefined || String(process.argv[i + 1]).startsWith('--'))) return true;
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : mac;
}

const PERF_DIR = arg('perf-dir');
const MD = arg('testcases');
const LOAI = String(arg('loai', 'Performance'));
if (!PERF_DIR || !fs.existsSync(PERF_DIR) || !MD || !fs.existsSync(MD)) {
  console.error('ERROR: cần --perf-dir <thư mục performance> --testcases <bộ canonical .md>');
  process.exit(2);
}

/* ── mẫu số: đọc case từ bộ canonical ── */
function docCase() {
  const ra = [];
  for (const l of fs.readFileSync(MD, 'utf8').split('\n')) {
    if (!/^\|\s*[A-Z0-9_]+_TC_\d+\s*\|/.test(l)) continue;
    const c = l.split('|').map((x) => x.trim());
    const id = c[1];
    const loai = c[2] || '';
    if (LOAI && loai.toLowerCase() !== LOAI.toLowerCase()) continue;
    ra.push({
      id,
      loai,
      nhom: c[5] || '',
      tieuDe: (c[6] || '').split(' - ')[0],
      uuTien: c[c.length - 2] || '',
    });
  }
  return ra;
}

/* ── các lượt đã chạy ── */
function docLuot() {
  const ra = [];
  for (const ten of fs.readdirSync(PERF_DIR)) {
    const d = path.join(PERF_DIR, ten);
    if (!fs.statSync(d).isDirectory()) continue;
    const fJson = path.join(d, 'performance-report.json');
    const fMeta = path.join(d, 'run-meta.json');
    if (!fs.existsSync(fJson)) continue;
    let bao; let meta = {};
    try { bao = JSON.parse(fs.readFileSync(fJson, 'utf8')); } catch (e) { continue; }
    try { if (fs.existsSync(fMeta)) meta = JSON.parse(fs.readFileSync(fMeta, 'utf8')); } catch (e) { /* bỏ qua */ }
    const nhan = `${meta.tenBaiTest || ''} ${ten}`;
    const m = nhan.match(/[A-Z0-9]+_(?:[A-Z0-9]+_)*TC_\d+/i);
    ra.push({
      thuMuc: ten,
      caseId: m ? m[0].toUpperCase() : null,
      bao,
      meta,
      khi: meta.ketThuc ? Date.parse(meta.ketThuc) : 0,
      html: path.join(ten, 'performance-report.html').replace(/\\/g, '/'),
    });
  }
  return ra.sort((a, b) => b.khi - a.khi);
}

const soCasePath = path.join(PERF_DIR, 'so-case.json');
const soCase = fs.existsSync(soCasePath) ? JSON.parse(fs.readFileSync(soCasePath, 'utf8')) : {};

const dsCase = docCase();
const dsLuot = docLuot();
const theoCase = new Map();
for (const l of dsLuot) {
  if (!l.caseId) continue;
  if (!theoCase.has(l.caseId)) theoCase.set(l.caseId, []);
  theoCase.get(l.caseId).push(l);
}
/*
 * Lượt không gắn được vào case nào thì KHÔNG hiện ở trang này: chủ dự án yêu cầu mục lục chỉ gồm
 * testcase. Dữ liệu của chúng không mất — artifact vẫn nằm nguyên trong thư mục lượt chạy.
 */

const NHAN = {
  PASS: 'PASS', FAIL: 'FAIL', ERROR: 'ERROR',
  KHONG_KET_LUAN: 'KHÔNG KẾT LUẬN', CHUA_CHAY: 'CHƯA CHẠY',
  /* Mọi vế ĐO ĐƯỢC của ô kỳ vọng đều đạt, nhưng có vế chưa dựng được tiền đề để đo. */
  PASS_CO_LECH: 'PASS · CÓ LỆCH',
};

function the(ma) { return `<span class="chip ${esc(ma)}">${esc(NHAN[ma] || ma)}</span>`; }

function dongCase(c) {
  const luot = theoCase.get(c.id) || [];
  const ghi = soCase[c.id] || {};
  const moi = luot[0];
  /*
   * ƯU TIÊN VERDICT CỦA CASE, không phải verdict của ngưỡng k6.
   *
   * `performance-report.json → trangThai` chỉ trả lời "threshold khai trong script có đạt không".
   * Script thường không khai ngưỡng thời gian, nên nó ra `KHÔNG KẾT LUẬN` kể cả khi case ĐÃ chấm
   * được — vì neo kỳ vọng thật nằm ở ô `Kết quả mong đợi` của chính case (mốc số, số bản ghi phải
   * vào đủ…), thứ mà máy không tự đọc ra verdict được.
   * Vì vậy: `so-case.json` khai `trangThai` thì nó THẮNG; không khai thì mới lùi về verdict của lượt chạy.
   */
  const ma = ghi.trangThai || (moi ? moi.bao.trangThai : 'CHUA_CHAY');
  const nguonVerdict = ghi.trangThai ? 'đối chiếu ô Kết quả mong đợi của case'
    : (moi ? 'ngưỡng khai trong script k6 (case chưa được chấm tay)' : null);
  const k = moi ? moi.bao.kpi || {} : {};

  const lyDo = ghi.lyDo || (moi ? moi.bao.lyDo : '');
  const lech = Array.isArray(ghi.lech) ? ghi.lech : [];

  const oSo = moi
    ? `<td class="so">${k.tongRequest != null ? gon(k.tongRequest) : '—'}</td>`
      + `<td class="so">${k.p95 != null ? `${gon(k.p95)} ms` : '—'}</td>`
      + `<td class="so">${k.tyLeLoi != null ? `${(k.tyLeLoi * 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%` : '—'}</td>`
      + `<td class="so">${k.vusMax != null ? gon(k.vusMax) : '—'}</td>`
    : '<td class="so">—</td><td class="so">—</td><td class="so">—</td><td class="so">—</td>';

  const tenO = moi
    ? `<a href="${esc(moi.html)}"><strong>${esc(c.id)}</strong></a>`
    : `<strong class="mo">${esc(c.id)}</strong>`;

  const them = luot.length > 1
    ? `<div class="luot-cu">lượt trước: ${luot.slice(1).map((l) => `<a href="${esc(l.html)}">${esc(l.thuMuc)}</a>`).join(' · ')}</div>`
    : '';

  return `<tr class="${moi ? 'co' : 'khong'}"${moi ? ` onclick="window.location='${esc(moi.html)}'"` : ''}>
    <td>${tenO}<div class="tieu">${esc(c.tieuDe)}</div>${them}</td>
    <td>${the(ma)}${nguonVerdict ? `<div class="nguon">nguồn verdict: ${esc(nguonVerdict)}</div>` : ''}${lyDo ? `<div class="tieu">${esc(lyDo)}</div>` : ''}${lech.length ? `<div class="lech">${lech.map((x) => `<span>${esc(x)}</span>`).join('')}</div>` : ''}</td>
    ${oSo}
  </tr>`;
}

const dem = { PASS: 0, PASS_CO_LECH: 0, FAIL: 0, ERROR: 0, KHONG_KET_LUAN: 0, CHUA_CHAY: 0 };
for (const c of dsCase) {
  const luot = theoCase.get(c.id) || [];
  const ma = (soCase[c.id] || {}).trangThai || (luot.length ? luot[0].bao.trangThai : 'CHUA_CHAY');
  dem[ma] = (dem[ma] || 0) + 1;
}
const daChay = dsCase.length - dem.CHUA_CHAY;

const CSS = `
:root{--muc:#16161A;--mo:#57534A;--nhat:#79736A;--vien:#E6E2DA;--nen:#F7F8FA;--the:#FFF;--nhan:#4F46E5;--xanh:#0E9F6E;--do:#DC2626;--cam:#D97706;}
*{box-sizing:border-box}
body{margin:0;background:var(--nen);color:var(--muc);font:15px/1.6 'Be Vietnam Pro',system-ui,'Segoe UI',Roboto,sans-serif}
.bao{max-width:1180px;margin:0 auto;padding:28px 16px 72px}
header{background:var(--the);border:1px solid var(--vien);border-radius:16px;padding:22px 24px;margin-bottom:16px}
h1{margin:0 0 4px;font-size:24px;letter-spacing:-.01em}
.phu{color:var(--nhat);font-size:13px}
.tong{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:14px 0 18px}
.tong .o{background:var(--the);border:1px solid var(--vien);border-radius:14px;padding:12px 16px}
.tong .nhan{font-size:11.5px;color:var(--nhat);text-transform:uppercase;letter-spacing:.05em}
.tong .so{font-size:24px;font-weight:700;letter-spacing:-.02em}
table{width:100%;border-collapse:collapse;font-size:13.5px;background:var(--the);border:1px solid var(--vien);border-radius:12px;overflow:hidden}
th,td{padding:11px 12px;text-align:left;border-bottom:1px solid var(--vien);vertical-align:top}
th{background:#FAFAF8;font-weight:600;font-size:12px;color:var(--mo);text-transform:uppercase;letter-spacing:.03em;white-space:nowrap}
td.so,th.so{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
tr:last-child td{border-bottom:0}
tr.co{cursor:pointer}
tr.co:hover{background:#F5F6FF}
tr.khong{opacity:.72}
.mo{color:var(--nhat)}
a{color:var(--nhan);text-decoration:none}
a:hover{text-decoration:underline}
.tieu{font-size:12.5px;color:var(--nhat);font-weight:400;margin-top:2px;white-space:normal}
.luot-cu{font-size:11.5px;color:var(--nhat);margin-top:4px}
.nguon{font-size:11px;color:var(--nhat);margin-top:3px;font-style:italic;white-space:normal}
.lech{margin-top:5px;display:flex;flex-direction:column;gap:3px}
.lech span{font-size:11.5px;color:var(--cam);background:#FEF6E7;border-radius:6px;padding:2px 7px;white-space:normal}
.chip{display:inline-block;padding:3px 10px;border-radius:999px;font-weight:700;font-size:11.5px;white-space:nowrap}
.chip.PASS{background:#E7F7F0;color:#06694A}.chip.FAIL{background:#FDECEC;color:#9B1C1C}
.chip.ERROR{background:#FEF3E2;color:#92400E}.chip.KHONG_KET_LUAN{background:#EEF0FF;color:#3730A3}
.chip.CHUA_CHAY{background:#F1F0EC;color:#6B6558}
.chip.PASS_CO_LECH{background:#EAF6EF;color:#1F6F4A;box-shadow:inset 0 0 0 1px #9FD4B8}
.ghi{font-size:12.5px;color:var(--nhat);margin-top:10px}
@media (max-width:720px){table{display:block;overflow-x:auto}.bao{padding:16px 12px 48px}}
`;

const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Báo cáo hiệu năng theo testcase</title>
<style>${CSS}</style></head><body><div class="bao">

<header>
  <h1>Báo cáo hiệu năng theo testcase</h1>
  <div class="phu">Nguồn testcase: <code>${esc(path.basename(MD))}</code> · lọc loại <code>${esc(LOAI)}</code>
    · ${dsCase.length} case · dựng lúc ${esc(new Date().toLocaleString('vi-VN', { hour12: false }))}</div>
</header>

<div class="tong">
  <div class="o"><div class="nhan">Tổng case</div><div class="so">${dsCase.length}</div></div>
  <div class="o"><div class="nhan">Đã có lượt chạy</div><div class="so">${daChay}</div></div>
  <div class="o"><div class="nhan">PASS</div><div class="so">${(dem.PASS || 0) + (dem.PASS_CO_LECH || 0)}</div></div>
  <div class="o"><div class="nhan">FAIL</div><div class="so">${dem.FAIL || 0}</div></div>
  <div class="o"><div class="nhan">Không kết luận</div><div class="so">${dem.KHONG_KET_LUAN || 0}</div></div>
  <div class="o"><div class="nhan">Chưa chạy</div><div class="so">${dem.CHUA_CHAY || 0}</div></div>
</div>

<table><thead><tr>
  <th>Case</th><th>Trạng thái &amp; độ lệch</th>
  <th class="so">Request</th><th class="so">p95</th><th class="so">Lỗi</th><th class="so">VU</th>
</tr></thead><tbody>
${dsCase.map(dongCase).join('\n')}
</tbody></table>

<p class="ghi">Bấm vào dòng của case để mở báo cáo riêng của case đó. Case <strong>CHƯA CHẠY</strong> là
case có trong bộ canonical nhưng chưa có lượt đo nào — mẫu số ở đây là bộ canonical, không phải
"những gì đã chạy được", nên trang này không bao giờ trông như đã phủ hết khi chưa phủ hết.</p>

</div></body></html>`;

const ra = path.join(PERF_DIR, 'index.html');
fs.writeFileSync(ra, html, 'utf8');
console.log(`[perf-index] ${dsCase.length} case · ${daChay} đã chạy · ${dem.CHUA_CHAY || 0} chưa chạy`);
console.log(`[perf-index] ${ra}`);
