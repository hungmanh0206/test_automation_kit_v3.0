#!/usr/bin/env node
'use strict';

/*
 * Phục hồi số liệu từ file export của k6 web-dashboard về định dạng artifact chuẩn, để lượt chạy CŨ
 * (chạy trước khi có đường ống này) vẫn đọc được bằng `perf_report.js`.
 *
 * PHỤC HỒI ĐƯỢC CÁI GÌ — và KHÔNG được cái gì:
 *   ✔ Bản `cumulative`: số tổng kết cả bài (avg/min/med/max/p90/p95/p99 cho trend, count/rate cho
 *     counter). Đây là RE-ENCODE, không phải suy đoán — cùng những con số k6 đã tính.
 *   ✘ Time-series per-request: dashboard chỉ giữ `snapshot` theo chu kỳ, THƯA (một lượt 11 giây chỉ
 *     có 11 bản, phần lớn ô rỗng) và số cột đổi theo thứ tự metric được đăng ký. Dựng biểu đồ thời
 *     gian từ đó là xây trên một định dạng nội bộ không có tài liệu. ⇒ KHÔNG làm. Báo cáo sẽ ghi N/A.
 *   ✘ Tags per-request ⇒ KHÔNG có bảng endpoint.
 *
 * ÁNH XẠ CỘT (chỗ dễ sai nhất): mảng `cumulative.data` xếp theo TÊN METRIC SẮP A→Z trên toàn bộ
 * metric đã đăng ký, mỗi metric một mảng con theo `aggregates` khai ở sự kiện `param`
 * (trend → [avg,max,med,min,p(90),p(95),p(99)], counter → [count,rate], gauge → [value], rate → [rate]).
 * Script TỪ CHỐI chạy nếu số cột không khớp số metric đã đăng ký — thà dừng còn hơn ánh xạ lệch một ô
 * rồi báo cáo ra một con số đúng định dạng nhưng sai metric.
 *
 * Dùng:
 *   node scripts/qa/k6_dashboard_import.js --dashboard <file.html> --run-dir <thư mục ra> [--title "..."]
 */

const fs = require('fs');
const path = require('path');
const { docDashboardHtml } = require('../lib/k6/artifacts');

function arg(ten, mac) {
  const i = process.argv.indexOf(`--${ten}`);
  if (i >= 0 && (process.argv[i + 1] === undefined || String(process.argv[i + 1]).startsWith('--'))) return true;
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : mac;
}

const DASH = arg('dashboard');
const RA = arg('run-dir');
if (!DASH || !fs.existsSync(DASH) || !RA) {
  console.error('ERROR: cần --dashboard <file.html> --run-dir <thư mục ra>');
  process.exit(2);
}

const { coFile, ban, loiDoc } = docDashboardHtml(DASH);
if (!coFile) {
  console.error(`ERROR: không bóc được dữ liệu nhúng trong ${DASH}${loiDoc ? ` (${loiDoc})` : ''}`);
  process.exit(2);
}

const param = (ban.find((d) => d.event === 'param') || {}).data || {};
const AGG = param.aggregates || {};
const cum = [...ban].reverse().find((d) => d.event === 'cumulative');
if (!cum) {
  console.error('ERROR: file dashboard không có bản `cumulative` — không có số tổng kết để phục hồi.');
  process.exit(2);
}

/* Gom định nghĩa metric theo thứ tự đăng ký, rồi sắp A→Z đúng như dashboard xếp cột. */
const dinhNghia = {};
for (const d of ban) if (d.event === 'metric') Object.assign(dinhNghia, d.data);
const ten = Object.keys(dinhNghia).sort();

if (ten.length !== cum.data.length) {
  console.error(`ERROR: lệch ánh xạ cột — ${ten.length} metric đã đăng ký nhưng bản cumulative có ${cum.data.length} cột.\n`
    + 'Định dạng dashboard đã đổi; dừng ở đây chứ KHÔNG đoán, vì ánh xạ lệch một ô là báo cáo ra số của metric khác.');
  process.exit(2);
}

/** Ghép mảng giá trị với tên mốc theo `aggregates` của chính file. */
function ghep(loai, gt) {
  const khoa = AGG[loai] || [];
  const o = {};
  khoa.forEach((k, i) => { if (gt[i] != null && Number.isFinite(gt[i])) o[k] = gt[i]; });
  return o;
}

const metrics = {};
ten.forEach((t, i) => {
  const loai = (dinhNghia[t] || {}).type || 'gauge';
  const o = ghep(loai, cum.data[i] || []);
  if (loai === 'rate') {
    /* Rate trong summary-export của k6 có `value` chứ không phải `rate`. */
    if (o.rate != null) { o.value = o.rate; delete o.rate; }
  }
  metrics[t] = o;
});

const start = ((ban.find((d) => d.event === 'start') || {}).data || [[]])[0][0] || null;
const stop = ((ban.find((d) => d.event === 'stop') || {}).data || [[]])[0][0] || null;

fs.mkdirSync(RA, { recursive: true });
fs.writeFileSync(path.join(RA, 'k6-summary.json'), JSON.stringify({ root_group: null, metrics }, null, 2), 'utf8');

const meta = {
  tenBaiTest: arg('title', path.basename(DASH, '.html')),
  runId: arg('run-id', path.basename(RA)),
  script: param.scriptPath || null,
  target: arg('target', null),
  moiTruong: arg('moi-truong', null),
  runner: 'k6',
  k6Version: arg('k6-version', null),
  batDau: start ? new Date(start).toISOString() : null,
  ketThuc: stop ? new Date(stop).toISOString() : null,
  thoiLuongMs: start && stop ? stop - start : null,
  profile: arg('profile', null),
  nguongLaSla: false,
  ghiChuDoLuong: [
    `Số liệu phục hồi từ file export của k6 web-dashboard (\`${path.basename(DASH)}\`), không phải từ \`--summary-export\`. Đây là RE-ENCODE bản \`cumulative\` — cùng những con số k6 đã tính, không suy đoán.`,
    'Lượt chạy này KHÔNG có `--out json`, nên không có time-series per-request: mọi biểu đồ theo thời gian và bảng endpoint đều N/A. Dashboard chỉ giữ snapshot theo chu kỳ, thưa và không có tags.',
    'Threshold của lượt cũ không nằm trong file dashboard ⇒ bảng Phần F trống. Không có ngưỡng thì không có verdict hiệu năng.',
  ].concat(process.argv.reduce((ds, v, i) => {
    if (v === '--ghi-chu' && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ds.push(process.argv[i + 1]);
    return ds;
  }, [])),
  cloud: { trangThai: 'NOT_AVAILABLE', url: null, ghiChu: 'lượt chạy cũ, không stream lên cloud' },
};
fs.writeFileSync(path.join(RA, 'run-meta.json'), JSON.stringify(meta, null, 2), 'utf8');

console.log(`[dashboard-import] ${ten.length} metric → ${path.join(RA, 'k6-summary.json')}`);
console.log(`[dashboard-import] thời lượng ${meta.thoiLuongMs != null ? `${(meta.thoiLuongMs / 1000).toFixed(1)} s` : 'N/A'} · metric: ${ten.join(', ')}`);
