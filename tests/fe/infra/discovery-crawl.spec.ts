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
/*
 * CHẠY TUẦN TỰ TRONG MỘT WORKER. Mặc định Playwright cho mỗi test một worker riêng, nên bộ nhớ đệm ở cấp
 * module (`luotChung`, `boGon`, `maTran`…) KHÔNG dùng chung được: mỗi test dựng lại server fixture, mở
 * lại browser, và với spec CLI thì spawn thêm một tiến trình `discover` nữa.
 *
 * Đo được: spec CLI chạy riêng từng ca thì xanh trong 968ms, chạy cả file song song thì 6 ca ĐỎ vì hết
 * timeout 90s — một lỗi hoàn toàn do tranh chấp tài nguyên, không liên quan gì tới thứ đang kiểm. Đó là
 * loại đỏ tệ nhất: nó dạy người đọc rằng spec này "hay đỏ", rồi lần sau có đỏ thật cũng bị bỏ qua.
 *
 * `mode: 'default'` giữ chúng trong CÙNG một worker theo thứ tự, và KHÔNG bỏ qua các ca sau khi một ca
 * đỏ (khác `serial`) — vẫn thấy đủ bức tranh.
 */
test.describe.configure({ mode: 'default' });

/*
 * TRẦN THỜI GIAN RIÊNG CHO FILE NÀY — 90s mặc định KHÔNG đủ, và con số nói rõ vì sao.
 *
 * Đo 01/11/2026, một lượt bò đầy đủ trên fixture (7 màn, 35 URL):
 *   · máy rỗi          : 19s
 *   · 10–21 tiến trình quay CPU : 28s · 34s · 36s · 41s
 * Phép kiểm tính tất định phải bò HAI lượt, nên dưới tranh chấp nó cần 56–82s khi mọi thứ hoàn toàn
 * khoẻ — tức đã ăn tới 91% trần 90s trước khi có bất kỳ sự cố nào. Một trần mà phép kiểm khoẻ cũng chỉ
 * vừa đủ thì nó không còn gác thời gian, nó chỉ sinh đỏ ngẫu nhiên.
 *
 * Trần này KHÔNG nới phép kiểm nào: không assertion nào đổi, không giá trị mong đợi nào đổi. Nó chỉ nói
 * rằng một spec bò hai lượt UI thì tốn hơn một spec mở một trang.
 *
 * 90s của `playwright.config.js` chọn cho "login OIDC + first paint của SPA" — một việc khác hẳn.
 */
test.setTimeout(3 * 60 * 1000);

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
const boMotLan = (o: Record<string, unknown> = {}) => cr.boApp(br, { baseUrl: srv.url, coCo: true, doTre: 0, ...o });

/*
 * ĐO LẠI KHI PHÉP ĐO KHÔNG CHẠY ĐƯỢC — và CHỈ khi đó (SỬA 01/11/2026).
 *
 * Chuyện đã đo, 01/11/2026, dưới tranh chấp tài nguyên (10 tiến trình quay CPU + cả bó spec):
 *   · `page.goto` tới trang đầu hết hạn ở 15s, trong khi `http.get` thuần tới CÙNG URL đáp 6–48ms
 *     (36 mẫu, 0 lỗi) ⇒ server khoẻ, app khoẻ, nghẽn nằm trong đường ống của browser.
 *   · Page KHÔNG chết: goto lượt hai trên CÙNG page qua sau 11,4s; page mới qua sau 27ms; browser mới
 *     20ms. Tức đây là một cú treo NHẤT THỜI của lượt điều hướng đầu trên một context mới.
 *   · Không phải trạng thái tích tụ: lượt bò thứ 5 và 6 xanh lại sau 3 lượt liền đỏ.
 *
 * Vì sao phải đo lại chứ không để đỏ: khi lượt bò không chạy được, nó trả về 0 màn, và phép kiểm tính
 * tất định đọc "lượt a có 7 màn, lượt b có 0 màn" rồi KẾT TỘI CRAWLER mất tất định. Đó là một lời buộc
 * tội sai cho một phép đo chưa từng chạy — đúng lớp lỗi "phép đo không phân biệt được".
 *
 * Vì sao đây KHÔNG phải nới phép kiểm: chỉ bắt đúng mã lỗi `BO_DUOC_0_MAN`, tức lượt bò TỰ KHAI là nó
 * không vào được app. Mọi lỗi khác ném nguyên. Phép so hai mảng route không đổi một chữ. Và hết trần mà
 * vẫn không đo được thì ĐỎ, kèm lý do — "không đo được" KHÔNG thành xanh.
 */
const TRAN_DO_LAI = 3;
const bo = async (o: Record<string, unknown> = {}) => {
  const khong: string[] = [];
  for (let lan = 1; lan <= TRAN_DO_LAI; lan++) {
    try {
      const r = await boMotLan(o);
      /*
       * NÓI RA số lượt điều hướng đã phải thử lại. Thiếu dòng này thì một lượt xanh KHÔNG phân biệt được
       * "môi trường khoẻ" với "môi trường treo mà bản vá đã hấp thụ" — và lúc đó một lượt xanh không
       * chứng minh bản vá có tác dụng.
       */
      const n = (r as { crawl_completeness: { so_lan_thu_lai_dieu_huong: number } }).crawl_completeness.so_lan_thu_lai_dieu_huong;
      if (n > 0) console.warn(`[discovery-crawl] ${n} lượt điều hướng phải thử lại (đã hấp thụ, lượt bò vẫn đủ màn).`);
      return r;
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code !== 'BO_DUOC_0_MAN') throw err;
      khong.push(`lần ${lan}: ${err.message.slice(0, 200)}`);
      /* NÓI RA khi phải đo lại: một lượt chạy im lặng đo lại 3 lần trông y như một lượt chạy khoẻ. */
      console.warn(`[discovery-crawl] lượt bò ${lan}/${TRAN_DO_LAI} KHÔNG vào được app — đo lại.`);
    }
  }
  throw new Error(`KHÔNG ĐO ĐƯỢC tính tất định: ${TRAN_DO_LAI}/${TRAN_DO_LAI} lượt bò không vào được app. `
    + `Đây KHÔNG phải bằng chứng crawler mất tất định, và cũng KHÔNG được coi là đạt.\n${khong.join('\n')}`);
};

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
    const cc = r.crawl_completeness as {
      ti_le: number; canh_bao: string | null; url_tho_phat_hien: number;
      route_phat_hien: number; man_rieng_biet: number;
    };
    expect(cc.ti_le, 'bò tới hết thì phải là 1').toBe(1);
    expect(cc.canh_bao, 'và KHÔNG được cảnh báo').toBeNull();
    expect(cc.url_tho_phat_hien, 'số URL thô vẫn giữ riêng — nó có ích, nhưng không phải mẫu số').toBeGreaterThan(cc.route_phat_hien);
    expect(cc.man_rieng_biet).toBe((r.screens as Man[]).length);
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

/*
 * LỜI KHAI KÈM THEO khi hai lượt bò khác nhau — thiếu nó thì phép kiểm tất định vô dụng lúc nó đỏ.
 *
 * Bản đầu chỉ so hai mảng route, nên khi đỏ, tất cả người đọc có là "lượt sau thiếu 4 màn". Mà "thiếu
 * màn" có HAI nguyên nhân khác nhau hoàn toàn: route KHÔNG BAO GIỜ được gom (lỗi ở `gomLink` trên trang
 * cha), hay route gom được rồi mà KHÔNG thăm nổi (lỗi ở `goto`, captcha, trần mỗi trang). `crawl.js` đã
 * tách sẵn hai chuyện đó vào `crawl_completeness`; chỉ là phép kiểm không in ra.
 *
 * Đo 01/11/2026: lượt đỏ ở `release:verify` mất đúng 4 route và tôi phải đoán. Hai giả thuyết đầu tôi đo
 * đều SAI, và cả hai đều có thể bị loại trong 10 giây nếu con số này có sẵn trong thông báo lỗi.
 */
function loiKhai(ten: string, r: Record<string, any>): string {
  const cc = r.crawl_completeness;
  /*
   * ĐỌC `chi_tiet_khong_toi_duoc`, KHÔNG đọc `khong_toi_duoc`. Bản đầu của chính hàm này đọc cái thứ hai
   * rồi lọc theo `.length` — mà đó là map SỐ ĐẾM, nên `.length` luôn `undefined` và máy đo in ra "không
   * route nào bị bỏ" cho một lượt bò mất trắng 7 màn. Một máy đo nói sai thì tệ hơn không có máy đo.
   */
  const ct = cc.chi_tiet_khong_toi_duoc as Record<string, unknown[]>;
  const kt = Object.entries(ct)
    .filter(([, v]) => Array.isArray(v) && v.length)
    .map(([k, v]) => `${k}=${v.length} ${JSON.stringify(v).slice(0, 300)}`);
  return `[${ten}] gom ${cc.route_phat_hien} route (${cc.url_tho_phat_hien} url thô), thăm được `
    + `${cc.route_toi_duoc}, màn ${(r.screens as Man[]).length}`
    + (kt.length ? ` — KHÔNG TỚI: ${kt.join(' · ')}` : ' — không route nào bị bỏ')
    + ` · tường lửa ${JSON.stringify(r.tuong_lua)}`;
}

test.describe('@infra bò TẤT ĐỊNH, và không chạm dữ liệu', () => {
  test('hai lượt cùng cấu hình ⇒ CÙNG danh sách màn, CÙNG thứ tự', async () => {
    /*
     * Điểm số 1 trong 10 điểm vượt kit A. Mất tính tất định thì chế độ `delta` báo khác biệt GIẢ — nên
     * `so_luong_song_song` để 1, và lý do đó ghi trong `discovery.json` (bản đầu để 2 với một lý do sai).
     */
    const a = await bo({ keoSnapshot: false });
    const b = await bo({ keoSnapshot: false });
    const vi = `${loiKhai('lượt a', a)}\n${loiKhai('lượt b', b)}`;
    expect((b.screens as Man[]).map((s) => s.route), vi).toEqual((a.screens as Man[]).map((s) => s.route));
    expect(b.crawl_completeness.route_toi_duoc, vi).toBe(a.crawl_completeness.route_toi_duoc);
  });

  test('cắt vì hết ngân sách cũng phải TẤT ĐỊNH — cùng cấu hình, cắt cùng chỗ', async () => {
    const a = await bo({ maxTrang: 3, keoSnapshot: false });
    const b = await bo({ maxTrang: 3, keoSnapshot: false });
    const vi = `${loiKhai('lượt a', a)}\n${loiKhai('lượt b', b)}`;
    expect((b.screens as Man[]).map((s) => s.route), vi).toEqual((a.screens as Man[]).map((s) => s.route));
  });

  /*
   * ĐỐI CHỨNG cho chốt "0 màn KHÔNG phải quan sát" và cho bước thử lại điều hướng (SỬA 01/11/2026).
   *
   * Vì sao cần máy chủ riêng chứ không dùng `srv`: hai phép kiểm này đòi một máy chủ CỐ Ý hỏng theo
   * kịch bản — hai lượt đầu cắt kết nối, lượt ba trả trang. Không có nó thì không phân biệt được "thử
   * lại có bắn" với "thử lại không bao giờ cần tới", và một bước thử lại chưa bao giờ bắn thì không
   * chứng minh được gì.
   */
  function mayChuHong(soLanCat: number, than: string) {
    let dem = 0;
    const log: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const http = require('http');
    const sv = http.createServer((rq: { url: string }, rs: Record<string, (...a: unknown[]) => void> & { socket: { destroy(): void } }) => {
      log.push(rq.url);
      if (dem++ < soLanCat) { rs.socket.destroy(); return; }
      if (rq.url === '/mat') { rs.writeHead(404, { 'content-type': 'text/html' }); rs.end('<h1>404</h1>'); return; }
      rs.writeHead(200, { 'content-type': 'text/html' });
      rs.end(than);
    });
    return new Promise<{ url: string; log: string[]; close(): Promise<void> }>((res) => {
      sv.listen(0, '127.0.0.1', () => {
        const port = (sv.address() as { port: number }).port;
        res({
          url: `http://127.0.0.1:${port}`,
          log,
          close: () => new Promise<void>((r) => sv.close(() => r())),
        });
      });
    });
  }

  test('KHÔNG vào được app ⇒ NÉM, KHÔNG trả về "0 màn, observed"', async () => {
    /*
     * Lý do chốt này tồn tại, đo 01/11/2026: dưới tranh chấp tài nguyên, `goto` tới trang đầu hết hạn ở
     * 15s trong khi `http.get` thuần tới CÙNG URL đáp 6–48ms. Lượt bò khi đó trả `{screens: [], ti_le: 0,
     * status: 'observed'}` — và `dimension_manifest` lấy `screens` làm MẪU SỐ, nên mẫu số 0 đi tiếp mà
     * không ai chặn. Đúng lớp lỗi "0% lỗi trên 0 request".
     */
    const chet = await mayChuHong(0, '');
    const cong = new URL(chet.url).port;
    await chet.close();   // đóng ngay: cần một CỔNG CHẾT, và đây là cách lấy cổng chắc chắn không ai nghe

    let loi: (Error & { code?: string }) | null = null;
    try {
      await cr.boApp(br, { baseUrl: `http://127.0.0.1:${cong}`, coCo: true, doTre: 0, keoSnapshot: false });
    } catch (e) { loi = e as Error & { code?: string }; }
    expect(loi, 'lượt bò không vào được app PHẢI ném, không được trả kết quả').not.toBeNull();
    expect(loi!.code).toBe('BO_DUOC_0_MAN');
    expect(loi!.message).toMatch(/phép đo KHÔNG CHẠY ĐƯỢC/);
  });

  test('`maxTrang: 0` vẫn trả về bình thường — xin bò 0 trang KHÁC không vào được app', async () => {
    /* Ngoại lệ duy nhất của chốt trên. Thiếu phép kiểm này thì chốt kia dễ bị siết thành luôn-ném. */
    const r = await bo({ maxTrang: 0, keoSnapshot: false });
    expect((r.screens as Man[]).length).toBe(0);
    expect(r.crawl_completeness.khong_toi_duoc.budget, 'và phần bị cắt phải được kê').toBeGreaterThan(0);
    expect(r.crawl_completeness.khong_toi_duoc.error, 'KHÔNG có lỗi nào — đây là ngân sách, không phải sự cố').toBe(0);
  });

  test('điều hướng hỏng NHẤT THỜI ⇒ thử lại và đi tiếp; 404 thì KHÔNG thử lại', async () => {
    const mc = await mayChuHong(2, '<html><body><a href="/mat">Mất</a><h1>Trang chủ</h1></body></html>');
    try {
      const r = await cr.boApp(br, { baseUrl: mc.url, coCo: true, doTre: 0, keoSnapshot: false });
      /* ĐỐI CHỨNG DƯƠNG: thử lại PHẢI bắn — nếu 0 thì phép kiểm này không chứng minh gì. */
      expect(r.crawl_completeness.so_lan_thu_lai_dieu_huong, 'hai lượt đầu bị cắt kết nối thì phải có thử lại')
        .toBeGreaterThan(0);
      expect((r.screens as Man[]).length, 'và lượt bò vẫn phải tới được trang chủ').toBeGreaterThan(0);
      /*
       * ĐỐI CHỨNG ÂM: `/mat` trả 404 — đó là câu trả lời THẬT của server, không phải sự cố nhất thời,
       * nên nó phải được gọi ĐÚNG MỘT LẦN. Thử lại 4xx là cách êm ái nhất để biến một câu trả lời rõ
       * ràng thành ba lần hỏi cùng một câu.
       */
      const soLanGoiMat = mc.log.filter((u) => u === '/mat').length;
      expect(soLanGoiMat, '404 KHÔNG được thử lại').toBe(1);
      /*
       * ĐỐI CHỨNG cho bước DỰNG LẠI PAGE ở trang đầu. Đo được lúc một lượt `goto` đang treo: page mới
       * qua sau 27ms, còn chờ trên page cũ mất 11,4s. Thiếu phép kiểm này thì bước dựng lại page có thể
       * chết đi mà không ai biết, và lượt bò lại quay về chờ 15s mỗi lần.
       */
      const ct = r.crawl_completeness.chi_tiet_thu_lai as { page_moi?: boolean }[];
      expect(ct.some((x) => x.page_moi === true), 'thử lại ở TRANG ĐẦU phải dựng page mới').toBe(true);
    } finally { await mc.close(); }
  });

  test('danh tính màn KHÔNG phụ thuộc việc bấm được bao nhiêu khối', async () => {
    /*
     * LỖI THẬT, đo 01/11/2026, và nó đánh đúng vào điểm kit tự nhận là số 1 vượt kit A.
     *
     * `moCacKhoi` bấm `[role="tab"]`, mà bấm tab sau thì ẨN tabpanel trước. Bản cũ đọc dấu vân tay ĐÚNG
     * MỘT LẦN ở cuối, nên nó chỉ thấy nội dung của tab được bấm CUỐI CÙNG:
     *   · bấm tab       ⇒ chữ ký `/truong/:id` = [[],["tab"],[]]
     *   · không bấm tab ⇒ chữ ký `/truong/:id` = [[],["data_table","tab"],[]]
     * Tức lượt bò TỰ PHÁ thứ nó đang đo — `data_table` biến mất vì chính cú bấm của crawler.
     *
     * Hai hậu quả: thứ tự và số tab bấm được phụ thuộc trần 250ms/400ms/8s, nên dưới tải cùng một route
     * sinh HAI danh tính (đo được một lượt bò ra 8 màn trong khi 9 lượt khác ra 7); và `components` của
     * màn là mẫu số cho chiều Validation, nên một màn có bảng mà báo "không có data_table" làm mọi tỉ lệ
     * phủ về sau tính trên mẫu số thiếu.
     *
     * PHÉP ĐO Ở ĐÂY KHÔNG CẦN TẢI, nên nó tất định: hai nhánh khác nhau ĐÚNG MỘT điều — tab có được bấm
     * hay không, chặn bằng `nut_cam_bam`. Đó là cách mô phỏng "dưới tải, crawler không bấm kịp".
     */
    const boVoiCam = async (camThem: string[]) => {
      const cfg = fw.napCfg();
      cfg.nut_cam_bam = [...(cfg.nut_cam_bam || []), ...camThem];
      return cr.boApp(br, { baseUrl: srv.url, coCo: true, cfg, doTre: 0, keoSnapshot: false });
    };
    const coBam = await boVoiCam([]);
    const khongBam = await boVoiCam(['hạ tầng', 'đội ngũ', 'thông tin chung']);

    const man = (r: Record<string, any>) => (r.screens as Man[]).find((x) => x.route === '/truong/:id')!;
    const a = man(coBam);
    const b = man(khongBam);

    /* ĐỐI CHỨNG rằng hai nhánh THẬT SỰ khác nhau — nếu không thì phép kiểm này không chứng minh gì. */
    expect((a as unknown as { khoi_da_mo: string[] }).khoi_da_mo.length, 'nhánh có bấm phải mở được NHIỀU khối hơn')
      .toBeGreaterThan((b as unknown as { khoi_da_mo: string[] }).khoi_da_mo.length);

    expect(cr.danhTinh('/truong/:id', cr.chuKyCauTruc(b)), 'danh tính phải GIỐNG dù bấm được bao nhiêu khối')
      .toBe(cr.danhTinh('/truong/:id', cr.chuKyCauTruc(a)));
    /* Và mẫu số phải ĐÚNG ở cả hai nhánh: màn này CÓ bảng, bấm tab không được làm nó biến mất. */
    for (const [ten, m] of [['có bấm', a], ['không bấm', b]] as [string, Man][]) {
      expect(m.components, `${ten}: màn chi tiết có bảng, phải thấy data_table`).toContain('data_table');
      expect(m.components, `${ten}: và vẫn phải thấy tab`).toContain('tab');
    }
    expect((coBam.screens as Man[]).map((x) => x.route)).toEqual((khongBam.screens as Man[]).map((x) => x.route));
  });

  test('phép hợp dấu vân tay là phép CỘNG — không lượt đọc nào bị bỏ', () => {
    /*
     * Đối chứng cho chính `gopDauVanTay`, không qua browser: hợp hai lượt đọc rời phải ra HỢP của chúng.
     * Thiếu phép kiểm này thì một ngày nào đó hàm hợp đổi thành "lấy lượt cuối" mà không ai thấy.
     */
    const d1 = {
      route: '/x', title_observed: 'X', fields: [{ nhan: 'Mã', code_loai: 'text' }],
      components: ['data_table'], component_chua_map: [], loai_field_quan_sat: ['text'],
      snapshot: { tables: [{ headers: ['Mã', 'Tên'] }] },
    };
    const d2 = {
      route: '/x', title_observed: 'X', fields: [{ nhan: 'Ngày', code_loai: 'date' }],
      components: ['tab'], component_chua_map: [], loai_field_quan_sat: ['date'],
      snapshot: { tables: [{ headers: ['Khối'] }] },
    };
    const g = cr.gopDauVanTay([d1, d2]);
    expect(g.components).toEqual(['data_table', 'tab']);
    expect(g.so_field, 'field của CẢ hai lượt đọc').toBe(2);
    expect(g.loai_field_quan_sat).toEqual(['date', 'text']);
    expect(g.snapshot.tables.map((t: { headers: string[] }) => t.headers)).toEqual([['Mã', 'Tên'], ['Khối']]);
    expect(g.so_lan_doc_van_tay).toBe(2);
    /* Field TRÙNG giữa hai lượt đọc chỉ được đếm MỘT lần — hợp là tập, không phải cộng dồn. */
    const h = cr.gopDauVanTay([d1, d1]);
    expect(h.so_field, 'cùng một field đọc hai lượt vẫn là một field').toBe(1);
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
    await expect(cr.boApp(br, { baseUrl: 'https://appmau.example.vn/', coCo: true }))
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
  test('trang vượt trần MỖI TRANG ⇒ vào `khong_toi_duoc.error`, KHÔNG thành một màn', async () => {
    /*
     * Làm chậm bằng `doTre` × số khối, KHÔNG bằng khối chặn JS trong trang. Đây là một lần sửa flaky
     * của chính test này, và lý do đầy đủ nằm ở `/trang-cham` trong fixture: hai bản trước chặn luồng
     * JS bằng `setInterval`, xanh khi chạy một mình và đỏ khi chạy cùng 8 file spec khác, vì Chromium
     * hãm timer ở trang đang ẩn nên "đang bị chặn" mà luồng vẫn rảnh.
     *
     * 4 khối × 500ms là 2 giây xử lý, đo bằng `page.waitForTimeout` phía điều khiển, trên trần 1 giây.
     */
    /*
     * TÊN CŨ LÀ "bỏ qua trang đó, lượt bò ĐI TIẾP", và nó KHAI QUÁ — phát hiện 01/11/2026 khi chốt
     * `BO_DUOC_0_MAN` làm phép kiểm này đỏ.
     *
     * Lượt bò ở đây chỉ có ĐÚNG MỘT trang, nên không có chỗ nào để "đi tiếp" tới. Nặng hơn: `gomLink`
     * chạy SAU trần mỗi trang, nên một trang hết giờ KHÔNG đóng góp link nào — tức từ một trang đầu hết
     * giờ thì lượt bò không thể đi tiếp, dù mã có muốn. Nhánh "một trang hỏng không làm chết cả lượt"
     * được gác thật ở phép kiểm `điều hướng hỏng NHẤT THỜI…` phía trên: ở đó `/` vào được và `/mat` trả
     * 404, nên lượt bò vừa có trang hỏng vừa có màn thật.
     *
     * Việc còn lại của phép kiểm này — và nó có giá trị riêng — là: trang vượt trần phải vào
     * `khong_toi_duoc.error` kèm lý do đọc được, và KHÔNG được tính là một màn đã bò.
     */
    const cfg = fw.napCfg();
    cfg.gioi_han_luot_bo = { ...cfg.gioi_han_luot_bo, thoi_gian_moi_trang_giay: 1 };
    let loi: (Error & { code?: string; chi_tiet?: { error: { vi_sao?: string }[] } }) | null = null;
    try {
      await cr.boApp(br, {
        baseUrl: `${srv.url}/trang-cham?khoi=4`, coCo: true, cfg, doTre: 500, keoSnapshot: false, doSau: 0,
      });
    } catch (e) { loi = e as Error & { code?: string; chi_tiet?: { error: { vi_sao?: string }[] } }; }

    /*
     * NÉM, không trả về 0 màn: trang duy nhất của lượt bò đã hết giờ, nên lượt này KHÔNG đo được gì —
     * và `screens: []` mà mang nhãn `observed` thì đi tiếp vào mẫu số của `dimension_manifest`.
     */
    expect(loi, 'lượt bò không còn màn nào PHẢI ném').not.toBeNull();
    expect(loi!.code).toBe('BO_DUOC_0_MAN');
    const ds = (loi!.chi_tiet || { error: [] }).error;
    expect(ds.length, `trang chậm phải vào danh sách không tới được — ${JSON.stringify(loi!.chi_tiet)}`).toBeGreaterThan(0);
    expect(String(ds[0].vi_sao)).toMatch(/quá 1s cho một trang/);
  });

  test('trần mỗi trang KHÔNG làm teo một lượt bò bình thường', async () => {
    /*
     * Tên cũ là "một trang hỏng KHÔNG làm chết cả lượt", và nó cũng khai quá: fixture không có trang nào
     * vượt trần 2 giây, nên phép kiểm này chưa bao giờ có một trang hỏng để mà chứng minh. Nhánh ấy nay
     * do phép kiểm `điều hướng hỏng NHẤT THỜI…` gác, với một trang 404 thật.
     *
     * Việc thật của nó: hạ trần mỗi trang xuống 2 giây KHÔNG được làm teo lượt bò bình thường — tức
     * trần ấy không bắn oan.
     */
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
   * `nut_cam_bam` chỉ gác lượt BẤM NÚT; `gomLink` gom mọi `a[href]` mà không kiểm nhãn. Trên app mẫu,
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
