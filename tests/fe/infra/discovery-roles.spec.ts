import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { chromium, Browser, Page } from '@playwright/test';

/*
 * @infra — MA TRẬN VAI TRÒ × ROUTE (v2.6.0 §A4), điểm số 2 trong 10 điểm vượt kit A.
 *
 * Điểm yếu của A: chỉ thấy phần MỘT tài khoản thấy. Đo được ở chính dự án này: lượt bò fixture bằng vai
 * trò mặc định tìm 6/7 màn, vì `/admin` bị ẩn khỏi menu nên BFS theo link không có đường tới — trong khi
 * server vẫn trả 200 cho URL đó.
 *
 * BA MỨC BẰNG CHỨNG của A phải sống nguyên: `verified` · `config` · `unknown`. Và luật cứng nhất của mục
 * này: ô `unknown` **KHÔNG được làm tròn thành "không có quyền"**. Làm tròn một lần là mất luôn cả lớp
 * case phân quyền, mà báo cáo vẫn trông đầy đủ.
 *
 * HAI ĐƯỜNG DẪN TỚI CÙNG MỘT LỖ, và fixture dựng cả hai:
 *   · `/admin`        — ẩn khỏi menu của `nhanvien`, hiện với `admin`, server trả 200;
 *   · `/bao-cao-emis` — hiện với cả hai vai trò nhưng KHOÁ nút (aria-disabled), server vẫn trả 200.
 * Đường thứ hai là chỗ tôi bỏ sót ở bản đầu: ô `hien_disabled` không thử URL thì nó đọc như "đã bị
 * chặn", trong khi ta chỉ biết client đang khoá nút.
 */
const FXDIR = path.resolve(__dirname, '..', 'fixtures', 'discovery-app');
const DIR = path.resolve(__dirname, '..', '..', '..', 'scripts', 'qa', 'discovery');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fixture = require(path.join(FXDIR, 'server.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const rl = require(path.join(DIR, 'roles.js'));

type Srv = { url: string; store: { soLanGhi: number }; reset(): void; close(): Promise<void> };
type O = {
  role: string; route: string; quan_sat: string; muc_bang_chung: string;
  vai_khac_thay: string[]; server_co_chan?: boolean | string; nhan_menu?: string; status?: number;
};

let srv: Srv;
let br: Browser;
test.beforeAll(async () => { srv = await fixture.start(); br = await chromium.launch(); });
test.afterAll(async () => { await br.close(); await srv.close(); });

/*
 * Hàm đăng nhập do BÊN GỌI truyền vào — `roles.js` không đọc và không in credential. Trên fixture, "đăng
 * nhập" là bấm nút đổi vai trò (POST /login, ngoại lệ duy nhất của tường lửa).
 */
const doiVai = (muon: string) => async (page: Page) => {
  const hien = (await page.locator('#vaiTro').innerText()).trim();
  if (hien !== muon) {
    await page.getByRole('button', { name: 'Đổi vai trò' }).click();
    await page.waitForLoadState('domcontentloaded');
  }
};

let memo: Promise<Record<string, unknown>> | null = null;
function maTran() {
  if (memo) {
    return memo;
  }
  memo = rl.lapMaTran(br, {
    baseUrl: srv.url, coCo: true, doTre: 0,
    vaiTro: [
      { ten: 'nhanvien', dangNhap: doiVai('nhanvien') },
      { ten: 'admin', dangNhap: doiVai('admin') },
    ],
    vaiTroKhongCoTaiKhoan: ['ketoan', 'hieutruong'],
    oConfig: [{ role: 'ketoan', route: '/truong', cho_phep: true, nguon: 'màn Cấu hình quyền, dòng 4' }],
    routeCanDo: ['/khong-ton-tai'],
  });
  return memo;
}
const o = (r: Record<string, unknown>, role: string, route: string) =>
  (r.role_route_matrix as O[]).find((x) => x.role === role && x.route === route)!;

test.describe('@infra ba mức bằng chứng — và `unknown` KHÔNG thành "không có quyền"', () => {
  test('`verified`: đã đăng nhập đúng vai trò và thử thật', async () => {
    const r = await maTran();
    expect(o(r, 'nhanvien', '/truong').muc_bang_chung).toBe('verified');
    expect(o(r, 'nhanvien', '/truong').quan_sat).toBe('vao_duoc');
  });

  test('`config`: đọc từ màn cấu hình quyền, CHƯA đăng nhập thử — và nói rõ là chưa', async () => {
    /*
     * Mức này chỉ vào được qua `oConfig` do bên gọi truyền. Kit KHÔNG tự tìm màn cấu hình quyền: nó khác
     * nhau ở mỗi app, và một bộ dò đoán mò sẽ đọc một màn danh sách người dùng thành ma trận quyền.
     */
    const r = await maTran();
    const c = o(r, 'ketoan', '/truong') as O & { chua_dang_nhap_thu: boolean; nguon_cau_hinh: string };
    expect(c.muc_bang_chung).toBe('config');
    expect(c.quan_sat).toBe('cho_phep_theo_cau_hinh');
    expect(c.chua_dang_nhap_thu, 'phải ghi rõ là chưa đăng nhập thử').toBe(true);
    expect(c.nguon_cau_hinh).toMatch(/Cấu hình quyền/);
  });

  test('`unknown`: không có tài khoản ⇒ KHÔNG phải "không có quyền"', async () => {
    const r = await maTran();
    const c = o(r, 'hieutruong', '/truong');
    expect(c.muc_bang_chung).toBe('unknown');
    expect(c.quan_sat, 'tên trạng thái phải nói đúng chuyện đã xảy ra').toBe('khong_co_tai_khoan');
    expect(c.quan_sat).not.toMatch(/bi_chan|khong_cho_phep/);
  });

  test('`unknown`: không phán được (route lỗi) cũng KHÔNG thành `bi_chan`', async () => {
    /* `/khong-ton-tai` trả 404. "Không phán được" không thành một kết luận — cùng luật với verdict. */
    const r = await maTran();
    const c = o(r, 'nhanvien', '/khong-ton-tai');
    expect(c.muc_bang_chung).toBe('unknown');
    expect(c.quan_sat).toBe('khong_phan_duoc');
  });

  test('dòng tổng bắt buộc: người đọc biết NGAY tin được bao nhiêu phần', async () => {
    /*
     * Theo A. Không có dòng này thì một ma trận toàn `unknown` trông y như một ma trận đã kiểm chứng.
     * Đo trên fixture: 14 verified · 1 config · 17 unknown trên 32 ô — tức hơn một nửa chưa kiểm chứng,
     * và con số đó phải đập vào mắt.
     */
    const r = await maTran();
    const t = r.tong_bang_chung as Record<string, number>;
    expect(t.verified + t.config + t.unknown).toBe(t.tong);
    expect(t.tong).toBe((r.role_route_matrix as O[]).length);
    expect(String(r.canh_bao_unknown)).toMatch(/KHÔNG được đọc thành "không có quyền"/);
  });

  test('mỗi vai trò thiếu tài khoản ⇒ MỘT câu hỏi Critical riêng', async () => {
    const r = await maTran();
    const q = r.cau_hoi_ambiguity as { muc: string; cau_hoi: string }[];
    expect(q).toHaveLength(2);
    for (const x of q) expect(x.muc).toBe('Critical');
    expect(q.map((x) => x.cau_hoi).join(' ')).toMatch(/ketoan/);
    expect(q.map((x) => x.cau_hoi).join(' ')).toMatch(/hieutruong/);
  });
});

test.describe('@infra ẩn so với hiện-nhưng-disabled — hai lời khai khác nhau', () => {
  test('`/bao-cao-emis` hiện nhưng KHOÁ ⇒ `hien_disabled`, không phải `vao_duoc`', async () => {
    const r = await maTran();
    const c = o(r, 'nhanvien', '/bao-cao-emis');
    expect(c.quan_sat).toBe('hien_disabled');
    expect(c.nhan_menu).toMatch(/Báo cáo EMIS/);
  });

  test('đọc được `disabled` khai bằng CẢ BA cách mà app thật dùng', async () => {
    /*
     * `disabled` không tồn tại trên thẻ `<a>` theo chuẩn, nên app thật khai nó bằng ba cách khác nhau.
     * Thiếu một cách là xếp một ô "hiện nhưng không bấm được" thành "vào được" — hai thứ có case khác nhau.
     */
    const pg = await br.newPage();
    /*
     * PHẢI điều hướng tới một origin HTTP trước khi `setContent`. Bản đầu gọi `setContent` trên
     * `about:blank`, nên `href="/a"` không giải được thành URL và `new URL(a.href).pathname` ném — menu
     * trả về rỗng, và test đỏ với "Cannot read properties of undefined".
     */
    await pg.goto(srv.url);
    await pg.setContent(`<nav>
      <a href="/a" aria-disabled="true">A</a>
      <a href="/b" class="nav-link disabled">B</a>
      <a href="/c" style="pointer-events:none">C</a>
      <a href="/d">D</a>
    </nav>`);
    const menu = await rl.docMenu(pg);
    await pg.close();
    const m = (r: string) => menu.find((x: { route: string }) => x.route === r);
    expect(m('/a').disabled, 'aria-disabled').toBe(true);
    expect(m('/b').disabled, 'class disabled').toBe(true);
    expect(m('/c').disabled, 'pointer-events: none').toBe(true);
    expect(m('/d').disabled, 'ÂM BẢN: link thường KHÔNG được coi là disabled').toBe(false);
  });

  test('ô disabled VẪN thử URL — client khoá nút không chứng minh server có chặn', async () => {
    const r = await maTran();
    const c = o(r, 'nhanvien', '/bao-cao-emis');
    expect(c.server_co_chan, 'server trả 200 ⇒ việc chặn chỉ ở client').toBe(false);
  });
});

test.describe('@infra EXPANSION_FINDING — đủ HAI VẾ mới ghi', () => {
  test('menu ẩn + vai trò khác thấy + URL vào được ⇒ finding', async () => {
    const r = await maTran();
    const f = (r.expansion_findings as { vi_sao: string; evidence: { route: string; role: string } }[])
      .find((x) => x.evidence.route === '/admin' && x.evidence.role === 'nhanvien');
    expect(f, '`/admin` phải ra finding').toBeTruthy();
    expect(f!.vi_sao).toMatch(/app tự phân biệt theo vai trò/);
    expect(f!.vi_sao).toMatch(/nói hai điều khác nhau/);
  });

  test('nút bị KHOÁ mà server vẫn mở ⇒ cũng là finding (đường vào thứ hai)', async () => {
    /* Chỗ tôi bỏ sót ở bản đầu: `hien_disabled` không thử URL thì lỗ này không bao giờ lộ ra. */
    const r = await maTran();
    const f = (r.expansion_findings as { vi_sao: string; evidence: { route: string } }[])
      .filter((x) => x.evidence.route === '/bao-cao-emis');
    expect(f.length, 'cả hai vai trò đều gặp ⇒ 2 finding').toBe(2);
    expect(f[0].vi_sao).toMatch(/việc chặn chỉ nằm ở client/);
  });

  test('THIẾU VẾ ①: route ẩn với MỌI vai trò ⇒ KHÔNG ghi finding', async () => {
    /*
     * Đây là chỗ dễ sinh báo động giả nhất. Rất nhiều app ẩn menu cho gọn trong khi route cố ý mở cho mọi
     * người — ẩn như vậy KHÔNG phải một lời khai về quyền. Chỉ khi app TỰ phân biệt theo vai trò (hiện với
     * vai trò này, ẩn với vai trò kia) thì việc ẩn mới nói điều gì, và lúc đó nó mâu thuẫn với server.
     *
     * `/khong-ton-tai` và `/bao-cao` đều không thoả: cái đầu không vào được, cái sau hiện với cả hai.
     */
    const r = await maTran();
    const route = (r.expansion_findings as { evidence: { route: string } }[]).map((x) => x.evidence.route);
    expect(route).not.toContain('/khong-ton-tai');
    expect(route).not.toContain('/bao-cao');
    for (const f of r.expansion_findings as { evidence: { route: string; vai_khac_thay?: string[] } }[]) {
      const c = (r.role_route_matrix as O[]).find((x) => x.route === f.evidence.route)!;
      expect(c, `finding ${f.evidence.route} phải có ô tương ứng trong ma trận`).toBeTruthy();
    }
  });

  test('finding KHÔNG tự kết luận là bug — phải nói rõ cần người quyết', async () => {
    /*
     * `finding.js`: `EXPANSION_FINDING` là defect không cần oracle ngoài, nhưng nó KHÔNG phải verdict của
     * case gốc, và log bug là quyết định của người. Ở đây còn một lý do nữa: menu ẩn cho gọn mà route cố
     * ý mở là chuyện có thật.
     */
    const r = await maTran();
    for (const f of r.expansion_findings as { loai: string; can_nguoi_quyet: string; self_inconsistent: boolean; status: string }[]) {
      expect(f.loai).toBe('EXPANSION_FINDING');
      expect(f.self_inconsistent, 'đây là app tự mâu thuẫn ⇒ không cần oracle ngoài').toBe(true);
      expect(f.can_nguoi_quyet).toMatch(/Hỏi BA trước khi log bug/);
      expect(f.status).toBe('observed');
    }
  });
});

test.describe('@infra an toàn — chỉ GET, không ghi, không đọc credential', () => {
  test('sau cả lượt lập ma trận: 0 lượt ghi tới server', async () => {
    srv.reset();
    memo = null;                       // bò lại thật, không dùng bản đã ghi nhớ
    const r = await maTran();
    expect(srv.store.soLanGhi, `nhật ký ghi: ${JSON.stringify((srv.store as unknown as { nhatKyGhi: unknown[] }).nhatKyGhi)}`).toBe(0);
    /*
     * `POST /login` là ngoại lệ CỐ Ý và KHÔNG được đếm thành rò rỉ. Bản đầu của `tomTat()` đếm nó, nên
     * test này đỏ với `request_ghi_lot: 1` trong khi server không nhận lượt ghi nào. Chuyện đó đáng sửa
     * chứ không đáng bỏ qua: mọi lượt chạy THẬT đều phải đăng nhập, nên bảo đảm "0 request ghi lọt" sẽ
     * luôn sai một đơn vị — rồi người ta nới ngưỡng thành `<= 1`, và một rò rỉ THẬT lọt qua.
     */
    for (const t of r.tuong_lua as { request_ghi_lot: number; request_ghi_ngoai_le_dang_nhap: number }[]) {
      expect(t.request_ghi_lot, 'rò rỉ phải là 0').toBe(0);
    }
    const tongDangNhap = (r.tuong_lua as { request_ghi_ngoai_le_dang_nhap: number }[])
      .reduce((n, t) => n + t.request_ghi_ngoai_le_dang_nhap, 0);
    expect(tongDangNhap, 'nhưng lượt đăng nhập phải HIỆN RA, không bị che').toBeGreaterThan(0);
  });

  test('mã nguồn KHÔNG đọc `task.env` và KHÔNG in credential', () => {
    /*
     * Hàm đăng nhập do bên gọi truyền vào, nên file này không cần biết mật khẩu. Gác chuyện đó bằng máy:
     * một lượt sửa "cho tiện" rất dễ thêm `loadEnv()` rồi log giá trị ra bản ghi khám phá.
     */
    /*
     * Kiểm ĐƯỜNG ĐỌC, không kiểm chuỗi. Bản đầu cấm mọi chuỗi `task.env` và đỏ ngay — vì `roles.js` có
     * dùng `'task.env'` làm NHÃN cho cột `nguon` của vai trò. Một nhãn không phải một lượt đọc, và một
     * phép kiểm không phân biệt được hai thứ đó thì nó cấm cả việc ghi tài liệu cho tử tế.
     */
    const src = fs.readFileSync(path.join(DIR, 'roles.js'), 'utf8');
    const than = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');   // bỏ chú thích, chỉ soi mã
    for (const xau of ['loadEnv', 'readFileSync', 'process.env', 'PASSWORD', 'SECRET', 'console.log']) {
      expect(than, `mã nguồn có đường đọc hoặc in credential: "${xau}"`).not.toContain(xau);
    }
    expect(than, 'hàm đăng nhập phải do BÊN GỌI truyền vào').toMatch(/v\.dangNhap\(page\)/);
  });

  test('KHÔNG có vai trò nào ⇒ ném, không tự suy ma trận từ một tài khoản', async () => {
    /* A nói rõ: suy quyền của role B từ hành vi của role A là bịa. */
    await expect(rl.lapMaTran(br, { baseUrl: srv.url, coCo: true, vaiTro: [] }))
      .rejects.toThrow(/ít nhất một vai trò/);
  });

  test('host không rõ ⇒ TỪ CHỐI trước khi mở trang nào', async () => {
    await expect(rl.lapMaTran(br, {
      baseUrl: 'https://qemis.example.vn/', coCo: true,
      vaiTro: [{ ten: 'x', dangNhap: async () => {} }],
    })).rejects.toThrow(/TỪ CHỐI/);
  });
});
