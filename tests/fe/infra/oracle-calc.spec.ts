import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { gateEnv } from './_gate_env';
import { thuMucTam, donThuMucTam } from './_thu_muc_tam';
import {
  dangKy, tinh, tatCa, theoRef, OracleUsageError, ORACLE_RE,
} from '../lib/oracles/index';
import '../lib/oracles/truong';
import '../lib/oracles/lop';

/*
 * Trục ⑦ `oracle_calc`.
 *
 * Thứ phải khoá KHÔNG phải "oracle tính đúng" — mà là **oracle không thể trở thành `app == app`**. Một
 * oracle viết theo quan sát app rồi gắn mã `BR-` vào vẫn trông hợp lệ và vẫn xanh mãi mãi; đó là lý do
 * mỗi oracle bị đòi một ca LỆCH, và vì sao máy canh cấu trúc có đối chứng của chính nó dưới đây.
 */

const REPO = path.resolve(__dirname, '..', '..', '..');
const MAY = path.join(REPO, 'scripts', 'qa', 'oracle_calc_check.js');
const node = process.execPath;

function chayMay(them: string[]): { ma: number; ra: string; bao: string } {
  const out = path.join(thuMucTam('oracle-out'), 'oracle-calc.md');
  let ma = 0;
  let ra = '';
  try {
    ra = execFileSync(node, [MAY, '--out', out, ...them], {
      cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: gateEnv(),
    });
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    ma = err.status ?? 1;
    ra = `${err.stdout || ''}${err.stderr || ''}`;
  }
  return { ma, ra, bao: fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '' };
}

test.describe('@infra trục ⑦ — oracle giá trị tính toán', () => {
  test('mọi oracle đã đăng ký: ca ĐÚNG trả đúng, ca LỆCH trả KHÁC giá trị app', () => {
    const ds = tatCa();
    /*
     * Mẫu số phải lớn hơn 0 — nếu không, cả describe này xanh mà chưa kiểm gì. Đây đúng là kiểu test
     * rỗng mà `expansion_audit` gọi là `proven=0`.
     */
    expect(ds.length, 'không oracle nào đăng ký ⇒ CHƯA KIỂM, không phải PASS').toBeGreaterThan(0);

    for (const o of ds) {
      for (const c of o.dung) {
        expect(tinh(o, c.input), `${o.oracle_ref} · ca đúng ${JSON.stringify(c.input)}`).toEqual(c.ky_vong);
      }
      for (const c of o.lech) {
        /*
         * Vế quyết định của cả trục: oracle phải KHÁC con số app trả. Nếu bằng thì oracle đang chép lại
         * hành vi app, và case sẽ xanh kể cả khi app sai.
         */
        expect(tinh(o, c.input), `${o.oracle_ref} · ca lệch: ${c.vi_sao}`).not.toEqual(c.app_tra);
      }
    }
  });

  test('thiếu tham số ⇒ NÉM, không có giá trị mặc định', () => {
    const o = theoRef('BR-HSLOP-035');
    expect(() => tinh(o, { cap: 'TH' } as never), 'thiếu `loai`').toThrow(OracleUsageError);
    expect(() => tinh(o, {} as never)).toThrow(/thiếu tham số/);
    /* VẾ ÂM: đủ tham số thì KHÔNG được ném — nếu không thì "luôn ném" cũng qua được test trên. */
    expect(tinh(o, { cap: 'TH', loai: 'thuong' } as never)).toBe(35);
  });

  test('cấp mà rule KHÔNG phủ ⇒ ném, không bịa một ngưỡng nghe thuận tai', () => {
    const o = theoRef('BR-HSLOP-035');
    for (const cap of ['THCS', 'THPT', 'GDTX']) {
      expect(() => tinh(o, { cap, loai: 'thuong' } as never), `cấp ${cap}`).toThrow(/KHÔNG quy định|không phán được/);
    }
  });

  test('`dangKy` từ chối oracle sai khuôn — và nói rõ thiếu vế nào', () => {
    const goc = { ten: 't', doi: ['x'], tinh: () => 1, dung: [{ input: { x: 1 }, ky_vong: 1 }], lech: [{ input: { x: 1 }, app_tra: 2, vi_sao: 'v' }] };

    expect(() => dangKy({ ...goc, oracle_ref: 'khong-phai-ma' } as never), 'ref sai khuôn').toThrow(/sai khuôn/);
    expect(() => dangKy({ ...goc, oracle_ref: 'BR-TEST-901', doi: [] } as never), 'không khai `doi`').toThrow(/doi/);
    expect(() => dangKy({ ...goc, oracle_ref: 'BR-TEST-902', dung: [] } as never), 'không có ca đúng').toThrow(/ca ĐÚNG/);
    expect(() => dangKy({ ...goc, oracle_ref: 'BR-TEST-903', lech: [] } as never), 'không có ca lệch').toThrow(/ca LỆCH/);

    /* Trùng mã: hai quy tắc cùng `oracle_ref` thì case trỏ vào đó không biết nó đang so với cái nào. */
    dangKy({ ...goc, oracle_ref: 'BR-TEST-904' } as never);
    expect(() => dangKy({ ...goc, oracle_ref: 'BR-TEST-904' } as never)).toThrow(/đã có oracle khác/);
  });

  test('`theoRef` không tra ra ⇒ NÉM, không lặng lẽ thành "không cần oracle"', () => {
    expect(() => theoRef('BR-KHONGCO-999')).toThrow(/CHƯA KIỂM/);
  });

  test('khuôn `oracle_ref` KHỚP `finding.js` — hai nơi lệch là oracle ma im lặng', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const fnd = require(path.join(REPO, 'scripts/lib/expansion/finding.js'));
    expect(ORACLE_RE.source).toBe(fnd.ORACLE_RE.source);
  });

  test('máy canh: bộ oracle thật phải SẠCH', () => {
    const k = chayMay([]);
    expect(k.ma, 'bộ oracle trong repo phải qua được máy canh của chính nó').toBe(0);
    expect(k.bao).toMatch(/proven=[1-9]/);
    expect(k.bao).toContain('BR-HSLOP-035');
  });

  test('máy canh BẮT được oracle ma, rule draft, thiếu ca lệch, và oracle đọc app', () => {
    const tmp = thuMucTam('oracle-xau');
    try {
      /* ĐỐI CHỨNG của chính máy canh: nếu nó không đỏ với bốn ca này thì nó không canh gì. */
      fs.writeFileSync(path.join(tmp, 'ma.ts'), [
        "import { dangKy } from './index';",
        "export const a = dangKy({ oracle_ref: 'BR-KHONGCOTHAT-777', ten: 'oracle ma', doi: ['x'],",
        '  tinh: () => 1, dung: [{ input: {}, ky_vong: 1 }], lech: [{ input: {}, app_tra: 2, vi_sao: -1 }] });',
      ].join('\n'));
      fs.writeFileSync(path.join(tmp, 'thieu-lech.ts'), [
        "import { dangKy } from './index';",
        "export const b = dangKy({ oracle_ref: 'BR-HSLOP-035', ten: 'thiếu ca lệch', doi: ['x'],",
        '  tinh: () => 1, dung: [{ input: {}, ky_vong: 1 }] });',
      ].join('\n'));
      fs.writeFileSync(path.join(tmp, 'doc-app.ts'), [
        "import { dangKy } from './index';",
        "export const c = dangKy({ oracle_ref: 'BR-HSTRUONG-010', ten: 'đọc app', doi: ['p'],",
        '  tinh: (d) => Number(d.p.locator(".tong").textContent()),',
        '  dung: [{ input: {}, ky_vong: 1 }], lech: [{ input: {}, app_tra: 2, vi_sao: "v" }] });',
      ].join('\n'));

      const k = chayMay(['--dir', tmp, '--enforce']);
      expect(k.ma, '--enforce phải chặn').toBe(1);
      expect(k.ra, 'oracle ma').toContain('oracle ma');
      expect(k.ra, 'thiếu ca lệch').toMatch(/ca LỆCH/);
      expect(k.ra, 'oracle đọc DOM').toMatch(/locator|đọc app|đọc DOM/);
    } finally { donThuMucTam(tmp); }
  });

  test('0 oracle ⇒ CHƯA KIỂM (exit 2), KHÔNG phải "không có vấn đề tính toán"', () => {
    const tmp = thuMucTam('oracle-rong');
    try {
      const k = chayMay(['--dir', tmp]);
      expect(k.ma, 'mẫu số 0 là KHÔNG PHÁN ĐƯỢC').toBe(2);
      expect(k.bao).toContain('<!-- gate: proven=0');
      expect(k.bao).toContain('CHƯA KIỂM');
      expect(k.bao, 'không được đọc thành một lượt đo đạt').toContain('KHÔNG có nghĩa');
    } finally { donThuMucTam(tmp); }
  });

  test('khối chú thích KHÔNG làm máy canh đỏ — nếu không, người ta sẽ gỡ lời giải thích cho xanh', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const may = require(path.join(REPO, 'scripts/qa/oracle_calc_check.js'));
    const src = '/* không được dùng page.locator() hay expect() ở đây */\nexport const x = 1;';
    const than = may.thanMa(src);
    for (const c of may.CAM) expect(c.re.test(than), `mẫu ${c.re} không được khớp phần chú thích`).toBe(false);
  });
});
