/*
 * `self:review` — test mồ côi CHẶN ở cửa finalize (v2.9.6, nối theo quyết định của người dùng).
 *
 * VÌ SAO Ở `self:review`, KHÔNG Ở `output_gate`. Phép kiểm đo được hai chiều và bắt ca thật, nhưng bật
 * nó ở cửa push sẽ chặn GIỮA lượt execute — trong khi việc phải làm (hạ verdict mở rộng về `OBSERVATION`
 * hoặc nêu `oracle_ref`) là việc của lúc CHỐT. `self:review --enforce` chạy TRƯỚC finalize/publish, nên
 * nó không cho PHÁT HÀNH một bộ kết quả có verdict không neo được, mà không làm đứng lượt chạy nào.
 *
 * Số đo 30/10/2026 trên 5 task: 11 ca là lỗi thật — 9 ca mở rộng mang verdict mà không có neo oracle
 * (5 trong đó `FAILED`) + 2 ca probe mang verdict. Và 6 ca mở rộng CÓ neo, nên không rỗng chiều nào.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const GATE = path.join(REPO, 'scripts/qa/self_review.js');

const COT = '| TC ID | Loại case | Tag | Áp dụng cho cấp | Module | Trường hợp kiểm thử '
  + '| Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |';

type Tc = { tcId: string; status: string; comment?: string; oracleRef?: string };

/** Dựng một task giả đủ để `self:review` chạy tới phép kiểm này. */
function dungTask(canon: string[], ghi: Tc[]) {
  const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'srmocoi-'));
  const T = path.join(goc, 'tasks', 'T-9');
  fs.mkdirSync(path.join(T, 'test-cases'), { recursive: true });
  fs.mkdirSync(path.join(T, 'test-results'), { recursive: true });
  const dong = canon.map((id) => `| ${id} | UI | [Positive] | THCS | Module A | kiểm một thứ `
    + `| [manual] đã đăng nhập | không cần | 1. mở màn | 1. thấy nhãn đúng | High |`);
  fs.writeFileSync(path.join(T, 'test-cases', 'bo-case.md'),
    ['# T-9', '', COT, `|${'---|'.repeat(11)}`, ...dong].join('\n'), 'utf8');
  fs.writeFileSync(path.join(T, 'test-results', 'testcase-status.json'),
    JSON.stringify({ taskKey: 'T-9', tests: ghi }, null, 2), 'utf8');
  return { goc };
}

function chay(goc: string) {
  const r = spawnSync(process.execPath, [GATE, '--task', 'T-9'], {
    cwd: REPO, encoding: 'utf8',
    env: { ...gateEnv(), TASK_KEY: 'T-9', PROJECT_OUTPUT_DIR: goc },
  });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}
/** Chỉ cắt khối của phép kiểm này — để không ăn nhầm CHẶN của phép kiểm khác trong cùng bó. */
function khoi(out: string) {
  const t = out.indexOf('test đã chạy mà không TC nào nhận');
  if (t < 0) return '';
  /*
   * CẮT TỪ ĐẦU DÒNG, không từ chữ tiêu đề: dấu `✗ CHẶN` / `✓` nằm TRƯỚC tiêu đề trên cùng dòng
   * (`✗ CHẶN  [P0] test đã chạy…`). Bản đầu cắt từ tiêu đề nên mất luôn dấu, và hai ca kiểm báo đỏ
   * trong khi cửa đang chặn ĐÚNG — đối chứng hỏng thì kết luận hỏng.
   */
  const i = out.lastIndexOf('\n', t) + 1;
  const j = out.indexOf('\n✗', i + 1);
  const k = out.indexOf('\n✓', i + 1);
  const het = [j, k, out.indexOf('=== Tổng', i)].filter((x) => x > 0).sort((a, b) => a - b)[0];
  return out.slice(i, het > 0 ? het : out.length);
}

test.describe('@infra self:review — test mồ côi chặn ở cửa finalize', () => {
  test('ĐỐI CHỨNG DƯƠNG: mở rộng mang FAIL mà KHÔNG neo ⇒ CHẶN, nêu tên + nêu luật', () => {
    const k = dungTask(['A_TC_001'], [
      { tcId: 'A_TC_001', status: 'PASS' },
      { tcId: 'EXPANSION_O_KHOA', status: 'FAILED', comment: '- ô khoá vẫn ghi đè được' },
    ]);
    const b = khoi(chay(k.goc).out);
    expect(b, 'phải có khối của phép kiểm này').toBeTruthy();
    expect(b).toMatch(/✗ CHẶN/);
    expect(b).toContain('EXPANSION_O_KHOA');
    expect(b, 'phải dẫn đúng điều luật, không chỉ nói "sai"').toMatch(/CLAUDE\.md §3/);
    expect(b, 'và nói rõ việc phải làm').toMatch(/`OBSERVATION`/);
    fs.rmSync(k.goc, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: probe mang verdict ⇒ CHẶN', () => {
    const k = dungTask(['A_TC_001'], [
      { tcId: 'A_TC_001', status: 'PASS' },
      { tcId: 'PROBE_DONVI', status: 'PASSED' },
    ]);
    const b = khoi(chay(k.goc).out);
    expect(b).toMatch(/✗ CHẶN/);
    expect(b).toMatch(/PROBE_DONVI.*probe\/recon KHÔNG được mang verdict/);
    fs.rmSync(k.goc, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG ÂM: mở rộng CÓ neo oracle ⇒ KHÔNG chặn, và ĐẾM ra số ca có neo', () => {
    /*
     * Chiều quan trọng nhất. Nếu nó chặn cả ca đúng luật thì người dùng sẽ bỏ `--enforce`, và lúc đó cả
     * bó self-review thôi gác gì — đắt hơn nhiều so với việc để sót loại này.
     */
    const k = dungTask(['A_TC_001'], [
      { tcId: 'A_TC_001', status: 'PASS' },
      { tcId: 'EXPANSION_CO_NEO', status: 'FAILED', comment: '- lệch so với BR-HS-014 mục 3' },
      { tcId: 'EXPANSION_NEO_TRUONG', status: 'PASSED', oracleRef: 'SM-LOP-02' },
    ]);
    const b = khoi(chay(k.goc).out);
    expect(b, 'ca có neo KHÔNG được nêu').not.toContain('EXPANSION_CO_NEO');
    expect(b, 'ca khai neo ở trường riêng cũng KHÔNG được nêu').not.toContain('EXPANSION_NEO_TRUONG');
    expect(b, 'nhưng phải ĐẾM, để biết phép kiểm neo có chạy').toMatch(/2 ca mở rộng CÓ neo/);
    expect(b, 'và KHÔNG được chặn').not.toMatch(/✗ CHẶN/);
    fs.rmSync(k.goc, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG ÂM: mở rộng khai OBSERVATION ⇒ đúng luật, không chặn', () => {
    const k = dungTask(['A_TC_001'], [
      { tcId: 'A_TC_001', status: 'PASS' },
      { tcId: 'EXPANSION_KHONG_NEO', status: 'OBSERVATION', comment: '- thấy vậy nhưng không có neo' },
    ]);
    const b = khoi(chay(k.goc).out);
    expect(b).not.toMatch(/✗ CHẶN/);
    fs.rmSync(k.goc, { recursive: true, force: true });
  });

  test('MẠO DANH mã canonical chỉ CẢNH BÁO, không chặn — loại đó chưa gác dòng thật nào', () => {
    /*
     * Loại này đo được 0 ca trên dữ liệu thật nên chỉ có đối chứng tổng hợp. Một loại chưa gác dòng dữ
     * liệu thật nào thì chưa đủ căn cứ để CHẶN — chặn bằng niềm tin là cách nhanh nhất để bị tắt.
     */
    const k = dungTask(['A_TC_001'], [
      { tcId: 'A_TC_001', status: 'PASS' },
      { tcId: 'A_TC_999', status: 'FAILED' },
    ]);
    const b = khoi(chay(k.goc).out);
    expect(b).toContain('A_TC_999');
    expect(b, 'mạo danh phải ở mức cảnh báo').not.toMatch(/✗ CHẶN/);
    fs.rmSync(k.goc, { recursive: true, force: true });
  });

  test('"KHÔNG phán được" KHÔNG thành "đạt", và cũng KHÔNG chặn oan', () => {
    /* Chưa có bộ case canonical là trạng thái bình thường của task chưa execute — nói ra, đừng chặn. */
    const k = dungTask([], [{ tcId: 'A_TC_001', status: 'FAIL' }]);
    const b = khoi(chay(k.goc).out);
    expect(b).toMatch(/KHÔNG phán được/);
    expect(b, 'phải nói thẳng đây không phải sạch').toMatch(/không phải "sạch"/);
    expect(b, 'nhưng không được chặn').not.toMatch(/✗ CHẶN/);
    fs.rmSync(k.goc, { recursive: true, force: true });
  });

  test('phép kiểm nằm trong bó `self:review`, KHÔNG nằm trong `output_gate`', () => {
    /*
     * Khoá lại chỗ nối. Chuyển nó sang `output_gate` là chặn giữa lượt execute — và đó là quyết định của
     * người dùng, không phải của người sửa code sau này.
     */
    const sr = fs.readFileSync(path.join(REPO, 'scripts/qa/self_review.js'), 'utf8');
    expect(sr, '`self:review` phải gọi phép kiểm này').toMatch(/testMoCoi/);
    expect(sr, 'và phải ghi rõ vì sao đặt ở đây').toMatch(/chặn ở cửa FINALIZE|KHÔNG Ở `output_gate`/);
    const og = fs.readFileSync(path.join(REPO, 'scripts/qa/output_gate.js'), 'utf8');
    expect(og, '`output_gate` KHÔNG được gọi phép kiểm này').not.toMatch(/testMoCoi/);
  });
});
