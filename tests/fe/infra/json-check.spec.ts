import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/*
 * `json:check` — KHOÁ TRÙNG trong một object JSON.
 *
 * `JSON.parse` KHÔNG báo lỗi khi một object có hai khoá cùng tên: nó lấy khoá SAU và bỏ khoá TRƯỚC. Nên
 * một khoá trùng trong `package.json` THAY NGẦM ĐƯỢC LỆNH của một gate, và cả hai CI vẫn xanh vì chúng
 * chỉ gọi `npm run <tên>`.
 *
 * Chuyện này đã xảy ra THẬT khi dựng `gate:code-pair` (v2.7.0 §A10.3): prompt đặt tên lệnh là
 * `gate:policy`, mà tên đó đã thuộc `policy_source_check.js` — máy gác luật một-nguồn. Thêm key trùng
 * xong, bước CI "Policy 1-nguồn" lặng lẽ chuyển sang chạy máy khác. Phép đối chứng ngày 12/10/2026: chèn
 * một `"ci:scope"` thứ hai thì `npm run ci:scope` chạy `echo`, còn `json:check` báo "✓ 49 file đều parse
 * được". Không máy nào bắt, và nó chỉ lộ ra vì tôi tình cờ đọc file CI.
 *
 * Bộ test này khoá bộ quét văn bản, và nặng về phía KHÔNG ĐƯỢC BÁO OAN: một bộ quét báo oan sẽ bị ai đó
 * tắt đi, và lúc đó lỗ mở lại.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const jc = require(path.join(REPO, 'scripts/qa/json_check.js'));

test.describe.configure({ mode: 'default' });

test.describe('@infra json:check — khoá trùng mà `JSON.parse` bỏ qua', () => {
  test('hai khoá cùng tên trong CÙNG object ⇒ bắt được', () => {
    expect(jc.khoaTrung('{"a":1,"a":2}')).toEqual(['a']);
    expect(jc.khoaTrung('{"x":{"c":1,"c":2}}')).toEqual(['c']);
  });

  test('cùng tên nhưng KHÁC object ⇒ KHÔNG phải trùng', () => {
    /*
     * Đây là ca dễ báo oan nhất, và nó phổ biến: `.agent/config/**` đầy object lặp cùng hình dạng
     * (`{"code": …}` trong một mảng). Báo oan ở đây thì máy thành vô dụng ngay lượt đầu.
     */
    expect(jc.khoaTrung('{"a":1,"b":{"a":2}}')).toEqual([]);
    expect(jc.khoaTrung('[{"code":"A"},{"code":"B"}]')).toEqual([]);
    expect(jc.khoaTrung('{"ma":[{"code":"A","gate":"x"},{"code":"B","gate":"y"}]}')).toEqual([]);
  });

  test('dấu `:` và dấu nháy NẰM TRONG chuỗi không được tính là cấu trúc', () => {
    /*
     * Hai ca này làm vỡ mọi bộ quét viết bằng regex. `gate_codes.json` có `khop` chứa `|`, `(`, `\d`, và
     * `_y` chứa cả câu tiếng Việt có dấu hai chấm — nên nếu không phân biệt chuỗi với cấu trúc thì chính
     * file config quan trọng nhất sẽ bị báo oan.
     */
    expect(jc.khoaTrung('{"a":"x:y","a":1}')).toEqual(['a']);
    expect(jc.khoaTrung('{"a":"co \\" trong chuoi","b":1}')).toEqual([]);
    expect(jc.khoaTrung('{"khop":"rerun|chạy lại .* lần","y":"vì sao: thế này"}')).toEqual([]);
  });

  test('mọi file .json đang track đều KHÔNG có khoá trùng', () => {
    const { files } = jc.trackedJson();
    expect(files.length, '0 file nghĩa là phép đo hỏng, không phải "sạch"').toBeGreaterThan(0);
    const xau: string[] = [];
    for (const f of files) {
      const p = path.join(REPO, f);
      if (!fs.existsSync(p)) continue;
      const dup = jc.khoaTrung(fs.readFileSync(p, 'utf8'));
      if (dup.length) xau.push(`${f}: ${dup.join(', ')}`);
    }
    expect(xau).toEqual([]);
  });

  test('phép đối chứng: thêm một khoá trùng vào bản sao package.json ⇒ bắt được', () => {
    /*
     * Đối chứng chạy trên BẢN SAO ở thư mục tạm, không sửa `package.json` thật: nó là file dùng chung, và
     * một test làm bẩn nó sẽ làm đỏ các lượt chạy song song theo cách rất khó truy.
     */
    const goc = fs.readFileSync(path.join(REPO, 'package.json'), 'utf8');
    expect(jc.khoaTrung(goc), 'bản thật phải sạch trước đã').toEqual([]);

    const hong = goc.replace('"scripts": {', '"scripts": {\n    "ci:scope": "echo BI-THAY-NGAM",');
    expect(hong).not.toBe(goc);
    expect(jc.khoaTrung(hong), 'khoá trùng thay ngầm lệnh của gate thì phải bắt được').toContain('ci:scope');

    /* Và chứng minh vì sao nó nguy hiểm: `JSON.parse` im lặng, chỉ lấy giá trị cuối. */
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'jsondup-'));
    fs.writeFileSync(path.join(d, 'p.json'), hong, 'utf8');
    const j = JSON.parse(fs.readFileSync(path.join(d, 'p.json'), 'utf8'));
    expect(typeof j.scripts['ci:scope'], '`JSON.parse` không hề báo lỗi').toBe('string');
  });
});
