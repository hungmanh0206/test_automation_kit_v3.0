/**
 * `write:proof` — case có hành động GHI thì có nghiệm thu bằng KÊNH ĐỘC LẬP không?
 *
 * BỐI CẢNH. Vế thứ hai của điều #2 chủ dự án nêu: *"xác nhận dữ liệu thực sự thay đổi như expected"*.
 * Kit đã có doctrine cho đúng chuyện đó — `packs/qemis.md` mục 1: **toast `thành công` KHÔNG chứng
 * minh đã ghi**, với NĂM cơ chế từng cho cùng triệu chứng. Nhưng doctrine nằm ở **lời dặn trong
 * skill**, không ở **máy**. File này gác cái máy đếm xem lời dặn ấy có được làm theo không.
 *
 * ĐO TRÊN CSDL-4008: 312 case · 184 có hành động ghi · **92 nằm trong spec không có đường nghiệm thu
 * độc lập** · 68 có · 24 không tìm thấy spec.
 *
 * HAI LẦN SIẾT, cả hai do đo mà biết:
 *   ① Dò theo chữ trong cột *Kết quả mong đợi* bắt **248/312** case, kể cả case chỉ MỞ MÀN. Một phép
 *      đo bắt gần hết thì nó không phân biệt được gì ⇒ chuyển sang dò HÀNH ĐỘNG trong cột *Các bước*.
 *   ② Chỉ grep trong file `.spec.ts` gắn cờ oan `c-ngan-sach.spec.ts`, trong khi `lib/nganSach.ts`
 *      mà nó NHẬP VÀO có hẳn đường hỏi DB ⇒ phải theo đường nhập. 115 → 92.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const CUA = path.join(REPO, 'scripts', 'qa', 'write_proof.js');

/** Cây task tạm: bộ .md canonical + automation/ (spec và lib). */
function cay(cases: Array<[string, string]>, specs: Record<string, string>, libs: Record<string, string> = {}): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'writeproof-'));
  const T = path.join(d, 'tasks', 'T1');
  fs.mkdirSync(path.join(T, 'test-cases'), { recursive: true });
  fs.mkdirSync(path.join(T, 'automation', 'lib'), { recursive: true });

  const head = '| TC ID | Loại case | Module | Các bước thực hiện | Kết quả mong đợi |';
  const rows = cases.map(([id, buoc]) => `| ${id} | UI | M | ${buoc} | ok |`);
  fs.writeFileSync(path.join(T, 'test-cases', 'bo.md'), [head, '|---|---|---|---|---|', ...rows].join('\n'), 'utf8');

  for (const [f, noi] of Object.entries(specs)) fs.writeFileSync(path.join(T, 'automation', f), noi, 'utf8');
  for (const [f, noi] of Object.entries(libs)) fs.writeFileSync(path.join(T, 'automation', 'lib', f), noi, 'utf8');
  return d;
}

const chay = (goc: string) => {
  const r = spawnSync(process.execPath, [CUA, '--task', 'T1', '--goc', goc],
    { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};

const CA_GHI: Array<[string, string]> = [['X_TC_001', '1. mở màn<br>2. bấm "Ghi"']];

test.describe('@infra write:proof — "đã ghi" không được chứng minh bằng chính màn hình vừa bấm', () => {
  test('spec KHÔNG có đường nghiệm thu độc lập ⇒ nêu đích danh case và file', () => {
    const d = cay(CA_GHI, { 'a.spec.ts': "test('X_TC_001', async () => { await page.click('#ghi'); });\n" });
    const r = chay(d);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('X_TC_001');
    expect(r.out).toContain('a.spec.ts');
    expect(r.out).toMatch(/KHÔNG có cơ chế nào {10}: 1/);
  });

  test('ĐỐI CHỨNG: spec hỏi DB chỉ-đọc ⇒ KHÔNG bị nêu', () => {
    const d = cay(CA_GHI, { 'a.spec.ts': "import { queryUatReadonly } from 'x';\ntest('X_TC_001', async () => {});\n" });
    const r = chay(d);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/KHÔNG có cơ chế nào {10}: 0/);
  });

  test('ĐỐI CHỨNG: spec tải lại trang rồi đọc lại ⇒ KHÔNG bị nêu', () => {
    const d = cay(CA_GHI, { 'a.spec.ts': "test('X_TC_001', async () => { await page.reload(); });\n" });
    const r = chay(d);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/KHÔNG có cơ chế nào {10}: 0/);
  });

  test('THEO ĐƯỜNG NHẬP: cơ chế nằm ở lib mà spec nhập vào ⇒ KHÔNG bị nêu', () => {
    /*
     * Lượt đầu chỉ grep trong file `.spec.ts` và gắn cờ oan `c-ngan-sach.spec.ts`, trong khi
     * `lib/nganSach.ts` mà nó nhập vào có hẳn đường hỏi DB. Một spec nghiệm thu QUA THƯ VIỆN vẫn là
     * nghiệm thu; chỉ nhìn một file là tố oan. 115 → 92 sau khi sửa.
     */
    const d = cay(CA_GHI,
      { 'a.spec.ts': "import { doiChieu } from './lib/ns';\ntest('X_TC_001', async () => { await doiChieu(); });\n" },
      { 'ns.ts': "import { queryUatReadonly } from 'x';\nexport const doiChieu = async () => {};\n" });
    const r = chay(d);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/KHÔNG có cơ chế nào {10}: 0/);
  });

  test('case KHÔNG có hành động ghi ⇒ không tính vào mẫu số', () => {
    /*
     * Lượt đầu dò theo chữ trong cột "Kết quả mong đợi" và bắt 248/312 case — kể cả case chỉ MỞ MÀN.
     * Một phép đo bắt gần hết thì nó không phân biệt được gì.
     */
    const d = cay([['X_TC_001', '1. mở màn<br>2. đọc tiêu đề']],
      { 'a.spec.ts': "test('X_TC_001', async () => {});\n" });
    const r = chay(d);
    expect(r.code, 'không case nào ghi ⇒ không có mẫu số ⇒ KHÔNG PHÁN ĐƯỢC').toBe(2);
    expect(r.out).toMatch(/KHÔNG PHÁN ĐƯỢC/);
  });
});

test.describe('@infra write:proof — in đúng mức phép đo nói được', () => {
  test('LUÔN nói rõ đây là MỨC FILE, và vế dương chỉ là CHẶN TRÊN', () => {
    /*
     * Một spec có `reload()` cho case này chưa chắc dùng cho case kia. Gộp hai vế thành một tỉ lệ
     * "đã nghiệm thu X%" là NÓI QUÁ — đó đúng là cách một con số thật trở thành một câu sai.
     */
    const d = cay(CA_GHI, { 'a.spec.ts': "test('X_TC_001', async () => {});\n" });
    const r = chay(d);
    expect(r.out).toMatch(/MỨC FILE/);
    expect(r.out).toMatch(/CHẶN TRÊN|chặn trên/);
    expect(r.out, 'phải nói vế ÂM mới đáng tin').toMatch(/Vế ÂM đáng tin/);
    expect(r.out, 'phải dẫn lý do luật tồn tại').toMatch(/toast "thành công" KHÔNG chứng minh/);
  });

  test('không có spec nào ⇒ KHÔNG PHÁN ĐƯỢC, không báo "0 case có vấn đề"', () => {
    const d = cay(CA_GHI, {});
    const r = chay(d);
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/KHÔNG PHÁN ĐƯỢC/);
    expect(r.out).not.toMatch(/KHÔNG có cơ chế nào {10}: 0/);
  });
});
