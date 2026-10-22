/*
 * Chống hồi quy cho đường ống báo cáo hiệu năng (k6 → HTML).
 *
 * CHẠY HOÀN TOÀN TRÊN FIXTURE: không gọi k6, không chạm UAT, không tiêu quota Grafana Cloud.
 * Fixture ở `tests/fixtures/k6/` được cắt ra từ một lượt k6 THẬT (v2.2.0) chứ không bịa cấu trúc —
 * định dạng output của k6 là thứ đã cắn nhiều lần, test dựng trên JSON tự nghĩ ra thì không gác được gì.
 *
 * Điều quan trọng nhất ở đây: "chạy xong" KHÔNG phải "hiệu năng đạt". Bốn trạng thái PASS / FAIL /
 * ERROR / KHÔNG_KẾT_LUẬN phải phân biệt được, và không trạng thái nào được âm thầm trôi thành PASS.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/* eslint-disable @typescript-eslint/no-var-requires */
const GOC = path.resolve(__dirname, '..', '..', '..');
const FIXTURE = path.join(GOC, 'tests', 'fixtures', 'k6');
const perf = require(path.join(GOC, 'scripts', 'qa', 'perf_report.js'));
const cloud = require(path.join(GOC, 'scripts', 'lib', 'k6', 'cloud.js'));
const artifacts = require(path.join(GOC, 'scripts', 'lib', 'k6', 'artifacts.js'));

async function dung(tenFixture: string) {
  const du = await perf.thuThap(path.join(FIXTURE, tenFixture));
  return { du, html: perf.dungHtml(du), trangThai: perf.trangThaiTongThe(du), kpi: perf.tinhKpi(du) };
}

test.describe('perf_report — trạng thái tổng thể', () => {
  test('lượt chạy được và mọi threshold đạt → PASS, và có file HTML', async () => {
    const { trangThai, html } = await dung('run-pass');
    expect(trangThai.ma).toBe('PASS');
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('B · Chỉ số tổng quan');
  });

  test('threshold bị vi phạm → FAIL, không được trôi thành PASS', async () => {
    const { trangThai, html } = await dung('run-fail');
    expect(trangThai.ma).toBe('FAIL');
    expect(html).toContain('>FAIL<');
  });

  test('k6 chết trước khi sinh summary → ERROR, và nói rõ đây không phải "đạt"', async () => {
    const { trangThai, html } = await dung('run-loi');
    expect(trangThai.ma).toBe('ERROR');
    expect(trangThai.vi).toMatch(/không có số liệu/i);
    expect(html).not.toContain('>PASS<');
  });

  test('chạy xong nhưng không khai threshold → KHÔNG KẾT LUẬN, kèm câu "chưa đủ cơ sở"', async () => {
    const { trangThai, html } = await dung('run-khong-threshold');
    expect(trangThai.ma).toBe('KHONG_KET_LUAN');
    expect(html).toContain('chưa đủ cơ sở để xác nhận hệ thống đạt yêu cầu hiệu năng');
  });

  test('thiếu metric tuỳ chọn thì không sập, chỉ ghi N/A', async () => {
    const { html, kpi } = await dung('run-thieu-metric');
    expect(html).toContain('N/A');
    expect(kpi.tyLeLoi).toBeNull();   // không có http_req_failed → N/A, KHÔNG phải 0
    expect(kpi.vusMax).toBeNull();
  });
});

test.describe('perf_report — biểu đồ dùng đúng dữ liệu và đơn vị', () => {
  test('không có time-series → bốn biểu đồ thời gian để N/A, KHÔNG bịa đường từ số trung bình', async () => {
    const { html, du } = await dung('run-khong-timeseries');
    expect(du.ts.coFile).toBe(false);
    for (const ten of ['1 · Request Throughput', '3 · Error Rate', '4 · Virtual Users', '6 · Iteration Duration']) {
      const i = html.indexOf(ten);
      expect(i, `phải có khung "${ten}"`).toBeGreaterThan(0);
      /* Khung N/A mở bằng class `bd bd-rong` ngay trước figcaption */
      expect(html.slice(Math.max(0, i - 120), i)).toContain('bd-rong');
    }
    /* Percentile tổng kết thì VẪN vẽ được — đó là số liệu tổng, không phải time-series giả */
    const j = html.indexOf('2 · Response Time Percentiles');
    expect(html.slice(Math.max(0, j - 120), j)).not.toContain('bd-rong');
  });

  test('có time-series → biểu đồ có đường, có nhãn đơn vị và có mốc thời gian', async () => {
    const { html } = await dung('run-pass');
    const i = html.indexOf('1 · Request Throughput');
    const khung = html.slice(i, i + 6000);
    expect(khung).toContain('<path');          // có đường thật
    expect(khung).toContain('req/s');          // có đơn vị
    expect(khung).toMatch(/\d{2}:\d{2}:\d{2}/); // có nhãn thời gian trên trục hoành
  });

  test('executor không sinh dropped_iterations thì KHÔNG vẽ đường 0 giả', async () => {
    const { html } = await dung('run-pass');
    const i = html.indexOf('5 · Dropped Iterations');
    expect(html.slice(Math.max(0, i - 120), i)).toContain('bd-rong');
    expect(html.slice(i, i + 600)).toMatch(/không vẽ đường 0/i);
  });

  test('bảng endpoint nói rõ percentile là tự tính lại, không nhận vơ là của k6', async () => {
    const { html } = await dung('run-pass');
    expect(html).toContain('E · Hiệu năng theo endpoint');
    expect(html).toContain('tính lại từ time-series');
    expect(html).toContain('percentile k6 xuất sẵn');
  });
});

test.describe('perf_report — threshold và metric đọc đúng', () => {
  test('polarity threshold của k6: false = đạt, true = vi phạm; bản cũ dùng {ok}', () => {
    expect(artifacts.thresholdBiViPham(false)).toBe(false);
    expect(artifacts.thresholdBiViPham(true)).toBe(true);
    expect(artifacts.thresholdBiViPham({ ok: true })).toBe(false);
    expect(artifacts.thresholdBiViPham({ ok: false })).toBe(true);
  });

  test('http_req_failed: `passes` là số request HỎNG, không phải số request OK', async () => {
    const s = artifacts.docSummary(path.join(FIXTURE, 'run-fail', 'k6-summary.json'));
    const loi = artifacts.soLoi(s);
    expect(loi.hong).toBe(s.metrics.http_req_failed.passes);
    expect(loi.ty_le).toBeCloseTo(s.metrics.http_req_failed.value, 6);
  });

  test('bảng threshold hiện GIÁ TRỊ THỰC bên cạnh ngưỡng', async () => {
    const { html } = await dung('run-fail');
    const i = html.indexOf('F · Đánh giá Threshold');
    expect(html.slice(i, i + 3000)).toContain('Giá trị thực');
    expect(html.slice(i, i + 3000)).toMatch(/VI PHẠM/);
  });

  test('tách biểu thức threshold ra khoá/phép/mốc', () => {
    expect(perf.tachThreshold('p(95)<500')).toEqual({ khoa: 'p(95)', phep: '<', moc: 500 });
    expect(perf.tachThreshold('rate<0.01')).toEqual({ khoa: 'rate', phep: '<', moc: 0.01 });
    expect(perf.tachThreshold('không phải biểu thức')).toBeNull();
  });

  test('throughput trung bình và cực đại là hai số khác nhau, không thay nhau', async () => {
    const { kpi } = await dung('run-pass');
    expect(kpi.rpsTb).toBeGreaterThan(0);
    expect(kpi.rpsDinh).toBeGreaterThan(0);
    expect(kpi.rpsDinh).not.toBe(kpi.rpsTb);
  });
});

test.describe('Grafana Cloud — tuỳ chọn, không bao giờ làm mất kết quả local', () => {
  test('không bật cloud → DISABLED, và báo cáo vẫn dựng bình thường', async () => {
    const tt = await cloud.trangThaiCloud({ bat: false, output: '' });
    expect(tt.trangThai).toBe('DISABLED');
    const { html, trangThai } = await dung('run-pass');
    expect(trangThai.ma).toBe('PASS');
    expect(html).toContain('DISABLED');
  });

  test('bật cloud nhưng thiếu token → NOT_AVAILABLE, KHÔNG phải FAILED, và local vẫn giữ', async () => {
    const cu = process.env.K6_CLOUD_TOKEN;
    delete process.env.K6_CLOUD_TOKEN;
    try {
      const tt = await cloud.trangThaiCloud({ bat: true, output: '' });
      expect(tt.trangThai).toBe('NOT_AVAILABLE');
      expect(tt.url).toBeNull();
      expect(tt.ghiChu).toMatch(/local vẫn giữ nguyên/i);
    } finally {
      if (cu !== undefined) process.env.K6_CLOUD_TOKEN = cu;
    }
  });

  test('chỉ URL k6 tự in ra mới được nhận; không dựng URL từ ID đoán', () => {
    expect(cloud.bocUrlRun('output: Grafana Cloud k6 (https://abc.grafana.net/a/k6-app/runs/4812345)'))
      .toBe('https://abc.grafana.net/a/k6-app/runs/4812345');
    expect(cloud.bocUrlRun('running (10.2s), 0/6 VUs, 87 complete')).toBeNull();
    expect(cloud.bocUrlRun('xem ở https://abc.grafana.net/a/k6-app/projects/99')).toBeNull();
  });

  test('upload hỏng → trạng thái FAILED, không có link, nhưng báo cáo local vẫn ra', async () => {
    const cu = process.env.K6_CLOUD_TOKEN;
    process.env.K6_CLOUD_TOKEN = 'token-gia-cho-test-khong-goi-mang';
    try {
      const tt = await cloud.trangThaiCloud({ bat: true, output: 'level=error msg="cloud upload failed"' });
      expect(tt.trangThai).toBe('FAILED');
      expect(tt.url).toBeNull();
    } finally {
      if (cu === undefined) delete process.env.K6_CLOUD_TOKEN; else process.env.K6_CLOUD_TOKEN = cu;
    }
  });

  test('URL chưa xác minh KHÔNG được gắn vào báo cáo dưới dạng link', async () => {
    const tam = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-cloud-'));
    try {
      fs.copyFileSync(path.join(FIXTURE, 'run-pass', 'k6-summary.json'), path.join(tam, 'k6-summary.json'));
      fs.writeFileSync(path.join(tam, 'run-meta.json'), JSON.stringify({
        runId: 'x', cloud: { trangThai: 'FAILED', url: null, urlChuaXacMinh: 'https://gia.example/a/k6-app/runs/1', ghiChu: 'xác minh không đạt' },
      }), 'utf8');
      const du = await perf.thuThap(tam);
      const html = perf.dungHtml(du);
      expect(html).not.toContain('href="https://gia.example');
      expect(html).toContain('FAILED');
    } finally {
      fs.rmSync(tam, { recursive: true, force: true });
    }
  });
});

test.describe('secret không được lọt ra artifact', () => {
  test('khuSecret thay giá trị token bằng nhãn, không để lộ chuỗi gốc', () => {
    const cu = process.env.K6_CLOUD_TOKEN;
    process.env.K6_CLOUD_TOKEN = 'sieu-bi-mat-1234567890';
    try {
      const ra = cloud.khuSecret('chạy với token sieu-bi-mat-1234567890 ok');
      expect(ra).not.toContain('sieu-bi-mat-1234567890');
      expect(ra).toContain('K6_CLOUD_TOKEN');
    } finally {
      if (cu === undefined) delete process.env.K6_CLOUD_TOKEN; else process.env.K6_CLOUD_TOKEN = cu;
    }
  });

  test('khuSecret bắt cả dạng `token=...` dù giá trị không khớp biến môi trường', () => {
    expect(cloud.khuSecret('Authorization: Bearer abcdef1234567890')).not.toContain('abcdef1234567890');
    expect(cloud.khuSecret('api_key=zzzzzzzzzzzz')).not.toContain('zzzzzzzzzzzz');
  });

  test('load_check ghi log ra đĩa thì phải đi qua khuSecret', () => {
    const src = fs.readFileSync(path.join(GOC, 'scripts', 'qa', 'load_check.js'), 'utf8');
    expect(src).toMatch(/writeFileSync\(logPath,\s*khuSecret\(/);
  });

  test('báo cáo HTML của fixture không chứa chuỗi nào trông như token', async () => {
    const { html } = await dung('run-fail');
    expect(html).not.toMatch(/(K6_CLOUD_TOKEN|BACKLOG_API_KEY)\s*[:=]\s*[\w-]{8,}/);
  });
});

test.describe('không phá chức năng cũ của load_check', () => {
  const src = () => fs.readFileSync(path.join(GOC, 'scripts', 'qa', 'load_check.js'), 'utf8');

  test('vẫn từ chối chạy khi thiếu --confirm-nonprod và vẫn chặn prod', () => {
    const s = src();
    expect(s).toContain('--confirm-nonprod');
    expect(s).toMatch(/TỪ CHỐI: target trông giống PRODUCTION/);
  });

  test('vẫn nhường profile cho script khi script khai stages/scenarios', () => {
    const s = src();
    expect(s).toContain('USE_SCRIPT_PROFILE');
    expect(s).toMatch(/const loadArgs = USE_SCRIPT_PROFILE \? \[\]/);
  });

  test('vẫn ghi load-report.md và load-report.json ở chỗ cũ', () => {
    const s = src();
    expect(s).toContain("path.join(OUT, 'load-report.json')");
    expect(s).toContain("path.join(OUT, 'load-report.md')");
  });

  test('vẫn giữ baseline jsonl và vẫn có --enforce', () => {
    const s = src();
    expect(s).toContain('perf-baselines.jsonl');
    expect(s).toMatch(/ENFORCE && failed\.length/);
  });

  test('mỗi lượt chạy có thư mục riêng theo Run ID, không ghi đè lượt trước', () => {
    const s = src();
    expect(s).toMatch(/const RUN_DIR = path\.join\(OUT, 'performance', RUN_ID\)/);
  });

  test('vẫn xin đủ output k6 cần cho báo cáo', () => {
    const s = src();
    expect(s).toContain('--summary-export');
    expect(s).toContain('--summary-trend-stats');
    expect(s).toMatch(/'--out', `json=\$\{tsPath\}`/);
  });
});
