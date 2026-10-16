import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';
import { thuMucTam, donThuMucTam } from './_thu_muc_tam';

/*
 * @infra — case:paths: import tương đối phải khớp tên file thật, ĐÚNG hoa-thường.
 *
 * ĐÂY LÀ CỬA PHÒNG, VÀ PHẢI NÓI RÕ RA. Prompt v2.9.2 giao việc "sửa import lệch hoa-thường rồi báo số
 * đỏ trước/sau", với giả thuyết đó là nguyên nhân 20 test đỏ trên Linux CI.
 *
 * Đo 16/10/2026: **490 đường import, 0 đường lệch**. Nguyên nhân thật của 20 test đỏ đã tìm từ v2.8.3 và
 * khác hẳn (Node 20 không bóc kiểu khi `require()` file `.ts`, cộng 2 test ghim giả định có ổ đĩa).
 *
 * Nên cửa này không chữa gì. Nó chặn lớp lỗi quay lại — và lớp lỗi đó có thật: Windows/macOS không phân
 * biệt hoa-thường, Linux có, nên một import lệch chạy ngon ở máy dev và chỉ chết trên CI.
 *
 * Vì nó chưa từng bắt được ca thật nào, ĐỐI CHỨNG DƯƠNG ở dưới là thứ duy nhất chứng minh nó có răng.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const CP = path.join(REPO, 'scripts/qa/case_paths.js');

/* eslint-disable @typescript-eslint/no-var-requires, global-require */
const M = require(CP);
/* eslint-enable @typescript-eslint/no-var-requires, global-require */

function chay(repo: string) {
  const r = spawnSync(process.execPath, [CP, '--repo', repo, '--json'], {
    cwd: REPO, encoding: 'utf8', env: gateEnv(),
  });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

/** Cây giả: một file nguồn import một file khác, hoa-thường do người gọi quyết. */
function cayGia(tenThat: string, tenViet: string) {
  const d = thuMucTam('casep');
  fs.mkdirSync(path.join(d, 'src'), { recursive: true });
  fs.writeFileSync(path.join(d, 'src', tenThat), 'module.exports = {};\n', 'utf8');
  fs.writeFileSync(path.join(d, 'src', 'a.js'), `const x = require('./${tenViet}');\nmodule.exports = x;\n`, 'utf8');
  return d;
}

test.describe('@infra case:paths — import phải khớp tên file thật', () => {
  test('cây hiện tại: 0 đường lệch — và mẫu số nói rõ nó là của REPO hay của GÓI', () => {
    const kq = M.quet(REPO);

    /*
     * Phần `lech` kiểm ở MỌI cây: lint chặn một đường import hợp lệ thì vẫn phải đỏ, dù mẫu số nhỏ.
     */
    expect(kq.lech, `đường lệch: ${JSON.stringify(kq.lech)}`).toEqual([]);

    /*
     * MẪU SỐ NHỎ ⇒ BỎ QUA KÈM LÝ DO, KHÔNG đỏ và cũng KHÔNG xanh — cùng cách `sql-readonly-lint` xử lý.
     *
     * Đo 16/10/2026 bằng `release:verify`: repo quét **490** đường import, trong GÓI chỉ một phần —
     * gói không mang `outputs/**` (lớp PROJECT, gitignore) và không mang spec probe chưa track. Ngưỡng
     * 300 là ngưỡng của REPO.
     *
     * Bản đầu của tôi ghim thẳng `>300` nên nó ĐỎ TRONG GÓI, và đỏ vì một lý do không liên quan tới
     * chất lượng gói. Người nhận kit mở hộp thấy bộ tự-kiểm đỏ rồi học cách bỏ qua màu đỏ — đúng cái
     * `_trong_repo.ts` sinh ra để chặn.
     */
    test.skip(kq.soDuong <= 300,
      `mẫu số chỉ ${kq.soDuong} đường import (repo có ~490) — cây này không mang \`outputs/**\` và spec `
      + 'probe chưa track. Phép đo "0 đường lệch" cần mẫu số của REPO mới nói được về độ phủ.');
    expect(kq.soDuong, 'quét 0 đường thì phép đo hỏng, không phải "sạch"').toBeGreaterThan(300);
  });

  test('ĐỐI CHỨNG DƯƠNG: `./Foo` trỏ `foo.js` ⇒ CHẶN', () => {
    /*
     * Ca này chạy được NGAY trên Windows/macOS — đó chính là điều làm nó nguy hiểm. Máy không hỏi hệ
     * điều hành; nó đọc danh sách thư mục rồi so chuỗi chính xác, nên kết luận giống nhau ở mọi nền.
     */
    const d = cayGia('foo.js', 'Foo');
    try {
      const r = chay(d);
      expect(r.code, r.out).toBe(1);
      expect(r.out).toContain('Foo');
      expect(r.out, 'phải nói tên thật trên đĩa để người sửa biết sửa thành gì').toContain('foo.js');
    } finally { donThuMucTam(d); }
  });

  test('ĐỐI CHỨNG ÂM: viết đúng hoa-thường ⇒ ĐẠT', () => {
    const d = cayGia('foo.js', 'foo');
    try { expect(chay(d).code).toBe(0); } finally { donThuMucTam(d); }
  });

  test('ĐỐI CHỨNG ÂM: đường trỏ file KHÔNG TỒN TẠI ⇒ bỏ qua, KHÔNG báo oan', () => {
    /*
     * Máy chỉ phán đúng một chuyện: có file khớp-không-phân-biệt mà sai hoa-thường. Đường trỏ file sinh
     * lúc chạy, hoặc alias do bundler xử lý, không thuộc thẩm quyền của nó. Phán thêm là báo oan — và
     * cửa báo oan là cửa người ta tắt.
     */
    const d = thuMucTam('casep-ko');
    try {
      fs.mkdirSync(path.join(d, 'src'), { recursive: true });
      fs.writeFileSync(path.join(d, 'src', 'a.js'), "require('./khong-he-co-file-nay');\n", 'utf8');
      expect(chay(d).code, 'không có file nào khớp ⇒ im lặng').toBe(0);
    } finally { donThuMucTam(d); }
  });

  test('ĐỐI CHỨNG ÂM: gói npm (không phải đường tương đối) ⇒ không đụng tới', () => {
    const d = thuMucTam('casep-pkg');
    try {
      fs.mkdirSync(path.join(d, 'src'), { recursive: true });
      fs.writeFileSync(path.join(d, 'src', 'a.js'), "require('ExcelJS');\nrequire('fs');\n", 'utf8');
      expect(chay(d).code, '`ExcelJS` là tên gói — hoa-thường của nó là việc của npm').toBe(0);
    } finally { donThuMucTam(d); }
  });

  test('bỏ qua theo CẤU TRÚC — `outputs/` không được kéo vào mẫu số', () => {
    /*
     * Cùng lớp lỗi vừa vá ở v2.9.1 cho `rule_coverage` và `full_suite_ledger`: mẫu số gộp file lớp
     * PROJECT thì con số phụ thuộc máy người chạy, và CI tính ra số khác.
     */
    expect(M.BO_QUA.test('outputs/CSDL/tasks/X/automation/a.spec.ts')).toBe(true);
    expect(M.BO_QUA.test('node_modules/x/index.js')).toBe(true);
    expect(M.BO_QUA.test('scripts/qa/case_paths.js'), 'source của kit thì PHẢI quét').toBe(false);
  });

  test('nói thẳng: hôm nay 0 vi phạm — đây là cửa PHÒNG, không phải cửa chữa', () => {
    /*
     * Khoá lại câu chữ, vì đây là chỗ dễ bị kể lại sai nhất ở lần đọc sau: "thêm case:paths" rất dễ
     * được nhớ thành "đã sửa 20 test đỏ trên Linux". Hai chuyện khác hẳn nhau.
     */
    const src = fs.readFileSync(CP, 'utf8');
    expect(src, 'file phải tự khai nó là cửa phòng').toMatch(/CỬA PHÒNG, KHÔNG PHẢI CỬA CHỮA/);
    expect(src, 'phải ghi lại số đo đã bác giả thuyết cũ').toMatch(/0 đường lệch/);
  });
});
