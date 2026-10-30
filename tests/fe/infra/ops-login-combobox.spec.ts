import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '@playwright/test';

const REPO = path.resolve(__dirname, '../../..');
const NGUON = path.join(REPO, 'tests/fe/support/opsLogin.ts');

/*
 * ĐỌC TRONG TEST, KHÔNG ĐỌC Ở MỨC MODULE — và đây là một lỗ đã ĐO RA ở `release:verify`.
 *
 * `opsLogin.ts` nằm ở `tests/fe/support/`, tức **lớp PROJECT**, và `package_kit.js` cố ý KHÔNG đóng gói
 * lớp đó (luật `DENY` loại `tests/fe/{auth,support,order,transaction}/`). Nhưng file spec này nằm ở
 * `tests/fe/infra/` — lớp GENERIC, có đóng gói.
 *
 * Bản trước đọc file ở dòng `const` mức module. Playwright `--list` CHẠY thân module khi thu thập test,
 * nên trong gói nó ném `ENOENT` và `release:verify` báo **0 test** cho cả suite — một file làm mù cả
 * bước nghiệm thu. Đo 30/10/2026: `release:verify` 12/13 bước đạt, bước đỏ đúng là bước này.
 *
 * Nay đọc trong test và KHAI SKIP khi thiếu lớp PROJECT. Skip phải NÓI RA: "không có file để đọc" khác
 * hẳn "đã kiểm và đạt", và một spec generic im lặng chấm xanh khi thiếu nguồn là đúng thứ kit cấm.
 */
function docNguon(): string {
  test.skip(!fs.existsSync(NGUON),
    'thiếu `tests/fe/support/opsLogin.ts` (lớp PROJECT, không đóng gói) — KHÔNG kiểm được, và đó không phải "đạt"');
  return fs.readFileSync(NGUON, 'utf8');
}

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
    const SRC = docNguon();
    const i = SRC.indexOf('async function chonComboBox');
    expect(i, 'không tìm thấy chonComboBox').toBeGreaterThan(0);
    const than = SRC.slice(i, SRC.indexOf('\n}', i));

    expect(than, 'thiếu vòng thử lại cả lượt chọn — bản cũ tin vào một cú bấm và chọn ăn XEN KẼ')
      .toMatch(/for \(let lan = 0; lan < \d+ && !anKhop/);
    expect(than, 'phải đóng dropdown trước khi thử lại, nếu không lượt sau lại rơi vào dropdown đã chết')
      .toContain("keyboard.press('Escape')");
    expect(than, 'phải nghiệm thu bằng giá trị ô _Input, không bằng thời gian chờ')
      .toContain('_Input');
    /*
     * NEO THEO CẤU TRÚC, KHÔNG THEO KHOẢNG CÁCH KÝ TỰ.
     *
     * Bản trước viết `/if \(!anKhop\)[\s\S]{0,400}throw new Error/`. Nó đỏ từ `a926c96` — commit thêm
     * phần in DANH SÁCH THẬT của combobox khi chọn trượt. `throw` vẫn còn nguyên, chỉ là nó lùi ra
     * 1.640 ký tự sau khối gác của chính nó, quá cửa sổ 400.
     *
     * Tức máy gác đỏ vì mã nguồn ĐƯỢC CẢI THIỆN. Một gate như vậy dạy người ta tắt nó đi, nên phải
     * đổi cách neo: lấy khối `if (!anKhop)` CUỐI CÙNG — khối xử lý "hết đường rồi" — và đòi nó ném.
     * Thêm chẩn đoán bao nhiêu cũng không làm nó đỏ; gỡ `throw` ra thì nó đỏ ngay.
     */
    const cacKhoiGac = [...than.matchAll(/if \(!anKhop\)/g)].map((m) => m.index as number);
    expect(cacKhoiGac.length, 'không còn khối gác `if (!anKhop)` nào').toBeGreaterThan(0);
    const khoiCuoi = than.slice(cacKhoiGac[cacKhoiGac.length - 1]);
    expect(khoiCuoi, 'hết lượt thử mà chưa khớp thì PHẢI ném — im lặng đi tiếp là chạy trên đơn vị sai')
      .toContain('throw new Error');
  });

  test('khoá phiên phải gồm CẤP HỌC, không chỉ user và trường', () => {
    const SRC = docNguon();
    const m = SRC.match(/const key = `([^`]+)`/);
    expect(m, 'không tìm thấy khoá phiên').toBeTruthy();
    const key = m![1];
    expect(key, 'khoá thiếu user').toContain('OPS_USER');
    expect(key, 'khoá thiếu đơn vị').toContain('QEMIS_TRUONG');
    expect(key, 'khoá thiếu CẤP HỌC ⇒ đổi cấp trong TTL sẽ dùng lại phiên cấp cũ (đo 01/10: THPT nhận lưới khối 6–9 của THCS)')
      .toContain('QEMIS_CAP_HOC');
  });

  test('vẫn KHÔNG đoán captcha — phải chờ người, không tự điền', () => {
    const SRC = docNguon();
    expect(SRC, 'helper không được tự sinh/đoán mã captcha').not.toMatch(/captcha\s*=\s*['"][A-Z0-9]{4,}['"]/i);
    expect(SRC, 'phải ghi ảnh captcha ra đĩa rồi CHỜ đáp án').toContain('CAPTCHA_ANSWER');
  });
});
