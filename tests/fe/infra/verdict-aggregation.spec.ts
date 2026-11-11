/**
 * GỘP VERDICT — PASS chính thức KHÔNG được đứng trên một step xấu.
 *
 * BỐI CẢNH. Chủ dự án nêu, ưu tiên #1: *"Không được ghi PASS chính thức khi step bắt buộc FAILED hoặc
 * BLOCKED, trừ khi có thông tin hợp lệ chứng minh đã phục hồi và xác minh lại."*
 *
 * LỖ HỔNG ĐÃ MỞ TỚI 11/11/2026, và nó nằm ở MỘT DÒNG:
 *
 *   const anyFail = this.steps.some((s) => laFail(s.status));
 *   const status  = overallStatus || (anyFail ? 'FAILED' : (steps.length ? 'PASSED' : 'TODO'));
 *
 * `laFail()` chuẩn hoá qua taxonomy và chỉ nhận `FAIL`. `BLOCKED` chuẩn hoá thành `BLOCKED_SETUP` —
 * taxonomy xếp nó vào "chưa thực thi", nên nó KHÔNG phải fail. Case có step BLOCKED mà người gọi
 * không tự khai verdict rơi thẳng vào nhánh `'PASSED'`.
 *
 * ĐO TRƯỚC KHI SỬA: CSDL-4008 ra **0/284** ca dính — nhưng chỉ vì mọi spec ở đó đều khai verdict tay.
 * Dữ liệu sạch KHÔNG chứng minh lỗ đã bịt; nó chỉ chứng minh chưa ai đi qua lỗ. Mấy ca dưới đây đi
 * qua lỗ đó một cách cố ý.
 *
 * HAI TẦNG, vì chúng hỏng khác nhau: đường GHI (`evidence_recorder.finish`) và cửa ĐỌC SỔ
 * (`output_gate.gateTestExecution`). Bản ghi merge tay hoặc chép từ archive không đi qua recorder.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { EvidenceRecorder } = require(path.join(REPO, 'scripts/utils/evidence_recorder'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const og = require(path.join(REPO, 'scripts/qa/output_gate.js'));

const TRANG = 'data:text/html,<html><body><h1>gop verdict</h1></body></html>';

/* `xacMinh: true` ⇒ ghi qua `xacMinhLai()`; `ok` là kết quả assert của nó, `status` (nếu có) là lời tự khai mà hàm phải BỎ QUA. */
type Buoc = { ten: string; status?: string; xacMinh?: boolean; ok?: boolean };

/** Một lượt chạy thật qua recorder, trả về bản ghi đã vào sổ. */
async function ghi(page: any, buoc: Buoc[], khai?: string, opts: Record<string, unknown> = {}) {
  const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'gopverdict-'));
  const rec = new EvidenceRecorder({ taskKey: 'T-GOP', projectOutputDir: 'out', repoRoot: goc, log: false });
  const tc = rec.case('TC_GOP');
  for (const b of buoc) {
    if (b.xacMinh) await tc.xacMinhLai(page, b.ten, { assert: () => b.ok !== false, ...(b.status ? { status: b.status } : {}) });
    else await tc.step(page, b.ten, { status: b.status, comment: `đo ${b.ten}` });
  }
  await tc.finish(khai, opts);
  await rec.write();
  const p = path.join(goc, 'out/tasks/T-GOP/test-results/testcase-status.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  fs.rmSync(goc, { recursive: true, force: true });
  return (j.tests || j)[0];
}

const SACH: Buoc[] = [{ ten: 'mở màn', status: 'PASSED' }, { ten: 'đọc lưới', status: 'PASSED' }];
const CO_CHAN: Buoc[] = [{ ten: 'mở màn', status: 'PASSED' }, { ten: 'dựng tiền đề', status: 'BLOCKED' }];
const CO_FAIL: Buoc[] = [{ ten: 'mở màn', status: 'PASSED' }, { ten: 'so số', status: 'FAILED' }];
const DA_SUA: Buoc[] = [...CO_CHAN, { ten: 'tiền đề đã có sau khi dựng lại', xacMinh: true }];
const LOI = { phucHoi: 'dựng lại tiền đề qua UI rồi chạy lại bước 2, lần này đạt' };

test.describe('@infra gộp verdict — đường GHI (EvidenceRecorder.finish)', () => {
  test('ĐỐI CHỨNG ÂM: mọi step sạch, không khai verdict ⇒ PASSED như cũ', async ({ page }) => {
    await page.goto(TRANG);
    const e = await ghi(page, SACH);
    expect(e.status, 'không được làm đỏ ca vốn đúng').toBe('PASSED');
  });

  test('ĐỐI CHỨNG DƯƠNG — ĐÂY LÀ LỖ: step BLOCKED, không khai verdict ⇒ KHÔNG còn là PASSED', async ({ page }) => {
    /*
     * Trước 11/11/2026 ca này ra `PASSED`, vì `laFail()` không nhận `BLOCKED`. Đó là toàn bộ lỗ hổng,
     * và nó là lý do ưu tiên #1 tồn tại.
     */
    await page.goto(TRANG);
    const e = await ghi(page, CO_CHAN);
    expect(e.status, 'case có bước CHƯA CHẠY ĐƯỢC mà vào sổ là PASSED').not.toMatch(/^PASS/i);
    expect(e.status).toBe('BLOCKED_SETUP');
    expect(e.comment, 'phải nói rõ đã HẠ verdict và vì sao').toMatch(/GỘP VERDICT: HẠ/);
    expect(e.comment, 'và nêu đích danh bước xấu').toMatch(/dựng tiền đề=BLOCKED/);
  });

  test('KHAI THẲNG `finish("PASSED")` trong khi còn step xấu ⇒ vẫn bị HẠ', async ({ page }) => {
    /*
     * Đường thứ hai, hỏng khác đường trên: người gọi tự khai PASSED. Trước đây recorder im lặng chấp
     * nhận lời khai đó. Bịt một đường mà bỏ đường kia thì luật chỉ đúng với người quên khai.
     */
    await page.goto(TRANG);
    const e = await ghi(page, CO_CHAN, 'PASSED');
    expect(e.status).toBe('BLOCKED_SETUP');
    expect(e.comment).toMatch(/HẠ từ "PASSED"/);
  });

  test('step FAILED + khai PASS + KHÔNG khai tầng lỗi ⇒ NÉM, không tự gán tầng', async ({ page }) => {
    /*
     * Hai luật gặp nhau: luật mới cấm PASS khi còn step xấu, luật cũ đòi FAIL phải khai failureLayer.
     * Không được tự gán tầng thay tác giả — taxonomy CỐ Ý không có tầng "chưa phân tầng", nên mọi
     * giá trị điền hộ đều là một khẳng định về NGUYÊN NHÂN mà không ai đo.
     *
     * Vì sao chỗ này NÉM còn chỗ BLOCKED thì không: step FAILED + khai PASS là mâu thuẫn trong chính
     * spec, phải lộ ra ngay chỗ viết sai. BLOCKED là chuyện có thật lúc chạy nên nó vào sổ.
     */
    await page.goto(TRANG);
    await expect(ghi(page, CO_FAIL, 'PASSED')).rejects.toThrow(/khai PASS trong khi step/);
  });

  test('step FAILED + khai PASS + CÓ khai tầng lỗi ⇒ hạ xuống FAILED', async ({ page }) => {
    await page.goto(TRANG);
    const e = await ghi(page, CO_FAIL, 'PASSED', { failureLayer: 'script_error' });
    expect(e.status).toBe('FAILED');
    expect(e.failureLayer).toBe('script_error');
  });

  test('ĐƯỜNG THOÁT: `phucHoi` + step `xacMinhLai()` PASSED sau step xấu ⇒ GIỮ PASSED, cả hai vào sổ', async ({ page }) => {
    await page.goto(TRANG);
    const e = await ghi(page, DA_SUA, 'PASSED', LOI);
    expect(e.status).toBe('PASSED');
    expect(e.comment, 'lời khai phải ở lại trong sổ để review lại được').toMatch(/PHỤC HỒI: dựng lại tiền đề/);
    expect(e.comment, 'và chỉ ra step nào là bằng chứng').toMatch(/xác minh lại: XÁC MINH LẠI · tiền đề đã có/);
    const bc = e.steps[e.steps.length - 1];
    expect(bc.xacMinhLai, 'cờ do recorder đặt phải vào sổ để cửa đọc nhận ra').toBe(true);
    expect(bc.evidence[0], 'bằng chứng phải có ảnh').toMatch(/\.png$/);
  });

  test('SIẾT 11/11: `phucHoi` đủ dài mà KHÔNG có step xác minh lại ⇒ vẫn bị HẠ — lời khai không phải phép đo', async ({ page }) => {
    /*
     * Đây chính là đường thoát cũ: trước 11/11 nó giữ PASSED. Đo corpus 1161 bản ghi: 0 case dùng nó,
     * nên đổi bây giờ không làm đỏ việc nào.
     */
    await page.goto(TRANG);
    const e = await ghi(page, CO_CHAN, 'PASSED', LOI);
    expect(e.status).toBe('BLOCKED_SETUP');
    expect(e.comment, 'phải nói rõ thiếu cái gì').toMatch(/KHÔNG có step `xacMinhLai\(\)` PASSED/);
  });

  test('xác minh lại nằm TRƯỚC step xấu ⇒ không tính — xác minh xong rồi lại hỏng là chưa phục hồi', async ({ page }) => {
    await page.goto(TRANG);
    const truoc: Buoc[] = [{ ten: 'mở màn', status: 'PASSED' }, { ten: 'đã có từ trước', xacMinh: true }, { ten: 'dựng tiền đề', status: 'BLOCKED' }];
    const e = await ghi(page, truoc, 'PASSED', LOI);
    expect(e.status).toBe('BLOCKED_SETUP');
  });

  test('`xacMinhLai()` BỎ QUA `status` tự khai — assert sai thì step FAILED dù khai PASSED', async ({ page }) => {
    /* Không bỏ qua thì `xacMinhLai(page, 'x', { status: 'PASSED', assert: () => false })` là lời khai mặc áo step. */
    await page.goto(TRANG);
    const gia: Buoc[] = [...CO_CHAN, { ten: 'khai bừa', xacMinh: true, ok: false, status: 'PASSED' }];
    const e = await ghi(page, gia, 'FAILED', { failureLayer: 'setup_failure' });
    expect(e.steps[e.steps.length - 1].status).toBe('FAILED');
  });

  test('`xacMinhLai()` không có `assert` ⇒ NÉM ngay chỗ viết sai', async ({ page }) => {
    await page.goto(TRANG);
    const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'gopverdict-'));
    const rec = new EvidenceRecorder({ taskKey: 'T-GOP', projectOutputDir: 'out', repoRoot: goc, log: false });
    const tc = rec.case('TC_GOP');
    await expect(tc.xacMinhLai(page, 'không đo gì')).rejects.toThrow(/phải có `assert`/);
    fs.rmSync(goc, { recursive: true, force: true });
  });

  test('step FAILED + `phucHoi` mà KHÔNG có bằng chứng ⇒ NÉM, và chỉ đúng chỗ thiếu', async ({ page }) => {
    await page.goto(TRANG);
    await expect(ghi(page, CO_FAIL, 'PASSED', LOI)).rejects.toThrow(/KHÔNG có step `xacMinhLai\(\)`/);
  });

  test('step FAILED + `phucHoi` + xác minh lại PASSED ⇒ GIỮ PASSED', async ({ page }) => {
    await page.goto(TRANG);
    const e = await ghi(page, [...CO_FAIL, { ten: 'so lại số sau khi sửa dữ liệu nguồn', xacMinh: true }], 'PASSED', LOI);
    expect(e.status).toBe('PASSED');
  });

  test('`phucHoi` quá ngắn KHÔNG phải lời khai ⇒ vẫn bị HẠ', async ({ page }) => {
    /*
     * Không có sàn thì `phucHoi: 'ok'` mở toang lại đúng cái lỗ vừa bịt. Cùng khuôn với
     * `minLyDoMienChars` của `bug_claim`.
     */
    await page.goto(TRANG);
    const e = await ghi(page, CO_CHAN, 'PASSED', { phucHoi: 'ok' });
    expect(e.status).toBe('BLOCKED_SETUP');
  });

  test('case KHÔNG có step nào vẫn là TODO — không bị luật mới đụng tới', async ({ page }) => {
    await page.goto(TRANG);
    const e = await ghi(page, []);
    expect(e.status).toBe('TODO');
  });
});

test.describe('@infra gộp verdict — cửa ĐỌC SỔ (output_gate)', () => {
  /* Bản ghi merge tay hoặc chép từ archive KHÔNG đi qua recorder, nên cửa đọc phải tự kiểm. */
  const soTay = (status: string, steps: { name: string; status: string }[], comment = 'ghi chú') => ({
    tests: [{ tcId: 'TC_SO', status, comment, evidence: ['a/step-01-passed.png'], steps: steps.map((s) => ({ ...s, evidence: ['a/x.png'] })) }],
  });
  const loc = (doc: unknown) => ((og.gateTestExecution(doc) || {}).problems || []).filter((p: string) => /còn XẤU/.test(p));

  test('ĐỐI CHỨNG ÂM: PASS với step sạch ⇒ im lặng', () => {
    expect(loc(soTay('PASSED', [{ name: 'mở màn', status: 'PASSED' }]))).toHaveLength(0);
  });

  test('ĐỐI CHỨNG DƯƠNG: PASS với step BLOCKED ⇒ CHẶN, nêu đích danh bước', () => {
    const p = loc(soTay('PASSED', [{ name: 'mở màn', status: 'PASSED' }, { name: 'dựng tiền đề', status: 'BLOCKED' }]));
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/dựng tiền đề=BLOCKED/);
    expect(p[0], 'phải nói vì sao đây là vấn đề, không chỉ nói sai').toMatch(/chưa ai kiểm/);
  });

  const LOI_KHAI = 'PHỤC HỒI: dựng lại qua UI rồi xác minh lại ở bước b';
  const XAU = [{ name: 'a', status: 'PASSED' }, { name: 'b', status: 'BLOCKED' }];
  const BC = { name: 'XÁC MINH LẠI · b đã dựng được', status: 'PASSED' };
  const moi = (doc: any) => ({ tests: doc.tests.map((t: any) => ({ ...t, run: { evidenceDir: 'e/TC_SO' } })) });
  const canh = (doc: unknown) => ((og.gateTestExecution(doc) || {}).warnings || []).filter((w: string) => /LỜI khai phục hồi/.test(w));

  test('bản ghi CŨ: comment khai phục hồi ⇒ KHÔNG chặn, nhưng CẢNH BÁO — lời khai không phải phép đo', () => {
    const d = soTay('PASSED', XAU, LOI_KHAI);
    expect(loc(d)).toHaveLength(0);
    expect(canh(d), 'phải kêu, im lặng thì luật không tồn tại').toHaveLength(1);
  });

  test('bản ghi MỚI: comment khai phục hồi mà KHÔNG có step xác minh lại ⇒ CHẶN', () => {
    const p = loc(moi(soTay('PASSED', XAU, LOI_KHAI)));
    expect(p).toHaveLength(1);
    expect(p[0], 'phải nói rõ thứ đang có chỉ là lời').toMatch(/chỉ có LỜI khai phục hồi/);
  });

  test('chữ "phục hồi" nói về HỆ THỐNG không còn là đường thoát (câu thật từ CSDL-9004)', () => {
    /* Trước 11/11 câu này khớp regex của cửa, và sẽ cho PASS đứng trên step xấu. */
    expect(loc(moi(soTay('PASSED', XAU, 'Ý 4: hệ phục hồi sau khi rút tải — nền sau med 410ms.')))).toHaveLength(1);
  });

  test('bản ghi MỚI: step XÁC MINH LẠI PASSED, có ảnh, SAU step xấu ⇒ KHÔNG chặn, KHÔNG cảnh báo', () => {
    const d = moi(soTay('PASSED', [...XAU, BC], LOI_KHAI));
    expect(loc(d)).toHaveLength(0);
    expect(canh(d)).toHaveLength(0);
  });

  test('step XÁC MINH LẠI KHÔNG có ảnh ⇒ không tính là bằng chứng', () => {
    const d = moi(soTay('PASSED', [...XAU, BC], LOI_KHAI));
    d.tests[0].steps[2].evidence = ['a/ket-qua.json'];
    expect(loc(d)).toHaveLength(1);
  });

  test('step XÁC MINH LẠI nằm TRƯỚC step xấu ⇒ không tính', () => {
    expect(loc(moi(soTay('PASSED', [XAU[0], BC, XAU[1]], LOI_KHAI)))).toHaveLength(1);
  });

  test('KHỨ HỒI: bản ghi recorder sinh bằng `xacMinhLai()` qua được cửa đọc', async ({ page }) => {
    /* Hai tầng phải cùng định nghĩa "bằng chứng". Lệch nhau thì recorder ghi PASS mà cửa chặn, hoặc ngược lại. */
    await page.goto(TRANG);
    const e = await ghi(page, DA_SUA, 'PASSED', LOI);
    expect(e.run && e.run.evidenceDir, 'recorder phải đặt dấu `run` — thiếu thì ca này chỉ đo mức CŨ').toBeTruthy();
    expect(loc({ tests: [e] })).toHaveLength(0);
  });

  test('case FAILED có step xấu ⇒ KHÔNG đụng tới (luật chỉ nói về PASS)', () => {
    expect(loc(soTay('FAILED', [{ name: 'a', status: 'PASSED' }, { name: 'b', status: 'FAILED' }]))).toHaveLength(0);
  });

  test('CHỐNG BÁO OAN trên dữ liệu THẬT: CSDL-4008 không sinh vi phạm mới', () => {
    /*
     * Một luật mới làm đỏ một task đã xong là cách nhanh nhất để nó bị tắt. Đo trước khi sửa: 0/284.
     * Ca này giữ con số đó — nếu nó đỏ, hoặc luật quá rộng, hoặc dữ liệu đã đổi.
     */
    const p = path.join(REPO, 'outputs/CSDL/tasks/CSDL-4008/test-results/testcase-status.json');
    if (!fs.existsSync(p)) { test.skip(true, 'không có dữ liệu task CSDL-4008 trong checkout này'); return; }
    const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
    expect(loc(doc), 'luật mới làm đỏ một task đã xong ⇒ xem lại phạm vi luật').toHaveLength(0);
  });
});
