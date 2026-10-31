import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as screens from '../lib/screens';
import * as textbox from '../lib/_widget/textbox';
import * as checkbox from '../lib/_widget/checkbox';
import * as form from '../lib/steps/form';

/*
 * §A0 — BUILDOUT THẬT CHO MỘT MODULE: L1 (mô hình màn) + L0.5 textbox/checkbox + L2 bước form.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * BA CON SỐ ĐO ĐƯỢC TRÊN DỮ LIỆU THẬT ĐỊNH HÌNH CẢ BỘ TẦNG NÀY (12/10/2026):
 *
 *   · Catalog của CSDL-9001 có neo control ở ĐÚNG MỘT cấp: THCS 87/89 (98%). Mầm non, Tiểu học, THPT,
 *     GDTX đều **0**. Tổng 87/433 = 20%. Nên L1 phải TRẢ VỀ ĐƯỢC trạng thái "màn chưa có neo".
 *   · Loại control của màn: input/text 67 · input/checkbox 18 · textarea 2. **KHÔNG CÓ RadComboBox
 *     nào** — sáu bước đầu của danh mục (toàn combobox) không dùng được cho module này.
 *   · **330/1.079 mệnh đề (31%)** trỏ field bằng `Stt #` chứ không bằng nhãn. Bỏ đường đó là bỏ gần một
 *     phần ba câu bước.
 *
 * Bộ test chạy trên app fixture OFFLINE, và fixture tái hiện đúng những ca đã trả giá: `maxlength` cắt
 * âm thầm, `readonly` khác `disabled`, nút WebForms là `input[value]`. Một fixture dễ hơn thực tế sẽ cho
 * các tầng này xanh rồi vỡ trên UAT.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * CHẠY FILE NÀY VỚI `--workers=1` KHI CHẠY CÙNG `widget-radcombobox.spec.ts`.
 *
 * Đo 12/10/2026: chạy cả bộ offline của v2.8.0 một lượt (8 file spec) thì `workers` mặc định = nửa số
 * core, nên nhiều file mở browser cùng lúc. Hai test của `widget-radcombobox` ĐỎ và cả lượt mất **2.1
 * giờ**; chạy riêng thì 17/17 trong 1.3 phút, và chạy hai file browser với `--workers=1` thì 47/47
 * trong 2.0 phút.
 *
 * Đó là BỎ ĐÓI do tranh chấp, không phải khiếm khuyết của thư viện — và phân biệt hai thứ đó quan trọng:
 * hai test kia đo HÀNH VI THEO THỜI GIAN (dropdown có hiện ra trong 15 giây không), nên nới ngưỡng chờ
 * để chúng xanh dưới tải là xoá mất đúng thứ chúng đo. Cố ý KHÔNG sửa `playwright.config.js`: nó là file
 * dùng chung, và đổi `workers` ở đó ảnh hưởng mọi lượt chạy của người khác (isolation §5).
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const app = require(path.join(REPO, 'tests/fe/fixtures/discovery-app/server.js'));

let srv: { url: string; close: () => Promise<void> } | null = null;
test.beforeAll(async () => { srv = await app.start(); });
test.afterAll(async () => { if (srv) await srv.close(); });

const mo = async (page: import('@playwright/test').Page) => {
  await page.goto(`${srv!.url}/ho-so`);
  await page.waitForLoadState('domcontentloaded');
};

/** Catalog fixture — khớp đúng trang `/ho-so` của app fixture. */
const CAT: screens.Catalog = {
  _control_anchor: 'Neo đo trên fixture ngày 12/10/2026.',
  screens: [
    {
      name: 'Hồ sơ fixture — THCS',
      url: '/ho-so',
      stt_nhan: { 1: 'Tên trường', 2: 'Mã định danh', 26: 'Diện tích đất', 85: 'Có Internet' },
      fields: [{
        name: 'I. Định danh',
        expectedFields: ['Tên trường', 'Mã định danh', 'Diện tích đất', 'Loại hình', 'Mã số thuế', 'Khoảng cách (tự hoàn nguyên)', 'Có Internet', 'Có điện (lưới)', 'Ghi chú', 'Nhãn không có neo'],
        controls: {
          'Tên trường': { name: 'tbTen', tag: 'input', type: 'text' },
          'Mã định danh': { name: 'tbMa', tag: 'input', type: 'text' },
          'Diện tích đất': { name: 'tbDienTich', tag: 'input', type: 'text' },
          'Loại hình': { name: 'tbKhoa', tag: 'input', type: 'text' },
          'Mã số thuế': { name: 'tbThue', tag: 'input', type: 'text', disabled: true },
          'Khoảng cách (tự hoàn nguyên)': { name: 'tbTuHoan', tag: 'input', type: 'text' },
          'Có Internet': { name: 'ckInternet', tag: 'input', type: 'checkbox' },
          'Có điện (lưới)': { name: 'ckDien', tag: 'input', type: 'checkbox' },
          'Ghi chú': { name: 'txGhiChu', tag: 'textarea' },
        },
      }],
    },
    /* Màn CHƯA CÓ NEO — bốn trên năm màn của CSDL-9001 đang ở đúng trạng thái này. */
    { name: 'Hồ sơ fixture — Mầm non', url: '/ho-so', fields: [{ name: 'I', expectedFields: ['Cơ sở GDMN'] }] },
  ],
};

const manTHCS = () => screens.man(CAT, 'THCS');

test.describe('@infra §A0 L1 — mô hình màn', () => {
  test('dựng được mô hình, đếm đúng expected và neo', () => {
    const m = manTHCS();
    expect(m.ten).toBe('Hồ sơ fixture — THCS');
    expect(m.so_expected).toBe(10);
    expect(m.so_neo).toBe(9);
    expect(m.chua_co_neo).toBe(false);
  });

  test('màn CHƯA CÓ NEO trả về trạng thái đó, KHÔNG ném khi dựng', () => {
    /* 4/5 màn của CSDL-9001 ở trạng thái này — ném khi dựng thì không ai đọc được báo cáo độ phủ. */
    const m = screens.man(CAT, 'Mầm non');
    expect(m.chua_co_neo).toBe(true);
    expect(m.so_expected).toBe(1);
  });

  test('tra ô trên màn chưa có neo thì NÉM, và nói rõ đó là trạng thái CATALOG', async ({ page }) => {
    /*
     * Một case đỏ vì thiếu neo mà báo như lỗi sản phẩm là gán sai tầng lỗi, và người ta đi tìm bug
     * trong app cho một artifact chưa đo.
     */
    const m = screens.man(CAT, 'Mầm non');
    expect(() => screens.o(page, m, 'Cơ sở GDMN')).toThrow(/trạng thái của catalog, KHÔNG phải lỗi sản phẩm/);
  });

  test('nhãn có expected mà KHÔNG có neo thì ném, và CẤM đổi expected để khớp app', async ({ page }) => {
    const m = manTHCS();
    expect(() => screens.o(page, m, 'Nhãn không có neo')).toThrow(/KHÔNG được đổi nhãn expected/);
  });

  test('tên màn khớp NHIỀU cái thì NÉM — chọn bừa là đo nhầm cấp học', () => {
    expect(() => screens.man(CAT, 'Hồ sơ fixture')).toThrow(/khớp 2 màn/);
  });

  test('định vị bằng `[name$=…]` vì `name` của WebForms có `$`', async ({ page }) => {
    await mo(page);
    const m = manTHCS();
    /* `#id` cũng khớp trên fixture, nhưng app thật chỉ có `name` — nên L1 phải dùng `name`. */
    await expect(screens.o(page, m, 'Tên trường')).toHaveValue('Truong THCS Fixture');
  });

  test('cảnh báo HẠN DÙNG của neo, và KHÔNG tự chặn', () => {
    /*
     * "Neo cũ" không có nghĩa "neo sai" — nhưng nó phải hiện ra: sổ tri thức có ca một probe 11 ngày
     * làm người đọc tưởng 6 ô đang sống là đã chết.
     */
    const cu = screens.man(CAT, 'THCS', new Date('2026-11-01T00:00:00Z'));
    expect(screens.canhBaoHanDung(cu)).toMatch(/đã \d+ ngày/);
    const moi = screens.man(CAT, 'THCS', new Date('2026-10-13T00:00:00Z'));
    expect(screens.canhBaoHanDung(moi)).toBeNull();
  });

  test('catalog KHÔNG ghi ngày đo ⇒ nói "không biết bao nhiêu tuổi"', () => {
    const m = screens.man({ screens: CAT.screens }, 'THCS');
    expect(m.neo_do_ngay).toBeNull();
    expect(screens.canhBaoHanDung(m)).toMatch(/KHÔNG ghi ngày đo/);
  });
});

test.describe('@infra §A0 L1 — tra field theo Stt đặc tả', () => {
  test('tra được khi catalog có bản đồ `stt_nhan`', async ({ page }) => {
    await mo(page);
    const m = manTHCS();
    expect(screens.nhanTheoStt(m, 26)).toBe('Diện tích đất');
    await expect(screens.oTheoStt(page, m, 26)).toHaveValue('1000');
  });

  test('KHÔNG có bản đồ ⇒ NÉM, và KHÔNG suy theo thứ tự `expectedFields`', async ({ page }) => {
    /*
     * Catalog tự ghi con số chứng minh vì sao không suy được: `screenIdx` khớp Stt đặc tả 10/89. Một
     * bản đồ đoán làm case ghi vào SAI Ô, và kết quả là một FAIL trông như lỗi sản phẩm.
     */
    const m = screens.man(CAT, 'Mầm non');
    expect(() => screens.oTheoStt(page, m, 1)).toThrow(/CHƯA CÓ bản đồ `stt_nhan`/);
    expect(() => screens.oTheoStt(page, m, 1)).toThrow(/KHÔNG suy theo thứ tự/);
  });

  test('có bản đồ nhưng thiếu Stt đó ⇒ thông điệp KHÁC hẳn ca thiếu bản đồ', async ({ page }) => {
    const m = manTHCS();
    expect(() => screens.oTheoStt(page, m, 999)).toThrow(/không có Stt 999/);
  });
});

test.describe('@infra §A0 L0.5 textbox — bốn bài học', () => {
  test('ghi rồi ĐỌC LẠI; `maxlength` cắt âm thầm thì NÉM kèm lý do', async ({ page }) => {
    /*
     * Bài học 3: `fill` 20 ký tự vào ô `maxlength=10` không báo gì. Case BVA đọc lại thấy khác và quy
     * cho sản phẩm. Thông điệp phải chỉ đúng vào `maxlength`.
     */
    await mo(page);
    const m = manTHCS();
    const o = screens.o(page, m, 'Mã định danh');
    expect(await textbox.maxlength(o)).toBe(10);
    await expect(textbox.ghi(page, o, '12345678901234567890')).rejects.toThrow(/maxlength=10 nên giá trị BỊ CẮT/);
  });

  test('ghi đúng độ dài thì qua', async ({ page }) => {
    await mo(page);
    const m = manTHCS();
    await form.nhapO(page, m, 'Mã định danh', '0123456789');
    expect(await form.docO(page, m, 'Mã định danh')).toBe('0123456789');
  });

  test('`maxlength` không khai ⇒ `null`, KHÁC `0`', async ({ page }) => {
    await mo(page);
    const m = manTHCS();
    expect(await textbox.maxlength(screens.o(page, m, 'Tên trường'))).toBeNull();
  });

  test('`readonly` và `disabled` CÙNG chặn `fill`, và phân biệt nhau ở `dau_hieu`', async ({ page }) => {
    /*
     * ĐO ĐƯỢC 12/10/2026, và nó bác kỳ vọng đầu tiên của tôi: `fill()` của Playwright ném cho CẢ HAI
     * (`element is not editable`), nên cả hai rơi vào `khong-tuong-tac-duoc`. Phân biệt chúng nằm ở
     * `dau_hieu` — lời khai của markup, được GHI LẠI chứ không dùng để kết luận (bài học 1).
     *
     * Giữ test này ở dạng "cùng trạng thái, khác dấu hiệu" thay vì sửa hàm cho ra hai trạng thái: hành
     * vi người dùng gặp là GIỐNG NHAU (không gõ được), và một trạng thái khai theo markup thì lại đúng
     * cái sai mà bài học 1 nói tới.
     */
    await mo(page);
    const m = manTHCS();
    const ro = await textbox.ghiDuoc(page, screens.o(page, m, 'Loại hình'));
    const dis = await textbox.ghiDuoc(page, screens.o(page, m, 'Mã số thuế'));
    expect(ro.ghi_duoc).toBe(false);
    expect(dis.ghi_duoc).toBe(false);
    expect(ro.trang_thai).toBe('khong-tuong-tac-duoc');
    expect(dis.trang_thai).toBe('khong-tuong-tac-duoc');
    expect(ro.dau_hieu.join(' ')).toContain('readonly');
    expect(dis.dau_hieu.join(' ')).toContain('disabled');
  });

  test('ô NHẬN được chữ rồi tự hoàn nguyên ⇒ trạng thái THỨ BA', async ({ page }) => {
    /*
     * `tuong-tac-duoc-nhung-khong-doi-duoc` khác hẳn ô khoá: người dùng gõ được, nhìn thấy chữ mình gõ,
     * rồi mất. Trước khi thêm ô fixture này, một trong ba trạng thái của `ghiDuoc()` chưa bao giờ được
     * thử — và một nhánh chưa thử là một nhánh có thể sai mà suite vẫn xanh.
     */
    await mo(page);
    const m = screens.man(CAT, 'THCS');
    const r = await textbox.ghiDuoc(page, screens.o(page, m, 'Khoảng cách (tự hoàn nguyên)'));
    expect(r.ghi_duoc).toBe(false);
    expect(r.trang_thai).toBe('tuong-tac-duoc-nhung-khong-doi-duoc');
    expect(r.dau_hieu, 'markup KHÔNG khai gì — nên lời khai markup không đủ để kết luận').toEqual([]);
  });

  test('ô mở ⇒ `ghi-duoc`, và giá trị gốc được trả lại', async ({ page }) => {
    await mo(page);
    const m = manTHCS();
    const r = await textbox.ghiDuoc(page, screens.o(page, m, 'Diện tích đất'));
    expect(r.trang_thai).toBe('ghi-duoc');
    expect(await form.docO(page, m, 'Diện tích đất'), 'phải về đúng giá trị gốc').toBe('1000');
  });

  test('`ghiRoiHoanNguyen` trả giá trị gốc và KIỂM việc hoàn nguyên', async ({ page }) => {
    /* Bài học 4: sổ tri thức có ca hậu kiểm báo "về gốc" là dương tính giả. */
    await mo(page);
    const m = manTHCS();
    const goc = await textbox.ghiRoiHoanNguyen(page, screens.o(page, m, 'Tên trường'), 'Gia tri thu');
    expect(goc).toBe('Truong THCS Fixture');
    expect(await form.docO(page, m, 'Tên trường')).toBe('Truong THCS Fixture');
  });

  test('`xoaTrangO` có xác nhận', async ({ page }) => {
    await mo(page);
    const m = manTHCS();
    await form.xoaTrangO(page, m, 'Diện tích đất');
    expect(await form.docO(page, m, 'Diện tích đất')).toBe('');
  });

  test('đọc được `textarea`, không chỉ `input`', async ({ page }) => {
    await mo(page);
    const m = manTHCS();
    await form.nhapO(page, m, 'Ghi chú', 'mot dong ghi chu');
    expect(await form.docO(page, m, 'Ghi chú')).toBe('mot dong ghi chu');
  });
});

test.describe('@infra §A0 L0.5 checkbox — ba bài học', () => {
  test('ô vốn đã đúng ⇒ `da-dung`, KHÔNG chạm vào nó', async ({ page }) => {
    /*
     * Bài học 1: `check()` của Playwright idempotent và IM LẶNG. Case đo "bấm vào ô đang tích thì có bỏ
     * tích không" sẽ không bấm lần nào, và kết quả là một phép đo rỗng trông như đã chạy.
     */
    await mo(page);
    const m = manTHCS();
    expect(await form.tichO(page, m, 'Có điện (lưới)', true)).toBe('da-dung');
    expect(await form.tichO(page, m, 'Có Internet', true)).toBe('da-doi');
  });

  test('`bamMotLan` thực hiện THAO TÁC, khác `datTrangThai` hướng tới TRẠNG THÁI', async ({ page }) => {
    await mo(page);
    const m = manTHCS();
    const r = await checkbox.bamMotLan(page, screens.o(page, m, 'Có điện (lưới)'));
    expect(r.truoc).toBe(true);
    expect(r.sau).toBe(false);
  });

  test('checkbox ở `th` là CHỌN TẤT CẢ; ở `td` thì không; ngoài bảng ⇒ `null`', async ({ page }) => {
    /*
     * Bài học 3: đoán `false` làm case tích "chọn tất cả" tưởng mình đang tích một dòng, và số dòng
     * được chọn sau đó sai hoàn toàn. Nên KHÔNG XÁC ĐỊNH ĐƯỢC phải trả `null`.
     */
    await mo(page);
    expect(await checkbox.laChonTatCa(page.locator('#ckAll'))).toBe(true);
    expect(await checkbox.laChonTatCa(page.locator('[name$="ckRow1"]'))).toBe(false);
    expect(await checkbox.laChonTatCa(page.locator('#ckInternet'))).toBeNull();
  });

  test('đọc cả một cột checkbox theo thứ tự dòng', async ({ page }) => {
    await mo(page);
    expect(await checkbox.docCot(page.locator('#grid tbody input[type=checkbox]'))).toEqual([false]);
  });
});

test.describe('@infra §A0 L2 — bước nghiệp vụ nhận NHÃN ĐẶC TẢ', () => {
  test('`nhapO` nhận nhãn, không nhận selector', async ({ page }) => {
    /*
     * Bước nhận selector thì câu bước phải mang `tbDienTich`, tức người viết case phải biết tên control
     * — và lúc đó `expectedFields` bắt đầu bị nắn về phía app.
     */
    await mo(page);
    const m = manTHCS();
    await form.nhapO(page, m, 'Diện tích đất', '2500');
    expect(await form.docO(page, m, 'Diện tích đất')).toBe('2500');
  });

  test('đường Stt dùng CÙNG một L0.5, cho cùng kết quả', async ({ page }) => {
    await mo(page);
    const m = manTHCS();
    await form.nhapOTheoStt(page, m, '26', '3500');
    expect(await form.docOTheoStt(page, m, '26')).toBe('3500');
    expect(await form.docO(page, m, 'Diện tích đất'), 'hai đường trỏ cùng một ô').toBe('3500');
  });

  test('`nhapLoat` giữ ĐÚNG THỨ TỰ khai', async ({ page }) => {
    /* Thứ tự là một phần của hợp đồng: ô có postback làm ô sau nạp lại. */
    await mo(page);
    const m = manTHCS();
    await form.nhapLoat(page, m, [
      { nhan: 'Tên trường', giaTri: 'A' },
      { nhan: 'Diện tích đất', giaTri: '7' },
    ]);
    expect(await form.docO(page, m, 'Tên trường')).toBe('A');
    expect(await form.docO(page, m, 'Diện tích đất')).toBe('7');
  });

  test('`bamNut` khớp `input[value]` — `hasText` KHÔNG khớp nút WebForms', async ({ page }) => {
    /* Sổ tri thức đã có ca mất thời gian vì đúng chuyện này. */
    await mo(page);
    await expect(page.locator('button', { hasText: 'Cập nhật' })).toHaveCount(0);
    await form.bamNut(page, 'Cập nhật');
  });

  test('`bamNut` không thấy nút thì NÉM, và nói đã thử những gì', async ({ page }) => {
    await mo(page);
    await expect(form.bamNut(page, 'Nút Không Tồn Tại')).rejects.toThrow(/đã thử cả/);
  });

  test('tầng L1, L0.5 và L2 đều KHÔNG chứa `expect` — luật vàng', () => {
    for (const f of ['screens/index.ts', '_widget/textbox.ts', '_widget/checkbox.ts', 'steps/form.ts']) {
      const src = fs.readFileSync(path.join(REPO, 'tests', 'fe', 'lib', f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
      expect(/\bexpect\s*\(/.test(src), `${f} chứa \`expect(\``).toBe(false);
    }
  });
});

/*
 * `ghiDuoc` không được NUỐT lỗi đọc thuộc tính — lỗi thật, `release:verify` lôi ra ngày 31/10/2026.
 *
 * Bản trước viết `o.getAttribute('readonly').catch(() => null)`, nên **"không đọc được"** và **"không có
 * thuộc tính"** ra cùng một kết quả. Dưới tải song song, lần đọc hết hạn rồi trả `null`, nên `dau_hieu`
 * mất hẳn dấu `readonly` của một ô THẬT SỰ có `readonly`.
 *
 * Triệu chứng: `buildout-hoso.spec.ts` đỏ ở `release:verify` nhưng xanh **30/30 ba lượt liền** khi chạy
 * riêng. Cùng lớp lỗi với "chờ hết hạn thành số đo": một phép đo không chạy được mà trả về giá trị trông
 * như số đo thì nó **nói sai**, không phải nói thiếu.
 *
 * Phép kiểm dưới đây KHÔNG cần trình duyệt: nó đưa vào một locator giả mà `getAttribute` luôn ném.
 */
test.describe('@infra §A0 L0.5 textbox — đọc thuộc tính không được nuốt lỗi', () => {
  /** Locator giả, chỉ đủ cho nhánh đọc thuộc tính. */
  const oGia = (loi: Error | null) => ({
    getAttribute: async () => { if (loi) throw loi; return null; },
  } as unknown as Parameters<typeof textbox.ghiDuoc>[1]);

  test('ĐỐI CHỨNG DƯƠNG: đọc thuộc tính HẾT HẠN ⇒ NÉM, không trả `null`', async ({ page }) => {
    const loi = new Error('locator.getAttribute: Timeout 5000ms exceeded.');
    await expect(textbox.ghiDuoc(page, oGia(loi))).rejects.toThrow(/không đọc được thuộc tính/);
    await expect(textbox.ghiDuoc(page, oGia(loi)), 'thông điệp phải nói rõ phép đo KHÔNG chạy được')
      .rejects.toThrow(/phép đo KHÔNG chạy được/);
  });

  test('ĐỐI CHỨNG ÂM: đọc được và thuộc tính KHÔNG có ⇒ không ném vì chuyện đó', async ({ page }) => {
    /*
     * Chiều này bắt buộc: nếu nhánh mới ném cả khi thuộc tính vắng mặt một cách bình thường thì mọi ô
     * không `readonly` đều thành lỗi script, và cả tầng widget hoá ra không dùng được.
     */
    let loiNem: Error | null = null;
    try { await textbox.ghiDuoc(page, oGia(null)); } catch (e) { loiNem = e as Error; }
    expect(String(loiNem && loiNem.message), 'ô bình thường KHÔNG được ném vì đọc thuộc tính')
      .not.toMatch(/không đọc được thuộc tính/);
  });
});
