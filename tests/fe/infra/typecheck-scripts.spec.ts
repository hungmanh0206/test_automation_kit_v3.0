import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * HỢP ĐỒNG DỮ LIỆU TESTCASE PHẢI ĐƯỢC KIỂM BẰNG KIỂU (v2.7.0 §A10.2).
 *
 * §A10.2 đòi gate chỉ đọc testcase qua `scripts/lib/testcase`, và đòi một cơ chế để `t.id` (tên trường
 * SAI, đúng phải là `t.tcId`) đỏ ở typecheck. Đo trước khi làm, hai chuyện lộ ra:
 *
 *   · hợp đồng ĐÃ TỒN TẠI đầy đủ ở `scripts/lib/testcase/testcase.d.ts` — nhưng `tsconfig.json` chính
 *     đặt `allowJs: false` và chỉ phủ `tests/**\/*.ts`, nên KHÔNG dòng nào trong `scripts/**.js` từng
 *     được kiểm kiểu, và 0 file có `@ts-check`. Một hợp đồng không được kiểm thì nó là một ghi chú.
 *   · và vì không ai so hai bên, hợp đồng đã TRÔI khỏi model: `oracleRefs`, `tags`, `techniques`,
 *     `caseType` do `parseMarkdown` trả về thật mà `.d.ts` không khai. 10/11 lỗi của lượt bật `checkJs`
 *     đầu tiên là bốn tên trường đó, và `validate.js` — chính file thi hành luật technique và luật neo
 *     oracle — dùng cả bốn.
 *
 * Bộ test này khoá cả hai: hợp đồng phải SẠCH, và nó phải THẬT SỰ CHẶN được tên trường sai.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const CFG = path.join(REPO, 'tsconfig.scripts.json');
const DTS = path.join(REPO, 'scripts/lib/testcase/testcase.d.ts');

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const chayTsc = (args: string[]) => spawnSync(npx, ['tsc', ...args], {
  /*
   * `gateEnv()` dù `tsc` không đọc biến task-scoped: luật của `gate-selftest` là MỌI spec spawn tiến
   * trình con đều phải đi qua nó, và một ngoại lệ "cái này không cần" là chỗ để ngoại lệ thứ hai bám vào.
   */
  cwd: REPO, encoding: 'utf8', env: gateEnv(), shell: process.platform === 'win32', timeout: 5 * 60 * 1000,
});
const demLoi = (out: string) => (out.match(/error TS/g) || []).length;

/**
 * `tsc` CÓ CHẠY XONG hay KHÔNG CHẠY NỔI — hai chuyện khác hẳn, và bản trước gộp làm một.
 *
 * `spawnSync` trả `status === null` khi tiến trình bị giết (hết `timeout`) hoặc không spawn được. Khi
 * đó `stdout` rỗng, nên:
 *   · test "0 lỗi kiểu" trượt ở `expect(r.status).toBe(0)`;
 *   · test đối chứng "`t.id` phải ĐỎ" trượt vì không còn dòng `error TS` nào để đếm.
 *
 * Hai test MÂU THUẪN NHAU cùng đỏ — một cái đòi `tsc` xanh, một cái đòi `tsc` đỏ. Đó là chữ ký của
 * "`tsc` không chạy", không phải của "code sai". Đo 16/10/2026 trong `release:verify`: đúng hai test
 * đó đỏ, trong khi chạy `tsc` thẳng trong chính gói ấy cho exit 0 và cả 6 test xanh.
 *
 * Nên ca đó phải là **KHÔNG PHÁN ĐƯỢC**, không phải FAIL. Cho nó FAIL là đổ lỗi sai chỗ: người đọc đi
 * tìm lỗi kiểu trong code, trong khi vấn đề là máy chạy test đang quá tải.
 *
 * Và KHÔNG được cho nó thành PASS: `release:verify` ĐẾM số bỏ qua rồi in ra, nên một lượt không đo
 * được vẫn để lại dấu vết đọc được.
 */
function khongChayNoi(r: { status: number | null; error?: Error }): boolean {
  return r.status === null || !!r.error;
}

test.describe.configure({ mode: 'default' });
test.setTimeout(5 * 60 * 1000);

test.describe('@infra typecheck:scripts — hợp đồng dữ liệu testcase', () => {
  test('`tsconfig.scripts.json` có mặt, bật checkJs, và KHAI danh sách file mở rộng dần', () => {
    const cfg = JSON.parse(fs.readFileSync(CFG, 'utf8'));
    expect(cfg.compilerOptions.checkJs, 'không bật checkJs thì allowJs chỉ làm tsc đọc file rồi bỏ qua').toBe(true);
    expect(cfg.compilerOptions.allowJs).toBe(true);
    expect(Array.isArray(cfg.include), 'include phải là danh sách KHAI, không phải `scripts/**`').toBe(true);
    /*
     * Vì sao không bật cả `scripts/`: 166 file JS chưa từng được kiểm. Đo 12/10/2026 khi thử thêm 3 gate
     * tiêu thụ (`canonical_drift`, `expected_ledger`, `result_ledger`): 27 lỗi, phần lớn là thiếu JSDoc
     * nội bộ chứ không phải bug. Một bảng đỏ cỡ đó bị bỏ qua chứ không được sửa.
     */
    expect(JSON.stringify(cfg.include)).not.toContain('scripts/**/*.js');
    expect(JSON.stringify(cfg), 'phải ghi lý do include hẹp, để lần sau không ai nghĩ là bỏ sót').toMatch(/MỞ RỘNG DẦN/);
  });

  test('chạy thật `tsc -p tsconfig.scripts.json` ⇒ 0 lỗi', () => {
    const r = chayTsc(['-p', 'tsconfig.scripts.json']);
    test.skip(khongChayNoi(r), '`tsc` KHÔNG CHẠY NỔI (bị giết do hết giờ, hoặc không spawn được) — '
      + 'lượt này không đo được hợp đồng kiểu. Đây KHÔNG phải "0 lỗi", và cũng không phải "có lỗi".');
    const out = `${r.stdout || ''}${r.stderr || ''}`;
    expect(demLoi(out), `còn lỗi kiểu trong hợp đồng:\n${out.slice(0, 1200)}`).toBe(0);
    expect(r.status).toBe(0);
  });

  test('"không chạy nổi" KHÁC "code sai" — luật phân biệt đúng cả hai chiều', () => {
    /*
     * Luật `khongChayNoi` là chỗ dễ biến thành nơi nuốt lỗi nhất: nới một chút là mọi lượt `tsc` đỏ
     * đều thành "bỏ qua", và hợp đồng kiểu mất hiệu lực mà bảng vẫn sạch. Nên khoá cả hai chiều.
     */
    expect(khongChayNoi({ status: null }), 'bị giết / không spawn được ⇒ không phán được').toBe(true);
    expect(khongChayNoi({ status: 0, error: new Error('spawn EAGAIN') }), 'lỗi spawn ⇒ không phán được').toBe(true);

    expect(khongChayNoi({ status: 2 }), '`tsc` CHẠY XONG và báo lỗi kiểu ⇒ là FAIL thật, KHÔNG được bỏ qua').toBe(false);
    expect(khongChayNoi({ status: 1 }), 'exit khác 0 mà chạy xong vẫn là kết quả đo được').toBe(false);
    expect(khongChayNoi({ status: 0 }), 'chạy xong, sạch').toBe(false);
  });

  test('ĐỐI CHỨNG: `t.id` thay vì `t.tcId` phải ĐỎ ở typecheck', () => {
    /*
     * Đây là test duy nhất chứng minh hợp đồng có hiệu lực. Không có nó thì "đã bật checkJs" chỉ là một
     * dòng config: `tsc` vẫn xanh nếu kiểu hoá ra là `any`, và `any` thì nhận mọi tên trường.
     */
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tscontract-'));
    const mod = path.join(REPO, 'scripts/lib/testcase').replace(/\\/g, '/');
    const viet = (truong: string) => {
      const f = path.join(d, `${truong}.js`);
      fs.writeFileSync(f, [
        '// @ts-check',
        `const c = require('${mod}');`,
        "const doc = c.parseMarkdown('x');",
        `for (const t of doc.tests) console.log(t.${truong});`,
        '',
      ].join('\n'), 'utf8');
      return f;
    };

    const co = ['--ignoreConfig', '--allowJs', '--checkJs', '--noEmit', '--skipLibCheck',
      '--resolveJsonModule', '--strict', 'false', '--target', 'ES2022',
      '--module', 'Node16', '--moduleResolution', 'Node16'];

    const sai = chayTsc([...co, viet('id')]);
    test.skip(khongChayNoi(sai), '`tsc` KHÔNG CHẠY NỔI ở lượt ca BẨN — không đo được đối chứng. '
      + 'Không được đọc thành "hợp đồng vô hiệu": hợp đồng chưa được thử, khác hẳn đã thử và trượt.');
    const raSai = `${sai.stdout || ''}${sai.stderr || ''}`;
    expect(raSai, 'tên trường sai phải bị gọi tên, không chỉ đỏ chung').toContain("Property 'id' does not exist on type 'TestCase'");

    const dung = chayTsc([...co, viet('tcId')]);
    test.skip(khongChayNoi(dung), '`tsc` KHÔNG CHẠY NỔI ở lượt ca SẠCH — không đo được đối chứng.');
    const raDung = `${dung.stdout || ''}${dung.stderr || ''}`;
    expect(raDung, 'tên trường ĐÚNG không được đỏ — nếu đỏ thì hợp đồng vô dụng vì ai cũng phải lách').not.toContain('does not exist on type');

    fs.rmSync(d, { recursive: true, force: true });
  });

  test('bốn trường từng bị khai thiếu nay CÓ trong hợp đồng', () => {
    const dts = fs.readFileSync(DTS, 'utf8');
    for (const k of ['oracleRefs', 'tags', 'techniques', 'caseType']) {
      expect(dts, `hợp đồng vẫn thiếu \`${k}\``).toContain(`${k}:`);
    }
  });

  test('`tags` khai là CHUỖI, không phải mảng — và lý do được ghi lại', () => {
    /*
     * Lỗi của chính tôi trong lượt này, giữ lại vì nó dễ tái phát: tôi suy từ cái tên và khai
     * `tags: string[]`, rồi `validate.js:262` (`(t.tags || '').toLowerCase()`) đỏ, và tôi suýt báo đó là
     * bug sản phẩm. Ở runtime `tags` là nguyên văn `"[Positive][BR-X-001][EP]"`; `oracleRefs` và
     * `techniques` mới là bản đã tách của cùng chuỗi đó.
     */
    const dts = fs.readFileSync(DTS, 'utf8');
    expect(dts).toMatch(/tags:\s*string;/);
    expect(dts).not.toMatch(/tags:\s*string\[\]/);
    expect(dts, 'phải ghi vì sao giữ dạng chuỗi, không thì lần sau có người "sửa cho đẹp"').toContain('CHUỖI THÔ');
  });

  test('model trả về ĐÚNG kiểu đã khai — đo ở runtime, không chỉ ở kiểu', () => {
    /*
     * Kiểu và runtime là hai nguồn, và lệch nhau được. Test này so hai bên trên một bộ thật nhỏ, nên một
     * lần đổi `tags` thành mảng (hoặc ngược lại) sẽ đỏ ở đây chứ không đỏ sáu tháng sau ở một gate khác.
     */
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const c = require(path.join(REPO, 'scripts/lib/testcase'));
    const md = [
      '| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |',
      '|---|---|---|---|---|---|---|---|---|---|',
      '| A_TC_001 | Functional | [Positive][BR-X-001][EP] | M | T | [ui] x | n/a | 1. a | 1. b | Medium |',
    ].join('\n');
    const t = c.parseMarkdown(md).tests[0];
    expect(typeof t.tags).toBe('string');
    expect(Array.isArray(t.oracleRefs)).toBe(true);
    expect(Array.isArray(t.techniques)).toBe(true);
    expect(typeof t.caseType).toBe('string');
    expect(t.oracleRefs).toEqual(['BR-X-001']);
  });
});
