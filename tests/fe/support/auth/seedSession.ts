import { type Page, type BrowserContext } from '@playwright/test';

/*
 * seedSession — nạp lại phiên đã lưu vào context MỚI, KHÔNG login. MỘT bản duy nhất.
 *
 * VÌ SAO tách file riêng: cả `loginOps` (điểm vào của 30 spec) lẫn `ensureOpsAuth` đều cần seed. Ban đầu tôi
 * viết bản thứ hai trong `opsLogin.ts` — hai bản sao của cùng một logic khó (thứ tự addInitScript, chọn origin,
 * cách xác minh) chắc chắn phân kỳ, và tệ hơn: UAT smoke chỉ nghiệm thu MỘT bản. Đặt ở module thứ ba để cả hai
 * dùng chung mà không sinh import vòng (`opsAuth` đã import `opsLogin`).
 *
 * Điểm dễ sai nhất: localStorage phải vào TRƯỚC mọi navigation. `addInitScript` chạy trước script trang nên app
 * thấy token ngay lúc check auth ⇒ không bị redirect `/auth/login`. Seed sau khi `goto` là quá muộn (bẫy đã gặp
 * thật khi làm ensureOpsAuth).
 */

export interface StorageStateLike {
  cookies?: Array<Record<string, unknown>>;
  origins?: Array<{ origin?: string; localStorage?: Array<{ name: string; value: string }> }>;
}

/*
 * Mẫu URL của MÀN ĐĂNG NHẬP — bị đẩy về đây nghĩa là phiên đã chết.
 *
 * ⚠️ SỬA 30/09/2026. Bản trước chỉ kiểm `/auth/login` (mẫu của LMS). QEMIS là ASP.NET WebForms và đá về
 * **`/Login.aspx`**, không khớp mẫu đó ⇒ phiên CHẾT bị chấm là CÒN SỐNG, `loginOps` trả về mà không đăng
 * nhập, và spec chạy tiếp trong trạng thái chưa auth. Lỗi im lặng: không ném, không đỏ ở bước seed, chỉ
 * vỡ ở assertion sau đó dưới dạng "không tìm thấy element" — trông y hệt bug sản phẩm.
 *
 * Thêm mẫu, KHÔNG thay mẫu cũ: `/auth/login` giữ nguyên nên 30 spec của lane LMS không đổi hành vi.
 */
const LOGIN_URL_PATTERNS = [/\/auth\/login/i, /\/login\.aspx/i];

/**
 * @param checkUrl trang KIỂM phiên. Phải là trang đòi đăng nhập: có phiên thì ở lại, không phiên thì bị đá
 *                 về màn đăng nhập. Bỏ trống thì kiểm ở gốc (`base`) như cũ.
 * @returns true nếu seed xong và KHÔNG bị đẩy về màn đăng nhập (tức phiên còn dùng được).
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ `checkUrl` — sửa 11/11/2026
 *
 * Kiểm ở GỐC không phân biệt được gì trên QEMIS: trang gốc `/` LUÔN chuyển về `/Login.aspx`, kể cả khi
 * phiên còn sống. Đo bằng probe chỉ-GET, cùng một phiên 10 phút tuổi:
 *   · có cookie:   `/` → /Login.aspx · `/ChonNam.aspx` ở lại · `/GDTX/HoSoTruongDetail.aspx` ở lại
 *   · không cookie: `/` → /Login.aspx · `/ChonNam.aspx` → /Login.aspx?returnUrl=~/ChonNam.aspx
 * Nên `seedSession` luôn trả false, `loginOps` coi phiên là chết và đăng nhập lại — MỖI test một captcha,
 * trong khi phiên đã lưu vẫn dùng được. Một lượt 15 case ngày 11/11 hỏng 6 case vì chờ captcha.
 *
 * Khi có `checkUrl`, "còn phiên" phải thoả CẢ HAI: URL cuối đúng trang đã yêu cầu (bị đá về Login hay
 * chuyển đi đâu khác đều trượt) · mã HTTP < 400 (một trang 404, hay trang lỗi mạng `chrome-error://`, không
 * phải bằng chứng còn phiên — bản kiểm ở gốc chấm cả hai là "còn phiên" vì chúng không phải Login).
 */
export async function seedSession(
  page: Page,
  context: BrowserContext,
  storageState: StorageStateLike | null | undefined,
  baseFallback = '',
  checkUrl = '',
): Promise<boolean> {
  const ss = storageState;
  if (!ss) return false;

  if (Array.isArray(ss.cookies) && ss.cookies.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await context.addCookies(ss.cookies as any);
  }
  for (const o of ss.origins || []) {
    if (Array.isArray(o.localStorage) && o.localStorage.length) {
      await context.addInitScript((items: Array<{ name: string; value: string }>) => {
        try { for (const it of items) window.localStorage.setItem(it.name, it.value); } catch (e) { /* origin khác scope */ }
      }, o.localStorage);
    }
  }

  if (checkUrl) {
    const resp = await page.goto(checkUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
    const url = page.url();
    /* "Đúng trang đã yêu cầu" đã BAO "không về Login": bị đá về /Login.aspx thì đường dẫn đã khác. Phép
     * phá 11/11/2026 xác nhận — bỏ riêng chốt Login thì 0/6 ca đỏ — nên không giữ chốt thừa đó ở đây. */
    const duongDan = (u: string) => { try { return new URL(u).pathname.toLowerCase(); } catch { return ''; } };
    if (duongDan(url) !== duongDan(checkUrl)) return false;
    return Boolean(resp && resp.status() < 400);
  }

  const base = (ss.origins && ss.origins[0] && ss.origins[0].origin) || baseFallback;
  if (!base) return false;
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { /* xác minh bằng URL bên dưới */ });
  const url = page.url();
  return !LOGIN_URL_PATTERNS.some((re) => re.test(url));
}
