#!/usr/bin/env node
'use strict';

/*
 * Performance Report — dựng báo cáo HTML từ artifact k6 CỦA MỘT LƯỢT CHẠY. CHỈ ĐỌC ĐĨA:
 * không chạy k6, không gọi UAT, không tốn quota cloud ⇒ test được bằng fixture.
 *
 * Vào: một thư mục lượt chạy chứa (tên file cố định, do `load_check.js` ghi ra)
 *   k6-summary.json      ← `--summary-export`  (số TỔNG KẾT: percentile, threshold, checks)
 *   k6-timeseries.json   ← `--out json=`       (NDJSON theo thời gian, có tags → biểu đồ + bảng endpoint)
 *   run-meta.json        ← metadata lượt chạy  (target, profile, runner, k6 version, cloud, exit code)
 *   k6-stdout.log        ← log đã khử secret
 * Ra: performance-report.html · performance-report.json
 *
 * BỐN TRẠNG THÁI, KHÔNG ĐƯỢC GỘP:
 *   ERROR            k6 không chạy nổi / không có summary → KHÔNG có số liệu nào. Không bao giờ thành PASS.
 *   FAIL             có số liệu, nhưng threshold trượt (hoặc check trượt).
 *   PASS             mọi threshold đạt VÀ có ít nhất một threshold để mà đạt.
 *   KHÔNG_KẾT_LUẬN   chạy xong, 0 threshold. "Chạy xong" KHÔNG phải "hiệu năng đạt" — phải nói thẳng ra.
 *
 * Thiếu dữ liệu thì ghi N/A kèm LÝ DO. Cấm nội suy time-series từ số tổng kết: không có `--out json`
 * thì bốn biểu đồ theo thời gian phải để trống, không được vẽ một đường thẳng từ giá trị trung bình.
 *
 * Dùng:
 *   node scripts/qa/perf_report.js --run-dir <thư mục lượt chạy> [--out <file .html>] [--title "..."]
 */

const fs = require('fs');
const path = require('path');
const A = require('../lib/k6/artifacts');
const C = require('../lib/k6/charts');
const { khuSecret } = require('../lib/k6/cloud');

const { esc, gon } = C;

/** Phần trăm theo cùng quy ước số vi-VN với gon() — trộn quy ước trong một trang là bẫy đọc số. */
function phanTram(ty, le = 2) {
  if (ty == null || !Number.isFinite(ty)) return 'N/A';
  return (ty * 100).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: le });
}

function arg(ten, mac) {
  const i = process.argv.indexOf(`--${ten}`);
  if (i >= 0 && (process.argv[i + 1] === undefined || String(process.argv[i + 1]).startsWith('--'))) return true;
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : mac;
}

const TEN_TEP = {
  summary: 'k6-summary.json',
  timeseries: 'k6-timeseries.json',
  meta: 'run-meta.json',
  log: 'k6-stdout.log',
  dashboard: 'k6-dashboard.html',
};

/* ───────────────────────── threshold ───────────────────────── */

/**
 * Tách `p(95)<500` → `{ khoa: 'p(95)', phep: '<', moc: 500 }` để đối chiếu với giá trị THẬT.
 * Bảng threshold mà chỉ có PASS/FAIL, không có giá trị thực đo, thì người đọc không biết trượt bao xa.
 */
function tachThreshold(bieuThuc) {
  const m = String(bieuThuc).match(/^\s*([a-z_]+(?:\(\d+(?:\.\d+)?\))?)\s*(<=|>=|<|>|===|==|!=)\s*([\d.]+)\s*$/i);
  if (!m) return null;
  return { khoa: m[1], phep: m[2], moc: Number(m[3]) };
}

/** Giá trị thực đo tương ứng một threshold. `null` khi summary không xuất khoá đó. */
function giaTriThuc(summary, metric, khoa) {
  const o = (summary.metrics || {})[metric];
  if (!o) return null;
  if (o[khoa] != null && Number.isFinite(Number(o[khoa]))) return Number(o[khoa]);
  /* `rate` của metric Rate nằm ở `value`; `count` của counter nằm ở `count`. */
  if (khoa === 'rate' && o.value != null) return Number(o.value);
  if (khoa === 'count' && o.count != null) return Number(o.count);
  return null;
}

/** Đơn vị hiển thị suy từ tên metric — để bảng không ghi "500" mà không ai biết 500 cái gì. */
function donViCua(metric, khoa) {
  if (khoa === 'rate' || khoa === 'value') return '';
  if (khoa === 'count') return 'lần';
  if (/_duration|_waiting|_blocked|_connecting|_sending|_receiving|_tls|_ms$/.test(metric)) return 'ms';
  return '';
}

/* ───────────────────────── dựng dữ liệu báo cáo ───────────────────────── */

async function thuThap(runDir) {
  const p = (t) => path.join(runDir, t);
  const meta = fs.existsSync(p(TEN_TEP.meta))
    ? JSON.parse(fs.readFileSync(p(TEN_TEP.meta), 'utf8')) : {};
  const summary = A.docSummary(p(TEN_TEP.summary));

  /* Không có `--out json` thì thử file dashboard: vẫn hơn mất trắng, nhưng PHẢI nói rõ nguồn hạn chế. */
  let ts = await A.docTimeSeries(p(TEN_TEP.timeseries));
  let nguonTs = ts.coFile ? '--out json' : null;
  if (!ts.coFile && fs.existsSync(p(TEN_TEP.dashboard))) nguonTs = 'web-dashboard (không có tags → không dựng được bảng endpoint)';

  const log = fs.existsSync(p(TEN_TEP.log)) ? khuSecret(fs.readFileSync(p(TEN_TEP.log), 'utf8')) : null;
  return { meta, summary, ts, nguonTs, log, runDir };
}

/** Trạng thái tổng thể — xem khối chú thích đầu file, bốn trạng thái không được gộp. */
function trangThaiTongThe({ meta, summary }) {
  if (!summary.coFile) {
    return { ma: 'ERROR', nhan: 'ERROR',
      vi: 'k6 không sinh ra summary — lượt này KHÔNG có số liệu nào. Đây không phải "hiệu năng đạt".' };
  }
  const truot = summary.thresholds.filter((t) => !t.dat);
  if (truot.length) {
    return { ma: 'FAIL', nhan: 'FAIL', vi: `${truot.length}/${summary.thresholds.length} threshold bị vi phạm.` };
  }
  if (!summary.thresholds.length) {
    return { ma: 'KHONG_KET_LUAN', nhan: 'KHÔNG KẾT LUẬN ĐƯỢC',
      vi: 'Script chưa khai threshold nào. Bài test chạy xong KHÔNG đồng nghĩa hiệu năng đạt — chưa đủ cơ sở để xác nhận.' };
  }
  const ckTruot = summary.checks && summary.checks.truot > 0;
  if (ckTruot) {
    return { ma: 'FAIL', nhan: 'FAIL',
      vi: `Threshold đều đạt nhưng có ${summary.checks.truot} HTTP check trượt — lỗi chức năng dưới tải.` };
  }
  if (meta.k6ExitStatus != null && meta.k6ExitStatus !== 0) {
    return { ma: 'ERROR', nhan: 'ERROR', vi: `k6 thoát với mã ${meta.k6ExitStatus} dù có summary — kiểm tra log thực thi.` };
  }
  /*
   * Threshold ĐÚNG-SAI (vd "không request nào hỏng", "không bị đá về login") là điều kiện để phép đo
   * HỢP LỆ, không phải SLA hiệu năng. Đạt hết mấy cái đó mà gắn nhãn PASS là nói với người đọc rằng
   * hệ thống đã đạt yêu cầu hiệu năng, trong khi chưa có yêu cầu nào để mà đạt. Lượt chạy phải tự khai
   * `nguongLaSla: false` trong run-meta khi rơi vào trường hợp này.
   */
  if (meta.nguongLaSla === false) {
    return { ma: 'KHONG_KET_LUAN', nhan: 'KHÔNG KẾT LUẬN ĐƯỢC',
      vi: `${summary.thresholds.length} threshold đều đạt, nhưng chúng là ngưỡng ĐÚNG-SAI (phép đo hợp lệ), không phải SLA hiệu năng. Chưa có NFR thì chưa đủ cơ sở xác nhận hiệu năng đạt.` };
  }
  return { ma: 'PASS', nhan: 'PASS', vi: `${summary.thresholds.length}/${summary.thresholds.length} threshold đạt.` };
}

/** KPI. Phân biệt throughput TRUNG BÌNH (cả bài) với CỰC ĐẠI (cửa sổ cao nhất) — không thay nhau được. */
function tinhKpi({ summary, ts }) {
  const reqs = (summary.metrics || {}).http_reqs || null;
  const iter = (summary.metrics || {}).iterations || null;
  const vmax = (summary.metrics || {}).vus_max || null;
  const vus = (summary.metrics || {}).vus || null;
  const dur = A.trendCuaMetric(summary, 'http_req_duration');
  const loi = A.soLoi(summary);

  let rpsDinh = null;
  let buoc = null;
  const dReq = ts.diem && ts.diem.get('http_reqs');
  if (dReq && dReq.length && ts.batDau != null) {
    buoc = A.buocGom(ts.batDau, ts.ketThuc);
    const o = A.gomTheoCuaSo(dReq, buoc, ts.batDau);
    /* Bỏ cửa sổ cuối: gần như luôn CỤT (bài kết thúc giữa cửa sổ) nên rps của nó thấp giả tạo. */
    const dung = o.length > 1 ? o.slice(0, -1) : o;
    rpsDinh = Math.max(...dung.map((x) => x.tong / (buoc / 1000)));
  }

  return {
    tongRequest: reqs ? Number(reqs.count) : null,
    rpsTb: reqs && reqs.rate != null ? Number(reqs.rate) : null,
    rpsDinh,
    buocGomMs: buoc,
    p95: dur ? dur['p(95)'] : null,
    p99: dur ? dur['p(99)'] ?? null : null,
    tyLeLoi: loi ? loi.ty_le : null,
    soLoi: loi ? loi.hong : null,
    /*
     * HAI con số khác nhau, không thay nhau được:
     *   vusDinh = đỉnh VU THỰC SỰ hoạt động cùng lúc (metric `vus`)
     *   vusMax  = trần VU được cấp phát sẵn (metric `vus_max`)
     * Với executor arrival-rate, k6 cấp sẵn một đống slot mà có thể chỉ dùng tới một phần; lấy
     * `vus_max` làm "số người dùng đồng thời" là khai khống tải đã dựng. Ngược lại, `vus.value`
     * trong summary là mẫu CUỐI (thường 0 vì vừa rút hết VU) nên cũng không dùng thay đỉnh được.
     */
    vusDinh: vus ? Number(vus.max != null ? vus.max : vus.value) : null,
    vusMax: vmax ? Number(vmax.max != null ? vmax.max : vmax.value) : null,
    iterations: iter ? Number(iter.count) : null,
  };
}

/* ───────────────────────── biểu đồ ───────────────────────── */

function dungBieuDo({ summary, ts, kpi }) {
  const bd = [];
  const coTs = ts.coFile && ts.soDiem > 0;
  const lyDoThieu = ts.coFile
    ? 'lượt chạy không ghi được điểm dữ liệu nào'
    : `không có ${TEN_TEP.timeseries} — lượt này chạy không kèm \`--out json\`, nên chỉ có số tổng kết. KHÔNG dựng biểu đồ thời gian từ số trung bình.`;
  const buoc = coTs ? A.buocGom(ts.batDau, ts.ketThuc) : 1000;
  const giay = buoc / 1000;
  const lay = (ten) => (coTs ? ts.diem.get(ten) || [] : []);

  /* 1. Throughput theo thời gian */
  const dReq = lay('http_reqs');
  bd.push(C.duongThoiGian({
    tieuDe: '1 · Request Throughput',
    moTa: coTs ? `Số request mỗi giây, gom theo cửa sổ ${giay}s.` : '',
    donVi: 'req/s',
    lyDoTrong: lyDoThieu,
    chuoi: dReq.length ? [{ ten: 'req/s', diem: A.gomTheoCuaSo(dReq, buoc, ts.batDau).map((o) => ({ t: o.t, v: o.tong / giay })) }] : [],
  }));

  /* 2. Percentile — cột từ số TỔNG KẾT (luôn có), cộng thêm đường theo thời gian nếu có time-series */
  const dur = A.trendCuaMetric(summary, 'http_req_duration') || {};
  const nguongDur = (summary.thresholds || [])
    .filter((t) => t.metric === 'http_req_duration')
    .map((t) => { const x = tachThreshold(t.threshold); return x ? { gt: x.moc, nhan: `ngưỡng ${t.threshold}` } : null; })
    .filter(Boolean);
  bd.push(C.cotSoSanh({
    tieuDe: '2 · Response Time Percentiles (số tổng kết cả bài)',
    moTa: dur['p(99)'] == null
      ? 'k6 không xuất p(99) ở cấu hình mặc định — ô p99 để N/A, KHÔNG lấy p95 thay.'
      : 'Percentile do k6 tính trên toàn bộ request của bài test.',
    donVi: 'ms',
    nguong: nguongDur,
    lyDoTrong: 'summary không có http_req_duration',
    cot: [
      { nhan: 'min', gt: dur.min }, { nhan: 'p50 (med)', gt: dur.med }, { nhan: 'avg', gt: dur.avg },
      { nhan: 'p90', gt: dur['p(90)'] }, { nhan: 'p95', gt: dur['p(95)'] },
      { nhan: 'p99', gt: dur['p(99)'] }, { nhan: 'max', gt: dur.max },
    ].filter((c) => c.gt != null),
  }));

  const dDur = lay('http_req_duration');
  if (dDur.length) {
    /* Phân vị theo cửa sổ phải tính từ ĐIỂM THÔ của chính cửa sổ đó — lấy trung bình của các cửa sổ
       rồi gọi nó là p95 là một con số không có thật. */
    const thung = new Map();
    for (const d of dDur) {
      const k = Math.floor((d.t - ts.batDau) / buoc);
      if (!thung.has(k)) thung.set(k, []);
      thung.get(k).push(d.v);
    }
    const moc = [...thung.keys()].sort((a, b) => a - b);
    const chuoiP = [50, 90, 95, 99].map((p) => ({
      ten: `p${p}`,
      diem: moc.map((k) => ({ t: ts.batDau + k * buoc, v: A.phanVi(thung.get(k).slice().sort((a, b) => a - b), p) })),
    }));
    bd.push(C.duongThoiGian({
      tieuDe: '2b · Response Time Percentiles theo thời gian',
      moTa: `Phân vị tính lại từ time-series theo cửa sổ ${giay}s — KHÔNG phải percentile tổng của k6, hai thứ khác nhau.`,
      donVi: 'ms', nguong: nguongDur, chuoi: chuoiP,
    }));
  }

  /* 3. Error rate theo thời gian */
  const dFail = lay('http_req_failed');
  const nguongLoi = (summary.thresholds || [])
    .filter((t) => t.metric === 'http_req_failed')
    .map((t) => { const x = tachThreshold(t.threshold); return x ? { gt: x.moc * 100, nhan: `ngưỡng ${t.threshold}` } : null; })
    .filter(Boolean);
  bd.push(C.duongThoiGian({
    tieuDe: '3 · Error Rate',
    moTa: coTs ? `Tỷ lệ request hỏng trong mỗi cửa sổ ${giay}s.` : '',
    donVi: '%', nguong: nguongLoi, lyDoTrong: lyDoThieu,
    chuoi: dFail.length ? [{ ten: '% lỗi', mau: C.MAU.do, diem: A.gomTheoCuaSo(dFail, buoc, ts.batDau).map((o) => ({ t: o.t, v: o.tb * 100 })) }] : [],
  }));

  /* 4. VUs theo thời gian */
  const dVus = lay('vus');
  bd.push(C.duongThoiGian({
    tieuDe: '4 · Virtual Users',
    moTa: coTs ? 'Số VU đang hoạt động — đối chiếu với các giai đoạn tăng/giảm tải đã cấu hình.' : '',
    donVi: 'VU', lyDoTrong: lyDoThieu,
    chuoi: dVus.length ? [{ ten: 'VU', mau: C.MAU.phu, diem: A.gomTheoCuaSo(dVus, buoc, ts.batDau).map((o) => ({ t: o.t, v: o.max })) }] : [],
  }));

  /* 5. Dropped iterations — CHỈ vẽ khi metric thật sự có. Executor không sinh metric này mà vẫn vẽ
     một đường 0 là nói với người đọc "đã đo và không rớt", trong khi ta chưa đo gì cả. */
  const dDrop = lay('dropped_iterations');
  const coDrop = Boolean((summary.metrics || {}).dropped_iterations) || dDrop.length > 0;
  bd.push(coDrop
    ? C.duongThoiGian({
      tieuDe: '5 · Dropped Iterations',
      moTa: 'Iteration bị bỏ vì k6 không cấp kịp VU cho tốc độ đã khai.',
      donVi: 'lần', lyDoTrong: 'không có điểm dữ liệu',
      chuoi: dDrop.length ? [{ ten: 'rớt', mau: C.MAU.canh, diem: A.gomTheoCuaSo(dDrop, buoc, ts.batDau).map((o) => ({ t: o.t, v: o.tong })) }] : [],
    })
    : C.khungRong('5 · Dropped Iterations',
      'executor của lượt này không sinh metric `dropped_iterations` (chỉ các executor *-arrival-rate mới có). Không vẽ đường 0 để khỏi hiểu nhầm là "đã đo, không rớt".'));

  /* 6. Iteration duration */
  const dIter = lay('iteration_duration');
  bd.push(C.duongThoiGian({
    tieuDe: '6 · Iteration Duration',
    moTa: coTs ? `Thời lượng trung bình một vòng lặp trong mỗi cửa sổ ${giay}s.` : '',
    donVi: 'ms', lyDoTrong: lyDoThieu,
    chuoi: dIter.length ? [{ ten: 'iteration', mau: C.MAU.tim2, diem: A.gomTheoCuaSo(dIter, buoc, ts.batDau).map((o) => ({ t: o.t, v: o.tb })) }] : [],
  }));

  /* 7. Phân rã thời lượng một request */
  const chang = [
    ['http_req_blocked', 'Blocked (chờ cấp kết nối)'],
    ['http_req_connecting', 'Connecting (bắt tay TCP)'],
    ['http_req_tls_handshaking', 'TLS handshaking'],
    ['http_req_sending', 'Sending (gửi yêu cầu)'],
    ['http_req_waiting', 'Waiting / TTFB (máy chủ xử lý)'],
    ['http_req_receiving', 'Receiving (nhận trả lời)'],
  ].map(([k, nhan]) => {
    const t = A.trendCuaMetric(summary, k);
    return { nhan, gt: t ? t.avg : null };
  });
  bd.push(C.thanhXepChong({
    tieuDe: '7 · HTTP Timing Breakdown (trung bình mỗi request)',
    moTa: 'Chặng nào chiếm phần lớn thời gian thì đó là chỗ đáng soi trước. Waiting/TTFB lớn ⇒ thời gian nằm ở phía máy chủ.',
    donVi: 'ms', phan: chang, lyDoTrong: 'summary không có các metric chặng http_req_*',
  }));

  /* 8. Dữ liệu vào/ra theo thời gian */
  const dRecv = lay('data_received');
  const dSent = lay('data_sent');
  bd.push(C.duongThoiGian({
    tieuDe: '8 · Data Sent / Received',
    moTa: coTs ? `Lưu lượng mỗi giây, gom theo cửa sổ ${giay}s.` : '',
    donVi: 'KB/s', lyDoTrong: lyDoThieu,
    chuoi: [
      dRecv.length ? { ten: 'nhận', mau: C.MAU.lam, diem: A.gomTheoCuaSo(dRecv, buoc, ts.batDau).map((o) => ({ t: o.t, v: o.tong / 1024 / giay })) } : null,
      dSent.length ? { ten: 'gửi', mau: C.MAU.canh, diem: A.gomTheoCuaSo(dSent, buoc, ts.batDau).map((o) => ({ t: o.t, v: o.tong / 1024 / giay })) } : null,
    ].filter(Boolean),
  }));

  void kpi;
  return bd;
}

/* ───────────────────────── nhận xét tự động ───────────────────────── */

/**
 * Nhận xét bám DỮ LIỆU, tách ba loại mệnh đề: QUAN SÁT (đo được) · GIẢ THUYẾT (có thể giải thích)
 * · CẦN XÁC MINH (phải đo thêm mới biết).
 *
 * Luật cứng: KHÔNG kết luận DB/CPU/RAM/network là nguyên nhân. Lượt k6 chỉ nhìn thấy phía client;
 * muốn nói về máy chủ thì phải có telemetry của máy chủ, mà ta không có.
 */
function nhanXet({ meta, summary, ts, kpi, trangThai }) {
  const qs = [];
  const gt = [];
  const cxm = [];

  if (trangThai.ma === 'ERROR') {
    qs.push(trangThai.vi);
    cxm.push('Chạy lại sau khi sửa lỗi thực thi; chưa có số liệu nào để bàn về hiệu năng.');
    return { qs, gt, cxm };
  }

  const dur = A.trendCuaMetric(summary, 'http_req_duration') || {};
  const waiting = A.trendCuaMetric(summary, 'http_req_waiting') || {};
  const thoiLuong = meta.thoiLuongMs ? gon(meta.thoiLuongMs / 1000) : null;

  qs.push(`Bài chạy ${thoiLuong ? `${thoiLuong} s` : 'không rõ thời lượng'}, ${kpi.tongRequest != null ? `${kpi.tongRequest.toLocaleString('vi-VN')} request` : 'không rõ số request'}`
    + `${kpi.rpsTb != null ? `, throughput trung bình ${gon(kpi.rpsTb)} req/s` : ''}`
    + `${kpi.rpsDinh != null ? ` và cực đại ${gon(kpi.rpsDinh)} req/s (cửa sổ ${kpi.buocGomMs / 1000}s)` : ''}.`);

  if (kpi.tyLeLoi != null) {
    qs.push(kpi.tyLeLoi === 0
      ? `Không request nào hỏng (0/${kpi.tongRequest != null ? kpi.tongRequest.toLocaleString('vi-VN') : '?'}).`
      : `Tỷ lệ lỗi ${phanTram(kpi.tyLeLoi)}% (${kpi.soLoi} request hỏng).`);
  }

  if (dur.avg != null && dur.max != null && dur.avg > 0) {
    const tiSo = dur.max / dur.avg;
    qs.push(`Thời gian phản hồi: trung bình ${gon(dur.avg)} ms, p95 ${dur['p(95)'] != null ? `${gon(dur['p(95)'])} ms` : 'N/A'}, lớn nhất ${gon(dur.max)} ms.`);
    if (tiSo >= 4) {
      gt.push(`Đuôi dài rõ rệt (max gấp ${gon(tiSo)}× trung bình). Có thể do một nhóm nhỏ request nặng hơn hẳn, do hàng đợi lúc tải đỉnh, hoặc do một lần khởi động nguội ở đầu bài.`);
      cxm.push('Tách request theo endpoint (bảng Phần E) và xem p99 của riêng endpoint chậm nhất, trước khi quy cho toàn hệ.');
    }
  }

  if (waiting.avg != null && dur.avg != null && dur.avg > 0) {
    const pc = (waiting.avg / dur.avg) * 100;
    qs.push(`Chặng Waiting/TTFB chiếm ${phanTram(waiting.avg / dur.avg, 0)}% thời lượng trung bình một request.`);
    if (pc >= 80) {
      gt.push('Phần lớn thời gian nằm ở chỗ chờ máy chủ trả lời, không phải ở kết nối hay truyền dữ liệu.');
      cxm.push('Cần telemetry phía máy chủ (APM / log thời gian xử lý / chỉ số DB) mới nói được vì sao chờ lâu — dữ liệu k6 KHÔNG đủ để kết luận là DB, CPU hay RAM.');
    }
  }

  /* Quan hệ tải ↔ response time: chỉ nói khi có time-series ĐỦ để so hai nửa bài. */
  const dVus = ts.coFile ? ts.diem.get('vus') || [] : [];
  const dDur = ts.coFile ? ts.diem.get('http_req_duration') || [] : [];
  if (dVus.length > 4 && dDur.length > 20) {
    const vuMax = Math.max(...dVus.map((d) => d.v));
    const vuMin = Math.min(...dVus.map((d) => d.v));
    const giua = ts.batDau + (ts.ketThuc - ts.batDau) / 2;
    const dau = dDur.filter((d) => d.t < giua).map((d) => d.v).sort((a, b) => a - b);
    const cuoi = dDur.filter((d) => d.t >= giua).map((d) => d.v).sort((a, b) => a - b);
    if (dau.length > 5 && cuoi.length > 5) {
      const p95d = A.phanVi(dau, 95);
      const p95c = A.phanVi(cuoi, 95);
      const chenh = ((p95c - p95d) / p95d) * 100;
      qs.push(`Nửa đầu bài p95 = ${gon(p95d)} ms, nửa sau p95 = ${gon(p95c)} ms (${chenh >= 0 ? '+' : ''}${gon(Math.round(chenh))}%). VU dao động ${vuMin}–${vuMax}.`);
      if (vuMax > vuMin && chenh >= 25) {
        gt.push('Response time đi lên cùng lúc với tải — dấu hiệu hệ thống bắt đầu bão hoà trong dải VU đã chạy.');
        cxm.push('Chạy thêm bậc tải cao hơn để tìm điểm gãy; một lượt chưa đủ để khẳng định đây là ngưỡng bão hoà.');
      } else if (Math.abs(chenh) < 10) {
        qs.push('Response time gần như không đổi giữa hai nửa bài trong dải tải này.');
      }
    }
    /* Throughput chững lại khi VU tăng */
    const dReq = ts.diem.get('http_reqs') || [];
    if (dReq.length > 10) {
      const buoc = A.buocGom(ts.batDau, ts.ketThuc);
      const o = A.gomTheoCuaSo(dReq, buoc, ts.batDau);
      const dung = o.length > 1 ? o.slice(0, -1) : o;
      const nua = Math.floor(dung.length / 2);
      if (nua >= 2) {
        const tbDau = dung.slice(0, nua).reduce((s, x) => s + x.tong, 0) / nua;
        const tbCuoi = dung.slice(nua).reduce((s, x) => s + x.tong, 0) / (dung.length - nua);
        if (vuMax > vuMin && tbCuoi <= tbDau * 1.05) {
          gt.push(`Throughput nửa sau (${gon(tbCuoi)} req/cửa sổ) không cao hơn nửa đầu (${gon(tbDau)}) dù VU tăng — throughput có dấu hiệu chững.`);
          cxm.push('Xác minh bằng một lượt tăng VU theo bậc rõ ràng rồi đọc throughput từng bậc, thay vì suy từ một lượt ramp liên tục.');
        }
      }
    }
  } else if (!ts.coFile) {
    cxm.push('Lượt này không có time-series (`--out json`), nên không nói được quan hệ tải ↔ response time hay throughput có chững hay không. Chạy lại kèm `--out json` nếu cần phần phân tích đó.');
  }

  const drop = (summary.metrics || {}).dropped_iterations;
  if (drop && Number(drop.count) > 0) {
    qs.push(`${drop.count} iteration bị rớt — k6 không cấp kịp VU cho tốc độ đã khai.`);
    gt.push('Con số tải THỰC TẾ dựng được thấp hơn con số đã cấu hình; mọi kết luận về throughput phải đọc theo số thực dựng được.');
    cxm.push('Tăng `maxVUs` rồi chạy lại trước khi kết luận hệ thống không chịu nổi mức tải đó.');
  }

  if (summary.checks && summary.checks.truot > 0) {
    const xau = (summary.chiTietCheck || []).filter((c) => c.truot > 0)
      .sort((a, b) => b.truot - a.truot).slice(0, 5);
    qs.push(`${summary.checks.truot} HTTP check trượt${xau.length ? `: ${xau.map((c) => `\`${c.ten}\` (${c.truot})`).join(', ')}` : ''}.`);
    gt.push('Check trượt là lỗi CHỨC NĂNG dưới tải, khác hẳn threshold trượt (lỗi hiệu năng) — đừng gộp hai thứ vào một con số.');
  }

  if (!summary.thresholds.length) {
    cxm.push('Khai `thresholds` theo NFR của từng API trong script k6. Không có ngưỡng thì báo cáo này chỉ là số liệu, không phải một verdict hiệu năng — và CẤM đặt một ngưỡng chung cho mọi API.');
  }

  return { qs, gt, cxm };
}

/* ───────────────────────── chú giải chỉ số ───────────────────────── */

/*
 * Giải thích từng chỉ số k6 ngay trong báo cáo — người đọc báo cáo QA thường không phải người chạy k6.
 *
 * Hai chỗ hay bị chép nhầm trong các bảng chú giải lưu hành nội bộ, sửa lại ở đây:
 *   · `http_req_duration` KHÔNG phải "thời gian tra cứu DNS". DNS nằm trong `http_req_blocked`.
 *     `http_req_duration` = sending + waiting + receiving, tức trọn một request.
 *   · `iteration_duration` KHÔNG bằng sending + waiting + receiving (đó chính là `http_req_duration`).
 *     Nó là thời gian chạy TRỌN một vòng `default()`, gồm cả nhiều request lẫn `sleep()` think-time.
 */
const CHU_GIAI = [
  ['http_reqs', 'Tổng số request HTTP đã bắn trong cả bài, kèm tốc độ trung bình (req/s).'],
  ['http_req_duration', 'Trọn thời gian một request: `sending + waiting + receiving`. KHÔNG bao gồm thời gian chờ cấp kết nối (`blocked`). Đây là con số người dùng cảm nhận là "trang phản hồi nhanh hay chậm".'],
  ['http_req_blocked', 'Thời gian VU đứng chờ trước khi gửi được: chờ cấp kết nối từ pool, và **tra cứu DNS** nằm ở đây.'],
  ['http_req_connecting', 'Thời gian bắt tay TCP với máy chủ.'],
  ['http_req_tls_handshaking', 'Thời gian hai bên xác thực nhau và thiết lập kênh mã hoá TLS.'],
  ['http_req_sending', 'Thời gian đẩy dữ liệu yêu cầu lên máy chủ. Lớn bất thường ⇒ payload nặng hoặc băng thông lên hẹp.'],
  ['http_req_waiting', 'Thời gian chờ máy chủ trả lời sau khi đã gửi xong (TTFB). Đây là phần thuộc về **xử lý phía máy chủ**.'],
  ['http_req_receiving', 'Thời gian nhận trọn phản hồi về.'],
  ['http_req_failed', 'Tỷ lệ request hỏng. Lưu ý đọc số thô: trong k6 trường `passes` của metric này là số request **HỎNG**, `fails` là số request OK — ngược trực giác.'],
  ['iterations', 'Số vòng `default()` đã chạy trọn. Một vòng = một lượt làm việc của một người dùng ảo.'],
  ['iteration_duration', 'Thời gian chạy trọn MỘT vòng `default()`, gồm mọi request trong vòng đó **và** cả `sleep()` think-time. Không phải tổng của ba chặng sending/waiting/receiving.'],
  ['vus', 'Số người dùng ảo đang hoạt động tại thời điểm đo.'],
  ['vus_max', 'Số chỗ VU được cấp phát sẵn — trần mà bài test có thể dâng tới.'],
  ['dropped_iterations', 'Số vòng bị bỏ vì k6 không cấp kịp VU cho tốc độ đã khai. Chỉ có ý nghĩa với executor `*-arrival-rate`.'],
  ['checks', 'Số lần khẳng định đúng/sai trong script đạt hoặc trượt. Check trượt là lỗi **chức năng** dưới tải, khác với threshold trượt (lỗi **hiệu năng**).'],
  ['data_sent · data_received', 'Lượng dữ liệu gửi đi và nhận về trong cả bài.'],
];

/** Đơn vị của một metric, suy từ tên — bảng số mà không có đơn vị thì không đọc được. */
function donViMetric(ten) {
  if (/^data_(sent|received)$/.test(ten)) return 'byte';
  if (/_duration$|_waiting$|_blocked$|_connecting$|_sending$|_receiving$|_tls_handshaking$|_ms$/.test(ten)) return 'ms';
  if (/^(checks|http_req_failed)$/.test(ten)) return '%';
  if (/^(vus|vus_max)$/.test(ten)) return 'VU';
  return '';
}

function nghiaCua(ten) {
  const goc = ten.replace(/\{.*$/, '');
  const d = CHU_GIAI.find(([k]) => k.split(' · ').indexOf(goc) >= 0);
  return d ? d[1] : null;
}

function inNghia(s) {
  return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/**
 * Phụ lục = SỐ ĐO CỦA CHÍNH LƯỢT NÀY, không phải từ điển.
 *
 * Phần B chỉ đưa 7 thẻ KPI và các biểu đồ chỉ vẽ vài metric; mọi con số k6 đã tính còn lại (gồm cả
 * metric tuỳ biến do script tự khai, vd `thuc_hien_ms`) không hiện ở đâu cả. Bảng này in TRỌN, kèm
 * đơn vị, rồi mới tới một dòng nghĩa ngắn. Metric nào k6 không xuất thì để N/A — không suy từ metric khác.
 */
function khoiChuGiai(du) {
  const m = du.summary.metrics || {};
  const ten = Object.keys(m).sort();
  if (!ten.length) {
    return '<p class="ghi">N/A — lượt này không có summary nên không có số liệu nào để liệt kê.</p>';
  }

  /*
   * TREND nhận biết bằng `avg`, KHÔNG bằng "có min/max".
   *
   * `vus` và `vus_max` là GAUGE: summary cho `{value, min, max}` — có min/max nhưng không bao giờ có
   * avg/med/p90/p95/p99. Bản đầu dò theo "có bất kỳ khoá trend nào" nên xếp nhầm chúng vào bảng trend,
   * và người đọc thấy một hàng N/A gần như trọn vẹn đúng ở hai chỉ số quan trọng nhất của một bài tải.
   * Mọi metric trend của k6 đều có `avg`, nên đó mới là dấu hiệu đúng.
   */
  const laTrend = (t) => m[t] && m[t].avg != null;
  const trend = ten.filter(laTrend);
  const khac = ten.filter((t) => !laTrend(t));
  const o = (t, k) => (m[t][k] != null ? gon(Number(m[t][k])) : 'N/A');

  const bangTrend = trend.length ? `<h3>Chỉ số thời gian (trend) — số đo của lượt này</h3>
    <table><thead><tr><th>Chỉ số</th><th>Đơn vị</th>
      <th class="so">min</th><th class="so">avg</th><th class="so">med (p50)</th>
      <th class="so">p90</th><th class="so">p95</th><th class="so">p99</th><th class="so">max</th></tr></thead><tbody>`
    + trend.map((t) => {
      const ng = nghiaCua(t);
      return `<tr><td><code>${esc(t)}</code>${ng ? `<div class="ghi" style="margin:2px 0 0;white-space:normal;max-width:380px">${inNghia(ng)}</div>` : ''}</td>`
        + `<td>${esc(donViMetric(t))}</td>`
        + `<td class="so">${o(t, 'min')}</td><td class="so">${o(t, 'avg')}</td><td class="so">${o(t, 'med')}</td>`
        + `<td class="so">${o(t, 'p(90)')}</td><td class="so">${o(t, 'p(95)')}</td><td class="so">${o(t, 'p(99)')}</td>`
        + `<td class="so">${o(t, 'max')}</td></tr>`;
    }).join('') + '</tbody></table>' : '';

  const bangKhac = khac.length ? `<h3>Chỉ số đếm / tỷ lệ / gauge — số đo của lượt này</h3>
    <table><thead><tr><th>Chỉ số</th><th class="so">Giá trị</th><th>Nghĩa</th></tr></thead><tbody>`
    + khac.map((t) => {
      const x = m[t];
      const dv = donViMetric(t);
      const phan = [];
      /*
       * `data_sent`/`data_received` là counter nhưng đơn vị là BYTE, không phải "lần".
       * Ghi "1.190.259.233 lần" thì người đọc hiểu là hơn một tỷ lượt gì đó, trong khi đó là 1,1 GB.
       */
      const laByte = dv === 'byte';
      const doByte = (v) => {
        const a = Math.abs(v);
        if (a >= 1024 ** 3) return `${gon(v / 1024 ** 3)} GB`;
        if (a >= 1024 ** 2) return `${gon(v / 1024 ** 2)} MB`;
        if (a >= 1024) return `${gon(v / 1024)} KB`;
        return `${gon(v)} B`;
      };
      if (x.count != null) phan.push(laByte ? doByte(Number(x.count)) : `${gon(Number(x.count))} lần`);
      if (x.rate != null && x.count != null) phan.push(laByte ? `${doByte(Number(x.rate))}/s` : `${gon(Number(x.rate))}/s`);
      /*
       * Với gauge (`vus`, `vus_max`), `value` là giá trị LẤY MẪU CUỐI CÙNG — gần như luôn là 0 hoặc 1
       * vì bài test vừa rút hết VU. Đưa nó lên trước là nói sai về tải đã dựng: con số có nghĩa là
       * ĐỈNH. Nên `max` đứng trước và được gọi thẳng là "đỉnh".
       */
      const laGauge = x.max != null && x.min != null && x.count == null && x.passes == null;
      if (laGauge) {
        phan.push(`đỉnh ${gon(Number(x.max))}${dv ? ` ${dv}` : ''}`);
        phan.push(`thấp nhất ${gon(Number(x.min))}${dv ? ` ${dv}` : ''}`);
        if (x.value != null) phan.push(`lấy mẫu cuối ${gon(Number(x.value))}`);
      } else {
        if (x.value != null) phan.push(dv === '%' ? `${phanTram(Number(x.value))}%` : `${gon(Number(x.value))}${dv ? ` ${dv}` : ''}`);
        if (x.rate != null && x.count == null) phan.push(dv === '%' ? `${phanTram(Number(x.rate))}%` : `${gon(Number(x.rate))}/s`);
        if (x.max != null) phan.push(`max ${gon(Number(x.max))}${dv ? ` ${dv}` : ''}`);
        if (x.min != null) phan.push(`min ${gon(Number(x.min))}${dv ? ` ${dv}` : ''}`);
      }
      if (x.passes != null || x.fails != null) {
        phan.push(t === 'http_req_failed'
          ? `${gon(Number(x.passes || 0))} hỏng / ${gon(Number(x.fails || 0))} ok`
          : `${gon(Number(x.passes || 0))} đạt / ${gon(Number(x.fails || 0))} trượt`);
      }
      const ng = nghiaCua(t);
      return `<tr><td><code>${esc(t)}</code></td><td class="so">${phan.length ? esc(phan.join(' · ')) : 'N/A'}</td>`
        + `<td style="white-space:normal">${ng ? inNghia(ng) : '—'}</td></tr>`;
    }).join('') + '</tbody></table>' : '';

  const thieu = CHU_GIAI.map(([k]) => k).filter((k) => !k.split(' · ').some((t) => m[t]));
  const khoiThieu = thieu.length
    ? `<p class="ghi">Không có trong lượt này: ${thieu.map((k) => `<code>${esc(k)}</code>`).join(' · ')} — k6 chỉ sinh metric khi executor/giao thức dùng tới, nên vắng mặt KHÔNG có nghĩa là bằng 0.</p>`
    : '';

  return `${bangTrend}${bangKhac}${khoiThieu}`;
}

/* ───────────────────────── HTML ───────────────────────── */

const CSS = `
:root{--muc:#16161A;--mo:#57534A;--nhat:#79736A;--vien:#E6E2DA;--nen:#F7F8FA;--the:#FFF;--nhan:#4F46E5;--nhan-nhat:#EEF0FF;--xanh:#0E9F6E;--do:#DC2626;--cam:#D97706;}
*{box-sizing:border-box}
body{margin:0;background:var(--nen);color:var(--muc);font:15px/1.6 'Be Vietnam Pro',system-ui,'Segoe UI',Roboto,sans-serif;-webkit-text-size-adjust:100%}
.bao{max-width:1080px;margin:0 auto;padding:28px 16px 72px}
header.dau{background:var(--the);border:1px solid var(--vien);border-radius:16px;padding:22px 24px;margin-bottom:18px}
header.dau h1{margin:0 0 4px;font-size:24px;letter-spacing:-.01em}
header.dau .phu{color:var(--nhat);font-size:13px}
.huy{display:inline-block;padding:6px 14px;border-radius:999px;font-weight:700;font-size:13px;letter-spacing:.02em}
.huy.PASS{background:#E7F7F0;color:#06694A}.huy.FAIL{background:#FDECEC;color:#9B1C1C}
.huy.ERROR{background:#FEF3E2;color:#92400E}.huy.KHONG_KET_LUAN{background:#EEF0FF;color:#3730A3}
h2{font-size:17px;margin:30px 0 10px;padding-bottom:7px;border-bottom:2px solid var(--vien)}
h3{font-size:14px;margin:18px 0 8px;color:var(--mo)}
.the{background:var(--the);border:1px solid var(--vien);border-radius:14px;padding:16px 18px}
.luoi-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(225px,1fr));gap:10px 22px}
.luoi-meta div{font-size:13px;display:flex;gap:8px;border-bottom:1px dotted var(--vien);padding:5px 0}
.luoi-meta b{color:var(--nhat);font-weight:500;min-width:118px;flex:0 0 118px}
.kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:12px;margin:12px 0}
.kpi .o{background:var(--the);border:1px solid var(--vien);border-radius:14px;padding:14px 16px}
.kpi .o .nhan{font-size:11.5px;color:var(--nhat);text-transform:uppercase;letter-spacing:.05em}
.kpi .o .so{font-size:25px;font-weight:700;letter-spacing:-.02em;margin-top:2px}
.kpi .o .dv{font-size:12px;color:var(--nhat);font-weight:500}
.kpi .o.canh .so{color:var(--do)}
table{width:100%;border-collapse:collapse;font-size:13.5px;background:var(--the);border:1px solid var(--vien);border-radius:12px;overflow:hidden}
th,td{padding:9px 12px;text-align:left;border-bottom:1px solid var(--vien)}
th{background:#FAFAF8;font-weight:600;font-size:12px;color:var(--mo);text-transform:uppercase;letter-spacing:.03em;white-space:nowrap}
td.so,th.so{text-align:right;font-variant-numeric:tabular-nums}
tr:last-child td{border-bottom:0}
.v{font-weight:700;font-size:12px}.v.PASS{color:var(--xanh)}.v.FAIL{color:var(--do)}.v.NA{color:var(--nhat)}
.bd{background:var(--the);border:1px solid var(--vien);border-radius:14px;padding:16px 18px;margin:14px 0}
.bd figcaption{font-weight:600;font-size:14px;margin-bottom:2px}
.bd .bd-mota{margin:0 0 10px;font-size:12.5px;color:var(--nhat)}
.bd svg{width:100%;height:auto;display:block}
.bd .tr{font:11px 'Be Vietnam Pro',system-ui,sans-serif;fill:var(--nhat)}
.bd .tr.gt{fill:var(--muc);font-weight:600}
.bd .tr.dv{fill:var(--mo);font-weight:600}
.bd .tr.nguong{fill:var(--do);font-weight:600}
.bd-rong .rong{display:flex;flex-direction:column;gap:4px;align-items:flex-start;padding:16px;background:var(--nen);border-radius:10px;border:1px dashed var(--vien)}
.bd-rong .rong strong{color:var(--nhat);letter-spacing:.06em}
.bd-rong .rong span{font-size:12.5px;color:var(--mo)}
.chu-thich{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:8px;font-size:12px;color:var(--mo)}
.chu-thich i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:6px;vertical-align:-1px}
ul.nx{margin:6px 0 0;padding-left:20px}ul.nx li{margin:5px 0;font-size:13.5px}
.nhom{background:var(--the);border:1px solid var(--vien);border-radius:14px;padding:14px 18px;margin:10px 0}
.nhom .tieu{font-weight:700;font-size:12px;letter-spacing:.04em;text-transform:uppercase}
.nhom.qs .tieu{color:var(--nhan)}.nhom.gt .tieu{color:var(--cam)}.nhom.cxm .tieu{color:var(--xanh)}
code{background:var(--nhan-nhat);padding:1px 5px;border-radius:5px;font-size:12.5px;font-family:ui-monospace,Consolas,monospace}
.ghi{font-size:12.5px;color:var(--nhat);margin-top:8px}
details{margin-top:12px}summary{cursor:pointer;font-size:13px;color:var(--mo)}
pre{background:#16161A;color:#E8E6E1;padding:14px;border-radius:10px;overflow:auto;font-size:11.5px;line-height:1.5;max-height:380px}
a{color:var(--nhan)}
@media (max-width:640px){.bao{padding:16px 12px 48px}.luoi-meta b{flex-basis:96px;min-width:96px}
/* Bảng nhiều cột trên màn hẹp: cho cuộn ngang thay vì bóp chữ tới mức không đọc nổi. */
table{font-size:12.5px;display:block;overflow-x:auto;white-space:nowrap}th,td{padding:7px 8px}}
`;

function oKpi(nhan, so, dv, canh) {
  return `<div class="o${canh ? ' canh' : ''}"><div class="nhan">${esc(nhan)}</div>`
    + `<div class="so">${so == null ? 'N/A' : esc(so)}${dv ? ` <span class="dv">${esc(dv)}</span>` : ''}</div></div>`;
}

function dungHtml(du) {
  const { meta, summary, ts, nguonTs, log } = du;
  const trangThai = trangThaiTongThe(du);
  const kpi = tinhKpi(du);
  const bd = dungBieuDo({ summary, ts, kpi });
  const ep = ts.coFile ? A.gomTheoEndpoint(ts) : { co: false, hang: [] };
  const nx = nhanXet({ meta, summary, ts, kpi, trangThai });

  const tieuDe = meta.tenBaiTest || path.basename(du.runDir);
  const batDau = meta.batDau ? new Date(meta.batDau) : null;
  const ketThuc = meta.ketThuc ? new Date(meta.ketThuc) : null;
  const fmt = (d) => (d ? d.toLocaleString('vi-VN', { hour12: false }) : 'N/A');

  /* A — tổng quan */
  const cloud = meta.cloud || { trangThai: 'DISABLED', ghiChu: 'không có thông tin cloud trong metadata' };
  const dongMeta = [
    ['Run ID', meta.runId],
    ['Script k6', meta.script],
    ['Hệ thống đích', meta.target],
    ['Môi trường', meta.moiTruong],
    ['Kịch bản', meta.scenarios && meta.scenarios.length ? meta.scenarios.join(', ') : (meta.scenario || 'default')],
    ['Executor', meta.executor],
    ['Profile tải', meta.profile],
    ['Nguồn profile', meta.profileSource === 'script' ? 'khai trong script' : meta.profileSource],
    ['VUs / duration', meta.vus || meta.duration ? `${meta.vus || '—'} VU / ${meta.duration || '—'}` : 'theo stages của script'],
    ['Đỉnh VU khai trong script', meta.peakVusDeclared],
    ['Bắt đầu', fmt(batDau)],
    ['Kết thúc', fmt(ketThuc)],
    ['Thời lượng', meta.thoiLuongMs != null ? `${gon(meta.thoiLuongMs / 1000)} s` : null],
    ['Phiên bản k6', meta.k6Version],
    ['Nơi chạy', meta.runner === 'docker' ? 'Docker (grafana/k6)' : 'local (k6 trên máy)'],
    ['Mã thoát k6', meta.k6ExitStatus],
    ['Nguồn time-series', nguonTs || 'KHÔNG CÓ'],
  ].filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `<div><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('');

  /*
   * ĐIỀU KIỆN ĐO — thứ quyết định số liệu này đọc được tới đâu. Vd: 20 VU dùng chung MỘT session
   * ASP.NET thì latency tăng theo VU có thể do khoá session chứ không phải máy chủ hết sức. Thiếu
   * dòng này thì người đọc rút ra kết luận mà không biết mình đang đứng trên cái gì.
   */
  const ghiChu = Array.isArray(meta.ghiChuDoLuong) ? meta.ghiChuDoLuong.filter(Boolean) : [];
  const khoiGhiChu = ghiChu.length
    ? `<div class="the" style="margin-top:12px"><h3 style="margin-top:0">Điều kiện đo &amp; cảnh báo diễn giải</h3>
      <ul class="nx">${ghiChu.map((g) => `<li>${esc(g).replace(/`([^`]+)`/g, '<code>$1</code>')}</li>`).join('')}</ul></div>`
    : '';

  const khoiCloud = `<div class="the" style="margin-top:12px">
    <h3 style="margin-top:0">Grafana Cloud k6</h3>
    <div class="luoi-meta">
      <div><b>Trạng thái</b><span><strong>${esc(cloud.trangThai)}</strong></span></div>
      <div><b>Link run</b><span>${cloud.url ? `<a href="${esc(cloud.url)}" rel="noreferrer">${esc(cloud.url)}</a>` : '—'}</span></div>
    </div>
    <p class="ghi">${esc(cloud.ghiChu || '')}${cloud.urlChuaXacMinh ? ` URL k6 in ra nhưng chưa xác minh được, nên không gắn vào báo cáo.` : ''}</p>
    <p class="ghi">Upload cloud thành công KHÔNG phải điều kiện để kết luận hiệu năng đạt — verdict ở Phần F.</p>
  </div>`;

  /* B — KPI */
  const khoiKpi = `<div class="kpi">
    ${oKpi('Tổng request', kpi.tongRequest != null ? kpi.tongRequest.toLocaleString('vi-VN') : null, '')}
    ${oKpi('Throughput trung bình', kpi.rpsTb != null ? gon(kpi.rpsTb) : null, 'req/s')}
    ${oKpi('Throughput cực đại', kpi.rpsDinh != null ? gon(kpi.rpsDinh) : null, 'req/s')}
    ${oKpi('Response time p95', kpi.p95 != null ? gon(kpi.p95) : null, 'ms')}
    ${oKpi('Error rate', kpi.tyLeLoi != null ? `${phanTram(kpi.tyLeLoi)}` : null, '%', kpi.tyLeLoi > 0)}
    ${oKpi('VU đồng thời cao nhất', kpi.vusDinh, '')}
    ${oKpi('Trần VU cấp phát', kpi.vusMax, '')}
    ${oKpi('Iterations hoàn thành', kpi.iterations != null ? kpi.iterations.toLocaleString('vi-VN') : null, '')}
  </div>
  <p class="ghi">Throughput <strong>trung bình</strong> là tổng request chia tổng thời lượng; <strong>cực đại</strong> là cửa sổ ${kpi.buocGomMs ? `${kpi.buocGomMs / 1000}s` : ''} cao nhất${kpi.rpsDinh == null ? ' (N/A vì không có time-series)' : ''}. Hai số này không thay nhau được.</p>`;

  /* E — endpoint */
  let bangEp;
  if (!ep.co) {
    bangEp = `<p class="ghi">N/A — cần time-series có tags (<code>--out json</code>) mới tách được theo endpoint. Số tổng kết của k6 không chia theo request.</p>`;
  } else {
    bangEp = `<table><thead><tr>
      <th>Endpoint</th><th>Method</th><th class="so">Request</th><th class="so">TB (ms)</th>
      <th class="so">p95 (ms)</th><th class="so">p99 (ms)</th><th class="so">Max (ms)</th>
      <th class="so">Lỗi</th><th>HTTP status</th></tr></thead><tbody>`
      + ep.hang.map((h) => `<tr><td><code>${esc(h.ten)}</code></td><td>${esc(h.method)}</td>`
        + `<td class="so">${h.soRequest.toLocaleString('vi-VN')}</td><td class="so">${gon(h.tb)}</td>`
        + `<td class="so">${gon(h.p95)}</td><td class="so">${gon(h.p99)}</td><td class="so">${gon(h.max)}</td>`
        + `<td class="so">${h.tyLeLoi == null ? 'N/A' : `${phanTram(h.tyLeLoi)}%`}</td>`
        + `<td>${Object.entries(h.status).map(([s, n]) => `${esc(s)}×${n}`).join(' · ')}</td></tr>`).join('')
      + `</tbody></table>
      <p class="ghi">Gom theo <strong>${esc(ep.gomTheo)}</strong>. Percentile ở bảng này do báo cáo tính lại từ time-series của từng endpoint — <strong>không phải</strong> percentile k6 xuất sẵn (k6 chỉ xuất percentile cho toàn bài, trừ khi khai threshold riêng theo tag).</p>`;
  }

  /* F — threshold */
  let bangTh;
  if (!summary.thresholds.length) {
    bangTh = `<div class="the"><p style="margin:0"><strong>Script chưa khai threshold nào.</strong></p>
      <p class="ghi" style="margin-bottom:0">Vì vậy <strong>chưa đủ cơ sở để xác nhận hệ thống đạt yêu cầu hiệu năng</strong>. Bài test chạy xong chỉ chứng minh hệ thống trả lời được, không chứng minh nó trả lời đủ nhanh. Ngưỡng phải lấy từ NFR của từng API — một ngưỡng chung cho mọi API là ngưỡng sai.</p></div>`;
  } else {
    bangTh = `<table><thead><tr><th>Metric</th><th>Ngưỡng yêu cầu</th><th class="so">Giá trị thực</th><th>Kết quả</th><th>Giải thích</th></tr></thead><tbody>`
      + summary.thresholds.map((t) => {
        const x = tachThreshold(t.threshold);
        const thuc = x ? giaTriThuc(summary, t.metric, x.khoa) : null;
        const dv = x ? donViCua(t.metric, x.khoa) : '';
        const giai = thuc == null
          ? 'k6 không xuất giá trị cho khoá này ở cấu hình summary hiện tại'
          : (t.dat
            ? `${gon(thuc)}${dv ? ` ${dv}` : ''} nằm trong ngưỡng ${esc(t.threshold)}`
            : `${gon(thuc)}${dv ? ` ${dv}` : ''} VI PHẠM ${esc(t.threshold)}`);
        return `<tr><td><code>${esc(t.metric)}</code></td><td><code>${esc(t.threshold)}</code></td>`
          + `<td class="so">${thuc == null ? 'N/A' : `${gon(thuc)}${dv ? ` ${dv}` : ''}`}</td>`
          + `<td><span class="v ${t.dat ? 'PASS' : 'FAIL'}">${t.dat ? 'PASS' : 'FAIL'}</span></td>`
          + `<td>${esc(giai)}</td></tr>`;
      }).join('') + `</tbody></table>`;
    if (meta.nguongLaSla === false) {
      bangTh += `<p class="ghi"><strong>Các ngưỡng trên là ngưỡng ĐÚNG-SAI, không phải SLA hiệu năng.</strong>
        Chúng chỉ xác nhận phép đo hợp lệ (không bị đá về login, không request nào hỏng). Dự án chưa có NFR
        quy định thời gian phản hồi cho từng API, nên <strong>chưa đủ cơ sở xác nhận hệ thống đạt yêu cầu
        hiệu năng</strong> — số liệu ở đây là mốc để so về sau, không phải một verdict.</p>`;
    }
  }

  const ck = summary.checks;
  const bangCheck = ck
    ? `<h3>HTTP checks (khác threshold)</h3><table><thead><tr><th>Check</th><th class="so">Đạt</th><th class="so">Trượt</th></tr></thead><tbody>`
      + (summary.chiTietCheck || []).map((c) => `<tr><td><code>${esc(c.ten)}</code></td><td class="so">${c.dat}</td><td class="so">${c.truot}</td></tr>`).join('')
      + `<tr><td><strong>Tổng</strong></td><td class="so"><strong>${ck.dat}</strong></td><td class="so"><strong>${ck.truot}</strong></td></tr>`
      + `</tbody></table><p class="ghi">Check trượt = lỗi <strong>chức năng</strong> dưới tải. Threshold trượt = lỗi <strong>hiệu năng</strong>. Lỗi thực thi (k6 không chạy nổi) và lỗi upload cloud lại là hai chuyện khác nữa — bốn thứ này không gộp.</p>`
    : '';

  /* G — nhận xét */
  const khoiNx = `
  <div class="nhom qs"><div class="tieu">Quan sát được từ số liệu</div><ul class="nx">${nx.qs.map((x) => `<li>${esc(x).replace(/`([^`]+)`/g, '<code>$1</code>')}</li>`).join('')}</ul></div>
  ${nx.gt.length ? `<div class="nhom gt"><div class="tieu">Giả thuyết về nguyên nhân (chưa xác minh)</div><ul class="nx">${nx.gt.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
  ${nx.cxm.length ? `<div class="nhom cxm"><div class="tieu">Bước kiểm tra tiếp theo</div><ul class="nx">${nx.cxm.map((x) => `<li>${esc(x).replace(/`([^`]+)`/g, '<code>$1</code>')}</li>`).join('')}</ul></div>` : ''}
  <p class="ghi">Báo cáo này chỉ nhìn hệ thống từ phía client. Không có telemetry máy chủ (CPU, RAM, DB, mạng) nên mọi câu về nguyên nhân phía máy chủ chỉ là giả thuyết, không phải kết luận.</p>`;

  const khoiLog = log
    ? `<details><summary>Log thực thi k6 (đã khử thông tin nhạy cảm)</summary><pre>${esc(log.length > 24000 ? `${log.slice(0, 24000)}\n… (cắt bớt)` : log)}</pre></details>`
    : '';

  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Performance Report · ${esc(tieuDe)}</title>
<style>${CSS}</style></head><body><div class="bao">

<header class="dau">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">
    <div><h1>Báo cáo kiểm thử hiệu năng</h1>
      <div class="phu">${esc(tieuDe)}${meta.runId ? ` · Run ID <code>${esc(meta.runId)}</code>` : ''} · dựng lúc ${esc(new Date().toLocaleString('vi-VN', { hour12: false }))}</div></div>
    <div style="text-align:right"><span class="huy ${trangThai.ma}">${esc(trangThai.nhan)}</span>
      <div class="phu" style="margin-top:6px;max-width:330px">${esc(trangThai.vi)}</div></div>
  </div>
</header>

<h2>A · Tổng quan bài test</h2>
<div class="the"><div class="luoi-meta">${dongMeta}</div></div>
${khoiGhiChu}
${khoiCloud}

<h2>B · Chỉ số tổng quan</h2>
${khoiKpi}

<h2>C · Biểu đồ bắt buộc</h2>
${bd.slice(0, 5).join('\n')}

<h2>D · Biểu đồ phân tích bổ sung</h2>
${bd.slice(5).join('\n')}

<h2>E · Hiệu năng theo endpoint</h2>
${bangEp}

<h2>F · Đánh giá Threshold</h2>
${bangTh}
${bangCheck}

<h2>G · Nhận xét tự động</h2>
${khoiNx}

<h2>Phụ lục · Toàn bộ chỉ số k6 đo được</h2>
${khoiChuGiai(du)}

<h2>Phụ lục · Artifact</h2>
<p class="ghi">Artifact của lượt chạy: <code>${esc(du.runDir)}</code></p>
${khoiLog}

</div></body></html>`;
}

/* ───────────────────────── CLI ───────────────────────── */

async function chay() {
  const runDir = arg('run-dir');
  if (!runDir || !fs.existsSync(runDir)) {
    console.error(`ERROR: cần --run-dir <thư mục lượt chạy>. Không tồn tại: ${runDir}`);
    process.exit(2);
  }
  const du = await thuThap(runDir);
  if (arg('title')) du.meta.tenBaiTest = arg('title');

  const html = dungHtml(du);
  const ra = path.resolve(arg('out', path.join(runDir, 'performance-report.html')));
  fs.mkdirSync(path.dirname(ra), { recursive: true });
  fs.writeFileSync(ra, html, 'utf8');

  const trangThai = trangThaiTongThe(du);
  const kpi = tinhKpi(du);
  const tom = {
    runId: du.meta.runId || null,
    trangThai: trangThai.ma,
    lyDo: trangThai.vi,
    kpi,
    thresholds: du.summary.thresholds,
    checks: du.summary.checks,
    cloud: du.meta.cloud || null,
    coTimeSeries: du.ts.coFile,
    soDiemTimeSeries: du.ts.soDiem || 0,
    baoCao: ra,
  };
  fs.writeFileSync(path.join(runDir, 'performance-report.json'), JSON.stringify(tom, null, 2), 'utf8');

  console.log(`[perf-report] ${trangThai.nhan} — ${trangThai.vi}`);
  console.log(`[perf-report] HTML: ${ra}`);
  console.log(`[perf-report] time-series: ${du.ts.coFile ? `${du.ts.soDiem.toLocaleString('vi-VN')} điểm` : 'KHÔNG CÓ (biểu đồ thời gian để N/A)'}`);
  return trangThai.ma;
}

if (require.main === module) {
  chay().then((ma) => {
    /* Mã thoát nói đúng chuyện gì đã xảy ra: 0 chỉ dành cho PASS. ERROR không bao giờ thành 0. */
    if (ma === 'PASS') process.exit(0);
    if (ma === 'FAIL') process.exit(arg('enforce', false) === true ? 1 : 0);
    if (ma === 'ERROR') process.exit(2);
    process.exit(0);
  }).catch((e) => {
    console.error(`[perf-report] lỗi dựng báo cáo: ${khuSecret(e.stack || e.message)}`);
    process.exit(2);
  });
}

module.exports = { TEN_TEP, dungBieuDo, dungHtml, donViCua, giaTriThuc, nhanXet, tachThreshold, thuThap, tinhKpi, trangThaiTongThe };
