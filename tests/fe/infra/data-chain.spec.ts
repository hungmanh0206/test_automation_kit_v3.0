/*
 * @infra `data:chain:check` — chuỗi dữ liệu giữa các case phải đứng được (v2.9.5 §6).
 *
 * Phần lớn case tự dựng tiền đề. Nhưng đo 29/10/2026 trên bộ case thật: **9 ca** khai thẳng rằng tiền
 * đề của chúng là OUTPUT của case khác (`[pre_existing] … (dựng ở TC_084)`). Lúc đó bộ case không còn
 * là một tập hợp mà là một CHUỖI — và chuỗi có ba đường hỏng không máy nào trong kit nhìn thấy.
 *
 * Lượt chạy ĐẦU TIÊN trên bộ TASK-9004 bắt được một lỗi thật: `APP_NHANSU_TC_063` khai
 * `(dựng ở TC_075)` nhưng TC_075 nằm SAU nó trong file (dòng 80 so với dòng 92). Đã soi tay xác nhận.
 *
 * RANH GIỚI NẰM Ở ĐỘNG TỪ, không ở việc có tên TC. Bộ case thật còn 16 lượt trỏ TC khác nữa —
 * "đã kiểm ở TC_045", "SQL ở TC_088" — và đó là TRÍCH DẪN ĐỂ ĐỌC. Gác cả 25 lượt là gác phần lớn
 * dương tính giả, nên các phép kiểm dưới đây khoá cả hai chiều.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const GATE = path.join(REPO, 'scripts/qa/data_chain_check.js');

const HEAD = [
  '| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |',
  `|${'---|'.repeat(10)}`,
].join('\n');

const dong = (id: string, td: string) =>
  `| ${id} | Functional | [Positive] | M | ${id} | ${td} | x | 1. Mở màn | 1. Màn mở | Cao |`;

/** Dựng bộ case tạm từ danh sách [tcId, tiền điều kiện] theo ĐÚNG thứ tự truyền vào. */
function boCase(rows: [string, string][]) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'dchain-'));
  fs.writeFileSync(path.join(d, 'bo.md'),
    ['# bộ', '', HEAD, ...rows.map(([id, td]) => dong(id, td)), ''].join('\n'), 'utf8');
  return d;
}

function status(d: string, ds: [string, string][]) {
  const f = path.join(d, 'status.json');
  fs.writeFileSync(f, JSON.stringify({
    taskKey: 'T-1',
    tests: ds.map(([tcId, s]) => ({ tcId, status: s })),
  }, null, 2), 'utf8');
  return f;
}

const chay = (argv: string[]) => {
  const r = spawnSync(process.execPath, [GATE, ...argv], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};

test.describe('@infra data:chain:check', () => {
  test('ĐỐI CHỨNG ÂM: chuỗi ĐÚNG thứ tự ⇒ ĐẠT, và chuỗi được in ra', () => {
    const d = boCase([
      ['M_TC_001', '[api] Đã đăng nhập'],
      ['M_TC_002', '[pre_existing] Đã có hồ sơ "A" (dựng ở M_TC_001)'],
    ]);
    const r = chay(['--dir', d, '--enforce']);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('M_TC_001  →  M_TC_002');
    expect(r.out).toContain('1 mắt chuỗi');
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG ①: tiền đề trỏ TC KHÔNG có trong bộ ⇒ CHẶN', () => {
    const d = boCase([
      ['M_TC_001', '[api] Đã đăng nhập'],
      ['M_TC_002', '[pre_existing] Đã có hồ sơ "A" (dựng ở M_TC_999)'],
    ]);
    const r = chay(['--dir', d, '--enforce']);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('TRỎ VÀO HƯ KHÔNG');
    expect(r.out).toContain('M_TC_999');
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG ②: case phụ thuộc đứng TRƯỚC case nguồn ⇒ CHẶN', () => {
    /* Đây là lỗi thật đã bắt được ở bộ TASK-9004 (TC_063 cần TC_075 nhưng TC_075 nằm sau). */
    const d = boCase([
      ['M_TC_002', '[pre_existing] Đã có hồ sơ "A" (dựng ở M_TC_010)'],
      ['M_TC_010', '[ui] Tạo hồ sơ "A"'],
    ]);
    const r = chay(['--dir', d, '--enforce']);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('NGƯỢC THỨ TỰ');
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: VÒNG trong chuỗi ⇒ CHẶN', () => {
    const d = boCase([
      ['M_TC_001', '[pre_existing] cần dữ liệu dựng ở M_TC_002'],
      ['M_TC_002', '[pre_existing] cần dữ liệu dựng ở M_TC_001'],
    ]);
    const r = chay(['--dir', d, '--enforce']);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/VÒNG trong chuỗi/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG ③: nguồn FAILED mà case phụ thuộc PASSED ⇒ CHẶN', () => {
    /*
     * Phép kiểm ĐẮT NHẤT của cửa này. Tiền đề chưa dựng thì phép đo chạy trên một tình huống KHÔNG
     * TỒN TẠI — lớp hỏng đó đã sinh ra 2 product_bug bịa trong một phiên.
     */
    const d = boCase([
      ['M_TC_001', '[ui] Tạo hồ sơ "A"'],
      ['M_TC_002', '[pre_existing] Đã có hồ sơ "A" (dựng ở M_TC_001)'],
    ]);
    const s = status(d, [['M_TC_001', 'FAILED'], ['M_TC_002', 'PASSED']]);
    const r = chay(['--dir', d, '--status', s, '--enforce']);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('KHÔNG ĐƯỢC PHÉP ĐỨNG');
    expect(r.out).toContain('M_TC_002 = PASSED');
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG ÂM ③: nguồn PASSED thì case phụ thuộc PASSED là hợp lệ', () => {
    const d = boCase([
      ['M_TC_001', '[ui] Tạo hồ sơ "A"'],
      ['M_TC_002', '[pre_existing] Đã có hồ sơ "A" (dựng ở M_TC_001)'],
    ]);
    const s = status(d, [['M_TC_001', 'PASSED'], ['M_TC_002', 'PASSED']]);
    expect(chay(['--dir', d, '--status', s, '--enforce']).code).toBe(0);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('TRÍCH DẪN ĐỂ ĐỌC KHÔNG phải phụ thuộc — ranh giới nằm ở ĐỘNG TỪ', () => {
    /*
     * Nếu không khoá chiều này thì cửa gác luôn 16 lượt trích dẫn trong bộ case thật, và phần lớn
     * finding sẽ là dương tính giả — rồi người ta tắt cửa chứ không sửa theo nó.
     */
    const d = boCase([
      ['M_TC_002', '[api] Đã đăng nhập; ô này đã kiểm ở M_TC_999 nên không đo lại'],
    ]);
    const r = chay(['--dir', d, '--enforce']);
    expect(r.code, r.out).toBe(0);
    expect(r.out, 'trích dẫn để đọc KHÔNG được tính là mắt chuỗi').toContain('0 mắt chuỗi');
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('mã viết TẮT trong ô vẫn khớp được mã đầy đủ của bộ', () => {
    /* Ô tiền điều kiện hay viết `TC_084` cho `APP_NHANSU_TC_084` — không khớp thì ① báo oan. */
    const d = boCase([
      ['APP_NHANSU_TC_001', '[ui] Tạo hồ sơ'],
      ['APP_NHANSU_TC_002', '[pre_existing] Đã có hồ sơ (dựng ở TC_001)'],
    ]);
    const r = chay(['--dir', d, '--enforce']);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('APP_NHANSU_TC_001  →  APP_NHANSU_TC_002');
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('"không phán được" KHÔNG thành "đạt": 0 testcase ⇒ exit 2', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'dchain0-'));
    const r = chay(['--dir', d]);
    expect(r.code, r.out).toBe(2);
    expect(r.out).toContain('KHÔNG PHÁN ĐƯỢC');
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('thiếu `--status` ⇒ NÓI RÕ phép kiểm ③ chưa chạy, không im lặng bỏ qua', () => {
    const d = boCase([
      ['M_TC_001', '[ui] Tạo hồ sơ "A"'],
      ['M_TC_002', '[pre_existing] Đã có hồ sơ "A" (dựng ở M_TC_001)'],
    ]);
    const r = chay(['--dir', d]);
    expect(r.out, 'không có status thì phải kêu, vì đó là phép kiểm đắt nhất').toMatch(/CHƯA chạy/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('gate TỰ NÓI giới hạn: chỉ thấy chuỗi đã KHAI', () => {
    const src = fs.readFileSync(GATE, 'utf8');
    expect(src).toMatch(/KHÔNG khai ra thì máy không thấy/);
    expect(src, 'phải trỏ chỗ chấm tay').toMatch(/automation_reviewer/);
  });

  test('bộ case THẬT của TASK-9004 vẫn còn lỗi thứ tự đã tìm ra — hoặc đã sửa', () => {
    /*
     * Phép kiểm này neo vào MỘT phát hiện cụ thể. Nó xanh ở cả hai trạng thái, nhưng in ra cái nào
     * đang đúng — nếu bộ case bị xoá thì nó nói thẳng là không phán được, chứ không im lặng.
     */
    const dir = path.join(REPO, 'outputs/DEMO/tasks/TASK-9004/test-cases');
    if (!fs.existsSync(dir)) { test.skip(true, 'bộ case TASK-9004 không có trong cây này'); return; }
    const r = chay(['--dir', dir]);
    expect(r.code, r.out).toBe(0);
    expect(r.out, 'phải đọc được bộ case và in số mắt chuỗi').toMatch(/mắt chuỗi đã KHAI/);
  });
});
