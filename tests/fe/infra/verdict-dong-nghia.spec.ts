/**
 * `EvidenceRecorder` phải hiểu TÊN CHUẨN của verdict, không chỉ tên đồng nghĩa (v2.9.6 N2.2).
 *
 * `.agent/config/verdict_taxonomy.json` khai tên chuẩn là **`FAIL`**, và `FAILED` chỉ là **đồng nghĩa**
 * (`synonyms: {"PASSED":"PASS","FAILED":"FAIL",…}`). Nhưng recorder ghim nguyên văn `'FAILED'` ở 7 chỗ
 * và không hề tra bảng `synonyms`. Hệ quả: gọi `finish('FAIL', …)` — ĐÚNG TÊN CHUẨN — thì
 *
 *   · `failureLayer` bị xoá trắng (dòng `status === 'FAILED' ? … : ''`),
 *   · phép kiểm "FAIL bắt buộc khai tầng" KHÔNG nổ (nhánh `else if (status === 'FAILED')`),
 *   · phép kiểm "tầng phải nằm trong taxonomy" KHÔNG chạy,
 *   · `reruns` KHÔNG được đếm,
 *   · và `bug_claim.js` đọc `t.failureLayer` nên KHÔNG thấy case nào để đòi claim.
 *
 * Bốn cửa tắt cùng lúc, và cách tắt chúng là **viết đúng chuẩn**. Đo trên sổ thật: 55 ca đỏ mang
 * `status: 'FAIL'`, trong đó 49 ca khai `product_bug` và 6 ca khai `be`/`fe` — mà `be`/`fe` KHÔNG nằm
 * trong 8 tầng taxonomy khai. Đúng loại giá trị mà phép kiểm lẽ ra phải chặn.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { EvidenceRecorder } = require('../../../scripts/utils/evidence_recorder');
const gate = require('../../../scripts/qa/output_gate.js');
const TAXONOMY = require('../../../.agent/config/verdict_taxonomy.json');

const TRANG_TRONG = 'data:text/html,<html><body><h1>kiem tra verdict</h1></body></html>';

/** Một lượt chạy, status truyền thẳng như spec thật gọi — KHÔNG ép kiểu về `'FAILED'`. */
async function motLuot(page: any, goc: string, tcId: string, verdict: string, opts: any = {}) {
  const rec = new EvidenceRecorder({ taskKey: 'TEST-VD', projectOutputDir: 'out', repoRoot: goc, log: false });
  const tc = rec.case(tcId);
  await tc.step(page, 'Bước quyết định', { status: /^FAIL/i.test(verdict) ? 'FAILED' : 'PASSED' });
  await tc.finish(verdict, opts);
  await rec.write();
  const so = JSON.parse(fs.readFileSync(path.join(goc, 'out/tasks/TEST-VD/test-results/testcase-status.json'), 'utf8'));
  /*
   * TRA THEO `tcId`, KHÔNG lấy `tests[0]`.
   *
   * Bản đầu của chính spec này lấy `tests[0]` — và vì sổ là bản GỘP nhiều case, phần tử 0 sau lượt hai
   * vẫn là case của lượt MỘT. Nên ca kiểm đầu tiên BÁO XANH trong khi lỗ vẫn còn nguyên: nó đang khẳng
   * định trên case khác. Đối chứng hỏng thì kết luận hỏng.
   */
  const ca = (so.tests || []).find((x) => x.tcId === tcId);
  if (!ca) throw new Error(`không thấy ${tcId} trong sổ — sổ có: ${(so.tests || []).map((x) => x.tcId).join(', ')}`);
  return ca;
}

/*
 * KHÔNG ĐI QUA BƯỚC CHỤP ẢNH cho hai ca đòi NÉM một thông điệp CỤ THỂ.
 *
 * `motLuot` gọi `tc.step(page, …)`, và `step` chụp ảnh. Dưới tải song song, ảnh có thể lỗi TRƯỚC khi
 * `finish` kịp ném — lúc đó `rejects.toThrow(/thiếu failureLayer/)` nhận một thông điệp khác và đỏ.
 *
 * Đo 31/10/2026: ca này xanh 3/3 lượt khi chạy riêng trong gói, nhưng đỏ ở `release:verify` — nơi cả bó
 * chạy song song. Phép kiểm đang đo CẢ đường chụp ảnh, trong khi nó chỉ tuyên bố đo logic verdict.
 *
 * `finish` không cần step nào để chạy phép kiểm tầng lỗi, nên bỏ ảnh ra là đo đúng thứ mình nói.
 */
async function finishTran(goc: string, tcId: string, verdict: string, opts: any = {}) {
  const rec = new EvidenceRecorder({ taskKey: 'TEST-VD', projectOutputDir: 'out', repoRoot: goc, log: false });
  await rec.case(tcId).finish(verdict, opts);
  await rec.write();
}

const tam = () => fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-'));

test.describe('@infra verdict đồng nghĩa — tên CHUẨN không được làm tắt cửa', () => {
  test('`FAIL` (tên chuẩn) GIỮ được failureLayer, y như `FAILED`', async ({ page }) => {
    const goc = tam();
    await page.goto(TRANG_TRONG);

    const a = await motLuot(page, goc, 'TC_A', 'FAILED', { failureLayer: 'product_bug' });
    expect(a.failureLayer, 'tên đồng nghĩa vẫn phải giữ được').toBe('product_bug');

    const b = await motLuot(page, goc, 'TC_B', 'FAIL', { failureLayer: 'product_bug' });
    expect(b.failureLayer, 'tên CHUẨN cũng phải giữ được — đây là chỗ hỏng').toBe('product_bug');

    fs.rmSync(goc, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: `FAIL` mà THIẾU tầng ⇒ phải NÉM, không được ghi im lặng', async () => {
    const goc = tam();
    await expect(finishTran(goc, 'TC_C', 'FAIL', {}), 'FAIL thiếu tầng phải bị chặn')
      .rejects.toThrow(/thiếu failureLayer/);
    fs.rmSync(goc, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: tầng TỰ ĐẶT bị chặn với cả hai cách viết', async () => {
    /* `be` và `fe` là ví dụ thật: 6 ca trong sổ khai chúng, mà taxonomy không có tầng nào tên vậy. */
    const goc = tam();
    await expect(finishTran(goc, 'TC_D', 'FAILED', { failureLayer: 'be' }))
      .rejects.toThrow(/không có trong verdict_taxonomy/);
    await expect(finishTran(goc, 'TC_E', 'FAIL', { failureLayer: 'be' }), 'tên chuẩn cũng phải bị chặn')
      .rejects.toThrow(/không có trong verdict_taxonomy/);
    fs.rmSync(goc, { recursive: true, force: true });
  });

  test('`reruns` đếm được khi viết bằng tên CHUẨN', async ({ page }) => {
    /* `output_gate` đòi case product_bug khai reruns để chứng minh đã loại flaky. Viết `FAIL` mà không
     * đếm thì con số ấy đứng mãi ở 0, và cửa đòi rerun hoá ra đòi một thứ không bao giờ tăng. */
    const goc = tam();
    await page.goto(TRANG_TRONG);
    const l1 = await motLuot(page, goc, 'TC_F', 'FAIL', { failureLayer: 'product_bug' });
    expect(l1.reruns).toBe(0);
    const l2 = await motLuot(page, goc, 'TC_F', 'FAIL', { failureLayer: 'product_bug' });
    expect(l2.reruns, 'fail lần hai bằng tên chuẩn = đã chạy lại 1 lần').toBe(1);
    fs.rmSync(goc, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG ÂM: `PASS` và `PASSED` KHÔNG bị đòi tầng, và KHÔNG bị gắn tầng', async ({ page }) => {
    /*
     * Chiều ngược phải giữ: khai tầng lỗi trên một case PASS là thông tin sai trong file kết quả, và
     * `bug_claim.js` sẽ đòi claim cho một case không có lỗi nào. Nới phép chuẩn hoá mà làm hỏng chiều
     * này thì đổi một lỗ lấy một lỗ.
     */
    const goc = tam();
    await page.goto(TRANG_TRONG);
    const a = await motLuot(page, goc, 'TC_G', 'PASS', { failureLayer: 'product_bug' });
    expect(a.failureLayer || '', 'case PASS KHÔNG được mang tầng lỗi').toBe('');
    const b = await motLuot(page, goc, 'TC_H', 'PASSED', {});
    expect(b.failureLayer || '').toBe('');
    fs.rmSync(goc, { recursive: true, force: true });
  });
});

/*
 * Chặn ở recorder KHÔNG suy ra chặn ở sổ đã ghi.
 *
 * Recorder ném lỗi lúc `finish`, nên nó chỉ gác ca MỚI. Ba ca thật trong TASK-9003 (TC_064 · TC_132 ·
 * TC_172) đã nằm trong sổ với tầng `be`/`fe` từ 08/10 — và vì `bug_claim` lọc theo
 * `blockingLayers: ["product_bug","api_bug"]`, chúng đi qua cửa đòi bug claim mà không ai hỏi gì.
 * Nên phép kiểm phải ở CẢ HAI chỗ: lúc ghi, và lúc đọc.
 */
test.describe('@infra output_gate — tầng lỗi phải CÓ THẬT trong taxonomy', () => {
  const caFail = (failureLayer: string) => ({
    tests: [{
      tcId: 'T_900', status: 'FAIL', failureLayer, reruns: 2,
      comment: `- đo được giá trị sai ở bước quyết định (tầng ${failureLayer})`,
      evidence: ['x/step-01-failed.png'],
      steps: [{ status: 'FAILED', comment: '- bước 1', evidence: ['x/step-01-failed.png'] }],
    }],
  });
  const loc = (r: any) => r.problems.filter((p: string) => /KHÔNG có trong verdict_taxonomy/.test(p));

  test('ĐỐI CHỨNG DƯƠNG: tầng `be` và `fe` ⇒ CHẶN, và nói rõ FE/BE nằm TRONG product_bug', () => {
    for (const tang of ['be', 'fe']) {
      const d = loc(gate.gateTestExecution(caFail(tang)));
      expect(d.length, `tầng "${tang}" phải bị chặn`).toBe(1);
      expect(d[0], 'phải liệt kê các tầng hợp lệ để người đọc sửa được ngay').toContain('product_bug');
      expect(d[0], 'phải nói FE/BE là chi tiết trong product_bug, không phải tầng thay thế').toMatch(/beVsFe/);
      expect(d[0], 'phải nói rõ hậu quả: lọt cửa bug claim').toMatch(/bug claim/);
    }
  });

  test('ĐỐI CHỨNG ÂM: cả 8 tầng taxonomy khai đều KHÔNG bị chặn oan', () => {
    /*
     * Chiều này quan trọng ngang chiều trên: một luật chặn cả giá trị đúng thì người dùng sẽ học cách
     * tắt nó, và lúc đó nó không gác gì nữa. 5/8 tầng hiện chưa xuất hiện trong dữ liệu thật
     * (`api_bug`, `script_error`, `infra`, `flaky`, `dependency`) nên chúng chỉ được gác ở đây.
     */
    const tang = Object.keys(TAXONOMY.failureLayers || {});
    expect(tang.length, 'taxonomy phải khai tầng, nếu không phép kiểm này rỗng').toBeGreaterThanOrEqual(8);
    for (const t of tang) {
      expect(loc(gate.gateTestExecution(caFail(t))), `tầng hợp lệ "${t}" KHÔNG được chặn`).toEqual([]);
    }
  });

  test('case KHÔNG khai tầng vẫn do luật CŨ lo, luật mới không chen vào', () => {
    /* Thiếu tầng và tầng-bịa là hai lỗi khác nhau, phải ra hai dòng khác nhau. */
    const r = gate.gateTestExecution(caFail(''));
    expect(loc(r), 'không khai tầng thì luật mới im').toEqual([]);
    expect(r.problems.some((p: string) => /KHÔNG phân tầng lỗi/.test(p)), 'nhưng luật cũ phải nói').toBe(true);
  });
});
