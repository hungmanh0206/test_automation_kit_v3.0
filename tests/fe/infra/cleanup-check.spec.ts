import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * `cleanup:check` — FILE DUMP LỌT Ở ROOT REPO (§Cleanup Rules).
 *
 * Máy này được tìm ra bằng `rule:coverage` (v2.7.0 §A10.7): §Cleanup Rules là mục DUY NHẤT thuộc loại
 * `do_duoc_ma_chua_co_may`. Luật liệt kê hẳn bảng pattern, nói rõ chuyện ĐÃ XẢY RA — nhiều file
 * `scratch_*` dump API và swagger sót ở root repo sau một task, chưa gitignore — mà không máy nào quét.
 *
 * `secret:scan` không thay được: nó tìm secret trong NỘI DUNG. Một dump swagger không chứa secret nào
 * vẫn là rác lọt lưới, và nó thường chứa email/SĐT trong giá trị mẫu — một lần `git add .` là commit lộ
 * PII khách (non-negotiable §1).
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const MAY = path.join(REPO, 'scripts/qa/cleanup_check.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const cc = require(MAY);

const chay = (them: string[] = []) => spawnSync(process.execPath, [MAY, ...them], {
  cwd: REPO, encoding: 'utf8', env: gateEnv(),
});

test.describe.configure({ mode: 'serial' });

test.describe('@infra cleanup:check — dump ad-hoc không được ở root', () => {
  test('cây sạch ⇒ exit 0, và KHAI MẪU SỐ đã xét bao nhiêu file', () => {
    const r = chay();
    expect(r.status, `${r.stdout}${r.stderr}`).toBe(0);
    /*
     * Mẫu số là phần bắt buộc: một lượt quét 0 file cũng in "✓ 0 file dump", và dòng đó sẽ được đọc
     * thành "sạch" trong khi nó nghĩa là phép đo hỏng (non-negotiable §3, và §A10.1 CHUA_KIEM).
     */
    expect(`${r.stdout}`).toMatch(/đã xét \d+ file/);
    const n = Number((`${r.stdout}`.match(/đã xét (\d+) file/) || [])[1]);
    expect(n, '0 file đã xét nghĩa là phép đo hỏng').toBeGreaterThan(0);
  });

  test('ĐỐI CHỨNG: thả hai file dump ở root ⇒ exit 1, gọi tên từng file và nói nó là loại gì', () => {
    const a = path.join(REPO, 'scratch_doi_chung_tam.json');
    const b = path.join(REPO, 'doi_chung_tam_output.txt');
    try {
      fs.writeFileSync(a, '{}', 'utf8');
      fs.writeFileSync(b, 'x', 'utf8');
      const r = chay(['--enforce']);
      expect(r.status).toBe(1);
      const ra = `${r.stdout}${r.stderr}`;
      expect(ra).toContain('scratch_doi_chung_tam.json');
      expect(ra).toContain('doi_chung_tam_output.txt');
      expect(ra, 'phải nói vì sao nó nguy hiểm, không chỉ nói "có rác"').toContain('PII');
    } finally {
      fs.rmSync(a, { force: true });
      fs.rmSync(b, { force: true });
    }
    expect(chay().status, 'dọn xong phải xanh lại').toBe(0);
  });

  test('KHÔNG báo oan file hợp lệ: config, package.json, .gitignore', () => {
    /*
     * Ca báo oan quan trọng nhất: `playwright.config.ts` khớp không pattern nào, nhưng một bản mở rộng
     * pattern sau này (`*.ts` tạm chẳng hạn) sẽ ăn nó. Luật có hẳn bảng "Không xóa" cho chuyện này, nên
     * test khoá cả bảng đó.
     */
    const an = ['package.json', '.gitignore', 'playwright.config.ts', 'tsconfig.json'];
    for (const f of an) {
      if (!fs.existsSync(path.join(REPO, f))) continue;
      const khop = cc.PATTERN.filter((p: { re: RegExp }) => p.re.test(f));
      const duocThaRa = f === 'package.json' || f === '.gitignore' || /\.config\.(ts|js|mjs|cjs)$/.test(f);
      if (khop.length) expect(duocThaRa, `${f} khớp pattern mà không nằm trong bảng "Không xóa"`).toBe(true);
    }
    const r = chay();
    expect(`${r.stdout}${r.stderr}`).not.toContain('package.json');
  });

  test('thư mục deliverable KHÔNG bị quét — `outputs/` là artifact của task', () => {
    /*
     * Một `scratch_*` trong `outputs/<DA>/tasks/<TASK>/` là artifact của task đó. Quét vào đấy thì máy
     * đòi xoá deliverable, và lúc đó nó bị tắt đi — rồi lỗ ở root mở lại.
     */
    for (const d of ['outputs', 'node_modules', '.git', 'knowledge', 'profiles', 'logs', 'artifacts']) {
      expect(cc.BO_QUA_DIR.has(d), `thiếu ${d} trong danh sách bỏ qua`).toBe(true);
    }
  });

  test('bảng pattern KHỚP bảng trong RULE_GLOBAL — không để nó trôi', () => {
    /*
     * Máy chép bảng pattern từ luật thay vì đọc Markdown trực tiếp, vì một bộ quét phụ thuộc vào cách
     * người ta kẻ bảng sẽ chết lặng lẽ lúc ai đó đổi dấu gạch. Đổi lại thì bản chép có thể trôi, nên
     * test này so hai bên bằng cách lấy các mẫu trong cột đầu của bảng luật.
     */
    const rule = fs.readFileSync(path.join(REPO, 'RULE_GLOBAL.md'), 'utf8');
    const muc = rule.slice(rule.indexOf('## Cleanup Rules'));
    /*
     * CHỈ lấy bảng ĐẦU (bảng pattern rác), KHÔNG lấy bảng "Không xóa" ở dưới. Lượt đầu tôi trích cả hai
     * và test đỏ ở `*.config.ts` — mẫu đó nằm trong bảng "Không xóa", nên máy KHÔNG nhận ra nó mới là
     * đúng. Một test gom hai bảng ngược nghĩa nhau sẽ đòi máy làm điều luật cấm.
     */
    const than = muc.slice(0, muc.indexOf('Không xóa:'));
    const mau = [...than.matchAll(/`([^`]*(?:\*|_debug|dump|snapshot|scratch)[^`]*)`/g)].map((m) => m[1]);
    expect(mau.length, 'không trích được mẫu nào từ bảng luật — test này mất neo, phải sửa lại').toBeGreaterThan(5);

    /* Mỗi mẫu trong luật phải có một pattern của máy nhận ra một tên file ĐẠI DIỆN cho nó. */
    const daiDien = (m: string) => m.replace(/^\*/, 'x').replace(/\*$/, 'x').replace(/\(.*\)/, '');
    const sot: string[] = [];
    for (const m of mau) {
      const ten = daiDien(m).trim();
      if (!ten || ten.includes('/') || ten.includes(' ')) continue;
      if (!cc.PATTERN.some((p: { re: RegExp }) => p.re.test(ten))) sot.push(m);
    }
    expect(sot, 'mẫu có trong luật mà máy không nhận ra').toEqual([]);
  });
});
