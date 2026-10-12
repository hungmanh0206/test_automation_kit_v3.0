import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';
import {
  batBuocKyVong, chuan, expectToast, expectCell, expectPersisted, expectBlocked, assertScreen,
  expectCount, CheckUsageError, BO_KIEM,
} from '../lib/_checks';

/*
 * L4 BỘ KIỂM + LUẬT VÀNG (v2.8.0 §A).
 *
 * Hai điều phải phân biệt, và phân biệt đó là ruột của cả đợt:
 *   · `expect` là PHÉP SO — nó thuộc L4, và CHỈ L4.
 *   · GIÁ TRỊ được so là ORACLE — nó thuộc CASE, lấy từ cột `Kết quả mong đợi` hoặc `oracle_ref`. Nó
 *     không bao giờ được viết sẵn trong code dùng chung.
 *
 * Gói luôn phần kiểm vào bước làm tỉ lệ "dùng lại" nhảy vọt, nhưng lúc đó oracle bị ĐÓNG KHUNG trong
 * code: đặc tả đổi mà case vẫn xanh, vì nó so với chính code đã viết. Đó là `app == app` chuyển từ tầng
 * testcase xuống tầng thư viện, và nó khó thấy hơn nhiều. Prompt đặt đúng chuyện này làm điều kiện DỪNG.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const LINT = path.join(REPO, 'scripts/qa/reuse/steps_lint.js');

test.describe.configure({ mode: 'default' });

test.describe('@infra L4 — giá trị kỳ vọng là BẮT BUỘC, không có mặc định', () => {
  test('`undefined`, `null`, chuỗi rỗng ⇒ NÉM `CheckUsageError`', () => {
    /*
     * Chuỗi rỗng bị từ chối cố ý: ô `Kết quả mong đợi` rỗng là **oracle rỗng**, và `gate:gen-testcase` đã
     * CHẶN nó ở Phase 1. Cho nó đi qua ở đây là mở lại đúng cái lỗ đó ở tầng dưới.
     */
    for (const x of [undefined, null, '', '   ']) {
      expect(() => batBuocKyVong(x, 'thử'), `giá trị ${JSON.stringify(x)} phải bị từ chối`).toThrow(CheckUsageError);
    }
  });

  test('số `0` và `false` là kỳ vọng HỢP LỆ', () => {
    /*
     * Đây là ca mà một bản viết vội `if (!kyVong)` sẽ làm sai, và nó sai IM LẶNG: case kỳ vọng "sĩ số
     * bằng 0" hoặc "ô phải KHÔNG được tích" sẽ không chạy được, rồi có người đổi kỳ vọng cho nó chạy —
     * tức sửa expected để pass, đúng điều non-negotiable §6 cấm.
     */
    expect(batBuocKyVong(0, 'thử')).toBe(0);
    expect(batBuocKyVong(false, 'thử')).toBe(false);
  });

  test('thông điệp lỗi nói ĐƯỢC giá trị phải lấy từ đâu', () => {
    const e = (() => { try { batBuocKyVong(undefined, 'expectToast'); return null; } catch (x) { return x as Error; } })();
    expect(e!.message).toMatch(/Kết quả mong đợi/);
    expect(e!.message).toMatch(/oracle_ref/);
  });

  test('`expectPersisted` đòi hàm ĐỌC LẠI, không tin màn vừa thao tác', async () => {
    /*
     * Không truyền hàm đọc lại thì không có gì để so ngoài chính màn vừa thao tác — `app == app`.
     */
    await expect(expectPersisted(undefined as never, 'x')).rejects.toThrow(/đọc lại|app == app/i);
  });

  test('`assertScreen` TỪ CHỐI mẫu URL khớp mọi thứ', async () => {
    /*
     * `toHaveURL(/./)` khớp mọi url ⇒ khẳng định rỗng. `auto:review` có rule `vacuous-url` bắt đúng loại
     * này ở tầng spec; L4 chặn nó ngay ở tầng API.
     */
    for (const re of [/./, /.*/, /(?:)/]) {
      await expect(assertScreen({} as never, { url: re })).rejects.toThrow(/khẳng định rỗng|vacuous/i);
    }
  });

  test('`expectCount` TỪ CHỐI `itNhat: 0` — "có dữ liệu là đạt"', async () => {
    await expect(expectCount(async () => 5, { itNhat: 0 })).rejects.toThrow(/khẳng định rỗng|vacuous/i);
  });

  test('`expectBlocked` đòi CẢ HAI vế: dấu hiệu chặn VÀ dữ liệu không đổi', async () => {
    /*
     * Vế thứ hai hay bị bỏ, mà nó mới là vế quan trọng: một màn hiện thông báo lỗi mà VẪN ghi dữ liệu là
     * lỗi tệ hơn một màn ghi dữ liệu không thông báo gì.
     *
     * Kit đã suýt log một bug bịa ra từ tình huống không tồn tại vì chỉ kiểm một vế — nên mỗi vế có cờ
     * riêng trong thông điệp.
     */
    await expect(expectBlocked(
      { dauHieuChan: 409, truoc: { a: 1 }, sau: { a: 2 } },
      { dauHieuChan: 409 },
    )).rejects.toThrow(/VẾ 2/);

    await expect(expectBlocked(
      { dauHieuChan: 200, truoc: { a: 1 }, sau: { a: 1 } },
      { dauHieuChan: 409 },
    )).rejects.toThrow(/VẾ 1/);

    await expectBlocked(
      { dauHieuChan: 409, truoc: { a: 1 }, sau: { a: 1 } },
      { dauHieuChan: 409 },
    );
  });
});

test.describe('@infra L4 — chuẩn hoá chuỗi: NFC, KHÔNG bỏ dấu, KHÔNG hạ chữ', () => {
  test('gộp khoảng trắng và NFC, giữ nguyên dấu và chữ hoa', () => {
    /*
     * Một bộ kiểm bỏ dấu sẽ cho qua cả màn hiển thị sai font: "Tên trường là bắt buộc" khác hẳn
     * "ten truong la bat buoc". Sổ tri thức có đúng bài học này — đo UI thì neo cấu trúc, và luôn NFC.
     */
    expect(chuan('  Tên   trường  ')).toBe('Tên trường');
    expect(chuan('Tên trường')).not.toBe('ten truong');
    expect(chuan('ĐÃ DUYỆT')).toBe('ĐÃ DUYỆT');
  });

  test('NFD và NFC của cùng một chuỗi coi là MỘT', () => {
    const nfd = 'Tên';      /* T, e, dấu mũ rời */
    expect(chuan(nfd)).toBe('Tên');
  });
});

test.describe('@infra steps:lint — luật vàng có máy canh', () => {
  const chay = (goc?: string) => spawnSync(process.execPath, [LINT], {
    cwd: goc || REPO, encoding: 'utf8', env: gateEnv(),
  });

  test('thư viện hiện tại: 0 vi phạm', () => {
    const r = chay();
    expect(r.status, `${r.stdout}${r.stderr}`).toBe(0);
    expect(`${r.stdout}`).toMatch(/không chứa oracle/);
  });

  test('ĐỐI CHỨNG: bước chứa `expect(` ⇒ CHẶN', () => {
    /*
     * Không có phép đối chứng này thì "đã có gate canh luật vàng" chỉ là một dòng trong tài liệu.
     *
     * Đặt file tạm vào ĐÚNG cây thật rồi xoá trong `finally`: gate đọc đường dẫn cố định
     * `tests/fe/lib/`, nên chạy trên bản sao sẽ không đo được thứ cần đo.
     */
    const d = path.join(REPO, 'tests/fe/lib/_doi_chung_tam/steps');
    const f = path.join(d, 'xau.ts');
    try {
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(f, [
        "import { expect } from '@playwright/test';",
        'export async function buocXau(x: number) {',
        '  expect(x).toBe(1);',
        '}',
        '',
      ].join('\n'), 'utf8');

      const r = chay();
      expect(r.status, 'bước chứa expect mà gate vẫn xanh').toBe(1);
      const ra = `${r.stdout}${r.stderr}`;
      expect(ra).toMatch(/luật 1/);
      expect(ra, 'phải nói rõ vì sao luật 1 quan trọng nhất').toMatch(/app == app/);
    } finally {
      fs.rmSync(path.join(REPO, 'tests/fe/lib/_doi_chung_tam'), { recursive: true, force: true });
    }
    expect(chay().status, 'dọn xong phải xanh lại').toBe(0);
  });

  test('ĐỐI CHỨNG: bộ kiểm có giá trị kỳ vọng MẶC ĐỊNH ⇒ CHẶN', () => {
    const d = path.join(REPO, 'tests/fe/lib/_doi_chung_tam/checks');
    try {
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, 'xau.ts'), [
        "import { expect } from '@playwright/test';",
        "export async function expectXau(thuc: string, kyVong: string = 'mặc định xấu') {",
        '  expect(thuc).toBe(kyVong);',
        '}',
        '',
      ].join('\n'), 'utf8');

      const r = chay();
      expect(r.status).toBe(1);
      expect(`${r.stdout}${r.stderr}`).toMatch(/luật 2/);
    } finally {
      fs.rmSync(path.join(REPO, 'tests/fe/lib/_doi_chung_tam'), { recursive: true, force: true });
    }
  });

  test('KHÔNG báo oan: phép SO `kyVong === undefined` không phải giá trị mặc định', () => {
    /*
     * Lỗi của chính gate này ở bản đầu: regex `=\s*[^,)]` bắt dấu `=` thứ hai của `===`, nên nó CHẶN
     * đúng dòng đang THỰC THI luật 2 trong `_checks/index.ts`. Gate báo oan chính cái nó canh.
     *
     * Đây là lần thứ năm trong hai đợt một bộ dò bằng chữ của tôi cần nới đúng chỗ, nên nó có test riêng.
     */
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const m = require(LINT);
    const than = m.thanCode("if (kyVong === undefined || kyVong === null) throw new Error('x');");
    const re = /\b(kyVong)\s*(?::[^,)=]+)?\s*(?<![=!<>])=(?![=>])\s*[^,)]/;
    expect(re.test(than), 'phép so bị nhận thành giá trị mặc định').toBe(false);
  });

  test('`_checks/` ĐƯỢC phép chứa `expect` — nếu không thì không ai kiểm được gì', () => {
    const src = fs.readFileSync(path.join(REPO, 'tests/fe/lib/_checks/index.ts'), 'utf8');
    expect(src).toMatch(/\bexpect\s*\(/);
    expect(chay().status, 'gate chặn chính tầng được phép thì cả thư viện vô dụng').toBe(0);
  });

  test('gate KHAI giới hạn của luật 3 thay vì giả vờ đo được', () => {
    /*
     * Luật 3 ("bước không so với giá trị nghiệp vụ hardcode") chỉ bắt được dạng LỘ. Một giá trị gán vào
     * biến rồi mới so thì máy không thấy. Nói thẳng ra thì tốt hơn là để người đọc tưởng đã đo xong —
     * phần còn lại thuộc tầng chấm §A11, mục `ORACLE_DOC_LAP`.
     */
    const src = fs.readFileSync(LINT, 'utf8');
    expect(src).toMatch(/KHÓ ĐO NHẤT|chỉ bắt được dạng/);
    expect(src).toContain('A11');
  });

  test('thư viện RỖNG ⇒ nói "chưa có gì để canh", KHÔNG nói "sạch"', () => {
    /*
     * Một dòng "✓" trên một tập rỗng sẽ được đọc thành "thư viện sạch". Đây là cùng luật với `CHUA_KIEM`
     * của v2.7.0 §A10.1: kiểm 0 thứ thì không được báo ĐẠT.
     */
    const src = fs.readFileSync(LINT, 'utf8');
    expect(src).toMatch(/CHƯA CÓ GÌ ĐỂ CANH/);
    expect(src).toMatch(/không phải "thư viện sạch"/);
  });
});

test.describe('@infra L4 — bộ kiểm chạy thật trên trang tạm', () => {
  test('`expectToast` so NGUYÊN VĂN, không hạ chữ', async ({ page }) => {
    await page.setContent('<div id="t">Tên trường là bắt buộc</div>');
    await expectToast(page.locator('#t'), 'Tên trường là bắt buộc');
    await expect(expectToast(page.locator('#t'), 'ten truong la bat buoc', { timeout: 800 })).rejects.toThrow();
  });

  test('`expectCell` nhận LOCATOR, không nhận chỉ số cột', async ({ page }) => {
    /*
     * Lưới của hệ này có ô TRỐNG ở vị trí đầu làm lệch chỉ số (đã ghi trong sổ tri thức), nên đếm cột
     * theo số là nguồn sai lặng lẽ.
     */
    await page.setContent('<table><tr><td></td><td>HS01</td><td>Nguyễn Văn A</td></tr></table>');
    await expectCell(page.locator('td').nth(1), 'HS01', 'mã học sinh');
  });

  test('`expectPersisted` so qua hàm đọc lại do CASE truyền', async () => {
    await expectPersisted(async () => 'THCS X', 'THCS X', 'tên trường đã lưu');
    await expect(expectPersisted(async () => 'THCS Y', 'THCS X')).rejects.toThrow();
  });

  test('danh sách bộ kiểm được KHAI một chỗ', () => {
    /* `steps:lint` và tài liệu đối chiếu được, thay vì mỗi nơi tự liệt kê. */
    expect([...BO_KIEM]).toContain('expectToast');
    expect([...BO_KIEM]).toContain('expectBlocked');
    expect(BO_KIEM.length).toBeGreaterThanOrEqual(6);
  });
});
