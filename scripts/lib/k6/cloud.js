'use strict';

/*
 * Grafana Cloud k6 — streaming kết quả và lấy link run THẬT.
 *
 * NGUYÊN TẮC (đi ngược là hỏng cả báo cáo):
 *   - Cloud là TUỲ CHỌN. Upload hỏng thì lượt chạy local vẫn giữ nguyên kết quả và vẫn ra báo cáo.
 *   - URL run CHỈ lấy từ dòng k6 CLI tự in ra. KHÔNG ghép từ stack id + một con số đoán được: một URL
 *     bịa trông y hệt URL thật và người đọc không có cách nào biết.
 *   - URL phải XÁC MINH được (gọi thật, nhận mã trạng thái không phải 404/5xx) mới được đưa vào báo cáo.
 *   - Token KHÔNG bao giờ đi vào log, báo cáo, exception hay URL. `khuSecret()` phải chạy trên MỌI
 *     chuỗi trước khi ghi ra đĩa.
 *
 * Trạng thái báo cáo: SUCCESS · FAILED · DISABLED (người chạy không bật) · NOT_AVAILABLE (bật nhưng
 * thiếu token / k6 không hỗ trợ). Bốn trạng thái này khác nhau, gộp lại là che mất lý do.
 */

const https = require('https');

const TEN_KHOA_BI_MAT = ['K6_CLOUD_TOKEN', 'BACKLOG_API_KEY', 'BACKLOG_PAT', 'FIGMA_API_KEY',
  'OPS_PASSWORD', 'OPS_SO_PASSWORD', 'OPS_PHUONGXA_PASSWORD', 'LIB_MASTER_DB_RO_PASSWORD'];

/**
 * Xoá mọi giá trị bí mật khỏi một chuỗi trước khi ghi ra đĩa.
 * Lọc theo GIÁ TRỊ thật trong môi trường (không theo mẫu regex đoán), vì chuỗi token của Grafana
 * không có tiền tố cố định nào để bắt bằng mẫu. Bỏ qua giá trị quá ngắn để không thay nhầm chữ thường.
 */
function khuSecret(s) {
  let ra = String(s == null ? '' : s);
  for (const k of TEN_KHOA_BI_MAT) {
    const v = process.env[k];
    if (v && v.length >= 8) ra = ra.split(v).join(`‹${k} đã ẩn›`);
  }
  /*
   * Token lọt qua dạng header/tham số dù giá trị không khớp env (vd k6 in lại dạng rút gọn).
   * `Bearer`/`Basic` phải nằm NGOÀI phần bị thay: bản đầu bỏ sót nên `Authorization: Bearer <token>`
   * đi thẳng ra log nguyên vẹn — regex khớp tới chữ `Bearer` rồi dừng, token ở sau không ai đụng tới.
   */
  ra = ra.replace(/(token|api[_-]?key|authorization)(\s*[:=]\s*)(["']?)(?:(Bearer|Basic|Token)\s+)?[\w.-]{8,}\3/gi,
    (_m, a, b, nhay, loai) => `${a}${b}${nhay}${loai ? `${loai} ` : ''}‹đã ẩn›${nhay}`);
  return ra;
}

/** Có cấu hình token cloud hay chưa. KHÔNG trả về giá trị token. */
function coToken() {
  return Boolean(process.env.K6_CLOUD_TOKEN && String(process.env.K6_CLOUD_TOKEN).trim());
}

/**
 * Lấy URL run từ output của k6 CLI. k6 in dòng kiểu:
 *   output: Grafana Cloud k6 (https://<stack>.grafana.net/a/k6-app/runs/1234567)
 * Chỉ nhận URL https trỏ tới một run có ID SỐ — nhận bừa thì ta đang tự dựng URL, đúng thứ bị cấm.
 */
function bocUrlRun(output) {
  const s = String(output || '');
  const m = s.match(/https:\/\/[^\s)'"]*\/(?:a\/k6-app\/)?runs?\/\d+[^\s)'"]*/i)
    || s.match(/https:\/\/[^\s)'"]*k6[^\s)'"]*\/runs\/\d+/i);
  return m ? m[0].replace(/[.,]$/, '') : null;
}

/**
 * Gọi thật URL để xác minh. Trả `{ xacMinh, maTrangThai, lyDo }`.
 * 2xx/3xx/401/403 đều coi là URL CÓ THẬT (401/403 chỉ nghĩa là phải đăng nhập mới xem được — đúng
 * như kỳ vọng với link Grafana Cloud). 404 hoặc lỗi mạng thì KHÔNG đưa vào báo cáo.
 */
function xacMinhUrl(url, timeoutMs = 10000) {
  return new Promise((giai) => {
    let xong = false;
    const chot = (o) => { if (!xong) { xong = true; giai(o); } };
    try {
      const req = https.request(url, { method: 'GET', timeout: timeoutMs }, (res) => {
        res.resume();
        const ma = res.statusCode;
        const ok = (ma >= 200 && ma < 400) || ma === 401 || ma === 403;
        chot({ xacMinh: ok, maTrangThai: ma, lyDo: ok ? null : `máy chủ trả ${ma}` });
      });
      req.on('timeout', () => { req.destroy(); chot({ xacMinh: false, maTrangThai: null, lyDo: `quá ${timeoutMs} ms không trả lời` }); });
      req.on('error', (e) => chot({ xacMinh: false, maTrangThai: null, lyDo: khuSecret(e.message) }));
      req.end();
    } catch (e) {
      chot({ xacMinh: false, maTrangThai: null, lyDo: khuSecret(e.message) });
    }
  });
}

/**
 * Dựng khối trạng thái cloud cho báo cáo từ output k6 đã chạy.
 * `bat` = người chạy có yêu cầu cloud không. Không bật → DISABLED, và đó KHÔNG phải lỗi.
 */
async function trangThaiCloud({ bat, output, loiChay }) {
  if (!bat) return { trangThai: 'DISABLED', url: null, ghiChu: 'không bật --cloud cho lượt này' };
  if (!coToken()) {
    return { trangThai: 'NOT_AVAILABLE', url: null,
      ghiChu: 'bật --cloud nhưng chưa có K6_CLOUD_TOKEN trong cấu hình — kết quả local vẫn giữ nguyên' };
  }
  const url = bocUrlRun(output);
  if (!url) {
    return { trangThai: 'FAILED', url: null,
      ghiChu: khuSecret(loiChay || 'k6 không in ra URL run nào — không dựng URL từ ID đoán, nên báo cáo không có link cloud') };
  }
  const kt = await xacMinhUrl(url);
  if (!kt.xacMinh) {
    return { trangThai: 'FAILED', url: null, urlChuaXacMinh: url,
      ghiChu: `k6 có in URL nhưng xác minh KHÔNG đạt (${kt.lyDo}) — không đưa link chưa xác minh vào báo cáo` };
  }
  return { trangThai: 'SUCCESS', url, maTrangThai: kt.maTrangThai, ghiChu: 'URL lấy từ output k6 và đã gọi thật để xác minh' };
}

module.exports = { TEN_KHOA_BI_MAT, bocUrlRun, coToken, khuSecret, trangThaiCloud, xacMinhUrl };
