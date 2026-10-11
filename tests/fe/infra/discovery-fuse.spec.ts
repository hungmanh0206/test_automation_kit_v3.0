import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { chromium, Browser } from '@playwright/test';

/*
 * @infra — GỘP NGUỒN VÀ BẢN ĐỒ PHỦ TÀI LIỆU (v2.6.0 §A6), điểm số 4 trong 10 điểm vượt kit A.
 *
 * Ô quan trọng nhất là `undocumented_present` — **vùng mù chính**: màn quan sát được trên app mà tài liệu
 * không có mục nào. Đây đúng là chỗ hệ quả nặng nhất: không có nguồn thì expected của màn đó chỉ còn là
 * "app đang hiện thế", tức tautology, và nó nhân lên theo số case.
 *
 * HAI LỖI THẬT bị phép đo lộ ra khi viết:
 *   ① Đếm độ phủ theo CHUỖI XUẤT HIỆN thì bẫy của fixture tự vô hiệu hoá: `fsd.md` cố ý không có mục nào
 *      cho `/bao-cao`, nhưng chuỗi đó vẫn xuất hiện MỘT lần — trong chính câu banner nói rằng màn đó bị
 *      thiếu. Lần thứ TÁM trong dự án một phép quét bắt đúng câu nói VỀ chính nó.
 *   ② Route gốc `/` không bao giờ khớp regex (regex đòi có ký tự sau dấu gạch), nên màn gốc CÓ mục trong
 *      tài liệu vẫn bị xếp vào vùng mù — một dương tính giả ngay ở màn đầu tiên.
 */
const FXDIR = path.resolve(__dirname, '..', 'fixtures', 'discovery-app');
const DIR = path.resolve(__dirname, '..', '..', '..', 'scripts', 'qa', 'discovery');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fixture = require(path.join(FXDIR, 'server.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fu = require(path.join(DIR, 'fuse.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cr = require(path.join(DIR, 'crawl.js'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ai = require(path.join(DIR, 'api_inventory.js'));

const FSD = path.join(FXDIR, 'fsd.md');
const OPENAPI = path.join(FXDIR, 'openapi.json');
type Vung = {
  loai: string; vung: string; o: string; muc_phu: string; chien_luoc: string;
  nguon_tai_lieu: { file: string; line: number } | null;
  nhac_trong_van_xuoi?: { line: number };
  quan_sat: { so_field: number } | null;
};

let srv: { url: string; close(): Promise<void> };
let br: Browser;
test.beforeAll(async () => { srv = await fixture.start(); br = await chromium.launch(); });
test.afterAll(async () => { await br.close(); await srv.close(); });

let memo: Promise<Record<string, unknown>> | null = null;
function gop() {
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
      const api = ai.tongHop(rec, { openapiPath: OPENAPI });
      return fu.gop({ crawl, api, taiLieu: [FSD] });
    } finally { (br as unknown as { newPage: unknown }).newPage = goc; }
  })();
  return memo;
}
const oCua = (f: Record<string, unknown>, route: string) => (f.doc_coverage as Vung[]).find((x) => x.vung === route)!;

test.describe('@infra bốn ô — và vùng mù là ô đáng sợ nhất', () => {
  test('`undocumented_present`: màn có thật mà tài liệu KHÔNG có mục ⇒ vùng mù', async () => {
    const f = await gop();
    expect(f.vung_mu).toEqual(['/bao-cao', '/bao-cao-emis']);
    const c = oCua(f, '/bao-cao');
    expect(c.o).toBe('undocumented_present');
    expect(c.muc_phu).toBe('trang');
    expect(c.nguon_tai_lieu).toBeNull();
    expect(c.chien_luoc, 'phải nói rõ hệ quả: không nguồn thì expected là tautology').toMatch(/tautology/);
  });

  test('LỖI ①: chuỗi trong BANNER không được tính là có tài liệu', async () => {
    /*
     * `fsd.md` dòng 3 là một blockquote nói "tệp này cố ý THIẾU màn /bao-cao". Nếu đếm theo chuỗi xuất
     * hiện thì chính câu cảnh báo đó làm màn bị thiếu được tính là đã có tài liệu — bẫy tự vô hiệu hoá,
     * và không test nào đỏ. Đo trực tiếp: chuỗi CÓ trong file, mà ô vẫn phải là vùng mù.
     */
    expect(fs.readFileSync(FSD, 'utf8'), 'banner phải còn, nó là một phần của bẫy').toContain('/bao-cao');
    const f = await gop();
    expect(oCua(f, '/bao-cao').o).toBe('undocumented_present');
  });

  test('LỖI ②: route gốc `/` CÓ mục trong tài liệu ⇒ `documented_present`', async () => {
    const f = await gop();
    const c = oCua(f, '/');
    expect(c.o, 'bản đầu xếp sai thành vùng mù vì regex không bắt được dấu gạch đứng một mình').toBe('documented_present');
    expect(c.nguon_tai_lieu!.line).toBe(15);
  });

  test('`documented_present`: có mục ⇒ chiến lược là ĐỐI CHIẾU, không phải dò lại', async () => {
    const f = await gop();
    for (const r of ['/truong', '/lop', '/them-truong', '/truong/:id']) {
      const c = oCua(f, r);
      expect(c.o, `${r} phải là documented_present`).toBe('documented_present');
      expect(c.nguon_tai_lieu!.file).toBe('fsd.md');
      expect(c.chien_luoc).toMatch(/Đối chiếu/);
      expect(c.chien_luoc, 'và cấm tự sửa expected khi lệch').toMatch(/KHÔNG tự sửa expected/);
    }
  });

  test('`documented_missing`: tài liệu khai mà không quan sát được ⇒ BA cách đọc, không chọn bừa', async () => {
    /*
     * "Chưa build" là cách đọc hấp dẫn nhất và dễ sai nhất. `/admin` chính là ví dụ sống: nó CÓ thật, chỉ
     * bị ẩn với vai trò dùng để bò. Nên chiến lược phải bắt người đọc đối chiếu `role_route_matrix` và
     * `crawl_completeness` TRƯỚC.
     */
    const f = await gop();
    for (const r of ['/admin', '/hoc-sinh']) {
      const c = oCua(f, r);
      expect(c.o, `${r} phải là documented_missing`).toBe('documented_missing');
      expect(c.quan_sat).toBeNull();
      expect(c.chien_luoc).toMatch(/BA cách đọc/);
      expect(c.chien_luoc).toMatch(/role_route_matrix/);
      expect(c.chien_luoc).toMatch(/crawl_completeness/);
    }
  });

  test('`/admin` là ví dụ sống của chuyện "chưa build" đọc sai', async () => {
    /* Nó ở ô `documented_missing` chỉ vì lượt bò dùng vai trò không thấy nó. Màn tồn tại thật. */
    const f = await gop();
    expect(oCua(f, '/admin').o).toBe('documented_missing');
    const pg = await br.newPage();
    const resp = await pg.goto(`${srv.url}/admin`);
    expect(resp!.status(), 'server vẫn trả 200 ⇒ "chưa build" là kết luận SAI').toBe(200);
    await pg.close();
  });

  test('tổng cộng đúng 9 vùng, và các ô cộng lại bằng tổng', async () => {
    const f = await gop();
    const t = f.tong as Record<string, number>;
    expect(t.documented_present + t.undocumented_present + t.documented_missing).toBe(t.tong_vung);
    expect(t.tong_vung).toBe((f.doc_coverage as Vung[]).length);
  });
});

test.describe('@infra độ phủ tính theo MỤC, không theo chuỗi', () => {
  function tam(md: string) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fuse-'));
    const p = path.join(d, 'tai-lieu.md');
    fs.writeFileSync(p, md, 'utf8');
    return { d, p };
  }

  test('TIÊU ĐỀ tính; Ô BẢNG tính; VĂN XUÔI không tính', () => {
    const { d, p } = tam([
      '# Tài liệu',
      '',
      '### 2.1. Màn A — `/man-a`',
      'Mô tả.',
      '',
      '| Màn | admin |',
      '|---|---|',
      '| `/man-b` | ✅ |',
      '',
      'Ngoài ra hệ thống còn có `/man-c` nhưng chưa mô tả ở đây.',
    ].join('\n'));
    try {
      const t = fu.docTaiLieu(p);
      expect([...t.theoTieuDe.keys()], 'tiêu đề').toContain('/man-a');
      expect([...t.trongBang.keys()], 'ô bảng').toContain('/man-b');
      expect([...t.vanXuoi.keys()], 'văn xuôi').toContain('/man-c');
      expect([...t.theoTieuDe.keys()]).not.toContain('/man-c');
      expect([...t.trongBang.keys()]).not.toContain('/man-c');
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('route chỉ nhắc trong văn xuôi ⇒ VẪN là vùng mù, nhưng ghi lại là đã được nhắc', () => {
    /*
     * Hai thông tin khác nhau, và trộn chúng là mất một cái: "tài liệu có biết màn này tồn tại" là tín
     * hiệu thật và đáng ghi; nó KHÔNG phải độ phủ. Người đọc cần biết cả hai để hỏi BA cho đúng câu.
     */
    const { d, p } = tam('# T\n\nHệ thống có `/man-x` nhưng tài liệu này chưa mô tả.\n');
    try {
      const f = fu.gop({
        crawl: { screens: [{ route: '/man-x', title_observed: 'Màn X', fields: [], components: [] }] },
        taiLieu: [p],
      });
      const c = (f.doc_coverage as Vung[])[0];
      expect(c.o).toBe('undocumented_present');
      expect(c.nhac_trong_van_xuoi, 'phải ghi lại là đã được nhắc').toBeTruthy();
      expect(c.nhac_trong_van_xuoi!.line).toBe(3);
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('khối code KHÔNG tính — ví dụ `curl /api/x` không phải một lời khai về màn', () => {
    const { d, p } = tam(['# T', '', '```bash', 'curl /man-trong-code', '```', ''].join('\n'));
    try {
      const t = fu.docTaiLieu(p);
      expect([...t.theoTieuDe.keys()]).not.toContain('/man-trong-code');
      expect([...t.vanXuoi.keys()]).not.toContain('/man-trong-code');
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('`{id}` và `:bat_ky` của tài liệu chuẩn hoá về `:id` của crawler', () => {
    expect(fu.chuanHoaRouteTaiLieu('/truong/{id}')).toBe('/truong/:id');
    expect(fu.chuanHoaRouteTaiLieu('/truong/:maTruong')).toBe('/truong/:id');
    expect(fu.chuanHoaRouteTaiLieu('/truong/')).toBe('/truong');
    expect(fu.chuanHoaRouteTaiLieu('/')).toBe('/');
  });

  test('`day_du` và `nghi_loi_thoi` KHÔNG do máy chấm — nói rõ ra', async () => {
    /*
     * A có bốn mức phủ. Máy chỉ chia được hai: có mục (`mot_phan`) và không có mục (`trang`). "Đầy đủ"
     * cần biết tài liệu nêu đủ validation/message/phân quyền chưa; "nghi lỗi thời" cần so ngày và cần
     * người thấy mô tả không khớp UI. Khai `mot_phan` cho mọi màn có mục là lời khai BẢO THỦ và đúng.
     */
    const f = await gop();
    const mucs = new Set((f.doc_coverage as Vung[]).map((x) => x.muc_phu));
    expect([...mucs].sort()).toEqual(['co_tai_lieu_chua_do_duoc', 'mot_phan', 'trang']);
    expect(String(f._cach_tinh_do_phu)).toMatch(/KHÔNG theo chuỗi xuất hiện/);
  });
});

test.describe('@infra câu hỏi tự sinh và cảnh báo bắt buộc', () => {
  test('mỗi vùng mù ⇒ một câu hỏi High; mỗi `documented_missing` ⇒ một câu Medium', async () => {
    const f = await gop();
    const q = f.cau_hoi_ambiguity as { muc: string; cau_hoi: string }[];
    expect(q.filter((x) => x.muc === 'High')).toHaveLength(2);
    expect(q.filter((x) => x.muc === 'Medium')).toHaveLength(2);
    expect(q.find((x) => x.cau_hoi.includes('/bao-cao'))).toBeTruthy();
  });

  test('lượt bò chưa đầy đủ ⇒ bản đồ phủ phải MANG cảnh báo đó theo', async () => {
    /*
     * Không mang theo thì bản đồ trông như một kết luận, trong khi nó là ảnh chụp dở — và ô
     * `documented_missing` lúc đó tuyệt đối không đọc được là "chưa build".
     */
    const f = fu.gop({
      crawl: { screens: [], crawl_completeness: { canh_bao: 'Chỉ bò tới 3/10 route (30%)' } },
      taiLieu: [FSD],
    });
    expect(String(f.canh_bao_do_day_du)).toMatch(/3\/10/);
  });

  test('tài liệu không đọc được ⇒ ghi rõ, KHÔNG im lặng coi như không có vùng nào', async () => {
    const f = fu.gop({ crawl: { screens: [] }, taiLieu: ['/khong/co/that.md'] });
    const n = f.nguon_tai_lieu as { doc_duoc: boolean; vi_sao: string }[];
    expect(n[0].doc_duoc).toBe(false);
    expect(n[0].vi_sao).toMatch(/không có file/);
  });

  test('KHÔNG có tài liệu nào ⇒ MỌI màn là vùng mù, và đó là kết luận ĐÚNG', async () => {
    /*
     * Dự án mới đúng là trạng thái này. Nó phải ra "toàn vùng mù" chứ không ra "0 vùng mù" — hai thứ đó
     * trông giống nhau trên một bảng đếm, mà nghĩa ngược nhau.
     */
    const f = fu.gop({
      crawl: { screens: [{ route: '/a', title_observed: 'A', fields: [], components: [] }, { route: '/b', title_observed: 'B', fields: [], components: [] }] },
      taiLieu: [],
    });
    expect(f.vung_mu).toEqual(['/a', '/b']);
    expect((f.tong as Record<string, number>).undocumented_present).toBe(2);
    expect((f.tong as Record<string, number>).documented_present).toBeUndefined();
  });

  test('mọi bản ghi là `observed` — bản đồ phủ KHÔNG phải oracle', async () => {
    const f = await gop();
    expect(f.status).toBe('observed');
    for (const c of f.doc_coverage as (Vung & { status: string })[]) expect(c.status).toBe('observed');
  });
});
