import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { gateEnv } from './_gate_env';
import { thuMucTam, donThuMucTam } from './_thu_muc_tam';

/*
 * Mục B của v2.8.4 — ba nhóm bảo mật READ-ONLY: phiên · cô lập đơn vị · JWT.
 *
 * Mỗi control có CẶP hỏng/đúng. Một control chỉ được thử trên bản đúng thì chưa ai biết nó bắt được gì —
 * và với bảo mật, "chưa bắt được gì" đọc giống hệt "không có lỗ".
 *
 * Chạy `security_check.js` bằng TIẾN TRÌNH CON BẤT ĐỒNG BỘ: fixture server sống trong chính tiến trình
 * test, nên `execFileSync` sẽ chặn event loop và server không trả lời nổi — một cái bẫy đã dính một lần
 * khi dựng harness đồng thời.
 */

const REPO = path.resolve(__dirname, '..', '..', '..');
const FXDIR = path.join(REPO, 'tests', 'fe', 'fixtures', 'discovery-app');
/* eslint-disable @typescript-eslint/no-var-requires, global-require */
const fixture = require(path.join(FXDIR, 'server.js'));
/* eslint-enable @typescript-eslint/no-var-requires, global-require */

type Srv = { url: string; close(): Promise<void> };
type Kq = { ma: number; ra: string; checks: { group: string; name: string; verdict: string; detail: string }[] };

function catalog(baseUrl: string, hong: Record<string, string> = {}) {
  const q = (p: string) => {
    const s = new URLSearchParams(hong).toString();
    return s ? `${p}${p.includes('?') ? '&' : '?'}${s}` : p;
  };
  return {
    base: baseUrl,
    headerTarget: '/',
    checkTransport: false,
    auth: { loginPath: '/auth/login', userField: 'username', passField: 'password', tokenPath: 'token', scheme: 'Bearer' },
    accounts: { low: { userEnv: 'SEC_LOW_USER', passEnv: 'SEC_LOW_PASS' }, high: { userEnv: 'SEC_HIGH_USER', passEnv: 'SEC_HIGH_PASS' } },
    session: { probeEndpoint: q('/api/bm/toi'), logoutPath: '/auth/logout' },
    tenantIsolation: { listEndpoints: [{ name: 'danh sách', url: q('/api/bm/danh-sach'), dauHieuDonViKhac: 'DV-B' }] },
    jwt: { probeEndpoint: q('/api/bm/toi'), truongDonVi: 'don_vi', donViKhac: 'DV-B' },
  };
}

async function chay(srv: Srv, hong: Record<string, string> = {}): Promise<Kq> {
  const tmp = thuMucTam('sec');
  const cat = path.join(tmp, 'catalog.json');
  fs.writeFileSync(cat, JSON.stringify(catalog(srv.url, hong), null, 2));

  const r = await new Promise<{ ma: number; ra: string }>((res) => {
    execFile(
      process.execPath,
      [path.join(REPO, 'scripts/qa/security_check.js'), '--catalog', cat, '--confirm-nonprod', '--out', tmp],
      {
        cwd: REPO,
        encoding: 'utf8',
        env: gateEnv({
          OPS_BASE_URL: srv.url,
          SEC_LOW_USER: 'u-a', SEC_LOW_PASS: 'pw-a', SEC_HIGH_USER: 'u-b', SEC_HIGH_PASS: 'pw-b',
        }),
      },
      (e, so, se) => res({ ma: e ? (e as { code?: number }).code ?? 1 : 0, ra: `${so || ''}${se || ''}` }),
    );
  });

  let checks: Kq['checks'] = [];
  const bc = path.join(tmp, 'security-report.json');
  if (fs.existsSync(bc)) checks = JSON.parse(fs.readFileSync(bc, 'utf8')).checks || [];
  donThuMucTam(tmp);
  return { ...r, checks };
}

const lay = (k: Kq, group: string, chua: string) => k.checks.find((c) => c.group === group && c.name.includes(chua));

test.describe('@infra bảo mật read-only — CẶP hỏng/đúng cho từng control', () => {
  test.setTimeout(120000);

  test('phiên: token sau LOGOUT — bị từ chối ⇒ PASS, còn dùng được ⇒ FAIL', async () => {
    const s: Srv = await fixture.start();
    const ok = await chay(s);
    const bad = await chay(s, { nhan_sau_logout: '1' });
    await s.close();

    expect(lay(ok, 'session', 'LOGOUT')?.verdict, 'fixture ĐÚNG phải PASS').toBe('PASS');
    expect(lay(bad, 'session', 'LOGOUT')?.verdict, 'token sau logout vẫn 200 ⇒ phải FAIL').toBe('FAIL');
  });

  test('cô lập đơn vị: danh sách lẫn đơn vị khác ⇒ FAIL', async () => {
    const s: Srv = await fixture.start();
    const ok = await chay(s);
    const bad = await chay(s, { lo_don_vi: '1' });
    await s.close();

    expect(lay(ok, 'tenantIsolation', 'danh sách')?.verdict).toBe('PASS');
    const x = lay(bad, 'tenantIsolation', 'danh sách');
    expect(x?.verdict, 'tài khoản đơn vị A thấy bản ghi đơn vị B ⇒ FAIL').toBe('FAIL');
    expect(x?.detail, 'FAIL phải NÊU dấu hiệu đã bắt được').toMatch(/DV-B/);
  });

  test('JWT: sửa payload không ký lại · alg=none · chữ ký sai — từ chối ⇒ PASS', async () => {
    const s: Srv = await fixture.start();
    const ok = await chay(s);
    await s.close();
    for (const ca of ['sửa payload', 'alg=none', 'chữ ký sai']) {
      expect(lay(ok, 'jwt', ca)?.verdict, `ca "${ca}"`).toBe('PASS');
    }
  });

  test('JWT: BE chấp nhận token sửa payload ⇒ FAIL; chấp nhận alg=none ⇒ FAIL', async () => {
    const s: Srv = await fixture.start();
    const chuKy = await chay(s, { bo_qua_chu_ky: '1' });
    const algNone = await chay(s, { alg_none: '1' });
    await s.close();

    expect(lay(chuKy, 'jwt', 'sửa payload')?.verdict).toBe('FAIL');
    expect(lay(chuKy, 'jwt', 'chữ ký sai')?.verdict).toBe('FAIL');
    expect(lay(algNone, 'jwt', 'alg=none')?.verdict).toBe('FAIL');
  });
});

test.describe('@infra bảo mật read-only — thiếu thì NÓI THIẾU, không đoán', () => {
  test.setTimeout(120000);

  test('thiếu tài khoản thứ hai ⇒ NEEDS_ACCOUNT, không FAIL giả', async () => {
    const s: Srv = await fixture.start();
    const tmp = thuMucTam('sec-thieu');
    const cat = path.join(tmp, 'c.json');
    const c = catalog(s.url) as Record<string, unknown>;
    (c.accounts as Record<string, unknown>).high = undefined;
    fs.writeFileSync(cat, JSON.stringify(c));

    const r = await new Promise<string>((res) => {
      execFile(process.execPath,
        [path.join(REPO, 'scripts/qa/security_check.js'), '--catalog', cat, '--confirm-nonprod', '--out', tmp],
        { cwd: REPO, encoding: 'utf8', env: gateEnv({ OPS_BASE_URL: s.url, SEC_LOW_USER: 'u-a', SEC_LOW_PASS: 'pw-a' }) },
        () => res(fs.existsSync(path.join(tmp, 'security-report.json')) ? fs.readFileSync(path.join(tmp, 'security-report.json'), 'utf8') : ''));
    });
    await s.close();
    const checks = JSON.parse(r || '{"checks":[]}').checks as Kq['checks'];
    donThuMucTam(tmp);

    const ti = checks.find((x) => x.group === 'tenantIsolation');
    expect(ti?.verdict, 'thiếu tài khoản ⇒ NEEDS_ACCOUNT: phép đo CHƯA xảy ra, không phải đạt và cũng không phải sai').toBe('NEEDS_ACCOUNT');
  });

  test('KHÔNG có `--confirm-nonprod` ⇒ TỪ CHỐI chạy', async () => {
    const tmp = thuMucTam('sec-xacnhan');
    const cat = path.join(tmp, 'c.json');
    fs.writeFileSync(cat, JSON.stringify(catalog('https://uat.vi-du.local')));
    const r = await new Promise<number>((res) => {
      execFile(process.execPath, [path.join(REPO, 'scripts/qa/security_check.js'), '--catalog', cat, '--out', tmp],
        { cwd: REPO, encoding: 'utf8', env: gateEnv() },
        (e) => res(e ? (e as { code?: number }).code ?? 1 : 0));
    });
    donThuMucTam(tmp);
    expect(r, 'dấu hiệu tên host không thay được một lượt xác nhận của người').not.toBe(0);
  });
});

test.describe('@infra bảo mật — bản mẫu catalog phải tồn tại và đủ ba nhóm mới', () => {
  test('`security_catalog.example.json` có `session`, `tenantIsolation`, `jwt`', () => {
    /*
     * Đo 14/10/2026: repo KHÔNG có catalog nào, kể cả bản mẫu — tức máy bảo mật nhiều khả năng chưa từng
     * chạy. Thêm control vào một máy không ai chạy được thì cũng không ai chạy.
     */
    const p = path.join(REPO, '.agent/config/security_catalog.example.json');
    expect(fs.existsSync(p), 'thiếu bản mẫu thì ba nhóm mới không ai chạy được').toBe(true);
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const k of ['session', 'tenantIsolation', 'jwt']) expect(j[k], `bản mẫu thiếu khối \`${k}\``).toBeTruthy();
    /* URL lấy từ biến môi trường, KHÔNG khai trong file — khai host ở đây vừa bị bỏ qua vừa là chỉ dẫn sai. */
    expect(j.base, 'bản mẫu KHÔNG được khai ').toBeUndefined();
    expect(j.baseUrlEnv, 'phải chỉ ra lấy URL từ biến môi trường nào').toBeTruthy();
  });
});
