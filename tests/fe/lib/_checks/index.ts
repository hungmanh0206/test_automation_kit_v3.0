import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/*
 * L4 — BỘ KIỂM DÙNG CHUNG (v2.8.0 §A).
 *
 * ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
 * ║ ĐÂY LÀ TẦNG DUY NHẤT ĐƯỢC PHÉP CHỨA `expect`. Mọi tầng khác (L0.5 widget, L1 màn, L2 bước,         ║
 * ║ L3 luồng) chỉ làm thao tác. Luật đó có máy canh: `steps:lint` CHẶN khi `steps/` chứa `expect(`.    ║
 * ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝
 *
 * VÀ ĐÂY LÀ TẦNG KHÔNG ĐƯỢC CHỨA GIÁ TRỊ KỲ VỌNG. Phân biệt hai điều đó là ruột của cả v2.8.0:
 *
 *   · `expect` là PHÉP SO — nó thuộc về L4.
 *   · GIÁ TRỊ được so là ORACLE — nó thuộc về **case**, lấy từ cột `Kết quả mong đợi` hoặc từ
 *     `knowledge/domain` theo `oracle_ref`. Nó KHÔNG bao giờ được viết sẵn trong code dùng chung.
 *
 * Vì sao luật này là luật quan trọng nhất của đợt: gói luôn phần kiểm vào bước làm tỉ lệ "dùng lại" nhảy
 * vọt — một bước "kiểm form hồ sơ trường đúng" trông như một bước dùng lại được ở mọi task. Nhưng lúc đó
 * oracle bị ĐÓNG KHUNG trong code, và khi đặc tả đổi thì không ai thấy: case vẫn xanh vì nó so với chính
 * cái code đã viết, không so với đặc tả. Đó là `app == app` chuyển từ tầng testcase xuống tầng thư viện,
 * và nó khó thấy hơn nhiều. `CLAUDE.md` §3 và §6 cấm đúng chuyện đó; prompt đặt nó làm điều kiện DỪNG.
 *
 * HỆ QUẢ CỤ THỂ VỀ API: **không hàm nào ở đây có tham số kỳ vọng mặc định.** Gọi mà không truyền giá trị
 * kỳ vọng thì NÉM LỖI, không "kiểm cái gì đó cho có". Một bộ kiểm có giá trị mặc định là một bộ kiểm luôn
 * xanh ở mọi dự án — tức một bộ kiểm không kiểm gì.
 */

/** Lỗi do GỌI SAI bộ kiểm — khác hẳn một khẳng định nghiệp vụ thất bại. */
export class CheckUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckUsageError';
  }
}

/**
 * Cổng vào của mọi bộ kiểm: giá trị kỳ vọng PHẢI có thật.
 *
 * `undefined`, `null`, và chuỗi rỗng-sau-trim đều bị TỪ CHỐI. Chuỗi rỗng bị từ chối cố ý: một ô
 * `Kết quả mong đợi` rỗng là **oracle rỗng**, và `gate:gen-testcase` đã CHẶN nó ở Phase 1. Cho nó đi qua
 * ở đây là mở lại đúng cái lỗ đó ở tầng dưới.
 *
 * Số `0` và `false` thì HỢP LỆ — chúng là kỳ vọng thật ("sĩ số phải bằng 0", "ô phải không được tích").
 * Một bản viết vội dùng `if (!kyVong)` sẽ từ chối cả hai, và đó là lỗi im lặng: case kỳ vọng 0 sẽ không
 * chạy được, rồi có người đổi kỳ vọng cho nó chạy.
 */
export function batBuocKyVong<T>(kyVong: T, nhan: string): T {
  if (kyVong === undefined || kyVong === null) {
    throw new CheckUsageError(
      `${nhan}: thiếu GIÁ TRỊ KỲ VỌNG. Bộ kiểm L4 không có giá trị mặc định — giá trị phải lấy từ cột `
      + '`Kết quả mong đợi` của case, hoặc từ `knowledge/domain` theo `oracle_ref`. '
      + 'Một bộ kiểm có giá trị mặc định là một bộ kiểm luôn xanh ở mọi dự án.',
    );
  }
  if (typeof kyVong === 'string' && kyVong.trim() === '') {
    throw new CheckUsageError(
      `${nhan}: giá trị kỳ vọng là chuỗi RỖNG — đó là oracle rỗng. `
      + '`gate:gen-testcase` đã chặn oracle rỗng ở Phase 1; cho nó qua ở đây là mở lại đúng lỗ đó.',
    );
  }
  return kyVong;
}

/** Chuẩn hoá chuỗi để so: NFC, gộp khoảng trắng, bỏ khoảng trắng hai đầu. KHÔNG bỏ dấu, KHÔNG hạ chữ. */
export function chuan(s: unknown): string {
  return String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

/*
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * CÁC BỘ KIỂM
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 */

/**
 * Thông báo (toast/alert) hiện ra với NGUYÊN VĂN kỳ vọng.
 *
 * So `toContainText` chứ không `toHaveText`: thông báo thật hay kèm mã lỗi hoặc dấu câu mà đặc tả không
 * ghi. Nhưng KHÔNG hạ chữ và KHÔNG bỏ dấu — "Tên trường là bắt buộc" khác "ten truong la bat buoc", và
 * một bộ kiểm bỏ dấu sẽ cho qua cả màn hiển thị sai font.
 */
export async function expectToast(
  viTri: Locator,
  nguyenVanKyVong: string,
  opts: { timeout?: number } = {},
): Promise<void> {
  const muon = batBuocKyVong(nguyenVanKyVong, 'expectToast');
  await expect(viTri, `thông báo phải chứa nguyên văn: "${muon}"`)
    .toContainText(muon, { timeout: opts.timeout ?? 10_000, useInnerText: true });
}

/**
 * Một Ô TRONG LƯỚI mang giá trị kỳ vọng.
 *
 * Nhận `hang` và `cot` là locator chứ không phải chỉ số: lưới của hệ này có ô TRỐNG ở vị trí đầu làm lệch
 * chỉ số (đã ghi trong sổ tri thức), nên đếm cột theo số là nguồn sai lặng lẽ.
 */
export async function expectCell(
  o: Locator,
  giaTriKyVong: string,
  nhan = 'ô lưới',
): Promise<void> {
  const muon = batBuocKyVong(giaTriKyVong, 'expectCell');
  const thuc = chuan(await o.innerText().catch(() => ''));
  expect(thuc, `${nhan}: kỳ vọng "${muon}"`).toBe(chuan(muon));
}

/**
 * Dữ liệu ĐÃ LƯU — đọc lại qua tầng ĐỌC rồi so, không tin màn hình vừa thao tác.
 *
 * `docLai` là hàm do CASE truyền vào (API client, hoặc mở lại màn chi tiết). L4 không tự quyết đọc ở đâu:
 * chọn nguồn đọc là chọn oracle, và đó là việc của case.
 *
 * CẤM đọc bằng DB (non-negotiable §2) — `db:paths:check` canh chuyện đó ở tầng file.
 */
export async function expectPersisted<T>(
  docLai: () => Promise<T>,
  giaTriKyVong: T,
  nhan = 'giá trị đã lưu',
): Promise<void> {
  const muon = batBuocKyVong(giaTriKyVong, 'expectPersisted');
  if (typeof docLai !== 'function') {
    throw new CheckUsageError(
      'expectPersisted: thiếu hàm `docLai`. Phải ĐỌC LẠI qua một tầng đọc độc lập (API hoặc mở lại màn), '
      + 'không tin màn hình vừa thao tác — đó là `app == app`.',
    );
  }
  const thuc = await docLai();
  /*
   * Ép về `unknown` trước khi so: `T` là generic nên `expect()` của Playwright suy ra một kiểu matcher
   * hẹp không có `toEqual`. Chuẩn hoá chuỗi vẫn giữ (NFC, gộp khoảng trắng) cho cả hai phía.
   */
  const a: unknown = typeof muon === 'string' ? chuan(muon) : muon;
  const b: unknown = typeof thuc === 'string' ? chuan(thuc) : thuc;
  expect(b, `${nhan}: kỳ vọng ${JSON.stringify(a)}`).toEqual(a);
}

/**
 * Hành động bị CHẶN, và dữ liệu KHÔNG ĐỔI.
 *
 * Hai vế, và vế thứ hai mới là vế hay bị bỏ: một màn hiện thông báo lỗi mà vẫn ghi dữ liệu là lỗi tệ hơn
 * một màn ghi dữ liệu không thông báo gì. Nên hàm này đòi CẢ HAI — mã/thông báo chặn, VÀ ảnh chụp dữ liệu
 * trước/sau khớp nhau.
 *
 * Tiền đề một nửa là kết luận sai: kit đã suýt log một bug bịa ra từ tình huống không tồn tại vì chỉ kiểm
 * một vế. Nên mỗi vế có cờ riêng trong thông điệp lỗi.
 */
export async function expectBlocked(
  thucTe: { dauHieuChan: string | number; truoc: unknown; sau: unknown },
  kyVong: { dauHieuChan: string | number },
  nhan = 'hành động bị chặn',
): Promise<void> {
  const muon = batBuocKyVong(kyVong?.dauHieuChan, 'expectBlocked');
  expect(
    typeof muon === 'number' ? Number(thucTe.dauHieuChan) : chuan(thucTe.dauHieuChan),
    `${nhan} — VẾ 1 (dấu hiệu chặn): kỳ vọng ${JSON.stringify(muon)}`,
  ).toEqual(typeof muon === 'number' ? muon : chuan(muon));

  expect(
    JSON.stringify(thucTe.sau),
    `${nhan} — VẾ 2 (dữ liệu KHÔNG đổi): chặn mà vẫn ghi là lỗi tệ hơn ghi mà không báo`,
  ).toBe(JSON.stringify(thucTe.truoc));
}

/**
 * Đang ở ĐÚNG MÀN — URL và tiêu đề, cả hai.
 *
 * Đây là NGHIỆM THU ĐIỀU HƯỚNG, không phải phán nghiệp vụ, nên nó được dùng bên trong bước L2. Nhưng nó
 * vẫn sống ở L4 vì nó chứa `expect`: để nó ở `steps/` là mở cửa cho assertion nghiệp vụ lọt vào theo.
 *
 * `toHaveURL` với một regex quá rộng (`/./`) là khẳng định rỗng — `auto:review` có rule `vacuous-url` bắt
 * đúng chuyện đó. Nên hàm này TỪ CHỐI mẫu khớp mọi thứ.
 */
export async function assertScreen(
  page: Page,
  kyVong: { url: RegExp | string; tieuDe?: string | RegExp },
  nhan = 'màn',
): Promise<void> {
  const u = batBuocKyVong(kyVong?.url, 'assertScreen(url)');
  if (u instanceof RegExp && ['(?:)', '.', '.*', '^.*$', '[\\s\\S]*'].includes(u.source)) {
    throw new CheckUsageError(
      `assertScreen: mẫu URL "${u}" khớp MỌI url ⇒ khẳng định rỗng. `
      + '`auto:review` có rule `vacuous-url` bắt đúng loại này.',
    );
  }
  await expect(page, `${nhan}: URL phải khớp ${u}`).toHaveURL(u as RegExp);
  if (kyVong.tieuDe !== undefined) {
    const t = chuan(await page.title());
    if (kyVong.tieuDe instanceof RegExp) {
      expect(t, `${nhan}: tiêu đề phải khớp ${kyVong.tieuDe}`).toMatch(kyVong.tieuDe);
    } else {
      expect(t, `${nhan}: tiêu đề kỳ vọng "${kyVong.tieuDe}"`).toContain(chuan(kyVong.tieuDe));
    }
  }
}

/**
 * SỐ LƯỢNG bản ghi đúng kỳ vọng.
 *
 * `auto:review` có rule `vacuous-count` bắt khẳng định rỗng kiểu "có dữ liệu là đạt". Nên hàm này đòi một
 * SỐ, và từ chối `toBeGreaterThan(0)` ngầm: muốn "ít nhất n" thì truyền `{ itNhat: n }` tường minh.
 */
export async function expectCount(
  dem: () => Promise<number>,
  kyVong: number | { itNhat: number },
  nhan = 'số bản ghi',
): Promise<void> {
  const muon = batBuocKyVong(kyVong, 'expectCount');
  const thuc = await dem();
  if (typeof muon === 'number') {
    expect(thuc, `${nhan}: kỳ vọng đúng ${muon}`).toBe(muon);
    return;
  }
  const n = batBuocKyVong(muon.itNhat, 'expectCount(itNhat)');
  if (n <= 0) {
    throw new CheckUsageError(
      `expectCount: \`itNhat: ${n}\` là khẳng định rỗng ("có dữ liệu là đạt"). `
      + '`auto:review` có rule `vacuous-count` bắt đúng loại này.',
    );
  }
  expect(thuc, `${nhan}: kỳ vọng ít nhất ${n}`).toBeGreaterThanOrEqual(n);
}

/** Mọi bộ kiểm, khai một chỗ để `steps:lint` đối chiếu được. */
export const BO_KIEM = [
  'expectToast', 'expectCell', 'expectPersisted', 'expectBlocked', 'assertScreen', 'expectCount',
] as const;
