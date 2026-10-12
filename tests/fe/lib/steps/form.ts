import type { Page } from '@playwright/test';
import * as screens from '../screens';
import * as textbox from '../_widget/textbox';
import * as checkbox from '../_widget/checkbox';

/*
 * L2 — BƯỚC NGHIỆP VỤ trên form: nhận NHÃN ĐẶC TẢ, không nhận selector (v2.8.0 §A).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * TẦNG NÀY LÀ CHỖ CÂU BƯỚC CỦA QA GẶP CODE.
 *
 * Case viết `Nhập "Diện tích đất" = "5000"`. Nhãn đó là chữ của ĐẶC TẢ, và nó phải đi nguyên vẹn vào
 * lời gọi — L1 lo việc tra nó ra control thật. Bước nhận selector thì câu bước phải mang `tbDienTich`,
 * tức người viết case phải biết tên control, và lúc đó `expectedFields` bắt đầu bị nắn về phía app.
 *
 * VÌ SAO BƯỚC Ở ĐÂY MÀ KHÔNG Ở L0.5. L0.5 gói theo LOẠI CONTROL (một `textbox` dùng ở mọi màn), L2 gói
 * theo VIỆC NGHIỆP VỤ ("điền một ô của form hồ sơ"). Trộn hai trục thì một lần sửa cách ghi ô phải sửa
 * theo số màn — đúng tình trạng của 421 file automation cũ.
 *
 * ĐO 12/10/2026 trên 1.079 mệnh đề của CSDL-9001: ba khung câu dưới đây phủ phần lớn phần "điền form".
 * Khung `nhập "<nhãn>" = "<giá trị>"` một mình đã là khung lặp nhiều nhất của cả module.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * LUẬT VÀNG (v2.8.0 §A, luật L2–L4): **bước chỉ làm thao tác và tự xác nhận thao tác tới đích. Bước
 * KHÔNG chứa oracle.** File này không có `expect` nào. Giá trị kỳ vọng đến từ ô `Kết quả mong đợi` của
 * case và được `_checks/` kiểm — không bước nào ở đây biết "đúng" là gì.
 */

/** Mô hình màn đang làm việc. Người gọi dựng một lần rồi truyền vào từng bước. */
export type Man = screens.MoHinhMan;

/**
 * Nhập một ô theo NHÃN ĐẶC TẢ.
 *
 * Ghi rồi ĐỌC LẠI (L0.5 làm), nên ô bị `maxlength` cắt âm thầm sẽ ném `WidgetError` thay vì để case đọc
 * lại thấy khác rồi quy cho sản phẩm.
 */
export async function nhapO(page: Page, man: Man, nhan: string, giaTri: string): Promise<void> {
  await textbox.ghi(page, screens.o(page, man, nhan), giaTri);
}

/** Đọc giá trị một ô theo nhãn đặc tả. Bước ĐỌC — không đổi trạng thái màn. */
export async function docO(page: Page, man: Man, nhan: string): Promise<string> {
  return textbox.docGiaTri(screens.o(page, man, nhan));
}

/** Xoá trắng một ô, có xác nhận. */
export async function xoaTrangO(page: Page, man: Man, nhan: string): Promise<void> {
  await textbox.xoaTrang(page, screens.o(page, man, nhan));
}

/**
 * Đo một ô có SỬA ĐƯỢC không, bằng hành vi, rồi trả lại giá trị gốc.
 *
 * Trả ba trạng thái của L0.5, không trả một cờ: `khong-tuong-tac-duoc` và
 * `tuong-tac-duoc-nhung-khong-doi-duoc` là hai chuyện khác nhau với dev, và gộp lại là mất đúng thông
 * tin họ cần.
 */
export async function doOSuaDuoc(page: Page, man: Man, nhan: string) {
  return textbox.ghiDuoc(page, screens.o(page, man, nhan));
}

/** Tích hoặc bỏ tích một ô theo nhãn đặc tả. Trả `'da-dung'` khi ô vốn đã đúng — KHÔNG chạm vào nó. */
export async function tichO(page: Page, man: Man, nhan: string, co: boolean): Promise<'da-dung' | 'da-doi'> {
  return checkbox.datTrangThai(page, screens.o(page, man, nhan), co);
}

/** Trạng thái tích của một ô theo nhãn đặc tả. Bước ĐỌC. */
export async function docTichO(page: Page, man: Man, nhan: string): Promise<boolean> {
  return checkbox.dangTich(screens.o(page, man, nhan));
}

/*
 * ── Đường thứ hai: trỏ field bằng Stt ĐẶC TẢ ──────────────────────────────────────────────────────
 *
 * Đo trên 1.079 mệnh đề của CSDL-9001: **330 mệnh đề (31%)** trỏ field bằng `Stt #` chứ không bằng nhãn.
 * Bỏ đường này là bỏ gần một phần ba câu bước của module.
 *
 * VÌ SAO LÀ HÀM RIÊNG, KHÔNG PHẢI THAM SỐ THỨ HAI CỦA `nhapO`. Danh mục bước gắn số tham số cho TỪNG
 * BƯỚC, và bộ khớp dùng đúng con số đó để phân biệt `exact` với `fuzzy`. Nhồi cả hai cách trỏ vào một
 * bước làm số tham số của bước không còn nhất quán giữa các `phrases` — thử rồi, và nó làm mọi câu của
 * bước đó tụt xuống `fuzzy`. Một cách trỏ, một bước.
 *
 * L1 KHÔNG suy Stt theo thứ tự: bản đồ `stt_nhan` là dữ liệu đo được của lớp PROJECT, sinh bằng
 * `stt:map`. Thiếu nó thì `screens.oTheoStt` ném kèm lời giải thích thay vì đoán.
 */

/** Nhập một ô theo Stt đặc tả. */
export async function nhapOTheoStt(page: Page, man: Man, stt: string, giaTri: string): Promise<void> {
  await textbox.ghi(page, screens.oTheoStt(page, man, stt), giaTri);
}

/** Đọc giá trị một ô theo Stt đặc tả. Bước ĐỌC. */
export async function docOTheoStt(page: Page, man: Man, stt: string): Promise<string> {
  return textbox.docGiaTri(screens.oTheoStt(page, man, stt));
}

/** Xoá trắng một ô theo Stt đặc tả. */
export async function xoaTrangOTheoStt(page: Page, man: Man, stt: string): Promise<void> {
  await textbox.xoaTrang(page, screens.oTheoStt(page, man, stt));
}

/** Đo một ô theo Stt đặc tả có sửa được không, rồi trả lại giá trị gốc. */
export async function doOSuaDuocTheoStt(page: Page, man: Man, stt: string) {
  return textbox.ghiDuoc(page, screens.oTheoStt(page, man, stt));
}

/** Tích hoặc bỏ tích một checkbox theo Stt đặc tả. */
export async function tichOTheoStt(page: Page, man: Man, stt: string, co: boolean): Promise<'da-dung' | 'da-doi'> {
  return checkbox.datTrangThai(page, screens.oTheoStt(page, man, stt), co);
}

/**
 * Điền một LOẠT ô theo thứ tự khai.
 *
 * THỨ TỰ LÀ MỘT PHẦN CỦA HỢP ĐỒNG, không phải chi tiết thi hành: ô có postback làm ô sau nạp lại, và
 * điền song song là làm hỏng form. Cùng lý lẽ với `chonChuoi` của tầng combobox.
 */
export async function nhapLoat(page: Page, man: Man, cap: Array<{ nhan: string; giaTri: string }>): Promise<void> {
  for (const c of cap) await nhapO(page, man, c.nhan, c.giaTri);
}

/**
 * Bấm một nút theo NHÃN HIỂN THỊ.
 *
 * Nút của WebForms là `input[type=submit][value="..."]`, nên `getByRole('button', {name})` và `hasText`
 * đều KHÔNG khớp — sổ tri thức đã có ca mất thời gian vì đúng chuyện này. Thử `value` trước, rồi mới tới
 * `button`/`a`.
 */
export async function bamNut(page: Page, nhan: string): Promise<void> {
  const ungVien = [
    page.locator(`input[type="submit"][value="${nhan}"]`),
    page.locator(`input[type="button"][value="${nhan}"]`),
    page.locator('button', { hasText: nhan }),
    page.locator('a', { hasText: nhan }),
  ];
  for (const u of ungVien) {
    if (await u.count().catch(() => 0)) {
      await u.first().click({ timeout: textbox.CHO.oMs });
      return;
    }
  }
  throw new screens.ScreenError(
    `bamNut("${nhan}"): không thấy nút nào. Nút WebForms là \`input[value]\` nên \`hasText\` không khớp — `
    + 'đã thử cả `input[type=submit|button][value]`, `button` và `a`.',
  );
}
