/**
 * CSDL-9004 · Bảo mật trang "Xem hồ sơ" đội ngũ (isview=1) — PHA B v2 (GHI THỬ có ĐỐI CHỨNG).
 *
 * Pha A: trang Xem có ô sửa được nhưng 0 đích __doPostBack, nút Ghi không render. Câu hỏi còn lại:
 * server có chấp nhận một request lưu nhắm vào bản ghi này không, khi phát từ trang chỉ-xem?
 *
 * v1 sai: nhắm __EVENTTARGET suy từ btSavePanel (lồng 2 lớp) → không trúng handler nào, nên "DB không
 * đổi" vô nghĩa. Recon trang Sửa cho tên nút Ghi THẬT = ctl00$ContentPlaceHolder1$ctl00$btSave (postback).
 *
 * v2 có ĐỐI CHỨNG DƯƠNG để khử mập mờ "DB không đổi vì server chặn" vs "vì request không kích hoạt lưu":
 *   PC) bắn cùng cơ chế fetch vào trang SỬA (HoSoGiaoVienDetail.aspx) với __EVENTTARGET=btSave thật
 *       → DB PHẢI đổi (chứng minh cơ chế + hàm đọc DB chạy đúng), rồi HOÀN NGUYÊN ngay.
 *   T)  bắn vào trang XEM (isview=1) với cùng __EVENTTARGET → đọc DB.
 *
 * Verdict:
 *   PC đổi + T không đổi      ⇒ server CHẶN lưu từ trang Xem = AN TOÀN, không bug (kết luận chắc).
 *   PC đổi + T đổi            ⇒ server CHẤP NHẬN lưu từ trang Xem = BUG. (hoàn nguyên ngay)
 *   PC KHÔNG đổi              ⇒ cơ chế fetch chưa đủ kích hoạt lưu ⇒ INCONCLUSIVE, không kết luận.
 *
 * An toàn: chỉ bản ghi TEST (ID 50668), DB chỉ ĐỌC để xác minh, mọi thay đổi đều hoàn nguyên.
 */
import { test, expect } from '@playwright/test';
import { loginOps } from '../support/opsLogin';
import { queryUatReadonly, isUatDbConfigured } from '../../support/setup/db/uatDbClient';

const path = require('path');
const fs = require('fs');

const OPS = (process.env.OPS_BASE_URL || '').replace(/\/+$/, '');
const PREFIX = 'LIB_MASTER_DB_RO';
const ID = 50668;
const VIEW = `${OPS}/C2/ViewHoSoGiaoVienDetail.aspx?id_hoso=${ID}&isview=1`;
const EDIT = `${OPS}/C2/HoSoGiaoVienDetail.aspx?id_hoso=${ID}`;
const BTSAVE = 'ctl00$ContentPlaceHolder1$ctl00$btSave';
const EVID = path.resolve(__dirname, '..', '..', '..', 'outputs', 'CSDL', 'tasks', 'CSDL-9004', 'test-results', 'phaB-xemhoso');

async function docHoTen(): Promise<string | null> {
  const r = await queryUatReadonly<any>(`SELECT HO_TEN FROM NHAN_SU WHERE ID = ${ID}`, [], { dbPrefix: PREFIX });
  return r.length ? String(r[0].HO_TEN) : null;
}

/* Bắn 1 POST (fetch, kèm cookie phiên) từ khung đang mở: gom mọi field của form, ghi đè Họ tên và
   __EVENTTARGET = nút Ghi. Trả {status, phanHoi}. KHÔNG dùng form.submit/__doPostBack (lỗi strict-mode). */
async function banLuu(frame: any, hoTen: string, target: string): Promise<{ status: number; phanHoi: string }> {
  return frame.evaluate(async (args: any) => {
    const { v, tg } = args;
    const form = document.forms[0] as HTMLFormElement;
    if (!form) return { status: 0, phanHoi: '(không form)' };
    const body = new URLSearchParams();
    Array.from(form.querySelectorAll('input,select,textarea')).forEach((e: any) => {
      if (!e.name) return;
      if ((e.type === 'checkbox' || e.type === 'radio') && !e.checked) return;
      if (e.type === 'button' || e.type === 'submit' || e.type === 'image') return;
      body.append(e.name, e.value ?? '');
    });
    const ho = document.getElementById('ContentPlaceHolder1_ctl00_tbHoTen') as HTMLInputElement;
    if (ho && ho.name) body.set(ho.name, v);
    body.set('__EVENTTARGET', tg);
    body.set('__EVENTARGUMENT', '');
    try {
      const r = await fetch(location.href, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const t = await r.text();
      return { status: r.status, phanHoi: t.slice(0, 8000) };
    } catch (e: any) { return { status: 0, phanHoi: `fetch lỗi: ${String(e && e.message || e)}` }; }
  }, { v: hoTen, tg: target });
}

function moKhung(page: any, re: RegExp) {
  return page.frames().find((f: any) => re.test(f.url())) || page.mainFrame();
}

test('pha B v2 — server có chấp nhận lưu từ trang Xem không (có đối chứng)', async ({ browser }) => {
  test.setTimeout(20 * 60 * 1000);
  test.skip(!isUatDbConfigured(PREFIX), 'chưa cấu hình LIB_MASTER_DB_RO_*');
  fs.mkdirSync(EVID, { recursive: true });
  const page = await browser.newPage();
  page.on('dialog', async (d: any) => { await d.accept().catch(() => {}); });
  await loginOps(page);

  const goc0 = await docHoTen();
  console.log(`[B] HO_TEN gốc (DB) = "${goc0}"`);
  expect(goc0, 'phải đọc được bản ghi test').toBeTruthy();
  const goc = String(goc0).replace(/\s+(PC|ZZZTEST)$/,'');

  /* ---- PC: ĐỐI CHỨNG DƯƠNG trên trang Sửa ---- */
  await page.goto(EDIT, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3500);
  const frE = moKhung(page, /HoSoGiaoVienDetail/i);
  const mocPC = `${goc} PC`;
  const rPC = await banLuu(frE, mocPC, BTSAVE);
  await page.waitForTimeout(1500);
  const sauPC = await docHoTen();
  const pcDoi = sauPC === mocPC;
  console.log(`[B] PC (trang Sửa): HTTP ${rPC.status} · HO_TEN sau = "${sauPC}" · ĐỔI? ${pcDoi}`);

  /* hoàn nguyên PC ngay nếu đã đổi */
  if (pcDoi) {
    await page.goto(EDIT, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    await banLuu(moKhung(page, /HoSoGiaoVienDetail/i), goc, BTSAVE);
    await page.waitForTimeout(1500);
    const hn = await docHoTen();
    console.log(`[B] hoàn nguyên PC → "${hn}" ${hn === goc ? '(OK)' : '(⚠ chưa trả gốc)'}`);
  }

  /* ---- T: PHÉP THỬ trên trang Xem isview=1 ---- */
  await page.goto(VIEW, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(EVID, '1-trang-xem.png') }).catch(() => {});
  const frV = moKhung(page, /ViewHoSoGiaoVienDetail/i);
  const mocT = `${goc} ZZZTEST`;
  const rT = await banLuu(frV, mocT, BTSAVE);
  await page.waitForTimeout(1500);
  const sauT = await docHoTen();
  const tDoi = sauT === mocT;
  fs.writeFileSync(path.join(EVID, 'view-response.html'), rT.phanHoi);
  await page.screenshot({ path: path.join(EVID, '2-sau-ep-luu.png') }).catch(() => {});
  console.log(`[B] T (trang Xem): HTTP ${rT.status} · HO_TEN sau = "${sauT}" · ĐỔI? ${tDoi}`);

  /* hoàn nguyên T nếu lỡ đổi */
  if (tDoi) {
    await page.goto(EDIT, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    await banLuu(moKhung(page, /HoSoGiaoVienDetail/i), goc, BTSAVE);
    await page.waitForTimeout(1500);
    const hn = await docHoTen();
    console.log(`[B] hoàn nguyên T → "${hn}" ${hn === goc ? '(OK)' : '(⚠ chưa trả gốc)'}`);
  }

  /* ---- VERDICT ---- */
  console.log('\n[B] ===== KẾT LUẬN =====');
  let verdict = '';
  if (!pcDoi) {
    verdict = 'INCONCLUSIVE — đối chứng dương KHÔNG ghi được, cơ chế fetch chưa đủ kích hoạt lưu. Không kết luận.';
  } else if (tDoi) {
    verdict = 'BUG — server CHẤP NHẬN lưu từ trang Xem (isview=1). Đã hoàn nguyên.';
  } else {
    verdict = 'AN TOÀN (không bug) — đối chứng ghi được, nhưng trang Xem KHÔNG ghi được: server chặn lưu từ trang chỉ-xem.';
  }
  console.log(`[B] ${verdict}`);

  fs.writeFileSync(path.join(EVID, 'ket-qua.json'), JSON.stringify({
    doLuc: new Date().toISOString(), id: ID, goc,
    PC: { http: rPC.status, sau: sauPC, doi: pcDoi },
    T: { http: rT.status, sau: sauT, doi: tDoi },
    verdict,
  }, null, 2));
  await page.close();
});
