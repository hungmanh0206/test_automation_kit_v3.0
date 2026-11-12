/*
 * @infra `recon:check` — `ui_catalog.md` là ORACLE, nên nó phải khai nguồn, và khai cả giới hạn.
 *
 * PROMPT v2.9.5 §2 ĐẶT ĐẦU BÀI NGƯỢC, và tôi đổi sau khi đo. Đầu bài ghi: "mọi dòng trong
 * `requirements/ui_catalog.md` khai nguồn quan sát phải trỏ tới một ảnh trong danh mục evidence" — nó
 * giả định catalog CHỨA quan sát. Đo trên cả 4 catalog có thật: cả 4 đều khai mình là bản trích đặc tả
 * và CẤM lấy nhãn từ build đang chạy. Một gate đòi "trỏ ảnh" sẽ hợp pháp hoá đúng thứ banner đang cấm —
 * nhãn lấy từ app rồi chống lưng bằng ảnh của app, tức so app với chính nó.
 *
 * BA HÌNH DẠNG HỢP LỆ, rút từ chính 4 file đó:
 *   ① trích từ đặc tả  ⇒ phải nêu nguồn + banner CẤM lấy nhãn từ build;
 *   ② nguồn là ảnh chụp build (task không có FS/Figma — ca thật của TASK-3544) ⇒ hợp lệ, NHƯNG phải khai
 *      giới hạn: case dựa trên nó KHÔNG chứng minh build đúng đặc tả;
 *   ③ không khai nguồn gì ⇒ CHẶN.
 *
 * Hình dạng ② là chỗ dễ làm sai nhất khi dựng gate: một luật đòi "phải có nguồn đặc tả" sẽ PHẠT đúng sự
 * trung thực của TASK-3544, và đẩy người ta đi bịa một nguồn đặc tả không tồn tại.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const RC = path.join(REPO, 'scripts/qa/recon_check.js');

/** Dựng một cây tạm `outputs/P/tasks/<task>/requirements/ui_catalog.md`. */
function chay(catalogs: Record<string, string>, argv: string[] = []) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'recon-'));
  for (const [task, body] of Object.entries(catalogs)) {
    const dir = path.join(d, 'outputs', 'P', 'tasks', task, 'requirements');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'ui_catalog.md'), body, 'utf8');
  }
  const r = spawnSync(process.execPath, [RC, '--repo', d, ...argv], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}`, d };
}

const TU_DAC_TA = '# X\n\n> Nguồn: `requirements/spec.md` mục 4, trích nguyên văn.\n> CẤM lấy nhãn/format từ build đang chạy.\n';
const TU_BUILD = '# X\n\n> Nguồn của catalog này là ảnh chụp build ngày 01/01.\n> Hệ quả: case dựa trên nó KHÔNG chứng minh build đúng đặc tả.\n';

test.describe('@infra recon:check — ba hình dạng hợp lệ', () => {
  test('trích từ đặc tả + banner CẤM ⇒ ĐẠT', () => {
    const r = chay({ T: TU_DAC_TA });
    expect(r.code, r.out).toBe(0);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('nguồn là ẢNH CHỤP BUILD mà khai rõ giới hạn ⇒ ĐẠT, không bị phạt vì trung thực', () => {
    /*
     * Ca thật: TASK-3544. Task không có FS lẫn Figma, nên nguồn duy nhất là ảnh QA gửi. Catalog đó khai
     * thẳng rằng case Display dựng trên nó chỉ chứng minh build không trôi khỏi ảnh đã duyệt. Gate phải
     * cho qua — nếu không, nó dạy người ta bịa một nguồn đặc tả.
     */
    const r = chay({ T: TU_BUILD });
    expect(r.code, r.out).toBe(0);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('KHÔNG khai nguồn gì ⇒ CHẶN', () => {
    const r = chay({ T: '# X\n\nKhông khai nguồn gì cả.\n' });
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('KHÔNG khai nguồn');
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('nguồn là BUILD mà KHÔNG khai giới hạn ⇒ CHẶN', () => {
    const r = chay({ T: '# X\n\n> Nguồn của catalog này là ảnh chụp build ngày 01/01.\n' });
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('không khai giới hạn');
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('trích đặc tả mà THIẾU banner CẤM ⇒ CHẶN', () => {
    const r = chay({ T: '# X\n\n> Nguồn: `requirements/spec.md` mục 4, trích nguyên văn.\n' });
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('thiếu banner CẤM');
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('dòng khai QUAN SÁT mà không có dấu chưa-kiểm-chứng ⇒ CHẶN, và chỉ đúng dòng', () => {
    const r = chay({ T: `${TU_DAC_TA}\nNhãn này lấy từ quan sát thực tế trên app.\n` });
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('quan sát KHÔNG khai chưa-kiểm-chứng');
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG ÂM: dòng quan sát CÓ khai chưa đo ⇒ THA', () => {
    /*
     * Không có vế này thì gate chỉ cần cấm sạch chữ "quan sát" là "đạt" — và nó sẽ đẩy người ta xoá chữ
     * đó đi thay vì khai đúng trạng thái. Mẫu đúng lấy từ TASK-9001: nó có một dòng quan sát, và ngay
     * cạnh là "⚠️ `url` và `headingText` … chưa đo trên UAT".
     */
    const r = chay({ T: `${TU_DAC_TA}\nNhãn này lấy từ quan sát thực tế trên app.\n⚠️ Phần này chưa đo trên UAT.\n` });
    expect(r.code, r.out).toBe(0);
    fs.rmSync(r.d, { recursive: true, force: true });
  });
});

test.describe('@infra recon:check — "không phán được" KHÔNG thành "đạt"', () => {
  test('không có catalog nào ⇒ exit 2, không phải 0', () => {
    const r = chay({});
    expect(r.code, r.out).toBe(2);
    expect(r.out).toContain('KHÔNG PHÁN ĐƯỢC');
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('`--task` trỏ task không có catalog ⇒ exit 2, nêu tên task', () => {
    const r = chay({ T: TU_DAC_TA }, ['--task', 'KHONG-CO']);
    expect(r.code, r.out).toBe(2);
    expect(r.out).toContain('KHONG-CO');
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('gate TỰ NÓI giới hạn: dò CÂU, không hiểu nghĩa', () => {
    const r = chay({ T: TU_DAC_TA });
    expect(r.out, 'không nói ra thì người đọc tin gate đã kiểm nội dung').toMatch(/dò CÂU|không hiểu nghĩa/i);
    fs.rmSync(r.d, { recursive: true, force: true });
  });
});

test.describe('@infra recon:check — nối vào kit', () => {
  test('có npm script, và KHÔNG nằm trong static-check', () => {
    /*
     * Gate này đọc `outputs/` — thứ `.gitignore` loại, nên CI không có. Đưa nó vào `static-check` thì nó
     * luôn exit 2 ("không phán được") ở CI, và một cửa luôn vàng sẽ bị người ta học cách bỏ qua. Nó là
     * cửa chạy LÚC LÀM TASK, gọi từ chuỗi Phase 1.
     */
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
    expect(pkg.scripts['recon:check'], 'chưa đăng ký npm script').toBeTruthy();
    const ci = fs.readFileSync(path.join(REPO, '.github/workflows/static-check.yml'), 'utf8');
    expect(ci, 'recon:check không được vào static-check — CI không có outputs/').not.toContain('recon:check');
  });

  test('repo THẬT: 4 catalog hiện có đều ĐẠT', () => {
    const r = spawnSync(process.execPath, [RC], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    const out = `${r.stdout || ''}${r.stderr || ''}`;
    test.skip(r.status === 2, 'máy này không có outputs/ với ui_catalog.md — gate chỉ có nghĩa trên cây có task');
    expect(r.status, out).toBe(0);
  });
});
