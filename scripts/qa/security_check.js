#!/usr/bin/env node
'use strict';

/*
 * Security check (BASIC, non-destructive) — biến phần deterministic của mục 15 thành ĐO THẬT.
 * Chỉ kiểm soát mang tính PHÁT HIỆN, chạy trên UAT, tài khoản test, **GET/read-only**.
 *
 * RANH GIỚI AN TOÀN (BẮT BUỘC — đừng biến thành pentest tool):
 *   - KHÔNG fuzzing, KHÔNG khai thác SQLi/XSS làm đổi dữ liệu, KHÔNG brute-force/đập rate-limit.
 *   - Chỉ GET; không mutate. Fuzzing/ZAP/brute-force → Manual-only + tool chuyên, opt-in, có phê duyệt người.
 *   - Chạy never-auto: PHẢI có --confirm-nonprod (xác nhận target non-prod + được phép) mới chạy.
 *   - Report MASK mọi PII/secret (không dump raw) — theo org rule + posture mask-PII của kit.
 *
 * Verdict: control xác định (headers/unauth status/authz status/transport) → PASS/FAIL.
 *          Dò sensitive-data-exposure (heuristic) → FINDING (review), không PASS/FAIL cứng.
 *
 * Dùng:
 *   TASK_ENV=profiles/<TASK>/task.env node scripts/qa/security_check.js --catalog <.../security_catalog.json> --confirm-nonprod
 */

const fs = require('fs');
const path = require('path');
require(path.resolve(__dirname, '..', 'utils', 'runtime_config'));

// F4 — KHÔNG phụ thuộc @playwright/test (devDependency) ở runtime → chạy được cả khi cài `--omit=dev`.
// Dùng axios (đã là dependency) qua shim giữ NGUYÊN interface `request` của Playwright mà script cần.
let axios;
try { axios = require('axios'); }
catch (e) { console.error('[security] Thiếu dependency "axios" (khai trong package.json). Chạy `npm ci` rồi thử lại.'); process.exit(2); }

const request = {
  async newContext({ extraHTTPHeaders = {} } = {}) {
    const inst = axios.create({ headers: extraHTTPHeaders, validateStatus: () => true, timeout: 20000, maxRedirects: 5 });
    const wrap = (r) => ({
      status: () => r.status,
      headers: () => r.headers || {},
      headersArray: () => Object.entries(r.headers || {}).flatMap(([name, value]) =>
        (Array.isArray(value) ? value.map((v) => ({ name, value: String(v) })) : [{ name, value: String(value) }])),
      json: async () => (r.data && typeof r.data === 'object' ? r.data : JSON.parse(r.data)),
      text: async () => (typeof r.data === 'string' ? r.data : JSON.stringify(r.data)),
    });
    return {
      // Playwright request mặc định FOLLOW redirect; chỉ chặn khi caller truyền maxRedirects:0 (headers/transport check).
      async get(url, opts = {}) { return wrap(await inst.get(url, { maxRedirects: opts.maxRedirects != null ? opts.maxRedirects : 5 })); },
      async post(url, opts = {}) { return wrap(await inst.post(url, (opts && opts.data) || {})); },
      async dispose() {},
    };
  },
};

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && (process.argv[i + 1] === undefined || String(process.argv[i + 1]).startsWith('--'))) return true;
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const CATALOG = arg('catalog');
const CONFIRM = arg('confirm-nonprod', false) === true || process.env.SECURITY_CHECK_CONFIRM === '1';

if (!CATALOG || !fs.existsSync(CATALOG)) {
  console.error(`ERROR: cần --catalog <security_catalog.json>. Không tồn tại: ${CATALOG}`);
  process.exit(2);
}
if (!CONFIRM) {
  console.error(
    '[security] TỪ CHỐI chạy: security_check là never-auto, chỉ read-only trên UAT.\n' +
      'Xác nhận target là NON-PROD và bạn được phép kiểm thử, rồi chạy lại với --confirm-nonprod\n' +
      '(hoặc đặt SECURITY_CHECK_CONFIRM=1). KHÔNG chạy trên production.',
  );
  process.exit(3);
}

const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const sec = catalog.security || catalog;
const OUT = path.resolve(arg('out', path.join(path.dirname(CATALOG), '..', 'reports')));
fs.mkdirSync(OUT, { recursive: true });

const base = (process.env[sec.baseUrlEnv || 'OPS_BASE_URL'] || '').replace(/\/+$/, '');
const REQUIRED_HEADERS = sec.requiredHeaders || [
  'strict-transport-security', 'content-security-policy', 'x-frame-options',
  'x-content-type-options', 'referrer-policy',
];
const SENSITIVE_KEYS = (sec.sensitiveKeys || ['password', 'passwd', 'token', 'secret', 'hash', 'api_key', 'apikey', 'authorization']).map((k) => k.toLowerCase());
const abs = (u) => (/^https?:/.test(u) ? u : base + u);

function mask(v) {
  const s = String(v);
  if (s.length <= 3) return '*'.repeat(s.length);
  return s.slice(0, 2) + '*'.repeat(Math.max(1, s.length - 3)) + s.slice(-1);
}

function getPath(obj, p) {
  return String(p).split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

async function getToken(auth, userEnv, passEnv) {
  if (!auth || !auth.loginPath || !process.env[userEnv] || !process.env[passEnv]) return null;
  const ctx = await request.newContext();
  try {
    const resp = await ctx.post(abs(auth.loginPath), {
      data: { [auth.userField || 'username']: process.env[userEnv], [auth.passField || 'password']: process.env[passEnv] },
    });
    const body = await resp.json().catch(() => ({}));
    return getPath(body, auth.tokenPath || 'token') || null;
  } catch (e) {
    return null;
  } finally {
    await ctx.dispose();
  }
}

// Dò key/PII nhạy cảm trong body — CHỈ ghi tên key + sample đã MASK, không ghi raw.
function scanExposure(obj, out, trail = '') {
  if (obj == null) return;
  if (Array.isArray(obj)) { obj.slice(0, 20).forEach((v, i) => scanExposure(v, out, `${trail}[${i}]`)); return; }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      const kl = k.toLowerCase();
      if (SENSITIVE_KEYS.some((s) => kl.includes(s)) && v && typeof v !== 'object') {
        out.push({ path: `${trail}.${k}`, key: k, masked: mask(v), type: 'sensitive-key' });
      }
      if (typeof v === 'string') {
        if (/@[\w.-]+\.\w+/.test(v)) out.push({ path: `${trail}.${k}`, masked: mask(v), type: 'PII-email?' });
        else if (/(^|\D)(0|\+84)\d{8,10}(\D|$)/.test(v)) out.push({ path: `${trail}.${k}`, masked: mask(v), type: 'PII-phone?' });
      }
      if (v && typeof v === 'object') scanExposure(v, out, `${trail}.${k}`);
    }
  }
}

const checks = [];
const add = (group, name, verdict, detail) => checks.push({ group, name, verdict, detail });

(async () => {
  const findings = [];

  // 1) Security headers + cookie flags (deterministic PASS/FAIL) — GET base/target.
  const anon = await request.newContext();
  try {
    const target = sec.headerTarget ? abs(sec.headerTarget) : base + (sec.login && sec.login.loginPath || '/');
    const resp = await anon.get(target, { maxRedirects: 0 }).catch((e) => null);
    if (resp) {
      const h = resp.headers();
      for (const hdr of REQUIRED_HEADERS) {
        add('headers', hdr, h[hdr] ? 'PASS' : 'FAIL', h[hdr] ? 'present' : 'thiếu header');
      }
      const setCookie = (resp.headersArray() || []).filter((x) => x.name.toLowerCase() === 'set-cookie').map((x) => x.value);
      for (const c of setCookie) {
        const cl = c.toLowerCase();
        const nm = c.split('=')[0];
        add('cookie', nm, (cl.includes('httponly') && cl.includes('secure')) ? 'PASS' : 'FAIL',
          `HttpOnly:${cl.includes('httponly')} Secure:${cl.includes('secure')} SameSite:${/samesite=(\w+)/.exec(cl)?.[1] || 'none'}`);
      }
      // 4) exposure scan trên body (nếu JSON)
      const body = await resp.text().catch(() => '');
      try { scanExposure(JSON.parse(body), findings, 'headerTarget'); } catch (e) {}
    } else {
      add('headers', 'target', 'FAIL', 'không lấy được response');
    }
  } finally { await anon.dispose(); }

  // 2) Truy cập khi CHƯA đăng nhập → 401/403 (GET, không token).
  const noauth = await request.newContext();
  try {
    for (const ep of sec.protectedEndpoints || []) {
      const r = await noauth.get(abs(ep.url)).catch(() => null);
      const st = r ? r.status() : 0;
      add('unauth', ep.name || ep.url, [401, 403].includes(st) ? 'PASS' : 'FAIL', `status ${st} (kỳ vọng 401/403, không trả data)`);
      if (r && [200].includes(st)) { const b = await r.text().catch(() => ''); try { scanExposure(JSON.parse(b), findings, `unauth:${ep.name}`); } catch (e) {} }
    }
  } finally { await noauth.dispose(); }

  // 3) AuthZ matrix + IDOR bằng 2 tài khoản test (GET-only). Degrade needs_account nếu chưa cấu hình.
  const accLow = sec.accounts && sec.accounts.low;
  const accHigh = sec.accounts && sec.accounts.high;
  const tokenLow = accLow ? await getToken(sec.auth, accLow.userEnv, accLow.passEnv) : null;
  const tokenHigh = accHigh ? await getToken(sec.auth, accHigh.userEnv, accHigh.passEnv) : null;
  const scheme = (sec.auth && sec.auth.scheme) || 'Bearer';

  if (!accLow || !tokenLow) {
    add('authz', '2-account matrix', 'NEEDS_ACCOUNT', 'thiếu tài khoản test low (sec.accounts.low + env) → không chạy authz/IDOR (không phải FAIL)');
  } else {
    const lowCtx = await request.newContext({ extraHTTPHeaders: { Authorization: `${scheme} ${tokenLow}` } });
    try {
      // Privilege escalation: low gọi endpoint chức năng role cao → kỳ vọng 403.
      for (const ep of sec.highPrivEndpoints || []) {
        const r = await lowCtx.get(abs(ep.url)).catch(() => null);
        const st = r ? r.status() : 0;
        add('authz-vertical', ep.name || ep.url, st === 403 ? 'PASS' : (st === 401 ? 'PASS' : 'FAIL'), `low role → status ${st} (kỳ vọng 403)`);
      }
      // IDOR: low đọc resource của user khác (khai trong catalog, thuộc account test B) → 403/404.
      for (const ep of sec.idorEndpoints || []) {
        const r = await lowCtx.get(abs(ep.url)).catch(() => null);
        const st = r ? r.status() : 0;
        add('authz-idor', ep.name || ep.url, [403, 404].includes(st) ? 'PASS' : 'FAIL', `đổi id sang resource user khác → status ${st} (kỳ vọng 403/404, không trả data B)`);
        if (r && st === 200) { const b = await r.text().catch(() => ''); try { scanExposure(JSON.parse(b), findings, `idor:${ep.name}`); } catch (e) {} }
      }
    } finally { await lowCtx.dispose(); }
  }

  /*
   * ───────────────── BA NHÓM READ-ONLY BÙ THÊM (v2.8.4 mục B) ─────────────────
   *
   * Tất cả chỉ GỌI GET với token ở các trạng thái khác nhau. Không ghi dữ liệu nghiệp vụ, không
   * brute-force, không khai thác. Ngoại lệ DUY NHẤT là `logout`: nó đổi trạng thái PHIÊN của chính tài
   * khoản test, và không có cách nào kiểm "token sau logout còn dùng được không" mà không logout.
   *
   * Nhóm cần thao tác GHI thật (mass assignment · upload độc · đổi mật khẩu thật) KHÔNG thuộc đợt này —
   * ghi rõ ở đây để không ai đọc báo cáo rồi tưởng đã phủ.
   */

  // 4b) Quản lý phiên.
  if (sec.session && tokenLow) {
    const sess = sec.session;
    const thu = async (token, nhan, kyVong) => {
      const c = await request.newContext({ extraHTTPHeaders: { Authorization: `${scheme} ${token}` } });
      try {
        const r = await c.get(abs(sess.probeEndpoint)).catch(() => null);
        const st = r ? r.status() : 0;
        add('session', nhan, kyVong.includes(st) ? 'PASS' : 'FAIL', `status ${st} (kỳ vọng ${kyVong.join('/')})`);
      } finally { await c.dispose(); }
    };

    if (!sess.probeEndpoint) {
      add('session', 'probeEndpoint', 'NEEDS_ACCOUNT', 'catalog chưa khai `session.probeEndpoint` — không có endpoint nào để thử token');
    } else {
      if (sess.expiredToken && process.env[sess.expiredToken]) {
        await thu(process.env[sess.expiredToken], 'token HẾT HẠN bị từ chối', [401, 403]);
      } else {
        add('session', 'token HẾT HẠN bị từ chối', 'NEEDS_ACCOUNT', `thiếu env \`${sess.expiredToken || '(chưa khai)'}\` chứa token hết hạn — không đoán`);
      }

      if (sess.logoutPath) {
        /*
         * Lấy token RIÊNG cho phép thử này rồi mới logout. Dùng `tokenLow` thì các nhóm sau mất token,
         * và thứ tự chạy trở thành một phụ thuộc ẩn — loại lỗi chỉ lộ khi ai đó đổi thứ tự.
         */
        const tokenTam = await getToken(sec.auth, accLow.userEnv, accLow.passEnv);
        if (!tokenTam) {
          add('session', 'token sau LOGOUT bị từ chối', 'NEEDS_ACCOUNT', 'không lấy được token riêng cho phép thử logout');
        } else {
          const lc = await request.newContext({ extraHTTPHeaders: { Authorization: `${scheme} ${tokenTam}` } });
          try { await lc.post(abs(sess.logoutPath)).catch(() => null); } finally { await lc.dispose(); }
          await thu(tokenTam, 'token sau LOGOUT bị từ chối', [401, 403]);
        }
      } else {
        add('session', 'token sau LOGOUT bị từ chối', 'n/a', 'catalog không khai `session.logoutPath`');
      }

      /* Phiên song song: CHỈ kiểm khi spec nói. Không có spec thì đây là lựa chọn thiết kế, không phải lỗi. */
      if (sess.phienSongSong === undefined) {
        add('session', 'đăng nhập lần hai vô hiệu phiên một', 'n/a', 'spec không quy định — không tự đặt kỳ vọng');
      }
    }
  } else if (sec.session) {
    add('session', 'nhóm phiên', 'NEEDS_ACCOUNT', 'thiếu token tài khoản test → không chạy được nhóm phiên');
  }

  // 4c) Cô lập đơn vị/tenant ở mức DANH SÁCH.
  if (sec.tenantIsolation) {
    const ti = sec.tenantIsolation;
    if (!tokenLow || !tokenHigh) {
      add('tenantIsolation', 'danh sách không lẫn đơn vị khác', 'NEEDS_ACCOUNT',
        'cần HAI tài khoản khác đơn vị (accounts.low + accounts.high) — thiếu thì KHÔNG đoán');
    } else {
      const c = await request.newContext({ extraHTTPHeaders: { Authorization: `${scheme} ${tokenLow}` } });
      try {
        for (const ep of ti.listEndpoints || []) {
          const r = await c.get(abs(ep.url)).catch(() => null);
          const st = r ? r.status() : 0;
          if (!r || st !== 200) { add('tenantIsolation', ep.name || ep.url, 'FAIL', `status ${st} — không đọc được danh sách để kiểm`); continue; }
          const raw = await r.text().catch(() => '');
          /*
           * Khác IDOR theo id: ở đây hỏi TẬP dữ liệu trả về có lẫn đơn vị khác không. Dấu hiệu là
           * `ep.dauHieuDonViKhac` — một chuỗi định danh của đơn vị B do catalog khai, không phải dò chữ.
           */
          const lan = ep.dauHieuDonViKhac && raw.includes(ep.dauHieuDonViKhac);
          add('tenantIsolation', ep.name || ep.url, lan ? 'FAIL' : 'PASS',
            lan ? `danh sách CÓ chứa dấu hiệu đơn vị khác (\`${ep.dauHieuDonViKhac}\`)` : 'không thấy dấu hiệu đơn vị khác');
          if (lan) { try { scanExposure(JSON.parse(raw), findings, `tenant:${ep.name}`); } catch (e) { /* body không phải JSON */ } }
        }
      } finally { await c.dispose(); }
    }
  }

  // 4d) JWT/token dị dạng — chỉ GỬI TỚI ENDPOINT ĐỌC, quan sát bị từ chối.
  if (sec.jwt && tokenLow) {
    const je = sec.jwt.probeEndpoint || (sec.session && sec.session.probeEndpoint);
    const phan = String(tokenLow).split('.');
    if (!je) {
      add('jwt', 'probeEndpoint', 'NEEDS_ACCOUNT', 'chưa khai endpoint đọc để thử token dị dạng');
    } else if (phan.length !== 3) {
      add('jwt', 'nhóm JWT', 'n/a', 'token của hệ này KHÔNG có dạng JWT ba phần — nhóm này không áp dụng');
    } else {
      const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const doc = (x) => { try { return JSON.parse(Buffer.from(x, 'base64url').toString('utf8')); } catch (e) { return {}; } };
      const tai = doc(phan[1]);
      const taiSua = b64u({ ...tai, role: 'admin', ...(sec.jwt.truongDonVi ? { [sec.jwt.truongDonVi]: sec.jwt.donViKhac || 'DON-VI-KHAC' } : {}) });

      const ca = [
        ['sửa payload KHÔNG ký lại', [phan[0], taiSua, phan[2]].join('.')],
        ['alg=none', [b64u({ alg: 'none', typ: 'JWT' }), taiSua, ''].join('.')],
        ['chữ ký sai', [phan[0], phan[1], `${phan[2].slice(0, -2)}xx`].join('.')],
      ];
      for (const [nhan, tok] of ca) {
        const c = await request.newContext({ extraHTTPHeaders: { Authorization: `${scheme} ${tok}` } });
        try {
          const r = await c.get(abs(je)).catch(() => null);
          const st = r ? r.status() : 0;
          add('jwt', nhan, [401, 403].includes(st) ? 'PASS' : 'FAIL', `status ${st} (kỳ vọng 401/403)`);
        } finally { await c.dispose(); }
      }
    }
  } else if (sec.jwt) {
    add('jwt', 'nhóm JWT', 'NEEDS_ACCOUNT', 'thiếu token tài khoản test → không dựng được token dị dạng');
  }

  // 5) Transport: http → https redirect.
  if (sec.checkTransport !== false && base.startsWith('https://')) {
    const httpUrl = base.replace('https://', 'http://');
    const t = await request.newContext();
    try {
      const r = await t.get(httpUrl + '/', { maxRedirects: 0 }).catch(() => null);
      const loc = r ? (r.headers()['location'] || '') : '';
      add('transport', 'http→https redirect', (r && [301, 302, 307, 308].includes(r.status()) && loc.startsWith('https://')) ? 'PASS' : 'WARN', r ? `status ${r.status()} → ${loc ? 'https redirect' : 'không redirect https'}` : 'không kết nối http (có thể đã tắt cổng 80 — OK)');
    } finally { await t.dispose(); }
  }

  const report = {
    source: CATALOG, generatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    scope: 'BASIC non-destructive, GET-only, UAT, test accounts',
    checks, findings,
  };
  fs.writeFileSync(path.join(OUT, 'security-report.json'), JSON.stringify(report, null, 2), 'utf8');

  const L = ['# Security Report (BASIC, non-destructive)', '',
    `> Nguồn: ${CATALOG} · ${report.generatedAt}`,
    '> GET/read-only trên UAT, tài khoản test. KHÔNG fuzzing/khai thác/brute-force (→ Manual-only + ZAP opt-in).',
    '> PII/secret đã MASK. Control → PASS/FAIL; exposure → FINDING review.', ''];
  const byGroup = {};
  for (const c of checks) (byGroup[c.group] = byGroup[c.group] || []).push(c);
  for (const [g, cs] of Object.entries(byGroup)) {
    L.push(`## ${g}`);
    L.push('| Check | Verdict | Chi tiết |'); L.push('|---|---|---|');
    for (const c of cs) L.push(`| ${c.name} | ${c.verdict} | ${c.detail} |`);
    L.push('');
  }
  L.push('## Sensitive-data exposure (FINDING — review, đã mask)');
  if (!findings.length) L.push('- Không phát hiện key nhạy cảm/PII lộ (theo heuristic).');
  else { L.push('| Path | Loại | Sample (masked) |'); L.push('|---|---|---|'); for (const f of findings) L.push(`| ${f.path} | ${f.type}${f.key ? ' ('+f.key+')' : ''} | ${f.masked} |`); }
  fs.writeFileSync(path.join(OUT, 'security-report.md'), L.join('\n'), 'utf8');

  const fails = checks.filter((c) => c.verdict === 'FAIL').length;
  console.log(`[security] Đã tạo: ${path.join(OUT, 'security-report.md')}`);
  console.log(`[security] ${checks.length} control-check · ${fails} FAIL · ${findings.length} exposure finding (masked)`);
})();
