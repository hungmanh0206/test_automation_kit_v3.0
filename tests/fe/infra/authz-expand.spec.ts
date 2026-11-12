import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { gateEnv } from './_gate_env';
import { thuMucTam, donThuMucTam } from './_thu_muc_tam';

/*
 * Trục ⑥ `authz` — `scripts/qa/authz_expand.js`.
 *
 * Điều cần khoá KHÔNG phải "máy chạy được", mà là **máy không bao giờ báo đã phủ khi chưa đo**. Phân
 * quyền là chỗ dễ nhất để một báo cáo trông đầy đủ: mọi ô ghi "bị chặn" đọc rất yên tâm, kể cả khi chưa
 * ô nào được thử. Nên mỗi test dưới đây đều có một vế ÂM: thứ máy KHÔNG được kết luận.
 */

const REPO = path.resolve(__dirname, '..', '..', '..');
const node = process.execPath;
const MAY = path.join(REPO, 'scripts', 'qa', 'authz_expand.js');

type Ket = { ma: number; ra: string; bao: string };

function chay(tmp: string, them: string[] = []): Ket {
  const out = path.join(tmp, 'authz-expansion.md');
  let ma = 0;
  let ra = '';
  try {
    ra = execFileSync(node, [MAY, '--out', out, ...them], {
      cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      env: gateEnv({ TASK_KEY: 'DEMO-AUTHZ', PROJECT_OUTPUT_DIR: tmp }),
    });
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    ma = err.status ?? 1;
    ra = `${err.stdout || ''}${err.stderr || ''}`;
  }
  return { ma, ra, bao: fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '' };
}

/** Dựng một task giả: thư mục case + (tuỳ chọn) ma trận vai trò × route. */
function dungTask(tmp: string, o: { cases?: string; maTran?: unknown }): void {
  const d = path.join(tmp, 'tasks', 'DEMO-AUTHZ');
  fs.mkdirSync(path.join(d, 'test-cases'), { recursive: true });
  fs.mkdirSync(path.join(d, 'test-results'), { recursive: true });
  if (o.cases) fs.writeFileSync(path.join(d, 'test-cases', 'tc.md'), o.cases);
  if (o.maTran) fs.writeFileSync(path.join(d, 'test-results', 'roles.json'), JSON.stringify(o.maTran, null, 2));
}

/* Một bảng canonical tối thiểu: 1 case band HIGH (band high là band duy nhất đòi trục ⑥). */
const BANG = [
  '| ID | Module | Tiêu đề | Tiền điều kiện | Dữ liệu | Các bước | Kết quả mong đợi | Ưu tiên |',
  '|---|---|---|---|---|---|---|---|',
  '| TC-01 | Hồ sơ | Sửa hồ sơ trường | Đăng nhập bằng tài khoản `hieu_truong` | — | 1. Mở màn | 1. Lưu được | High |',
  '',
].join('\n');

const MA_TRAN = {
  roles: [
    { ten: 'hieu_truong', co_tai_khoan: true },
    { ten: 'giao_vien', co_tai_khoan: true },
    { ten: 'thanh_tra', co_tai_khoan: false },
  ],
  role_route_matrix: [
    { role: 'giao_vien', route: '/ho-so', quan_sat: 'bi_chan', muc_bang_chung: 'verified', vai_khac_thay: [] },
    { role: 'giao_vien', route: '/bao-cao', quan_sat: 'khong_ro', muc_bang_chung: 'unknown', vai_khac_thay: [] },
    { role: 'thanh_tra', route: '/ho-so', quan_sat: 'khong_co_tai_khoan', muc_bang_chung: 'unknown', vai_khac_thay: [] },
  ],
  expansion_findings: [
    { role: 'giao_vien', route: '/admin', vi_sao: 'ẩn khỏi menu giao_vien, hieu_truong thấy, mở thẳng URL thì vào được' },
  ],
};

let tmp = '';
test.beforeEach(() => { tmp = thuMucTam('authz'); });
test.afterEach(() => { donThuMucTam(tmp); });

test.describe('@infra trục ⑥ authz — liệt kê biến thể phân quyền', () => {
  test('THIẾU ma trận VÀ không khai luật ⇒ CHƯA ĐO (exit 2), KHÔNG phải "không có vấn đề"', () => {
    dungTask(tmp, { cases: BANG });
    /*
     * PHẢI trỏ config không tồn tại. Từ 14/10/2026 config mặc định
     * `requirements/authz_matrix.json` có khai `luat` (luật phân quyền CÓ NEO), nên thiếu ma trận
     * KHÔNG còn là "không đo được gì" — xem test ngay dưới. Chỉ khi thiếu CẢ HAI thì mới là CHƯA ĐO.
     */
    const k = chay(tmp, ['--config', path.join(tmp, 'khong-ton-tai.json')]);

    /* exit 2, không phải 0 và cũng không phải 1: "không phán được" có mã riêng của nó. */
    expect(k.ma, 'thiếu đầu vào là KHÔNG PHÁN ĐƯỢC, không phải đạt và cũng không phải sai').toBe(2);
    expect(k.bao).toContain('<!-- gate: proven=0');
    expect(k.bao).toContain('CHƯA ĐO ĐƯỢC');
    /* VẾ ÂM — chỗ nguy hiểm nhất: một báo cáo rỗng đọc thành một báo cáo sạch. */
    expect(k.bao, 'proven=0 KHÔNG được kể như đã kiểm').not.toMatch(/không có vấn đề|đạt|an toàn|OK\b/i);
    expect(k.bao).toContain('KHÔNG có nghĩa "phân quyền ổn"');
    expect(k.ra, 'phải chỉ ra chạy gì để đo được').toContain('discover');
  });

  test('có LUẬT CÓ NEO thì thiếu ma trận chỉ chặn nhóm DỌC — ngang/ẩn≠cấm vẫn liệt kê được', () => {
    /*
     * Thiết kế v2.8.1 bắt cả ba nhóm chờ ma trận, tức chờ ≥2 tài khoản. Đo 14/10/2026 trên
     * `knowledge/domain`: `BR-NHANSU-029` (đổi `id` sang đơn vị khác · `isview=1→0` · URL popup chưa
     * đăng nhập) và `BR-HSLOP-025` (tài khoản gán một phân hiệu) đều đo được bằng MỘT tài khoản.
     * Bắt cả ba nhóm chờ ma trận nghĩa là một dự án một-vai-trò không bao giờ đo được phân quyền.
     */
    dungTask(tmp, { cases: BANG });
    const cfg = path.join(tmp, 'authz.json');
    fs.writeFileSync(cfg, JSON.stringify({
      luat: [
        { oracle_ref: 'BR-NHANSU-029', nhom: 'ngang', can_vai_tro: 1, mo_ta: 'đổi id sang đơn vị khác phải bị từ chối' },
        { oracle_ref: 'BR-HSLOP-025', nhom: 'doc', can_vai_tro: 2, mo_ta: 'vai trò không có quyền quản trị phải bị chặn' },
      ],
    }));
    const k = chay(tmp, ['--config', cfg]);

    expect(k.ma, 'có luật có neo thì KHÔNG còn là không-phán-được').toBe(0);
    expect(k.bao, 'biến thể phải HIỆN RA, không bị ẩn sau mục CHƯA ĐO').toMatch(/\| ngang \|/);
    expect(k.bao).toContain('BR-NHANSU-029');
    /* Nhóm dọc đòi 2 vai trò mà chỉ có 1 ⇒ `needs_account`, KHÔNG phải `unknown` chung chung. */
    expect(k.bao).toMatch(/\| doc \|[^|]*\|[^|]*\|[^|]*\| needs_account \|/);
    /* Dòng cảnh báo đi ra stderr, mà `chay()` chỉ gom stderr khi exit != 0 — nên khoá ở BÁO CÁO. */
    expect(k.bao, 'phải nói rõ thiếu ma trận chỉ chặn nhóm dọc').toMatch(/Nhóm DỌC/);
  });

  test('KHÔNG khai `thu_bac` ⇒ không tự xếp hạng vai trò, và nói thẳng là chưa phủ chiều dọc', () => {
    dungTask(tmp, { cases: BANG, maTran: MA_TRAN });
    const k = chay(tmp, ['--config', path.join(tmp, 'khong-co.json')]);

    expect(k.ma).toBe(0);
    /*
     * Tiền đề của thiết kế ("mỗi vai trò THẤP HƠN") bị bác khi đo: repo không khai thứ bậc ở đâu cả.
     * Máy vẫn liệt kê biến thể, nhưng phải gọi đúng tên nhóm — `doc_chua_xep_hang`, không phải `doc`.
     */
    expect(k.bao).toContain('doc_chua_xep_hang');
    expect(k.bao, 'không được in ra như đã phủ chiều dọc').not.toMatch(/\| doc \|/);
    expect(k.bao).toMatch(/Khai `thu_bac`/);
  });

  test('khai `thu_bac` ⇒ chỉ sinh biến thể cho vai trò THẤP HƠN, không sinh cho vai trò cao hơn', () => {
    dungTask(tmp, { cases: BANG, maTran: MA_TRAN });
    const cfg = path.join(tmp, 'authz_matrix.json');
    fs.writeFileSync(cfg, JSON.stringify({ thu_bac: ['hieu_truong', 'giao_vien', 'thanh_tra'] }));
    const k = chay(tmp, ['--config', cfg]);

    expect(k.ma).toBe(0);
    expect(k.bao).toMatch(/\| doc \| TC-01 \| giao_vien/);
    expect(k.bao).toMatch(/\| doc \| TC-01 \| thanh_tra/);
    /* VẾ ÂM: `hieu_truong` là vai trò của chính case — không có biến thể "leo lên chính mình". */
    expect(k.bao, 'không sinh biến thể dọc cho vai trò của chính case').not.toMatch(/\| doc \| TC-01 \| hieu_truong/);
  });

  test('ô `unknown` và `needs_account` KHÔNG tính vào `proven`', () => {
    dungTask(tmp, { cases: BANG, maTran: MA_TRAN });
    const cfg = path.join(tmp, 'authz_matrix.json');
    fs.writeFileSync(cfg, JSON.stringify({ thu_bac: ['hieu_truong', 'giao_vien', 'thanh_tra'] }));
    const k = chay(tmp, ['--config', cfg]);

    const m = k.bao.match(/proven=(\d+) inconclusive=(\d+)/);
    expect(m, 'báo cáo phải có dòng máy đọc được').toBeTruthy();
    const proven = Number(m![1]);
    const inconclusive = Number(m![2]);

    /*
     * CHỈ MỘT bằng chứng: EXPANSION_FINDING ẩn≠cấm. Ô `verified` KHÔNG tính (đổi 14/10/2026) — nó chỉ
     * nói "vai trò này vào được route này", chưa so với kỳ vọng nào. Trên TASK-9001 cách tính cũ cho
     * `proven=2880` cho một ma trận chưa ô nào được so — tức báo đã chứng minh 2880 thứ chưa ai so.
     */
    expect(proven, 'chỉ finding ẩn≠cấm là bằng chứng; ô verified là QUAN SÁT').toBe(1);
    expect(inconclusive, 'phần còn lại phải nằm ở cột chưa kết luận, không bị nuốt').toBeGreaterThan(0);
    expect(k.bao).toContain('needs_account');
    expect(k.bao).toMatch(/Xin tài khoản vai trò `thanh_tra`/);
  });

  test('ẩn ≠ cấm ⇒ FAIL, và `--enforce` chặn', () => {
    dungTask(tmp, { cases: BANG, maTran: MA_TRAN });
    const cfg = path.join(tmp, 'authz_matrix.json');
    fs.writeFileSync(cfg, JSON.stringify({ thu_bac: ['hieu_truong', 'giao_vien', 'thanh_tra'] }));

    expect(chay(tmp, ['--config', cfg]).ma, 'không có --enforce thì chỉ báo cáo').toBe(0);
    const k = chay(tmp, ['--config', cfg, '--enforce']);
    expect(k.ma, '--enforce phải chặn khi có leo thang quyền').toBe(1);
    expect(k.bao).toMatch(/\| an_khac_cam \|.*\| fail \|/);
  });

  test('biến thể GHI được liệt kê nhưng KHÔNG tự chạy — và máy không gửi request nào', () => {
    dungTask(tmp, { cases: BANG, maTran: MA_TRAN });
    const cfg = path.join(tmp, 'authz_matrix.json');
    fs.writeFileSync(cfg, JSON.stringify({ thu_bac: ['hieu_truong', 'giao_vien', 'thanh_tra'] }));
    const k = chay(tmp, ['--config', cfg]);

    expect(k.bao).toMatch(/\| ghi \|.*\| chi_chay_tay \|/);
    /*
     * Khoá theo HƯỚNG, không theo một chuỗi: máy này không được phép mở mạng. Ngày nào ai thêm `fetch`,
     * `axios`, `http.request` hay `page.goto` vào đây là ngày test này đỏ — vì gửi một request GHI để
     * thử 403 nghĩa là NẾU phân quyền hỏng thì đã ghi thật vào UAT.
     */
    const src = fs.readFileSync(MAY, 'utf8').replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');
    expect(src, 'máy LIỆT KÊ không được tự gửi request').not.toMatch(/\bfetch\s*\(|require\(['"](?:http|https|axios|node-fetch)['"]\)|page\.goto/);
  });
});
