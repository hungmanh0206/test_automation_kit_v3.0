import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { gateEnv, TASK_SCOPED_ENV, CI_IDENTITY_ENV } from './_gate_env';

/*
 * `gateEnv` — CÁI LỌC CŨNG PHẢI CÓ ĐỐI CHỨNG (v2.9.8).
 *
 * `_gate_env.ts` tồn tại để tiến trình con của test KHÔNG thấy biến môi trường mà gate rẽ nhánh theo.
 * Nó đã hỏng hai lần theo cùng một kiểu, và cả hai lần triệu chứng y hệt nhau: **xanh ở máy dev, ĐỎ ở CI**.
 *
 *   04/09/2026 — thiếu `RUN_ID`  ⇒ `ci-regression` đỏ 5 lượt liên tiếp.
 *   02/11/2026 — thiếu `CI` + `GITHUB_REF_TYPE`/`GITHUB_REF_NAME` ⇒ 7 phép kiểm mới của v2.9.7 đỏ trên
 *                runner, và lượt `release` trên tag `v2.9.7` đỏ theo. Không ai nhìn lượt đó.
 *
 * Cả hai lần đều KHÔNG có gì canh chính cái lọc: nó là một mảng chuỗi, ai xoá một dòng thì mọi thứ vẫn
 * xanh ở máy người xoá. Bộ test này canh đúng chỗ ấy.
 *
 * Phép kiểm ĐÁNG GIÁ nhất ở đây là phép QUÉT cuối cùng: nó không kiểm danh sách khớp một bản chép tay,
 * mà đối chiếu danh sách với **mã nguồn thật** — thêm một nhánh `process.env.CI` mới ở bất kỳ gate nào
 * mà quên khai thì nó đỏ ngay, thay vì đỏ ba tuần sau trên một runner không ai mở log.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');

test.describe.configure({ mode: 'serial' });

/** Đặt vài biến vào `process.env`, chạy `fn`, rồi TRẢ LẠI nguyên trạng — kể cả khi `fn` ném. */
function voiEnv<T>(dat: Record<string, string>, fn: () => T): T {
  const cu = new Map<string, string | undefined>();
  for (const [k, v] of Object.entries(dat)) { cu.set(k, process.env[k]); process.env[k] = v; }
  try {
    return fn();
  } finally {
    for (const [k, v] of cu) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
}

test.describe('@infra gateEnv — tiến trình con không được thừa kế danh tính CI', () => {
  test('ĐỐI CHỨNG DƯƠNG: env có CI + GITHUB_REF_* ⇒ env con KHÔNG còn chúng', () => {
    const ra = voiEnv(
      { CI: 'true', GITHUB_ACTIONS: 'true', GITHUB_REF_TYPE: 'tag', GITHUB_REF_NAME: 'v9.9.9', RUN_ID: 'ci-1-2' },
      () => gateEnv(),
    );
    for (const k of ['CI', 'GITHUB_ACTIONS', 'GITHUB_REF_TYPE', 'GITHUB_REF_NAME']) {
      expect(ra[k], `\`${k}\` lọt vào env con ⇒ phép kiểm sẽ đo runner thay vì đo gate`).toBeUndefined();
    }
    expect(ra.RUN_ID, '`RUN_ID` là lỗi 04/09/2026, không được tái phát').toBeUndefined();
  });

  test('ĐỐI CHỨNG ÂM: biến KHÔNG nằm trong danh sách phải SỐNG SÓT', () => {
    const ra = voiEnv({ MOT_BIEN_VO_HAI_DE_DO: 'con-nguyen' }, () => gateEnv());
    expect(ra.MOT_BIEN_VO_HAI_DE_DO, 'lọc mà xoá sạch thì nó không chứng minh được gì').toBe('con-nguyen');
    expect(ra.PATH, 'gỡ PATH thì `node` con không chạy nổi — lọc sai hướng').toBeTruthy();
  });

  test('khai tường minh vẫn THẮNG: `gateEnv({ CI })` là đường đo nhánh CI', () => {
    const ra = voiEnv({ CI: '' }, () => gateEnv({ CI: 'true' }));
    expect(ra.CI, 'test muốn đo nhánh CI thì phải khai được, và lời khai phải ghi sau cái lọc').toBe('true');
  });

  test('hai danh sách KHÔNG được giẫm lên nhau', () => {
    const chung = TASK_SCOPED_ENV.filter((k) => (CI_IDENTITY_ENV as readonly string[]).includes(k));
    expect(chung, 'một tên nằm ở hai danh sách thì sửa một chỗ không đủ, và chỗ còn lại im lặng').toEqual([]);
  });

  /*
   * Quét MÃ NGUỒN THẬT. Mẫu số ở đây là "mọi biến `CI`/`GITHUB_*` mà gate đọc", lấy bằng cách đọc file
   * chứ không bằng cách chép tay — một danh sách chép tay thì chính nó lại là con số không ai kiểm.
   */
  test('danh sách phải BAO mọi biến danh tính CI mà gate thật đọc', () => {
    const files: string[] = [path.join(REPO, 'playwright.config.js')];
    const quet = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { if (e.name !== 'node_modules') quet(p); }
        else if (e.name.endsWith('.js') || e.name.endsWith('.ts')) files.push(p);
      }
    };
    quet(path.join(REPO, 'scripts'));

    const thay = new Map<string, string>();
    for (const f of files) {
      if (!fs.existsSync(f)) continue;
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(/process\.env\.(CI|GITHUB_[A-Z_]+)\b/g)) {
        if (!thay.has(m[1])) thay.set(m[1], path.relative(REPO, f).split(path.sep).join('/'));
      }
    }

    expect(thay.size, 'không quét thấy gì ⇒ phép kiểm này RỖNG, không phải "đã sạch"').toBeGreaterThan(0);

    const thieu = [...thay].filter(([k]) => !(CI_IDENTITY_ENV as readonly string[]).includes(k));
    expect(
      thieu.map(([k, f]) => `${k} (đọc ở ${f})`),
      'gate đọc biến này nhưng `CI_IDENTITY_ENV` không gỡ nó ⇒ test spawn gate sẽ cho kết quả khác nhau ở máy dev và ở runner',
    ).toEqual([]);
  });
});
