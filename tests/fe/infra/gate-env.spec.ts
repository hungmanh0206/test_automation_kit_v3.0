import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { mayThu } from './_may_thu';
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

/*
 * `mayThu` — CÁI LỌC THỨ HAI, VÀ NÓ CŨNG PHẢI CÓ ĐỐI CHỨNG.
 *
 * `_may_thu.ts` cho spec trỏ sang BẢN CHÉP của script đang đo, để lượt phá hoại không phải `git stash`
 * trên cây dùng chung. Lý do đầy đủ nằm ở đầu file đó.
 *
 * Gác ở đây vì cùng một bài học với `gateEnv`: hai lần `_gate_env` hụt một biến đều sống được do KHÔNG
 * có gì canh chính cái lọc. `mayThu` có đúng một hành vi dễ bị "đơn giản hoá" cho tiện — lùi về bản thật
 * khi đường dẫn ghi đè sai — và lùi chính là chỗ phép thử tự rỗng.
 */
test.describe('@infra mayThu — trỏ sang bản chép, và KHÔNG được lùi về bản thật', () => {
  const THAT = path.join(REPO, 'scripts/qa/version_check.js');

  test('không đặt biến ⇒ dùng đúng bản thật', () => {
    const r = voiEnv({}, () => mayThu('BIEN_KHONG_AI_DAT_CA', THAT));
    expect(r).toBe(THAT);
  });

  /*
   * Ca "đặt biến vào file có thật ⇒ dùng bản đó" từng ở đây, dựng bản chép PHẲNG. Phép kiểm cấu trúc
   * thêm sau đó làm nó tự mâu thuẫn — bản phẳng nay bị NÉM. Nó được thay bằng ca "ĐỐI CHỨNG ÂM: bản chép
   * GIỮ ĐÚNG độ sâu ⇒ nhận" ở dưới, vừa kiểm đúng điều đó vừa dựng bản chép hợp lệ.
   */

  /*
   * CA QUAN TRỌNG NHẤT. Gõ sai đường dẫn một ký tự mà hàm lùi về bản thật thì lượt "phá hoại" chạy trên
   * bản THẬT, mọi ca xanh, và người đọc kết luận "đối chứng không bắt được gì" — trong khi phép phá chưa
   * bao giờ xảy ra. Đúng loại lỗi cả phiên này đi chữa: một lượt KHÔNG đo được trả về thứ trông như kết quả.
   */
  test('ĐỐI CHỨNG DƯƠNG: đường dẫn ghi đè KHÔNG tồn tại ⇒ NÉM, tuyệt đối không lùi', () => {
    const thieu = path.join(os.tmpdir(), 'khong-he-ton-tai-may-thu-9x7.js');
    expect(fs.existsSync(thieu), 'file này phải KHÔNG tồn tại, nếu không phép kiểm rỗng').toBe(false);
    let nem: Error | null = null;
    try {
      voiEnv({ MAY_THU_THU_NGHIEM: thieu }, () => mayThu('MAY_THU_THU_NGHIEM', THAT));
    } catch (e) { nem = e as Error; }
    expect(nem, 'lùi về bản thật là chỗ phép thử tự rỗng mà vẫn xanh').not.toBeNull();
    expect(nem!.message, 'phải nêu TÊN BIẾN để người gõ sai biết sửa ở đâu').toContain('MAY_THU_THU_NGHIEM');
    expect(nem!.message, 'và nói rõ vì sao không lùi').toMatch(/lùi/);
  });

  /*
   * BẢN CHÉP PHẲNG PHẢI BỊ NÉM. Lượt đầu của tôi chép script thẳng vào thư mục tạm; script giải gốc repo
   * từ `__dirname` nên nó không nạp nổi `runtime_config` và chết lúc khởi động. Kết quả: 4 ca đỏ trong đó
   * MỘT ca lẽ ra phải xanh — nhìn vào thì tưởng phép phá có tác dụng, thật ra script chưa chạy dòng nào.
   */
  test('ĐỐI CHỨNG DƯƠNG: bản chép SAI độ sâu tương đối ⇒ NÉM, không để sinh ca đỏ gây hiểu sai', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'maythu-phang-'));
    const phang = path.join(d, 'version_check.js');
    fs.writeFileSync(phang, '/* bản chép phẳng */', 'utf8');
    let nem: Error | null = null;
    try {
      voiEnv({ MAY_THU_THU_NGHIEM: phang }, () => mayThu('MAY_THU_THU_NGHIEM', THAT));
    } catch (e) { nem = e as Error; }
    expect(nem, 'không ném thì script chết lúc khởi động và ca đỏ nói về một thứ khác').not.toBeNull();
    expect(nem!.message, 'phải nêu đường dẫn TƯƠNG ĐỐI cần giữ').toContain('scripts/qa/version_check.js');
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('ĐỐI CHỨNG ÂM: bản chép GIỮ ĐÚNG độ sâu ⇒ nhận, không ném', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'maythu-sau-'));
    fs.mkdirSync(path.join(d, 'scripts', 'qa'), { recursive: true });
    fs.writeFileSync(path.join(d, 'package.json'), '{"name":"ban-chep"}', 'utf8');
    const dung = path.join(d, 'scripts', 'qa', 'version_check.js');
    fs.writeFileSync(dung, '/* bản chép đúng cấu trúc */', 'utf8');
    const r = voiEnv({ MAY_THU_THU_NGHIEM: dung }, () => mayThu('MAY_THU_THU_NGHIEM', THAT));
    expect(r, 'giữ đúng độ sâu mà vẫn ném thì không ai dựng được bản chép hợp lệ').toBe(path.resolve(dung));
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('bốn spec dùng `mayThu` đều khai biến RIÊNG, không dùng chung một tên', () => {
    const bien = ['sua-mo-ta', 'tao-issue-con', 'cap-nhat-issue', 'perf-verdict-neo'].map((t) => {
      const src = fs.readFileSync(path.join(__dirname, `${t}.spec.ts`), 'utf8');
      const m = /mayThu\('([A-Z_]+)'/.exec(src);
      expect(m, `${t}.spec.ts không còn gọi mayThu ⇒ nó lại đo bản trên cây dùng chung`).not.toBeNull();
      return m![1];
    });
    expect(new Set(bien).size,
      'dùng chung một tên biến thì trỏ bản chép cho spec này là trỏ sai cho ba spec kia').toBe(bien.length);
  });
});
