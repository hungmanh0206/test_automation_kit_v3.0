import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {
  comboBox, docGiaTri, docItems, moDuocDropdown, chonGiaTri, chonChuoi, dangKhoa, lietKeTrenMan,
  WidgetError, HAU_TO,
} from '../lib/_widget/radcombobox';

/*
 * L0.5 WIDGET — Telerik `RadComboBox` (v2.8.0 §A).
 *
 * VÌ SAO TẦNG NÀY CÓ TRƯỚC L1, có số đo: khai thác 421 file automation của 4 task cho thấy ba hình dạng
 * `#<ID>_Arrow` · `#<ID>_DropDown li` · `#<ID>_Input` chiếm **475/1.388 = 34%** mọi lời gọi định vị, và
 * xuất hiện ở 3–4 task khác nhau. Không "bước nghiệp vụ" nào lặp nhiều bằng.
 *
 * Bộ test chạy trên app fixture OFFLINE, và fixture đó tái hiện đúng NĂM hành vi mà code thật đã sai rồi
 * mới biết. Một fixture dễ hơn thực tế sẽ cho L0.5 xanh rồi vỡ trên UAT — nên mỗi test dưới đây neo vào
 * một bài học cụ thể, không phải vào "combobox hoạt động".
 */
const REPO = path.resolve(__dirname, '..', '..', '..');

/* Fixture app dùng chung với discovery (v2.6.0). */
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const app = require(path.join(REPO, 'tests/fe/fixtures/discovery-app/server.js'));

let srv: { url: string; close: () => Promise<void> } | null = null;

test.beforeAll(async () => { srv = await app.start(); });
test.afterAll(async () => { if (srv) await srv.close(); });

const mo = async (page: import('@playwright/test').Page) => {
  await page.goto(`${srv!.url}/telerik`);
  await page.waitForLoadState('domcontentloaded');
};

test.describe.configure({ mode: 'default' });

test.describe('@infra L0.5 widget — bộ locator suy từ ID control', () => {
  test('hậu tố được XUẤT RA, không ai phải tự đoán lại', () => {
    /*
     * 46% selector trong code cũ là chuỗi nội suy `#${id}_Input`, tức mỗi file tự ghép hậu tố. Ghép tay
     * thì sai một lần là một lỗi khó thấy, và sửa cách ghép phải sửa mọi chỗ.
     */
    expect(HAU_TO.input).toBe('_Input');
    expect(HAU_TO.arrow).toBe('_Arrow');
    expect(HAU_TO.dropDown).toBe('_DropDown');
  });

  test('id rỗng ⇒ ném WidgetError, không trả locator vô nghĩa', () => {
    expect(() => comboBox({} as never, '')).toThrow(WidgetError);
  });

  test('bỏ dấu `#` đầu id — gọi kiểu nào cũng được', () => {
    /* Stub phải cho `.locator()` lồng nhau: `slide` dùng `locator(...).locator('xpath=…')`. */
    const nut: { locator: (x: string) => unknown } = { locator: () => nut };
    const page = { locator: () => nut } as never;
    expect(comboBox(page, '#cbCap').id).toBe('cbCap');
    expect(comboBox(page, 'cbCap').id).toBe('cbCap');
  });
});

test.describe('@infra L0.5 widget — năm bài học đã trả giá', () => {
  test('BÀI 1: ô đang ĐÚNG giá trị ⇒ trả `da-dung`, KHÔNG click gì', async ({ page }) => {
    /*
     * Khi giá trị đang đúng, click vào ô KHÔNG bung dropdown, nên chờ item hiện sẽ timeout. Hai lượt
     * trước đã sửa nhầm hướng chuyện này: đổ cho postback chậm rồi thêm chờ, trong khi nguyên nhân là
     * KHÔNG CÓ GÌ ĐỂ CHỌN.
     */
    await mo(page);
    expect(await docGiaTri(page, 'cbCap')).toBe('Mầm non');
    const r = await chonGiaTri(page, 'cbCap', 'Mầm non');
    expect(r, 'phải nhận ra không cần làm gì').toBe('da-dung');
  });

  test('BÀI 1b: `da-dung` và `da-chon` là HAI kết cục khác nhau', async ({ page }) => {
    /*
     * Phân biệt hai kết cục cố ý: một bước báo "đã chọn" trong khi nó không làm gì là một lời khai sai,
     * và nó làm người đọc log tưởng postback đã xảy ra.
     */
    await mo(page);
    expect(await chonGiaTri(page, 'cbTinh', 'Phú Thọ')).toBe('da-chon');
    expect(await chonGiaTri(page, 'cbTinh', 'Phú Thọ')).toBe('da-dung');
  });

  test('BÀI 2+3: item nằm sẵn trong DOM nhưng dropdown chưa mở', async ({ page }) => {
    /*
     * Đây là chỗ một lượt đã kết luận SAI: đếm item rồi báo "danh sách mở được" cho cả 9 combobox đang
     * KHOÁ — evidence tự mâu thuẫn với chính nó. `docItems` đọc DOM nên luôn thấy item; chỉ
     * `moDuocDropdown` trả lời được câu "người dùng mở được không".
     */
    await mo(page);
    const items = await docItems(page, 'cbKhoa');
    expect(items.length, 'item CÓ trong DOM dù ô khoá').toBeGreaterThan(0);
    expect(await moDuocDropdown(page, 'cbKhoa'), 'nhưng dropdown KHÔNG mở được').toBe(false);
  });

  test('BÀI 3: `dangKhoa` đo HÀNH VI, không tin lời khai của markup', async ({ page }) => {
    /*
     * Bài học từ `o-chi-xem.spec.ts` đã chạy thật: "ô có thuộc tính `disabled`" KHÔNG đủ — thuộc tính là
     * lời khai của markup, thứ cần biết là thao tác vào thì ô có nhận hay không.
     *
     * VÀ BÀI HỌC CỦA CHÍNH LƯỢT NÀY: bản đầu của `dangKhoa` dùng `input[readonly]` làm dấu hiệu khoá, và
     * nó báo KHOÁ cho MỌI combobox — vì `readonly` là trạng thái BÌNH THƯỜNG của RadComboBox (chọn từ
     * danh sách, không gõ). Test này bắt được ngay, nên nó phải ở lại.
     */
    await mo(page);
    const k = await dangKhoa(page, 'cbKhoa');
    expect(k.khoa).toBe(true);
    expect(k.dau_hieu.join(' '), 'kết luận phải dựa trên HÀNH VI, không chỉ markup').toMatch(/hành vi:/);

    const moDuoc = await dangKhoa(page, 'cbTinh');
    expect(moDuoc.khoa, 'ô mở được và đổi được KHÔNG được báo là khoá').toBe(false);
    expect(moDuoc.trang_thai).toBe('mo');
  });

  test('BÀI 3b: "không mở được" KHÁC "mở được nhưng không đổi được"', async ({ page }) => {
    /*
     * Đặc tả chấp nhận cả hai, nhưng dev cần biết app đang làm cái nào — nên hai kết cục được ghi nhận
     * riêng. Gộp chúng lại là mất đúng thông tin dev dùng để sửa.
     */
    await mo(page);
    expect((await dangKhoa(page, 'cbKhoa')).trang_thai).toBe('khong-mo-duoc-danh-sach');
  });

  test('BÀI 3c: `dangKhoa` TRẢ LẠI giá trị ban đầu sau khi đo', async ({ page }) => {
    /*
     * Phép đo không được để lại trạng thái đã đổi. Một hậu kiểm báo "về gốc" mà thật ra chưa về là dương
     * tính giả, và kit đã gặp đúng chuyện đó một lần (`hoanNguyen` không trả lại được ô readonly).
     */
    await mo(page);
    await chonGiaTri(page, 'cbTinh', 'Phú Thọ');
    await dangKhoa(page, 'cbTinh');
    expect(await docGiaTri(page, 'cbTinh'), 'phép đo đã để lại trạng thái đã đổi').toBe('Phú Thọ');
  });

  test('BÀI 4: combobox KHÔNG bọc `rcbSlide` vẫn chọn được', async ({ page }) => {
    /* Phép chờ ancestor `rcbSlide` phải được phép thất bại mà không làm chết cả bước. */
    await mo(page);
    expect(await chonGiaTri(page, 'cbTron', '2026-2027')).toBe('da-chon');
    expect(await docGiaTri(page, 'cbTron')).toBe('2026-2027');
  });

  test('BÀI 5: chọn combobox CHA làm CON nạp lại — `chonChuoi` chờ đúng nhịp', async ({ page }) => {
    /*
     * Chọn ở combobox cha làm combobox con nạp lại, và TRONG nhịp đó con RỖNG. Thao tác ngay sau đó trên
     * con sẽ chạm DOM cũ. `chonChuoi` tồn tại để thứ tự và nhịp chờ không bị viết lại (và viết sai) ở
     * từng spec.
     */
    await mo(page);
    const r = await chonChuoi(page, [
      { id: 'cbTinh', giaTri: 'Phú Thọ' },
      { id: 'cbHuyen', giaTri: 'Phường Âu Cơ' },
    ]);
    expect(r).toEqual(['da-chon', 'da-chon']);
    expect(await docGiaTri(page, 'cbHuyen')).toBe('Phường Âu Cơ');
  });

  test('BÀI 5b: đổi CHA thì giá trị CON đổi theo danh sách mới', async ({ page }) => {
    await mo(page);
    await chonChuoi(page, [{ id: 'cbTinh', giaTri: 'Phú Thọ' }, { id: 'cbHuyen', giaTri: 'Phường Âu Cơ' }]);
    await chonGiaTri(page, 'cbTinh', 'Hồ Chí Minh');
    const items = await docItems(page, 'cbHuyen');
    expect(items, 'danh sách con phải là danh sách của tỉnh MỚI').toContain('Quận 1');
    expect(items).not.toContain('Phường Âu Cơ');
  });
});

test.describe('@infra L0.5 widget — NGHIỆM THU thao tác, KHÔNG phán nghiệp vụ', () => {
  test('bước KHÔNG chứa `expect` nào — luật vàng L2–L4', () => {
    /*
     * Luật vàng: bước chỉ làm thao tác; mọi phán đúng/sai nằm ở spec qua bộ kiểm L4 với giá trị kỳ vọng
     * lấy từ case. Một bước mang oracle làm tỉ lệ "dùng lại" tăng vọt, và đó là chỗ nguy hiểm nhất của
     * cả đợt v2.8.0 — prompt đặt nó làm điều kiện DỪNG.
     */
    const src = fs.readFileSync(path.join(REPO, 'tests/fe/lib/_widget/radcombobox.ts'), 'utf8');
    expect(src, 'widget chứa expect ⇒ nó đang phán nghiệp vụ').not.toMatch(/\bexpect\s*\(/);
    expect(src, 'widget import từ @playwright/test runtime ⇒ mở đường cho assertion')
      .not.toMatch(/^import\s+\{[^}]*expect/m);
  });

  test('giá trị không có trong danh sách ⇒ `WidgetError`, không âm thầm bỏ qua', async ({ page }) => {
    /*
     * Thao tác không tới đích phải thành `script_error`, KHÔNG thành FAIL nghiệp vụ và càng không thành
     * PASS. Đây là ranh giới giữa "bước hỏng" và "sản phẩm sai".
     */
    await mo(page);
    await expect(chonGiaTri(page, 'cbTinh', 'Không Có Tỉnh Này')).rejects.toThrow(WidgetError);
  });

  test('thông điệp lỗi nói ĐƯỢC hai khả năng, không chỉ "timeout"', async ({ page }) => {
    await mo(page);
    const e = await chonGiaTri(page, 'cbTinh', 'Không Có').then(() => null, (x: Error) => x);
    expect(e, 'phải NÉM lỗi, không trả về bình thường').toBeInstanceOf(Error);
    expect(e!.message, 'phải nêu khả năng ô đang KHOÁ').toMatch(/KHOÁ/);
    expect(e!.message, 'và khả năng giá trị không có trong danh sách').toMatch(/không có trong danh sách/);
  });

  test('ô KHOÁ ⇒ `WidgetError`, và nêu rõ đó là lỗi bước', async ({ page }) => {
    await mo(page);
    const e = await chonGiaTri(page, 'cbKhoa', 'Tư thục').then(() => null, (x: Error) => x);
    expect(e).toBeInstanceOf(WidgetError);
    expect(e!.message).toMatch(/script_error|KHOÁ/);
  });
});

test.describe('@infra L0.5 widget — nối với dấu vân tay màn', () => {
  test('`lietKeTrenMan` thấy đủ combobox đang có', async ({ page }) => {
    /*
     * Dùng để đối chiếu với dấu vân tay màn của discovery (v2.6.0): màn khai 5 combobox mà trang chỉ có
     * 4 thì đó là tín hiệu hồi quy, và nó phải đo được chứ không phải nhìn bằng mắt.
     */
    await mo(page);
    const ds = await lietKeTrenMan(page);
    for (const id of ['cbCap', 'cbTinh', 'cbHuyen', 'cbKhoa', 'cbTron']) {
      expect(ds, `thiếu combobox ${id}`).toContain(id);
    }
  });
});
