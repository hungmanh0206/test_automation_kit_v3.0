/**
 * CSDL-9004 · Bảo mật trang "Xem hồ sơ" đội ngũ (isview=1) — PHA A (CHỈ ĐỌC).
 *
 * Câu hỏi của chủ dự án: trang Xem chi tiết KHÔNG có nút Ghi/Lưu, nhưng ô vẫn sửa được — có LỖ HỔNG
 * nào để vẫn LƯU ĐƯỢC (qua chính ứng dụng, KHÔNG tính sửa DB) không?
 *
 * Recon trước chỉ đếm nút ĐANG HIỂN THỊ (offsetParent!==null) nên một nút "Ghi" bị display:none mà
 * VẪN nối __doPostBack sẽ bị bỏ sót — đó đúng là kiểu "không thấy nút nhưng vẫn lưu". Pha A quét:
 *   1. ô nhập: bao nhiêu ô MỞ KHOÁ thật (không disabled, không readOnly);
 *   2. MỌI nút/submit/a mang nghĩa lưu — kể cả ẩn — và trạng thái hiển thị của chúng;
 *   3. MỌI đích __doPostBack trên trang → có đích nào nghĩa Ghi/Lưu/Update không;
 *   4. <form> action + có __VIEWSTATE/__EVENTVALIDATION không (điều kiện để postback chạy);
 *   5. mọi id/name chứa Ghi|Luu|Save|Update|Cfm bất kể hiển thị.
 *
 * KHÔNG bấm bất cứ nút lưu nào. KHÔNG sửa dữ liệu. Chỉ liệt kê bề mặt tấn công.
 */
import { test, expect } from '@playwright/test';
import { loginOps } from '../support/opsLogin';

const path = require('path');
const fs = require('fs');

const OPS = (process.env.OPS_BASE_URL || '').replace(/\/+$/, '');
const M411 = `${OPS}/C2/DSGiaoVien.aspx`;
const DICH = path.resolve(__dirname, '..', '..', '..', 'outputs', 'CSDL', 'tasks', 'CSDL-9004', 'requirements', 'xemhoso_luu_phaA.json');

let page: any;
test.beforeAll(async ({ browser }) => {
  test.setTimeout(20 * 60 * 1000);
  page = await browser.newPage();
  page.on('dialog', async (d: any) => { await d.dismiss().catch(() => {}); });
  await loginOps(page);
});
test.afterAll(async () => { await page?.close(); });
test.describe.configure({ timeout: 30 * 60 * 1000 });

test('pha A — bề mặt lưu của trang Xem hồ sơ (chỉ đọc)', async () => {
  await page.goto(M411, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.locator('#ContentPlaceHolder1_ctl00_lkbtTimKiem').click({ timeout: 20000 }).catch(() => {});
  await page.waitForFunction(() => /Dòng\s+\d+\s+đến|không có dữ liệu/i.test(document.body.innerText),
    null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);

  /* Bản ghi: dòng đầu CÓ liên kết trong lưới (mọi dòng đều thuộc trường 74718503). */
  const truocUrl = page.url();
  const choTab = page.context().waitForEvent('page', { timeout: 15000 }).catch(() => null);
  await page.locator('img[src*="xemhoso"]').first().click({ timeout: 20000 }).catch(() => {});
  const tabMoi = await choTab;
  if (tabMoi) { await tabMoi.waitForLoadState('domcontentloaded', { timeout: 60000 }).catch(() => {}); page = tabMoi; }
  await page.waitForTimeout(3500);

  /* Khung chứa form Xem hồ sơ. */
  const fr = page.frames().find((f: any) => /ViewHoSoGiaoVienDetail/i.test(f.url())) || page.mainFrame();
  const idHoso = (String(fr.url()).match(/id_hoso=(\d+)/) || [])[1] || '(?)';
  const isview = /isview=1/i.test(fr.url());
  console.log(`[A] khung = ${String(fr.url()).replace(OPS, '')}`);
  console.log(`[A] id_hoso = ${idHoso} · isview=1 ? ${isview}`);

  const be = await fr.evaluate(() => {
    const dp = (s: string) => /__doPostBack/.test(s);
    const saveRe = /ghi|lưu|luu|cập nhật|cap nhat|update|save|confirm|xacnhan|xac nhan/i;

    /* 1. ô nhập mở khoá thật */
    const oAll = Array.from(document.querySelectorAll('input[type=text],input:not([type]),textarea')) as HTMLInputElement[];
    const oMo = oAll.filter((e) => !e.disabled && !e.readOnly && e.offsetParent !== null);

    /* 2. nút/submit/a mang nghĩa lưu — kể cả ẩn */
    const nutAll = Array.from(document.querySelectorAll('input[type=button],input[type=submit],input[type=image],button,a')) as HTMLElement[];
    const nutLuu = nutAll
      .filter((e) => {
        const t = `${(e as HTMLInputElement).value || ''} ${e.innerText || ''} ${e.getAttribute('onclick') || ''} ${e.id} ${e.getAttribute('title') || ''}`;
        return saveRe.test(t);
      })
      .map((e) => ({
        the: e.tagName,
        id: (e.id || '').slice(0, 70),
        nhan: ((e as HTMLInputElement).value || e.innerText || e.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 40),
        onclick: (e.getAttribute('onclick') || '').replace(/\s+/g, ' ').slice(0, 120),
        hien: e.offsetParent !== null,
        disabled: (e as HTMLInputElement).disabled === true,
      }));

    /* 3. MỌI đích __doPostBack trên trang */
    const dpTargets = new Set<string>();
    nutAll.forEach((e) => {
      const oc = e.getAttribute('onclick') || e.getAttribute('href') || '';
      const m = oc.match(/__doPostBack\('([^']+)'/);
      if (m) dpTargets.add(m[1]);
    });
    const dpLuu = Array.from(dpTargets).filter((t) => saveRe.test(t));

    /* 4. form + hidden postback plumbing */
    const form = document.forms[0];
    const formAction = form ? (form.getAttribute('action') || location.pathname) : '(không có form)';
    const hasVS = !!document.querySelector('#__VIEWSTATE');
    const hasEV = !!document.querySelector('#__EVENTVALIDATION');

    /* 5. mọi id/name chứa từ khoá lưu */
    const idLuu = Array.from(document.querySelectorAll('[id],[name]'))
      .map((e) => (e as HTMLElement).id || (e as HTMLElement).getAttribute('name') || '')
      .filter((s) => /ghi|luu|save|update|cfm|xacnhan/i.test(s))
      .filter((s, i, a) => a.indexOf(s) === i)
      .slice(0, 20);

    return {
      soO: oAll.length, soOMo: oMo.length,
      oMoVaiId: oMo.slice(0, 8).map((e) => e.id || e.getAttribute('name') || '(?)'),
      nutLuu, dpLuu, soDpTong: dpTargets.size,
      formAction, hasVS, hasEV, idLuu,
    };
  });

  console.log(`[A] ô nhập: ${be.soO} — MỞ KHOÁ thật: ${be.soOMo}`);
  console.log(`[A]   ví dụ ô mở khoá: ${be.oMoVaiId.join(' · ')}`);
  console.log(`[A] form action = ${be.formAction} · __VIEWSTATE=${be.hasVS} · __EVENTVALIDATION=${be.hasEV}`);
  console.log(`[A] tổng đích __doPostBack trên trang: ${be.soDpTong}`);
  console.log(`[A] NÚT/LINK nghĩa "lưu" (kể cả ẩn): ${be.nutLuu.length}`);
  be.nutLuu.forEach((n: any) => console.log(`[A]   ${n.the} id=${n.id || '-'} nhãn="${n.nhan}" hiển_thị=${n.hien} disabled=${n.disabled} onclick="${n.onclick}"`));
  console.log(`[A] ĐÍCH __doPostBack nghĩa "lưu": ${be.dpLuu.length ? be.dpLuu.join(' | ') : '(không có)'}`);
  console.log(`[A] id/name chứa từ khoá lưu: ${be.idLuu.length ? be.idLuu.join(' | ') : '(không có)'}`);

  console.log('\n[A] ĐỌC KẾT QUẢ:');
  console.log('[A]  · có nút/đích lưu (dù ẩn) + ô mở khoá  ⇒ LỖ HỔNG tiềm năng, sang pha B kích hoạt + đối chứng DB.');
  console.log('[A]  · KHÔNG nút/đích lưu nào, nhưng form+VIEWSTATE còn ⇒ chỉ còn đường giả mạo POST endpoint Sửa.');
  console.log('[A]  · ô đều khoá + không đường lưu ⇒ trang Xem an toàn qua UI.');

  fs.mkdirSync(path.dirname(DICH), { recursive: true });
  fs.writeFileSync(DICH, JSON.stringify({ doLuc: new Date().toISOString(), idHoso, isview, ...be }, null, 2));
  console.log(`[A] đã ghi ${DICH}`);

  expect(isview, 'phải mở đúng trang isview=1').toBeTruthy();
});
