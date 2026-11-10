/**
 * `rerun:classify` — verdict ĐỔI giữa hai lượt: bằng chứng nói được gì, và KHÔNG nói được gì.
 *
 * BỐI CẢNH. Chủ dự án nêu, ưu tiên #4: *"Phân biệt verdict thay đổi vì fix bug, thay đổi môi trường,
 * sửa automation hay flaky."* Trước đó sổ chỉ có `reruns` — một con số đếm, không nói được vì sao.
 *
 * MÁY CHỈ XẾP ĐƯỢC HAI LOẠI, và đó không phải thiếu sót:
 *   ① FLAKY — verdict đổi TRONG CÙNG một lượt. Mã và môi trường chưa kịp đổi giữa hai lần chấm, nên
 *      không còn lời giải thích nào khác. Đây là loại DUY NHẤT máy khẳng định được.
 *   ② AUTOMATION ĐÃ ĐỔI — vân tay spec khác lượt trước. Là điều kiện CẦN, không phải nguyên nhân:
 *      sửa một dòng chú thích cũng làm vân tay đổi.
 *   ③/④ FIX BUG và ĐỔI MÔI TRƯỜNG để lại **cùng một dấu vết đo được**. Chọn bừa một trong hai là bịa
 *      nguyên nhân — đúng thứ `failureLayer` đã cấm, và đúng thứ `SUSPECT_REAL_BUG` sinh ra để chống.
 *
 * Mấy ca dưới đây gác chính ranh giới đó. Bỏ chúng đi là mời người sau dạy máy đoán nguyên nhân.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const CUA = path.join(REPO, 'scripts', 'qa', 'rerun_classify.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { EvidenceRecorder } = require(path.join(REPO, 'scripts/utils/evidence_recorder'));

const TRANG = 'data:text/html,<html><body><h1>rerun</h1></body></html>';

/** Cây task tạm với sổ kết quả dựng tay — dùng cho ca chỉ cần hình dạng dữ liệu. */
function cay(tests: unknown[]): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rrc-'));
  const T = path.join(d, 'tasks', 'T1', 'test-results');
  fs.mkdirSync(T, { recursive: true });
  fs.writeFileSync(path.join(T, 'testcase-status.json'), JSON.stringify({ tests }, null, 2), 'utf8');
  return d;
}
const chay = (goc: string, them: string[] = []) => {
  const r = spawnSync(process.execPath, [CUA, '--task', 'T1', '--goc', goc, ...them], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};
const doc = (goc: string) => JSON.parse(chay(goc, ['--json']).out);
const ban = (tcId: string, doiVerdict: unknown) => ({ tcId, status: 'PASSED', comment: 'x', evidence: [], steps: [], run: { evidenceDir: 'e/' + tcId }, doiVerdict });

test.describe('@infra rerun:classify — xếp loại theo BẰNG CHỨNG', () => {
  test('① đổi trong CÙNG một lượt ⇒ xếp FLAKY, loại duy nhất máy khẳng định được', () => {
    const d = cay([ban('A', { tu: 'PASSED', sang: 'FAILED', cungLuot: true, specDoi: false })]);
    const j = doc(d);
    expect(j.flaky_do_duoc).toBe(1);
    expect(j.can_nguoi_khai, 'đã xếp được thì không hỏi người nữa').toBe(0);
    expect(chay(d).out, 'phải nhắc SUSPECT_REAL_BUG — dán nhãn flaky không kèm cơ chế là chôn bug thật')
      .toMatch(/SUSPECT_REAL_BUG/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('② vân tay spec ĐỔI ⇒ xếp "automation đã đổi", và cửa nói rõ đó KHÔNG phải nguyên nhân', () => {
    const d = cay([ban('B', { tu: 'FAILED', sang: 'PASSED', cungLuot: false, specDoi: true })]);
    expect(doc(d).automation_da_doi).toBe(1);
    expect(chay(d).out, 'phải nói specDoi chỉ là ĐIỀU KIỆN CẦN').toMatch(/không nói đổi đó GÂY RA/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('③/④ spec KHÔNG đổi, khác lượt ⇒ KHÔNG tự gán nhãn, đẩy sang "cần người khai"', () => {
    /*
     * ĐÂY là ca quan trọng nhất. "Dev đã fix" và "môi trường khác" cho cùng một dấu vết. Nếu một ngày
     * ai đó dạy máy đoán ở đây, ca này phải đỏ.
     */
    const d = cay([ban('C', { tu: 'FAILED', sang: 'PASSED', cungLuot: false, specDoi: false })]);
    const j = doc(d);
    expect(j.can_nguoi_khai).toBe(1);
    expect(j.flaky_do_duoc, 'không được tiện tay dán nhãn flaky').toBe(0);
    expect(j.automation_da_doi, 'cũng không được dán nhãn automation').toBe(0);
    expect(chay(d).out, 'cửa phải NÓI RA rằng nó không phân biệt được hai loại này').toMatch(/m[áA]y KHÔNG phân biệt/i);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('đã khai `lyDo` ⇒ không còn nằm trong phần chờ người khai', () => {
    const d = cay([ban('D', { tu: 'FAILED', sang: 'PASSED', cungLuot: false, specDoi: false, lyDo: 'dev fix CSDL-4128, build mới' })]);
    const j = doc(d);
    expect(j.da_khai_ly_do).toBe(1);
    expect(j.can_nguoi_khai).toBe(0);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('lượt trước THIẾU vân tay ⇒ "không phán được", KHÔNG gộp vào "không đổi"', () => {
    /* `specDoi: null` nghĩa là KHÔNG BIẾT. Gộp nó vào `false` là biến một chỗ trống thành một khẳng định. */
    const d = cay([ban('E', { tu: 'FAILED', sang: 'PASSED', cungLuot: false, specDoi: null })]);
    const j = doc(d);
    expect(j.khong_phan_duoc).toBe(1);
    expect(j.can_nguoi_khai).toBe(0);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('sổ KHÔNG có dấu `run` nào ⇒ exit 2, không phải "0 vi phạm"', () => {
    const d = cay([{ tcId: 'F', status: 'PASSED', comment: 'x', evidence: [], steps: [] }]);
    const r = chay(d);
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/KHÔNG PHÁN ĐƯỢC/);
    expect(r.out, 'và nói rõ đây không phải là đạt').toMatch(/KHÔNG phải là đạt/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('thiếu sổ kết quả ⇒ exit 2', () => {
    const d = cay([]);
    fs.rmSync(path.join(d, 'tasks', 'T1', 'test-results', 'testcase-status.json'));
    expect(chay(d).code).toBe(2);
    fs.rmSync(d, { recursive: true, force: true });
  });
});

test.describe('@infra recorder đóng dấu `doiVerdict` từ LƯỢT THẬT', () => {
  async function luot(page: any, goc: string, st: string, runId: string, extra: Record<string, unknown> = {}) {
    const rec = new EvidenceRecorder({ taskKey: 'T-D', projectOutputDir: 'out', repoRoot: goc, log: false, runId });
    const tc = rec.case('TC_D');
    await tc.step(page, 'bước', { status: st });
    await tc.finish(st, st === 'FAILED' ? { failureLayer: 'product_bug', ...extra } : extra);
    await rec.write();
    return JSON.parse(fs.readFileSync(path.join(goc, 'out/tasks/T-D/test-results/testcase-status.json'), 'utf8')).tests[0];
  }

  test('FAILED → PASSED qua hai lượt: ghi `tu`/`sang`, `specDoi=false`, và giữ lời khai', async ({ page }) => {
    await page.goto(TRANG);
    const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'rrc-rec-'));
    await luot(page, goc, 'FAILED', 'R1');
    const e = await luot(page, goc, 'PASSED', 'R2', { lyDoDoiVerdict: 'dev đã fix, chạy lại trên build mới' });
    expect(e.doiVerdict).toMatchObject({ tu: 'FAILED', sang: 'PASSED', cungLuot: false, specDoi: false });
    expect(e.doiVerdict.lyDo).toMatch(/dev đã fix/);
    fs.rmSync(goc, { recursive: true, force: true });
  });

  test('đổi verdict trong CÙNG `runId` ⇒ `cungLuot: true`', async ({ page }) => {
    await page.goto(TRANG);
    const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'rrc-rec2-'));
    await luot(page, goc, 'PASSED', 'R9');
    const e = await luot(page, goc, 'FAILED', 'R9');
    expect(e.doiVerdict.cungLuot, 'cùng một lượt mà verdict đổi — tín hiệu flaky đo được').toBe(true);
    fs.rmSync(goc, { recursive: true, force: true });
  });

  test('verdict KHÔNG đổi ⇒ KHÔNG đóng dấu `doiVerdict` (không làm phình sổ)', async ({ page }) => {
    await page.goto(TRANG);
    const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'rrc-rec3-'));
    await luot(page, goc, 'PASSED', 'R1');
    const e = await luot(page, goc, 'PASSED', 'R2');
    expect(e.doiVerdict).toBeUndefined();
    fs.rmSync(goc, { recursive: true, force: true });
  });

  test('vân tay spec là HASH NỘI DUNG, không phải mtime', () => {
    /*
     * `mtime` đổi khi checkout lại, `git stash pop`, hay chỉ mở file ra lưu — trong khi nội dung y
     * nguyên. Dùng nó thì "automation đã đổi" sẽ dương tính giả hàng loạt.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/utils/evidence_recorder.js'), 'utf8');
    expect(src).toMatch(/createHash\('sha256'\)/);
    expect(src, 'phải nói rõ vì sao không dùng mtime').toMatch(/mtime/);
  });
});
