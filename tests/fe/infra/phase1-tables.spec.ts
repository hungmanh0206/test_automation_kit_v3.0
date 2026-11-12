/*
 * @infra `phase1:tables` — ba bảng đối soát cuối bộ, MÁY SINH chứ không để agent tự kẻ (v2.9.5 §3.2).
 *
 * Bảng tự kẻ có hai đường hỏng, cả hai đều im lặng: agent kẻ sai số, hoặc agent kẻ đúng rồi bộ TC đổi
 * mà bảng ở lại. Bảng sinh từ chính bộ TC thì không có đường nào trong hai đường đó — và `--check` bắt
 * được cả hai.
 *
 * ĐO TRƯỚC KHI DỰNG, và một bảng ĐÃ CÓ nên không dựng lại: bảng ③ phân bố kỹ thuật đã đủ ở
 * `dimension_coverage.js`. Script gọi lại nó. Hai bộ đếm cho cùng một thứ là hai bộ sẽ trôi khỏi nhau.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const PT = path.join(REPO, 'scripts/qa/phase1_tables.js');
const TECH = path.join(REPO, '.agent/skills/phase1/tc_design_guide/references/techniques.md');

/** Dựng task giả từ N dòng TC. Dùng chính ba ví dụ của `tc_design_guide` khi không truyền gì. */
function dungTask(rows?: string[]) {
  const L = fs.readFileSync(TECH, 'utf8').split(/\r?\n/);
  const head = L.find((l) => l.startsWith('| TC ID |'))!;
  const body = rows ?? L.filter((l) => /^\|\s*(HSTRUONG|BCDN|NHANSU)_TC_/.test(l));
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'p1t-'));
  const tc = path.join(d, 'tasks', 'VD-001', 'test-cases');
  fs.mkdirSync(tc, { recursive: true });
  fs.writeFileSync(path.join(tc, 'vd.md'), ['# Ví dụ', '', head, `|${'---|'.repeat(10)}`, ...body, ''].join('\n'), 'utf8');
  return { d, head, body };
}

const chay = (d: string, argv: string[] = []) => {
  const r = spawnSync(process.execPath, [PT, ...argv], {
    cwd: REPO,
    encoding: 'utf8',
    env: { ...gateEnv(), TASK_KEY: 'VD-001', PROJECT_OUTPUT_DIR: d },
  });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};
const doc = (d: string) => fs.readFileSync(path.join(d, 'tasks', 'VD-001', 'reports', 'phase1-summary.md'), 'utf8');

test.describe('@infra phase1:tables — sinh đủ ba bảng từ bộ TC thật', () => {
  test('sinh được, và ba ví dụ của kit qua `--enforce`', () => {
    const t = dungTask();
    expect(chay(t.d).code, 'lượt sinh phải chạy được').toBe(0);
    const md = doc(t.d);
    for (const tieu of ['① Đối soát coverage', '② Đối soát quan sát', '③ Phân bố kỹ thuật']) {
      expect(md, `thiếu bảng ${tieu}`).toContain(tieu);
    }
    expect(chay(t.d, ['--enforce']).code, 'ba ví dụ của kit phải sạch').toBe(0);
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('bảng ③ GỌI LẠI dim:coverage, không đếm lần hai', () => {
    /* Hai bộ đếm cho cùng một thứ thì sớm muộn chúng nói hai con số khác nhau. */
    const src = fs.readFileSync(PT, 'utf8');
    expect(src, 'phải spawn dimension_coverage.js').toContain('dimension_coverage.js');
    const t = dungTask();
    expect(chay(t.d).code, 'phải sinh được trước khi đọc').toBe(0);
    expect(doc(t.d), 'phải nói rõ bảng ③ là của dim:coverage').toContain('đã có sẵn');
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: rule chỉ có case dương ⇒ CHẶN với --enforce', () => {
    const t = dungTask();
    /* Bỏ hai case âm/biên, chỉ để lại một case dương trỏ cùng một rule. */
    const duong = t.body[0].replace('[Boundary]', '[Positive]');
    const t2 = dungTask([duong]);
    const r = chay(t2.d, ['--enforce']);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('chỉ có case dương');
    fs.rmSync(t.d, { recursive: true, force: true });
    fs.rmSync(t2.d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG DƯƠNG: case KHÔNG khai dương/âm/biên ⇒ CHẶN, và nhãn nói đúng', () => {
    /*
     * BA TRẠNG THÁI, không phải hai. Bản đầu của script chỉ có `chiDuong`, còn chú thích trong bảng lại
     * dùng một điều kiện KHÁC — nên một rule 0/0/0 bị dán nhãn "chỉ có case dương", một nhãn SAI. Hai
     * điều kiện cho cùng một kết luận thì sớm muộn chúng nói ngược nhau.
     */
    const t = dungTask();
    const khongTag = t.body[0].replace('[Boundary]', '').replace('[Positive]', '').replace('[Negative]', '');
    const t2 = dungTask([khongTag]);
    const r = chay(t2.d, ['--enforce']);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('không khai dương/âm/biên');
    expect(r.out, 'KHÔNG được dán nhãn sai').not.toContain('chỉ có case dương');
    fs.rmSync(t.d, { recursive: true, force: true });
    fs.rmSync(t2.d, { recursive: true, force: true });
  });

  test('`--check` bắt được khối bị SỬA TAY', () => {
    /* Bảng sinh mà sửa tay là bảng nói dối — và nó nói dối đúng lúc người ta tin nhất. */
    const t = dungTask();
    chay(t.d);
    const f = path.join(t.d, 'tasks', 'VD-001', 'reports', 'phase1-summary.md');
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/\| 1 \|/, '| 99 |'), 'utf8');
    const r = chay(t.d, ['--check']);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/LỆCH|sửa tay/);
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('"không phán được" KHÔNG thành "đạt": 0 testcase ⇒ exit 2', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'p1t0-'));
    fs.mkdirSync(path.join(d, 'tasks', 'VD-001', 'test-cases'), { recursive: true });
    const r = chay(d);
    expect(r.code, r.out).toBe(2);
    expect(r.out).toContain('KHÔNG PHÁN ĐƯỢC');
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('gate TỰ NÓI giới hạn: đọc TAG và CHỮ, không hiểu nghĩa', () => {
    const src = fs.readFileSync(PT, 'utf8');
    expect(src).toMatch(/không hiểu nghĩa/);
    expect(src, 'phải nêu ca case khai sai tag vẫn bị đếm theo tag').toMatch(/vẫn đếm là âm|khai `\[Negative\]`/);
  });
});
