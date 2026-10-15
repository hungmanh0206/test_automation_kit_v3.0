/**
 * CSDL-9004 · Recon (chỉ đọc) — trang Sửa HoSoGiaoVienDetail.aspx?id_hoso=50668:
 *   · nạp standalone có populate không (ô Họ tên có giá trị bản ghi?);
 *   · nút Ghi là element gì (tag/type/name/id) — để biết kích hoạt lưu bằng name=value hay __doPostBack.
 * KHÔNG bấm Ghi. Chỉ liệt kê.
 */
import { test } from '@playwright/test';
import { loginOps } from '../support/opsLogin';

const OPS = (process.env.OPS_BASE_URL || '').replace(/\/+$/, '');
const ID = 50668;
const EDIT = `${OPS}/C2/HoSoGiaoVienDetail.aspx?id_hoso=${ID}`;

test('recon — trang Sửa + nút Ghi', async ({ browser }) => {
  test.setTimeout(15 * 60 * 1000);
  const page = await browser.newPage();
  page.on('dialog', async (d: any) => { await d.dismiss().catch(() => {}); });
  await loginOps(page);

  await page.goto(EDIT, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);

  const fr = page.frames().find((f: any) => /HoSoGiaoVienDetail/i.test(f.url())) || page.mainFrame();
  console.log(`[E] khung = ${String(fr.url()).replace(OPS, '')}`);

  const be = await fr.evaluate(() => {
    const ho = document.getElementById('ContentPlaceHolder1_ctl00_tbHoTen') as HTMLInputElement;
    const saveRe = /ghi|lưu|luu|cập nhật|save|update/i;
    const nut = Array.from(document.querySelectorAll('input[type=submit],input[type=button],input[type=image],button,a'))
      .filter((e: any) => saveRe.test(`${e.value || ''} ${e.innerText || ''} ${e.id} ${e.getAttribute('onclick') || ''} ${e.getAttribute('title') || ''}`))
      .map((e: any) => ({
        the: e.tagName, type: e.type || '', id: (e.id || '').slice(0, 70), name: (e.getAttribute('name') || '').slice(0, 80),
        nhan: (e.value || e.innerText || e.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 30),
        hien: e.offsetParent !== null,
        onclick: (e.getAttribute('onclick') || '').replace(/\s+/g, ' ').slice(0, 110),
      }));
    return {
      hoTenCo: !!ho, hoTenVal: ho ? ho.value : '(không có ô)', hoTenName: ho ? ho.name : '',
      coForm: !!document.forms[0],
      soO: document.querySelectorAll('input[type=text],textarea').length,
      nut,
    };
  });

  console.log(`[E] form? ${be.coForm} · ô chữ: ${be.soO}`);
  console.log(`[E] ô Họ tên: có=${be.hoTenCo} name="${be.hoTenName}" value="${be.hoTenVal}"`);
  console.log(`[E] nút nghĩa "lưu" (${be.nut.length}):`);
  be.nut.forEach((n: any) => console.log(`[E]   ${n.the}[${n.type}] id=${n.id || '-'} name="${n.name}" nhãn="${n.nhan}" hiện=${n.hien} onclick="${n.onclick}"`));

  await page.close();
});
