/**
 * `exec:proof` — artifact có ĐỦ để chứng minh một case PASSED đã chạy hết bước không?
 *
 * BỐI CẢNH. Chủ dự án nêu điều thứ hai: *"chưa chứng minh Agent thực thi đúng toàn bộ steps"*. Chữ
 * quan trọng là **CHƯA CHỨNG MINH**, không phải **SAI**.
 *
 * ĐO TRÊN TASK THẬT CSDL-4008: 282 case so được · 177 ghi đủ · **61 case PASSED ghi ít bước hơn số
 * bước case khai**, có cái chỉ 2/6.
 *
 * VÀ ĐÂY LÀ PHẦN QUAN TRỌNG NHẤT CỦA CẢ FILE NÀY. Con số đó **KHÔNG** được đọc là "chạy thiếu bước".
 * Đọc `evidence_recorder.step()`: nó LUÔN chụp ảnh và LUÔN đẩy một bản ghi, nên số bước trong manifest
 * là **số lần spec gọi `step()`** — một spec hoàn toàn có thể làm bước 1–3 của case trong MỘT lần ghi.
 * Phép đo này **không phân biệt được** "chạy thiếu" với "ghi gộp".
 *
 * Điều nó nói được, và nó đủ: với những case đó, **artifact không cho phép ai kiểm lại từng bước**.
 * Đó chính là "chưa chứng minh" — một lỗ hổng TRUY VẾT, không phải một kết luận về LỖI.
 *
 * Phần lớn ca dưới đây gác đúng ranh giới ấy: cắt dòng giới hạn đi là biến một lỗ hổng truy vết thành
 * một lời buộc tội thực thi.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const CUA = path.join(REPO, 'scripts', 'qa', 'exec_proof.js');

type Ca = { id: string; buoc: number };

/** Cây task tạm: bộ .md canonical + evidence-manifest.json. */
function cay(cases: Ca[], ghi: Record<string, { n: number; status: string }>): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'execproof-'));
  const T = path.join(d, 'tasks', 'T1');
  fs.mkdirSync(path.join(T, 'test-cases'), { recursive: true });
  fs.mkdirSync(path.join(T, 'test-results'), { recursive: true });

  const head = '| TC ID | Loại case | Module | Các bước thực hiện | Kết quả mong đợi |';
  const sep = '|---|---|---|---|---|';
  const rows = cases.map((c) => {
    const b = Array.from({ length: c.buoc }, (_, i) => `${i + 1}. bước ${i + 1}`).join('<br>');
    return `| ${c.id} | UI | M | ${b} | ok |`;
  });
  fs.writeFileSync(path.join(T, 'test-cases', 'bo.md'), [head, sep, ...rows].join('\n'), 'utf8');

  const entries = Object.entries(ghi).map(([tcId, v]) => ({
    tcId,
    status: v.status,
    caseEvidence: [],
    steps: Array.from({ length: v.n }, (_, i) => ({ n: i + 1, status: 'PASSED', evidence: [] })),
  }));
  fs.writeFileSync(path.join(T, 'test-results', 'evidence-manifest.json'),
    JSON.stringify({ generatedAt: '', count: entries.length, missing: [], entries }, null, 2), 'utf8');
  return d;
}

const chay = (goc: string, task = 'T1') => {
  const r = spawnSync(process.execPath, [CUA, '--task', task, '--goc', goc],
    { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};

test.describe('@infra exec:proof — đo được "CHƯA CHỨNG MINH", không phán "đã sai"', () => {
  test('PASSED mà ghi ít bước hơn khai ⇒ nêu đích danh, kèm tỉ lệ', () => {
    const d = cay([{ id: 'X_TC_001', buoc: 6 }], { X_TC_001: { n: 2, status: 'PASSED' } });
    const r = chay(d);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('X_TC_001');
    expect(r.out, 'phải nêu tỉ lệ để người đọc biết thiếu bao nhiêu').toMatch(/khai {2}6 → ghi {2}2 {2}\(33%\)/);
  });

  test('ĐỐI CHỨNG: ghi ĐỦ số bước ⇒ KHÔNG nằm trong danh sách', () => {
    /* Khác ca trên đúng một thứ: số bước đã ghi. Cả hai cùng ra danh sách thì máy không đo gì. */
    const d = cay([{ id: 'X_TC_001', buoc: 6 }], { X_TC_001: { n: 6, status: 'PASSED' } });
    const r = chay(d);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/>>> 0 case PASSED/);
    expect(r.out).toMatch(/ghi ĐỦ số bước khai: 1\/1/);
  });

  test('BLOCKED_SETUP ghi ít bước KHÔNG bị tính vào danh sách PASSED — chúng dừng sớm có chủ ý', () => {
    const d = cay([{ id: 'X_TC_001', buoc: 9 }], { X_TC_001: { n: 3, status: 'BLOCKED_SETUP' } });
    const r = chay(d);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/>>> 0 case PASSED/);
    expect(r.out, 'nhưng vẫn phải ĐẾM chúng ra, không giấu').toMatch(/1 {2}BLOCKED_SETUP/);
  });

  test('LUÔN in giới hạn: đây KHÔNG phải "chạy thiếu bước"', () => {
    /*
     * Dòng này là ranh giới giữa một LỖ HỔNG TRUY VẾT và một LỜI BUỘC TỘI THỰC THI. `recorder.step()`
     * luôn ghi một bản ghi, nên con số đếm là SỐ LẦN GỌI `step()`; một spec gộp 3 bước vào 1 lần ghi
     * là hợp lệ. Mất dòng này thì con số bị đọc sai theo chiều nặng nhất.
     */
    const d = cay([{ id: 'X_TC_001', buoc: 6 }], { X_TC_001: { n: 2, status: 'PASSED' } });
    const r = chay(d);
    expect(r.out).toMatch(/KHÔNG phải "chạy thiếu bước"/);
    expect(r.out).toMatch(/KHÔNG phân biệt được "chạy thiếu" với "ghi gộp"/);
    expect(r.out).toMatch(/CHƯA CHỨNG MINH/);
  });
});

test.describe('@infra exec:proof — "không đọc được" KHÔNG thành "đạt"', () => {
  test('không có bộ case .md ⇒ KHÔNG PHÁN ĐƯỢC, exit 2', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'execproof-rong-'));
    fs.mkdirSync(path.join(d, 'tasks', 'T1', 'test-results'), { recursive: true });
    const r = chay(d);
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/KHÔNG PHÁN ĐƯỢC/);
    expect(r.out).toMatch(/KHÔNG phải là đạt/);
  });

  test('có bộ case nhưng CHƯA CHẠY (không manifest) ⇒ KHÔNG PHÁN ĐƯỢC, nói rõ vì sao', () => {
    const d = cay([{ id: 'X_TC_001', buoc: 3 }], {});
    fs.rmSync(path.join(d, 'tasks', 'T1', 'test-results', 'evidence-manifest.json'));
    const r = chay(d);
    expect(r.code).toBe(2);
    expect(r.out, 'phải phân biệt "chưa chạy" với "chạy mà thiếu"').toMatch(/Task chưa chạy/);
  });

  test('manifest RỖNG ⇒ KHÔNG PHÁN ĐƯỢC, không báo "0 case có vấn đề"', () => {
    const d = cay([{ id: 'X_TC_001', buoc: 3 }], {});
    const r = chay(d);
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/KHÔNG PHÁN ĐƯỢC/);
    expect(r.out, 'manifest rỗng mà báo 0 vấn đề là biến chỗ TRỐNG thành kết luận TỐT')
      .not.toMatch(/>>> 0 case PASSED/);
  });
});
