import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * EXECUTE LITE — 6 chốt, và 5 LỖI CÀI SẴN để đo xem nó còn gác được không (v2.7.0 §A12).
 *
 * Bản đầy đủ `04_execute_fe_playwright.md` nặng ~11,8k token, phần lớn là hướng dẫn viết code mà agent đã
 * biết. Cắt nó xuống là việc đúng — nhưng cắt một prompt execute thì RẤT dễ cắt luôn phần gác, và chuyện
 * đó không lộ ra ngay: nó lộ ra ở lượt đầu tiên có bug thật lọt qua, tức là quá muộn.
 *
 * Nên bản Lite không được tự khai "vẫn gác đủ". Bộ test này cài 5 lỗi vào output của một task giả, rồi
 * kiểm rằng ĐÚNG CÁI MÁY mà chốt tương ứng NÊU TÊN sẽ chặn từng lỗi. Chốt nào không nêu được tên máy,
 * hoặc nêu một máy không chặn, thì bản Lite đã mất phần gác đó và test đỏ.
 *
 * Lưu ý về chốt 3: phần "gom đủ case vào một lượt chưa" KHÔNG có máy, và bản Lite phải nói thẳng điều đó
 * cùng với việc nó thuộc tầng chấm `judge` (§A11). Một chốt im lặng về phần mình không đo được sẽ được
 * đọc thành "chốt này đã gác xong".
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const LITE = path.join(REPO, 'prompt_templates/phase2/04L_execute_lite.md');
const DAY_DU = path.join(REPO, 'prompt_templates/phase2/04_execute_fe_playwright.md');
const CHARS_PER_TOK = 3.2;

const HEADER = '| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |';
const NGAN = '|---|---|---|---|---|---|---|---|---|---|';

type Case = { tcId: string; expected?: string };

/** Dựng một task giả: testcase canonical + thư mục evidence có ảnh thật. */
function dungTask(cases: Case[] = [{ tcId: 'X_TC_001' }]) {
  const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'a12-'));
  const taskDir = path.join(goc, 'tasks', 'T-A12');
  const tcDir = path.join(taskDir, 'test-cases');
  const evDir = path.join(taskDir, 'test-results', 'evidence', cases[0].tcId);
  fs.mkdirSync(tcDir, { recursive: true });
  fs.mkdirSync(evDir, { recursive: true });

  const anh = path.join(evDir, 'step-01.png');
  fs.writeFileSync(anh, Buffer.from('89504e470d0a1a0a', 'hex'));

  const dong = cases.map((c) => `| ${c.tcId} | Functional | [Positive] | Hồ sơ trường | Case ${c.tcId} | [ui] Đã đăng nhập | n/a | 1. Mở màn | ${c.expected ?? '1. Màn hiện 4 tab'} | Medium |`);
  fs.writeFileSync(path.join(tcDir, 'tc.md'), ['# Testcase', '', HEADER, NGAN, ...dong, ''].join('\n'), 'utf8');

  return { goc, taskDir, tcDir, anh: anh.replace(/\\/g, '/'), status: path.join(taskDir, 'test-results', 'testcase-status.json') };
}

const ghiStatus = (f: string, ds: unknown[]) => fs.writeFileSync(f, JSON.stringify(ds, null, 2), 'utf8');

function chayGate(may: string, args: string[], goc: string) {
  return spawnSync(process.execPath, [path.join(REPO, may), ...args], {
    cwd: REPO, encoding: 'utf8', env: gateEnv({ PROJECT_OUTPUT_DIR: goc, TASK_KEY: 'T-A12' }),
  });
}

const docLite = () => fs.readFileSync(LITE, 'utf8');

test.describe.configure({ mode: 'default' });

test.describe('@infra Execute Lite — rẻ hơn, và phải chứng minh là vẫn gác', () => {
  test('rẻ hơn bản đầy đủ ÍT NHẤT một nửa', () => {
    const a = fs.readFileSync(DAY_DU, 'utf8').length / CHARS_PER_TOK;
    const b = docLite().length / CHARS_PER_TOK;
    expect(b, `Lite ${Math.round(b)} token vs đầy đủ ${Math.round(a)} token`).toBeLessThan(a / 2);
  });

  test('giữ ĐỦ 6 chốt, và MỖI chốt nêu tên một lệnh npm CÓ THẬT', () => {
    /*
     * Đây là test giữ cho bản Lite không rẻ đi bằng cách bỏ gác. Một chốt viết hay mà không nêu máy thì
     * nó là lời dặn, và lời dặn thì không chặn được gì.
     */
    const t = docLite();
    const chot = [...t.matchAll(/^\*\*(\d)\. /gm)].map((m) => m[1]);
    expect(chot, 'phải đủ 6 chốt, đánh số 1..6').toEqual(['1', '2', '3', '4', '5', '6']);

    const scripts = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).scripts;
    const khoi = t.split(/^\*\*(?=\d\. )/m).slice(1);
    expect(khoi.length).toBe(6);
    for (const [i, k] of khoi.entries()) {
      const lenh = [...k.matchAll(/npm run ([a-z][\w:-]*)/g)].map((m) => m[1]);
      expect(lenh.length, `chốt ${i + 1} KHÔNG nêu máy nào`).toBeGreaterThan(0);
      for (const l of lenh) expect(scripts, `chốt ${i + 1} nêu lệnh không tồn tại: ${l}`).toHaveProperty(l);
    }
  });

  test('chốt 3 KHAI thẳng phần nó không đo được, và chỉ sang tầng chấm', () => {
    /*
     * "Gom đủ case vào một lượt chưa" không có mẫu số nào để chia, nên không máy nào đo. Một chốt im lặng
     * về phần mình không đo được sẽ được đọc thành "chốt này đã gác xong" — đúng cách đọc sai mà §A10.7
     * và §A11 dựng ra để chặn.
     */
    const khoi = docLite().split(/^\*\*(?=\d\. )/m)[3];
    expect(khoi).toContain('không có máy');
    expect(khoi).toContain('judge');
    expect(khoi, 'phải nói rõ tầng chấm chỉ dùng được khi còn hiệu chuẩn').toContain('hiệu chuẩn');
  });

  test('bản Lite trỏ về bản đầy đủ, và nói rõ khi nào phải mở', () => {
    const t = docLite();
    expect(t).toContain('04_execute_fe_playwright.md');
    expect(t).toContain('lane');
  });
});

test.describe('@infra Execute Lite — 5 LỖI CÀI SẴN, mỗi lỗi phải bị đúng máy của chốt đó chặn', () => {
  test('LỖI 1 (chốt 6): case PASS mà KHÔNG có evidence ⇒ gate:output CHẶN', () => {
    const t = dungTask();
    ghiStatus(t.status, [{
      tcId: 'X_TC_001', status: 'PASSED', comment: 'Mở màn hồ sơ trường, lưới hiện 4 tab.',
      evidence: [], steps: [{ name: 'B1', status: 'PASSED', comment: 'ok', evidence: [] }],
      recordedAt: '2026-10-12T00:00:00.000Z',
    }]);
    const r = chayGate('scripts/qa/output_gate.js', ['--status', t.status], t.goc);
    expect(r.status, `${r.stdout}${r.stderr}`).toBe(1);
    expect(`${r.stdout}${r.stderr}`).toContain('THIẾU evidence');
  });

  test('LỖI 2 (chốt 6): evidence là `.json`, không phải ảnh/video ⇒ gate:output CHẶN', () => {
    /*
     * Lỗi này quan trọng hơn vẻ ngoài của nó: một `trace.zip` hay một `.json` trông như bằng chứng trong
     * bảng kết quả, nhưng người đọc báo cáo không mở được nó để thấy màn hình lúc đó ra sao.
     */
    const t = dungTask();
    const gia = path.join(path.dirname(t.anh), 'ket-qua.json');
    fs.writeFileSync(gia, '{}', 'utf8');
    ghiStatus(t.status, [{
      tcId: 'X_TC_001', status: 'PASSED', comment: 'Màn mở, lưới hiện 4 tab.',
      evidence: [gia.replace(/\\/g, '/')],
      steps: [{ name: 'B1', status: 'PASSED', comment: 'ok', evidence: [gia.replace(/\\/g, '/')] }],
      recordedAt: '2026-10-12T00:00:00.000Z',
    }]);
    const r = chayGate('scripts/qa/output_gate.js', ['--status', t.status], t.goc);
    expect(r.status, `${r.stdout}${r.stderr}`).toBe(1);
    expect(`${r.stdout}${r.stderr}`).toContain('KHÔNG phải ảnh/video');
  });

  test('LỖI 3 (chốt 4): FAIL mà KHÔNG khai failureLayer ⇒ gate:output CHẶN', () => {
    const t = dungTask();
    ghiStatus(t.status, [{
      tcId: 'X_TC_001', status: 'FAILED', comment: 'Bỏ trống Tên trường mà form vẫn lưu được.',
      evidence: [t.anh], steps: [{ name: 'B1', status: 'FAILED', comment: 'form lưu', evidence: [t.anh] }],
      recordedAt: '2026-10-12T00:00:00.000Z',
    }]);
    const r = chayGate('scripts/qa/output_gate.js', ['--status', t.status], t.goc);
    expect(r.status, `${r.stdout}${r.stderr}`).toBe(1);
    expect(`${r.stdout}${r.stderr}`, 'FAIL không phân tầng thì ticket đi nhầm người').toMatch(/failureLayer|tầng/i);
  });

  test('LỖI 4 (chốt 4): verdict NGOÀI taxonomy ⇒ gate:output CHẶN', () => {
    const t = dungTask();
    ghiStatus(t.status, [{
      tcId: 'X_TC_001', status: 'DONE', comment: 'Màn mở, lưới hiện 4 tab.',
      evidence: [t.anh], steps: [{ name: 'B1', status: 'PASSED', comment: 'ok', evidence: [t.anh] }],
      recordedAt: '2026-10-12T00:00:00.000Z',
    }]);
    const r = chayGate('scripts/qa/output_gate.js', ['--status', t.status], t.goc);
    expect(r.status, `${r.stdout}${r.stderr}`).toBe(1);
    expect(`${r.stdout}${r.stderr}`).toMatch(/taxonomy|không thuộc/i);
  });

  test('LỖI 5 (chốt 2): ô `Kết quả mong đợi` RỖNG ⇒ gate:gen-testcase CHẶN', () => {
    /*
     * Oracle rỗng là lỗi rẻ nhất và nguy hiểm nhất ở Phase 1: case vẫn chạy, vẫn xanh, và cái xanh đó
     * không nói gì.
     *
     * LƯỢT ĐẦU TÔI NÊU SAI MÁY. Bản Lite viết "chốt 2 → design:gate (ô lõi rỗng = CHẶN)", và phép đo này
     * cho thấy `design:gate` in ra "✓ ĐẠT — đủ cột canonical, không rỗng ô lõi" trên đúng bộ có ô expected
     * rỗng. Lý do: `REQUIRED_FIELDS` của `validate.js` CỐ Ý không gồm `expectedRaw` — oracle rỗng được
     * giao cho `output_rules`, và `gate:gen-testcase` mới là máy chặn nó.
     *
     * Một chốt nêu sai máy thì tệ hơn một chốt không nêu máy nào: người đọc tin là đã có ai gác.
     */
    const t = dungTask([{ tcId: 'X_TC_001', expected: '' }]);

    const sai = chayGate('scripts/qa/design_gate.js', ['--dir', t.tcDir], t.goc);
    expect(sai.status, 'design:gate KHÔNG gác ô này — ghi lại để không ai nêu lại nhầm máy').toBe(0);

    const r = chayGate('scripts/qa/output_gate.js', ['--mode', 'gen-testcase', '--dir', t.tcDir], t.goc);
    expect(r.status, `${r.stdout}${r.stderr}`).toBe(1);
    expect(`${r.stdout}${r.stderr}`).toContain('RỖNG (oracle rỗng)');
  });

  test('ĐỐI CHỨNG: output SẠCH ⇒ gate:output KHÔNG chặn', () => {
    /*
     * Năm lỗi bị chặn chỉ có nghĩa nếu bản sạch được cho qua. Một gate chặn mọi thứ cũng "bắt được 5/5",
     * và nó sẽ bị tắt ngay tuần sau.
     */
    const t = dungTask();
    ghiStatus(t.status, [{
      tcId: 'X_TC_001', status: 'PASSED',
      comment: 'Mở màn hồ sơ trường: lưới hiện đủ 4 tab và tiêu đề đúng đơn vị đang đăng nhập.',
      evidence: [t.anh],
      steps: [{ name: 'B1 — mở màn', status: 'PASSED', comment: 'Màn mở, tiêu đề đúng đơn vị.', evidence: [t.anh] }],
      recordedAt: '2026-10-12T00:00:00.000Z',
      attestation: {
        oracleSource: 'spec', executed: 1, allEvidenceAttached: true, failuresClassified: true, rerunDone: true,
      },
    }]);
    const r = chayGate('scripts/qa/output_gate.js', ['--status', t.status], t.goc);
    expect(r.status, `output sạch mà vẫn bị chặn:\n${r.stdout}${r.stderr}`).toBe(0);
  });
});
