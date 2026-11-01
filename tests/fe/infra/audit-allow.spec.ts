import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * `audit:ci` — MỘT CON SỐ DƯỚI NGƯỠNG KHÔNG MANG THÔNG TIN (v2.9.7).
 *
 * Bản trước in `moderate 12` rồi `✓ OK — 0 vuln ≥ high`. Đúng từng chữ, nhưng `12` không phân biệt được
 * "advisory đã rà" với "advisory vừa xuất hiện", nên một cái mới chui vào dưới ngưỡng là vô hình.
 *
 * ĐO 01/11/2026, và phép đo này là chính tôi: tôi báo với người dùng `8 advisory moderate (uuid,
 * exceljs)`. Sai con số, sai tên gói, sai cả bản chất — `12` và `8` đều là số GÓI (cả cây / chỉ prod),
 * còn số advisory là **1** (`minimatch` GHSA-g3hv-75wg-m249). Tôi đọc con số đó từ trí nhớ vì bản thân
 * nó không chở theo gì để đối chiếu.
 *
 * Bộ test này lái cửa bằng FIXTURE qua `--from-json`, không qua registry — một phép kiểm về cách đọc
 * advisory mà lại phụ thuộc tình trạng mạng thì nó đo lẫn hai thứ, và sẽ đỏ với thông điệp sai.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const MAY = path.join(REPO, 'scripts/qa/audit_ci.js');
const SO_KHAI = path.join(REPO, '.agent/config/audit_allow.json');

test.describe.configure({ mode: 'default' });

/* Một advisory `GHSA-AAAA` ở `goc`, tán xuống `tan[]` qua `via` dạng CHUỖI — đúng hình dạng npm audit. */
function fixture(opts: { ma?: string; muc?: string; goc?: string; tan?: string[] } = {}) {
  const ma = opts.ma || 'GHSA-aaaa-bbbb-cccc';
  const muc = opts.muc || 'moderate';
  const goc = opts.goc || 'goi-goc';
  const tan = opts.tan || ['goi-a', 'goi-b'];
  const vulns: Record<string, unknown> = {
    [goc]: {
      name: goc, severity: muc, isDirect: false, effects: tan, range: '<1.0.0', nodes: [`node_modules/${goc}`],
      via: [{ source: 1, name: goc, dependency: goc, title: 'lỗ hổng giả lập để kiểm cửa', url: `https://github.com/advisories/${ma}`, severity: muc, module_name: goc, range: '<1.0.0' }],
    },
  };
  for (const t of tan) {
    vulns[t] = { name: t, severity: muc, isDirect: false, effects: [], range: '*', nodes: [`node_modules/${t}`], via: [goc] };
  }
  const dem: Record<string, number> = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
  dem[muc] = 1 + tan.length;
  dem.total = 1 + tan.length;
  return { vulnerabilities: vulns, metadata: { vulnerabilities: dem } };
}

function chay(fx: unknown, them: string[] = []) {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'auditfx-')), 'audit.json');
  fs.writeFileSync(f, JSON.stringify(fx), 'utf8');
  return spawnSync(process.execPath, [MAY, '--from-json', f, ...them], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
}

test.describe('@infra audit:ci — advisory chưa ai xem KHÔNG được trốn trong một con số', () => {
  test('ĐỐI CHỨNG DƯƠNG: advisory moderate CHƯA KHAI ⇒ CHẶN, nêu đích danh mã GHSA', () => {
    const r = chay(fixture({ ma: 'GHSA-zzzz-yyyy-xxxx' }));
    expect(r.status, 'dưới ngưỡng nhưng chưa ai xem ⇒ phải chặn').toBe(1);
    expect(`${r.stdout}${r.stderr}`).toContain('GHSA-zzzz-yyyy-xxxx');
    expect(`${r.stdout}${r.stderr}`).toContain('CHƯA AI KHAI');
  });

  test('ĐỐI CHỨNG ÂM: advisory ĐÃ khai và CÒN HẠN ⇒ cho qua, in lại hạn', () => {
    /* Dùng chính advisory thật đang khai trong sổ, nên phép kiểm này cũng gác luôn sổ thật. */
    const khai = JSON.parse(fs.readFileSync(SO_KHAI, 'utf8'));
    const that = khai.khai[0];
    const r = chay(fixture({ ma: that.ghsa }), ['--hom-nay', '2026-11-01']);
    expect(r.status, `${that.ghsa} đang khai trong sổ và hạn ${that.het_han}`).toBe(0);
    expect(`${r.stdout}`).toContain('đã khai, hạn');
    expect(`${r.stdout}`).toContain('đều đã khai và còn hạn');
  });

  test('HẾT HẠN ⇒ CHẶN, dù vẫn còn trong sổ', () => {
    const khai = JSON.parse(fs.readFileSync(SO_KHAI, 'utf8'));
    const r = chay(fixture({ ma: khai.khai[0].ghsa }), ['--hom-nay', '2099-01-01']);
    expect(r.status, 'rủi ro đã nhận mà không rà lại thì thành đã quên').toBe(1);
    expect(`${r.stdout}${r.stderr}`).toContain('HẾT HẠN');
  });

  test('advisory ≥ ngưỡng chặn thì sổ KHÔNG miễn trừ được', () => {
    const khai = JSON.parse(fs.readFileSync(SO_KHAI, 'utf8'));
    const r = chay(fixture({ ma: khai.khai[0].ghsa, muc: 'high' }), ['--hom-nay', '2026-11-01']);
    expect(r.status, 'khai rồi vẫn không được qua ở mức high').toBe(1);
    expect(`${r.stdout}${r.stderr}`).toContain('KHÔNG miễn trừ được');
  });
});

test.describe('@infra audit:ci — số GÓI không phải số ADVISORY', () => {
  test('1 advisory tán xuống 7 gói ⇒ nói rõ 8 gói ⇐ 1 advisory', () => {
    /*
     * Đây là phép kiểm cho chính con số tôi đã nói sai. 8 dòng `npm audit` là 8 GÓI; advisory là 1.
     * Nếu cửa chỉ in `moderate 8` thì người đọc — kể cả tôi — sẽ đọc nó thành 8 lỗ hổng.
     */
    const tan = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7'];
    const r = chay(fixture({ ma: 'GHSA-mmmm-nnnn-oooo', tan }));
    expect(`${r.stdout}`).toContain('8 gói bị ảnh hưởng ⇐ 1 advisory gốc');
    expect(`${r.stdout}`, 'và nói thẳng rằng hai con số đó khác nhau').toContain('số gói KHÔNG phải số advisory');
  });

  test('TÁN phải đi hết chuỗi `via`, không chỉ gói mang advisory', () => {
    /*
     * Gói bị ảnh hưởng gián tiếp có `via` là CHUỖI. Bản đầu của tôi chỉ đếm gói có `via` dạng object,
     * nên in "tán ra 1 gói" cho một advisory đang ảnh hưởng 8 — đúng lớp hỏng mà máy này ra đời để
     * chữa, tái diễn ngay trong máy. Phép kiểm này khoá nó lại.
     */
    const khai = JSON.parse(fs.readFileSync(SO_KHAI, 'utf8'));
    const tan = ['g1', 'g2', 'g3', 'g4'];
    const r = chay(fixture({ ma: khai.khai[0].ghsa, tan }), ['--hom-nay', '2026-11-01']);
    expect(`${r.stdout}`, 'phải đếm cả 5 gói: 1 mang advisory + 4 tán').toContain('tán ra 5 gói');
    expect(`${r.stdout}`).not.toContain('tán ra 1 gói');
  });

  test('vòng trong chuỗi `via` KHÔNG làm cửa treo', () => {
    /* Hai gói trỏ vòng vào nhau là hình dạng có thật trong cây phụ thuộc. */
    const fx = fixture({ ma: 'GHSA-cccc-dddd-eeee', tan: ['vong-a'] }) as {
      vulnerabilities: Record<string, { via: unknown[] }>;
    };
    fx.vulnerabilities['vong-b'] = { via: ['vong-a'] } as never;
    (fx.vulnerabilities['vong-a'].via as unknown[]).push('vong-b');
    const r = chay(fx);
    expect(r.status, 'phải phán được, không treo và không vỡ').toBe(1);
    expect(`${r.stdout}${r.stderr}`).toContain('GHSA-cccc-dddd-eeee');
  });
});

test.describe('@infra audit:ci — sổ khai phải là sổ, không phải chỗ dán nhãn', () => {
  test('mỗi dòng khai có mã GHSA · hạn dùng · và `vi_sao` mang PHÉP ĐO', () => {
    const khai = JSON.parse(fs.readFileSync(SO_KHAI, 'utf8'));
    expect(Array.isArray(khai.khai), 'sổ phải có mục `khai` dạng mảng').toBe(true);
    for (const k of khai.khai) {
      expect(k.ghsa, 'khoá theo mã GHSA, không theo tên gói').toMatch(/^GHSA-[0-9a-z-]+$/i);
      expect(k.het_han, `${k.ghsa} phải có hạn dùng`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(k.ra_lai_khi, `${k.ghsa} phải nói rà lại khi nào`).toBeTruthy();
      /*
       * `vi_sao` phải là phép đo. Ngưỡng độ dài không chứng minh được điều đó, nhưng nó chặn được dạng
       * một dòng dán nhãn — và đó là dạng duy nhất máy phân biệt được.
       */
      expect(String(k.vi_sao).length, `${k.ghsa}: lý do quá ngắn để là một phép đo`).toBeGreaterThan(200);
      expect(String(k.vi_sao), `${k.ghsa}: "rủi ro thấp" không phải phép đo`).not.toMatch(/^(rủi ro thấp|không đáng kể|ít ảnh hưởng)\.?$/i);
    }
  });

  test('sổ KHÔNG có dòng nào đã hết hạn tính từ hôm nay', () => {
    const khai = JSON.parse(fs.readFileSync(SO_KHAI, 'utf8'));
    const homNay = new Date().toISOString().slice(0, 10);
    const qua = khai.khai.filter((k: { het_han: string }) => String(k.het_han) < homNay);
    expect(qua.map((k: { ghsa: string }) => k.ghsa), 'hết hạn thì phải rà lại rồi gia hạn, không để nguyên').toEqual([]);
  });
});
