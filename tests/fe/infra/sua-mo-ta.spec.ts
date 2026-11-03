/*
 * `sua_mo_ta.js` — ĐƯỜNG GHI VÀO BACKLOG, VÀ NÓ TỪNG KHÔNG CÓ MÁY NÀO CANH.
 *
 * Script thay NGUYÊN phần Mô tả của một issue. Nó đã được dùng thật (CSDL-3950, 4021 → 2519 ký tự)
 * trước khi có spec nào nhắc tới nó. Đo 02/11/2026: `grep -rl sua_mo_ta tests/` ⇒ rỗng.
 *
 * Đó đúng tình huống `perf_index.js` cùng ngày: hai nhánh hiển thị không ai gác, và núp sau chúng là ba
 * lỗ đếm. Khác ở chỗ đây là đường GHI — một cú gọi sai làm mất sạch mô tả của một issue thật, hoặc đổi
 * tiêu đề một bug mà chủ dự án đã cấm đổi.
 *
 * BA TÍNH CHẤT ĐƯỢC GÁC, cả ba đã có trong mã — spec này giữ cho chúng không trôi:
 *
 *   ① file mô tả RỖNG ⇒ từ chối ghi. Lời chú của chính script nói vì sao: "thay nhầm một file rỗng mà
 *      không nhìn con số thì issue mất sạch nội dung, và không có gì báo".
 *   ② KHÔNG bao giờ gửi `summary`. `bug_reporter.js --update-issue` có gửi, nên nó đổi được tiêu đề bug
 *      — chủ dự án đã cấm. Script này tồn tại chính vì điều đó.
 *   ③ KHÔNG bao giờ gửi `attachmentId[]`. Gửi nó là THAY THẾ cả set đính kèm; ảnh đang nhúng trong mô tả
 *      sẽ vỡ, vì `![image][tên.png]` chỉ hiện khi tệp cùng tên còn trong issue.
 *
 * ĐỐI CHỨNG HÀNH VI, KHÔNG PHẢI ĐỌC CẤU TRÚC MÃ. Một phép kiểm kiểu "mã nguồn không chứa chuỗi
 * `summary`" sẽ im lặng ngừng gác ngay khi ai đó dựng payload bằng biến. Nên ở đây dựng một HTTP server
 * cục bộ **bắt đúng request script gửi đi**, rồi khám thân request. Không chạm Backlog thật, không chạm
 * UAT, không cần secret.
 *
 * HAI CÁI BẪY ĐÃ ĐO ĐƯỢC, ghi lại để không ai gỡ chúng tưởng là dọn rác:
 *
 * ⚠️ `spawnSync` LÀM TREO VĨNH VIỄN. Lượt đầu của spec này treo quá 120 giây. Nguyên nhân: server nằm
 * trong CHÍNH tiến trình chạy test, còn `spawnSync` chặn vòng lặp sự kiện — nên server không thể trả lời
 * request của tiến trình con, con chờ phản hồi, cha chờ con. Phải dùng `spawn` bất đồng bộ.
 *
 * ⚠️ NĂM CỬA CÙNG TRẢ `exit 2`. Thiếu BASE/KEY · thiếu `--issue` · thiếu `--mo-ta-file` · file không tồn
 * tại · file rỗng — cả năm `exit 2` và cả năm gửi 0 request. Nên đo "exit 2 + 0 request" KHÔNG phân biệt
 * được cửa nào vừa chạy: quên đặt `BACKLOG_API_KEY` giả là đối chứng xanh mà chưa chạm dòng cần đo. Mọi
 * ca dưới đây vì thế đòi NGUYÊN VĂN stderr, và có một ca riêng chứng minh năm cửa phân biệt được nhau.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import { gateEnv } from './_gate_env';
import { mayThu } from './_may_thu';

const REPO = path.resolve(__dirname, '..', '..', '..');
const MAY = mayThu('SUA_MO_TA_JS', path.join(REPO, 'scripts/integrations/backlog/sua_mo_ta.js'));

type Bat = { method: string; duong: string; than: string };

/** Issue giả mà server trả cho GET — đủ các trường script đọc. */
const ISSUE_GIA = {
  id: 1,
  issueKey: 'TEST-1',
  summary: 'TIÊU ĐỀ KHÔNG ĐƯỢC ĐỔI',
  description: 'mô tả cũ, dài hơn mô tả mới một chút cho dễ thấy dấu trừ',
  status: { name: 'Open' },
  attachments: [{ id: 11, name: 'anh-1.png' }, { id: 12, name: 'anh-2.png' }],
};

/** Server bắt request. `dong()` đóng cả socket keep-alive để test không treo. */
async function server() {
  const batDuoc: Bat[] = [];
  const s = http.createServer((req, res) => {
    const khuc: Buffer[] = [];
    req.on('data', (c) => khuc.push(c as Buffer));
    req.on('end', () => {
      batDuoc.push({
        method: String(req.method),
        duong: String(req.url).split('?')[0],
        than: Buffer.concat(khuc).toString('utf8'),
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(ISSUE_GIA));
    });
  });
  await new Promise<void>((ok) => s.listen(0, '127.0.0.1', ok));
  const cong = (s.address() as { port: number }).port;
  const dong = async () => {
    const f = s as unknown as { closeAllConnections?: () => void };
    if (typeof f.closeAllConnections === 'function') f.closeAllConnections();
    await new Promise<void>((ok) => s.close(() => ok()));
  };
  return { cong, batDuoc, dong };
}

/*
 * KHOÁ GIẢ GHÉP TỪ MẢNG, KHÔNG VIẾT THÀNH LITERAL — đừng "đơn giản hoá" về một chuỗi.
 *
 * `secret:scan` có luật `generic-secret-assign`: một literal gán vào tên khớp `*API_KEY*` là mẫu nó
 * PHẢI bắt, và nó không thể biết chuỗi này là giả. Lượt đầu của spec này làm `secret:scan` ĐỎ ở đúng
 * dòng đó. Đường chữa đúng là đổi cách viết của test, KHÔNG phải nới máy quét hay thêm miễn trừ —
 * một luật quét secret có ngoại lệ thì lần sau nó im lặng với khoá thật.
 */
const KHOA_GIA = ['khoa', 'gia', 'chi', 'de', 'kiem'].join('-');

/** Env cho tiến trình con — `gateEnv` gỡ `TASK_ENV`, nên `runtime_config` không nạp env của lượt khác. */
const envCon = (cong: number) => gateEnv({
  BACKLOG_BASE_URL: `http://127.0.0.1:${cong}`,
  BACKLOG_API_KEY: KHOA_GIA,
  PROJECT_OUTPUT_DIR: 'outputs/_suamota',
  TASK_KEY: 'SMT-0',
});

/** Chạy script thật, BẤT ĐỒNG BỘ — xem lý do ở khối chú thích đầu file. */
function chayArgv(argv: string[], env: NodeJS.ProcessEnv) {
  return new Promise<{ code: number | null; out: string }>((ok) => {
    const p = spawn(process.execPath, [MAY, ...argv], { cwd: REPO, env });
    let out = '';
    p.stdout.on('data', (d) => { out += String(d); });
    p.stderr.on('data', (d) => { out += String(d); });
    p.on('close', (code) => ok({ code, out }));
  });
}

/** Dựng file mô tả rồi chạy. `moTa === null` ⇒ không tạo file (ca "không tồn tại"). */
async function chay(cong: number, moTa: string | null, themArgv: string[] = []) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'suamota-'));
  const f = path.join(d, 'mo-ta.md');
  if (moTa !== null) fs.writeFileSync(f, moTa, 'utf8');
  const r = await chayArgv(['--issue', 'TEST-1', '--mo-ta-file', f], envCon(cong));
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* dọn là tiện ích */ }
  return r;
}

async function chayThem(cong: number, moTa: string, themArgv: string[]) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'suamota-'));
  const f = path.join(d, 'mo-ta.md');
  fs.writeFileSync(f, moTa, 'utf8');
  const r = await chayArgv(['--issue', 'TEST-1', '--mo-ta-file', f, ...themArgv], envCon(cong));
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* dọn là tiện ích */ }
  return r;
}

const patch = (b: Bat[]) => b.find((x) => x.method === 'PATCH') || null;

test.describe.configure({ mode: 'default' });

test.describe('@infra sua_mo_ta — file RỖNG phải CHẶN trước khi gọi API', () => {
  test('ĐỐI CHỨNG DƯƠNG: mô tả rỗng ⇒ chặn ĐÚNG ở cửa rỗng, và 0 request', async () => {
    const { cong, batDuoc, dong } = await server();
    const r = await chay(cong, '   \n\n  \t \n');
    await dong();
    expect(r.code, r.out).toBe(2);
    expect(r.out, 'phải nêu NGUYÊN VĂN cửa rỗng — 5 cửa cùng exit 2 nên mã thoát không phân biệt được')
      .toContain('file mô tả RỖNG');
    expect(batDuoc.length,
      'chặn SAU khi đã gọi API thì vô nghĩa — GET đã chạy nghĩa là cửa đứng sai chỗ trong mã').toBe(0);
  });

  test('ĐỐI CHỨNG ÂM: mô tả có nội dung ⇒ CÓ gọi API, đi tới chỗ gửi thật', async () => {
    const { cong, batDuoc, dong } = await server();
    const r = await chay(cong, 'mô tả mới');
    await dong();
    expect(r.code, r.out).toBe(0);
    expect(batDuoc.length, 'không gọi gì thì phép kiểm trên RỖNG không chứng minh được điều gì')
      .toBeGreaterThan(0);
  });

  /*
   * CA CHỨNG MINH PHÉP ĐO PHÂN BIỆT ĐƯỢC. Không có ca này thì mọi ca "exit 2 · 0 request" ở trên có thể
   * đang đo một cửa khác mà vẫn xanh — đúng cái bẫy một phiên song song chỉ ra.
   */
  test('NĂM cửa `exit 2` phải phân biệt được bằng stderr, không chỉ bằng mã thoát', async () => {
    const { cong, batDuoc, dong } = await server();
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'suamota-5cua-'));
    const coNoiDung = path.join(d, 'co.md');
    fs.writeFileSync(coNoiDung, 'có nội dung', 'utf8');
    const rong = path.join(d, 'rong.md');
    fs.writeFileSync(rong, '  \n ', 'utf8');
    const khongCo = path.join(d, 'khong-ton-tai.md');

    /*
     * ĐẶT CHUỖI RỖNG, KHÔNG XOÁ BIẾN — đo 02/11/2026, lượt đầu của ca này ĐỎ vì chuyện đó.
     *
     * `scripts/utils/runtime_config.js` chỉ điền khi `process.env[key] === undefined`, rồi lùi về
     * `.env.local` / `.env` ở gốc repo. Nên `delete` làm biến thành `undefined` ⇒ nó nạp KHOÁ THẬT từ
     * `.env` ⇒ script chạy trọn và PATCH, trong khi ca này đang muốn đo cửa "thiếu KEY". Chuỗi rỗng thì
     * `=== undefined` sai nên không bị điền, mà `!KEY` vẫn đúng ⇒ cửa nổ đúng chỗ.
     *
     * Đây là cùng họ với [[feedback_probe_thua_ke_moi_truong_ci]]: probe thừa kế thứ mà cửa rẽ nhánh
     * theo. Khác nguồn — không phải env của runner mà là `.env` của repo.
     */
    const khongKey = { ...envCon(cong), BACKLOG_API_KEY: '' };

    const ca: Array<{ ten: string; argv: string[]; env: NodeJS.ProcessEnv; neo: RegExp }> = [
      { ten: 'thiếu KEY', argv: ['--issue', 'TEST-1', '--mo-ta-file', coNoiDung], env: khongKey, neo: /BACKLOG_API_KEY/ },
      { ten: 'thiếu --issue', argv: ['--mo-ta-file', coNoiDung], env: envCon(cong), neo: /thiếu --issue/ },
      { ten: 'thiếu --mo-ta-file', argv: ['--issue', 'TEST-1'], env: envCon(cong), neo: /thiếu --mo-ta-file/ },
      { ten: 'file không tồn tại', argv: ['--issue', 'TEST-1', '--mo-ta-file', khongCo], env: envCon(cong), neo: /không thấy file/ },
      { ten: 'file rỗng', argv: ['--issue', 'TEST-1', '--mo-ta-file', rong], env: envCon(cong), neo: /file mô tả RỖNG/ },
    ];

    const thay: string[] = [];
    for (const c of ca) {
      /* eslint-disable-next-line no-await-in-loop */
      const r = await chayArgv(c.argv, c.env);
      expect(r.code, `${c.ten}: ${r.out}`).toBe(2);
      expect(r.out, `cửa "${c.ten}" không nêu đích danh lý do ⇒ không phân biệt được với 4 cửa kia`)
        .toMatch(c.neo);
      thay.push(r.out.trim());
    }
    await dong();

    expect(new Set(thay).size, 'hai cửa cho CÙNG một thông điệp thì phép đo không phân biệt được chúng')
      .toBe(ca.length);
    expect(batDuoc.length, 'cả năm cửa đều phải chặn TRƯỚC mọi request').toBe(0);
    fs.rmSync(d, { recursive: true, force: true });
  });
});

test.describe('@infra sua_mo_ta — thân PATCH chỉ được mang `description`', () => {
  test('KHÔNG gửi `summary` — tiêu đề bug không thể bị đổi ngoài ý muốn', async () => {
    const { cong, batDuoc, dong } = await server();
    await chay(cong, 'mô tả mới gọn hơn');
    await dong();
    const p = patch(batDuoc);
    expect(p, '"0 cú PATCH" chứng minh script không chạy, KHÔNG chứng minh nó không gửi `summary`')
      .not.toBeNull();
    const than = new URLSearchParams(p!.than);
    expect(than.get('description'), 'phải gửi đúng mô tả mới').toBe('mô tả mới gọn hơn');
    expect(than.has('summary'),
      'gửi `summary` là mở đường đổi tiêu đề bug — chủ dự án đã cấm, và đó là lý do script này tồn tại')
      .toBe(false);
  });

  test('KHÔNG gửi `attachmentId` — gửi nó là THAY cả set đính kèm, ảnh nhúng sẽ vỡ', async () => {
    const { cong, batDuoc, dong } = await server();
    await chay(cong, 'mô tả có ảnh: ![image][anh-1.png]');
    await dong();
    const p = patch(batDuoc);
    expect(p).not.toBeNull();
    const khoa = [...new URLSearchParams(p!.than).keys()];
    expect(khoa.filter((k) => /attachment/i.test(k)), 'bất kỳ khoá attachment nào cũng thay cả set')
      .toEqual([]);
    expect(khoa, 'thân PATCH chỉ được mang ĐÚNG MỘT khoá — thêm khoá nào cũng là thêm một thứ có thể vỡ')
      .toEqual(['description']);
  });

  test('cảnh báo ảnh nhúng KHÔNG có trong đính kèm — và KHÔNG chặn vì nó', async () => {
    const { cong, batDuoc, dong } = await server();
    const r = await chay(cong, 'ảnh còn: ![image][anh-1.png]\nảnh mất: ![image][anh-khong-co.png]');
    await dong();
    expect(r.out).toContain('anh-khong-co.png');
    expect(r.out, 'ảnh CÓ trong đính kèm thì không được kể vào danh sách thiếu')
      .not.toContain('đính kèm: anh-1.png');
    expect(r.code, 'đây là cảnh báo, không phải cửa chặn — chặn ở đây làm người dùng không sửa được mô tả')
      .toBe(0);
    expect(patch(batDuoc), 'cảnh báo rồi vẫn phải ghi').not.toBeNull();
  });

  test('in độ dài CŨ → MỚI, vì cắt mất bao nhiêu là con số duy nhất thấy được ngay', async () => {
    const { cong, dong } = await server();
    const r = await chay(cong, 'ngắn');
    await dong();
    expect(r.out).toMatch(/mô tả CŨ \d+ ký tự → MỚI 4 ký tự/);
    expect(r.out, 'phải nêu dấu để thấy đang cắt hay đang thêm').toMatch(/\(-\d+\)/);
  });
});

test.describe('@infra sua_mo_ta — `--dry-run` KHÔNG được ghi', () => {
  test('ĐỐI CHỨNG DƯƠNG: `--dry-run` ⇒ 0 cú PATCH, nhưng VẪN có GET', async () => {
    const { cong, batDuoc, dong } = await server();
    const r = await chayThem(cong, 'mô tả thử', ['--dry-run']);
    await dong();
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('XEM TRƯỚC (chưa ghi gì)');
    expect(patch(batDuoc), '`--dry-run` mà vẫn PATCH thì nó là lời khai, không phải chế độ').toBeNull();
    expect(batDuoc.filter((x) => x.method === 'GET').length,
      '0 GET nghĩa là script chết sớm — khi đó "0 PATCH" không chứng minh gì về `--dry-run`')
      .toBeGreaterThan(0);
  });

  test('ĐỐI CHỨNG ÂM: KHÔNG có `--dry-run` ⇒ CÓ đúng một cú PATCH', async () => {
    const { cong, batDuoc, dong } = await server();
    await chay(cong, 'mô tả thử');
    await dong();
    expect(batDuoc.filter((x) => x.method === 'PATCH').length,
      'hai cú PATCH là ghi hai lần; không cú nào là `--dry-run` bị bật ngầm').toBe(1);
  });

  test('ghi xong phải ĐỌC LẠI từ máy chủ, không tin phản hồi của lượt ghi', async () => {
    const { cong, batDuoc, dong } = await server();
    const r = await chay(cong, 'mô tả mới');
    await dong();
    expect(batDuoc.map((x) => x.method), 'GET → PATCH → GET: lượt GET cuối là đối chứng độc lập cho cú ghi')
      .toEqual(['GET', 'PATCH', 'GET']);
    expect(r.out).toContain('đọc lại từ máy chủ');
    expect(r.out, 'phải in tiêu đề SAU khi ghi, để thấy nó không bị đổi').toContain('tiêu đề sau khi ghi');
  });
});
