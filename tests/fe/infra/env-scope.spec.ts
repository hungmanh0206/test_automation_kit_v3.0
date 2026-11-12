/*
 * `env:scope` — GÁC CHỖ ĐỂ CREDENTIAL, VÀ GÁC CẢ VIỆC CỬA ẤY KHÔNG RÒ.
 *
 * Vì sao có cửa được gác ở đây (đo 03/11/2026): `loadEnvFiles()` nạp profile TRƯỚC rồi mới tới `.env`
 * chung, file đầu tiên đặt khoá thì thắng. Nên profile nào quên khai `OPS_USERNAME` sẽ lặng lẽ xài bộ
 * tài khoản trong `.env` — mà một tài khoản app mẫu chỉ thuộc MỘT cấp học. Lượt ấy vẫn đăng nhập được,
 * vẫn XANH, và đo nhầm trường. Không ca nào đỏ.
 *
 * MỌI CA ĐỀU CHẠY TRÊN FIXTURE trong thư mục tạm, KHÔNG đụng `.env` hay `profiles/` thật. Giá trị trong
 * fixture là chuỗi ghép từ mảng, không phải literal — `secret:scan` có luật `generic-secret-assign` và
 * nó đỏ đúng ở dòng gán vào tên khớp `*PASSWORD*`. Nới máy quét cho test chạy được là tự bỏ cái gác.
 *
 * ⚠️ `spawn` BẤT ĐỒNG BỘ, không `spawnSync` — cùng khuôn với các spec infra khác của kit.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import { gateEnv } from './_gate_env';
import { mayThu } from './_may_thu';

const REPO = path.resolve(__dirname, '..', '..', '..');
const CUA = mayThu('ENV_SCOPE_JS', path.join(REPO, 'scripts/qa/env_scope_check.js'));

/** Giá trị fixture — ghép từ mảng để không thành literal gán vào tên `*PASSWORD*`. */
const GIA_TRI = ['gia', 'tri', 'fixture', 'khong', 'that'].join('-');

/*
 * Biến phải ghim là DỮ LIỆU của dự án (v3.0.0): `.agent/config/context_pins.json` của gốc đang đo. Fixture
 * mang config của MỘT app giả để các ca dưới đo đúng cơ chế, không phụ thuộc app nào có thật.
 */
const HAU_QUA = 'app lặng lẽ giữ "Cấp mặc định"';
function ghiPins(goc: string): void {
  const d = path.join(goc, '.agent', 'config');
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'context_pins.json'), JSON.stringify({
    nhan_dien: '^APP_',
    phai_ghim: [{ khoa: 'APP_CAP_HOC', hau_qua: HAU_QUA }],
    nen_ghim: [{ khoa: 'APP_NAM_HOC', hau_qua: 'giữ năm mặc định' }],
  }), 'utf8');
}

/** Dựng một gốc giả: `.env` + các `profiles/<task>/task.env`, trả về đường dẫn gốc đó. */
function dungGoc(env: string[] | null, profiles: Record<string, string[]>): string {
  const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'envscope-'));
  ghiPins(goc);
  if (env) fs.writeFileSync(path.join(goc, '.env'), env.map((k) => `${k}=${GIA_TRI}`).join('\n') + '\n', 'utf8');
  for (const [task, khoa] of Object.entries(profiles)) {
    const d = path.join(goc, 'profiles', task);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'task.env'), khoa.map((k) => `${k}=${GIA_TRI}`).join('\n') + '\n', 'utf8');
  }
  return goc;
}

async function chay(goc: string): Promise<{ code: number | null; out: string }> {
  return new Promise((ok) => {
    const p = spawn(process.execPath, [CUA, '--root', goc], { cwd: REPO, env: gateEnv() });
    let out = '';
    p.stdout.on('data', (x) => { out += String(x); });
    p.stderr.on('data', (x) => { out += String(x); });
    p.on('close', (code) => ok({ code, out }));
  });
}

/** Profile khai đủ: ghim cấp học (bắt buộc) + năm học (nên có). */
const DU = ['TASK_KEY', 'APP_SO', 'APP_TRUONG', 'APP_CAP_HOC', 'APP_NAM_HOC'];

test.describe.configure({ mode: 'default' });

test.describe('@infra env:scope — profile phải ghim cấp học nó đang đo', () => {
  test('ĐỐI CHỨNG DƯƠNG: thiếu `APP_CAP_HOC` ⇒ CHẶN, gọi tên task, và nêu mặc định "Cấp mặc định"', async () => {
    const goc = dungGoc(['OPS_USERNAME'], { 'TASK-1111': ['TASK_KEY', 'APP_SO', 'APP_TRUONG', 'APP_NAM_HOC'] });
    const r = await chay(goc);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('TASK-1111');
    expect(r.out, 'phải nói ra HẬU QUẢ, không chỉ nói "thiếu khoá" — hậu quả mới là lý do chặn')
      .toContain('Cấp mặc định');
  });

  /*
   * v3.0.0 — kit mang sang dự án KHÔNG phải app mẫu. Bản trước chặn mọi profile thiếu `APP_CAP_HOC`, nên ở dự án
   * khác task nào cũng đỏ ngay vì một biến của ứng dụng khác. Profile không khai khoá `APP_*` nào thì luật
   * cấp học không áp.
   */
  test('profile của dự án KHÁC (không khoá `APP_*` nào) ⇒ KHÔNG bị đòi `APP_CAP_HOC`', async () => {
    const goc = dungGoc(['OPS_USERNAME'], { 'SHOP-0001': ['TASK_KEY', 'BASE_URL'] });
    const r = await chay(goc);
    expect(r.code, r.out).toBe(0);
    expect(r.out).not.toContain('SHOP-0001 ');
  });

  test('ĐỐI CHỨNG ÂM: profile ghim đủ ⇒ ĐẠT', async () => {
    const goc = dungGoc(['OPS_USERNAME'], { 'TASK-1111': DU });
    const r = await chay(goc);
    expect(r.code, r.out).toBe(0);
  });

  /*
   * TỪNG TỐ OAN 7/8 PROFILE. Bản luật đầu của cửa bắt mỗi profile tự khai `OPS_USERNAME`/`OPS_PASSWORD`,
   * dựa trên câu "creds ở task.env" của CLAUDE.md §5. Chạy thật thì nó tố 7 trong 8 profile — mà một cửa
   * mới tố gần hết hiện trạng thì giả thuyết đầu tiên phải là CỬA SAI. Đo lại bằng `--soi`: cả 8 profile
   * đều ghim `APP_SO`+`APP_TRUONG`, và một tài khoản app mẫu đổi được đơn vị qua `/Manage/ChonDonVi.aspx`.
   * Nên `.env` giữ MỘT tài khoản chung là ĐÚNG thiết kế. Ca này ghim lại điều đó để luật cũ không bò về.
   */
  test('profile KHÔNG khai `OPS_USERNAME` mà `.env` có ⇒ ĐẠT, đó là thiết kế chứ không phải lệch', async () => {
    const goc = dungGoc(['OPS_USERNAME', 'OPS_PASSWORD'], { 'TASK-2222': DU });
    const r = await chay(goc);
    expect(r.code, r.out).toBe(0);
    expect(r.out, 'tố profile vì không tự khai tài khoản là tố oan 7/8 hiện trạng')
      .not.toContain('TASK-2222');
  });

  /*
   * PHÂN BIỆT NẶNG NHẸ. Thiếu `APP_CAP_HOC` là ÂM THẦM (app về "Cấp mặc định", chỉ `console.warn`). Thiếu
   * `APP_NAM_HOC` thì runtime cũng cảnh báo nhưng app giữ mặc định của chính nó. Gộp cả hai thành "đỏ"
   * là đánh đồng, và làm người ta tắt cửa.
   */
  test('thiếu `APP_NAM_HOC` ⇒ chỉ cảnh báo, KHÔNG chặn', async () => {
    const goc = dungGoc(['OPS_USERNAME'], { 'TASK-3333': ['TASK_KEY', 'APP_SO', 'APP_TRUONG', 'APP_CAP_HOC'] });
    const r = await chay(goc);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('TASK-3333');
    expect(r.out, 'phải nêu HẬU QUẢ khai trong context_pins, không chỉ nói "thiếu khoá"').toContain('giữ năm mặc định');
  });

  test('một profile hỏng KHÔNG che các profile còn lại, và profile đúng KHÔNG bị tố oan', async () => {
    const goc = dungGoc(['OPS_USERNAME'], {
      'TASK-4444': ['TASK_KEY', 'APP_SO'],
      'TASK-5555': ['TASK_KEY', 'APP_TRUONG'],
      'TASK-7777': DU,
    });
    const r = await chay(goc);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('TASK-4444');
    expect(r.out).toContain('TASK-5555');
    expect(r.out, 'profile ghim đủ thì KHÔNG được nhắc tới, dù là lỗi hay cảnh báo')
      .not.toContain('TASK-7777');
  });
});

test.describe('@infra env:scope — bí mật không đường nào đọc tới', () => {
  test('ĐỐI CHỨNG DƯƠNG: hậu tố `_USERNAME_ADMIN` không khớp khuôn client ⇒ CHẶN', async () => {
    const goc = dungGoc(['LIB_MASTER_DB_RO_USERNAME_ADMIN'], { 'TASK-1111': DU });
    const r = await chay(goc);
    expect(r.code, r.out).toBe(1);
    expect(r.out).toContain('LIB_MASTER_DB_RO_USERNAME_ADMIN');
    expect(r.out, 'phải nói vì sao nó vô dụng, không chỉ nói nó sai').toMatch(/không đường nào chạm tới/);
  });

  test('ĐỐI CHỨNG ÂM: hậu tố hợp lệ (`_SSL`, `_HOST`) KHÔNG bị tố oan', async () => {
    const goc = dungGoc(
      ['LIB_MASTER_DB_RO_HOST', 'LIB_MASTER_DB_RO_PORT', 'LIB_MASTER_DB_RO_SSL', 'LIB_MASTER_DB_RO_STATEMENT_TIMEOUT_MS'],
      { 'TASK-1111': DU },
    );
    const r = await chay(goc);
    expect(r.code, r.out).toBe(0);
  });
});

test.describe('@infra env:scope — không có gì để đo thì NÓI THẾ', () => {
  /*
   * Ca này là lý do cửa ⑩ của `version_check.js` từng làm `release:verify` đọc thành 13/15: trong cây-gói
   * phát hành không có `.env` lẫn `profiles/`, và một cửa trả "đạt" ở đó là khai một điều nó chưa đo.
   */
  test('gốc trống (như cây-gói phát hành) ⇒ exit 2 KHÔNG PHÁN ĐƯỢC, tuyệt đối không phải 0', async () => {
    const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'envscope-trong-'));
    const r = await chay(goc);
    expect(r.code, r.out).toBe(2);
    expect(r.out).toContain('KHÔNG PHÁN ĐƯỢC');
    expect(r.out, 'không được nói "đạt" khi chưa đo gì').not.toMatch(/✓ ĐẠT/);
  });

  test('`--root` trỏ vào chỗ không tồn tại ⇒ NÉM, không lùi về cây thật', async () => {
    const r = await chay(path.join(os.tmpdir(), 'envscope-khong-co-that-' + Date.now()));
    expect(r.code, r.out).toBe(2);
    expect(r.out, 'lùi về cây thật thì lượt đối chứng đo nhầm chỗ và phép thử tự rỗng')
      .toMatch(/không tồn tại|NÉM/);
  });
});

/*
 * CHỖ NỐI VÀO PREFLIGHT. `env:scope` quét cả repo nên không vào CI được (CI không có `.env` lẫn
 * `profiles/` ⇒ nó trả "KHÔNG PHÁN ĐƯỢC"). Nên luật phải có một chỗ THẬT SỰ bắn, và chỗ đó là
 * `preflight_gate.js --mode phase3`: chạy trên máy có profile, ngay trước execute, đã biết TASK_KEY.
 *
 * Không có nhóm ca này thì chỗ nối là code không ai gác: ai đó gỡ dòng gọi `kiemGhimCapHoc` ra khỏi
 * `runPreflight` thì mọi ca ở trên vẫn xanh, và cửa lặng lẽ thành đồ trang trí. Đúng khe đã ghi trong
 * `project_kit_phase1_gaps` ("gate không ai gọi").
 */
test.describe('@infra env:scope — luật phải có chỗ THẬT SỰ bắn, không chỉ có cửa rời', () => {
  const PREFLIGHT = mayThu('PREFLIGHT_JS', path.join(REPO, 'scripts/qa/preflight_gate.js'));
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pre = require(PREFLIGHT);

  function gocProfile(khoa: string[] | null): string {
    const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-cap-'));
    ghiPins(goc);
    if (khoa) {
      const d = path.join(goc, 'profiles', 'TASK-0001');
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, 'task.env'), khoa.map((k) => `${k}=${GIA_TRI}`).join('\n') + '\n', 'utf8');
    }
    return goc;
  }

  test('ĐỐI CHỨNG DƯƠNG: profile thiếu `APP_CAP_HOC` ⇒ preflight sinh CHẶN, không phải cảnh báo', () => {
    const kq = pre.kiemGhimCapHoc(gocProfile(['TASK_KEY', 'APP_SO']), 'TASK-0001');
    expect(kq.problems.length, 'thiếu ghim cấp phải là CHẶN').toBe(1);
    expect(kq.warnings.length, 'không được hạ xuống cảnh báo — cảnh báo thì không ai đọc').toBe(0);
    expect(kq.problems[0]).toContain('Cấp mặc định');
  });

  test('profile của dự án KHÁC (không khoá `APP_*` nào) ⇒ preflight KHÔNG chặn — v3.0.0', () => {
    const kq = pre.kiemGhimCapHoc(gocProfile(['TASK_KEY', 'BASE_URL']), 'SHOP-0001');
    expect(kq.problems, 'luật cấp học của app mẫu không được chặn task của ứng dụng khác').toEqual([]);
  });

  test('CHƯA khai context_pins.json ⇒ không luật ghim nào áp, kể cả profile có khoá giống biến ngữ cảnh — v3.0.0', () => {
    const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-khongpins-'));
    const d = path.join(goc, 'profiles', 'X-0001');
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'task.env'), ['TASK_KEY=x', 'APP_SO=y', ''].join('\n'), 'utf8');
    expect(pre.kiemGhimCapHoc(goc, 'X-0001').problems, 'kit vừa cài, chưa khai app nào ⇒ không được chặn').toEqual([]);
  });

  test('ĐỐI CHỨNG ÂM: profile có ghim ⇒ KHÔNG chặn, KHÔNG cảnh báo', () => {
    const kq = pre.kiemGhimCapHoc(gocProfile(['TASK_KEY', 'APP_CAP_HOC']), 'TASK-0001');
    expect(kq.problems.length, kq.problems.join(' · ')).toBe(0);
    expect(kq.warnings.length, kq.warnings.join(' · ')).toBe(0);
  });

  /*
   * KHAI RỖNG KHÔNG PHẢI LÀ KHAI. `APP_CAP_HOC=` để trống thì `isReal()` của opsLogin coi như chưa khai
   * và app vẫn về "Cấp mặc định" — nên regex phải đòi có GIÁ TRỊ (`=\s*\S`), không chỉ đòi có tên khoá.
   */
  test('`APP_CAP_HOC=` RỖNG vẫn là chưa ghim ⇒ CHẶN', () => {
    const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-rong-'));
    ghiPins(goc);
    const d = path.join(goc, 'profiles', 'TASK-0001');
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'task.env'), 'TASK_KEY=x\nAPP_CAP_HOC=\n', 'utf8');
    const kq = pre.kiemGhimCapHoc(goc, 'TASK-0001');
    expect(kq.problems.length, 'ô rỗng mà coi là đã khai thì app vẫn về "Cấp mặc định"').toBe(1);
  });

  test('không có profile ⇒ CẢNH BÁO "không kiểm được", KHÔNG tự coi là đạt', () => {
    const kq = pre.kiemGhimCapHoc(gocProfile(null), 'TASK-0001');
    expect(kq.problems.length).toBe(0);
    expect(kq.warnings.length, 'không đo được thì phải nói ra, không im lặng').toBe(1);
    expect(kq.warnings[0]).toContain('không kiểm được');
  });

  test('`runPreflight` CÓ gọi `kiemGhimCapHoc` — gỡ dòng gọi ra thì ca này đỏ', () => {
    const src = fs.readFileSync(PREFLIGHT, 'utf8');
    const than = src.slice(src.indexOf('function runPreflight'));
    expect(than, 'cửa CHẶN mà không ai gọi thì chỉ là đồ trang trí').toContain('kiemGhimCapHoc(');
  });
});

test.describe('@infra env:scope — chính cửa này không được rò', () => {
  /*
   * CA QUAN TRỌNG NHẤT. Một cửa có việc duy nhất là gác chỗ để bí mật mà lại in bí mật ra log CI thì nó
   * tự phản lại mục đích — và log CI thì ai có quyền đọc repo cũng xem được. Fixture cố ý nhét giá trị
   * vào MỌI khoá, kể cả khoá đang bị tố, để nếu cửa lỡ in giá trị thì ca này đỏ.
   */
  test('in TÊN khoá, KHÔNG BAO GIỜ in giá trị — kể cả ở khoá đang bị tố', async () => {
    const goc = dungGoc(
      ['OPS_USERNAME', 'OPS_PASSWORD', 'LIB_MASTER_DB_RO_PASSWORD_ADMIN'],
      { 'TASK-8888': ['TASK_KEY'] },
    );
    const r = await chay(goc);
    expect(r.code, r.out).toBe(1);
    expect(r.out, 'tên khoá thì PHẢI in — không nêu tên thì người đọc không sửa được')
      .toContain('LIB_MASTER_DB_RO_PASSWORD_ADMIN');
    expect(r.out, `giá trị TUYỆT ĐỐI không được lọt ra (tìm "${GIA_TRI}")`).not.toContain(GIA_TRI);
  });
});
