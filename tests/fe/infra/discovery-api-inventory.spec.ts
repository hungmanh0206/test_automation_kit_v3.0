import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { chromium, Browser } from '@playwright/test';

/*
 * @infra — DANH MỤC API (v2.6.0 §A5), điểm số 3 trong 10 điểm vượt kit A.
 *
 * A có đọc tầng network nhưng chỉ GHI LẠI danh sách endpoint, nên không trả lời được ba câu Phase 1 cần:
 * endpoint nào UI gọi mà đặc tả không có · endpoint nào đặc tả có mà không UI nào gọi · trường nào là enum.
 *
 * HAI KẾT LUẬN SAI bị phép đo lộ ra khi viết, cả hai do CƠ CHẾ AN TOÀN của chính Bước 0 sinh ra — đúng lớp
 * lỗi khó nghi ngờ nhất, vì không ai soi một con số do hàng rào an toàn tạo ra:
 *   ① `POST /api/truong` và `DELETE /api/truong/:id` bị xếp vào vế "spec khai mà KHÔNG ai gọi". Đọc thành
 *      "tính năng chưa build" là sai: crawler CỐ Ý không bấm nút Lưu/Xoá nên không bao giờ kích hoạt
 *      đường ghi. Nay tách thành vế riêng theo METHOD.
 *   ② `GET /api/truong` bị gán "tường lửa chặn" — sai, GET nằm trong `method_cho_phep`. Lượt fetch đó bị
 *      HUỶ khi crawler điều hướng sang trang khác (`ERR_ABORTED`). Nay phân biệt theo `errorText`.
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

const FXDIR = path.resolve(__dirname, '..', 'fixtures', 'discovery-app');
const DIR = path.resolve(__dirname, '..', '..', '..', 'scripts', 'qa', 'discovery');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fixture = require(path.join(FXDIR, 'server.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ai = require(path.join(DIR, 'api_inventory.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cr = require(path.join(DIR, 'crawl.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fw = require(path.join(DIR, 'write_firewall.js'));

const OPENAPI = path.join(FXDIR, 'openapi.json');
type Srv = { url: string; store: { soLanGhi: number }; reset(): void; close(): Promise<void> };
type Api = { method: string; path_chuan: string; so_lan: number; goi_tu: string[]; hinh_dang: Record<string, string>; truong_enum: Record<string, { do_tin: string; gia_tri: string[] }>; bi_tuong_lua_chan: boolean; that_bai_khac?: string; status: string };

let srv: Srv;
let br: Browser;
test.beforeAll(async () => { srv = await fixture.start(); br = await chromium.launch(); });
test.afterAll(async () => { await br.close(); await srv.close(); });

/** Bò một lượt kèm bộ theo dõi API. Dùng lại cho các test chỉ ĐỌC kết quả. */
let memo: Promise<{ inv: Record<string, unknown>; crawl: Record<string, unknown> }> | null = null;
function boVaTongHop() {
  if (memo) return memo;
  memo = (async () => {
    let rec: ReturnType<typeof ai.theoDoi> | null = null;
    const goc = br.newPage.bind(br);
    // `boApp` tự tạo page, nên gắn bộ theo dõi ngay lúc page sinh ra — trước `goto` đầu tiên.
    (br as unknown as { newPage: unknown }).newPage = async (...a: unknown[]) => {
      const pg = await (goc as (...x: unknown[]) => Promise<unknown>)(...a);
      rec = ai.theoDoi(pg);
      return pg;
    };
    try {
      const crawl = await cr.boApp(br, {
        baseUrl: srv.url, coCo: true, keoSnapshot: false, doTre: 0,
        get apiRec() { return rec; },
      });
      return { inv: ai.tongHop(rec, { openapiPath: OPENAPI }), crawl };
    } finally { (br as unknown as { newPage: unknown }).newPage = goc; }
  })();
  return memo;
}

test.describe('@infra danh mục API — đối chiếu HAI CHIỀU với OpenAPI', () => {
  test('endpoint UI gọi mà spec KHÔNG khai ⇒ nêu ra (phải HỎI)', async () => {
    const { inv } = await boVaTongHop();
    const dc = inv.doi_chieu_openapi as Record<string, string[]>;
    /* Fixture cố ý bỏ `/api/loi-sql` khỏi openapi.json, trong khi màn `/bao-cao` gọi nó thật. */
    expect(dc.ui_goi_spec_khong_khai).toContain('GET /api/loi-sql');
  });

  test('endpoint spec khai mà KHÔNG ai gọi ⇒ nêu ra, và CHỈ gồm endpoint ĐỌC', async () => {
    const { inv } = await boVaTongHop();
    const dc = inv.doi_chieu_openapi as Record<string, string[]>;
    /* Fixture cố ý khai thêm `/api/giao-vien` — không UI nào gọi. */
    expect(dc.spec_khai_khong_ai_goi).toContain('GET /api/giao-vien');
    for (const k of dc.spec_khai_khong_ai_goi) {
      expect(k, `"${k}" là endpoint GHI, không được nằm ở vế này`).toMatch(/^(GET|HEAD|OPTIONS) /);
    }
  });

  test('KẾT LUẬN SAI ①: endpoint GHI vắng mặt KHÔNG phải "chưa build" — tách vế riêng', async () => {
    /*
     * Crawler cố ý không bấm Lưu/Xoá nên không bao giờ kích hoạt đường ghi. Để lẫn thì người đọc thấy
     * "POST /api/truong: không ai gọi" rồi hiểu thành "tính năng chưa build". Một kết luận sai sinh ra
     * bởi chính luật an toàn của Bước 0.
     */
    const { inv } = await boVaTongHop();
    const dc = inv.doi_chieu_openapi as Record<string, string[] | string>;
    expect(dc.endpoint_ghi_crawler_co_y_khong_goi).toEqual(
      expect.arrayContaining(['POST /api/truong', 'DELETE /api/truong/:id']),
    );
    expect(dc.spec_khai_khong_ai_goi).not.toContain('POST /api/truong');
    expect(String(dc._luu_y), 'và phải nói rõ vì sao').toMatch(/cố ý không kích hoạt đường ghi/);
  });

  test('vế "spec khai mà không ai gọi" phải KÈM điều kiện đọc được', async () => {
    /* Lượt bò chưa tới màn gọi endpoint đó thì nó cũng rơi vào vế này — không phải "chưa build". */
    const { inv } = await boVaTongHop();
    const dc = inv.doi_chieu_openapi as Record<string, string>;
    expect(dc._luu_y).toMatch(/crawl_completeness/);
  });

  test('không có OpenAPI ⇒ nói rõ là KHÔNG đối chiếu được, không coi là lỗi', async () => {
    /*
     * Dự án này CHƯA có swagger (đã xác nhận). Nên nhánh OpenAPI phải là "có thì dùng". Không có spec
     * nào đòi nó xanh — đúng bài học G1.6 ở v2.5.0, nơi một hạng mục bị thu hẹp vì đo ra 0 file swagger.
     */
    const { inv } = await boVaTongHop();
    const khong = ai.tongHop({ bang: (inv.apis as Api[]).length ? new Map() : new Map() }, { openapiPath: '/khong/co/dau.json' });
    expect(khong.doi_chieu_openapi).toBeNull();
    expect(String(khong._khong_co_openapi)).toMatch(/KHÔNG đối chiếu được/);
    expect(String(khong._khong_co_openapi), 'và nói rõ đây không phải lỗi').toMatch(/không phải lỗi/);
  });

  test('`{id}` của OpenAPI và `:id` của crawler là CÙNG một endpoint', () => {
    const spec = ai.docOpenapi(OPENAPI) as Set<string>;
    expect([...spec]).toContain('GET /api/truong/:id');
    expect([...spec]).toContain('DELETE /api/truong/:id');
  });
});

test.describe('@infra request thất bại — ba lý do, không gộp thành một', () => {
  test('KẾT LUẬN SAI ②: `ERR_ABORTED` do điều hướng KHÁC tường lửa chặn', async () => {
    /*
     * Bản đầu gộp mọi `requestfailed` thành "bị tường lửa chặn" và báo `GET /api/truong` bị chặn — sai,
     * GET nằm trong `method_cho_phep`. Gộp lại thì một cơ chế an toàn bị gán cho chuyện nó không làm, và
     * người đọc mất đường lần ra nguyên nhân thật.
     */
    const { inv } = await boVaTongHop();
    const get = (inv.apis as Api[]).find((a) => a.method === 'GET' && a.path_chuan === '/api/truong')!;
    expect(get.bi_tuong_lua_chan, 'GET KHÔNG bao giờ bị tường lửa chặn').toBe(false);
    const dc = inv.doi_chieu_openapi as Record<string, string[]>;
    expect(dc.ui_goi_nhung_bi_chan, 'lượt bò không kích hoạt đường ghi nên danh sách này rỗng').toEqual([]);
  });

  test('request ghi THẬT bị tường lửa chặn ⇒ vẫn vào danh mục, mang cờ riêng', async () => {
    /*
     * Chỗ này phải bấm nút ghi THẬT (crawler không bao giờ làm), nên dùng page trực tiếp. Đây là ca chứng
     * minh "không quan sát được phản hồi" KHÁC "không ai gọi": endpoint vẫn có mặt trong danh mục.
     */
    srv.reset();
    const pg = await br.newPage();
    const rec = ai.theoDoi(pg);
    await fw.install(pg);
    rec.datRoute('/them-truong');
    await pg.goto(`${srv.url}/them-truong`);
    await pg.getByRole('button', { name: 'Ghi lại qua API' }).click();
    await pg.waitForTimeout(400);
    const inv = ai.tongHop(rec, { openapiPath: OPENAPI });
    await pg.close();

    const post = (inv.apis as Api[]).find((a) => a.method === 'POST' && a.path_chuan === '/api/truong');
    expect(post, 'endpoint bị chặn VẪN phải vào danh mục').toBeTruthy();
    expect(post!.bi_tuong_lua_chan).toBe(true);
    expect(post!.goi_tu, 'và quy được cho màn đã gọi nó').toContain('/them-truong');
    const dc = inv.doi_chieu_openapi as Record<string, string[]>;
    expect(dc.ui_goi_nhung_bi_chan).toContain('POST /api/truong');
    expect(dc.spec_khai_khong_ai_goi, 'KHÔNG được lẫn vào vế "không ai gọi"').not.toContain('POST /api/truong');
    expect(srv.store.soLanGhi, 'và tất nhiên: 0 lượt ghi tới server').toBe(0);
  });
});

test.describe('@infra hình dạng response — khoá và kiểu, KHÔNG lưu giá trị', () => {
  test('rút đúng khoá lồng nhau và kiểu', async () => {
    const { inv } = await boVaTongHop();
    const get = (inv.apis as Api[]).find((a) => a.method === 'GET' && a.path_chuan === '/api/truong')!;
    expect(Object.keys(get.hinh_dang)).toEqual(expect.arrayContaining([
      'items[]', 'items[].id', 'items[].ma', 'items[].ten', 'items[].trangThai', 'items[].siSo',
    ]));
    expect(get.hinh_dang['items[].siSo']).toBe('number');
    expect(get.hinh_dang['items[].ten']).toBe('string');
  });

  test('KHÔNG lưu giá trị của khoá có tên gợi PII', () => {
    /*
     * Response thật chứa họ tên, email, số điện thoại. Mặc định chỉ lưu khoá và kiểu; ngoại lệ duy nhất
     * là giá trị trông như MÃ TRẠNG THÁI. Khoá tên PII thì KHÔNG lấy giá trị, kể cả khi giá trị trông
     * như mã — một mã nhân sự vẫn là dữ liệu người.
     */
    const hd: Record<string, string> = {};
    const en: Record<string, Set<string>> = {};
    ai.rutHinhDang({
      items: [
        { ten: 'NguyenVanA', email: 'a@b.vn', cccd: '001234567890', trangThai: 'dang_hoat_dong' },
        { ten: 'TranThiB', email: 'c@d.vn', cccd: '001234567891', trangThai: 'tam_dung' },
      ],
    }, '', hd, en, 0);
    expect(Object.keys(en), 'chỉ trường trạng thái được gom giá trị').toEqual(['items[].trangThai']);
    expect(Object.keys(hd), 'nhưng HÌNH DẠNG vẫn phải có đủ khoá').toEqual(expect.arrayContaining([
      'items[].ten', 'items[].email', 'items[].cccd',
    ]));
  });

  test('`laMaTrangThai` loại tên người, email và câu — phải thoả CẢ BA điều kiện', () => {
    for (const v of ['dang_hoat_dong', 'ACTIVE', 'tam-dung', 'C2']) expect(ai.laMaTrangThai(v), `"${v}" là mã`).toBe(true);
    for (const v of ['Nguyễn Văn A', 'a@b.vn', 'Trường THCS Âu Cơ', '', 'x'.repeat(41), '0912345678 '.repeat(2)]) {
      expect(ai.laMaTrangThai(v), `"${String(v).slice(0, 20)}" KHÔNG phải mã`).toBe(false);
    }
  });
});

test.describe('@infra ứng viên enum — có MỨC TIN CẬY, vì ngưỡng một mình không đủ', () => {
  test('tên khoá gợi trạng thái ⇒ `do_tin: cao` và thành ứng viên', async () => {
    const { inv } = await boVaTongHop();
    const uv = inv.ung_vien_trang_thai as { truong: string; do_tin: string; gia_tri: string[] }[];
    const tt = uv.find((x) => x.truong === 'items[].trangThai');
    expect(tt, 'trường trạng thái phải thành ứng viên').toBeTruthy();
    expect(tt!.do_tin).toBe('cao');
    expect(tt!.gia_tri).toEqual(expect.arrayContaining(['dang_hoat_dong', 'tam_dung']));
  });

  test('chỉ dựa cardinality ⇒ `do_tin: thap`, KHÔNG được đẩy lên ứng viên', async () => {
    /*
     * Đo được trên fixture 5 bản ghi: `items[].ma` (mã trường C1-010, C2-001, C2-002) lọt ngưỡng vì chỉ
     * có 3 giá trị. Trên dữ liệu thật 500 trường thì nó vượt ngưỡng và bị loại — tức CÙNG một trường cho
     * hai kết luận khác nhau tuỳ số bản ghi. Một tín hiệu như vậy không chấm được, nên nó ở lại mức thấp.
     * Để nó thành `SM-*` thì đó là oracle bịa.
     */
    const { inv } = await boVaTongHop();
    const uv = inv.ung_vien_trang_thai as { truong: string }[];
    const thap = inv.enum_do_tin_thap as { truong: string; vi_sao: string }[];
    expect(uv.map((x) => x.truong), 'mã trường KHÔNG được là ứng viên trạng thái').not.toContain('items[].ma');
    const ma = thap.find((x) => x.truong === 'items[].ma');
    expect(ma, 'nhưng vẫn phải HIỆN RA, không bị chôn').toBeTruthy();
    expect(ma!.vi_sao).toMatch(/có thể là DỮ LIỆU/);
  });

  test('mọi bản ghi đều `draft` — không tự thành `active`', async () => {
    const { inv } = await boVaTongHop();
    for (const a of inv.apis as Api[]) expect(a.status).toBe('draft');
    for (const u of inv.ung_vien_trang_thai as { status: string }[]) expect(u.status).toBe('draft');
    for (const s of inv.shared_surface_ung_vien as { status: string }[]) expect(s.status).toBe('draft');
  });
});

test.describe('@infra luật cứng — KHÔNG gọi API trực tiếp, và một nguồn một luật', () => {
  test('mã nguồn KHÔNG có đường gửi request', () => {
    /*
     * Luật của kit A, giữ nguyên: recon chỉ được quan sát THỤ ĐỘNG request do UI tự phát sinh. Gọi thẳng
     * API là hành vi kiểm thử xâm nhập, và trên môi trường dùng chung thì nguy hiểm. Một request tự tay
     * tạo ra cũng KHÔNG chứng minh được gì về hành vi của UI.
     */
    const src = fs.readFileSync(path.join(DIR, 'api_inventory.js'), 'utf8');
    const than = src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');   // bỏ chú thích, chỉ soi mã
    for (const xau of ['fetch(', 'axios', 'request.post', 'page.request', 'http.request', 'https.request', 'curl']) {
      expect(than, `mã nguồn chứa "${xau}" — file này KHÔNG được gửi request nào`).not.toContain(xau);
    }
  });

  test('chuẩn hoá path dùng CHUNG hàm với crawler', () => {
    /*
     * Hai nơi chuẩn hoá khác nhau thì `goi_tu` không khớp được với `screens[].route`, và `shared_surface`
     * tính sai. Nên `api_inventory` require thẳng `chuanHoaRoute` của crawler.
     */
    for (const u of ['http://x/api/truong/123', 'http://x/api/a/550e8400-e29b-41d4-a716-446655440000']) {
      expect(ai.chuanHoaPath(u)).toBe(cr.chuanHoaRoute(u));
    }
    expect(ai.chuanHoaPath('http://x/api/truong/123')).toBe('/api/truong/:id');
  });

  test('`shared_surface` cần từ 2 MÀN trở lên, và chỉ là ứng viên', async () => {
    const { inv } = await boVaTongHop();
    for (const s of inv.shared_surface_ung_vien as { so_man_goi: number }[]) {
      expect(s.so_man_goi).toBeGreaterThanOrEqual(2);
    }
    /* Trên fixture mỗi endpoint chỉ được một màn gọi ⇒ danh sách rỗng là ĐÚNG, không phải lỗi. */
    expect(Array.isArray(inv.shared_surface_ung_vien)).toBe(true);
  });

  test('`goi_tu` quy được request cho màn — nếu rỗng thì `shared_surface` vô nghĩa', async () => {
    const { inv } = await boVaTongHop();
    const get = (inv.apis as Api[]).find((a) => a.method === 'GET' && a.path_chuan === '/api/truong')!;
    expect(get.goi_tu).toEqual(['/truong']);
    const loi = (inv.apis as Api[]).find((a) => a.path_chuan === '/api/loi-sql')!;
    expect(loi.goi_tu).toEqual(['/bao-cao']);
  });
});
