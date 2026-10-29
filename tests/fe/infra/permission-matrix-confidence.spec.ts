/*
 * @infra `system:check` — DÒNG TỔNG ba mức bằng chứng của ma trận quyền (v2.9.5 §2).
 *
 * VÌ SAO CẦN DÒNG TỔNG. Cảnh báo per-record chỉ bắn khi record đã khai `deny_*` — một lựa chọn có chủ ý
 * (xem khối "HAI TẦNG" trong `system_map.js`), và đợt này KHÔNG đổi nó. Nhưng nó để lại một chỗ mù: một
 * ma trận chỉ có `allow` thì mọi ô chưa phân loại im lặng, nên một ma trận 90% `unknown` trông y hệt
 * một ma trận đã kiểm chứng hết.
 *
 * Mà `unknown` KHÔNG phải deny. Dựng một case 403 trên ô `unknown` là khẳng định một yêu cầu chưa ai
 * chốt; app cho phép thì bug log ra là bug BỊA. Tỉ lệ đó phải hiện ra, cho mọi record.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
const SM = path.join(REPO, 'scripts/qa/system_map.js');

/** 4 role × 3 action = 12 ô · allow 5 · deny_verified 1 · deny_inferred 1 ⇒ unknown 5. */
const PM = {
  id: 'PM-DEMO-001',
  type: 'permission_matrix',
  modules: ['Demo'],
  roles: ['Admin', 'Sales', 'Teacher', 'Guest'],
  actions: ['view', 'create', 'cancel'],
  allow: { Admin: ['view', 'create', 'cancel'], Sales: ['view', 'create'], Teacher: [], Guest: [] },
  deny_expected: 'HTTP 403 + dữ liệu không đổi',
  deny_verified: { Teacher: ['cancel'] },
  deny_inferred: { Guest: ['view'] },
  inferred_from: 'màn cấu hình quyền Demo, bản ghi 2026-10-28',
  source: 'FSD Demo §7',
  confirmed_by: 'BA',
  confirmed_at: '2026-10-28',
  version: 1,
  status: 'active',
};

function chay(records: Record<string, unknown>[]) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pmconf-'));
  records.forEach((r, i) => fs.writeFileSync(path.join(d, `pm-${i}.json`), JSON.stringify(r, null, 2), 'utf8'));
  const r = spawnSync(process.execPath, [SM, '--dir', d], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}`, d };
}

test.describe('@infra ma trận quyền — dòng tổng ba mức bằng chứng', () => {
  test('đếm ĐÚNG từng mức, và `unknown` suy ra từ ô chưa phân loại', () => {
    const r = chay([PM]);
    expect(r.out).toContain('1 ma trận quyền · 12 ô role×action');
    expect(r.out).toMatch(/allow 5 \(42%\)/);
    expect(r.out).toMatch(/deny_verified 1 \(8%\)/);
    expect(r.out).toMatch(/deny_inferred 1 \(8%\)/);
    expect(r.out).toMatch(/unknown 5 \(42%\)/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('nói thẳng `unknown` KHÔNG phải deny — câu này là thứ chặn một bug BỊA', () => {
    const r = chay([PM]);
    expect(r.out, 'phải nói rõ unknown không phải deny').toMatch(/KHÔNG phải deny/);
    expect(r.out, 'phải dặn đừng dựng case 403 trên ô đó').toMatch(/403/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('quá nửa số ô `unknown` ⇒ cảnh báo riêng: ma trận chưa đủ làm oracle', () => {
    const mong = { ...PM, allow: { Admin: ['view'], Sales: [], Teacher: [], Guest: [] }, deny_verified: {}, deny_inferred: {} };
    delete (mong as Record<string, unknown>).inferred_from;
    const r = chay([mong]);
    expect(r.out).toMatch(/quá nửa số ô đang `unknown`/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG ÂM: ma trận phân loại ĐỦ ⇒ KHÔNG có cảnh báo quá-nửa', () => {
    /* Không có vế này thì câu cảnh báo kia chỉ cần in luôn là "có răng" — và nó sẽ thành tiếng ồn. */
    const du = {
      ...PM,
      allow: { Admin: ['view', 'create', 'cancel'], Sales: ['view', 'create'], Teacher: ['view'], Guest: [] },
      deny_verified: { Teacher: ['create', 'cancel'], Sales: ['cancel'] },
      deny_inferred: { Guest: ['view', 'create', 'cancel'] },
    };
    const r = chay([du]);
    expect(r.out).toMatch(/unknown 0 \(0%\)/);
    expect(r.out).not.toMatch(/quá nửa số ô đang `unknown`/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('CÓ bản đồ nhưng 0 ma trận quyền ⇒ NÓI THẲNG là chưa có, không im lặng', () => {
    /*
     * "Không in gì" và "không có record nào" là hai chuyện khác nhau, mà người đọc không phân biệt được
     * nếu gate im lặng. Cùng một luật với `rule:consistency` 0 mệnh đề ⇒ exit 2.
     *
     * Ca này TINH HƠN ca thư mục rỗng: thư mục rỗng đi theo nhánh thoát sớm ("Chưa có bản đồ hệ thống
     * nào") và không bao giờ tới dòng tổng. Ca cần phủ là: kho CÓ bản đồ, nhưng chưa bản đồ nào là ma
     * trận quyền.
     *
     * BẢN ĐẦU ĐO TRÊN REPO THẬT, VÀ ĐÓ LÀ LỖI — chú thích cũ viết "đó đúng là trạng thái repo hiện tại,
     * nên repo chính là fixture trung thực nhất". Sai: `knowledge/**` bị gitignore (`.gitignore:116`),
     * chỉ `.gitkeep` được track. Hai bản đồ tôi quan sát được chỉ có trên MÁY TÔI, nên bản clone sạch —
     * và CI — thấy thư mục RỖNG rồi rơi vào nhánh thoát sớm. Phép kiểm xanh ở máy, ĐỎ ở CI; chính lượt
     * `ci-regression` dispatch 29/10/2026 bắt được (`regression (3)`, 1 failed).
     *
     * Đây là lớp "kết quả phụ thuộc môi trường chạy", và cách chữa là DỰNG fixture, không đi tìm một
     * trạng thái repo may mắn: một record bản đồ hợp lệ nhưng KHÔNG phải ma trận quyền.
     */
    const khongPhaiMaTran = {
      id: 'UI-FIXTURE-001',
      type: 'ui_contract',
      module: 'Fixture',
      screen: 'Màn dựng cho phép kiểm',
      confirmed_by: 'QA',
      confirmed_at: '2026-10-29',
      version: 1,
      status: 'active',
    };
    const r = chay([khongPhaiMaTran]);
    expect(r.out, 'kho PHẢI có bản đồ, nếu không ca này rơi vào nhánh thoát sớm')
      .not.toMatch(/Chưa có bản đồ hệ thống nào/);
    expect(r.out).toMatch(/0 record `PM-\*` ⇒ chưa có gì để tổng/);
    fs.rmSync(r.d, { recursive: true, force: true });
  });

  test('phép kiểm của file này KHÔNG được dựa vào `knowledge/**` của máy đang chạy', () => {
    /*
     * Khoá lại đúng lớp lỗi vừa gặp. `knowledge/**` bị gitignore, nên mọi phép kiểm đọc thẳng kho đó
     * sẽ cho kết quả khác nhau giữa máy người và CI — và "xanh ở máy, đỏ ở CI" là dạng hỏng tốn nhiều
     * thời gian nhất để tìm, vì nó trông như lỗi hạ tầng.
     */
    const src = fs.readFileSync(__filename.replace(/\.js$/, '.ts'), 'utf8');
    const goiTran = [...src.matchAll(/spawnSync\(process\.execPath, \[SM\](?!,\s*\[)/g)];
    expect(goiTran.length, 'mọi lượt gọi phải truyền `--dir <fixture>`, không gọi trần trên repo')
      .toBe(0);
  });

  test('SCHEMA khai rõ `type` của RECORD khác `type` của entry chỉ mục', () => {
    /*
     * SCHEMA.md từng khai HAI dạng khác nhau cho cùng một thứ: §permission_matrix ghi `type:
     * "permission_matrix"`, còn mục index ghi `type: system_map` + `subtype`. Code đọc dạng thứ nhất,
     * nên record khai theo dạng thứ hai bị BỎ QUA IM LẶNG — không lỗi, không cảnh báo, chỉ là ma trận
     * đó không bao giờ được kiểm. Tôi dính đúng bẫy này khi dựng fixture cho chính dòng tổng ở trên.
     */
    const s = fs.readFileSync(path.join(REPO, 'knowledge/SCHEMA.md'), 'utf8');
    expect(s, 'SCHEMA phải phân biệt hai chỗ dùng `type`').toMatch(/ĐỪNG LẪN với `type` trong FILE RECORD/);
    expect(s, 'phải nói rõ hậu quả là bị bỏ qua im lặng').toMatch(/BỎ QUA\s*\*{0,2}im lặng/i);
  });
});
