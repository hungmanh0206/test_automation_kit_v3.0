import type { Page } from '@playwright/test';

/*
 * L0.5 — RadGrid của Telerik: ĐỌC lưới, và đọc theo TIÊU ĐỀ chứ không theo chỉ số cột.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * BÀI HỌC ĐẮT NHẤT CỦA TẦNG NÀY, chép nguyên từ automation của TASK-9002 (02/10/2026):
 *
 *   "Chỉ số cột KHÔNG giống nhau giữa các cấp: 'Tên lớp' là cột 6 ở THCS/THPT nhưng là cột 5 ở Tiểu
 *    học, và lưới Mầm non lại khác nữa. Neo cứng số 6 khiến mọi phép tra ở Tiểu học đọc ra mã khối
 *    ('01') — lượt 02/10 vì thế kết luận 'không tạo được lớp' cho những lớp đã tạo xong."
 *
 * Đó là một verdict SAI do một chỉ số cứng, và nó sai theo hướng tệ nhất: lưới vẫn đọc được, vẫn ra
 * chuỗi, vẫn so sánh được — chỉ là so nhầm cột. Không có gì đỏ để ai nghi ngờ.
 *
 * Nên tầng này KHÔNG xuất ra hàm nào nhận chỉ số cột làm tham số chính. Muốn một cột thì đưa TIÊU ĐỀ.
 * `cotTheoTieuDe` có rơi về chỉ số, nhưng chỉ khi không đọc nổi tiêu đề, và nó NÓI RA bằng giá trị trả.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * CHỌN ĐÚNG BẢNG DỮ LIỆU. RadGrid render NHIỀU `<table>` cùng tiền tố id — bảng tiêu đề, bảng dữ liệu,
 * đôi khi cả bảng phân trang. Lấy bảng đầu tiên là hay vớ phải bảng tiêu đề (0 dòng dữ liệu), rồi kết
 * luận "lưới rỗng". Ở đây chọn bảng có NHIỀU Ô `td` NHẤT — bảng tiêu đề chỉ có `th`.
 *
 * KHÔNG `expect` trong file này (luật vàng v2.8.0): tầng này ĐỌC, việc phán là của oracle và của case.
 */

/** Dòng dữ liệu của RadGrid. `rgRow` xen kẽ `rgAltRow` — thiếu một cái là mất nửa lưới. */
export const DONG = '.rgMasterTable tr.rgRow, .rgMasterTable tr.rgAltRow';

/** Ô tiêu đề. Telerik đặt ở `tr.rgHeader`. */
export const TIEU_DE = '.rgMasterTable tr.rgHeader th';

/** Đọc toàn bộ lưới thành mảng dòng × ô, đã cắt khoảng trắng thừa. */
export async function docLuoi(page: Page): Promise<string[][]> {
  return page.locator(DONG).evaluateAll((rows) => rows.map((r) => Array.from(r.querySelectorAll('td'))
    .map((td) => String((td as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim())));
}

/** Tiêu đề các cột, theo đúng thứ tự hiển thị. Lưới chưa nạp thì trả mảng rỗng. */
export async function docTieuDe(page: Page): Promise<string[]> {
  return page.locator(TIEU_DE).evaluateAll((ths) => ths
    .map((th) => String((th as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim())
    .filter((x) => x !== ''));
}

/**
 * Chỉ số cột theo TIÊU ĐỀ.
 *
 * Trả `{ chiSo, theo }` chứ không trả số trần: `theo` nói phép tra dựa vào đâu — `'tieu-de'` khi khớp
 * được tiêu đề, `'khong-thay'` khi không. Người gọi nhìn `theo` là biết có nên tin con số hay không.
 *
 * So khớp bỏ qua hoa-thường và khoảng trắng thừa, nhưng KHÔNG bỏ dấu: "Tên lớp" và "Ten lop" là hai
 * chuỗi khác nhau, và gộp chúng là mở đường cho một phép khớp lỏng mà không ai kiểm lại được.
 */
export async function cotTheoTieuDe(
  page: Page,
  tieuDe: string,
): Promise<{ chiSo: number; theo: 'tieu-de' | 'khong-thay'; tieuDeDocDuoc: string[] }> {
  const ds = await docTieuDe(page);
  const chuan = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const i = ds.findIndex((x) => chuan(x) === chuan(tieuDe));
  return { chiSo: i, theo: i >= 0 ? 'tieu-de' : 'khong-thay', tieuDeDocDuoc: ds };
}

/**
 * Một cột theo tiêu đề. Không tìm thấy tiêu đề ⇒ trả `null`, KHÔNG rơi về chỉ số nào cả.
 *
 * Vì sao `null` chứ không đoán: đọc nhầm cột không làm gì đỏ — nó trả về chuỗi hợp lệ của một cột
 * khác, và case so sánh với nó rồi kết luận sai. Trả `null` buộc người gọi phải xử lý.
 */
export async function docCot(page: Page, tieuDe: string): Promise<string[] | null> {
  const c = await cotTheoTieuDe(page, tieuDe);
  if (c.theo !== 'tieu-de') return null;
  const luoi = await docLuoi(page);
  return luoi.map((d) => d[c.chiSo] ?? '');
}

/** Số dòng dữ liệu. Lưới rỗng và lưới chưa nạp đều trả 0 — người gọi phải tự phân biệt bằng chờ. */
export async function demDong(page: Page): Promise<number> {
  return page.locator(DONG).count();
}

/**
 * Chỉ số các dòng có ô thuộc cột `tieuDe` khớp `giaTri`.
 *
 * Trả MẢNG chứ không trả dòng đầu tiên: "tìm thấy một" và "tìm thấy ba" là hai sự thật khác nhau, và
 * nhiều case chống trùng sống chết ở đúng con số đó. Một hàm trả về dòng đầu sẽ giấu mất chuyện trùng.
 */
export async function timDong(page: Page, tieuDe: string, giaTri: string): Promise<number[] | null> {
  const cot = await docCot(page, tieuDe);
  if (cot === null) return null;
  const chuan = (s: string) => s.replace(/\s+/g, ' ').trim();
  return cot.map((v, i) => (chuan(v) === chuan(giaTri) ? i : -1)).filter((i) => i >= 0);
}
