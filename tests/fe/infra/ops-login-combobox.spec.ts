import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@playwright/test';

const REPO = path.resolve(__dirname, '../../..');
const SRC = fs.readFileSync(path.join(REPO, 'tests/fe/support/opsLogin.ts'), 'utf8');

/*
 * Khoá hai bản vá ngày 01/10/2026 của `opsLogin.ts`. Cả hai đều sửa một lớp hỏng ÂM THẦM — không ném
 * lỗi, không đỏ, chỉ lặng lẽ chạy trên đơn vị hoặc cấp học khác rồi chấm xanh. Mất chúng là mất luôn
 * khả năng tin vào mọi kết quả execute của QEMIS, nên phải có máy giữ.
 *
 * Test đọc MÃ NGUỒN vì hai nhánh này chỉ lộ ra khi có app thật: không dựng nổi RadComboBox giả mà vẫn
 * tái hiện đúng trạng thái "dropdown còn trong DOM nhưng đã chết".
 */
test.describe('@infra opsLogin — chống chọn nhầm đơn vị và nhầm cấp', () => {
  test('chonComboBox phải NGHIỆM THU rồi THỬ LẠI, không tin một cú bấm', () => {
    const i = SRC.indexOf('async function chonComboBox');
    expect(i, 'không tìm thấy chonComboBox').toBeGreaterThan(0);
    const than = SRC.slice(i, SRC.indexOf('\n}', i));

    expect(than, 'thiếu vòng thử lại cả lượt chọn — bản cũ tin vào một cú bấm và chọn ăn XEN KẼ')
      .toMatch(/for \(let lan = 0; lan < \d+ && !anKhop/);
    expect(than, 'phải đóng dropdown trước khi thử lại, nếu không lượt sau lại rơi vào dropdown đã chết')
      .toContain("keyboard.press('Escape')");
    expect(than, 'phải nghiệm thu bằng giá trị ô _Input, không bằng thời gian chờ')
      .toContain('_Input');
    expect(than, 'hết lượt thử mà chưa khớp thì PHẢI ném — im lặng đi tiếp là chạy trên đơn vị sai')
      .toMatch(/if \(!anKhop\)[\s\S]{0,400}throw new Error/);
  });

  test('khoá phiên phải gồm CẤP HỌC, không chỉ user và trường', () => {
    const m = SRC.match(/const key = `([^`]+)`/);
    expect(m, 'không tìm thấy khoá phiên').toBeTruthy();
    const key = m![1];
    expect(key, 'khoá thiếu user').toContain('OPS_USER');
    expect(key, 'khoá thiếu đơn vị').toContain('QEMIS_TRUONG');
    expect(key, 'khoá thiếu CẤP HỌC ⇒ đổi cấp trong TTL sẽ dùng lại phiên cấp cũ (đo 01/10: THPT nhận lưới khối 6–9 của THCS)')
      .toContain('QEMIS_CAP_HOC');
  });

  test('vẫn KHÔNG đoán captcha — phải chờ người, không tự điền', () => {
    expect(SRC, 'helper không được tự sinh/đoán mã captcha').not.toMatch(/captcha\s*=\s*['"][A-Z0-9]{4,}['"]/i);
    expect(SRC, 'phải ghi ảnh captcha ra đĩa rồi CHỜ đáp án').toContain('CAPTCHA_ANSWER');
  });
});
