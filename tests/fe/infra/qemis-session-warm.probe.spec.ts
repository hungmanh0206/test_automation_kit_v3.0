import { test, expect } from '@playwright/test';
import { loginOps, OPS_BASE } from '../support/opsLogin';

/*
 * Hâm nóng phiên QEMIS để k6 đi mượn cookie (xem tests/load/run-qemis-load.js).
 *
 * Nó KHÔNG đo gì và KHÔNG chấm case nào. Việc duy nhất: đăng nhập thật một lần rồi để `loginOps`
 * ghi storageState vào `.auth/<key>.json`, nơi bộ chạy load đọc ra.
 *
 * Là `.probe.spec.ts` nên lane regression bỏ qua nó (playwright.config.js: probeIgnore). Chạy có chủ đích:
 *   PROBE=1 TASK_ENV=profiles/<TASK>/task.env npx playwright test tests/fe/infra/qemis-session-warm.probe.spec.ts
 *
 * Nhớ: login QEMIS có CAPTCHA mỗi lượt, và `.auth/` dùng CHUNG giữa các task — hâm nóng bằng tài khoản
 * của task này sẽ ghi đè phiên của task khác đang chạy.
 */
test.describe('@infra hâm nóng phiên QEMIS cho k6', () => {
  test('đăng nhập và lưu phiên vào .auth/', async ({ page }) => {
    /*
     * PHẢI lớn hơn QEMIS_CAPTCHA_WAIT_MS (mặc định 300s), nếu không test chết TRƯỚC khi vòng chờ captcha
     * kịp hết giờ — và thông báo sẽ là "Test timeout … at page.waitForTimeout", chỉ thẳng vào opsLogin.ts
     * như thể helper hỏng. Đã mất một lượt vì chuyện này (14/10/2026).
     */
    test.setTimeout(Number(process.env.QEMIS_CAPTCHA_WAIT_MS || 300_000) + 120_000);

    await loginOps(page);

    /*
     * Nghiệm thu bằng CẤU TRÚC, không bằng "không ném lỗi": `loginOps` có thể seed lại một phiên đã chết
     * mà không báo gì, và lúc đó mọi lượt k6 sau đó đo trang đăng nhập.
     * Neo: đang ở đúng host, và KHÔNG còn ô username của form đăng nhập trên màn.
     */
    const url = page.url();
    expect(url, 'không ở đúng host QEMIS sau khi đăng nhập').toContain(new URL(OPS_BASE).hostname);
    await expect(
      page.locator('#ContentPlaceHolder1_ctl00_tbU'),
      'vẫn thấy ô đăng nhập — phiên CHƯA vào được, k6 sẽ đo nhầm trang login',
    ).toHaveCount(0);

    console.log(`[warm] phiên đã sẵn sàng tại ${url} — chạy tests/load/run-qemis-load.js trong 25 phút tới.`);

    /*
     * WARM_PATH: mở luôn màn sắp đo để ĐỌC chuỗi neo thật, thay vì đoán rồi để threshold `checks` bắt.
     *
     * CHỈ in phần KHUNG của trang (title, tiêu đề, nhãn nút/cột). TUYỆT ĐỐI không in nội dung lưới:
     * màn danh sách giáo viên chứa họ tên và số điện thoại người thật (CLAUDE.md §1).
     */
    const warmPath = process.env.WARM_PATH;
    if (!warmPath) return;

    /*
     * BẪY GIT BASH — đã cắn HAI LẦN trong cùng một phiên làm việc (14/10/2026):
     * MSYS dịch giá trị trông như đường dẫn POSIX sang đường dẫn Windows, nên `WARM_PATH=/C2/x.aspx`
     * tới đây đã thành `C:/Program Files/Git/C2/x.aspx`. Lần đầu nó làm k6 báo "no such host";
     * lần hai nó mở ra trang lỗi 400 của ASP.NET mà test VẪN XANH, vì oracle cũ chỉ kiểm "không còn
     * ô đăng nhập" — trang lỗi cũng không có ô đăng nhập. Chặn sớm, đừng để nó thành dữ liệu.
     */
    if (/^[A-Za-z]:[\\/]/.test(warmPath) || /[\\/]Program Files[\\/]Git[\\/]/i.test(warmPath)) {
      throw new Error(
        `WARM_PATH đã bị Git Bash dịch thành "${warmPath}". Chạy lại với MSYS_NO_PATHCONV=1, `
        + 'hoặc bỏ dấu "/" ở đầu (WARM_PATH=C2/DSGiaoVien.aspx), hoặc dùng PowerShell.',
      );
    }

    const target = `${OPS_BASE}${warmPath.startsWith('/') ? warmPath : `/${warmPath}`}`;
    const res = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const status = res ? res.status() : 0;
    console.log(`[warm] mở ${target} → HTTP ${status} · URL cuối ${page.url()}`);

    // Oracle phải NEO VÀO MÃ TRẠNG THÁI. "Không thấy ô đăng nhập" một mình là oracle rỗng: trang lỗi
    // 400/500 của ASP.NET cũng thoả, và lượt dò neo sẽ đi chép chữ trong trang lỗi làm marker.
    expect(status, `màn trả HTTP ${status}, không phải 200 — không dò neo trên một trang lỗi`).toBe(200);
    await expect(
      page.locator('#ContentPlaceHolder1_ctl00_tbU'),
      'màn này đá về trang đăng nhập — phiên không mở được nó',
    ).toHaveCount(0);
    await expect(
      page.locator('text=Server Error'),
      'trang lỗi của ASP.NET — đường dẫn sai hoặc không có quyền',
    ).toHaveCount(0);

    const title = await page.title();
    const headings = await page.locator('h1, h2, h3, legend').allInnerTexts();
    const buttons = await page.locator('input[type="submit"], input[type="button"], button').evaluateAll(
      (els) => els.map((e) => (e as HTMLInputElement).value || e.textContent || '').map((s) => s.trim()).filter(Boolean),
    );
    console.log(`[warm] <title>: ${JSON.stringify(title)}`);
    console.log(`[warm] tiêu đề: ${JSON.stringify(headings.map((s) => s.trim()).filter(Boolean).slice(0, 10))}`);
    console.log(`[warm] nút    : ${JSON.stringify([...new Set(buttons)].slice(0, 15))}`);
    console.log('[warm] chọn MỘT chuỗi ở trên làm --marker (ưu tiên chuỗi của khung màn, không phải dữ liệu người).');
  });
});
