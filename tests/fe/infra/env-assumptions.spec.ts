/**
 * env-assumptions — gác cửa `lint:env`.
 *
 * Cửa ấy sinh ra từ BỐN sự cố trong MỘT phiên (09/11/2026), tất cả cùng một hình: một phép kiểm XANH
 * ở nơi nó chạy và ĐỎ ở nơi nó không chạy. Khi đó câu "test này xanh nghĩa là code đúng" trở thành
 * SAI mà không ai biết.
 *
 * Spec này dựng CÂY RIÊNG trong thư mục tạm, không neo vào file của repo — cùng lý do khối ⑦/⑨ của
 * `version-changelog.spec.ts`: phép kiểm về một CƠ CHẾ phải tự dựng đầu vào, có thế nó mới đúng ở cả
 * repo lẫn trong gói, và mới kiểm được những ca repo thật (may mắn) không có.
 *
 * Mỗi luật có ĐỦ CẶP: một ca phá thật làm cửa đỏ, và một ca dạng-đã-vá phải xanh. Thiếu vế sau thì
 * "cửa đỏ" không phân biệt được "bắt đúng" với "đỏ mọi thứ".
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const CUA = path.join(REPO, 'scripts', 'qa', 'env_assumptions.js');

/** Cây tạm chỉ chứa các file cần cho lượt đo. */
function cay(files: Record<string, string>): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'envgd-'));
  for (const [ten, noi] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(d, ten)), { recursive: true });
    fs.writeFileSync(path.join(d, ten), noi, 'utf8');
  }
  return d;
}

function chay(goc: string) {
  const r = spawnSync(process.execPath, [CUA, '--goc', goc], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

const don = (noiDung: string) => `  test('x', () => {\n    ${noiDung}\n  });\n`;

test.describe('@infra lint:env ① biến môi trường đúng chữ hoa', () => {
  test('PHÁ: `ra.PATH` trên một bản sao env ⇒ ĐỎ, gọi đúng tên biến', () => {
    const d = cay({ 'tests/fe/infra/a.spec.ts': don("expect(ra.PATH, 'x').toBeTruthy();") });
    const r = chay(d);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('ra.PATH');
    expect(r.out, 'phải nói vì sao, không chỉ nói sai').toContain('PowerShell');
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG: `process.env.PATH` KHÔNG bị bắt — nó tra không phân biệt hoa thường', () => {
    /*
     * Thiếu ca này thì luật ① chỉ là "cấm chữ PATH", và nó sẽ bắt nhầm mọi chỗ dùng đúng. Khác biệt
     * giữa hai ca chỉ là tiền tố `process.env` — đúng chỗ ranh giới nằm.
     */
    const d = cay({ 'tests/fe/infra/a.spec.ts': don("const p = process.env.PATH || '';") });
    const r = chay(d);
    expect(r.code, r.out).toBe(0);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG: dạng ĐÃ VÁ (lọc khoá không phân biệt hoa thường) ⇒ XANH', () => {
    const d = cay({
      'tests/fe/infra/a.spec.ts': don("const k = Object.keys(ra).filter((x) => /^path$/i.test(x));"),
    });
    const r = chay(d);
    expect(r.code, r.out).toBe(0);
    fs.rmSync(d, { recursive: true, force: true });
  });
});

test.describe('@infra lint:env ② `node --test` nhận thư mục', () => {
  const pkg = (lenh: string) => JSON.stringify({ name: 'x', version: '1.0.0', scripts: { 'extension:test': lenh } }, null, 2);

  test('PHÁ: truyền THƯ MỤC ⇒ ĐỎ, nêu đích danh đường dẫn', () => {
    const d = cay({ 'package.json': pkg('node --test tests/unit/') });
    const r = chay(d);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('--test tests/unit/');
    expect(r.out, 'phải nhắc mốc Node đang ghim').toContain('22');
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG: liệt kê TỪNG FILE ⇒ XANH', () => {
    const d = cay({ 'package.json': pkg('node --test tests/unit/a.test.js tests/unit/b.test.js') });
    const r = chay(d);
    expect(r.code, r.out).toBe(0);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG: chữ "node --test" trong VĂN XUÔI KHÔNG bị tính là lệnh', () => {
    /*
     * Lượt đầu của luật ② soi MỌI chuỗi `--test` và bắt nhầm 2 chỗ: một TIÊU ĐỀ test có câu "chạy bằng
     * node --test", và chính THÔNG BÁO LỖI của cửa. Khớp chuỗi ở bất kỳ đâu thì đo được CÁCH HÀNH VĂN,
     * không đo được LỆNH — đúng bài học bộ chấm A/B lượt 3. Mất ca này là luật ② lặng lẽ quay về dạng cũ.
     */
    const d = cay({
      'tests/fe/infra/a.spec.ts': "test.describe('chạy bằng node --test tests/unit/, KHÔNG bằng Playwright', () => {});\n",
    });
    const r = chay(d);
    expect(r.code, r.out).toBe(0);
    fs.rmSync(d, { recursive: true, force: true });
  });
});

test.describe('@infra lint:env ③ băm byte thô file văn bản', () => {
  test('PHÁ: băm `readFileSync` mà không chuẩn hoá xuống dòng ⇒ ĐỎ', () => {
    const d = cay({
      'scripts/qa/g.js': "const h = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');\n",
    });
    const r = chay(d);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('băm trực tiếp nội dung file');
    expect(r.out, 'phải nói tới autocrlf, không chỉ nói sai').toContain('autocrlf');
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG: có chuẩn hoá CR lẻ ⇒ XANH', () => {
    const d = cay({
      'scripts/qa/g.js': 'const t = Buffer.from(raw.toString("utf8").replace(/\\r\\n?/g, "\\n"), "utf8");\n'
        + "const h = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');\n",
    });
    const r = chay(d);
    expect(r.code, r.out).toBe(0);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('③ KHÔNG soi spec — fixture tự ghi rồi tự băm là ĐÚNG', () => {
    /*
     * `deps-check.spec.ts` ghi ra một `.tgz` trong thư mục tạm rồi băm sha512 chính nó để dựng
     * `package-lock.json` giả — đó là cách npm làm, băm thô ở đó KHÔNG sai. Lượt đầu quét cả spec và
     * bắt nhầm đúng ca ấy.
     */
    const d = cay({
      'tests/fe/infra/a.spec.ts': "const b = createHash('sha512').update(fs.readFileSync(p)).digest('base64');\n",
    });
    const r = chay(d);
    expect(r.code, r.out).toBe(0);
    fs.rmSync(d, { recursive: true, force: true });
  });
});

test.describe('@infra lint:env — lối thoát và điều KHÔNG phán được', () => {
  test('`env-ok:` KÈM LÝ DO thì tha; `env-ok:` TRỐNG thì KHÔNG', () => {
    /*
     * Lối thoát không có lý do là cái công tắc tắt cửa. Hai cây chỉ khác nhau ở phần chữ sau `env-ok:`,
     * nên nếu cả hai cùng xanh thì lối thoát đang nhận MỌI thứ.
     */
    const coLyDo = cay({
      'scripts/qa/g.js': '/* env-ok: chỉ băm ảnh và .tgz, chuẩn hoá utf8 sẽ phá nát byte */\n'
        + "const h = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');\n",
    });
    const trong = cay({
      'scripts/qa/g.js': '/* env-ok: */\n'
        + "const h = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');\n",
    });
    expect(chay(coLyDo).code, 'khai lý do thì được tha').toBe(0);
    expect(chay(trong).code, '`env-ok:` TRỐNG mà vẫn tha ⇒ lối thoát thành công tắc tắt cửa').toBe(1);
    fs.rmSync(coLyDo, { recursive: true, force: true });
    fs.rmSync(trong, { recursive: true, force: true });
  });

  test('④ phải khai KHÔNG PHÁN ĐƯỢC — không im lặng cho qua', () => {
    /*
     * Lớp "spec hạ tầng đọc file không đi theo gói" đã lặp BỐN lần và vẫn chưa có lint nào quyết được
     * (lượt thử cho 3/3 dương tính giả: cả ba là khoá của một cây tự dựng, không phải file repo được
     * đọc). Cửa phải NÓI RA điều đó. Một cửa im lặng về thứ nó không đo được thì người đọc sẽ tưởng
     * đã đo — cùng doctrine ⑦/⑨/⑩ của `version:check`.
     */
    const d = cay({ 'package.json': '{"name":"x","version":"1.0.0","scripts":{}}' });
    const r = chay(d);
    expect(r.out).toMatch(/④[^\n]*KHÔNG PHÁN ĐƯỢC/);
    expect(r.out, 'và phải chỉ ra cơ chế nào mới phán được').toContain('release:verify');
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG CÂY RỖNG: không có gì để quét thì KHÔNG được báo như đã quét', () => {
    const d = cay({ 'README.md': '# x\n' });
    const r = chay(d);
    expect(r.out).toMatch(/quét 0 spec hạ tầng \+ 0 script cửa/);
    fs.rmSync(d, { recursive: true, force: true });
  });
});

test.describe('@infra lint:env — CÂY NÀY', () => {
  test('repo hiện tại: 0 khẳng định phụ thuộc môi trường', () => {
    /*
     * Phép kiểm về TRẠNG THÁI, khác mọi ca trên (về CƠ CHẾ). Nó là lý do cửa này đáng nằm trong
     * static-check: ba sự cố 09/11 đều sẽ bị bắt NGAY khi vừa viết ra, thay vì chờ tới lượt CI trên
     * một nền khác, hoặc tới lượt phát hành.
     */
    const r = chay(REPO);
    expect(r.code, r.out).toBe(0);
    expect(r.out, 'phải nói ra đã quét bao nhiêu — "đạt" trên 0 file không phải đạt')
      .toMatch(/quét (\d+) spec hạ tầng \+ (\d+) script cửa/);
    const m = r.out.match(/quét (\d+) spec hạ tầng \+ (\d+) script cửa/);
    expect(Number(m![1]), 'quét 0 spec ⇒ ca này RỖNG').toBeGreaterThan(50);
    expect(Number(m![2]), 'quét 0 script cửa ⇒ ca này RỖNG').toBeGreaterThan(50);
  });
});
