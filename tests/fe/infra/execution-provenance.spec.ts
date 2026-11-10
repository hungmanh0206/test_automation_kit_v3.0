/**
 * NGUỒN GỐC LƯỢT CHẠY — verdict này ra từ LƯỢT NÀO, SPEC nào, ảnh ở đâu.
 *
 * BỐI CẢNH. Chủ dự án nêu, ưu tiên #3: *"Liên kết testcase với đúng Playwright run, step và evidence
 * của lần chạy đó, kể cả khi sổ testcase-status không lưu step trực tiếp."*
 *
 * ĐO TRƯỚC KHI SỬA, trên CSDL-4008: bản ghi có `tcId status comment evidence steps recordedAt scope`
 * — **không có `runId`, không có liên kết nào tới lượt Playwright**. `runId` tồn tại trong schema
 * nhưng ở mức FILE, và file đó còn vắng luôn trường ấy.
 *
 * VÌ SAO PHẢI Ở CẤP CASE. Đây là nối tiếp lập luận đã có sẵn trong `_put()`: `testcase-status.json`
 * gộp cả shard của lượt trước, nên MỘT file chứa kết quả của NHIỀU lượt. Dấu ở mức file không nói
 * được case nào thuộc lượt nào — đúng lý do `recordedAt` và `scope` đã phải đóng dấu từng case.
 * Lớp lỗi đã trả giá (08/10/2026): 45 verdict của lượt GDTX ghi đè cột `Result THCS`, không máy nào
 * báo, vì bản ghi không mang dấu vết lượt chạy để đối chiếu.
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

const TRANG = 'data:text/html,<html><body><h1>nguon goc</h1></body></html>';

async function ghi(page: any, opts: { runId?: string } = {}) {
  const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'prov-'));
  const rec = new EvidenceRecorder({ taskKey: 'T-NG', projectOutputDir: 'out', repoRoot: goc, log: false, ...opts });
  const tc = rec.case('TC_NG');
  await tc.step(page, 'bước một', { status: 'PASSED' });
  await tc.finish('PASSED');
  await rec.write();
  const j = JSON.parse(fs.readFileSync(path.join(goc, 'out/tasks/T-NG/test-results/testcase-status.json'), 'utf8'));
  const e = (j.tests || j)[0];
  fs.rmSync(goc, { recursive: true, force: true });
  return e;
}

test.describe('@infra nguồn gốc — đóng dấu từng case', () => {
  test('bản ghi mang khối `run`, và `evidenceDir` trỏ tới ảnh của chính lượt này', async ({ page }) => {
    await page.goto(TRANG);
    const e = await ghi(page);
    expect(e.run, 'thiếu khối `run` ⇒ không lần lại được verdict ra từ đâu').toBeTruthy();
    expect(e.run.evidenceDir, '`evidenceDir` là thứ kiểm lại được bằng tay').toContain('TC_NG');
  });

  test('lấy danh tính từ `test.info()` — spec, tiêu đề, project, retry, worker', async ({ page }) => {
    /*
     * `test.info()` do chính Playwright cấp nên không phải đoán. Đây là nguồn đáng tin nhất, và là
     * thứ trả lời đúng chữ "ĐÚNG Playwright run" trong yêu cầu.
     */
    await page.goto(TRANG);
    const e = await ghi(page);
    expect(e.run.spec, 'phải trỏ về chính file spec đang chạy').toMatch(/execution-provenance\.spec\.ts$/);
    expect(e.run.title, 'tiêu đề test để người đọc biết case này chạy ở đâu').toBeTruthy();
    expect(e.run.project).toBeTruthy();
    expect(typeof e.run.retry, 'lần retry là một phần của nguồn gốc').toBe('number');
    expect(typeof e.run.worker).toBe('number');
  });

  test('đường dẫn NGẮN và dùng `/` — không để đường dẫn tuyệt đối của máy người chạy vào sổ', async ({ page }) => {
    /*
     * Bản đầu dùng `path.relative(repoRoot, …)` trần. Cây tạm làm `repoRoot` khác gốc repo, nên
     * `spec` ra một đường dẫn TUYỆT ĐỐI của máy tôi — vô dụng với người đọc sổ sau này.
     */
    await page.goto(TRANG);
    const e = await ghi(page);
    for (const k of ['evidenceDir', 'spec']) {
      expect(e.run[k], `${k} không được là đường dẫn tuyệt đối`).not.toMatch(/^[A-Za-z]:[\\/]|^\//);
      expect(e.run[k], `${k} phải dùng dấu / kể cả trên Windows`).not.toContain('\\');
    }
    expect(e.run.title, 'tiêu đề không được lẫn đường dẫn file').not.toContain('.spec.ts');
  });

  test('`RUN_ID` khai thì ghi, KHÔNG khai thì BỎ TRỐNG — không tự sinh id thay người chạy', async ({ page }) => {
    /*
     * Mỗi worker Playwright là một tiến trình riêng. Một id tự sinh sẽ KHÁC NHAU giữa các worker của
     * CÙNG một lượt, và một dấu vết sai tệ hơn không có dấu vết.
     */
    await page.goto(TRANG);
    expect((await ghi(page, { runId: 'R-99' })).run.id).toBe('R-99');
    expect((await ghi(page)).run.id, 'không khai thì không được bịa').toBeUndefined();
  });

  test('cửa ĐỌC SỔ cảnh báo khi bản ghi thiếu dấu — GỘP một dòng, không 284 dòng', async () => {
    /*
     * Mức CẢNH BÁO vì mọi bản ghi có trước hôm nay đều thiếu dấu; làm đỏ chúng là làm đỏ việc đã xong.
     * Và gộp, vì 284 dòng giống hệt nhau không phải thông tin — nó đẩy dòng đáng đọc ra khỏi màn hình.
     */
    const mk = (run?: unknown) => ({ tests: [{ tcId: 'A', status: 'PASSED', comment: 'x', evidence: ['a/step-01-passed.png'], steps: [{ name: 'b', status: 'PASSED', evidence: ['a/x.png'] }], ...(run ? { run } : {}) }] });
    const loc = (d: unknown) => ((og.gateTestExecution(d).warnings || []) as string[]).filter((w) => /dấu nguồn gốc/.test(w));
    expect(loc(mk()), 'ĐỐI CHỨNG DƯƠNG: thiếu dấu ⇒ đúng MỘT dòng cảnh báo').toHaveLength(1);
    expect(loc(mk({ evidenceDir: 'x/y', spec: 's.ts' })), 'ĐỐI CHỨNG ÂM: có dấu ⇒ im lặng').toHaveLength(0);
  });

  test('cảnh báo nêu VÌ SAO, không chỉ nêu thiếu', async () => {
    const d = { tests: [{ tcId: 'A', status: 'PASSED', comment: 'x', evidence: ['a/step-01-passed.png'], steps: [{ name: 'b', status: 'PASSED', evidence: ['a/x.png'] }] }] };
    const w = ((og.gateTestExecution(d).warnings || []) as string[]).find((x) => /dấu nguồn gốc/.test(x)) || '';
    expect(w, 'phải nói hậu quả đã xảy ra thật, không nói suông').toMatch(/ghi đè cột Result THCS|45 verdict/);
    expect(w, 'và nói rõ lượt chạy mới sẽ tự có dấu').toMatch(/tự có dấu/);
  });

  test('schema trong header recorder phải khai `run` — tài liệu và mã không được lệch', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/utils/evidence_recorder.js'), 'utf8');
    expect(src, 'header mô tả schema mà thiếu `run` thì người đọc không biết trường đó tồn tại')
      .toMatch(/run: \{ evidenceDir/);
  });
});
