import { test, expect, chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/*
 * PROBE ĐO BIẾN THỂ ⑥ — `BR-NHANSU-029`, vế thứ ba.
 *
 * Luật (knowledge/domain/br-nhansu-029.json, `active`): *"Mo URL popup ho so khi chua dang nhap thi bi
 * day ve man Dang nhap."*
 *
 * VÌ SAO CHỈ ĐO ĐƯỢC VẾ NÀY: hai vế còn lại của cùng rule (đổi `id` sang đơn vị khác · `isview=1→0`)
 * nói về tài khoản TRƯỜNG. Session đang có là `masteradmin`, vốn thấy cả 5 cấp — với nó, "xem được đơn
 * vị khác" rất có thể là ĐÚNG. Đo hai vế đó bằng tài khoản sai vai trò là đường ngắn nhất tới một bug
 * BỊA. `authz:expand` nay đánh chúng là `needs_account` kèm tên vai trò cần.
 *
 * Vế này thì KHÔNG phụ thuộc vai trò: "chưa đăng nhập" là cùng một trạng thái với mọi tài khoản.
 *
 * AN TOÀN: một lượt GET duy nhất, context SẠCH (không nạp session), không gửi form, không ghi gì.
 * File này là PROBE (không track) vì `ci:scope` đòi mọi spec ĐƯỢC TRACK trong `tests/fe/infra` không
 * chạm UAT.
 */

const BASE = process.env.BASE_URL || process.env.OPS_BASE_URL || '';
const ROUTE = '/C2/HoSoTruongDetail.aspx';
const DIR = path.resolve(
  process.env.PROJECT_OUTPUT_DIR || 'outputs',
  'tasks', process.env.TASK_KEY || 'CSDL-9001', 'evidence', 'authz',
);

test('BR-NHANSU-029: mở màn hồ sơ khi CHƯA đăng nhập phải bị đẩy về Đăng nhập', async () => {
  test.skip(!BASE, 'thiếu BASE_URL — probe này cần task.env của CSDL-9001');
  test.setTimeout(180000);

  const br = await chromium.launch();
  /* Context SẠCH: không storageState, không cookie. Đây là điều kiện của phép đo. */
  const ctx = await br.newContext();
  const page = await ctx.newPage();

  const dich = new URL(ROUTE, BASE).toString();
  await page.goto(dich, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  const urlCuoi = page.url();
  const tieuDe = await page.title();
  /*
   * ORACLE theo SPEC, không theo app: phải thấy dấu hiệu của MÀN ĐĂNG NHẬP. Hai neo cấu trúc, không dò
   * chữ: ô mật khẩu, và không có nội dung hồ sơ trường nào đọc được.
   */
  const soOMatKhau = await page.locator('input[type="password"]').count();
  const coNutGhi = await page.locator('input[type="submit"][value="Ghi"], input[value="Ghi"]').count();

  fs.mkdirSync(DIR, { recursive: true });
  const anh = path.join(DIR, 'br-nhansu-029-chua-dang-nhap.png');
  await page.screenshot({ path: anh, fullPage: true });

  /* eslint-disable no-console */
  console.log(`[029] url cuối: ${urlCuoi.replace(BASE, '<BASE>')}`);
  console.log(`[029] tiêu đề: ${tieuDe}`);
  console.log(`[029] ô mật khẩu: ${soOMatKhau} · nút Ghi của form hồ sơ: ${coNutGhi}`);
  console.log(`[029] evidence: ${anh}`);
  /* eslint-enable no-console */

  /*
   * GHI KẾT QUẢ cho `authz:expand` đọc. Planner liệt kê biến thể; con số `proven` của nó phải phản ánh
   * lượt ĐO, không phải lượt khai — file này là chỗ hai bên gặp nhau.
   */
  const kqPath = path.resolve(
    process.env.PROJECT_OUTPUT_DIR || 'outputs',
    'tasks', process.env.TASK_KEY || 'CSDL-9001', 'test-results', 'authz_ket_qua.json',
  );
  fs.mkdirSync(path.dirname(kqPath), { recursive: true });
  const cu = fs.existsSync(kqPath) ? JSON.parse(fs.readFileSync(kqPath, 'utf8')) : [];
  const moTa = 'Mở URL popup hồ sơ khi CHƯA đăng nhập phải bị đẩy về màn Đăng nhập.';
  const ds = (Array.isArray(cu) ? cu : []).filter((x) => x.mo_ta !== moTa);
  ds.push({
    oracle_ref: 'BR-NHANSU-029',
    mo_ta: moTa,
    nhom: 'an_khac_cam',
    trang_thai: soOMatKhau > 0 && coNutGhi === 0 ? 'pass' : 'fail',
    route: ROUTE,
    vai_tro: '(chưa đăng nhập)',
    bang_chung: path.relative(process.cwd(), anh),
    do_luc: new Date().toISOString(),
    thay_gi: `url cuối ${urlCuoi.replace(BASE, '<BASE>')} · ô mật khẩu ${soOMatKhau} · nút Ghi ${coNutGhi}`,
  });
  fs.writeFileSync(kqPath, `${JSON.stringify(ds, null, 2)}
`);

  await br.close();

  expect(soOMatKhau, 'phải ở màn Đăng nhập (có ô mật khẩu)').toBeGreaterThan(0);
  expect(coNutGhi, 'KHÔNG được thấy form hồ sơ trường khi chưa đăng nhập').toBe(0);
});
