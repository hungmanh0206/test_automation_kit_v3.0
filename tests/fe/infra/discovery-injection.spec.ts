import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { chromium, Browser } from '@playwright/test';
import { gateEnv } from './_gate_env';

/*
 * @infra — BẢN ĐỒ ĐIỂM NHẬP + ORACLE + GATE PHỦ INJECTION (v2.6.0 §A9).
 *
 * LÝ DO RIÊNG CHO DỰ ÁN NÀY: back-end là SQL Server và tài khoản có quyền `dbo`, nên một lỗ injection lọt
 * là rủi ro dữ liệu THẬT. Mục tiêu là kiểm chứng ứng dụng xử lý input đúng cách (tham số hoá / escape /
 * từ chối). KIT KIỂM *ỨNG DỤNG CÓ CHẶN INJECTION KHÔNG*, KIT KHÔNG TỰ INJECTION VÀO DB.
 *
 * CHỖ GATE CŨ HỞ, và đây là lý do cả hạng mục tồn tại: chiều security của `dim:coverage` chấm bằng REGEX
 * TRÊN VĂN BẢN — một case chỉ cần CHỨA CHỮ "injection" là chiều đó tính như đã phủ. Nghĩa là một bộ 300
 * case có đúng một case tên "[Security] Kiểm injection ô tìm kiếm" thì gate im lặng, trong khi năm đường
 * vào khác không ai thử.
 */
const FXDIR = path.resolve(__dirname, '..', 'fixtures', 'discovery-app');
const DIR = path.resolve(__dirname, '..', '..', '..', 'scripts', 'qa', 'discovery');
const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fixture = require(path.join(FXDIR, 'server.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const is = require(path.join(DIR, 'injection_surface.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cr = require(path.join(DIR, 'crawl.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ai = require(path.join(DIR, 'api_inventory.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fw = require(path.join(DIR, 'write_firewall.js'));

type Diem = { id: string; nhom: string; o: string; uu_tien: string; muc_bang_chung: string; diem: string; vi_sao: string; kieu_khai_bao: string };
type BeMat = { id_be_mat: string; nhom: string; o: string; uu_tien: string; muc_bang_chung: string; so_diem_nhap: number; diem_nhap_id: string[] };

let srv: { url: string; close(): Promise<void> };
let br: Browser;
test.beforeAll(async () => { srv = await fixture.start(); br = await chromium.launch(); });
test.afterAll(async () => { await br.close(); await srv.close(); });

let memo: Promise<Record<string, unknown>> | null = null;
function banDo() {
  if (memo) return memo;
  memo = (async () => {
    let rec: ReturnType<typeof ai.theoDoi> | null = null;
    const goc = br.newPage.bind(br);
    (br as unknown as { newPage: unknown }).newPage = async (...a: unknown[]) => {
      const pg = await (goc as (...x: unknown[]) => Promise<unknown>)(...a);
      rec = ai.theoDoi(pg);
      return pg;
    };
    try {
      const crawl = await cr.boApp(br, { baseUrl: srv.url, coCo: true, doTre: 0, get apiRec() { return rec; } });
      const api = ai.tongHop(rec, { openapiPath: path.join(FXDIR, 'openapi.json') });
      return is.lietKe({ crawl, api });
    } finally { (br as unknown as { newPage: unknown }).newPage = goc; }
  })();
  return memo;
}

test.describe('@infra liệt kê điểm nhập — máy nhớ, không để người nhớ', () => {
  test('`sort` là `critical`, và lý do nêu đúng cơ chế', async () => {
    /*
     * `ORDER BY` là chỗ khó tham số hoá nhất: thư viện ORM nhận tham số cho GIÁ TRỊ nhưng không nhận cho
     * TÊN CỘT, nên đường sort hay bị ghép chuỗi. Xếp nó ngang `import_file` chứ không xếp dưới ô tìm kiếm.
     */
    const m = await banDo();
    const s = (m.diem_nhap as Diem[]).find((x) => x.nhom === 'sort')!;
    expect(s.uu_tien).toBe('critical');
    expect(s.muc_bang_chung).toBe('observed');
    expect(s.vi_sao).toMatch(/không nhận cho TÊN CỘT/);
  });

  test('phủ đủ các nhóm dự án hay bỏ sót', async () => {
    const m = await banDo();
    const nhom = new Set((m.diem_nhap as Diem[]).map((x) => x.nhom));
    for (const n of ['sort', 'search', 'filter', 'import_file', 'export_filter', 'second_order']) {
      expect(nhom, `thiếu nhóm ${n}`).toContain(n);
    }
  });

  test('`api_body` phải là `inferred` — tường lửa chặn nên KHÔNG quan sát được payload', async () => {
    /*
     * Đây là chỗ một bảng "observed" giả sẽ khiến gate chặn dựa trên phỏng đoán. Lượt bò không kích hoạt
     * đường ghi, nên trên fixture nhóm này rỗng; phép kiểm đi trực tiếp vào hàm với một endpoint ghi.
     */
    const m = is.lietKe({
      crawl: { screens: [] },
      api: { apis: [{ method: 'POST', path_chuan: '/api/truong', query_thay: [], hinh_dang: {}, goi_tu: ['/them-truong'] }] },
    });
    const b = (m.diem_nhap as Diem[]).find((x) => x.nhom === 'api_body')!;
    expect(b.muc_bang_chung).toBe('inferred');
    expect(b.vi_sao).toMatch(/KHÔNG quan sát được payload/);
  });

  test('`second_order` là proxy CẤU TRÚC, và nói rõ nó bỏ sót gì', async () => {
    /*
     * Kit không lưu giá trị (luật PII) nên không so được giá trị. Proxy là trùng TÊN TRƯỜNG giữa hai màn.
     * Nó bỏ sót đúng ca khó nhất: tên khác nhau giữa hai màn. Phải nói ra thay vì vờ như đủ.
     */
    const m = await banDo();
    const so = (m.diem_nhap as Diem[]).filter((x) => x.nhom === 'second_order');
    expect(so.length).toBeGreaterThan(0);
    for (const x of so) {
      expect(x.muc_bang_chung).toBe('inferred');
      expect(x.vi_sao).toMatch(/Proxy CẤU TRÚC/);
      expect(x.vi_sao).toMatch(/Bỏ sót ca tên khác nhau/);
    }
  });

  test('ô của form THÊM MỚI KHÔNG phải điểm nhập vào truy vấn', async () => {
    /*
     * Bản đầu nhận mọi ô `date_range` bất kể màn nào, và ra hai dòng sai: "Khoảng ngày — từ/đến" trên
     * `/them-truong` — ô của form thêm mới, giá trị đi vào INSERT chứ không vào điều kiện SELECT. Ô form
     * vẫn injectable qua INSERT, nhưng đó là chuyện của chiều [Validation]/[DbPersist]; trộn hai thứ là
     * làm cả hai mờ đi, và nó làm bảng nở ra bằng mọi ô ngày của mọi form.
     */
    const m = await banDo();
    const tren = (m.diem_nhap as Diem[]).filter((x) => x.o === '/them-truong');
    expect(tren.map((x) => x.nhom), 'chỉ còn ô upload').toEqual(['import_file']);
    expect(tren.map((x) => x.nhom)).not.toContain('date_range');
  });

  test('câu hỏi Ambiguity cho điểm nhập chưa biết kiểu khai báo — KHÔNG tự đoán', async () => {
    /* "Sort nhận cột tự do hay enum" là thứ phải hỏi; câu trả lời quyết định PASS/FAIL hay `N/A`. */
    const m = await banDo();
    const q = m.cau_hoi_ambiguity as { muc: string; cau_hoi: string; vi_sao: string }[];
    expect(q.length).toBeGreaterThan(0);
    expect(q.some((x) => x.muc === 'Critical'), 'bề mặt critical phải ra câu hỏi Critical').toBe(true);
    expect(q[0].vi_sao).toMatch(/Tự đoán là tự đặt expected/);
  });

  test('nói rõ ranh giới: kit KHÔNG tự injection vào DB', async () => {
    const m = await banDo();
    expect(String(m._kit_khong_injection_vao_db)).toMatch(/KHÔNG tự injection vào DB/);
    expect(String(m._kit_khong_injection_vao_db)).toMatch(/CHỈ-ĐỌC/);
    const src = fs.readFileSync(path.join(DIR, 'injection_surface.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
    for (const xau of ['fetch(', 'axios', 'page.goto', 'uatDbClient', 'mssql', 'sql.connect']) {
      expect(src, `mã nguồn chứa "${xau}" — file này không gửi request và không nối DB`).not.toContain(xau);
    }
  });
});

test.describe('@infra gộp bề mặt — để gate không bị tắt vì chặn oan', () => {
  test('gộp theo `(nhóm, màn)`: 11 điểm nhập ⇒ 9 bề mặt ⇒ 6 cần case', async () => {
    /*
     * Con số này là lý do của phép gộp. Fixture chỉ 6 màn mà đã 10/11 điểm nhập ưu tiên cao; một app thật
     * 342 module thì lên hàng trăm, và gate đòi mỗi Ô một case sẽ chặn mọi bộ testcase. Gate chặn oan thì
     * người ta tắt gate.
     */
    const m = await banDo();
    const t = m.tong as Record<string, number>;
    expect(t.tong).toBe(11);
    expect(t.be_mat).toBe(9);
    expect(t.be_mat_can_case).toBe(6);
    expect(t.be_mat).toBeLessThan(t.tong);
  });

  test('ba ô lọc cùng một lưới ⇒ MỘT bề mặt', async () => {
    const m = await banDo();
    const bm = (m.be_mat as BeMat[]).find((x) => x.nhom === 'filter' && x.o === '/bao-cao')!;
    expect(bm.so_diem_nhap).toBe(2);
    expect(bm.diem_nhap_id.length).toBe(2);
  });

  test('bề mặt lấy mức bằng chứng TỐT NHẤT trong nhóm', async () => {
    /* Một ô quan sát được thì cả đường đó quan sát được — không hạ cả bề mặt xuống vì một dòng suy diễn. */
    const m = is.lietKe({
      crawl: {
        screens: [{
          route: '/x',
          components: ['filter'],
          fields: [{ nhan: 'Tìm kiếm', ten_truong: 'q', code_loai: 'text' }],
        }],
      },
      api: { apis: [] },
    });
    const bm = (m.be_mat as BeMat[])[0];
    expect(bm.muc_bang_chung).toBe('observed');
  });

  test('CHỈ `observed` mới vào `be_mat_can_case`', async () => {
    const m = await banDo();
    const can = (m.be_mat as BeMat[]).filter((b) => b.muc_bang_chung === 'observed' && ['critical', 'high'].includes(b.uu_tien));
    expect(can.length).toBe((m.tong as Record<string, number>).be_mat_can_case);
    for (const b of can) expect(b.muc_bang_chung).toBe('observed');
  });
});

test.describe('@infra oracle A9.3 — bốn dấu hiệu quan sát được, KHÔNG nhận app==app', () => {
  test('lộ thông báo lỗi tầng dữ liệu ⇒ FAIL, một mình là đủ', async () => {
    /*
     * Dùng đúng chuỗi mà fixture `GET /api/loi-sql` trả về. Thông báo lỗi DB lọt ra ngoài đã là lỗ thông
     * tin, bất kể có inject được hay không — nên không cần dấu hiệu nào khác.
     */
    const r = is.chamOracle({ status: 500, body: "Unclosed quotation mark after the character string ''. Incorrect syntax near 'DM_TRUONG'." });
    expect(r.verdict).toBe('FAIL');
    expect(r.dau_hieu_khop).toContain('unclosed quotation mark');
    expect(r.vi_sao).toMatch(/lỗ thông tin/);
  });

  test('chạy THẬT trên fixture: endpoint để lọt lỗi ⇒ oracle bắt được', async () => {
    /*
     * Mock TĨNH — không có DB nào phía sau, không câu lệnh nào chạy. Fixture trả nguyên văn một chuỗi
     * kiểu SQL Server khi thấy dấu nháy, đúng loại chuỗi từ điển phải nhận ra. Payload là MỘT DẤU NHÁY
     * ĐƠN: vô hại, chỉ để quan sát.
     */
    const pg = await br.newPage();
    await fw.install(pg);
    const resp = await pg.goto(`${srv.url}/api/loi-sql?q=${encodeURIComponent("'")}`);
    const body = await resp!.text();
    await pg.close();
    const r = is.chamOracle({ status: resp!.status(), body });
    expect(r.verdict).toBe('FAIL');
  });

  test('ÂM BẢN trên fixture: input thường ⇒ KHÔNG ra FAIL', async () => {
    const pg = await br.newPage();
    await fw.install(pg);
    const resp = await pg.goto(`${srv.url}/api/loi-sql?q=binh-thuong`);
    const body = await resp!.text();
    await pg.close();
    expect(is.chamOracle({ status: resp!.status(), body }).verdict).not.toBe('FAIL');
  });

  test('cặp điều kiện đúng/sai: KHÁC kết quả ⇒ FAIL, CÙNG kết quả ⇒ PASS', async () => {
    expect(is.chamOracle({ status: 200, body: '{}', ket_qua_dieu_kien_dung: { n: 5 }, ket_qua_dieu_kien_sai: { n: 0 } }).verdict).toBe('FAIL');
    expect(is.chamOracle({ status: 200, body: '{}', ket_qua_dieu_kien_dung: { n: 0 }, ket_qua_dieu_kien_sai: { n: 0 } }).verdict).toBe('PASS');
  });

  test('giá trị hiển thị lại bị CẮT tại dấu nháy ⇒ FAIL', async () => {
    const r = is.chamOracle({ status: 200, body: '{}', gia_tri_nhap: "Tru'ong", hien_thi_lai: 'Tru' });
    expect(r.verdict).toBe('FAIL');
    expect(r.vi_sao).toMatch(/escape sai/);
  });

  test('CHỈ dấu hiệu THỤ ĐỘNG ⇒ OBSERVATION, KHÔNG thành PASS', async () => {
    /*
     * Chỗ dễ sinh PASS giả nhất. "Không 500 và không lộ lỗi" là hai dấu hiệu thụ động — một endpoint trả
     * 200 rỗng cũng qua được cả hai mà không chứng minh gì về cách xử lý input. "Không phán được" KHÔNG
     * thành PASS (CLAUDE.md §3).
     */
    const r = is.chamOracle({ status: 200, body: '{}' });
    expect(r.verdict).toBe('OBSERVATION');
    expect(r.can_them.length).toBeGreaterThan(0);
    expect(r.vi_sao).toMatch(/200 rỗng cũng qua được/);
  });

  test('từ điển dấu hiệu nằm trong CONFIG, không trong code', async () => {
    /* Để `dim:coverage` và oracle đọc CÙNG một nguồn; thêm DBMS khác thì thêm vào config. */
    const cfg = fw.napCfg();
    expect(cfg.dau_hieu_loi_sql.length).toBeGreaterThan(10);
    expect(cfg._dau_hieu_rieng_sql_server).toMatch(/SQL Server/);
    const src = fs.readFileSync(path.join(DIR, 'injection_surface.js'), 'utf8');
    expect(src, 'không đóng cứng dấu hiệu vào code').not.toContain('incorrect syntax near');
  });
});

test.describe('@infra gate phủ injection (A9.2) — thay regex đếm chữ', () => {
  const DC = path.join(REPO, 'scripts/qa/dimension_coverage.js');

  /** Dựng một task tạm: bộ TC, manifest, và bản đồ bề mặt. */
  function taskTam(o: { beMat?: unknown[] | null; khai?: Record<string, string>; lyDo?: Record<string, string> }) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'injgate-'));
    const task = path.join(d, 'tasks', 'T1');
    fs.mkdirSync(path.join(task, 'requirements'), { recursive: true });
    fs.mkdirSync(path.join(task, 'test-cases'), { recursive: true });
    fs.writeFileSync(path.join(task, 'test-cases', 'bo.md'), [
      '| TC ID | Module | Trường hợp kiểm thử | Tag | Các bước | Kết quả mong đợi |',
      '|---|---|---|---|---|---|',
      '| T_001 | Trường / Lưới | [Security] Kiểm injection ô sort | [Security] | 1. Mở | 1. Không lộ lỗi |',
      '| T_002 | Trường / Lưới | [Positive] Xem lưới | [Positive] | 1. Mở | 1. Hiện |',
    ].join('\n'), 'utf8');
    if (o.beMat !== null) {
      fs.writeFileSync(path.join(task, 'requirements', 'injection_surface.json'),
        JSON.stringify({ be_mat: o.beMat || [] }), 'utf8');
    }
    const man: Record<string, unknown> = { dimensions: { security: 'required' } };
    if (o.khai) man.injection_surfaces = o.khai;
    if (o.lyDo) man.na_reasons = o.lyDo;
    fs.writeFileSync(path.join(task, 'requirements', 'dimension_manifest.json'), JSON.stringify(man), 'utf8');
    return { d, pod: d };
  }

  function chay(t: { pod: string }, enforce = true) {
    const r = spawnSync(process.execPath, [DC, ...(enforce ? ['--enforce'] : [])], {
      cwd: REPO, encoding: 'utf8',
      env: { ...gateEnv(), PROJECT_OUTPUT_DIR: t.pod, TASK_KEY: 'T1' },
    });
    return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
  }

  const BM = (over: Record<string, unknown> = {}) => ({
    id_be_mat: 'BM-001', nhom: 'sort', o: '/api/truong', uu_tien: 'critical',
    muc_bang_chung: 'observed', so_diem_nhap: 1, diem_nhap_id: ['IS-001'], ...over,
  });

  test('CHƯA có bản đồ ⇒ nói "CHƯA ĐƯỢC GÁC", KHÔNG in ĐẠT', () => {
    /* Hai tầng. Task chưa chạy Bước 0 thì không có gì để gác — và "không phán được" không thành "đạt". */
    const t = taskTam({ beMat: null });
    const r = chay(t, false);
    expect(r.out).toMatch(/CHƯA ĐƯỢC GÁC theo bản đồ injection/);
    expect(r.out, 'và nói rõ chỗ hở của cách chấm cũ').toMatch(/CHỨA CHỮ "injection" là đủ qua/);
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('có bề mặt ưu tiên cao mà manifest chưa khai ⇒ CHẶN, kèm khuôn để điền', () => {
    const t = taskTam({ beMat: [BM()] });
    const r = chay(t);
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/chưa có khối `injection_surfaces`/);
    expect(r.out, 'phải đưa khuôn, không chỉ báo lỗi').toMatch(/"sort@\/api\/truong"/);
    expect(r.out, 'và liệt kê đúng bề mặt còn thiếu').toMatch(/sort@\/api\/truong\s+\(critical/);
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('khai TC ID có thật ⇒ ĐI QUA', () => {
    const t = taskTam({ beMat: [BM()], khai: { 'sort@/api/truong': 'T_001' } });
    const r = chay(t);
    expect(r.out).toMatch(/bản đồ injection: 1\/1 bề mặt/);
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('khai TC ID KHÔNG tồn tại ⇒ CHẶN — lời khai rỗng không được tính', () => {
    const t = taskTam({ beMat: [BM()], khai: { 'sort@/api/truong': 'T_999' } });
    const r = chay(t);
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/KHÔNG có trong bộ testcase canonical/);
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('khai `n/a` CÓ lý do ⇒ đi qua; `n/a` KHÔNG lý do ⇒ CHẶN', () => {
    const co = taskTam({
      beMat: [BM()], khai: { 'sort@/api/truong': 'n/a' },
      lyDo: { 'sort@/api/truong': 'cột sort là enum cố định phía server, không nhận chuỗi tự do' },
    });
    expect(chay(co).out).toMatch(/1\/1 bề mặt/);
    fs.rmSync(co.d, { recursive: true, force: true });

    const khong = taskTam({ beMat: [BM()], khai: { 'sort@/api/truong': 'n/a' } });
    const r = chay(khong);
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/n\/a không lý do là thu hẹp phạm vi/);
    fs.rmSync(khong.d, { recursive: true, force: true });
  });

  /*
   * ASSERT THEO THÔNG BÁO, KHÔNG THEO EXIT CODE, cho hai ca dưới.
   *
   * Bản đầu của hai test này đòi `exit 0` và cùng đỏ. Đo lại thì gate chặn vì một phép kiểm KHÁC:
   * "1 chiều bắt buộc DƯỚI NGƯỠNG (band UNKNOWN ⇒ ≥3 case/chiều)" — task tạm chỉ có 2 case. Tức exit
   * code là tín hiệu GỘP của cả `dim:coverage`, nên nó không đo được riêng phần injection. Dùng exit code
   * ở đây là tự tạo một phép kiểm luôn đỏ vì lý do không liên quan.
   */
  test('bề mặt `inferred` KHÔNG bắt buộc có case — chặn theo phỏng đoán là chặn oan', () => {
    const t = taskTam({ beMat: [BM({ muc_bang_chung: 'inferred' })] });
    const r = chay(t);
    expect(r.out).toMatch(/0 bề mặt ưu tiên cao quan sát được/);
    expect(r.out, 'KHÔNG được có dòng chặn nào về bản đồ injection').not.toMatch(/bề mặt injection `/);
    expect(r.out).not.toMatch(/chưa có khối `injection_surfaces`/);
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('bề mặt `medium` KHÔNG bắt buộc', () => {
    const t = taskTam({ beMat: [BM({ uu_tien: 'medium' })] });
    const r = chay(t);
    expect(r.out).toMatch(/0 bề mặt ưu tiên cao quan sát được/);
    expect(r.out).not.toMatch(/bề mặt injection `/);
    fs.rmSync(t.d, { recursive: true, force: true });
  });

  test('khai security `n/a` trái bản đồ ⇒ XUNG ĐỘT ARTIFACT, chặn', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'injgate-'));
    const task = path.join(d, 'tasks', 'T1');
    fs.mkdirSync(path.join(task, 'requirements'), { recursive: true });
    fs.mkdirSync(path.join(task, 'test-cases'), { recursive: true });
    fs.writeFileSync(path.join(task, 'test-cases', 'bo.md'), [
      '| TC ID | Module | Trường hợp kiểm thử | Tag | Các bước | Kết quả mong đợi |',
      '|---|---|---|---|---|---|',
      '| T_001 | A / B | [Positive] Xem | [Positive] | 1. Mở | 1. Hiện |',
    ].join('\n'), 'utf8');
    fs.writeFileSync(path.join(task, 'requirements', 'injection_surface.json'), JSON.stringify({ be_mat: [BM()] }), 'utf8');
    fs.writeFileSync(path.join(task, 'requirements', 'dimension_manifest.json'),
      JSON.stringify({ dimensions: { security: 'n/a' }, na_reasons: { security: 'task này không có phân quyền' } }), 'utf8');
    const r = spawnSync(process.execPath, [DC, '--enforce'], {
      cwd: REPO, encoding: 'utf8', env: { ...gateEnv(), PROJECT_OUTPUT_DIR: d, TASK_KEY: 'T1' },
    });
    const out = `${r.stdout || ''}${r.stderr || ''}`;
    expect(r.status).not.toBe(0);
    expect(out).toMatch(/XUNG ĐỘT: chiều "Security Coverage"/);
    expect(out).toMatch(/injection_surface\.json/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('khoá là `nhóm@màn`, KHÔNG phải mã đánh số', () => {
    /*
     * Mã `BM-001` sinh lại mỗi lượt bò nên nó TRÔI: một lời khai neo vào mã trôi thì lượt sau trỏ sai bề
     * mặt. `sort@/api/truong` thì bền. Và khai trong MANIFEST chứ không thêm cột vào bảng testcase —
     * thêm cột là đổi template dùng chung, còn một hệ mã thứ hai cạnh `oracle_ref` thì sớm muộn lệch
     * nhau, đúng lý do đã loại `REQ-*` ở v2.5.0.
     */
    const t = taskTam({ beMat: [BM()], khai: { 'BM-001': 'T_001' } });
    const r = chay(t);
    expect(r.code, 'khai theo mã đánh số thì KHÔNG được tính').not.toBe(0);
    expect(r.out).toMatch(/bề mặt injection `sort@\/api\/truong`/);
    fs.rmSync(t.d, { recursive: true, force: true });

    const src = fs.readFileSync(DC, 'utf8');
    expect(src).toMatch(/KHOÁ LÀ `nhóm@màn`/);
    expect(src, 'và ghi rõ vì sao không thêm cột').toMatch(/không thêm cột vào bảng testcase/);
  });
});

test.describe('@infra §B3 + §B4 — dấu vân tay nuôi hai gate khác', () => {
  const DC = path.join(REPO, 'scripts/qa/dimension_coverage.js');

  function taskTam(o: { screens?: unknown[]; dims?: Record<string, string>; ft?: string[]; lyDo?: Record<string, string> }) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'b34-'));
    const task = path.join(d, 'tasks', 'T1');
    fs.mkdirSync(path.join(task, 'requirements'), { recursive: true });
    fs.mkdirSync(path.join(task, 'test-cases'), { recursive: true });
    fs.writeFileSync(path.join(task, 'test-cases', 'bo.md'), [
      '| TC ID | Module | Trường hợp kiểm thử | Tag | Các bước | Kết quả mong đợi |',
      '|---|---|---|---|---|---|',
      '| T_001 | A / B | [Validation] Kiểm ô bắt buộc | [Validation] | 1. Mở | 1. Báo lỗi |',
      '| T_002 | A / B | [Positive] Xem | [Positive] | 1. Mở | 1. Hiện |',
    ].join('\n'), 'utf8');
    if (o.screens) {
      fs.writeFileSync(path.join(task, 'requirements', 'system_map.json'),
        JSON.stringify({ screens: o.screens }), 'utf8');
    }
    const man: Record<string, unknown> = { dimensions: o.dims || {} };
    if (o.ft) man.field_types = o.ft;
    if (o.lyDo) man.na_reasons = o.lyDo;
    fs.writeFileSync(path.join(task, 'requirements', 'dimension_manifest.json'), JSON.stringify(man), 'utf8');
    return d;
  }

  function chay(pod: string) {
    const r = spawnSync(process.execPath, [DC, '--enforce'], {
      cwd: REPO, encoding: 'utf8', env: { ...gateEnv(), PROJECT_OUTPUT_DIR: pod, TASK_KEY: 'T1' },
    });
    return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
  }

  const MAN_UPLOAD = [{ route: '/them', fields: [{ nhan: 'Tệp', code_loai: 'file_upload' }, { nhan: 'Tên', code_loai: 'text' }] }];

  test('§B3: thấy ô upload trên màn mà khai export/import `n/a` ⇒ XUNG ĐỘT, chặn', () => {
    const d = taskTam({
      screens: MAN_UPLOAD,
      dims: { export_import: 'n/a' },
      lyDo: { export_import: 'task này không có xuất nhập' },
    });
    const r = chay(d);
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/XUNG ĐỘT: chiều "Export\/Import/);
    expect(r.out, 'phải nêu đúng artifact').toMatch(/ô upload tệp trên màn đã bò/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('§B3 ÂM BẢN: màn KHÔNG có upload ⇒ khai `n/a` là hợp lệ', () => {
    const d = taskTam({
      screens: [{ route: '/xem', fields: [{ nhan: 'Tên', code_loai: 'text' }] }],
      dims: { export_import: 'n/a' },
      lyDo: { export_import: 'màn chỉ đọc, không có đường nhập tệp' },
    });
    expect(chay(d).out).not.toMatch(/XUNG ĐỘT: chiều "Export\/Import/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('§B4: loại field QUAN SÁT ĐƯỢC mà manifest không khai ⇒ CHẶN', () => {
    /*
     * Mẫu số thiếu một loại field CÓ THẬT trên màn thì mọi tỉ lệ của chiều Validation là tỉ lệ trên một
     * mẫu số nhỏ hơn thực tế. Đây là chỗ Bước 0 gỡ được giới hạn tuyên bố ở v2.3.0 — và nó gỡ bằng
     * THUỘC TÍNH DOM, không bằng dò chữ trên nhãn.
     */
    const d = taskTam({
      screens: [{ route: '/f', fields: [{ code_loai: 'text' }, { code_loai: 'email' }, { code_loai: 'file_upload' }] }],
      dims: { field_validation: 'required', export_import: 'required' },
      ft: ['text'],
    });
    const r = chay(d);
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/loại field QUAN SÁT ĐƯỢC trên màn mà manifest KHÔNG khai/);
    expect(r.out).toMatch(/email/);
    expect(r.out, 'hệ quả phải nói ra').toMatch(/nhỏ hơn thực tế/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('§B4: khai mà lượt bò không thấy ⇒ CẢNH BÁO, không chặn', () => {
    /* Màn chứa loại đó có thể nằm ngoài phạm vi lượt bò — không kết luận. */
    const d = taskTam({
      screens: [{ route: '/f', fields: [{ code_loai: 'text' }] }],
      dims: { field_validation: 'required' },
      ft: ['text', 'otp', 'slider'],
    });
    const r = chay(d);
    expect(r.out).toMatch(/loại khai mà lượt bò KHÔNG thấy/);
    expect(r.out).toMatch(/ngoài phạm vi lượt bò/);
    expect(r.out, 'KHÔNG được chặn vì chuyện này').not.toMatch(/QUAN SÁT ĐƯỢC trên màn mà manifest KHÔNG khai/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('§B4 hai tầng: chưa có `system_map.json` ⇒ nói rõ chưa đối chiếu được', () => {
    const d = taskTam({ dims: { field_validation: 'required' }, ft: ['text'] });
    expect(chay(d).out).toMatch(/chưa đối chiếu được với màn thật/);
    fs.rmSync(d, { recursive: true, force: true });
  });
});
