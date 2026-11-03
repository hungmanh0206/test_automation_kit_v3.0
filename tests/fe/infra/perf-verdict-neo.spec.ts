/*
 * `perf_report.trangThaiTongThe` — MỘT VERDICT KHAI BẰNG TAY ĐƯỢC ĐÈ LÊN MỘT PHÉP ĐO.
 *
 * Bản vá 30/10/2026 cho `perf_report.js` thêm `docVerdictCase()`: nếu `so-case.json` khai `trangThai`
 * cho đúng tcId của lượt chạy, verdict đó **thắng** headline, còn số liệu k6 ở phần F giữ nguyên làm
 * chứng cứ kỹ thuật. Lý do chính đáng: ngưỡng k6 đúng-sai KHÔNG phải SLA, nên trang mục lục ghi FAIL mà
 * báo cáo chi tiết lại nói "KHÔNG KẾT LUẬN" — chính mâu thuẫn đó làm người đọc mất tin vào cả báo cáo.
 *
 * NHƯNG ĐÂY LÀ LỚP CẦN GÁC NHẤT trong cả file: một con số khai bằng tay được quyền đè một con số đo
 * được. Nếu nó đè mà KHÔNG nói ra, báo cáo thành "PASS" trong khi k6 cho thấy ngưỡng vỡ, và người đọc
 * không có cách nào biết verdict ấy không đến từ phép đo.
 *
 * BỘ KIỂM HIỆN CÓ MÙ VỚI NHÁNH NÀY — đo 03/11/2026, và đây là lý do spec này tồn tại:
 * `tests/fe/infra/perf-report.spec.ts` có gọi `trangThaiTongThe(du)`, nhưng mọi fixture dưới
 * `tests/fixtures/k6/**` đều KHÔNG có `run-meta.json`. Nên `du.meta.tenBaiTest` rỗng, `docVerdictCase`
 * trả `null`, và nhánh đè chưa bao giờ được chạy. Bộ kiểm cũ xanh vì nó không chạm tới, không vì nó đúng.
 *
 * SÁU TÍNH CHẤT ĐƯỢC GÁC:
 *   ① verdict khai trong `so-case.json` thắng headline;
 *   ② và báo cáo PHẢI NÓI RA nguồn verdict — không nói ra thì nó là một lời khai đội lốt phép đo;
 *   ③ số liệu k6 KHÔNG bị xoá khi bị đè — chứng cứ kỹ thuật vẫn phải còn trong HTML;
 *   ④ `trangThai` lạ ⇒ KHÔNG đè, lùi về verdict theo k6; tuyệt đối không âm thầm thành PASS;
 *   ⑤ `so-case.json` vỡ JSON ⇒ không ném, lùi về k6;
 *   ⑥ không khớp tcId ⇒ không đè, và không lấy nhầm verdict của case khác.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..', '..', '..');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'k6');
/* eslint-disable-next-line @typescript-eslint/no-var-requires, global-require */
const perf = require(path.join(REPO, 'scripts', 'qa', 'perf_report.js'));

const TC = 'PERF_TC_007';

/**
 * Chép một lượt fixture sang thư mục tạm, thêm `run-meta.json` mang tcId, và tuỳ chọn ghi
 * `so-case.json` ở thư mục CHA — đúng chỗ `docVerdictCase` đi tìm (`path.dirname(du.runDir)`).
 *
 * `soCase === null` ⇒ không tạo file; chuỗi ⇒ ghi nguyên văn (để thử JSON vỡ).
 */
function cay(tenFixture: string, soCase: unknown | string | null, tenBaiTest = `${TC} — đo p95`) {
  const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'perfverdict-'));
  const runDir = path.join(goc, 'run-01');
  fs.mkdirSync(runDir, { recursive: true });
  for (const f of fs.readdirSync(path.join(FIXTURE, tenFixture))) {
    fs.copyFileSync(path.join(FIXTURE, tenFixture, f), path.join(runDir, f));
  }
  fs.writeFileSync(path.join(runDir, perf.TEN_TEP.meta), JSON.stringify({ tenBaiTest }), 'utf8');
  if (soCase !== null) {
    const noi = typeof soCase === 'string' ? soCase : JSON.stringify(soCase, null, 2);
    fs.writeFileSync(path.join(goc, 'so-case.json'), noi, 'utf8');
  }
  return { goc, runDir };
}

async function doc(tenFixture: string, soCase: unknown | string | null, tenBaiTest?: string) {
  const { goc, runDir } = cay(tenFixture, soCase, tenBaiTest);
  const du = await perf.thuThap(runDir);
  const ra = { trangThai: perf.trangThaiTongThe(du), html: perf.dungHtml(du) };
  try { fs.rmSync(goc, { recursive: true, force: true }); } catch (e) { /* dọn là tiện ích */ }
  return ra;
}

test.describe.configure({ mode: 'default' });

test.describe('@infra perf_report — verdict case đè k6 thì PHẢI nói ra', () => {
  test('ĐỐI CHỨNG ÂM: không `so-case.json` ⇒ verdict theo k6, và KHÔNG có dòng nguồn', async () => {
    const r = await doc('run-pass', null);
    expect(r.trangThai.ma, 'lượt k6 đạt mọi threshold').toBe('PASS');
    expect(r.trangThai.nguon, 'không ai khai verdict thì không được bày ra dòng "Nguồn verdict"')
      .toBeUndefined();
    expect(r.html).not.toContain('Nguồn verdict');
  });

  test('ĐỐI CHỨNG DƯƠNG: khai FAIL trên lượt k6 PASS ⇒ headline FAIL', async () => {
    const r = await doc('run-pass', { [TC]: { trangThai: 'FAIL', lyDo: 'vượt SLA 3s của nghiệp vụ' } });
    expect(r.trangThai.ma, 'verdict case phải thắng — ngưỡng k6 không phải SLA').toBe('FAIL');
    expect(r.trangThai.vi).toContain('vượt SLA 3s');
  });

  /*
   * CA QUAN TRỌNG NHẤT. Đè mà không nói ra thì báo cáo thành một lời khai đội lốt phép đo: người đọc
   * thấy "PASS" cạnh một bảng số k6 và tưởng chữ PASS ấy do số liệu sinh ra.
   */
  test('đè thì báo cáo PHẢI in nguồn verdict, nêu rõ nó neo theo ô "Kết quả mong đợi"', async () => {
    const r = await doc('run-fail', { [TC]: { trangThai: 'PASS', lyDo: 'ngưỡng k6 đặt chặt hơn SLA' } });
    expect(r.trangThai.ma, 'khai PASS thì headline PASS').toBe('PASS');
    expect(r.trangThai.nguon, 'thiếu dòng này là chỗ một lời khai hoá trang thành phép đo')
      .toContain('so-case.json');
    expect(r.html, 'và nó phải hiện TRONG báo cáo, không chỉ có trong đối tượng trả về')
      .toContain('Nguồn verdict');
  });

  test('số liệu k6 KHÔNG bị xoá khi bị đè — chứng cứ kỹ thuật vẫn phải còn', async () => {
    const khongDe = await doc('run-fail', null);
    const biDe = await doc('run-fail', { [TC]: { trangThai: 'PASS', lyDo: 'x' } });
    expect(khongDe.trangThai.ma, 'lượt này k6 có threshold vỡ').toBe('FAIL');
    expect(biDe.trangThai.ma).toBe('PASS');
    /* Mốc: báo cáo bị đè phải dài xấp xỉ bản không đè — đè headline, không cắt phần số liệu. */
    expect(biDe.html.length, 'ngắn hơn nhiều nghĩa là phần chứng cứ k6 đã bị cắt theo')
      .toBeGreaterThan(Math.floor(khongDe.html.length * 0.9));
    expect(biDe.html, 'phần ngưỡng k6 phải còn nguyên để đối chiếu được').toContain('http_req_duration');
  });
});

test.describe('@infra perf_report — khai sai thì KHÔNG được đè', () => {
  test('`trangThai` lạ ⇒ lùi về verdict theo k6, tuyệt đối không thành PASS', async () => {
    const r = await doc('run-fail', { [TC]: { trangThai: 'CHAC_LA_DAT', lyDo: 'x' } });
    expect(r.trangThai.ma, 'một chuỗi không khai trước không được quyền đè phép đo').toBe('FAIL');
    expect(r.trangThai.nguon, 'không đè thì không được in dòng nguồn').toBeUndefined();
  });

  test('`so-case.json` VỠ JSON ⇒ không ném, lùi về k6', async () => {
    const r = await doc('run-pass', '{ day khong phai json hop le ');
    expect(r.trangThai.ma, 'sổ vỡ thì báo cáo vẫn phải dựng được, chỉ là không đè').toBe('PASS');
    expect(r.trangThai.nguon).toBeUndefined();
  });

  test('KHÔNG khớp tcId ⇒ không lấy nhầm verdict của case khác', async () => {
    const r = await doc('run-fail', { PERF_TC_999: { trangThai: 'PASS', lyDo: 'case khác' } });
    expect(r.trangThai.ma, 'lấy verdict của case khác là gán kết quả sai cho một phép đo').toBe('FAIL');
    expect(r.trangThai.nguon).toBeUndefined();
  });

  test('`tenBaiTest` không mang tcId ⇒ không đè', async () => {
    const r = await doc('run-fail', { [TC]: { trangThai: 'PASS', lyDo: 'x' } }, 'đo thử không có mã case');
    expect(r.trangThai.ma, 'không biết lượt này là case nào thì không được nhận verdict của ai cả')
      .toBe('FAIL');
  });
});
