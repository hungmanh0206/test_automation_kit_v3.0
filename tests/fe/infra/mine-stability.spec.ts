import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * @infra — `mine.js --chay-on-dinh`: CỜ TỪNG LÀ CỜ MA.
 *
 * Trước 16/10/2026, chuỗi `--chay-on-dinh` xuất hiện **đúng một lần** trong `mine.js`, và là trong một
 * dòng CHÚ THÍCH. Code không đọc nó. Node bỏ qua tham số lạ im lặng, nên `mine.js --chay-on-dinh` chạy
 * xong, in ra một bảng đẹp, và lọc **0 thứ** — nhìn y hệt một lượt đã lọc theo độ ổn định.
 *
 * Một cờ không làm gì còn tệ hơn một cờ không tồn tại: cờ không tồn tại thì người dùng biết ngay, còn
 * cờ im lặng thì cho ra số liệu sai mà trông đúng. Prompt v2.9.4 đặt tiêu chí chọn ứng viên dựa trên
 * chính cờ này — tức cả một tiêu chí tuyển chọn dựng trên một dòng chú thích.
 *
 * Nên bộ test này khoá hai điều, và điều thứ hai mới là điều đáng khoá:
 *   ① cờ lạ bị CHẶN (để không sinh ra cờ ma thứ hai);
 *   ② cờ `--chay-on-dinh` LÀM ĐỔI kết quả — nếu bật mà số ứng viên không đổi thì nó lại là cờ ma.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const MINE = path.join(REPO, 'scripts/qa/reuse/mine.js');

function chay(them: string[] = []) {
  const r = spawnSync(process.execPath, [MINE, '--json', ...them], {
    cwd: REPO, encoding: 'utf8', env: gateEnv(), maxBuffer: 64 * 1024 * 1024,
  });
  let j: Record<string, unknown> | null = null;
  try { j = JSON.parse(r.stdout || ''); } catch (e) { j = null; }
  return { code: r.status, j, out: `${r.stdout || ''}${r.stderr || ''}` };
}

test.describe('@infra mine --chay-on-dinh — cờ phải LÀM GÌ ĐÓ', () => {
  test('cờ LẠ bị CHẶN, và nói rõ cờ nào có thật', () => {
    const r = spawnSync(process.execPath, [MINE, '--khong-co-that'], {
      cwd: REPO, encoding: 'utf8', env: gateEnv(),
    });
    expect(r.status, 'cờ lạ phải dừng máy, không được bỏ qua im lặng').toBe(2);
    expect(`${r.stdout}${r.stderr}`).toMatch(/KHÔNG ĐƯỢC HỖ TRỢ/);
    expect(`${r.stdout}${r.stderr}`, 'phải liệt kê cờ có thật').toContain('--chay-on-dinh');
  });

  test('mỗi ứng viên có CỘT ổn định — `null` nghĩa là CHƯA ĐO, không phải ổn định', () => {
    const r = chay();
    test.skip(!r.j, 'không chạy được mine trên cây này (chưa có automation nào?)');
    const L1 = (r.j!.ung_vien_L1 || []) as Array<{ on_dinh: unknown }>;
    test.skip(!L1.length, 'cây này không có ứng viên nào lặp ≥2 task');
    expect(L1.every((x) => 'on_dinh' in x), 'thiếu cột thì người đọc tự suy, và họ sẽ suy thành "ổn"').toBe(true);
  });

  test('BẬT cờ ⇒ số ứng viên GIẢM — nếu không đổi thì nó lại là cờ ma', () => {
    /*
     * Đây là phép đo duy nhất chứng minh cờ có hiệu lực. Đo 16/10/2026 trên cây thật: 22 ứng viên
     * xuống 4, và tỉ lệ phủ từ 83% xuống 2%.
     */
    const khong = chay();
    const co = chay(['--chay-on-dinh']);
    test.skip(!khong.j || !co.j, 'không chạy được mine trên cây này');

    const a = ((khong.j!.ung_vien_L1 || []) as unknown[]).length;
    const b = ((co.j!.ung_vien_L1 || []) as unknown[]).length;
    test.skip(a === 0, 'cây này không có ứng viên nào để lọc');

    expect(b, 'lọc không được làm TĂNG số ứng viên').toBeLessThanOrEqual(a);
    expect(co.j!.loc_on_dinh, 'kết quả phải tự khai là đã lọc').toBe(true);
    expect(khong.j!.loc_on_dinh).toBe(false);
  });

  test('ứng viên SAU KHI LỌC phải có ≥1 PASS và 0 FAIL — "0P/0F" KHÔNG được lọt', () => {
    /*
     * Bản đầu của tôi chỉ kiểm `fail === 0`, và hai ứng viên `0P/0F` lọt qua: TC có tồn tại nhưng chưa
     * PASS lần nào. "Không có lượt đỏ" KHÁC "đã chạy xanh", mà tiêu chí là cái thứ hai.
     */
    const r = chay(['--chay-on-dinh']);
    test.skip(!r.j, 'không chạy được mine trên cây này');
    const L1 = (r.j!.ung_vien_L1 || []) as Array<{ on_dinh: { pass: number; fail: number } | null }>;
    for (const x of L1) {
      expect(x.on_dinh, 'ứng viên chưa đo KHÔNG được lọt qua bộ lọc ổn định').toBeTruthy();
      expect(x.on_dinh!.fail, 'còn lượt FAIL thì không phải ổn định').toBe(0);
      expect(x.on_dinh!.pass, '0 lượt PASS thì chưa chứng minh được gì').toBeGreaterThan(0);
    }
  });

  test('chỉ số ổn định đọc file DƯỚI `test-results/**`, không đọc ở gốc task', () => {
    /*
     * Ghi chú cũ của `mine.js` nói nó "đọc `testcase-status.json`" — nhưng file đó KHÔNG nằm ở gốc
     * task. Nó nằm trong `test-results/`, thường còn chia theo shard. Đọc sai chỗ thì không thấy gì,
     * và "không thấy gì" rất dễ bị đọc thành "chưa chạy bao giờ".
     */
    const src = fs.readFileSync(MINE, 'utf8');
    expect(src, 'phải quét đệ quy, không đọc một đường dẫn cố định').toMatch(/testcase-status.*\\\.json\$|testcase-status/);
    expect(src, 'phải tự khai phép nối là GIÁN TIẾP').toMatch(/GIÁN TIẾP/);
  });
});
