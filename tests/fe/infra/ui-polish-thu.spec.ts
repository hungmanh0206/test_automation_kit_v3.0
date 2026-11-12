/**
 * ui:polish — THU THẬP dùng chung (`scripts/utils/ui/ui_polish_thu.js`) và bộ sinh spec `ui:polish:gen`.
 *
 * Mỗi ca giữ một bài học của lượt đo 5 cấp app mẫu (12/11/2026), cái nào cũng từng làm số liệu sai mà lượt chạy vẫn
 * xanh: màn không mở được bị lấp chỗ trống, màn 0 thành phần đếm là đã đo, bị đẩy về trang đăng nhập mà vẫn đọc,
 * tab không chuyển mà vẫn ghi dữ liệu tab cũ dưới tên tab mới.
 *
 * Màn thật được thay bằng một server HTTP cục bộ: không chạm UAT.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { thuMucTam } from './_thu_muc_tam';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
/* eslint-disable @typescript-eslint/no-var-requires, global-require */
const thu = require(path.join(REPO, 'scripts/utils/ui/ui_polish_thu.js'));
const gen = require(path.join(REPO, 'scripts/qa/reuse/ui_polish_gen.js'));
/* eslint-enable @typescript-eslint/no-var-requires, global-require */
const CHUAN = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'ui-polish', 'chuan.html'), 'utf8');

/* Thanh tab dạng Telerik: `.rtsSelected` nằm trên thẻ a của tab đang chọn. `ket` ⇒ bấm không đổi gì. */
const trangTab = (ket: boolean) => `<!doctype html><html><body>
<ul><li><a class="rtsLink rtsSelected"><span class="rtsTxt">Thông tin chung</span></a></li>
<li><a class="rtsLink"><span class="rtsTxt">Cơ sở vật chất</span></a></li></ul>
<div class="khung" id="noiDung"><label>Tên trường</label><input class="riTextBox" style="height:30px;padding:2px 5px">
<button style="height:32px;padding:0 16px">Ghi</button><button style="height:32px;padding:0 16px">Hủy</button><button style="height:32px;padding:0 16px">In</button></div>
<script>
  for (const a of document.querySelectorAll('.rtsLink')) a.addEventListener('click', () => {
    if (${ket}) return;
    document.querySelector('.rtsSelected').classList.remove('rtsSelected'); a.classList.add('rtsSelected');
    document.getElementById('noiDung').innerHTML = '<label>Diện tích</label><button style="height:28px">Ghi</button><button style="height:28px">Xóa</button>';
  });
</script></body></html>`;

let server: http.Server;
let GOC = '';
test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const html = (t: string, ma = 200) => { res.writeHead(ma, { 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' }); res.end(t); };
    const u = (req.url || '').split('?')[0];
    if (u === '/C1/a.aspx') return html(CHUAN);
    if (u === '/C1/tab.aspx') return html(trangTab(false));
    if (u === '/C1/tab-ket.aspx') return html(trangTab(true));
    if (u === '/C1/rong.aspx') return html('<html><body><button>Ngoài vùng</button><div class="khung"></div></body></html>');
    if (u === '/C1/chuyen.aspx') { res.writeHead(302, { Location: '/Login.aspx', Connection: 'close' }); return res.end(); }
    if (u === '/Login.aspx') return html('<html><body><div class="khung"><label>Tên đăng nhập</label><input><input><input><button>Đăng nhập</button></div></body></html>');
    return html('không có', 404);
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', () => ok()));
  GOC = `http://127.0.0.1:${(server.address() as any).port}`;
});
test.afterAll(async () => { server.closeAllConnections(); await new Promise((ok) => server.close(ok)); });

const DS = {
  vung: '.khung',
  cap: { 'Tiểu học': { ma: 'TH', tienTo: 'C1' } },
  man: [
    { ten: 'a', duong: '/{CAP}/a.aspx' },
    { ten: 'het', duong: '/{CAP}/het.aspx' },
    { ten: 'chuyen', duong: '/{CAP}/chuyen.aspx' },
    { ten: 'rong', duong: '/{CAP}/rong.aspx' },
    { ten: 'tab', duong: '/{CAP}/tab.aspx', tab: true },
    { ten: 'tab-ket', duong: '/{CAP}/tab-ket.aspx', tab: true },
  ],
};

test.describe('@infra ui:polish — thu thập theo danh sách màn', () => {
  test('màn KHÔNG đo được được ghi ra kèm lý do, không lấp chỗ trống — và không thành file màn', async ({ page }) => {
    const ra = thuMucTam('uip-thu');
    fs.writeFileSync(path.join(ra, 'cu.json'), '{}'); // dữ liệu lượt cũ của cùng cấp
    const r = await thu.thuTheoDanhSach(page, { ds: DS, cap: thu.giaiCap(DS, 'Tiểu học'), goc: GOC, ra, log: () => {}, choMs: 50 });
    const lyDo = Object.fromEntries(r.boQua.map((x: any) => [x.ten, x.lyDo]));
    const files = fs.readdirSync(ra).sort();
    const so = JSON.parse(fs.readFileSync(path.join(ra, '_bo-qua.json'), 'utf8'));
    fs.rmSync(ra, { recursive: true, force: true });

    expect(r.daDo.map((x: any) => x.ten).sort()).toEqual(['a', 'tab-ket-tab1', 'tab-tab1', 'tab-tab2']);
    expect(lyDo.het).toBe('HTTP 404');
    expect(lyDo.chuyen, 'bị đẩy về trang đăng nhập với mã 200 — đọc nó là đo trang đăng nhập dưới tên màn cần đo').toMatch(/chuyển hướng sang \/Login\.aspx/);
    expect(lyDo.rong, 'vùng rỗng không phải một màn đã đo').toMatch(/0|không có thành phần/);
    expect(lyDo['tab-ket-tab2'], 'tab không chuyển thì KHÔNG ghi dữ liệu tab 1 dưới tên tab 2').toMatch(/tab đang chọn vẫn là "Thông tin chung"/);
    expect(files, 'lượt mới xoá dữ liệu cũ của cấp này; chỉ màn đo được mới thành file').toEqual(['_bo-qua.json', 'a.json', 'tab-ket-tab1.json', 'tab-tab1.json', 'tab-tab2.json']);
    expect(so.cap).toBe('TH');
    expect(so.boQua).toHaveLength(4);
  });

  test('tab chuyển được ⇒ hai tab là hai mẫu KHÁC nhau (không phải đọc tab 1 hai lần)', async ({ page }) => {
    const ra = thuMucTam('uip-tab');
    const ds = { ...DS, man: [DS.man[4]] };
    await thu.thuTheoDanhSach(page, { ds, cap: thu.giaiCap(ds, 'Tiểu học'), goc: GOC, ra, log: () => {}, choMs: 50 });
    const t1 = JSON.parse(fs.readFileSync(path.join(ra, 'tab-tab1.json'), 'utf8'));
    const t2 = JSON.parse(fs.readFileSync(path.join(ra, 'tab-tab2.json'), 'utf8'));
    fs.rmSync(ra, { recursive: true, force: true });
    expect(t1.theoLoai.nut.map((x: any) => x.chu)).toEqual(['Ghi', 'Hủy', 'In']);
    expect(t2.theoLoai.nut.map((x: any) => x.chu)).toEqual(['Ghi', 'Xóa']);
    expect(t2.man).toBe('TH/tab-tab2');
  });

  test('thiếu gốc URL ⇒ ném, KHÔNG đoán host', async ({ page }) => {
    await expect(thu.thuTheoDanhSach(page, { ds: DS, cap: { ma: 'TH', tienTo: 'C1' }, goc: '', ra: thuMucTam('uip-goc'), log: () => {} })).rejects.toThrow(/KHÔNG đoán host/);
  });
});

test.describe('@infra ui:polish — kiểm danh sách màn', () => {
  test('danh sách hợp lệ ⇒ 0 lỗi; thiếu vùng ⇒ cảnh báo (thanh đầu trang sẽ bị đếm)', () => {
    expect(thu.kiemDanhSach(DS)).toEqual({ loi: [], canhBao: [] });
    expect(thu.kiemDanhSach({ ...DS, vung: '' }).canhBao.join(' ')).toMatch(/thanh đầu trang/);
  });

  test('mỗi kiểu sai một lỗi riêng', () => {
    const loi = (ds: any) => thu.kiemDanhSach(ds).loi.join(' | ');
    expect(loi({ man: [] })).toMatch(/không có màn nào/);
    expect(loi({ man: [{ ten: 'a', duong: 'https://uat.vd/a.aspx' }] }), 'host không được ghim vào file của task').toMatch(/phải bắt đầu bằng "\/"/);
    expect(loi({ man: [{ ten: 'a', duong: '//uat.vd/a.aspx' }] })).toMatch(/chứa host/);
    expect(loi({ man: [{ ten: 'a', duong: '/a' }, { ten: 'a', duong: '/b' }] }), 'trùng tên thì lượt sau đè file lượt trước').toMatch(/trùng tên/);
    expect(loi({ man: [{ ten: 'Hồ sơ', duong: '/a' }] })).toMatch(/chữ thường không dấu/);
    expect(loi({ man: [{ ten: 'a', duong: '/{CAP}/a' }] })).toMatch(/không khai bảng `cap`/);
    expect(loi({ cap: { 'Tiểu học': { ma: 'TH' } }, man: [{ ten: 'a', duong: '/{CAP}/a' }] })).toMatch(/thiếu `tienTo`/);
    expect(loi({ man: [{ ten: 'a', duong: '/a', tab: '.tab' }] }), 'bộ chọn tab riêng mà không có bộ chọn tab-đang-chọn thì "đã chuyển" là tự khai').toMatch(/tabDangChon/);
    expect(loi({ hook: { module: 'lib/x', ham: 'f' }, man: [{ ten: 'a', duong: '/a' }] })).toMatch(/hook/);
  });

  test('cấp không có trong bảng ⇒ lỗi nêu tên cấp và các cấp có; không bảng ⇒ mã là tên cấp bỏ dấu', () => {
    expect(thu.giaiCap(DS, 'Mầm non').loi).toMatch(/"Mầm non" không có .*Tiểu học/);
    expect(thu.giaiCap(DS, '').loi, 'profile thiếu APP_CAP_HOC thì nói thẳng, không về cấp mặc định').toMatch(/chưa khai/);
    expect(thu.giaiCap({ man: [] }, 'Trung học cơ sở')).toEqual({ ma: 'TRUNG-HOC-CO-SO', tienTo: '' });
  });
});

test.describe('@infra ui:polish:gen — sinh spec của task', () => {
  const dung = (ds: any) => {
    const goc = thuMucTam('uip-gen');
    const f = path.join(goc, 'requirements', 'ui_polish_man.json');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(ds));
    const out = path.join(goc, 'automation');
    return { goc, f, out, r: gen.sinh({ duongDanhSach: f, outDir: out, raDir: path.join(goc, 'test-results', 'ui-polish') }) };
  };

  test('sinh spec + config; spec không ghim host, có đường tới danh sách màn và thư mục kết quả', () => {
    const { goc, out, r } = dung(DS);
    const src = fs.readFileSync(path.join(out, gen.TEN_SPEC), 'utf8');
    const coCfg = fs.existsSync(path.join(out, 'playwright.task.config.js'));
    fs.rmSync(goc, { recursive: true, force: true });
    expect(r.loi).toEqual([]);
    expect(coCfg, 'thiếu config thì `playwright test` trả "No tests found"').toBe(true);
    expect(src).toContain("require(\"../requirements/ui_polish_man.json\")");
    expect(src).toContain('path.resolve(__dirname, "../test-results/ui-polish")');
    expect(src).toMatch(/KHÔNG đoán host/);
    expect(src, 'không đo được màn nào thì đỏ').toMatch(/toBeGreaterThan\(0\)/);
    expect(src).not.toMatch(/127\.0\.0\.1|https?:\/\/[a-z]/i);
  });

  test('danh sách sai ⇒ KHÔNG sinh gì', () => {
    const { goc, out, r } = dung({ man: [{ ten: 'a', duong: 'a.aspx' }] });
    const co = fs.existsSync(path.join(out, gen.TEN_SPEC));
    fs.rmSync(goc, { recursive: true, force: true });
    expect(r.loi.length).toBeGreaterThan(0);
    expect(co).toBe(false);
  });

  test('hook trỏ tới file không có ⇒ lỗi lúc SINH, không đợi tới lúc chạm UAT', () => {
    const { goc, r } = dung({ ...DS, hook: { module: './lib/khongCo', ham: 'f' } });
    fs.rmSync(goc, { recursive: true, force: true });
    expect(r.loi.join(' ')).toMatch(/hook\.module.*không có/);
  });

  test('hook có ⇒ spec gọi từng hàm theo thứ tự, SAU đăng nhập', () => {
    const goc = thuMucTam('uip-hook');
    fs.mkdirSync(path.join(goc, 'automation', 'lib'), { recursive: true });
    fs.writeFileSync(path.join(goc, 'automation', 'lib', 'g.ts'), 'export const a = 1;');
    const f = path.join(goc, 'ds.json');
    fs.writeFileSync(f, JSON.stringify({ ...DS, hook: { module: './lib/g', ham: ['batThongBao', 'chonDonVi'] } }));
    const r = gen.sinh({ duongDanhSach: f, outDir: path.join(goc, 'automation'), raDir: path.join(goc, 'kq') });
    const src = fs.readFileSync(path.join(goc, 'automation', gen.TEN_SPEC), 'utf8');
    fs.rmSync(goc, { recursive: true, force: true });
    expect(r.loi).toEqual([]);
    const iDN = src.indexOf('await loginOps(page)');
    const i1 = src.indexOf('HOOK["batThongBao"](page)');
    const i2 = src.indexOf('HOOK["chonDonVi"](page)');
    expect(iDN).toBeGreaterThan(0);
    expect(i1).toBeGreaterThan(iDN);
    expect(i2).toBeGreaterThan(i1);
  });

  test('spec cùng tên mà KHÔNG do máy này sinh ⇒ không ghi đè', () => {
    const goc = thuMucTam('uip-de');
    const f = path.join(goc, 'ds.json');
    fs.writeFileSync(f, JSON.stringify(DS));
    fs.mkdirSync(path.join(goc, 'automation'), { recursive: true });
    fs.writeFileSync(path.join(goc, 'automation', gen.TEN_SPEC), '// viết tay');
    const r = gen.sinh({ duongDanhSach: f, outDir: path.join(goc, 'automation'), raDir: path.join(goc, 'kq') });
    const sau = fs.readFileSync(path.join(goc, 'automation', gen.TEN_SPEC), 'utf8');
    fs.rmSync(goc, { recursive: true, force: true });
    expect(r.loi.join(' ')).toMatch(/không ghi đè/);
    expect(sau).toBe('// viết tay');
  });

  test('danh sách MẪU của --init tự nó qua kiểm', () => {
    expect(thu.kiemDanhSach(gen.MAU).loi).toEqual([]);
  });
});

test.describe('@infra ui:polish — CLI đọc sổ bỏ qua', () => {
  test('`_bo-qua.json` không bị đọc như một màn; màn không đo được được in ra', async ({ page }) => {
    const d = thuMucTam('uip-cli');
    const ra = path.join(d, 'TH');
    await thu.thuTheoDanhSach(page, { ds: DS, cap: thu.giaiCap(DS, 'Tiểu học'), goc: GOC, ra, log: () => {}, choMs: 50 });
    const r = spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/ui_polish.js'), '--thu-muc', d], { encoding: 'utf8', cwd: REPO, env: gateEnv() });
    fs.rmSync(d, { recursive: true, force: true });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/\[ui-polish\] 4 màn/);
    expect(r.stdout).toMatch(/KHÔNG đo được 4 màn/);
    expect(r.stdout).toMatch(/TH\/het: HTTP 404/);
  });

  test('chỉ có sổ bỏ qua, 0 màn đo được ⇒ exit 2 và vẫn in lý do', () => {
    const d = thuMucTam('uip-cli0');
    fs.mkdirSync(path.join(d, 'MN'), { recursive: true });
    fs.writeFileSync(path.join(d, 'MN', '_bo-qua.json'), JSON.stringify({ cap: 'MN', daDo: [], boQua: [{ ten: 'lop-mon', duong: '/MN/LopMon.aspx', lyDo: 'HTTP 500' }] }));
    const r = spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/ui_polish.js'), '--thu-muc', d], { encoding: 'utf8', cwd: REPO, env: gateEnv() });
    fs.rmSync(d, { recursive: true, force: true });
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/MN\/lop-mon: HTTP 500/);
    expect(r.stdout).toMatch(/KHÔNG PHÁN ĐƯỢC/);
  });
});
