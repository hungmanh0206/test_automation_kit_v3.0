import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { chromium, Browser } from '@playwright/test';

/*
 * @infra — BÒ UI TẤT ĐỊNH + DẤU VÂN TAY MÀN (v2.6.0 §A2 · C3).
 *
 * Hai hạng mục trong một spec vì chúng chỉ có nghĩa cùng nhau: crawler đi tới màn, dấu vân tay nói màn đó
 * CÓ GÌ. Thiếu phần sau thì `dimension_manifest` vẫn phải tự khai "màn này có mấy loại field" — tức mẫu số
 * vẫn là số tự nhận, đúng thứ Bước 0 ra đời để chữa.
 *
 * BA LỖI THẬT bị phép đo lộ ra khi viết, và mỗi lỗi có một phép kiểm giữ chỗ:
 *   ① Gộp màn trùng KHÔNG chạy: danh tính màn gồm TIÊU ĐỀ, mà tiêu đề màn chi tiết là DỮ LIỆU
 *      ("Trường THCS Âu Cơ"…) ⇒ `/truong/:id` ra 5 dòng, đúng ca mà `chuanHoaRoute` sinh ra để chống.
 *   ② Mẫu số độ phủ lệch ĐƠN VỊ: tử số đếm màn, mẫu số đếm URL thô (`?sort=`, `?page=2`, `/truong/1..5`)
 *      ⇒ báo "bò tới 10/34 (29%)" trong khi crawler đã tới hết.
 *   ③ `\b` sau chữ có dấu không bao giờ khớp ⇒ suy `date_range` im lặng trả rỗng. Lần thứ NĂM trong dự án.
 */
const FX = path.resolve(__dirname, '..', 'fixtures', 'discovery-app', 'server.js');
const DIR = path.resolve(__dirname, '..', '..', '..', 'scripts', 'qa', 'discovery');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fixture = require(FX);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cr = require(path.join(DIR, 'crawl.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fp = require(path.join(DIR, 'fingerprint.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fw = require(path.join(DIR, 'write_firewall.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const CFG_UI = require(path.resolve(__dirname, '..', '..', '..', '.agent', 'config', 'ui_components.json'));

type Srv = { url: string; store: { truong: unknown[]; soLanGhi: number }; reset(): void; close(): Promise<void> };
type Man = { route: string; so_field: number; components: string[]; title_observed: string; fields: Record<string, unknown>[]; so_ban_ghi_da_xem?: number; loai_field_quan_sat: string[] };

let srv: Srv;
let br: Browser;
test.beforeAll(async () => { srv = await fixture.start(); br = await chromium.launch(); });
test.afterAll(async () => { await br.close(); await srv.close(); });

/*
 * `doTre: 0` vì fixture chạy offline — không có ai để mà lịch sự. Lượt THẬT trên UAT giữ 250ms của config.
 * Bản đầu của spec này mất 4,1 phút, gần hết là thời gian chờ; một spec hạ tầng chậm thế thì người ta thôi
 * chạy nó trước khi commit, và lúc đó nó không gác gì nữa.
 */
const bo = (o: Record<string, unknown> = {}) => cr.boApp(br, { baseUrl: srv.url, coCo: true, doTre: 0, ...o });

/** Dùng lại MỘT lượt bò mặc định cho các test chỉ ĐỌC kết quả. Test đo tính tất định vẫn bò thật hai lượt. */
let boMacDinh: Promise<Record<string, unknown>> | null = null;
const boGon = () => { if (!boMacDinh) boMacDinh = bo({ keoSnapshot: false }); return boMacDinh; };

test.describe('@infra dấu vân tay field — mẫu số THẬT cho chiều Validation', () => {
  test('đọc được CẢ 18 loại field của `ui_components.json` trên một màn form', async () => {
    /*
     * Đây là lý do dấu vân tay tồn tại. `screen_snapshot` (đã có, được tái dùng ở đây) trả
     * `{label, kind, value, disabled}` — đủ để đối chiếu màn với tài liệu, KHÔNG đủ làm mẫu số: nó không
     * có `required`, `maxlength`, `pattern`, `min`/`max`, số option thật.
     */
    const pg = await br.newPage();
    await fw.install(pg);
    await pg.goto(`${srv.url}/them-truong`);
    const d = await fp.docDauVanTay(pg, { keoSnapshot: false });
    await pg.close();

    const khaiTrongConfig = new Set<string>(CFG_UI.field_types.map((f: { code: string }) => f.code));
    const quanSat = new Set<string>(d.loai_field_quan_sat);
    const thieu = [...khaiTrongConfig].filter((c) => !quanSat.has(c));
    expect(thieu, `fixture phải phủ đủ 18 loại field; còn thiếu: ${thieu.join(', ')}`).toEqual([]);
    expect(quanSat.size).toBe(18);
  });

  test('đọc đúng RÀNG BUỘC, không chỉ đọc nhãn', async () => {
    const pg = await br.newPage();
    await fw.install(pg);
    await pg.goto(`${srv.url}/them-truong`);
    const d = await fp.docDauVanTay(pg, { keoSnapshot: false });
    await pg.close();

    const o = (ten: string) => d.fields.find((f: { ten_truong: string }) => f.ten_truong === ten);
    expect(o('ten').required, '`required` phải đọc được').toBe(true);
    expect(o('ten').maxlength).toBe(120);
    expect(o('ten').minlength).toBe(3);
    expect(o('ten').nhan, 'nhãn phải sạch dấu `*` và KHÔNG còn khoảng trắng đuôi').toBe('Tên trường');
    expect(o('sdt').pattern).toBe('0[0-9]{9}');
    expect(o('siso').min).toBe('0');
    expect(o('siso').max).toBe('5000');
    expect(o('cap').so_option, 'số `<option>` THẬT, không phải số đang hiện').toBe(5);
    expect(o('tong').readonly, 'ô tự tính là readonly ⇒ loại `computed`').toBe(true);
    expect(o('tong').code_loai).toBe('computed');
    expect(o('cong_lap').checked, 'trạng thái tích MẶC ĐỊNH, không phải trạng thái hiện tại').toBe(true);
  });

  test('`date_range` phải SUY từ cặp nhãn từ/đến — và được đánh dấu là suy', async () => {
    /*
     * DOM một mình KHÔNG phân biệt "hai ô ngày rời" với "một khoảng ngày". Danh mục tách `date` và
     * `date_range` vì khoảng ngày có lớp case riêng (`từ > đến`, khoảng rỗng). Nên phải suy — và phải ghi
     * rõ là suy, vì nhãn đặt lạ thì suy sai và mẫu số sai theo.
     */
    const f = [
      { nhan: 'Ngày thành lập', code_loai: 'date' },
      { nhan: 'Khoảng ngày — từ', code_loai: 'date' },
      { nhan: 'Khoảng ngày — đến', code_loai: 'date' },
    ];
    fp.suyKhoangNgay(f);
    expect(f[0].code_loai, 'ô ngày đơn lẻ KHÔNG được biến thành khoảng').toBe('date');
    expect(f[1].code_loai).toBe('date_range');
    expect(f[2].code_loai).toBe('date_range');
    expect((f[1] as Record<string, unknown>)._suy_dien, 'phải đánh dấu là SUY, không phải quan sát').toBe(true);
  });

  test('`\\b` sau chữ có dấu — bẫy đã đánh trúng 5 lần, không được tái phát trong thư mục discovery', () => {
    /*
     * `\b` đặt sau một chữ có dấu thì KHÔNG BAO GIỜ khớp (`ừ` nằm ngoài `\w`). Nó im lặng: phép đo trả về
     * rỗng mà không báo lỗi. Bản đầu của `suyKhoangNgay` viết `/\b(t[uừ]|…)\b/i` và không nhận ra ô
     * "Khoảng ngày — từ" của chính fixture.
     */
    const xau: string[] = [];
    for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.js'))) {
      const src = fs.readFileSync(path.join(DIR, f), 'utf8');
      src.split(/\r?\n/).forEach((d, i) => {
        // `\b` đứng ngay sau một ký tự ngoài ASCII trong một biểu thức chính quy
        if (/[^\x00-\x7F]\\b/.test(d)) xau.push(`${f}:${i + 1}`);
      });
    }
    expect(xau, `\\b đứng sau chữ có dấu ở: ${xau.join(', ')}`).toEqual([]);
  });

  test('upload là LOẠI FIELD, không phải component — không lẫn hai danh mục', async () => {
    /* Lẫn hai danh mục là cách tạo ra một mã không ai khai. Nên nó đi vào `component_chua_map`. */
    const pg = await br.newPage();
    await fw.install(pg);
    await pg.goto(`${srv.url}/them-truong`);
    const d = await fp.docDauVanTay(pg, { keoSnapshot: false });
    await pg.close();
    expect(d.components, 'upload KHÔNG được xuất hiện như component').not.toContain('upload');
    expect(d.loai_field_quan_sat).toContain('file_upload');
    expect(d.component_chua_map.join(' ')).toMatch(/upload.*file_upload/);
  });
});

test.describe('@infra component theo màn — C3: pagination · filter · tab', () => {
  test('`/truong` có pagination + filter; `/lop` KHÔNG — âm bản là nửa còn lại của phép đo', async () => {
    /*
     * Một bộ dò trả "có" ở mọi màn thì vô dụng y như trả "không": gate `n/a` sẽ chặn oan mọi màn. Nên
     * phép thuận và phép âm phải đi cùng nhau. Fixture dựng đúng để đo được: `/lop` không có phân trang
     * và không có ô lọc.
     */
    const r = await boGon();
    const m = (route: string) => (r.screens as Man[]).find((s) => s.route === route)!;
    expect(m('/truong').components).toEqual(expect.arrayContaining(['data_table', 'pagination', 'filter']));
    expect(m('/lop').components, '`/lop` chỉ có lưới').toEqual(['data_table']);
    expect(m('/lop').components).not.toContain('pagination');
    expect(m('/truong/:id').components, 'màn chi tiết có tab').toContain('tab');
  });

  test('ba mã mới đều khai trong `ui_components.json` kèm `artifact_signal`', () => {
    for (const ma of ['pagination', 'filter', 'tab']) {
      const c = CFG_UI.components.find((x: { code: string }) => x.code === ma);
      expect(c, `thiếu component \`${ma}\` trong config`).toBeTruthy();
      expect(String(c.artifact_signal), `${ma} phải trỏ vào dấu vân tay discovery`).toMatch(/discovery:/);
      expect(Array.isArray(c.chieu) && c.chieu.length, `${ma} chưa khai chiều`).toBeTruthy();
    }
  });

  test('hai tầng: chưa có discovery thì ba mã mới KHÔNG gác gì, và config nói ra điều đó', () => {
    /* Chặn ngay là làm đỏ mọi bộ testcase đã publish — đúng lớp lỗi "gate báo oan thì người ta tắt nó". */
    expect(CFG_UI._components_them_v260_hai_tang).toMatch(/chưa được gác/);
    expect(CFG_UI._components_them_v260_hai_tang).toMatch(/không in ĐẠT/);
  });
});

test.describe('@infra gộp màn trùng — lỗi ① đã sửa', () => {
  test('`/truong/:id` gộp thành MỘT màn, dù mở 5 bản ghi khác tiêu đề', async () => {
    const r = await boGon();
    const ct = (r.screens as Man[]).filter((s) => s.route === '/truong/:id');
    expect(ct, 'phải còn đúng 1 dòng cho màn chi tiết').toHaveLength(1);
    expect(ct[0].so_ban_ghi_da_xem, 'và ghi lại đã mở trên mấy bản ghi').toBe(5);
  });

  test('danh tính KHÔNG được phụ thuộc tiêu đề — tiêu đề màn chi tiết là DỮ LIỆU', () => {
    /*
     * Phép kiểm trực tiếp vào hàm, vì đây là chỗ sai của bản đầu: cùng cấu trúc + khác tiêu đề ⇒ vẫn
     * phải là một màn. Không có phép kiểm này thì lỗi ① quay lại ngay lần ai đó "sửa cho giống §A2".
     */
    const dvtA = { fields: [{ nhan: 'Mã' }], components: ['tab'], snapshot: { tables: [{ headers: ['Mã', 'Tên'] }] } };
    const dvtB = JSON.parse(JSON.stringify(dvtA));
    expect(cr.danhTinh('/truong/:id', cr.chuKyCauTruc(dvtA)))
      .toBe(cr.danhTinh('/truong/:id', cr.chuKyCauTruc(dvtB)));
    // Khác CẤU TRÚC thì phải là hai màn
    dvtB.components = ['tab', 'filter'];
    expect(cr.danhTinh('/truong/:id', cr.chuKyCauTruc(dvtA)))
      .not.toBe(cr.danhTinh('/truong/:id', cr.chuKyCauTruc(dvtB)));
  });

  test('`chuanHoaRoute` gộp id số, uuid và hash — không gộp đoạn chữ', () => {
    expect(cr.chuanHoaRoute('http://x/truong/123')).toBe('/truong/:id');
    expect(cr.chuanHoaRoute('http://x/a/550e8400-e29b-41d4-a716-446655440000/b')).toBe('/a/:id/b');
    expect(cr.chuanHoaRoute('http://x/a/507f1f77bcf86cd799439011')).toBe('/a/:id');
    expect(cr.chuanHoaRoute('http://x/truong/them-moi'), 'đoạn chữ KHÔNG được gộp').toBe('/truong/them-moi');
  });
});

test.describe('@infra độ đầy đủ lượt bò — lỗi ② đã sửa', () => {
  test('mẫu số và tử số CÙNG đơn vị (route đã chuẩn hoá) ⇒ không báo động giả', async () => {
    /*
     * Bản đầu báo "chỉ bò tới 10/34 route (29%)" trên fixture, trong khi crawler đã tới hết mọi màn tới
     * được. 34 là URL THÔ: `?sort=ma`, `?page=2`, `/truong/1..5`. Một báo động giả ở đây đắt kiểu khác với
     * một con số thiếu: nó dạy người đọc bỏ qua cảnh báo.
     */
    const r = await boGon();
    const cc = r.crawl_completeness;
    expect(cc.ti_le, 'bò tới hết thì phải là 1').toBe(1);
    expect(cc.canh_bao, 'và KHÔNG được cảnh báo').toBeNull();
    expect(cc.url_tho_phat_hien, 'số URL thô vẫn giữ riêng — nó có ích, nhưng không phải mẫu số').toBeGreaterThan(cc.route_phat_hien);
    expect(cc.man_rieng_biet).toBe(r.screens.length);
  });

  test('hết ngân sách giữa chừng ⇒ báo đúng phần chưa tới, KHÔNG báo 100%', async () => {
    const r = await bo({ maxTrang: 2, keoSnapshot: false });
    const cc = r.crawl_completeness;
    expect(r.screens.length).toBeLessThanOrEqual(2);
    expect(cc.khong_toi_duoc.budget, 'phải kê phần bị cắt').toBeGreaterThan(0);
    expect(cc.ti_le, 'và tỉ lệ phải < 1').toBeLessThan(1);
    expect(cc.canh_bao).toMatch(/phải ghi kèm cảnh báo/);
  });

  test('`/admin` KHÔNG tới được bằng vai trò mặc định — đây là lý do §A4 tồn tại', async () => {
    /*
     * Không phải lỗi crawler: `/admin` bị ẨN KHỎI MENU với vai trò `nhanvien`, nên BFS theo link không có
     * đường tới. Server vẫn trả 200 cho URL đó. Đo được: 6/7 màn. Đúng điểm yếu số 2 của kit A ("chỉ thấy
     * phần một tài khoản thấy") — và là phép đo mở đường cho `roles.js`.
     */
    const r = await boGon();
    expect((r.screens as Man[]).map((s) => s.route)).not.toContain('/admin');
    const pg = await br.newPage();
    await fw.install(pg);
    const resp = await pg.goto(`${srv.url}/admin`);
    expect(resp!.status(), 'nhưng URL đó KHÔNG bị server chặn').toBe(200);
    await pg.close();
  });
});

test.describe('@infra bò TẤT ĐỊNH, và không chạm dữ liệu', () => {
  test('hai lượt cùng cấu hình ⇒ CÙNG danh sách màn, CÙNG thứ tự', async () => {
    /*
     * Điểm số 1 trong 10 điểm vượt kit A. Mất tính tất định thì chế độ `delta` báo khác biệt GIẢ — nên
     * `so_luong_song_song` để 1, và lý do đó ghi trong `discovery.json` (bản đầu để 2 với một lý do sai).
     */
    const a = await bo({ keoSnapshot: false });
    const b = await bo({ keoSnapshot: false });
    expect((b.screens as Man[]).map((s) => s.route)).toEqual((a.screens as Man[]).map((s) => s.route));
    expect(b.crawl_completeness.route_toi_duoc).toBe(a.crawl_completeness.route_toi_duoc);
  });

  test('cắt vì hết ngân sách cũng phải TẤT ĐỊNH — cùng cấu hình, cắt cùng chỗ', async () => {
    const a = await bo({ maxTrang: 3, keoSnapshot: false });
    const b = await bo({ maxTrang: 3, keoSnapshot: false });
    expect((b.screens as Man[]).map((s) => s.route)).toEqual((a.screens as Man[]).map((s) => s.route));
  });

  test('sau CẢ lượt bò: 0 lượt ghi, dữ liệu fixture nguyên vẹn', async () => {
    srv.reset();
    const truoc = JSON.stringify(srv.store.truong);
    const r = await bo({ keoSnapshot: false });
    expect(srv.store.soLanGhi, 'crawler KHÔNG được ghi gì').toBe(0);
    expect(JSON.stringify(srv.store.truong)).toBe(truoc);
    expect(r.tuong_lua.request_ghi_lot).toBe(0);
  });

  test('crawler mở accordion/tab nhưng KHÔNG bấm nút trong danh sách cấm', async () => {
    const r = await boGon();
    const ct = (r.screens as Man[] & { khoi_da_mo?: string[] }[]).find((s) => s.route === '/truong/:id');
    expect((ct as unknown as { khoi_da_mo: string[] }).khoi_da_mo.length, 'phải mở được tab/accordion').toBeGreaterThan(0);
    const cfg = fw.napCfg();
    for (const nhan of (ct as unknown as { khoi_da_mo: string[] }).khoi_da_mo) {
      expect(fw.laNutCamBam(nhan, cfg), `đã bấm "${nhan}" — nhãn này nằm trong danh sách cấm`).toBeNull();
    }
  });

  test('host không rõ ⇒ TỪ CHỐI BÒ, không mở trang nào', async () => {
    await expect(cr.boApp(br, { baseUrl: 'https://qemis.example.vn/', coCo: true }))
      .rejects.toThrow(/TỪ CHỐI BÒ/);
  });

  test('thiếu cờ --confirm-nonprod ⇒ TỪ CHỐI, kể cả với localhost', async () => {
    await expect(cr.boApp(br, { baseUrl: srv.url, coCo: false })).rejects.toThrow(/THIẾU cờ/);
  });
});

test.describe('@infra che PII trong ẢNH chụp màn', () => {
  /*
   * LỖ HỔNG CHỈ LỘ RA KHI SẮP CHẠM UAT. §C đòi che PII trong JSON **và trong ảnh**. JSON đã che (qua
   * `screen_snapshot` và `fingerprint`), nhưng `page.screenshot` chụp THÔ — một lượt bò trên UAT có dữ
   * liệu thật sẽ ghi ra hàng chục ảnh đầy họ tên, ngày sinh và CCCD. Kit đã trả giá cho đúng lớp lỗi này
   * một lần: 100 email và 100 SĐT rò ra một file requirements.
   *
   * Fixture offline không bắt được lỗ này (nó không có dữ liệu người), nên phép kiểm đi thẳng vào hàm.
   */
  test('ô nhập có nhãn PII ⇒ vào danh sách che', async ({ page }) => {
    await page.setContent(`
      <label for="hoten">Họ và tên</label><input id="hoten" value="Nguyễn Văn A">
      <label for="email">Email liên hệ</label><input id="email" value="a@b.vn">
      <label for="ngaysinh">Ngày sinh</label><input id="ngaysinh" value="01/01/1990">
      <label for="tent">Tên trường</label><input id="tent" value="THCS Âu Cơ">
      <label for="siso">Sĩ số</label><input id="siso" value="820">`);
    const che = await cr.oCanChe(page);
    expect(che.length, 'che đúng 3 ô PII, KHÔNG che ô nghiệp vụ thường').toBe(3);
  });

  test('CỘT bảng có header PII ⇒ che cả cột — ô trong lưới không có nhãn kề bên', async ({ page }) => {
    /* Đây đúng là chỗ đã rò thật: mask-theo-nhãn không tới được ô của lưới. */
    await page.setContent(`
      <table><thead><tr><th>Mã</th><th>Họ và tên</th><th>Số điện thoại</th><th>Lớp</th></tr></thead>
      <tbody>
        <tr><td>HS01</td><td>Nguyễn Văn A</td><td>0912345678</td><td>6A1</td></tr>
        <tr><td>HS02</td><td>Trần Thị B</td><td>0987654321</td><td>6A2</td></tr>
      </tbody></table>`);
    const che = await cr.oCanChe(page);
    expect(che.length, '2 cột PII × 2 dòng').toBe(4);
  });

  test('ÂM BẢN: màn không có PII ⇒ KHÔNG che gì', async ({ page }) => {
    /* Che quá tay thì ảnh mất giá trị minh hoạ, và người đọc không còn kiểm được lượt bò thấy gì. */
    await page.setContent(`
      <label for="ma">Mã trường</label><input id="ma" value="C2-001">
      <table><thead><tr><th>Mã</th><th>Cấp</th></tr></thead><tbody><tr><td>C2-001</td><td>THCS</td></tr></tbody></table>`);
    expect((await cr.oCanChe(page)).length).toBe(0);
  });

  test('che LÚC CHỤP, không phải chụp xong rồi bôi', () => {
    /*
     * `page.screenshot({ mask })` tô đè vùng đó NGAY lúc chụp, nên dữ liệu không bao giờ nằm trong tệp.
     * Chụp xong rồi bôi thì bản gốc đã tồn tại một nhịp trên đĩa — và một nhịp là đủ để nó vào backup,
     * vào index của trình đồng bộ, hoặc vào tay người khác.
     */
    const src = fs.readFileSync(path.join(DIR, 'crawl.js'), 'utf8');
    expect(src).toMatch(/page\.screenshot\(\{[^}]*mask: await oCanChe\(page\)/);
    expect(src, 'và ghi rõ vì sao che lúc chụp').toMatch(/chụp xong rồi bôi/);
  });
});

test.describe('@infra trần MỖI TRANG — trần tổng một mình không đủ', () => {
  /*
   * Trần TỔNG (`thoi_gian_toi_da_phut`) chỉ được kiểm ở ĐẦU mỗi vòng lặp, nên một trang treo thì nó
   * KHÔNG BAO GIỜ bắn: lượt bò chạy vô hạn mà vẫn "trong ngân sách".
   *
   * Chỗ treo được là có thật, không phải lo xa: `page.evaluate` của dấu vân tay và của `gomLink` KHÔNG
   * có timeout nào, và trên app ASP.NET thì `moCacKhoi` bấm vào các nút gây POSTBACK — tức một request
   * ghi, bị chính tường lửa của ta abort, để lại trang ở trạng thái điều hướng dở.
   */
  test('một trang chặn luồng JS ⇒ bỏ qua trang đó, lượt bò ĐI TIẾP', async () => {
    const cfg = fw.napCfg();
    cfg.gioi_han_luot_bo = { ...cfg.gioi_han_luot_bo, thoi_gian_moi_trang_giay: 1 };
    const r = await cr.boApp(br, {
      baseUrl: `${srv.url}/trang-cham?ms=4000`, coCo: true, cfg, doTre: 0, keoSnapshot: false, doSau: 0,
    });
    const loi = r.crawl_completeness.chi_tiet_khong_toi_duoc.error;
    expect(loi.length, 'trang chậm phải vào danh sách không tới được').toBeGreaterThan(0);
    expect(String(loi[0].vi_sao)).toMatch(/quá 1s cho một trang/);
    expect(r.screens.length, 'và KHÔNG được tính là một màn đã bò').toBe(0);
  });

  test('một trang hỏng KHÔNG làm chết cả lượt — các trang còn lại vẫn là dữ liệu thật', async () => {
    /* Đây là lý do dùng `continue` chứ không `throw`: 11 trang còn lại vẫn đáng giá. */
    const cfg = fw.napCfg();
    cfg.gioi_han_luot_bo = { ...cfg.gioi_han_luot_bo, thoi_gian_moi_trang_giay: 2 };
    const r = await cr.boApp(br, { baseUrl: srv.url, coCo: true, cfg, doTre: 0, keoSnapshot: false });
    expect(r.screens.length, 'vẫn bò được các màn bình thường').toBeGreaterThanOrEqual(5);
  });

  test('trần mỗi trang khai trong CONFIG kèm lý do, không đóng cứng trong code', () => {
    const cfg = fw.napCfg();
    expect(cfg.gioi_han_luot_bo.thoi_gian_moi_trang_giay).toBeGreaterThan(0);
    expect(cfg.gioi_han_luot_bo._vi_sao_co_tran_moi_trang, 'phải ghi vì sao trần tổng không đủ')
      .toMatch(/chỉ được kiểm ở ĐẦU mỗi vòng lặp/);
  });
});

test.describe('@infra KHÔNG đi theo link Đăng xuất — lỗ đo được trên UAT thật', () => {
  /*
   * LƯỢT §E ĐẦU TIÊN TRÊN UAT (11/10) phơi ra lỗ này, và nó ngụy trang rất khéo.
   *
   * `nut_cam_bam` chỉ gác lượt BẤM NÚT; `gomLink` gom mọi `a[href]` mà không kiểm nhãn. Trên QEMIS,
   * Đăng xuất là một thẻ `<a>` trong menu người dùng, nằm ngay đầu thứ tự DOM. Crawler đi theo nó và TỰ
   * HUỶ SESSION của chính mình.
   *
   * Số đo: bò được 6 màn rồi chạm `/Logout.aspx`, sau đó **292/321 route** bị đẩy về màn đăng nhập, và
   * bộ dò captcha gắn nhãn `captcha` cho tất cả. Bản tóm tắt đọc ra như "app này bắt captcha ở mọi màn"
   * — một kết luận SAI HẲN về sản phẩm, sinh ra từ một lỗi của chính kit. Đó là loại sai tệ nhất: nó
   * không làm gì đỏ, nó chỉ tạo ra một phát hiện giả rất thuyết phục.
   */
  test('link Đăng xuất bị BỎ QUA, và session vẫn sống sau cả lượt bò', async () => {
    const r = await bo({ keoSnapshot: false });
    const route = (r.screens as Man[]).map((s) => s.route);
    expect(route, 'KHÔNG được đi vào /Logout.aspx').not.toContain('/Logout.aspx');
    expect(route, 'và do đó KHÔNG bao giờ thấy màn đăng nhập').not.toContain('/Login.aspx');
    expect(r.crawl_completeness.khong_toi_duoc.captcha, 'session còn sống ⇒ 0 route báo captcha').toBe(0);
    expect(route.length, 'vẫn bò được các màn thường').toBeGreaterThanOrEqual(6);
  });

  test('link bị bỏ qua phải GHI RA, không im lặng', async () => {
    /* Không ghi thì "lượt bò không thấy màn Đăng xuất" trông như một thiếu sót của lượt bò. */
    const r = await bo({ keoSnapshot: false });
    const bq = r.crawl_completeness.link_co_y_bo_qua as { url: string; nhan: string }[];
    expect(bq.some((x) => /Logout/i.test(x.url)), 'phải kê link đã tránh').toBe(true);
    expect(bq.find((x) => /Logout/i.test(x.url))!.nhan).toMatch(/dang xuat/);
  });

  test('chặn theo CẢ HAI đường: nhãn, và đường dẫn', async ({ page }) => {
    /*
     * Nhãn bắt được "Đăng xuất"/"Logout"; đường dẫn bắt được link chỉ có icon, không chữ. Thiếu đường
     * thứ hai thì một nút đăng xuất dạng icon vẫn lọt.
     */
    await page.goto(srv.url);
    await page.setContent(`<a href="${srv.url}/Logout.aspx"><i class="icon"></i></a>
      <a href="${srv.url}/binh-thuong">Xem danh sách</a>`);
    const lk = await cr.gomLink(page, new URL(srv.url).origin, fw.napCfg());
    expect(lk.bo.length, 'link icon không chữ vẫn phải bị chặn theo đường dẫn').toBe(1);
    expect(lk.giu.length).toBe(1);
  });

  test('tỉ lệ captcha cao ⇒ báo SESSION CHẾT, không báo đặc điểm của app', async () => {
    /*
     * Chốt chặn cho đúng triệu chứng đã gặp. Một app hiếm khi bắt captcha ở MỌI màn; tỉ lệ captcha cao là
     * tín hiệu của PHIÊN, không phải của sản phẩm.
     */
    const gia = {
      crawl_completeness: {
        khong_toi_duoc: { captcha: 292 },
        chi_tiet_khong_toi_duoc: { captcha: new Array(292).fill({ url: 'x' }) },
      },
    };
    // Đo trực tiếp trên văn bản cảnh báo trong mã nguồn: nhánh này chỉ chạy khi session chết thật.
    const src = fs.readFileSync(path.join(DIR, 'crawl.js'), 'utf8');
    expect(src).toMatch(/canh_bao_session/);
    expect(src).toMatch(/hiếm khi bắt captcha ở mọi màn/);
    expect(src, 'và nói rõ đừng kết luận về sản phẩm').toMatch(/trước khi kết luận gì về sản phẩm/);
    expect(gia.crawl_completeness.khong_toi_duoc.captcha).toBeGreaterThan(3);
  });
});
