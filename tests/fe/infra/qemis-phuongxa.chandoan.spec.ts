/**
 * CHẨN ĐOÁN: vì sao combobox Phường/Xã không nhận cú bấm sau khi chọn Cấp học.
 *
 * Đã bác bỏ bằng đo: đơn vị CÓ lớp THPT (DB: 14 lớp khối 10–12); mục "Phường Ba Đình" CÓ trong danh
 * sách 127 mục; và probe bản đã chạy được ở THCS cũng hết giờ y hệt ở THPT.
 *
 * Nên lần này KHÔNG bấm thêm lần nào nữa — đo trạng thái thật của phần tử: hộp dropdown có đang hiển
 * thị không, mục có kích thước không, có bị thứ khác che không, và Telerik có API client để chọn không.
 */
import { test } from '@playwright/test';
import { OPS_LOGIN_URL, SEL, QEMIS_CAP_HOC, QEMIS_PHUONG_XA } from '../support/opsLogin';

const tron = (s: string): RegExp => new RegExp(`^\\s*${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);

test('đo trạng thái combobox Phường/Xã sau khi chọn Cấp học', async ({ page }) => {
  test.setTimeout(300_000);
  test.skip(!OPS_LOGIN_URL, 'chưa khai OPS_LOGIN_URL');

  await page.goto(OPS_LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await page.locator(`#${SEL.cbTruong}_Input`).waitFor({ state: 'attached', timeout: 30_000 });

  const cap = QEMIS_CAP_HOC || 'Trung học phổ thông';
  console.log(`[b1] chọn Cấp học = "${cap}"`);
  const itemCap = page.locator(`#${SEL.cbCapHoc}_DropDown li`).filter({ hasText: tron(cap) });
  for (let i = 0; i < 4; i += 1) {
    await page.locator(`#${SEL.cbCapHoc}_Arrow`).click({ timeout: 10_000 }).catch(() => {});
    if (await itemCap.isVisible({ timeout: 3000 }).catch(() => false)) break;
  }
  await itemCap.click({ timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(3000);
  console.log(`[b1] ô Cấp học hiện: "${await page.locator(`#${SEL.cbCapHoc}_Input`).inputValue().catch(() => '?')}"`);

  const px = SEL.cbPhuongXa;
  const canTim = QEMIS_PHUONG_XA || 'Phường Ba Đình';

  /* Đo TRƯỚC khi bấm mũi tên: hộp dropdown đang ở trạng thái nào. */
  const truoc = await page.evaluate(({ id, text }) => {
    const dd = document.querySelector(`#${id}_DropDown`) as HTMLElement | null;
    const cs = dd ? getComputedStyle(dd) : null;
    const li = Array.from(document.querySelectorAll(`#${id}_DropDown li`))
      .find((x) => (x.textContent || '').trim() === text) as HTMLElement | undefined;
    const r = li?.getBoundingClientRect();
    return {
      coDropDown: !!dd,
      display: cs?.display, visibility: cs?.visibility, opacity: cs?.opacity, zIndex: cs?.zIndex,
      ddRect: dd ? JSON.stringify(dd.getBoundingClientRect()) : null,
      soLi: document.querySelectorAll(`#${id}_DropDown li`).length,
      coMuc: !!li,
      liRect: r ? `${Math.round(r.width)}×${Math.round(r.height)} @ ${Math.round(r.x)},${Math.round(r.y)}` : null,
      /* Ai đang nằm trên điểm giữa của mục đó? Nếu không phải chính nó thì có thứ khác che. */
      chePhu: r && r.width ? (document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) as HTMLElement | null)?.outerHTML?.slice(0, 120) : null,
      /* Telerik có API client không — đường chọn KHÔNG qua chuột. */
      coTelerik: typeof (window as any).$find === 'function',
    };
  }, { id: px, text: canTim });
  console.log(`[b2] TRƯỚC khi bấm: ${JSON.stringify(truoc, null, 1)}`);

  console.log('[b3] bấm mũi tên Phường/Xã một lần rồi đo lại');
  await page.locator(`#${px}_Arrow`).click({ timeout: 10_000 }).catch((e) => console.log(`   bấm lỗi: ${e.message.slice(0, 80)}`));
  await page.waitForTimeout(2500);

  const sau = await page.evaluate(({ id, text }) => {
    const dd = document.querySelector(`#${id}_DropDown`) as HTMLElement | null;
    const cs = dd ? getComputedStyle(dd) : null;
    const li = Array.from(document.querySelectorAll(`#${id}_DropDown li`))
      .find((x) => (x.textContent || '').trim() === text) as HTMLElement | undefined;
    const r = li?.getBoundingClientRect();
    return {
      display: cs?.display, visibility: cs?.visibility, opacity: cs?.opacity,
      ddRect: dd ? JSON.stringify(dd.getBoundingClientRect()) : null,
      liRect: r ? `${Math.round(r.width)}×${Math.round(r.height)} @ ${Math.round(r.x)},${Math.round(r.y)}` : null,
      chePhu: r && r.width ? (document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) as HTMLElement | null)?.outerHTML?.slice(0, 120) : null,
    };
  }, { id: px, text: canTim });
  console.log(`[b4] SAU khi bấm: ${JSON.stringify(sau, null, 1)}`);

  /* Đường KHÔNG dùng chuột: gọi thẳng API client của Telerik. */
  const quaApi = await page.evaluate(({ id, text }) => {
    const f = (window as any).$find;
    if (typeof f !== 'function') return 'không có $find — trang không nạp Telerik client API';
    const cb = f(id);
    if (!cb) return `$find("${id}") trả null`;
    try {
      const it = cb.findItemByText(text);
      if (!it) return `findItemByText("${text}") không thấy mục`;
      it.select();
      if (cb.get_inputDomElement) cb.get_inputDomElement().value = text;
      return 'đã gọi select() qua API';
    } catch (e: any) { return `API ném: ${e.message}`; }
  }, { id: px, text: canTim });
  console.log(`[b5] thử qua Telerik API: ${quaApi}`);
  await page.waitForTimeout(3000);
  console.log(`[b6] ô Phường/Xã nay hiện: "${await page.locator(`#${px}_Input`).inputValue().catch(() => '?')}"`);
  console.log(`[b7] ô Trường nay có: ${await page.locator(`#${SEL.cbTruong}_DropDown li`).count()} mục`);
});
