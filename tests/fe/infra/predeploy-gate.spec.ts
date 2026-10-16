import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';
import { canRepoGit } from './_trong_repo';

/*
 * @infra — CHỐT TIỀN-ĐẨY, và vì sao nó phải đo ở CÂY SẠCH.
 *
 * Hai lần vấp liên tiếp, cùng một lớp lỗi:
 *
 *   · v2.9.0 ra mắt khi `gates:index:check` ĐỎ (GATES.md thiếu 12 dòng). `release:verify` chạy
 *     `gate:policy` và `skills:index` nhưng KHÔNG chạy `gates:index:check`, nên "15/15 đạt" không nói
 *     gì về bảng gate.
 *   · v2.9.1 suýt lặp lại. Lần đó có chạy — ở CÂY LÀM VIỆC, nơi nó trả "KHÔNG PHÁN ĐƯỢC" (exit 2) vì
 *     có file WIP. Im lặng đó bị đọc thành "không sao". Chỉ worktree sạch tại HEAD mới CHẶN.
 *
 * Nên điều kiện đáng khoá nhất ở đây KHÔNG phải "chốt chạy được", mà là: **chốt CHẶN khi bảng lệch**,
 * và **exit 2 ở cây sạch không được tính là đạt**.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const PD = path.join(REPO, 'scripts/qa/predeploy_gate.js');

/* eslint-disable @typescript-eslint/no-var-requires, global-require */
const M = require(PD);
/* eslint-enable @typescript-eslint/no-var-requires, global-require */

test.describe('@infra predeploy — không phát hành khi bảng gate lệch nguồn', () => {
  test('cửa canh phải GỒM `gates:index:check` — đúng cửa đã lọt ở v2.9.0', () => {
    const ten = M.CUA.map((c: { ten: string }) => c.ten);
    expect(ten, 'bỏ cửa này ra là tái lập đúng lỗ của v2.9.0').toContain('gates:index:check');
    expect(ten, '`rule:coverage:check` đã đỏ trên CI ở v2.9.1 vì cùng lớp lỗi').toContain('rule:coverage:check');
  });

  test('chốt đo ở CÂY SẠCH, không đo ở cây làm việc', () => {
    /*
     * Khoá lại CƠ CHẾ, không chỉ khoá kết quả. Một bản sửa sau này đổi sang "chạy tại chỗ cho nhanh"
     * sẽ làm chốt gần như không bao giờ phán được, vì máy của người dùng kit gần như luôn có file WIP.
     */
    const src = fs.readFileSync(PD, 'utf8');
    expect(src).toMatch(/worktree/);
    expect(src, 'phải tự khai vì sao không đo tại chỗ').toMatch(/KHÔNG chạy tại chỗ|không đo ở cây làm việc/);
  });

  test('ĐỐI CHỨNG ÂM: HEAD hiện tại ⇒ ĐẠT', () => {
    canRepoGit(REPO, 'dựng worktree sạch tại HEAD để đo chốt tiền-đẩy');
    const r = spawnSync(process.execPath, [PD], { cwd: REPO, encoding: 'utf8', env: gateEnv(), timeout: 300000 });
    expect(r.status, `${r.stdout || ''}${r.stderr || ''}`).toBe(0);
  });

  test('ĐỐI CHỨNG DƯƠNG: làm lệch `GATES.md` ở cây sạch ⇒ CHẶN', () => {
    /*
     * Làm lệch TRONG worktree, không đụng cây làm việc. Đây là phép đo duy nhất chứng minh chốt có
     * răng — ba test trên chỉ nói nó được cấu hình đúng.
     */
    canRepoGit(REPO, 'dựng worktree sạch để thử ca lệch');
    const cay = M.dungCaySach();
    expect(cay.loi, `không dựng được cây sạch: ${cay.loi}`).toBeUndefined();
    try {
      const g = path.join(cay.duong, '.agent/config/GATES.md');
      const cu = fs.readFileSync(g, 'utf8').split('\n');
      /* Xoá MỘT dòng gate — đúng hình dạng của ca v2.9.1 (lệch một dòng). */
      const i = cu.findIndex((l) => /^\|\s*T[0-9]\s*\|/.test(l));
      expect(i, 'không tìm thấy dòng gate nào để làm lệch').toBeGreaterThan(-1);
      cu.splice(i, 1);
      fs.writeFileSync(g, cu.join('\n'), 'utf8');

      const kq = M.chayCua(cay.duong);
      const gi = kq.find((c: { ten: string }) => c.ten === 'gates:index:check');
      expect(gi.ma, `xoá một dòng GATES.md mà cửa vẫn xanh thì chốt này vô dụng. out: ${gi.out}`).toBe(1);
    } finally { M.donCaySach(cay.duong); }
  });

  test('`exit 2` ở CÂY SẠCH là KHÔNG PHÁN ĐƯỢC, KHÔNG phải đạt', () => {
    /*
     * Ở cây làm việc, exit 2 nghĩa là "có WIP nên chưa kết luận" — hợp lý. Ở cây sạch không có WIP nào,
     * nên exit 2 nghĩa là máy đó hỏng. Cho qua ở đây đúng là tái lập lỗ v2.9.1, chỉ ở tầng khác.
     */
    const src = fs.readFileSync(PD, 'utf8');
    expect(src).toMatch(/exit 2 ở CÂY SẠCH là bất thường/);
    expect(src, 'phải thoát 2 chứ không thoát 0').toMatch(/process\.exit\(2\)/);
  });
});
