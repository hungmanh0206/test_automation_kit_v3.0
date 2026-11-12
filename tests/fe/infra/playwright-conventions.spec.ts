import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * @infra — QUY ƯỚC PLAYWRIGHT (v2.5.0 G1.5): quy ước không có máy gác thì sau vài sprint không còn ai theo.
 *
 * PHÉP ĐO ĐÃ THU HẸP HẠNG MỤC NÀY ĐÁNG KỂ. Kế hoạch G1.5 liệt kê 7 quy ước "đo được" để giao cho
 * `auto:review`. Đo lại trên repo trước khi viết:
 *   · `test.skip()` thiếu lý do — **0 ca**;
 *   · tên test chỉ là mã TC trần — **0 ca**;
 *   · `test.only` lọt — đã có `ci:scope` gác từ trước;
 *   · selector dễ vỡ không ghi chú — đã có `lint:locator` gác (marker bắt buộc có lý do);
 *   · "chuẩn hoá khoảng trắng trước khi so text" — KHÔNG đo được bằng tĩnh mà không đoán, nên nó ở lại
 *     dạng quy ước kèm lý do, không dựng gate giả.
 * Còn đúng MỘT quy ước vừa đo được vừa chưa có máy: spec gọi `page.locator` trực tiếp.
 *
 * PHÉP KIỂM CHỐNG TRÔI quan trọng nhất ở đây không phải một luật lint mới, mà là: **mọi câu "⚙️ Máy:
 * `npm run X`" trong tài liệu phải trỏ tới lệnh CÓ THẬT.** Tài liệu hứa có máy gác mà lệnh không tồn tại
 * thì người đọc tin là đã được gác — cùng lớp lỗi với "hai tài liệu dạy sai số cột" ở G4.1.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const DOC = path.join(REPO, '.agent/rules/playwright_fe.md');
const AR = path.join(REPO, 'scripts/qa/automation_review.js');

test.describe('@infra spec CHƯA TRACK không được lọt vào lane mặc định', () => {
  /*
   * LỚP LỖI NÀY ĐÃ XẢY RA HAI LẦN, lần thứ hai bắt được ngày 26/10/2026.
   *
   * Lần một (`6773d1e`, ghi trong `.gitignore`): 46 spec của một task bị track nhầm ⇒ nightly
   * `npx playwright test` lúc 01:00 drive OPS UAT (`student_delete*`, `calendar_destructive`) hằng đêm
   * mà không ai xác nhận.
   *
   * Lần hai: `appmau-phuongxa.chandoan.spec.ts` — spec khám phá CHƯA TRACK, có `page.goto(OPS_LOGIN_URL)`.
   * Lưới chắn của kit là `testIgnore: '**\/*.probe.spec.*'`, tức nó lọc theo TÊN FILE. File này đặt tên
   * `.chandoan.spec.ts` nên đi thẳng qua lưới, và lane mặc định gom nó như một spec hạ tầng bình thường.
   * Trên máy đang chạy task (có creds trong env) nó sẽ chạm UAT trong một lượt `npm run test:fe` thường.
   *
   * Lưới theo TÊN chỉ giữ được nếu có máy canh cái TÊN. Đây là máy đó.
   */
  /** Thư mục mà mọi lane đều bỏ qua — xem `desktopIgnore` trong `playwright.config.js`. */
  const THU_MUC_BO_QUA = /[\\/](support|load|mobile-web)[\\/]/i;

  test('mọi spec chưa track dưới `tests/` phải đặt tên `*.probe.spec.*` hoặc nằm trong thư mục lane bỏ qua', () => {
    const r = spawnSync('git', ['ls-files', '--others', '--exclude-standard', 'tests'], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    test.skip(r.status !== 0, 'không phải repo git (gói phát hành) — không biết file nào chưa track');

    const lot = String(r.stdout).split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
      .filter((f) => /\.spec\.(ts|js|mjs)$/.test(f))
      .filter((f) => !THU_MUC_BO_QUA.test(f))
      .filter((f) => !/\.probe\.spec\.(ts|js|mjs)$/.test(f));

    expect(lot, `spec chưa track mà lane mặc định VẪN GOM — đổi tên thành \`*.probe.spec.ts\`, `
      + `hoặc commit nó nếu nó thuộc suite dùng chung:\n  - ${lot.join('\n  - ')}`).toEqual([]);
  });

  test('ĐỐI CHỨNG: chính máy này phải bắt được một file đặt tên sai', () => {
    /* Không có phép âm bản thì "0 file lọt" không phân biệt được với "bộ lọc hỏng". */
    const gia = ['tests/fe/infra/vi-du.chandoan.spec.ts', 'tests/fe/vi-du.probe.spec.ts', 'tests/support/setup/db/x.spec.ts'];
    const loc = (ds: string[]) => ds
      .filter((f) => /\.spec\.(ts|js|mjs)$/.test(f))
      .filter((f) => !THU_MUC_BO_QUA.test(f))
      .filter((f) => !/\.probe\.spec\.(ts|js|mjs)$/.test(f));
    expect(loc(gia), 'chỉ file đặt tên sai mới được coi là lọt').toEqual(['tests/fe/infra/vi-du.chandoan.spec.ts']);
  });
});

test.describe('@infra quy ước Playwright — tài liệu không được hứa máy gác không có', () => {
  test('mọi `npm run X` nhắc trong tài liệu đều là script CÓ THẬT', () => {
    const doc = fs.readFileSync(DOC, 'utf8');
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
    const co = new Set(Object.keys(pkg.scripts || {}));
    /*
     * Kit viết tên script dạng `` `auto:review` ``, không dạng `npm run auto:review` — bản đầu của phép
     * quét này chỉ tìm `npm run …` nên nó thấy 0 lệnh và báo oan "tài liệu không trỏ tới máy nào".
     * Neo vào HÌNH DẠNG tên script của kit (có dấu hai chấm) thay vì vào một cách viết.
     */
    const nhac = [...doc.matchAll(/`([a-z][a-z0-9_-]*:[a-z0-9:_-]+)/g)].map((m) => m[1]);
    expect(nhac.length, 'tài liệu phải thật sự trỏ tới máy, không chỉ dặn suông').toBeGreaterThan(3);
    const thieu = [...new Set(nhac)].filter((s) => !co.has(s));
    expect(thieu, 'tài liệu hứa có máy gác mà lệnh không tồn tại ⇒ người đọc tin là đã được gác').toEqual([]);
  });

  test('mọi rule id nhắc trong tài liệu đều có trong `auto:review`', () => {
    /* Cùng lý do: nhắc tên một rule không tồn tại thì người đọc đi tìm và mất lòng tin cả trang. */
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { RULES } = require('../../../scripts/qa/automation_review.js');
    const co = new Set(RULES.map((r: { id: string }) => r.id));
    const doc = fs.readFileSync(DOC, 'utf8');
    const nhac = [...doc.matchAll(/rule `([a-z-]+)`/g)].map((m) => m[1]);
    expect(nhac.length).toBeGreaterThan(0);
    expect(nhac.filter((x) => !co.has(x)), 'rule nhắc trong tài liệu phải có thật').toEqual([]);
  });

  test('phần BỎ của G1.5 đã thật sự bỏ', () => {
    const doc = fs.readFileSync(DOC, 'utf8');
    /* Viewport riêng cho Playwright MCP: bỏ, và v2.6.0 còn cấm dùng MCP để bò UI. */
    expect(doc, 'không còn dặn resize cho Playwright MCP').not.toMatch(/Playwright MCP, resize/);
    /* Allure: không bắt buộc reporter ngoài nào. */
    expect(doc).toMatch(/Không bắt buộc Allure/);
  });

  test('giới hạn phạm vi được NÓI THẲNG: chỉ Playwright, mobile chỉ mobile-web', () => {
    /*
     * Nói ra chỗ này rẻ hơn nhiều so với để người dùng tự phát hiện sau khi đã dựng xong profile và viết
     * xong một nửa bộ case.
     */
    const doc = fs.readFileSync(DOC, 'utf8');
    expect(doc).toMatch(/chỉ dành cho \*\*Playwright\*\*/);
    expect(doc).toMatch(/mobile-web/);
    expect(doc, 'phải nói rõ là KHÔNG có Selenium/Appium, không để người đọc tự suy').toMatch(/Không có Selenium/);
  });

  test('quy ước nào KHÔNG đo được thì ghi lý do, không dựng gate giả', () => {
    /*
     * "Chuẩn hoá khoảng trắng trước khi so text" là quy ước thật và có lý do thật (dấu tiếng Việt tổ hợp
     * khác cách cho hai chuỗi hiển thị y hệt mà khác byte). Nhưng phát hiện nó bằng phân tích tĩnh thì
     * phải đoán "chuỗi này đến từ app hay từ spec", nên kit KHÔNG dựng gate cho nó.
     */
    const doc = fs.readFileSync(DOC, 'utf8');
    expect(doc).toMatch(/normalize\('NFC'\)/);
    expect(doc, 'phải nói VÌ SAO cần chuẩn hoá, không chỉ ra lệnh').toMatch(/khác nhau về byte/);
  });
});

test.describe('@infra auto:review — rule `spec-page-locator`', () => {
  function chay(files: Record<string, string>, argv: string[]) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pwconv-'));
    for (const [rel, body] of Object.entries(files)) {
      const p = path.join(d, rel);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, body, 'utf8');
    }
    fs.mkdirSync(path.join(d, '.agent/config'), { recursive: true });
    fs.writeFileSync(path.join(d, '.agent/config/auto_review.json'), JSON.stringify({ hardSleepDebt: {} }), 'utf8');
    const r = spawnSync(process.execPath, [AR, '--repo', d, ...argv], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}`, d };
  }

  const SPEC = "import { test, expect } from '@playwright/test';\ntest('x', async ({ page }) => {\n  await expect(page.locator('#a')).toBeVisible();\n});\n";

  test('bắt ở tầng TASK, KHÔNG bắt ở suite dùng chung', () => {
    /*
     * Vì sao `taskOnly`: đo được ở suite dùng chung chỉ ~6 lượt `page.locator`, và cả 6 nằm trong spec có
     * việc kiểm CHÍNH bộ locator (`safe-target`, `screen-snapshot`, `geometry`). Gắn cờ chúng là sai —
     * spec kiểm bộ locator thì phải gọi locator.
     */
    const r1 = chay({ 'tests/a.spec.ts': SPEC }, ['--include-tasks']);
    expect(r1.out, 'suite dùng chung KHÔNG bị bắt').not.toContain('spec-page-locator');
    fs.rmSync(r1.d, { recursive: true, force: true });

    const r2 = chay({ 'outputs/P/tasks/T/automation/b.spec.ts': SPEC }, ['--include-tasks']);
    expect(r2.out, 'tầng task thì bắt').toContain('spec-page-locator');
    fs.rmSync(r2.d, { recursive: true, force: true });
  });

  test('chỉ bắt trong `*.spec.ts` — helper của task thì KHÔNG', () => {
    const r = chay({ 'outputs/P/tasks/T/automation/helper.ts': SPEC }, ['--include-tasks']);
    expect(r.out, 'helper được phép giữ locator, đó chính là chỗ nó nên nằm').not.toContain('spec-page-locator');
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('là P1 và KHÔNG chặn — 1381 dòng không phải 1381 lỗi', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { RULES } = require('../../../scripts/qa/automation_review.js');
    const r = RULES.find((x: { id: string }) => x.id === 'spec-page-locator');
    expect(r, 'rule phải tồn tại').toBeTruthy();
    expect(r.sev, 'P0 ở đây sẽ chặn 254/354 spec ngay ngày đầu, và gate sẽ bị tắt').toBe('P1');
    const z = chay({ 'outputs/P/tasks/T/automation/b.spec.ts': SPEC }, ['--include-tasks', '--enforce']);
    expect(z.code, 'P1 ở tầng task thì không được chặn').toBe(0);
    fs.rmSync(z.d, { recursive: true, force: true });
  });

  test('KHÔNG hiện khi chưa `--include-tasks` — nợ cũ không làm ngập báo cáo thường', () => {
    const r = spawnSync(process.execPath, [AR], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    expect(`${r.stdout}${r.stderr}`).not.toContain('spec-page-locator');
  });

  test('số đo trong rule là ẢNH CHỤP có niên đại, và detector còn sống', () => {
    /*
     * BẢN TRƯỚC TỰ MÂU THUẪN, sửa 26/10/2026.
     *
     * Nó so con số trong `why` với số gate đếm được, sai lệch cho phép ±10%. Nhưng chính `why` của rule
     * viết: "Con số này đi theo `outputs/**` nên nó TRÔI khi task chạy". Tức máy canh đang đòi một con
     * số bất biến từ một mẫu số mà tài liệu đã khai là biến thiên.
     *
     * Đo 26/10/2026: rule khai 1.522 lượt trên 402 spec theo task (15/10); máy này giờ có 594 spec và
     * gate đếm 2.243. Không có gì hỏng cả — chỉ là người dùng đã chạy thêm task. Gate đỏ vì công việc
     * diễn ra bình thường, và nó đỏ KHÁC NHAU trên mỗi máy, tức kết quả phụ thuộc môi trường chạy.
     *
     * Thứ còn đáng canh, và canh được:
     *   1. số liệu phải có NIÊN ĐẠI và MẪU SỐ — một con số trần không ai kiểm lại được;
     *   2. `why` phải nói thẳng nó trôi, để lần sau không ai dựng lại phép so bằng;
     *   3. detector phải CÒN SỐNG — rule đếm 0 ở nơi có spec theo task nghĩa là nó đã chết âm thầm.
     */
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { RULES } = require('../../../scripts/qa/automation_review.js');
    const why = String(RULES.find((x: { id: string }) => x.id === 'spec-page-locator').why);

    expect(why, 'số đo phải kèm NGÀY đo — số trần thì không ai kiểm lại được').toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    expect(why, 'số đo phải kèm MẪU SỐ (bao nhiêu lượt trên bao nhiêu spec)').toMatch(/\d+ lượt ở tổng \d+ spec/);
    expect(why, 'phải khai rõ con số này TRÔI, nếu không lần sau lại có người neo cứng nó')
      .toMatch(/trôi|thay đổi theo/i);

    const r = spawnSync(process.execPath, [AR, '--include-tasks'], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    const out = `${r.stdout}${r.stderr}`;
    const coTask = /theo tầng:.*task (\d+)/.exec(out);
    test.skip(!coTask || Number(coTask[1]) === 0, 'máy này không có spec theo task (lớp PROJECT) — không có gì để detector bắt');

    const m = /P1\s+(\d+)\s+spec-page-locator/.exec(out);
    expect(m, 'có spec theo task mà rule đếm 0 ⇒ detector đã chết âm thầm').not.toBeNull();
    expect(Number(m![1]), 'detector phải đếm được ít nhất một lượt').toBeGreaterThan(0);
  });
});

/*
 * TRẦN `workers` CỤC BỘ (v2.9.7) — trần thời gian của test là TUYỆT ĐỐI, số worker thì KHÔNG.
 *
 * `workers: undefined` để Playwright lấy `cores/2`. Nghe như tự thích nghi, nhưng nó biến mức đặt-quá-tải
 * thành hàm của số lõi: mỗi worker mở một browser, và đo 01/11/2026 thì một `chrome-headless-shell` chiếm
 * 3–4 tiến trình. 12 lõi ⇒ 6 worker ⇒ ~24 tiến trình; 32 lõi ⇒ 16 worker ⇒ ~64. Trong khi trần của
 * `discovery-crawl` là 250ms/400ms mỗi khối · 8s mỗi trang · 15s mỗi `page.goto` · 3 phút mỗi file — toàn
 * số tuyệt đối. Nên MÁY NHIỀU LÕI HƠN KHÔNG AN TOÀN HƠN, và đúng cú treo `page.goto` của v2.9.6 sinh ra ở
 * vùng đó.
 *
 * Trần 6 có cơ sở là phép đo: đó là cấu hình `full:suite` đã chạy 2384 xanh · 0 đỏ nhiều lượt. Trên 6 là
 * vùng CHƯA ĐO — không có máy nhiều lõi hơn để đo.
 *
 * Phép kiểm này giả lập số lõi bằng cách nạp config trong tiến trình con có `os.cpus` bị thay, vì đọc
 * `workers` trên chính máy đang chạy chỉ đo được ĐÚNG máy này — và trên máy này trần không đổi gì (6).
 * Một phép kiểm không phân biệt được hai nhánh thì nó không kiểm gì.
 */
test.describe('@infra playwright.config — `workers` cục bộ phải có TRẦN', () => {
  const doc = (soLoi: number, env: Record<string, string> = {}) => {
    const js = `const os = require('os');`
      + `os.cpus = () => new Array(${soLoi}).fill({ model: 'gia-lap', speed: 1, times: {} });`
      + `const c = require(${JSON.stringify(path.join(REPO, 'playwright.config.js'))});`
      + `process.stdout.write(String((c.default || c).workers));`;
    const r = spawnSync(process.execPath, ['-e', js], {
      cwd: REPO, encoding: 'utf8', env: { ...gateEnv(), ...env },
    });
    const n = Number(String(r.stdout).trim());
    expect(Number.isFinite(n), `không đọc được workers (stdout="${r.stdout}" stderr="${r.stderr}")`).toBe(true);
    return n;
  };

  test('ĐỐI CHỨNG DƯƠNG: máy 32 lõi KHÔNG được ra 16 worker', () => {
    expect(doc(32), 'cores/2 = 16, trần phải kéo về 6').toBe(6);
    expect(doc(64), 'và trần không được nhượng theo số lõi').toBe(6);
  });

  test('ĐỐI CHỨNG ÂM: máy ít lõi vẫn theo cores/2, trần không can thiệp', () => {
    expect(doc(4), 'cores/2 = 2, dưới trần ⇒ giữ nguyên').toBe(2);
    expect(doc(12), 'cores/2 = 6, đúng trần ⇒ giữ nguyên, máy này không bị đổi hành vi').toBe(6);
  });

  test('máy 1 lõi vẫn phải ra ít nhất 1 worker, không ra 0', () => {
    expect(doc(1), 'floor(1/2) = 0 ⇒ phải được kéo lên 1, nếu không thì không chạy được gì').toBe(1);
  });

  test('`PW_WORKERS` vượt trần được, vì người đo được thì phải đổi được', () => {
    expect(doc(12, { PW_WORKERS: '10' })).toBe(10);
    expect(doc(32, { PW_WORKERS: '2' })).toBe(2);
  });

  test('CI vẫn cố định 2 worker — trần cục bộ KHÔNG được chạm vào nhánh CI', () => {
    expect(doc(32, { CI: 'true' }), 'runner 4 vCPU đã chốt 2 từ trước').toBe(2);
  });
});
