/**
 * seedSession — kiểm phiên ở trang ĐÒI ĐĂNG NHẬP, không ở gốc (11/11/2026).
 *
 * BỐI CẢNH. `loginOps` nạp phiên đã lưu vào context mới rồi hỏi `seedSession` "phiên còn sống không?". Bản
 * cũ trả lời bằng cách mở GỐC `/` và xem có bị đẩy về /Login.aspx không. Trên QEMIS gốc LUÔN đẩy về
 * /Login.aspx — kể cả khi phiên còn sống — nên câu trả lời luôn là "chết", và mỗi test lại đăng nhập + captcha.
 *
 * Đo bằng probe chỉ-GET trên UAT, cùng một phiên 10 phút tuổi:
 *   có cookie   : `/` → /Login.aspx   · `/ChonNam.aspx` ở lại
 *   không cookie: `/` → /Login.aspx   · `/ChonNam.aspx` → /Login.aspx?returnUrl=~/ChonNam.aspx
 * Gốc cho CÙNG một kết quả ở cả hai trạng thái — một phép đo không phân biệt được gì.
 *
 * Site giả dưới đây tái hiện ĐÚNG hai hành vi đó, chạy offline.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as http from 'http';
import type { AddressInfo } from 'net';
import * as path from 'path';
import { seedSession } from '../support/session/seedSession';

/*
 * SERVER HTTP THẬT trên 127.0.0.1, không phải `page.route`.
 *
 * Bản đầu của ca này dùng `context.route` + `fulfill({ status: 302 })`. Đo ra: trình duyệt theo redirect đó
 * RA MẠNG THẬT, gặp ERR_NAME_NOT_RESOLVED — mọi ca có redirect đều "đúng" nhờ may. Cùng phép đo lộ ra lỗ
 * thứ hai của bản cũ: trang lỗi mạng (`chrome-error://`) được chấm là "còn phiên" vì nó không phải Login.
 */
let server: http.Server;
let GOC = '';
const PHIEN = () => ({ cookies: [{ name: 'ASP.NET_SessionId', value: 'song', domain: '127.0.0.1', path: '/', expires: -1, httpOnly: true, secure: false, sameSite: 'Lax' }] });

/** `/` luôn về Login · trang đòi đăng nhập chỉ về Login khi THIẾU cookie · `/khong-co` 404 · `/chuyen` sang trang khác. */
test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const u = new URL(req.url || '/', 'http://127.0.0.1');
    const coPhien = /ASP\.NET_SessionId=song/.test(req.headers.cookie || '');
    const di = (loc: string) => { res.writeHead(302, { Location: loc, Connection: 'close' }); res.end(); };
    const html = (t: string, ma = 200) => { res.writeHead(ma, { 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' }); res.end(`<html><body>${t}</body></html>`); };
    const p = u.pathname.toLowerCase();
    if (p === '/') return di('/Login.aspx');
    if (p === '/login.aspx') return html('đăng nhập');
    if (p === '/khong-co') return html('not found', 404);
    if (p === '/chuyen') return di('/Error.aspx');
    if (p === '/error.aspx') return html('lỗi');
    if (!coPhien) return di(`/Login.aspx?returnUrl=~${u.pathname}`);
    return html('trang đòi đăng nhập');
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', () => ok()));
  GOC = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
/* Đóng HẾT kết nối trước khi close: trình duyệt cấp worker giữ keep-alive, `close()` chờ chúng và treo
 * worker — đo 11/11/2026: chạy chung với discovery-* thì 2 ca bên đó hết giờ `page.goto`. */
test.afterAll(async () => { server.closeAllConnections(); await new Promise((ok) => server.close(() => ok(null))); });

async function dungSiteGia(_context: any) { /* server đã dựng ở beforeAll */ }

test.describe('@infra seedSession — trang kiểm phiên phải phân biệt được hai trạng thái', () => {
  test('BẢN CŨ (kiểm ở gốc): phiên CÒN SỐNG vẫn bị chấm là chết — đây là lỗi đã gây captcha mỗi test', async ({ browser }) => {
    const ctx = await browser.newContext(); await dungSiteGia(ctx);
    const page = await ctx.newPage();
    expect(await seedSession(page, ctx, PHIEN(), GOC), 'gốc luôn về Login nên không đo được gì').toBe(false);
    await ctx.close();
  });

  test('kiểm ở /ChonNam.aspx + CÓ phiên ⇒ còn sống', async ({ browser }) => {
    const ctx = await browser.newContext(); await dungSiteGia(ctx);
    const page = await ctx.newPage();
    expect(await seedSession(page, ctx, PHIEN(), GOC, `${GOC}/ChonNam.aspx`)).toBe(true);
    await ctx.close();
  });

  test('ĐỐI CHỨNG: kiểm ở /ChonNam.aspx + KHÔNG phiên ⇒ chết — trang kiểm phải đá người chưa đăng nhập', async ({ browser }) => {
    const ctx = await browser.newContext(); await dungSiteGia(ctx);
    const page = await ctx.newPage();
    expect(await seedSession(page, ctx, { cookies: [] }, GOC, `${GOC}/ChonNam.aspx`)).toBe(false);
    await ctx.close();
  });

  test('trang kiểm trả 404 ⇒ KHÔNG được chấm là còn phiên', async ({ browser }) => {
    /* URL không đổi và không về Login — chỉ mã HTTP mới nói được đây không phải bằng chứng. */
    const ctx = await browser.newContext(); await dungSiteGia(ctx);
    const page = await ctx.newPage();
    expect(await seedSession(page, ctx, PHIEN(), GOC, `${GOC}/khong-co`)).toBe(false);
    await ctx.close();
  });

  test('trang kiểm bị chuyển đi trang KHÁC (không phải Login) ⇒ cũng không tính là còn phiên', async ({ browser }) => {
    const ctx = await browser.newContext(); await dungSiteGia(ctx);
    const page = await ctx.newPage();
    expect(await seedSession(page, ctx, PHIEN(), GOC, `${GOC}/chuyen`)).toBe(false);
    await ctx.close();
  });

  test('loginOps thật sự truyền trang kiểm — không chỉ seedSession biết nhận', () => {
    /*
     * Một spec gọi thẳng hàm thì chỉ kiểm HÀM, không kiểm ĐIỂM VÀO. Bài học từ `handoff-gate.spec.ts`:
     * spec xanh trong khi đường thật bị từ chối. Ca này giữ đúng chỗ nối.
     */
    const src = fs.readFileSync(path.resolve(__dirname, '../support/opsLogin.ts'), 'utf8');
    expect(src).toMatch(/OPS_SEED_CHECK_PATH \|\| '\/ChonNam\.aspx'/);
    expect(src).toMatch(/seedSession\(page, context, rec && rec\.storageState, OPS_BASE, OPS_BASE \? `\$\{OPS_BASE\}\$\{TRANG_KIEM_PHIEN\}` : ''\)/);
  });

  test('seedSession KHÔNG đụng credential — điều kiện để nó được ở ngoài `support/auth/`', () => {
    /*
     * File được dời khỏi `auth/` (11/11/2026) vì `ci:scope` coi import từ đó là "spec cần app sống". Lý do
     * chỉ đứng được khi file THẬT SỰ không cần: không đọc env, không import helper đăng nhập. Ai thêm vào
     * thì ca này đỏ — và lúc đó phải dời nó về `auth/`, không phải sửa ca.
     */
    const src = fs.readFileSync(path.resolve(__dirname, '../support/session/seedSession.ts'), 'utf8');
    expect(src, 'không đọc env').not.toMatch(/process\.env/);
    const imp = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(imp, 'chỉ import kiểu của Playwright').toEqual(['@playwright/test']);
  });
});
