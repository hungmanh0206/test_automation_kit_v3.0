/*
 * @infra `router:check` — bảng định tuyến phải PHỦ mọi điểm vào, và mỗi dòng phải nói RANH GIỚI (v2.9.5 §4).
 *
 * Đo 29/10/2026: kit có 13 lệnh `/`, 16 workflow, 3 subagent, và ba chỗ đã liệt kê chúng
 * (`docs/CHEATSHEET.md`, `docs/kit-map.md`, `.agent/skills/INDEX.md`) — nhưng KHÔNG chỗ nào ghi
 * "KHÔNG dùng khi". Danh sách không ranh giới trả lời được "kit có lệnh gì", không trả lời được
 * "lệnh nào SAI cho việc này".
 *
 * Phép kiểm nặng nhất ở file này là ca `rerun`: nó tồn tại VỪA là lệnh `/rerun` VỪA là workflow
 * `rerun.md`. Bản đầu của gate khoá bảng bằng TÊN TRẦN, nên một dòng che được hai điểm vào — 31 dòng
 * phủ 32 điểm vào mà cửa vẫn xanh. Đó là kiểu hỏng riêng của cửa-phủ: nó đếm KHỚP, không đếm PHỦ.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const GATE = path.join(REPO, 'scripts/qa/router_check.js');
const BANG = path.join(REPO, '.agent/skills/phase2/qa_automation_engineer/references/router.md');

const chay = (argv: string[] = []) => {
  const r = spawnSync(process.execPath, [GATE, ...argv], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};

/** Ghi một bản bảng đã sửa ra file tạm — KHÔNG sửa bảng thật (spec khác đọc cùng file, chạy song song). */
function bangTam(bien: (s: string) => string) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'router-'));
  const f = path.join(d, 'router.md');
  fs.writeFileSync(f, bien(fs.readFileSync(BANG, 'utf8')), 'utf8');
  return { d, f };
}

test.describe('@infra router:check', () => {
  test('bảng thật phủ ĐỦ 32 điểm vào, và mỗi dòng có ranh giới', () => {
    const r = chay();
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/lệnh `\/`: 13/);
    expect(r.out).toMatch(/workflow: 16/);
    expect(r.out).toMatch(/subagent: 3/);
    /* 32 dòng cho 32 điểm vào. Con số này là chỗ đã lộ ra lỗi khoá-theo-tên-trần. */
    expect(r.out).toMatch(/32 dòng · 32 điểm vào/);
  });

  test('ĐỐI CHỨNG DƯƠNG: bỏ một dòng ⇒ CHẶN, và nói đúng tên điểm vào', () => {
    const t = bangTam((s) => s.split(/\r?\n/).filter((l) => !l.startsWith('| `/ui-debug`')).join('\n'));
    const r = chay(['--bang', t.f]);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('ui-debug');
    expect(r.out).toContain('KHÔNG có dòng');
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG — ca `rerun`: xoá dòng workflow mà dòng lệnh còn ⇒ vẫn phải CHẶN', () => {
    /*
     * ĐÂY là phép kiểm đáng giá nhất của file. `/rerun` và `rerun.md` cùng tên, khác loại. Nếu gate
     * khoá bằng tên trần thì xoá dòng workflow vẫn xanh, vì dòng lệnh "đã khớp".
     *
     * Xoá dòng NẰM TRONG vùng `<!-- router:workflow -->`, giữ nguyên dòng ở vùng command.
     */
    const t = bangTam((s) => {
      const L = s.split(/\r?\n/);
      const batDau = L.findIndex((l) => l.includes('<!-- router:workflow -->'));
      expect(batDau, 'thiếu mốc router:workflow — bảng đã đổi hình, sửa spec chứ đừng bỏ phép kiểm')
        .toBeGreaterThan(0);
      const i = L.findIndex((l, k) => k > batDau && l.startsWith('| `rerun` |'));
      expect(i, 'không tìm thấy dòng workflow `rerun`').toBeGreaterThan(batDau);
      L.splice(i, 1);
      return L.join('\n');
    });
    const r = chay(['--bang', t.f]);
    expect(r.code, r.out).toBe(1);
    expect(r.out, 'phải nói rõ là WORKFLOW rerun thiếu dòng, không im vì lệnh cùng tên đã có')
      .toMatch(/workflow `rerun`/);
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: ô "KHÔNG dùng khi" điền dấu cho đủ ⇒ CHẶN', () => {
    /* Không có phép kiểm này thì cửa dạy người ta gõ `-` vào ô cuối, và bảng tụt về bản liệt kê. */
    const t = bangTam((s) => s.replace(/^(\| `\/explore` \|[^|]*\|)[^|]*\|/m, '$1 - |'));
    const r = chay(['--bang', t.f]);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('quá ngắn');
    expect(r.out).toContain('explore');
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG ÂM: ô ranh giới NGẮN NHẤT của bảng thật vẫn phải qua', () => {
    /*
     * Sàn đặt quá cao thì cửa đòi người ta viết dài cho đủ chữ, và đó là một kiểu hỏng khác. Đo lại ô
     * ngắn nhất đang có để biết sàn còn cách thực tế bao xa.
     */
    const s = fs.readFileSync(BANG, 'utf8');
    const o = s.split(/\r?\n/)
      .filter((l) => /^\| `\/?[a-z0-9_-]+` \|/.test(l))
      .map((l) => {
        const c = l.split('|').slice(1, -1).map((x) => x.trim());
        return c[c.length - 1].replace(/[`*\s-]/g, '').length;
      });
    expect(o.length, 'không đọc được dòng nào — sửa regex chứ đừng bỏ phép kiểm').toBeGreaterThanOrEqual(30);
    expect(Math.min(...o), 'ô ranh giới ngắn nhất phải còn trên sàn 25').toBeGreaterThan(25);
  });

  test('dòng MỒ CÔI chỉ CẢNH BÁO, không chặn', () => {
    /* Xoá một lệnh rồi quên xoá dòng là chuyện nhỏ hơn hẳn so với thêm lệnh mà quên thêm dòng. */
    const t = bangTam((s) => s.replace('<!-- router:agent -->', '<!-- router:agent -->\n\n| `khong-ton-tai` | x | một ô ranh giới đủ dài để qua sàn hai mươi lăm ký tự |'));
    const r = chay(['--bang', t.f]);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('MỒ CÔI');
    expect(r.out).toContain('khong-ton-tai');
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('"không phán được" KHÔNG thành "đạt": thiếu bảng ⇒ exit 2', () => {
    const r = chay(['--bang', path.join(os.tmpdir(), 'khong-he-ton-tai-router.md')]);
    expect(r.code, r.out).toBe(2);
    expect(r.out).toContain('KHÔNG PHÁN ĐƯỢC');
  });

  test('0 điểm vào trên đĩa ⇒ exit 2, không phải exit 0', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'router0-'));
    const r = chay(['--repo', d, '--bang', BANG]);
    expect(r.code, r.out).toBe(2);
    expect(r.out).toMatch(/KHÔNG đồng nghĩa với "đạt"/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('gate TỰ NÓI giới hạn: đọc TÊN và ĐỘ DÀI, không hiểu nghĩa', () => {
    const src = fs.readFileSync(GATE, 'utf8');
    expect(src).toMatch(/không hiểu nghĩa/);
    expect(src, 'phải nói rõ ranh giới ĐÚNG hay không thì review tay').toMatch(/review tay/);
  });

  test('bảng chỉ nhắc npm script CÓ THẬT', () => {
    /* eslint-disable @typescript-eslint/no-var-requires, global-require */
    const pkg = require(path.join(REPO, 'package.json'));
    /* eslint-enable @typescript-eslint/no-var-requires, global-require */
    const s = fs.readFileSync(BANG, 'utf8');
    const goi = [...s.matchAll(/`npm run ([a-z0-9:_-]+)/g)].map((m) => m[1]);
    expect(goi.length, 'bảng phải trỏ tới máy thật, không dạy chay').toBeGreaterThan(2);
    const thieu = [...new Set(goi)].filter((g) => !pkg.scripts[g]);
    expect(thieu, `bảng nhắc npm script KHÔNG tồn tại: ${thieu.join(', ')}`).toEqual([]);
  });
});
