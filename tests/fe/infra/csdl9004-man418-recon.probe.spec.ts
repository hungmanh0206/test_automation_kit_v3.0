/**
 * CSDL-9004 · Recon (chỉ đọc) màn 4.1.8 "Xếp đội ngũ vào tổ chuyên môn" (PhanCongToChuyenMon.aspx).
 * Neo dữ liệu thật cho TC_071/072/101/105: tuỳ chọn phân hiệu, tuỳ chọn tổ, lưới GV (GV + phân hiệu +
 * tổ hiện tại), và nội dung cửa sổ ghép (combo tổ/phân hiệu + số GV).
 * KHÔNG lưu gì.
 */
import { test } from '@playwright/test';
import { loginOps } from '../support/opsLogin';

const OPS = (process.env.OPS_BASE_URL || '').replace(/\/+$/, '');
const M418 = `${OPS}/C2/PhanCongToChuyenMon.aspx`;

async function optCombo(frame: any, idGoc: string): Promise<string[]> {
  return frame.evaluate((id: string) => {
    const root = document.querySelector(id.startsWith('#') ? id : '#' + id);
    if (!root) return ['(không thấy combo ' + id + ')'];
    // Telerik: item nằm trong div dropdown id + _DropDown
    const dd = document.querySelector((id.replace('#', '#')) + '_DropDown') as HTMLElement;
    const items = dd ? Array.from(dd.querySelectorAll('li')) : [];
    return items.map((li) => (li.textContent || '').trim()).filter(Boolean);
  }, idGoc);
}

test('recon — màn 4.1.8', async ({ browser }) => {
  test.setTimeout(20 * 60 * 1000);
  const page = await browser.newPage();
  page.on('dialog', async (d: any) => { await d.dismiss().catch(() => {}); });
  await loginOps(page);

  await page.goto(M418, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  console.log(`[418] URL = ${page.url().replace(OPS, '')}`);

  // bung dropdown phân hiệu + tổ để đọc option
  for (const [ten, arrow] of [['phân hiệu', '#ctl00_ContentPlaceHolder1_ctl00_rcbPhanHieu_Arrow'], ['tổ', '#ctl00_ContentPlaceHolder1_ctl00_rcbToChuyenMon_Arrow']]) {
    await page.locator(arrow).click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
    const base = arrow.replace('_Arrow', '');
    const opts = await optCombo(page.mainFrame(), base);
    console.log(`[418] combo ${ten} (${opts.length}): ${opts.slice(0, 25).join(' | ')}`);
    await page.keyboard.press('Escape').catch(() => {});
  }

  // lưới GV: GV + phân hiệu + tổ hiện tại
  const grid = await page.evaluate(() => {
    const g = document.querySelector('[id$="_RadGrid1"]');
    if (!g) return { n: 0, rows: [] as any[] };
    const trs = Array.from(g.querySelectorAll('tbody tr')).filter((r) => r.querySelectorAll('td').length > 3);
    return {
      n: trs.length,
      rows: trs.slice(0, 12).map((r) => Array.from(r.querySelectorAll('td')).map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 8)),
    };
  });
  console.log(`[418] lưới GV: ${grid.n} dòng. Mẫu:`);
  grid.rows.forEach((r: any) => console.log(`[418]   ${r.join(' · ')}`));

  // mở cửa sổ ghép
  await page.locator('#ContentPlaceHolder1_ctl00_lkbtPhanCong').click({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const fr = page.frames().find((f: any) => /PhanCongToChuyenMonChiTiet/i.test(f.url()));
  if (fr) {
    console.log(`[418] cửa sổ ghép mở: ${String(fr.url()).replace(OPS, '').slice(0, 90)}`);
    for (const [ten, arrow] of [['phân hiệu', '#ctl00_ContentPlaceHolder1_ctl00_rcbPhanHieu_Arrow'], ['tổ', '#ctl00_ContentPlaceHolder1_ctl00_rcbToChuyenMon_Arrow']]) {
      await fr.locator(arrow).click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(800);
      const opts = await optCombo(fr, arrow.replace('_Arrow', ''));
      console.log(`[418] [ghép] combo ${ten} (${opts.length}): ${opts.slice(0, 25).join(' | ')}`);
    }
    const soGV = await fr.evaluate(() => document.querySelectorAll('[id$="_RadGrid1"] tbody tr input[type=checkbox]').length).catch(() => 0);
    console.log(`[418] [ghép] số ô chọn GV: ${soGV}`);
  } else {
    console.log('[418] KHÔNG thấy iframe ghép — xem lại nút lkbtPhanCong');
  }

  await page.close();
});
