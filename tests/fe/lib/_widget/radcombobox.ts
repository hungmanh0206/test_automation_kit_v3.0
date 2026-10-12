import type { Locator, Page } from '@playwright/test';

/*
 * L0.5 — WIDGET: Telerik `RadComboBox` (v2.8.0 §A, tầng chèn thêm).
 *
 * VÌ SAO TẦNG NÀY TỒN TẠI, có số đo. Khai thác 421 file automation của 4 task đã chạy (12/10/2026):
 *
 *     181 lần  #<ID>_DropDown li      chọn item
 *     150 lần  #<ID>_Arrow            mở dropdown
 *     144 lần  #<ID>_Input            đọc/ghi giá trị đang chọn
 *
 * 475/1.388 = **34% mọi lời gọi định vị** trong toàn bộ automation, rải rác ở 3–4 task khác nhau. Cộng
 * các mẫu Telerik còn lại thì 524 (38%). Đó là con số lớn nhất trong cả phép khai thác — lớn hơn mọi
 * "bước nghiệp vụ" nào.
 *
 * VÀ VÌ SAO NÓ KHÔNG THUỘC L1 (mô hình màn). Một `RadComboBox` xuất hiện ở hàng chục màn. Nếu cách thao
 * tác nó nằm trong từng Page Object thì nó bị chép lại THEO SỐ MÀN, và một lần sửa cách mở dropdown phải
 * sửa hàng chục chỗ — đúng tình trạng hiện tại. L0.5 gói theo **loại control**, L1 gói theo **màn**; hai
 * trục khác nhau nên không gộp được.
 *
 * ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
 * ║ NĂM BÀI HỌC DƯỚI ĐÂY LẤY TỪ CHÚ THÍCH CỦA CODE ĐÃ CHẠY THẬT, KHÔNG PHẢI TỪ TÀI LIỆU TELERIK.      ║
 * ║ Mỗi cái là một lượt đã sai rồi mới biết. Đừng "đơn giản hoá" chúng.                                ║
 * ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝
 *
 * 1. **Đã đúng giá trị thì ĐỪNG chọn lại.** Khi giá trị đang đúng, click vào ô KHÔNG bung dropdown, nên
 *    chờ item hiện sẽ timeout. Hai lượt đã sửa nhầm hướng chuyện này: đổ cho postback chậm rồi thêm chờ,
 *    trong khi nguyên nhân là KHÔNG CÓ GÌ ĐỂ CHỌN.
 *
 * 2. **Chờ dropdown HIỆN, không ngủ cố định.** RadComboBox render item sẵn vào DOM nhưng ẩn, nên `$$eval`
 *    đọc được item mà `click` thì timeout.
 *
 * 3. **"Mở được" = khung danh sách HIỆN RA, không phải "có item trong DOM".** Một lượt đếm item rồi kết
 *    luận "danh sách mở được" cho cả 9 combobox ĐANG KHOÁ — evidence tự mâu thuẫn với chính nó. Item có
 *    trong DOM kể cả khi ô bị khoá, nên đếm item không nói gì về việc người dùng mở được hay không.
 *
 * 4. **Vài combobox không bọc `rcbSlide`**, nên phép chờ ancestor đó phải được phép thất bại mà không làm
 *    chết cả bước.
 *
 * 5. **Có postback sau khi chọn.** Chọn ở combobox cha làm combobox con nạp lại; thao tác ngay sau đó
 *    trên combobox con sẽ chạm vào DOM cũ.
 *
 * LUẬT VÀNG CỦA TẦNG NÀY (v2.8.0 §A, luật L2–L4): **bước chỉ làm thao tác và tự xác nhận thao tác tới
 * đích. Bước KHÔNG chứa oracle.** Nên file này không có `expect` nào. Thao tác không tới đích thì ném
 * `WidgetError` để case thành `script_error`, KHÔNG âm thầm làm sai rồi để case PASS.
 */

/** Lỗi THAO TÁC của widget — khác hẳn một khẳng định nghiệp vụ sai. */
export class WidgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WidgetError';
  }
}

/** Ngưỡng chờ. Tách thành hằng để một lượt UAT chậm sửa được ở MỘT chỗ. */
export const CHO = {
  /** Dropdown hiện ra. UAT có lúc chậm, nên rộng tay. */
  dropDownMs: 15_000,
  /** Khung `rcbSlide` — ĐƯỢC PHÉP thất bại (bài học 4), nên ngưỡng ngắn. */
  slideMs: 2_000,
  /** Postback sau khi chọn (bài học 5). */
  postbackMs: 2_200,
};

/** Bộ locator của một `RadComboBox`, suy từ ID control do ASP.NET sinh. */
export function comboBox(page: Page, id: string) {
  const sach = String(id || '').replace(/^#/, '');
  if (!sach) throw new WidgetError('comboBox: thiếu id control.');
  return {
    id: sach,
    /** Ô hiện giá trị đang chọn. Đọc và ghi đều qua đây. */
    input: page.locator(`#${sach}_Input`),
    /** Mũi tên mở dropdown. */
    arrow: page.locator(`#${sach}_Arrow`),
    /** Khung dropdown. `isVisible` của nó là phép thử "mở được" THẬT (bài học 3). */
    dropDown: page.locator(`#${sach}_DropDown`),
    /** Các item trong dropdown. */
    items: page.locator(`#${sach}_DropDown li.rcbItem`),
    /** Khung trượt bọc ngoài — không phải combobox nào cũng có (bài học 4). */
    slide: page.locator(`#${sach}_DropDown`)
      .locator('xpath=ancestor-or-self::div[contains(@class,"rcbSlide")][1]'),
  };
}

/** Giá trị đang chọn. Chuỗi rỗng nếu chưa chọn gì hoặc ô không đọc được. */
export async function docGiaTri(page: Page, id: string): Promise<string> {
  const c = comboBox(page, id);
  return (await c.input.inputValue().catch(() => '')).trim();
}

/**
 * Danh sách item trong dropdown.
 *
 * CẢNH BÁO (bài học 3): hàm này đọc DOM, nên nó trả về item KỂ CẢ KHI ô đang khoá. Đừng dùng nó để kết
 * luận "người dùng chọn được những giá trị này" — dùng `moDuocDropdown` cho câu đó.
 */
export async function docItems(page: Page, id: string): Promise<string[]> {
  const c = comboBox(page, id);
  const t = await c.items.allTextContents().catch(() => [] as string[]);
  return t.map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/**
 * Người dùng CÓ MỞ ĐƯỢC dropdown không — đo bằng việc khung danh sách HIỆN RA.
 *
 * Đây là phép đo đúng cho câu "ô này có khoá không", và nó khác hẳn `docItems().length > 0` (bài học 3).
 */
export async function moDuocDropdown(page: Page, id: string): Promise<boolean> {
  const c = comboBox(page, id);
  await c.input.click({ timeout: CHO.slideMs }).catch(() => { /* ô khoá thì click không ăn */ });
  return c.dropDown.first().isVisible({ timeout: CHO.slideMs }).catch(() => false);
}

/**
 * CHỌN một giá trị. Tự xác nhận thao tác tới đích (giá trị sau khi chọn đúng là giá trị đã yêu cầu).
 *
 * Trả về `'da-dung'` nếu không cần làm gì (bài học 1), `'da-chon'` nếu đã chọn. Phân biệt hai kết cục đó
 * cố ý: một bước báo "đã chọn" trong khi nó không làm gì là một lời khai sai, và nó làm người đọc log
 * tưởng postback đã xảy ra.
 */
export async function chonGiaTri(
  page: Page,
  id: string,
  giaTri: string,
  opts: { choPostbackMs?: number } = {},
): Promise<'da-dung' | 'da-chon'> {
  const muon = String(giaTri ?? '').trim();
  if (!muon) throw new WidgetError(`chonGiaTri(${id}): giá trị cần chọn rỗng.`);
  const c = comboBox(page, id);

  /* Bài học 1 — đã đúng thì dừng. Click vào ô đang đúng giá trị KHÔNG bung dropdown. */
  if ((await docGiaTri(page, id)) === muon) return 'da-dung';

  await c.input.click({ timeout: CHO.dropDownMs });

  /* Bài học 4 — `rcbSlide` không phải lúc nào cũng có, nên phép chờ này được phép thất bại. */
  await c.slide.first().waitFor({ state: 'visible', timeout: CHO.slideMs }).catch(() => {});

  /* Bài học 2 — chờ item HIỆN, không ngủ cố định. */
  const item = page.locator(`#${c.id}_DropDown li.rcbItem`, { hasText: muon }).first();
  await item.waitFor({ state: 'visible', timeout: CHO.dropDownMs }).catch(() => {
    throw new WidgetError(
      `chonGiaTri(${id}): không thấy item "${muon}" hiện ra sau ${CHO.dropDownMs}ms. `
      + 'Ô có thể đang KHOÁ (item vẫn nằm trong DOM nhưng dropdown không mở), hoặc giá trị không có trong danh sách.',
    );
  });
  await item.click({ timeout: CHO.dropDownMs });

  /* Bài học 5 — chọn xong có postback; combobox con sẽ nạp lại. */
  await page.waitForTimeout(opts.choPostbackMs ?? CHO.postbackMs);

  /*
   * NGHIỆM THU THAO TÁC, không phải phán nghiệp vụ. Đây là chỗ phân biệt "bước hỏng" với "sản phẩm sai":
   * nếu giá trị sau khi chọn không phải giá trị đã yêu cầu thì BƯỚC thất bại, và case phải thành
   * `script_error` chứ không thành FAIL nghiệp vụ.
   */
  const sau = await docGiaTri(page, id);
  if (sau !== muon) {
    throw new WidgetError(
      `chonGiaTri(${id}): đã click item "${muon}" nhưng ô hiện "${sau}". `
      + 'Thao tác KHÔNG tới đích — đây là lỗi bước (script_error), không phải kết luận nghiệp vụ.',
    );
  }
  return 'da-chon';
}

/**
 * CHUỖI COMBOBOX PHỤ THUỘC — chọn lần lượt, chờ postback giữa các bước.
 *
 * Màn login của hệ này có 5 `RadComboBox` nối tầng, và chọn sai thứ tự thì combobox sau nạp lại rỗng.
 * Gói thành một hàm để thứ tự không bị viết lại (và viết sai) ở từng spec.
 */
export async function chonChuoi(
  page: Page,
  cap: Array<{ id: string; giaTri: string }>,
  opts: { choPostbackMs?: number } = {},
): Promise<Array<'da-dung' | 'da-chon'>> {
  const ra: Array<'da-dung' | 'da-chon'> = [];
  for (const b of cap) {
    ra.push(await chonGiaTri(page, b.id, b.giaTri, opts));
  }
  return ra;
}

/** Ba kết cục của phép đo "ô này có khoá không". Gộp chúng lại là mất đúng thông tin dev cần. */
export type TrangThaiKhoa =
  | 'mo'                              /* đổi được giá trị */
  | 'khong-mo-duoc-danh-sach'         /* dropdown không hiện */
  | 'mo-duoc-nhung-khong-doi-duoc';   /* dropdown hiện, click item mà giá trị không đổi */

/**
 * Ô có đang KHOÁ không — ĐO BẰNG HÀNH VI, không tin lời khai của markup.
 *
 * ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
 * ║ HAI BÀI HỌC NỮA, lấy từ chú thích của `o-chi-xem.spec.ts` đã chạy thật trên UAT:                   ║
 * ║                                                                                                   ║
 * ║ · "Ô có thuộc tính `disabled`" KHÔNG ĐỦ. Thuộc tính là LỜI KHAI CỦA MARKUP; thứ cần biết là thao   ║
 * ║   tác vào thì ô có nhận hay không. Nên phép đo phải THỬ rồi đọc lại.                                ║
 * ║                                                                                                   ║
 * ║ · Với combobox, "không mở được danh sách" và "mở được nhưng không đổi được giá trị" là HAI hành vi  ║
 * ║   khác nhau. Đặc tả chấp nhận cả hai, nhưng dev cần biết app đang làm cái nào — nên ghi nhận riêng. ║
 * ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝
 *
 * VÀ MỘT BÀI HỌC CỦA CHÍNH LƯỢT NÀY: bản đầu của hàm này dùng `input[readonly]` làm dấu hiệu khoá, và nó
 * báo KHOÁ cho **mọi** combobox. Lý do: `readonly` là trạng thái BÌNH THƯỜNG của `RadComboBox` — người
 * dùng chọn từ danh sách chứ không gõ vào ô. Dùng nó làm dấu hiệu khoá là biến một đặc điểm của widget
 * thành một kết luận về quyền. Test fixture bắt được ngay.
 *
 * Thuộc tính vẫn được GHI LẠI trong `dau_hieu` — chúng là ngữ cảnh hữu ích cho người đọc log, chỉ không
 * phải căn cứ của kết luận.
 */
export async function dangKhoa(
  page: Page,
  id: string,
): Promise<{ khoa: boolean; trang_thai: TrangThaiKhoa; dau_hieu: string[] }> {
  const c = comboBox(page, id);
  const dh: string[] = [];

  /* Lời khai của markup — GHI LẠI, không dùng để kết luận. `readonly` cố ý không có ở đây. */
  const dis = await c.input.getAttribute('disabled').catch(() => null);
  const cls = (await c.input.getAttribute('class').catch(() => '')) || '';
  if (dis !== null) dh.push('markup: input[disabled]');
  if (/rcbDisabled|aspNetDisabled/i.test(cls)) dh.push(`markup: class chứa rcbDisabled`);

  /* PHÉP ĐO 1 — mở được danh sách không. */
  if (!(await moDuocDropdown(page, id))) {
    dh.push('hành vi: dropdown KHÔNG hiện sau khi click');
    return { khoa: true, trang_thai: 'khong-mo-duoc-danh-sach', dau_hieu: dh };
  }
  dh.push('hành vi: dropdown hiện ra');

  /*
   * PHÉP ĐO 2 — mở được rồi thì có ĐỔI được không.
   *
   * Chọn một item KHÁC giá trị hiện tại rồi đọc lại. Nếu không có item nào khác thì KHÔNG kết luận được
   * — trả `mo` kèm dấu hiệu nói rõ, chứ không đoán.
   */
  const truoc = await docGiaTri(page, id);
  const items = await docItems(page, id);
  const khac = items.find((x) => x !== truoc);
  if (!khac) {
    dh.push('không có item nào khác giá trị hiện tại ⇒ KHÔNG đo được phép đổi');
    return { khoa: false, trang_thai: 'mo', dau_hieu: dh };
  }

  const item = page.locator(`#${c.id}_DropDown li.rcbItem`, { hasText: khac }).first();
  await item.click({ timeout: CHO.slideMs }).catch(() => {});
  await page.waitForTimeout(CHO.postbackMs);
  const sau = await docGiaTri(page, id);

  /* Trả lại giá trị ban đầu — phép đo không được để lại trạng thái đã đổi. */
  if (sau !== truoc) await chonGiaTri(page, id, truoc).catch(() => {});

  if (sau === truoc) {
    dh.push(`hành vi: click item "${khac}" mà giá trị vẫn "${truoc}"`);
    return { khoa: true, trang_thai: 'mo-duoc-nhung-khong-doi-duoc', dau_hieu: dh };
  }
  dh.push(`hành vi: đổi được sang "${sau}" rồi trả lại "${truoc}"`);
  return { khoa: false, trang_thai: 'mo', dau_hieu: dh };
}

/** Mọi id `RadComboBox` đang có trên màn. Dùng để đối chiếu với dấu vân tay màn của discovery. */
export async function lietKeTrenMan(page: Page): Promise<string[]> {
  return page.$$eval('input[id$="_Input"]', (els: Element[]) => els
    .map((e) => (e as HTMLInputElement).id.replace(/_Input$/, ''))
    .filter(Boolean));
}

/** Locator thô, cho trường hợp cần đi ra ngoài bộ hàm trên. Xuất ra để không ai phải tự đoán lại hậu tố. */
export const HAU_TO = { input: '_Input', arrow: '_Arrow', dropDown: '_DropDown', item: 'li.rcbItem' } as const;

export type ComboBox = ReturnType<typeof comboBox>;
export type { Locator };
