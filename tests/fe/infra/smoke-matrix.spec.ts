import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';
import { thuMucTam, donThuMucTam } from './_thu_muc_tam';

/*
 * @infra — MA TRẬN SMOKE: nhiều nhân trình duyệt × nhiều kích thước, và một bảng ĐỌC ĐƯỢC.
 *
 * Điều kiện đáng khoá nhất KHÔNG phải "chạy được nhiều trình duyệt" — `playwright.config.js` đã có lane
 * cross-browser từ trước. Là ba thứ dưới đây, vì thiếu cái nào thì bảng tự biến thành vô nghĩa:
 *
 *   ① ô KHÔNG CHẠY phải đếm riêng và in ra `▢`. Kit đã trả giá hai lần cho lớp lỗi "có số nhưng số đó
 *     nói về một tập khác": `full:suite` từng đếm cả spec WIP, `rule_coverage` từng đếm theo đĩa.
 *   ② lớp chặn của `smoke_run` KHÔNG được bắc cầu qua — nếu không, lần sau không ai nhớ smoke từng đòi
 *     gốc URL tường minh.
 *   ③ báo cáo phải nói thẳng đây là GIẢ LẬP. "Xanh trên WebKit" không phải "chạy được trên iPhone".
 */
const REPO = path.resolve(__dirname, '..', '..', '..');

/* eslint-disable @typescript-eslint/no-var-requires, global-require */
const M = require(path.join(REPO, 'scripts/qa/reuse/smoke_matrix.js'));
/* eslint-enable @typescript-eslint/no-var-requires, global-require */

const CFG_THU = {
  project: [
    { ten: 'chromium-desktop', device: 'Desktop Chrome', nhan: 'nhân Blink' },
    { ten: 'webkit-desktop', device: 'Desktop Safari', nhan: 'nhân WebKit — GIẢ LẬP' },
  ],
  kich_thuoc: [{ ten: '1366x768', w: 1366, h: 768 }],
  bo_qua: [],
};

test.describe('@infra smoke:matrix — ô ma trận và cách đọc chúng', () => {
  test('ma trận là TÍCH project × kích thước', () => {
    const o = M.dungO({ ...CFG_THU, kich_thuoc: [{ ten: 'a', w: 1, h: 2 }, { ten: 'b', w: 3, h: 4 }] });
    expect(o.length, '2 project × 2 kích thước = 4 ô').toBe(4);
    expect(o.map((x: { ten: string }) => x.ten)).toContain('webkit-desktop@b');
  });

  test('`bo_qua` phải kèm `vi_sao` — bỏ ô mà không nói lý do thì KHÔNG nạp được config', () => {
    /*
     * Lý do luật này cứng: bỏ một ô là cách rẻ nhất để làm bảng xanh. Bắt khai lý do không ngăn được
     * người cố tình, nhưng nó để lại dấu vết đọc được ở lần rà sau.
     */
    const d = thuMucTam('bmx');
    try {
      const p = path.join(d, 'm.json');
      fs.writeFileSync(p, JSON.stringify({ ...CFG_THU, bo_qua: [{ project: 'webkit-desktop', kich_thuoc: '1366x768' }] }), 'utf8');
      expect(M.napCauHinh(p).loi, 'thiếu `vi_sao` phải bị từ chối').toMatch(/vi_sao/);

      fs.writeFileSync(p, JSON.stringify({
        ...CFG_THU,
        bo_qua: [{ project: 'webkit-desktop', kich_thuoc: '1366x768', vi_sao: 'engine chưa cài trên runner này' }],
      }), 'utf8');
      expect(M.napCauHinh(p).loi, 'có `vi_sao` thì nạp được').toBeUndefined();
    } finally { donThuMucTam(d); }
  });

  test('Ô KHÔNG CHẠY in `▢` và được ĐẾM RIÊNG — không lẫn vào PASS', () => {
    const o = M.dungO({
      ...CFG_THU,
      bo_qua: [{ project: 'webkit-desktop', kich_thuoc: '1366x768', vi_sao: 'cố ý bỏ để thử phép đếm' }],
    });
    const theoO = new Map([['chromium-desktop@1366x768', new Map([['màn A', 'PASS']])]]);
    const b = M.gomBang({ o, theoO, spec: 'x.spec.ts' });

    expect(b.pass, 'đúng một ô xanh').toBe(1);
    expect(b.bo, 'ô bỏ qua phải vào cột riêng, không cộng vào PASS').toBe(1);
    expect(b.md).toContain('▢');
    expect(b.md, 'bảng phải nói thẳng ▢ không đồng nghĩa với đạt').toMatch(/`▢` \*\*không\*\* đồng nghĩa với đạt/);
  });

  test('ô CÓ TRONG ma trận mà KHÔNG có kết quả ⇒ `▢`, không âm thầm thành PASS', () => {
    /*
     * Khác ca trên: ô này KHÔNG bị khai bỏ qua, nhưng Playwright không trả kết quả nào cho nó (engine
     * chết giữa chừng, project bị lọc mất…). Đọc im lặng thành đạt là đúng cách một lượt chạy hỏng
     * biến thành một bảng đẹp.
     */
    const o = M.dungO(CFG_THU);
    const theoO = new Map([['chromium-desktop@1366x768', new Map([['màn A', 'PASS']])]]);
    const b = M.gomBang({ o, theoO, spec: 'x.spec.ts' });
    expect(b.pass).toBe(1);
    expect(b.fail).toBe(0);
    expect(b.bo, 'ô webkit không có kết quả ⇒ ▢').toBe(1);
  });

  test('báo cáo BẮT BUỘC nói đây là giả lập, và KHÔNG được nói "thiết bị thật"', () => {
    const b = M.gomBang({ o: M.dungO(CFG_THU), theoO: new Map(), spec: 'x.spec.ts' });
    expect(b.md, 'thiếu câu này thì "xanh trên WebKit" sẽ bị đọc thành "chạy được trên iPhone"')
      .toContain('GIẢ LẬP THIẾT BỊ');
    expect(/đã test trên (iPhone|thiết bị) thật/i.test(b.md), 'cấm khai quá').toBe(false);
    expect(b.md, 'phải nêu nhân của từng project').toMatch(/nhân WebKit/);
  });

  test('KHÔNG bắc cầu qua lớp chặn của `smoke_run` — thiếu gốc URL ⇒ chặn, exit 2', () => {
    const r = spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/reuse/smoke_matrix.js'), '--spec', 'x.spec.ts'], {
      cwd: REPO,
      encoding: 'utf8',
      env: { ...gateEnv(), SMOKE_BASE_URL: '', OPS_BASE_URL: '' },
    });
    expect(r.status, 'phải dừng trước khi chạy').toBe(2);
    expect(`${r.stdout}${r.stderr}`).toMatch(/CHẶN TRƯỚC KHI CHẠY/);
  });

  test('config ma trận của repo hợp lệ, và khai rõ nó CHƯA được người duyệt', () => {
    const c = M.napCauHinh(M.CFG_MAC_DINH);
    expect(c.loi, 'config mặc định phải nạp được').toBeUndefined();
    expect(c.project.length).toBeGreaterThanOrEqual(2);

    const raw = JSON.parse(fs.readFileSync(M.CFG_MAC_DINH, 'utf8'));
    expect(String(raw._can_nguoi_duyet), 'danh sách suy từ cấu hình kit, KHÔNG từ số liệu người dùng thật — phải nói ra')
      .toMatch(/KHÔNG suy từ số liệu người dùng/);
    expect(String(raw._opt_in), 'phải khai mặc định TẮT').toMatch(/MẶC ĐỊNH TẮT/);
  });
});

test.describe('@infra smoke:matrix — ĐỐI CHỨNG CHẠY THẬT: vỡ chỉ ở một nhân', () => {
  /*
   * Đây là phép đo duy nhất chứng minh ma trận THẬT SỰ chạy nhiều nhân. Mọi test trên đều kiểm phần gom
   * bảng — gom đúng mà lượt chạy chỉ dùng một engine thì cả tính năng là giả.
   *
   * Spec fixture CỐ Ý vỡ chỉ ở WebKit (`browserName`), và chạy OFFLINE: không mở trang nào, không chạm
   * mạng, nên nó không cần fixture server và không thể vô tình chạm UAT.
   */
  test('một ô vỡ ở WebKit ⇒ đúng ô đó đỏ, nhân khác xanh', async () => {
    const d = thuMucTam('bmx-run');
    try {
      fs.writeFileSync(path.join(d, 'playwright.task.config.js'),
        'module.exports = { testDir: __dirname, timeout: 20000, projects: [] };\n', 'utf8');
      fs.writeFileSync(path.join(d, 'smoke.spec.ts'), [
        "import { test, expect } from '@playwright/test';",
        "test('màn A mở được', ({ browserName }) => {",
        "  expect(browserName, 'cố ý vỡ chỉ ở webkit').not.toBe('webkit');",
        '});',
        '',
      ].join('\n'), 'utf8');
      fs.writeFileSync(path.join(d, 'm.json'), JSON.stringify(CFG_THU), 'utf8');

      const out = path.join(d, 'bang.md');
      const r = spawnSync(process.execPath, [
        path.join(REPO, 'scripts/qa/reuse/smoke_matrix.js'),
        '--spec', path.relative(REPO, path.join(d, 'smoke.spec.ts')).split(path.sep).join('/'),
        '--config', path.join(d, 'm.json'),
        '--out', out,
      ], {
        cwd: REPO,
        encoding: 'utf8',
        env: { ...gateEnv(), SMOKE_BASE_URL: 'http://127.0.0.1:9' },
        timeout: 240000,
      });

      const log = `${r.stdout || ''}${r.stderr || ''}`;
      expect(fs.existsSync(out), `không sinh được bảng. log:\n${log.slice(-800)}`).toBe(true);
      const md = fs.readFileSync(out, 'utf8');
      const dong = md.split('\n').find((l) => l.startsWith('| màn A mở được'))!;
      expect(dong, `không thấy hàng kết quả. bảng:\n${md}`).toBeTruthy();

      const o = dong.split('|').map((x) => x.trim()).filter(Boolean).slice(1);
      expect(o.length, 'hai ô: chromium và webkit').toBe(2);
      expect(o[0], 'chromium phải XANH').toBe('PASS');
      expect(o[1], 'webkit phải ĐỎ — nếu nó cũng xanh thì lượt chạy không thật sự dùng nhân WebKit').toBe('**FAIL**');
      expect(r.status, 'có ô đỏ ⇒ exit 1').toBe(1);
    } finally { donThuMucTam(d); }
  });
});
