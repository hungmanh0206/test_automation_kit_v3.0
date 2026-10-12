import type { Locator, Page } from '@playwright/test';

/*
 * L0.5 — WIDGET: checkbox của ASP.NET WebForms.
 *
 * VÌ SAO TẦNG NÀY TỒN TẠI, có số đo: 18/87 neo control của màn Hồ sơ trường là `input/checkbox` (21%),
 * đo trên catalog thật của CSDL-9001 ngày 12/10/2026.
 *
 * ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
 * ║ BA BÀI HỌC, cả ba từ ca đã trả giá thật trong dự án này.                                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝
 *
 * 1. **`check()` của Playwright là IDEMPOTENT và im lặng.** Gọi `check()` trên ô ĐÃ tích thì nó không
 *    làm gì và không báo gì. Case muốn đo "bấm vào checkbox đang tích thì có bỏ tích không" sẽ không
 *    bấm lần nào, và kết quả là một phép đo rỗng trông như đã chạy. Nên `datTrangThai()` ĐỌC trước, và
 *    trả `'da-dung'` khi không cần chạm — phân biệt đó quan trọng với case đo postback.
 *
 * 2. **Checkbox WebForms có postback.** Tích một ô làm cả lưới nạp lại; thao tác ngay sau đó chạm DOM cũ.
 *
 * 3. **Ô tiêu đề cột "Chọn" là checkbox CHỌN TẤT CẢ, không phải một field.** Catalog không phân biệt, nên
 *    người gọi phải tự biết — tầng này chỉ nói ra điều đo được: `laChonTatCa()` dựa vào việc ô có nằm
 *    trong `th`/`thead` hay không, và nó trả `null` khi KHÔNG XÁC ĐỊNH ĐƯỢC chứ không đoán `false`.
 *
 * LUẬT VÀNG: tầng này KHÔNG chứa `expect`. Thao tác không tới đích thì ném `WidgetError`.
 */

/** Lỗi THAO TÁC của widget — khác hẳn một khẳng định nghiệp vụ sai. */
export class WidgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WidgetError';
  }
}

export const CHO = {
  oMs: 10_000,
  /** Postback sau khi tích (bài học 2). */
  postbackMs: 1_800,
};

/** Đang tích hay không. */
export async function dangTich(o: Locator): Promise<boolean> {
  await o.waitFor({ state: 'attached', timeout: CHO.oMs });
  return o.isChecked();
}

/**
 * Đặt trạng thái tích. Trả `'da-dung'` khi ô vốn đã đúng — KHÔNG chạm vào nó.
 *
 * Phân biệt `da-dung` với `da-doi` là bài học 1: `check()` trên ô đã tích không làm gì và không báo gì,
 * nên case đo postback cần biết lượt này CÓ hay KHÔNG có postback.
 */
export async function datTrangThai(page: Page, o: Locator, co: boolean): Promise<'da-dung' | 'da-doi'> {
  await o.waitFor({ state: 'visible', timeout: CHO.oMs });
  if ((await dangTich(o)) === co) return 'da-dung';

  await o.click({ timeout: CHO.oMs });
  await page.waitForTimeout(CHO.postbackMs);

  const sau = await dangTich(o);
  if (sau !== co) {
    throw new WidgetError(
      `datTrangThai(): muốn ${co ? 'TÍCH' : 'BỎ TÍCH'} nhưng đọc lại là ${sau ? 'đang tích' : 'không tích'}. `
      + 'Ô có thể đang khoá, hoặc postback trả lại trạng thái cũ — đây là lỗi THAO TÁC, không phải một khẳng định nghiệp vụ.',
    );
  }
  return 'da-doi';
}

/**
 * Bấm vào checkbox ĐÚNG MỘT LẦN, bất kể trạng thái — dùng cho case đo hành vi của chính cú bấm.
 *
 * Khác `datTrangThai`: hàm kia hướng tới một TRẠNG THÁI, hàm này thực hiện một THAO TÁC. Case "bấm hai
 * lần trong một giây" cần đúng hàm này; dùng `datTrangThai` cho nó là đo rỗng.
 */
export async function bamMotLan(page: Page, o: Locator): Promise<{ truoc: boolean; sau: boolean }> {
  await o.waitFor({ state: 'visible', timeout: CHO.oMs });
  const truoc = await dangTich(o);
  await o.click({ timeout: CHO.oMs });
  await page.waitForTimeout(CHO.postbackMs);
  return { truoc, sau: await dangTich(o) };
}

/**
 * Ô này có phải checkbox "chọn tất cả" ở tiêu đề cột không?
 *
 * Trả `null` khi KHÔNG XÁC ĐỊNH ĐƯỢC — không đoán `false`. Đoán `false` ở đây làm case tích "chọn tất
 * cả" tưởng mình đang tích một dòng, và số dòng được chọn sau đó sai hoàn toàn.
 */
export async function laChonTatCa(o: Locator): Promise<boolean | null> {
  const trong = await o.evaluate((el: Element) => {
    const th = el.closest('th');
    if (th) return 'th';
    const td = el.closest('td');
    if (td) return 'td';
    return 'khong-trong-bang';
  }).catch(() => null);
  if (trong === null) return null;
  if (trong === 'th') return true;
  if (trong === 'td') return false;
  return null;
}

/** Trạng thái tích của cả một cột checkbox, theo thứ tự dòng. */
export async function docCot(cot: Locator): Promise<boolean[]> {
  const n = await cot.count();
  const ra: boolean[] = [];
  for (let i = 0; i < n; i += 1) ra.push(await cot.nth(i).isChecked());
  return ra;
}
