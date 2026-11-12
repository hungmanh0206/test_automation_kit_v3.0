import type { Locator, Page } from '@playwright/test';

/*
 * L0.5 — WIDGET: ô nhập chữ (`input[type=text]` và `textarea`) của ASP.NET WebForms.
 *
 * VÌ SAO TẦNG NÀY TỒN TẠI, có số đo. Đo trên catalog thật của TASK-9001 (12/10/2026): màn Hồ sơ trường
 * có **67 input/text + 2 textarea** trên 87 neo control — tức **79% control của màn là ô nhập chữ**, và
 * KHÔNG có RadComboBox nào. Sáu bước đầu của danh mục (toàn combobox) không dùng được cho module này.
 *
 * ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
 * ║ BỐN BÀI HỌC, cả bốn lấy từ ca đã trả giá thật trong dự án này — không phải từ tài liệu.           ║
 * ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝
 *
 * 1. **`readonly` của RadComboBox là trạng thái BÌNH THƯỜNG, nhưng của ô nhập chữ thì KHÔNG.** Một lượt
 *    trước đã dùng `input[readonly]` làm dấu hiệu khoá cho mọi loại control và báo KHOÁ cho tất cả. Ở
 *    đây `readonly`/`disabled` là dấu hiệu thật, nhưng vẫn phải ĐO BẰNG HÀNH VI mới kết luận được: thử
 *    ghi rồi đọc lại.
 *
 * 2. **`fill()` không phát đủ sự kiện cho vài ô WebForms.** Ô có `onchange` phía server cần `blur` mới
 *    chạy validate, nên sau khi ghi phải rời ô — nếu không, lượt bấm Lưu ngay sau đó gửi giá trị cũ.
 *
 * 3. **`maxlength` CẮT ÂM THẦM.** Ghi 20 ký tự vào ô `maxlength=10` thì `fill` không báo gì, giá trị chỉ
 *    còn 10. Case BVA đọc lại thấy khác và quy cho sản phẩm. Nên `ghi()` ĐỌC LẠI và ném khi lệch, kèm
 *    `maxlength` đo được — để cái đỏ chỉ đúng vào nguyên nhân.
 *
 * 4. **Hoàn nguyên phải có KIỂM.** Sổ tri thức có ca `hoanNguyen` không trả lại được ô readonly mà hậu
 *    kiểm vẫn báo "về gốc" — một dương tính giả. Nên `ghiRoiHoanNguyen()` đọc lại sau khi hoàn nguyên và
 *    ném nếu không về đúng giá trị cũ.
 *
 * LUẬT VÀNG (v2.8.0 §A, luật L2–L4): tầng này KHÔNG chứa `expect`. Thao tác không tới đích thì ném
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
  /** Ô hiện ra và nhận được tương tác. */
  oMs: 10_000,
  /** Postback sau khi rời ô (bài học 2). */
  blurMs: 1_200,
};

/** Ba kết cục của phép đo "ô này có sửa được không". Gộp lại là mất đúng thông tin dev cần. */
export type TrangThaiGhi =
  | 'ghi-duoc'
  | 'khong-tuong-tac-duoc'
  | 'tuong-tac-duoc-nhung-khong-doi-duoc';

/** Đọc giá trị đang có. */
export async function docGiaTri(o: Locator): Promise<string> {
  await o.waitFor({ state: 'attached', timeout: CHO.oMs });
  return (await o.inputValue().catch(async () => (await o.textContent()) || '')) ?? '';
}

/** `maxlength` app khai, hoặc `null` khi không khai. `null` KHÁC `0`. */
export async function maxlength(o: Locator): Promise<number | null> {
  const v = await o.getAttribute('maxlength').catch(() => null);
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Ghi giá trị rồi ĐỌC LẠI để xác nhận thao tác tới đích.
 *
 * Ném `WidgetError` khi giá trị đọc lại khác giá trị muốn ghi, và thông điệp nói rõ `maxlength` đo được —
 * đó là nguyên nhân hay gặp nhất (bài học 3), và nói ra nó giúp người đọc khỏi quy cho sản phẩm.
 */
export async function ghi(page: Page, o: Locator, giaTri: string): Promise<void> {
  await o.waitFor({ state: 'visible', timeout: CHO.oMs });
  await o.fill(String(giaTri));
  /* Bài học 2 — rời ô để `onchange` phía server chạy. */
  await o.blur().catch(() => {});
  await page.waitForTimeout(CHO.blurMs);

  const sau = await docGiaTri(o);
  if (sau === String(giaTri)) return;

  const ml = await maxlength(o);
  const bimCat = ml !== null && String(giaTri).length > ml && sau === String(giaTri).slice(0, ml);
  throw new WidgetError(
    `ghi(): ghi ${JSON.stringify(giaTri)} nhưng đọc lại ${JSON.stringify(sau)}`
    + (bimCat ? ` — ô có maxlength=${ml} nên giá trị BỊ CẮT, đây là giới hạn của ô chứ không phải lỗi lưu.` : '')
    + (!bimCat && ml !== null ? ` (maxlength=${ml})` : ''),
  );
}

/**
 * Đo ô có ghi được không, BẰNG HÀNH VI, rồi trả lại giá trị gốc.
 *
 * Trả ba trạng thái, không trả một cờ. Lời khai của markup (`disabled`/`readonly`) được GHI LẠI ở
 * `dau_hieu` nhưng KHÔNG dùng để kết luận — bài học 1.
 */
export async function ghiDuoc(page: Page, o: Locator): Promise<{ ghi_duoc: boolean; trang_thai: TrangThaiGhi; dau_hieu: string[] }> {
  const dh: string[] = [];
  /*
   * ĐỌC THUỘC TÍNH KHÔNG ĐƯỢC NUỐT LỖI — và đây là một lỗi thật, `release:verify` lôi ra.
   *
   * Bản trước viết `.catch(() => null)`, nên "KHÔNG ĐỌC ĐƯỢC" và "KHÔNG CÓ thuộc tính" ra cùng một kết
   * quả. Dưới tải song song, lần đọc hết hạn rồi trả `null`, nên `dau_hieu` mất hẳn dấu `readonly` của
   * một ô thật sự có `readonly`.
   *
   * Đo 31/10/2026: đúng chỗ này làm `buildout-hoso.spec.ts` đỏ ở `release:verify` nhưng xanh 30/30 ba
   * lượt khi chạy riêng. Cùng lớp lỗi với "chờ hết hạn thành số đo": một phép đo không chạy được mà trả
   * về giá trị trông như số đo thì nó nói sai, không phải nói thiếu.
   *
   * Nên: đọc không được thì NÉM. `dau_hieu` là lời khai của markup, được ghi lại chứ không dùng để kết
   * luận — nhưng nó phải là lời khai THẬT, không phải khoảng trống do hết hạn.
   */
  const docThuocTinh = async (ten: string): Promise<string | null> => {
    try {
      return await o.getAttribute(ten, { timeout: CHO.oMs });
    } catch (e) {
      throw new WidgetError(`không đọc được thuộc tính \`${ten}\` của ô: ${(e as Error).message.split('\n')[0].slice(0, 90)}`
        + ' — phép đo KHÔNG chạy được, và "không đọc được" KHÔNG đồng nghĩa với "không có thuộc tính".');
    }
  };
  const dis = await docThuocTinh('disabled');
  const ro = await docThuocTinh('readonly');
  if (dis !== null) dh.push('markup khai `disabled`');
  if (ro !== null) dh.push('markup khai `readonly`');

  const goc = await docGiaTri(o);
  /* Giá trị thử phải KHÁC giá trị gốc, nếu không phép đo không nói gì. */
  const thu = `${goc}x`.slice(0, Math.max(1, (await maxlength(o)) ?? 64));
  if (thu === goc) {
    return { ghi_duoc: false, trang_thai: 'tuong-tac-duoc-nhung-khong-doi-duoc', dau_hieu: [...dh, 'không dựng được giá trị thử khác giá trị gốc'] };
  }

  let tuongTacDuoc = true;
  try {
    await o.fill(thu, { timeout: CHO.oMs });
  } catch (e) {
    tuongTacDuoc = false;
    dh.push(`fill ném: ${(e as Error).message.split('\n')[0].slice(0, 80)}`);
  }

  /*
   * RỜI Ô TRƯỚC KHI ĐỌC LẠI — và đây là một lỗi thật của bản đầu, phát hiện bằng chính fixture.
   *
   * Bản đầu đọc lại ngay sau `fill`, không blur. Một ô bị JS/postback nắn về giá trị cũ KHI RỜI Ô vẫn
   * giữ chữ vừa gõ ở thời điểm đó, nên hàm báo `ghi-duoc` cho một ô mà người dùng không ghi được gì.
   * Tệ hơn: `ghi()` ở trên CÓ blur, nên hai hàm trong cùng file nói hai điều khác nhau về cùng một ô —
   * và cái sai lại là hàm ĐO, tức cái dùng để kết luận.
   *
   * Giá trị biến mất khi rời ô thì nó chưa bao giờ được ghi.
   */
  if (tuongTacDuoc) {
    await o.blur().catch(() => {});
    await page.waitForTimeout(CHO.blurMs);
  }

  const sau = tuongTacDuoc ? await docGiaTri(o) : goc;
  /* Hoàn nguyên, và KIỂM việc hoàn nguyên — bài học 4. */
  if (sau !== goc) {
    await o.fill(goc).catch(() => {});
    await o.blur().catch(() => {});
    const ve = await docGiaTri(o);
    if (ve !== goc) {
      throw new WidgetError(
        `ghiDuoc(): KHÔNG hoàn nguyên được. Gốc ${JSON.stringify(goc)}, hiện ${JSON.stringify(ve)}. `
        + 'Đừng báo "đã về gốc" khi chưa đọc lại — đó là dương tính giả đã xảy ra thật.',
      );
    }
  }

  if (!tuongTacDuoc) return { ghi_duoc: false, trang_thai: 'khong-tuong-tac-duoc', dau_hieu: dh };
  if (sau === goc) return { ghi_duoc: false, trang_thai: 'tuong-tac-duoc-nhung-khong-doi-duoc', dau_hieu: dh };
  return { ghi_duoc: true, trang_thai: 'ghi-duoc', dau_hieu: dh };
}

/**
 * Ghi một giá trị rồi hoàn nguyên — dùng cho case chỉ cần ĐO phản ứng, không cần để lại dấu.
 *
 * Trả giá trị gốc để người gọi ghi vào evidence. Hoàn nguyên có KIỂM (bài học 4).
 */
export async function ghiRoiHoanNguyen(page: Page, o: Locator, giaTri: string): Promise<string> {
  const goc = await docGiaTri(o);
  await ghi(page, o, giaTri);
  await o.fill(goc).catch(() => {});
  await o.blur().catch(() => {});
  await page.waitForTimeout(CHO.blurMs);
  const ve = await docGiaTri(o);
  if (ve !== goc) {
    throw new WidgetError(`ghiRoiHoanNguyen(): KHÔNG về được giá trị gốc ${JSON.stringify(goc)}, hiện ${JSON.stringify(ve)}.`);
  }
  return goc;
}

/** Xoá trắng ô, có xác nhận. */
export async function xoaTrang(page: Page, o: Locator): Promise<void> {
  await ghi(page, o, '');
}
