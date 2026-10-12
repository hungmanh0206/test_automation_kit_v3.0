/*
 * §L — SMOKE HỆ THỐNG: sinh và ba lớp chặn. OFFLINE, không chạm UAT.
 *
 * Smoke ở đây trả lời MỘT câu hỏi hẹp: "thư viện còn nói đúng về app không?" — màn còn mở được, và mọi
 * neo control của L1 còn tìm thấy. Nó KHÔNG phán nghiệp vụ: một smoke phán nghiệp vụ sẽ đỏ vì dữ liệu
 * UAT đổi, và người ta sẽ tắt nó.
 *
 * ĐÃ CHẠY THẬT, không chỉ sinh ra: smoke sinh từ `ui_catalog_fixture.json` chạy lên app fixture và xanh
 * 1/1 (lớp nông, 1.7 giây) và 2/2 (lớp sâu, 28 giây). Lớp sâu phân loại đúng cả BA trạng thái của
 * `ghiDuoc`: `ghi-duoc` · `khong-tuong-tac-duoc` (readonly + disabled) · `tuong-tac-duoc-nhung-khong-
 * doi-duoc` (ô tự hoàn nguyên). Spec này gác phần SINH; phần CHẠY được ghi lại ở commit.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..', '..');
/* eslint-disable @typescript-eslint/no-var-requires, global-require */
const sg = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'smoke_gen.js'));
const sr = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'smoke_run.js'));
const pwc = require(path.join(REPO, 'scripts', 'qa', 'lib', 'pw_task_config.js'));
/* eslint-enable @typescript-eslint/no-var-requires, global-require */

const CAT_FX = path.join(REPO, 'tests', 'fe', 'fixtures', 'steps', 'ui_catalog_fixture.json');
const tmp = (t: string) => fs.mkdtempSync(path.join(REPO, 'outputs', '_scratch', `${t}-`));

const sinhVao = (deep = false) => {
  const out = tmp(deep ? 'sm-deep' : 'sm');
  const r = sg.sinh({ duongCatalog: CAT_FX, outDir: out, deep });
  const src = r.loi ? '' : fs.readFileSync(path.join(REPO, r.file), 'utf8');
  return { out, r, src, don: () => fs.rmSync(out, { recursive: true, force: true }) };
};

test.describe('§L — chọn màn nào để smoke', () => {
  test('chỉ sinh cho màn CÓ NEO; màn chưa có neo bị bỏ qua và ĐƯỢC NÊU RA', () => {
    /*
     * Màn chưa có neo thì smoke không nói được gì: nó `goto` rồi kết luận "ổn" trong khi chưa kiểm một
     * control nào. Catalog thật của CSDL-9001 có 4/5 màn ở trạng thái đó, nên đây là ca thường gặp.
     */
    const { r, don } = sinhVao();
    expect(r.so_man_sinh).toBe(1);
    expect(r.so_man_bo_qua).toBe(1);
    expect(r.bo_qua[0].ten).toContain('Mầm non');
    expect(r.bo_qua[0].so_neo).toBe(0);
    don();
  });

  test('KHÔNG màn nào có neo ⇒ TỪ CHỐI sinh, kèm bảng neo của từng màn', () => {
    const out = tmp('sm-rong');
    const f = path.join(out, 'cat.json');
    fs.writeFileSync(f, JSON.stringify({ screens: [{ name: 'M', url: '/x', fields: [{ name: 'I', expectedFields: ['A'] }] }] }), 'utf8');
    const r = sg.sinh({ duongCatalog: f, outDir: out, deep: false });
    fs.rmSync(out, { recursive: true, force: true });
    expect(r.loi).toContain('không màn nào');
    expect(r.man[0].so_neo).toBe(0);
  });

  test('màn có neo mà THIẾU URL cũng bị bỏ qua', () => {
    const out = tmp('sm-nourl');
    const f = path.join(out, 'cat.json');
    fs.writeFileSync(f, JSON.stringify({
      screens: [{ name: 'M', fields: [{ name: 'I', expectedFields: ['A'], controls: { A: { name: 'tbA' } } }] }],
    }), 'utf8');
    const r = sg.sinh({ duongCatalog: f, outDir: out, deep: false });
    fs.rmSync(out, { recursive: true, force: true });
    expect(r.loi).toContain('không màn nào');
  });
});

test.describe('§L — lớp SÂU tắt sẵn', () => {
  test('mặc định KHÔNG sinh lời gọi ghi nào', () => {
    /*
     * Lớp nông chỉ `goto` + đếm + đọc, nên nó không chạm dữ liệu UAT và không cần một lượt xác nhận
     * theo CLAUDE.md §2. Một smoke mặc định chạm dữ liệu sẽ bị tắt hẳn sau lần đầu — và lúc đó không
     * còn smoke nào.
     */
    const { r, src, don } = sinhVao(false);
    expect(r.deep).toBe(false);
    expect(src, 'không được import tầng ghi').not.toContain('_widget/textbox');
    expect(src).not.toContain('ghiDuoc');
    expect(src).toContain('KHÔNG ghi ô nào');
    don();
  });

  test('`--deep` mới sinh phép đo GHI, và đầu file cảnh báo §2', () => {
    const { r, src, don } = sinhVao(true);
    expect(r.deep).toBe(true);
    expect(src).toContain('textbox.ghiDuoc');
    expect(src).toContain('CẦN');
    expect(src).toContain('CLAUDE.md §2');
    don();
  });

  test('lớp sâu BỎ QUA checkbox — không trộn hai đường đo', () => {
    const { src, don } = sinhVao(true);
    expect(src).toContain("n.type === 'checkbox'");
    don();
  });

  test('lớp sâu KHÔNG kỳ vọng ô nào mở hay khoá — đó là nghiệp vụ', () => {
    /* Smoke chỉ đòi phép đo CHẠY ĐƯỢC. Kỳ vọng ô nào khoá là phán nghiệp vụ, và dữ liệu UAT đổi thì đỏ. */
    const { src, don } = sinhVao(true);
    expect(src).toContain('KHÔNG kỳ vọng ô nào mở hay khoá');
    don();
  });
});

test.describe('§L — spec sinh ra chạy được và không ghim môi trường', () => {
  test('KHÔNG ghim host vào file sinh ra', () => {
    /* Ghim host vào spec là ghim một môi trường vào artifact, và nó sẽ bị commit. */
    const { src, don } = sinhVao();
    expect(src).not.toMatch(/https?:\/\/(?!<)/);
    expect(src).toContain('process.env.SMOKE_BASE_URL');
    don();
  });

  test('thiếu gốc URL thì spec TỰ ném ở `beforeAll`, không đoán host', () => {
    const { src, don } = sinhVao();
    expect(src).toContain('KHÔNG đoán host');
    expect(src).toMatch(/test\.beforeAll/);
    don();
  });

  test('sinh NỐT `playwright.task.config.js`, qua MỘT NGUỒN dùng chung với `compile:spec`', () => {
    /*
     * Thiếu nó thì `playwright test <file>` trả "No tests found" vì config gốc khai `testDir` là
     * `./tests`. Đo lại ngay ở lượt sinh đầu tiên của `smoke:gen` — đúng cái `compile:spec` đã gặp
     * ngày 30/09/2026.
     */
    const { out, r, don } = sinhVao();
    const cfg = fs.readFileSync(path.join(REPO, r.config), 'utf8');
    expect(cfg).toContain('testDir: __dirname');
    expect(cfg).toContain('path.resolve(REPO, r[0])');
    expect(fs.existsSync(path.join(out, 'playwright.task.config.js'))).toBe(true);

    /* Và hai bên phải GỌI cùng một nguồn, không giữ bản sao. */
    for (const f of ['scripts/qa/reuse/smoke_gen.js', 'scripts/qa/reuse/compile_spec.js']) {
      const src = fs.readFileSync(path.join(REPO, f), 'utf8');
      expect(src, `${f} phải gọi pw_task_config`).toContain('pw_task_config');
      expect(src, `${f} còn giữ bản sao sinh config`).not.toContain('testDir: __dirname');
    }
    don();
  });

  test('`ghiConfigTask` KHÔNG ghi đè file đã có — người ta có thể đã sửa tay', () => {
    const out = tmp('sm-cfg');
    const f = pwc.ghiConfigTask(out, 'x');
    fs.writeFileSync(f, '/* sửa tay */', 'utf8');
    pwc.ghiConfigTask(out, 'x');
    const sau = fs.readFileSync(f, 'utf8');
    fs.rmSync(out, { recursive: true, force: true });
    expect(sau).toBe('/* sửa tay */');
  });

  test('`ghiConfigTask` NÉM khi thư mục khác ổ đĩa', () => {
    expect(() => pwc.ghiConfigTask('C:\\khong-cung-o-dia', 'x')).toThrow(/cùng ổ đĩa/);
  });
});

test.describe('§L — ba lớp chặn của `smoke:run`', () => {
  const chay = (o: Record<string, unknown>) => sr.kiemTruocKhiChay({ env: {}, ...o });

  test('lớp 1 — không có gốc URL ⇒ DỪNG, không đoán', () => {
    const { out, r, don } = sinhVao();
    const d = chay({ spec: r.file, env: {} });
    don();
    expect(out).toBeTruthy();
    expect(d.chay).toBe(false);
    expect(d.ly_do).toContain('KHÔNG đoán host');
  });

  test('lớp 2 — `--deep` một mình KHÔNG đủ, phải có cờ đồng ý', () => {
    /*
     * CLAUDE.md §2 đòi xác nhận trước mỗi lượt chạm dữ liệu, và một cờ phải gõ tay là cách gần nhất
     * với "xác nhận" mà một script có thể đòi.
     */
    const { r, don } = sinhVao(true);
    const env = { SMOKE_BASE_URL: 'http://vi-du' };
    expect(chay({ spec: r.file, deep: true, env }).chay).toBe(false);
    expect(chay({ spec: r.file, deep: true, env }).ly_do).toContain('xác nhận');
    expect(chay({ spec: r.file, deep: true, dongY: true, env }).chay).toBe(true);
    don();
  });

  test('lớp 3 — `--workers=1` ghim cứng, không thương lượng', () => {
    /*
     * Đo 12/10/2026: chạy cả bộ offline với `workers` mặc định làm hai phép đo HÀNH VI THEO THỜI GIAN
     * của L0.5 ĐỎ và cả lượt mất 2.1 giờ; một worker thì 47/47 trong 2.0 phút. Smoke cũng đo theo thời
     * gian, nên nó chịu đúng lớp bỏ đói đó.
     */
    const { r, don } = sinhVao();
    const d = chay({ spec: r.file, env: { SMOKE_BASE_URL: 'http://vi-du' } });
    don();
    expect(d.chay).toBe(true);
    expect(d.lenh).toContain('--workers=1');
    expect(d.lenh.join(' ')).toContain('playwright.task.config.js');
  });

  test('spec không tồn tại ⇒ nhắc chạy `smoke:gen` trước', () => {
    const d = chay({ spec: 'khong-ton-tai.spec.ts', env: { SMOKE_BASE_URL: 'http://vi-du' } });
    expect(d.chay).toBe(false);
    expect(d.ly_do).toContain('smoke:gen');
  });

  test('`OPS_BASE_URL` dùng được thay cho `SMOKE_BASE_URL`, và đuôi `/` bị cắt', () => {
    expect(sr.gocUrl({ OPS_BASE_URL: 'http://vi-du//' })).toBe('http://vi-du');
    expect(sr.gocUrl({ SMOKE_BASE_URL: 'http://a', OPS_BASE_URL: 'http://b' }), 'SMOKE_BASE_URL thắng').toBe('http://a');
    expect(sr.gocUrl({})).toBe('');
  });
});
