import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * VƯỢT QUA CÓ KIỂM SOÁT (v2.7.0 §A8).
 *
 * Đây là đường DUY NHẤT cố tình mở ra trong cả đợt v2.7.0, nên nó là chỗ dễ thành lỗ hổng nhất. Bộ test
 * này nặng hẳn về phần TỪ CHỐI, và test quan trọng nhất là: thử override một mã T0 thì vừa bị từ chối
 * VỪA không ghi được gì. Nửa vời ở đó — từ chối nhưng vẫn ghi — tạo ra một bản ghi nói "T0 đã được miễn",
 * và bản ghi đó sẽ được đọc lại sau như một tiền lệ.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const ov = require(path.join(REPO, 'scripts/qa/override.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const engine = require(path.join(REPO, 'scripts/qa/lib/gate_engine'));

const LY_DO = 'Bộ này cố ý 213 case thay vì 210: thêm 3 case ranh giới sau lượt rà BR-HS-004';

test.describe.configure({ mode: 'default' });

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ovr-'));

test.describe('@infra override — T0 KHÔNG có đường nào', () => {
  test('mã T0 ⇒ từ chối, VÀ không ghi file nào', () => {
    const d = tmpDir();
    const r = ov.tao({ taskKey: 'T-OV', ma: 'PII', tcIds: ['APP_HSTRUONG_TC_001'], lyDo: LY_DO, by: 'QA-Lead', dir: d });
    expect(r.ok).toBe(false);
    expect(r.tang).toBe('T0');
    expect(r.vi_sao).toContain('KHÔNG có cờ override nào');
    expect(fs.existsSync(d) ? fs.readdirSync(d) : [], 'T0 bị từ chối thì KHÔNG được để lại bản ghi nào').toEqual([]);
  });

  test('mọi mã T0 trong bộ mã đều bị từ chối — không có ngoại lệ nào', () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/gate_codes.json'), 'utf8'));
    const ds = (Array.isArray(cfg) ? cfg : cfg.codes).filter((x: { tang: string }) => x.tang === 'T0');
    expect(ds.length, 'phải có mã T0 để test này nói được gì').toBeGreaterThan(5);
    for (const m of ds) {
      const d = tmpDir();
      const r = ov.tao({ taskKey: 'T-OV', ma: m.code, tcIds: ['APP_HSTRUONG_TC_001'], lyDo: LY_DO, by: 'QA-Lead', dir: d });
      expect(r.ok, `${m.code} là T0 mà vẫn cho override`).toBe(false);
      expect(fs.readdirSync(d), `${m.code}: T0 mà vẫn ghi file`).toEqual([]);
    }
  });

  test('KHÔNG cờ nào trong source mở được nhánh T0', () => {
    /*
     * Phép kiểm cấu trúc: nhánh T0 phải `return` ngay, không có `if` nào bọc nó bằng một cờ. Một cờ
     * `--force` hay `--qa-approved` ở đó là cả §A8 mất nghĩa.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/override.js'), 'utf8');
    const i = src.indexOf("if (t.tang === 'T0')");
    expect(i, 'không thấy nhánh T0').toBeGreaterThan(0);
    const khoi = src.slice(i, i + 900);
    expect(khoi, 'nhánh T0 không được có cờ bỏ qua').not.toMatch(/force|qa-approved|allowT0|bypass/i);
    expect(khoi).toContain('return');
  });

  test('`check --override` với mã T0 ⇒ exit 1 và không ghi gì', () => {
    const goc = tmpDir();
    const r = spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/check.js'),
      '--task', 'T-OV', '--override', 'SQL_CAM', '--tc', 'APP_HSTRUONG_TC_001', '--reason', LY_DO, '--by', 'PO'],
    { cwd: REPO, encoding: 'utf8', env: { ...gateEnv(), PROJECT_OUTPUT_DIR: goc, TASK_KEY: 'T-OV' } });
    expect(r.status).toBe(1);
    expect(`${r.stderr}`).toContain('KHÔNG có cờ override nào');
  });
});

test.describe('@infra override — ba hàng rào còn lại', () => {
  test('THIẾU `--tc` ⇒ từ chối: không miễn cả một mã', () => {
    /*
     * Chỗ này siết chặt hơn §A8 đòi. Miễn cả một mã cho cả task nghĩa là tắt một phép kiểm bằng một
     * dòng, và lần sau có case MỚI vi phạm đúng mã đó thì nó cũng được miễn mà không ai khai.
     */
    const d = tmpDir();
    const r = ov.tao({ taskKey: 'T-OV', ma: 'QUY_MO', tcIds: [], lyDo: LY_DO, by: 'QA-Lead', dir: d });
    expect(r.ok).toBe(false);
    expect(r.vi_sao).toContain('khoanh theo CASE');
    expect(fs.readdirSync(d)).toEqual([]);
  });

  test('lý do NGẮN ⇒ từ chối', () => {
    const d = tmpDir();
    for (const ly of ['', 'ok', 'cần gấp']) {
      const r = ov.tao({ taskKey: 'T-OV', ma: 'QUY_MO', tcIds: ['APP_HSTRUONG_TC_001'], lyDo: ly, by: 'QA-Lead', dir: d });
      expect(r.ok, `"${ly}" không được tính là lý do`).toBe(false);
    }
    expect(fs.readdirSync(d)).toEqual([]);
  });

  test('vai trò LẠ ⇒ từ chối, và nêu ba vai trò hợp lệ', () => {
    const d = tmpDir();
    for (const by of ['QA', 'Intern', '', 'Dev']) {
      const r = ov.tao({ taskKey: 'T-OV', ma: 'QUY_MO', tcIds: ['APP_HSTRUONG_TC_001'], lyDo: LY_DO, by, dir: d });
      expect(r.ok, `"${by}" không được quyền miễn trừ`).toBe(false);
      expect(r.vi_sao).toContain('QA-Lead');
    }
    expect(fs.readdirSync(d)).toEqual([]);
  });

  test('TC ID SAI KHUÔN ⇒ từ chối — bản ghi không bao giờ khớp còn tệ hơn bị từ chối', () => {
    /*
     * MỘT LỖ THẬT, phát hiện lúc viết chính spec này. `gate_engine.tcIdTrong()` nhận TC ID theo khuôn
     * `<TIỀN TỐ>_TC_<số>`, nên `--tc TC_001` trần thì bản ghi VẪN ĐƯỢC GHI mà KHÔNG BAO GIỜ khớp
     * finding nào. Người ta tin là đã được che rồi đi tiếp — tệ hơn hẳn việc bị từ chối ngay.
     */
    const d = tmpDir();
    for (const tc of ['TC_001', 'tc_001', '001', 'APP-HSTRUONG-TC-001']) {
      const r = ov.tao({ taskKey: 'T-OV', ma: 'QUY_MO', tcIds: [tc], lyDo: LY_DO, by: 'PO', dir: d });
      expect(r.ok, `"${tc}" sai khuôn mà vẫn cho ghi`).toBe(false);
      expect(r.vi_sao).toContain('sai khuôn');
    }
    expect(fs.readdirSync(d)).toEqual([]);
    /* Và khuôn phải KHỚP với khuôn mà `gate_engine` dùng — không được có hai định nghĩa. */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/override.js'), 'utf8');
    const eng = fs.readFileSync(path.join(REPO, 'scripts/qa/lib/gate_engine.js'), 'utf8');
    const loi = '[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_TC_';
    expect(src).toContain(loi);
    expect(eng, 'khuôn phải lấy từ gate_engine, không tự định nghĩa lại').toContain(loi);
  });

  test('mã KHÔNG TỒN TẠI ⇒ từ chối', () => {
    const d = tmpDir();
    const r = ov.tao({ taskKey: 'T-OV', ma: 'MA_BIA_RA', tcIds: ['APP_HSTRUONG_TC_001'], lyDo: LY_DO, by: 'PO', dir: d });
    expect(r.ok).toBe(false);
    expect(r.vi_sao).toContain('không có trong');
    expect(fs.readdirSync(d)).toEqual([]);
  });

  test('`kiem()` chạy TRƯỚC khi chạm đĩa — mọi nhánh từ chối đều để thư mục rỗng', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/override.js'), 'utf8');
    const i = src.indexOf('function tao(');
    const j = src.indexOf('mkdirSync', i);
    const k = src.indexOf('const k = kiem(', i);
    expect(k, 'tao() phải gọi kiem()').toBeGreaterThan(0);
    expect(k, '`kiem()` phải chạy TRƯỚC `mkdirSync`').toBeLessThan(j);
  });
});

test.describe('@infra override — bản ghi: có hạn, khoanh case, hợp schema', () => {
  test('đủ điều kiện ⇒ ghi bản ghi, hết hạn sau 30 ngày', () => {
    const d = tmpDir();
    const r = ov.tao({ taskKey: 'T-OV', ma: 'QUY_MO', tcIds: ['APP_HSTRUONG_TC_001', 'APP_HSTRUONG_TC_002'], lyDo: LY_DO, by: 'QA-Lead', dir: d });
    expect(r.ok).toBe(true);
    const j = JSON.parse(fs.readFileSync(r.duong, 'utf8'));
    expect(j.scope.tc_ids).toEqual(['APP_HSTRUONG_TC_001', 'APP_HSTRUONG_TC_002']);
    expect(j.status).toBe('active');
    const ngay = (new Date(j.expires_at).getTime() - new Date(j.decided_at).getTime()) / 86400000;
    expect(Math.round(ngay)).toBe(30);
  });

  test('type là `test_approach`, KHÔNG phải `risk_override`', () => {
    /*
     * `risk_override` theo schema của `decisions.js` đòi `scope.modules` và mang nghĩa "QA đã hạ band
     * của một module". Miễn một mã gate cho vài case là quyết định về CÁCH TEST. Dùng sai type làm
     * `risk:score` đọc nó như một override band ở task sau.
     */
    const d = tmpDir();
    const r = ov.tao({ taskKey: 'T-OV', ma: 'QUY_MO', tcIds: ['APP_HSTRUONG_TC_001'], lyDo: LY_DO, by: 'PO', dir: d });
    const j = JSON.parse(fs.readFileSync(r.duong, 'utf8'));
    expect(j.type).toBe('test_approach');
  });

  test('bản ghi HỢP SCHEMA của `decisions.js`', () => {
    /* Ghi một bản ghi mà `decisions:check` bác là tạo nợ ở một sổ khác. */
    const d = tmpDir();
    ov.tao({ taskKey: 'T-OV', ma: 'QUY_MO', tcIds: ['APP_HSTRUONG_TC_001'], lyDo: LY_DO, by: 'QA-Lead', evidence: 'reports/scope_inventory.md', dir: d });
    const r = spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/decisions.js'), '--dir', d, '--enforce'],
      { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    expect(r.status, `decisions:check bác bản ghi: ${r.stdout}${r.stderr}`).toBe(0);
    expect(`${r.stdout}`).toContain('hợp schema');
  });

  test('`Dev-Lead` map sang `Dev` để khớp danh mục `decided_by` của sổ', () => {
    const d = tmpDir();
    const r = ov.tao({ taskKey: 'T-OV', ma: 'QUY_MO', tcIds: ['APP_HSTRUONG_TC_001'], lyDo: LY_DO, by: 'Dev-Lead', dir: d });
    expect(r.ok).toBe(true);
    expect(JSON.parse(fs.readFileSync(r.duong, 'utf8')).decided_by).toBe('Dev');
  });

  test('bản ghi nói rõ hết hạn thì phải quyết định MỚI, không sửa ngày', () => {
    const d = tmpDir();
    const r = ov.tao({ taskKey: 'T-OV', ma: 'QUY_MO', tcIds: ['APP_HSTRUONG_TC_001'], lyDo: LY_DO, by: 'PO', dir: d });
    const j = JSON.parse(fs.readFileSync(r.duong, 'utf8'));
    expect(String(j._het_han_thi_sao)).toContain('quyết định MỚI');
  });
});

test.describe('@infra override — hiệu lực tự hết, và khớp theo CẢ mã VÀ case', () => {
  test('HẾT HẠN thì thôi che, không cần ai dọn', () => {
    /*
     * Một miễn trừ chỉ hết tác dụng khi có người đi dọn là một miễn trừ VĨNH VIỄN trên thực tế.
     */
    const d = tmpDir();
    ov.tao({ taskKey: 'T-OV', ma: 'QUY_MO', tcIds: ['APP_HSTRUONG_TC_001'], lyDo: LY_DO, by: 'PO', hanNgay: 1, dir: d });
    expect(ov.dangHieuLuc('T-OV', { dir: d }).length).toBe(1);
    /* Giả hôm nay là 10 ngày sau. */
    const sau = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    expect(ov.dangHieuLuc('T-OV', { dir: d, homNay: sau }).length).toBe(0);
  });

  test('`status: superseded` thì thôi che', () => {
    const d = tmpDir();
    const r = ov.tao({ taskKey: 'T-OV', ma: 'QUY_MO', tcIds: ['APP_HSTRUONG_TC_001'], lyDo: LY_DO, by: 'PO', dir: d });
    const j = JSON.parse(fs.readFileSync(r.duong, 'utf8'));
    j.status = 'superseded';
    fs.writeFileSync(r.duong, JSON.stringify(j, null, 2), 'utf8');
    expect(ov.dangHieuLuc('T-OV', { dir: d }).length).toBe(0);
  });

  test('miễn trừ của task KHÁC không che task này', () => {
    const d = tmpDir();
    ov.tao({ taskKey: 'T-KHAC', ma: 'QUY_MO', tcIds: ['APP_HSTRUONG_TC_001'], lyDo: LY_DO, by: 'PO', dir: d });
    expect(ov.dangHieuLuc('T-OV', { dir: d }).length).toBe(0);
    expect(ov.dangHieuLuc('T-KHAC', { dir: d }).length).toBe(1);
  });

  test('khớp theo CẢ mã VÀ TC ID — cùng mã khác case thì KHÔNG che', () => {
    const mienTru = [{ ma: 'QUY_MO', tc_ids: ['APP_HSTRUONG_TC_001'], ly_do: LY_DO, by: 'PO', het_han: '2099-01-01', id: 'DEC-X-001' }];
    const findings = [
      { level: 'FAIL', message: 'APP_HSTRUONG_TC_001: số lượng vượt ngưỡng đã khai' },
      { level: 'FAIL', message: 'APP_HSTRUONG_TC_999: số lượng vượt ngưỡng đã khai' },
    ];
    const kq = ov.apDung(findings, mienTru, { maCua: engine.maCua, tcIdTrong: engine.tcIdTrong });
    expect(kq.da_vuot_qua.length, 'chỉ case được khoanh mới được che').toBe(1);
    expect(kq.con_lai.length).toBe(1);
    expect(kq.con_lai[0].message).toContain('TC_999');
  });

  test('finding không có TC ID thì KHÔNG bị che', () => {
    /* Không xác định được case thì không xác định được miễn trừ có áp cho nó hay không. */
    const mienTru = [{ ma: 'QUY_MO', tc_ids: ['APP_HSTRUONG_TC_001'], ly_do: LY_DO, by: 'PO', het_han: '2099-01-01', id: 'DEC-X-001' }];
    const findings = [{ level: 'FAIL', message: 'số lượng vượt ngưỡng đã khai' }];
    const kq = ov.apDung(findings, mienTru, { maCua: engine.maCua, tcIdTrong: engine.tcIdTrong });
    expect(kq.da_vuot_qua.length).toBe(0);
  });
});

test.describe('@infra override — hiện ra ở `check` và ở `release:summary`', () => {
  test('`check` in mục "ĐÃ VƯỢT QUA" và KHÔNG xoá finding', () => {
    /*
     * Chuyển mục, không xoá: con số vẫn in ra và cửa ra vẫn đọc được. Xoá hẳn thì miễn trừ thành vô
     * hình, và một thứ vô hình thì không ai rà lại.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/check.js'), 'utf8');
    expect(src).toContain('ĐÃ VƯỢT QUA');
    expect(src).toMatch(/KHÔNG xoá nó/);
    expect(src, 'và `--json` phải mang cả danh sách miễn trừ').toContain('mien_tru: mienTru');
  });

  test('thiếu lớp miễn trừ thì KHÔNG được che vi phạm', () => {
    /* Nhánh `catch` phải để nguyên findings, không được coi là "đã miễn hết". */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/check.js'), 'utf8');
    expect(src).toMatch(/thiếu lớp miễn trừ thì KHÔNG được che vi phạm/);
  });

  test('`release:summary` có mục "Đã vượt qua", và nói rõ khi KHÔNG đọc được sổ', () => {
    /*
     * Không có mục này thì miễn trừ thành vô hình ở đúng chỗ nó cần được thấy nhất. Và im lặng khi đọc
     * sổ lỗi còn tệ hơn: báo cáo khai "không có miễn trừ nào" trong khi nó chưa đọc được gì.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/release_summary.js'), 'utf8');
    expect(src).toContain('Đã vượt qua');
    expect(src).toMatch(/KHÔNG phải "không có miễn trừ nào"/);
    expect(src, 'và phải nói một tiêu chí đạt nhờ miễn trừ khác đạt thật').toMatch(/KHÁC một tiêu chí đạt thật/);
  });

  test('`release:summary` KHÔNG hạ đề xuất go/no-go vì miễn trừ', () => {
    /*
     * Miễn trừ là quyết định đã có người chịu trách nhiệm, nên hạ đề xuất vì nó là phủ quyết lại người
     * đã quyết. Nhưng nó phải CÓ MẶT trong báo cáo.
     */
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/release_summary.js'), 'utf8');
    expect(src).toMatch(/KHÔNG đổi đề xuất go\/no-go/);
  });

  test('CHEATSHEET nói đúng hai đường xin vượt qua, và nói T0 không có đường nào', () => {
    const cs = fs.readFileSync(path.join(REPO, 'docs/CHEATSHEET.md'), 'utf8');
    expect(cs).toContain('--override');
    expect(cs).toMatch(/Không có đường nào vượt T0/);
  });
});
