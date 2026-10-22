'use strict';

/*
 * Đọc artifact k6 → cấu trúc chung cho báo cáo. KHÔNG chạy k6, KHÔNG gọi mạng, KHÔNG thêm dependency.
 * Tách khỏi `scripts/qa/load_check.js` để test được bằng fixture (không tốn quota cloud, không chạm UAT).
 *
 * BA NGUỒN, KHÁC NHAU VỀ BẢN CHẤT — trộn là báo cáo sai:
 *   1. `--summary-export <f>`  → JSON TỔNG KẾT cuối bài. Có percentile, KHÔNG có diễn biến theo thời gian.
 *   2. `--out json=<f>`        → NDJSON TIME-SERIES: mỗi request một điểm, kèm tags (name/method/status).
 *                                Đây là nguồn DUY NHẤT dựng được biểu đồ theo thời gian và bảng endpoint.
 *   3. web-dashboard HTML      → NDJSON nén gzip+base64 trong thẻ `<script id="data">`. Chỉ có snapshot
 *                                theo chu kỳ (mặc định 1s) + 1 bản cumulative, KHÔNG có tags.
 * Thiếu nguồn 2 thì report phải ghi N/A cho mọi biểu đồ thời gian — CẤM nội suy từ số tổng kết.
 *
 * BẪY ĐÃ ĐO (k6 v2.2.0, 19/10/2026):
 *   - `http_req_failed` là metric Rate với polarity NGƯỢC trực giác: `passes` = số request HỎNG,
 *     `fails` = số request OK. Đọc `fails` ra tỷ lệ lỗi là báo ngược hoàn toàn.
 *   - threshold trong summary: `false` = ĐẠT, `true` = ĐÃ VI PHẠM (bản cũ dùng `{ok:boolean}` ngược lại).
 *   - summary mặc định KHÔNG có `p(99)` — phải chạy kèm `--summary-trend-stats`. Không có thì để N/A,
 *     đừng lấy p(95) thay.
 */

const fs = require('fs');
const zlib = require('zlib');
const readline = require('readline');

/* ───────────────────────── threshold ───────────────────────── */

/**
 * Một threshold đã bị vi phạm chưa. Hai dạng tuỳ bản k6, POLARITY NGƯỢC NHAU:
 *   - bản mới: `true`            → ĐÃ vi phạm
 *   - bản cũ : `{ ok: false }`   → ok=false là vi phạm
 * Đây là logic đã có sẵn trong load_check.js, bê nguyên sang để một chỗ sai thì sai cả hai.
 */
function thresholdBiViPham(v) {
  if (v && typeof v === 'object') {
    if (typeof v.ok === 'boolean') return !v.ok;
    if (typeof v.fails === 'number') return v.fails > 0;
    return false;
  }
  return v === true;
}

/* ───────────────────────── summary-export ───────────────────────── */

const KHOA_TREND = ['min', 'avg', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'];

/**
 * Đọc file `--summary-export`. Trả về `{ coFile, metrics, thresholds, checks }`.
 * `metrics` giữ nguyên tên metric của k6, kể cả sub-metric có tag (`http_req_duration{...}`).
 */
function docSummary(duongDan) {
  if (!duongDan || !fs.existsSync(duongDan)) return { coFile: false, metrics: {}, thresholds: [], checks: null };
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(duongDan, 'utf8'));
  } catch (e) {
    return { coFile: false, loiDoc: e.message, metrics: {}, thresholds: [], checks: null };
  }
  const m = raw.metrics || {};
  const thresholds = [];
  for (const [ten, obj] of Object.entries(m)) {
    if (!obj || !obj.thresholds) continue;
    for (const [bieuThuc, v] of Object.entries(obj.thresholds)) {
      thresholds.push({ metric: ten, threshold: bieuThuc, dat: !thresholdBiViPham(v) });
    }
  }

  /* checks: `passes`/`fails` ở đây đúng nghĩa đen (check đạt / check trượt). */
  const c = m.checks || null;
  const checks = c
    ? { dat: Number(c.passes || 0), truot: Number(c.fails || 0), ty_le: c.value != null ? Number(c.value) : null }
    : null;

  /* Từng check một, từ root_group — để nói được check NÀO trượt chứ không chỉ "có trượt". */
  const chiTietCheck = [];
  (function quet(g, duong) {
    if (!g) return;
    for (const ck of Object.values(g.checks || {})) {
      chiTietCheck.push({ ten: ck.name, duong: duong || '/', dat: Number(ck.passes || 0), truot: Number(ck.fails || 0) });
    }
    for (const [ten, con] of Object.entries(g.groups || {})) quet(con, `${duong}/${ten}`);
  })(raw.root_group, '');

  return { coFile: true, metrics: m, thresholds, checks, chiTietCheck };
}

/** Lấy các mốc trend của một metric trong summary; khoá nào k6 không xuất thì bỏ (→ N/A ở report). */
function trendCuaMetric(summary, ten) {
  const o = (summary.metrics || {})[ten];
  if (!o) return null;
  const ra = {};
  for (const k of KHOA_TREND) if (o[k] != null && Number.isFinite(Number(o[k]))) ra[k] = Number(o[k]);
  return Object.keys(ra).length ? ra : null;
}

/**
 * Số request hỏng + tỷ lệ. CHÚ Ý polarity: với `http_req_failed`, `passes` là số request HỎNG.
 * Trả `null` khi summary không có metric này, để report ghi N/A thay vì bịa số 0.
 */
function soLoi(summary) {
  const o = (summary.metrics || {}).http_req_failed;
  if (!o) return null;
  const hong = Number(o.passes || 0);
  const ok = Number(o.fails || 0);
  const tong = hong + ok;
  return { hong, ok, tong, ty_le: o.value != null ? Number(o.value) : (tong ? hong / tong : 0) };
}

/* ───────────────────────── time-series (--out json) ───────────────────────── */

/**
 * Đọc NDJSON time-series theo DÒNG (file có thể hàng trăm MB — không đọc cả file vào RAM).
 * `chiLay` giới hạn metric cần giữ; không truyền thì giữ hết.
 *
 * Trả `{ coFile, dinhNghia, diem, batDau, ketThuc }` với `diem` là Map<metric, Array<{t, v, tags}>>.
 * `t` là mili-giây epoch (đã chuẩn hoá từ chuỗi RFC3339 của k6).
 */
async function docTimeSeries(duongDan, chiLay = null) {
  const rong = { coFile: false, dinhNghia: {}, diem: new Map(), batDau: null, ketThuc: null, soDiem: 0 };
  if (!duongDan || !fs.existsSync(duongDan)) return rong;

  const loc = chiLay ? new Set(chiLay) : null;
  const dinhNghia = {};
  const diem = new Map();
  let batDau = null;
  let ketThuc = null;
  let soDiem = 0;

  const rl = readline.createInterface({
    input: fs.createReadStream(duongDan, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const dong of rl) {
    if (!dong) continue;
    let o;
    try { o = JSON.parse(dong); } catch (e) { continue; } // dòng cụt ở cuối file khi k6 bị giết
    if (o.type === 'Metric') { dinhNghia[o.metric] = o.data; continue; }
    if (o.type !== 'Point' || !o.data) continue;
    if (loc && !loc.has(o.metric)) continue;
    const t = Date.parse(o.data.time);
    if (!Number.isFinite(t)) continue;
    if (batDau == null || t < batDau) batDau = t;
    if (ketThuc == null || t > ketThuc) ketThuc = t;
    if (!diem.has(o.metric)) diem.set(o.metric, []);
    diem.get(o.metric).push({ t, v: Number(o.data.value), tags: o.data.tags || {} });
    soDiem += 1;
  }
  for (const ds of diem.values()) ds.sort((a, b) => a.t - b.t);
  return { coFile: true, dinhNghia, diem, batDau, ketThuc, soDiem };
}

/* ───────────────────────── tổng hợp ───────────────────────── */

/** Phân vị kiểu k6 (nội suy tuyến tính). `ds` phải là mảng SỐ đã sắp tăng dần. */
function phanVi(ds, p) {
  if (!ds || !ds.length) return null;
  if (ds.length === 1) return ds[0];
  const i = (p / 100) * (ds.length - 1);
  const duoi = Math.floor(i);
  const tren = Math.ceil(i);
  if (duoi === tren) return ds[duoi];
  return ds[duoi] + (ds[tren] - ds[duoi]) * (i - duoi);
}

/**
 * Gom điểm theo cửa sổ thời gian (mặc định 1s) → mảng `{ t, n, tong, tb, min, max }`.
 * `t` là mốc đầu cửa sổ (ms epoch). Dùng cho biểu đồ throughput / error rate / VUs theo thời gian.
 */
function gomTheoCuaSo(ds, buocMs = 1000, goc = null) {
  if (!ds || !ds.length) return [];
  const t0 = goc != null ? goc : ds[0].t;
  const thung = new Map();
  for (const d of ds) {
    const k = Math.floor((d.t - t0) / buocMs);
    let o = thung.get(k);
    if (!o) { o = { t: t0 + k * buocMs, n: 0, tong: 0, min: Infinity, max: -Infinity, gt: [] }; thung.set(k, o); }
    o.n += 1; o.tong += d.v;
    if (d.v < o.min) o.min = d.v;
    if (d.v > o.max) o.max = d.v;
    o.gt.push(d.v);
  }
  return [...thung.values()].sort((a, b) => a.t - b.t).map((o) => ({
    t: o.t, n: o.n, tong: o.tong, tb: o.tong / o.n, min: o.min, max: o.max,
    p95: phanVi(o.gt.slice().sort((a, b) => a - b), 95),
  }));
}

/**
 * Chọn bước gom sao cho biểu đồ không quá ~`moc` cột. Lượt chạy 2 giờ gom theo giây ra 7200 cột,
 * vẽ ra là một vệt đặc không đọc được, mà file HTML thì phình.
 */
function buocGom(batDau, ketThuc, moc = 300) {
  const giay = Math.max(1, Math.round((ketThuc - batDau) / 1000));
  for (const b of [1, 2, 5, 10, 15, 30, 60, 120, 300, 600]) if (giay / b <= moc) return b * 1000;
  return Math.ceil(giay / moc) * 1000;
}

/**
 * Bảng hiệu năng theo endpoint, gom bằng tag `name` (k6 khuyến nghị đặt `tags: { name: ... }` để
 * tránh cardinality bùng nổ vì URL có ID). Không có tag `name` thì lùi về `url`, và report phải NÓI
 * là đang gom theo URL thô.
 *
 * Trả thêm `nguonPhanVi: 'time-series'` — để báo cáo không khẳng định đây là percentile k6 tính sẵn.
 */
function gomTheoEndpoint(ts) {
  const dur = ts.diem.get('http_req_duration') || [];
  const fail = ts.diem.get('http_req_failed') || [];
  if (!dur.length) return { co: false, hang: [], gomTheo: null };

  /*
   * k6 GHI ĐÈ tag `url` bằng `name` khi người viết script đặt `tags: { name: ... }`, nên so
   * `name !== url` luôn ra false và báo cáo khai nhầm là đang gom theo URL thô. Nhận biết đúng:
   * tên nào KHÔNG trông như một URL thì đó là nhãn do người viết đặt.
   */
  const coTenRieng = dur.some((d) => d.tags && d.tags.name && !/^https?:\/\//i.test(d.tags.name));
  /*
   * Không có tag `name` riêng thì lùi về tên `group()` trước khi lùi về URL thô: script viết theo
   * `group('trang đầu')` vẫn cho được bảng đọc hiểu, thay vì 2 dòng cùng một URL dài. Nhãn group của
   * k6 có tiền tố `::`, cắt đi cho gọn.
   */
  const coNhom = !coTenRieng && dur.some((d) => d.tags && d.tags.group);

  /*
   * Tag k6 TỰ gắn — mọi tag khác là do người viết script đặt, và chính chúng mới phân biệt được
   * thao tác này với thao tác kia.
   */
  const TAG_CUA_K6 = new Set(['proto', 'status', 'method', 'url', 'name', 'group', 'scenario',
    'expected_response', 'error', 'error_code', 'tls_version', 'service', 'subproto']);

  /*
   * Request THIẾU tag `name` phải được phân biệt bằng tag RIÊNG của script, không gộp xuống URL thô.
   *
   * Đo 19/10/2026: một lượt chạy có hai kịch bản, kịch bản đầu gắn `name`, kịch bản sau chỉ gắn
   * `buoc`. Báo cáo thấy "có tag name" nên gom theo `name`, rồi 15 request của kịch bản sau rơi hết
   * xuống cùng một dòng URL — trong khi đó là HAI thao tác khác nhau (10 lần bấm `Last Page` và 5 lần
   * bấm `First Page`). Gộp như vậy là trộn hai phân phối thời gian rồi in ra một con số p95 không
   * thuộc về thao tác nào cả.
   */
  const tagRieng = (tg) => Object.keys(tg || {}).filter((k) => !TAG_CUA_K6.has(k) && tg[k])
    .sort().map((k) => `${k}=${tg[k]}`).join(' · ');

  /*
   * k6 LUÔN gắn tag `name`, và khi script không đặt tên thì nó lấy chính URL làm `name`.
   * Vì vậy "có `name`" KHÔNG có nghĩa là "người viết đã đặt tên" — phải loại cái tên mặc định ra,
   * nếu không mọi request không tên đều mang nhãn URL và gộp chung bất kể là thao tác gì.
   */
  const tenDoNguoiDat = (tg) => tg.name && !/^https?:\/\//i.test(tg.name);

  const nhanCua = (tg) => {
    if (tenDoNguoiDat(tg)) return tg.name;
    if (coNhom && tg.group) return String(tg.group).replace(/^:+/, '').replace(/::/g, ' › ');
    const rieng = tagRieng(tg);
    if (rieng) return rieng;
    return tg.name || tg.url || '(không tag)';
  };
  const khoaCua = (d) => {
    const tg = d.tags || {};
    return `${tg.method || '?'} ${nhanCua(tg)}`;
  };

  const bang = new Map();
  for (const d of dur) {
    const k = khoaCua(d);
    let o = bang.get(k);
    if (!o) {
      o = { khoa: k, method: (d.tags || {}).method || '?', ten: nhanCua(d.tags || {}),
        ms: [], status: {}, hong: 0, tong: 0 };
      bang.set(k, o);
    }
    o.ms.push(d.v);
    const st = (d.tags || {}).status || '?';
    o.status[st] = (o.status[st] || 0) + 1;
  }
  /* http_req_failed là Rate: value 1 = request HỎNG. Gom cùng khoá để ra tỷ lệ lỗi từng endpoint. */
  for (const d of fail) {
    const k = khoaCua(d);
    const o = bang.get(k);
    if (!o) continue;
    o.tong += 1;
    if (d.v === 1) o.hong += 1;
  }

  const hang = [...bang.values()].map((o) => {
    const ms = o.ms.slice().sort((a, b) => a - b);
    return {
      ten: o.ten, method: o.method, soRequest: ms.length,
      tb: ms.reduce((s, x) => s + x, 0) / ms.length,
      med: phanVi(ms, 50), p95: phanVi(ms, 95), p99: phanVi(ms, 99), max: ms[ms.length - 1],
      tyLeLoi: o.tong ? o.hong / o.tong : null,
      status: o.status,
    };
  }).sort((a, b) => b.soRequest - a.soRequest);

  /*
   * Nói ĐÚNG cách đã gom. Một lượt chạy có thể trộn nhiều cách đặt tag giữa các kịch bản, nên nhãn
   * "gom theo tag name" là nói quá khi chỉ một phần request có tên do người đặt.
   */
  const coDungTagRieng = hang.some((h) => /^[a-z_]+=/.test(h.ten));
  const gomTheo = [
    coTenRieng ? 'tag `name`' : null,
    coNhom ? 'tên `group()`' : null,
    coDungTagRieng ? 'tag riêng của script (request không được đặt tên)' : null,
  ].filter(Boolean).join(' + ') || 'URL thô';
  return { co: true, hang, gomTheo, nguonPhanVi: 'time-series' };
}

/* ───────────────────────── web-dashboard HTML ───────────────────────── */

/**
 * Bóc NDJSON nhúng trong file export của `--out web-dashboard` (gzip+base64 ở `<script id="data">`).
 * Dùng khi lượt chạy cũ CHỈ còn file dashboard — vẫn hơn là mất trắng số liệu. Lưu ý: dashboard chỉ
 * giữ snapshot theo chu kỳ + 1 bản cumulative và KHÔNG có tags, nên không dựng được bảng endpoint.
 */
function docDashboardHtml(duongDan) {
  if (!duongDan || !fs.existsSync(duongDan)) return { coFile: false, ban: [] };
  const s = fs.readFileSync(duongDan, 'utf8');
  const i = s.indexOf('id="data"');
  if (i < 0) return { coFile: false, ban: [] };
  const a = s.indexOf('>', i) + 1;
  const b = s.indexOf('</script>', a);
  if (a <= 0 || b <= a) return { coFile: false, ban: [] };
  let txt;
  try {
    txt = zlib.gunzipSync(Buffer.from(s.slice(a, b).replace(/\s+/g, ''), 'base64')).toString('utf8');
  } catch (e) {
    return { coFile: false, loiDoc: e.message, ban: [] };
  }
  const ban = txt.split('\n').filter(Boolean).map((d) => { try { return JSON.parse(d); } catch (e) { return null; } }).filter(Boolean);
  return { coFile: true, ban };
}

module.exports = {
  KHOA_TREND,
  buocGom,
  docDashboardHtml,
  docSummary,
  docTimeSeries,
  gomTheoCuaSo,
  gomTheoEndpoint,
  phanVi,
  soLoi,
  thresholdBiViPham,
  trendCuaMetric,
};
