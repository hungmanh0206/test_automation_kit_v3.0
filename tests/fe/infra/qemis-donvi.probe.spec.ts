import fs from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';
import {
  OPS_LOGIN_URL, SEL, QEMIS_SO, QEMIS_CAP_HOC, QEMIS_PHUONG_XA, QEMIS_TRUONG,
} from '../support/opsLogin';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const safeTarget = require(path.resolve(__dirname, '../../../scripts/utils/ui/safe_target.js'));

/*
 * ĐỌC DANH SÁCH ĐƠN VỊ trên `/Login.aspx` để điền `QEMIS_SO` / `QEMIS_CAP_HOC` / `QEMIS_PHUONG_XA` /
 * `QEMIS_TRUONG` trong `profiles/<TASK_KEY>/task.env`.
 *
 * KHÔNG ĐĂNG NHẬP ⇒ KHÔNG cần captcha: bốn combobox nằm ngay trên trang đăng nhập và cascade bằng
 * postback, chưa cần credential. Toàn bộ là GET + mở dropdown — không gửi form, không ghi gì.
 *
 * Vì sao phải ĐỌC chứ không đoán: `chonComboBox` so khớp theo CHỮ HIỆN TRÊN MÀN. Đoán sai một dấu
 * ("TP Hà Nội" thay vì "Thành phố Hà Nội") thì lỗi báo ra là "dropdown không mở" — nghe như lỗi kỹ
 * thuật chứ không như sai cấu hình, và mất buổi để tìm.
 */

/** Khớp TRỌN chuỗi. Tên trường chứa dấu ngoặc nên phải escape, và `hasText` mặc định là so CHỨA. */
const tron = (s: string): RegExp => new RegExp(`^\\s*${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);

/**
 * Đọc text các mục mà KHÔNG mở dropdown.
 * RadComboBox giữ `<li>` trong DOM cả khi dropdown ĐÓNG (ghi trong `opsLogin.ts`), nên đọc thẳng được.
 * Bản trước mở dropdown rồi `Escape` để đọc — chính bước đó làm hỏng trạng thái: lần mở sau, click mũi
 * tên lại TOGGLE nó đóng và `click()` rơi vào `<li>` vô hình tới hết timeout.
 */
const docCombo = async (page: any, id: string): Promise<string[]> => {
  const txt = await page.locator(`#${id}_DropDown li`).allInnerTexts().catch(() => []);
  return txt.map((t: string) => t.trim()).filter(Boolean);
};

/** Chọn một mục theo text KHỚP TRỌN, rồi chờ ô `_Input` hiện đúng chữ đó (tín hiệu postback xong). */
const chon = async (page: any, id: string, text: string): Promise<void> => {
  const item = page.locator(`#${id}_DropDown li`).filter({ hasText: tron(text) });
  const arrow = page.locator(`#${id}_Arrow`);
  for (let i = 0; i < 5; i += 1) {
    await arrow.click({ timeout: 10000 }).catch(() => { /* postback đang chạy, thử lại */ });
    if (await item.isVisible({ timeout: 4000 }).catch(() => false)) break;
  }
  await safeTarget.one(item, { what: `mục "${text}" trong combobox ${id}` });
  await item.scrollIntoViewIfNeeded().catch(() => { /* đã trong khung nhìn */ });
  await item.click({ timeout: 20000 });
  await page.waitForFunction(
    ([sel, mong]: readonly [string, string]) => {
      const el = document.querySelector(sel) as HTMLInputElement | null;
      return !!el && (el.value || '').trim().startsWith(String(mong).trim());
    },
    [`#${id}_Input`, text] as const,
    { timeout: 30000 },
  );
};

test.describe('@infra QEMIS — đọc danh sách đơn vị trên trang đăng nhập (chỉ đọc)', () => {
  test.skip(!OPS_LOGIN_URL, 'chưa khai OPS_LOGIN_URL');
  test.describe.configure({ mode: 'serial' });

  test('cascade: Sở → Cấp học → Phường/Xã → Trường', async ({ page }) => {
    test.setTimeout(240000);
    await page.goto(OPS_LOGIN_URL, { waitUntil: 'domcontentloaded' });

    /*
     * Form đăng nhập có HAI BIẾN THỂ (đo 01/10/2026): bản toàn quốc có ô "Sở"; bản gắn Sở sẵn
     * (vd Sở Hà Nội) KHÔNG có ô đó mà thêm ô "Năm học". Probe phải chịu được cả hai, nếu không nó
     * đọc ra 0 mục rồi kết luận sai về danh sách đơn vị.
     */
    const so = await docCombo(page, SEL.cbSo);
    if (so.length) {
      const soChon = so.find((s) => /Hà Nội/i.test(s)) || so[1] || so[0];
      console.log(`[so] ${so.length} mục — chọn "${soChon}"`);
      await chon(page, SEL.cbSo, soChon);
    } else {
      console.log('[so] form KHÔNG có ô Sở (bản gắn sẵn một Sở) — bỏ qua bước chọn Sở');
    }

    const cap = await docCombo(page, SEL.cbCapHoc);
    console.log(`[caphoc] ${cap.length} mục: ${cap.join(' | ')}`);
    const capChon = cap.find((c) => /Trung học cơ sở/i.test(c)) || cap[0];
    await chon(page, SEL.cbCapHoc, capChon);

    const px = await docCombo(page, SEL.cbPhuongXa);
    console.log(`[phuongxa] ${px.length} mục — 10 đầu: ${px.slice(0, 10).join(' | ')}`);

    const truong = await docCombo(page, SEL.cbTruong);
    console.log(`[truong] ${truong.length} mục khi CHƯA lọc Phường/Xã`);

    /* Xuất cho `tests/support/setup/db/csdl9002.chontruong.spec.ts` hỏi DB cái nào có phân hiệu. */
    const ds = truong
      .map((t) => { const m = t.match(/\(([0-9]{6,14})\)/); return m ? { ma: m[1], nhan: t } : null; })
      .filter(Boolean);
    const out = 'test-results/qemis-truong-thcs-hanoi.json';
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(ds, null, 1), 'utf8');
    console.log(`[xuat] trích được mã cho ${ds.length}/${truong.length} mục → ${out}`);
  });

  /*
   * NGHIỆM THU bộ giá trị ĐANG khai trong task.env — chạy đúng chuỗi cascade với đúng bốn chuỗi đó.
   * `chonComboBox` nghiệm thu bằng `el.value` bắt đầu bằng chuỗi khai, nên chép nhãn từ danh sách chưa
   * chắc đã khớp; chạy thử là cách duy nhất biết chắc trước khi Phase 2 dựa vào nó.
   */
  test('bộ giá trị trong task.env chọn được thật', async ({ page }) => {
    test.skip(!QEMIS_SO || !QEMIS_TRUONG, 'chưa khai QEMIS_SO/QEMIS_TRUONG');
    test.setTimeout(240000);
    await page.goto(OPS_LOGIN_URL, { waitUntil: 'domcontentloaded' });

    /* Bản gắn Sở sẵn không có ô Sở — bỏ bước đó thay vì ném, xem chú thích ở test cascade. */
    const coSo = (await page.locator(`#${SEL.cbSo}_Input`).count()) > 0;
    const buoc: [string, string, string][] = coSo ? [[SEL.cbSo, QEMIS_SO, 'Sở']] : [];
    if (!coSo) console.log('[ok] form không có ô Sở — bỏ qua, Sở đã gắn sẵn');
    if (QEMIS_CAP_HOC) buoc.push([SEL.cbCapHoc, QEMIS_CAP_HOC, 'Cấp học']);
    if (QEMIS_PHUONG_XA) buoc.push([SEL.cbPhuongXa, QEMIS_PHUONG_XA, 'Phường/Xã']);
    buoc.push([SEL.cbTruong, QEMIS_TRUONG, 'Trường']);

    for (const [id, val, ten] of buoc) {
      await chon(page, id, val);
      console.log(`[ok] ${ten} = "${await page.locator(`#${id}_Input`).inputValue()}"`);
    }
    console.log('[ok] mọi combobox nhận giá trị — bộ cấu hình dùng được');
  });
});
