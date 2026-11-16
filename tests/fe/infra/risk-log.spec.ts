/*
 * @infra SỔ RỦI RO DỰ ÁN (`risks`) — ID ổn định không tái sử dụng, và mỗi rủi ro có người chịu,
 * cách giảm thiểu, hạn. OFFLINE: mọi lượt chạy trên thư mục tạm qua `--dir`, không chạm `knowledge/` thật.
 *
 * Khác `risk:score` (register THEO MODULE để chia độ sâu test, sinh lại mỗi lần): sổ này ghi tay, sống qua
 * nhiều task. Phần đáng gác nhất là ID: một Risk ID đã nhắc trong biên bản/Backlog phải chỉ đúng MỘT rủi ro
 * mãi mãi — nên xoá file không được làm số đó được cấp lại, và xoá phải bị phát hiện.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
/* eslint-disable @typescript-eslint/no-var-requires, global-require */
const rl = require(path.join(REPO, 'scripts', 'qa', 'risk_log.js'));
/* eslint-enable @typescript-eslint/no-var-requires, global-require */
const CLI = path.join(REPO, 'scripts', 'qa', 'risk_log.js');

const tam = () => fs.mkdtempSync(path.join(os.tmpdir(), 'risks-'));
const chay = (dir: string, ...a: string[]) => {
  const r = spawnSync(process.execPath, [CLI, '--dir', dir, ...a], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};

/** Điền đủ một rủi ro hợp lệ đè lên khung `--new`. */
function dien(dir: string, id: string, ghiDe: Record<string, unknown> = {}) {
  const p = path.join(dir, `${id}.json`);
  const r = JSON.parse(fs.readFileSync(p, 'utf8'));
  Object.assign(r, {
    description: 'UAT tắt lúc 18h nên lượt chạy hồi quy buổi tối đỏ hàng loạt',
    category: 'moi_truong', likelihood: 4, impact: 4, owner: 'DevOps',
    mitigation: 'Xin giữ UAT tới 22h ngày chạy hồi quy; smoke:gate chặn đầu lượt',
    due_date: '2099-01-01', tasks: ['T1'],
  }, ghiDe);
  delete r._goi_y;
  fs.writeFileSync(p, JSON.stringify(r, null, 2), 'utf8');
}

test.describe('@infra risks — Risk ID ổn định, không tái sử dụng', () => {
  test('`--new` cấp ID tăng dần và ghi sổ cấp phát', () => {
    const d = tam();
    expect(rl.capMoi(d, 'A').id).toBe('RISK-001');
    expect(rl.capMoi(d, 'B').id).toBe('RISK-002');
    const so = JSON.parse(fs.readFileSync(path.join(d, rl.SO_CAP_PHAT), 'utf8'));
    expect(so.so_cuoi).toBe(2);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('XOÁ file rồi cấp mới ⇒ KHÔNG ra lại số cũ, và số đã xoá bị nêu tên', () => {
    const d = tam();
    rl.capMoi(d, 'A'); rl.capMoi(d, 'B'); rl.capMoi(d, 'C');
    fs.rmSync(path.join(d, 'RISK-003.json'));
    expect(rl.capMoi(d, 'D').id, 'số cao nhất bị xoá cũng không được cấp lại').toBe('RISK-004');
    const k = rl.kiemSo(d);
    expect(k.loi.join('\n')).toMatch(/RISK-003 đã cấp nhưng KHÔNG còn file/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ID gõ tay vượt sổ cấp phát ⇒ CHẶN', () => {
    const d = tam();
    rl.capMoi(d, 'A');
    dien(d, 'RISK-001');
    const r = JSON.parse(fs.readFileSync(path.join(d, 'RISK-001.json'), 'utf8'));
    fs.writeFileSync(path.join(d, 'RISK-009.json'), JSON.stringify({ ...r, id: 'RISK-009' }), 'utf8');
    expect(rl.kiemSo(d).loi.join('\n')).toMatch(/ID được gõ tay, không qua `risks:new`/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('mất sổ cấp phát ⇒ cảnh báo, và `--new` dựng lại từ số lớn nhất hiện có (không cấp trùng)', () => {
    const d = tam();
    rl.capMoi(d, 'A'); rl.capMoi(d, 'B');
    dien(d, 'RISK-001'); dien(d, 'RISK-002');
    fs.rmSync(path.join(d, rl.SO_CAP_PHAT));
    expect(rl.kiemSo(d).canhBao.join('\n')).toMatch(/thiếu _so_cap_phat\.json/);
    expect(rl.capMoi(d, 'C').id).toBe('RISK-003');
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('sổ cấp phát là `.json` — `knowledge:backup` chỉ chép `.json`, ngoài backup thì khôi phục xong mất dấu', () => {
    expect(rl.SO_CAP_PHAT.endsWith('.json')).toBe(true);
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/knowledge_backup.js'), 'utf8');
    expect(src, 'kho risks phải nằm trong danh sách sao lưu').toMatch(/STORES = \[[^\]]*'risks'/);
  });
});

test.describe('@infra risks — mỗi rủi ro có người chịu, giảm thiểu, hạn', () => {
  test('khung `--new` chưa điền ⇒ CHẶN ở `--enforce`', () => {
    const d = tam();
    rl.capMoi(d, 'A');
    const r = chay(d, '--enforce');
    expect(r.code, r.out).toBe(1);
    expect(r.out).toMatch(/còn ô `<ĐIỀN>` chưa điền/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('điền đủ ⇒ hợp lệ, exit 0', () => {
    const d = tam();
    rl.capMoi(d, 'A'); dien(d, 'RISK-001');
    const r = chay(d, '--enforce');
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/sổ hợp lệ/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  for (const [ten, ghiDe, vi] of [
    ['thiếu owner', { owner: '' }, /thiếu `owner`/],
    ['giảm thiểu cho có', { mitigation: 'theo dõi' }, /`mitigation` phải ≥ 20/],
    ['không có hạn', { due_date: '' }, /`due_date`.*bắt buộc/],
    ['likelihood ngoài thang', { likelihood: 7 }, /`likelihood` phải là số nguyên 1–5/],
    ['đóng mà không lý do', { status: 'closed', closed_at: '2026-11-16' }, /cần `close_reason`/],
    ['chấp nhận mà không nói ai', { status: 'accepted' }, /cần `accepted_by`/],
    ['có email', { description: 'liên hệ khach.hang@vi-du.vn để lấy dữ liệu' }, /PII/],
  ] as const) {
    test(`${ten} ⇒ CHẶN`, () => {
      const d = tam();
      rl.capMoi(d, 'A'); dien(d, 'RISK-001', ghiDe as Record<string, unknown>);
      const r = chay(d, '--enforce');
      expect(r.code, r.out).toBe(1);
      expect(r.out).toMatch(vi);
      fs.rmSync(d, { recursive: true, force: true });
    });
  }
});

test.describe('@infra risks — đọc sổ', () => {
  test('điểm và band tính từ CÙNG ngưỡng `risk_model.json#bands` với `risk:score`, không lưu vào file', () => {
    const bands = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/risk_model.json'), 'utf8')).bands;
    expect(rl.bandCua(bands.High, bands)).toBe('High');
    expect(rl.bandCua(bands.High - 1, bands)).toBe('Medium');
    expect(rl.bandCua(bands.Medium - 1, bands)).toBe('Low');
    expect(rl.bandCua(25, null), 'không đọc được ngưỡng thì nói ra, không tự đặt').toBe('KHÔNG RÕ');
  });

  test('quá hạn lên ĐẦU, rồi theo điểm; rủi ro đã đóng không hiện; lọc được theo task', () => {
    const d = tam();
    for (const t of ['A', 'B', 'C', 'D']) rl.capMoi(d, t);
    dien(d, 'RISK-001', { likelihood: 5, impact: 5, due_date: '2099-01-01' });
    dien(d, 'RISK-002', { likelihood: 1, impact: 2, due_date: '2000-01-01' });
    dien(d, 'RISK-003', { status: 'closed', closed_at: '2026-11-16', close_reason: 'UAT đã giữ tới 22h từ tuần này' });
    dien(d, 'RISK-004', { tasks: ['T2'] });
    const mo = rl.bangMo(rl.kiemSo(d).ruiRo, { ngay: '2026-11-16' });
    expect(mo.map((r: { id: string }) => r.id)).toEqual(['RISK-002', 'RISK-001', 'RISK-004']);
    expect(mo[0].qua_han).toBe(true);
    expect(rl.bangMo(rl.kiemSo(d).ruiRo, { task: 'T2' }).map((r: { id: string }) => r.id)).toEqual(['RISK-004']);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('rủi ro ĐÃ CHẤP NHẬN không bị gắn cờ quá hạn — chấp nhận là đã quyết không giảm thiểu tiếp', () => {
    const d = tam();
    rl.capMoi(d, 'A');
    dien(d, 'RISK-001', { status: 'accepted', accepted_by: 'PO', due_date: '2000-01-01' });
    const [r] = rl.bangMo(rl.kiemSo(d).ruiRo, { ngay: '2026-11-16' });
    expect(r.qua_han).toBe(false);
    fs.rmSync(d, { recursive: true, force: true });
  });
});
