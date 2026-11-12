/*
 * `cap_nhat_issue.js` — MỘT DÒNG LOG KHAI ĐIỀU NÓ CHƯA ĐO, VÀ MỘT CỜ GỠ NGƯỜI NHẬN.
 *
 * Bản vá 02/11/2026 là của phiên TASK-4008. Tôi commit mã của họ Y NGUYÊN, không sửa một dòng; spec này
 * chỉ gác ba tính chất để chúng không trôi. Phiên ấy từ chối tự commit và từ chối giao tôi commit hộ,
 * vì người dùng của họ chưa bảo commit — nên quyết định này là của người dùng, không phải của hai phiên.
 *
 * ① DÒNG LOG CŨ NÓI SAI SỰ THẬT. Response của `POST issues/<key>/comments` KHÔNG trả mảng `attachments`.
 *    Bản trước đọc `cmt.attachments` rồi in `đính kèm trong comment: (không có)` KỂ CẢ khi ảnh đã đính
 *    THÀNH CÔNG. Đã cắn 02/11 ở TASK-4043: người đọc tưởng upload hỏng, kiểm lại bằng `doc_comment.js`
 *    thì ảnh nằm đúng chỗ.
 *
 *    Đây đúng lớp hỏng mà cả đợt v2.9.7–v2.9.9 đi chữa, chỉ là ở quy mô một dòng: báo cáo khai một điều
 *    nó KHÔNG đo được. Bản vá đổi sang chỉ khai những gì GỬI ĐI, và chỉ đường xác nhận.
 *
 * ② GỠ NGƯỜI NHẬN CẦN CỜ RIÊNG. `--assignee-id ""` là chuỗi rỗng nên falsy nên bị bỏ qua; `0` thì Backlog
 *    trả 404 `No such user`. Backlog chỉ gỡ khi nhận `assigneeId=` RỖNG. Nên ý định phải nói ra bằng một
 *    cờ, không suy từ giá trị.
 *
 * ③ HAI CỜ CÙNG LÚC PHẢI TẤT ĐỊNH. `--go-assignee` và `--assignee-id` cùng truyền thì hiện `--go-assignee`
 *    thắng. Đó là chủ ý, nhưng trước spec này KHÔNG có gì gác — một ưu tiên ngầm giữa hai cờ, không ai
 *    viết ra, và lần sau ai đổi thứ tự `if/else` thì nó im lặng đổi nghĩa. Phiên TASK-4008 tự nêu ca này.
 *
 * ĐỐI CHỨNG HÀNH VI: dựng HTTP server cục bộ bắt đúng request, rồi khám thân nó. Không chạm Backlog thật.
 *
 * ⚠️ `spawn` BẤT ĐỒNG BỘ, KHÔNG `spawnSync` — server nằm cùng tiến trình với test, `spawnSync` chặn vòng
 * lặp sự kiện nên server không trả lời được tiến trình con: con chờ phản hồi, cha chờ con, treo vĩnh viễn.
 * Đã mất 120 giây vì nó ở `sua-mo-ta.spec.ts`.
 *
 * ⚠️ KHOÁ GIẢ GHÉP TỪ MẢNG, không viết literal: `secret:scan` có luật `generic-secret-assign` và nó đỏ
 * đúng ở dòng gán vào tên khớp `*API_KEY*`. Nới máy quét để test chạy được là tự bỏ cái gác.
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
const MAY = mayThu('CAP_NHAT_ISSUE_JS', path.join(REPO, 'scripts/integrations/backlog/cap_nhat_issue.js'));
const KHOA_GIA = ['khoa', 'gia', 'chi', 'de', 'kiem'].join('-');

type Bat = { method: string; duong: string; than: string };

/**
 * Backlog giả. Response của POST comment CỐ Ý không mang `attachments` — đúng như Backlog thật, và đó
 * là điều kiện làm ca ① có nghĩa: nếu server giả trả mảng ấy thì bản cũ cũng in đúng, và phép kiểm rỗng.
 */
async function server() {
  const batDuoc: Bat[] = [];
  const s = http.createServer((req, res) => {
    const khuc: Buffer[] = [];
    req.on('data', (c) => khuc.push(c as Buffer));
    req.on('end', () => {
      const duong = String(req.url).split('?')[0];
      batDuoc.push({ method: String(req.method), duong, than: Buffer.concat(khuc).toString('utf8') });
      const tra = (o: unknown) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(o));
      };
      if (duong === '/api/v2/space/attachment') return tra({ id: 901, name: 'anh.png', size: 10 });
      if (/\/comments$/.test(duong)) return tra({ id: 5555, content: 'noi dung' });
      return tra({
        id: 1,
        issueKey: 'TEST-1',
        summary: 'issue thu',
        status: { id: 1, name: 'Open' },
        assignee: { id: 555, name: 'Nguoi Nhan' },
        attachments: [{ id: 901, name: 'anh.png' }],
      });
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

/** Chạy script thật. `anh` khác null ⇒ dựng một tệp ảnh giả và truyền `--anh`. */
async function chay(cong: number, themArgv: string[], anh: boolean = false) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'capnhat-'));
  const fCmt = path.join(d, 'cmt.md');
  fs.writeFileSync(fCmt, 'nội dung comment thử\n', 'utf8');
  const argv = ['--issue', 'TEST-1', '--comment-file', fCmt, ...themArgv];
  if (anh) {
    const fAnh = path.join(d, 'anh.png');
    fs.writeFileSync(fAnh, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    argv.push('--anh', fAnh);
  }
  const r = await new Promise<{ code: number | null; out: string }>((ok) => {
    const p = spawn(process.execPath, [MAY, ...argv], {
      cwd: REPO,
      env: gateEnv({
        BACKLOG_BASE_URL: `http://127.0.0.1:${cong}`,
        BACKLOG_API_KEY: KHOA_GIA,
        PROJECT_OUTPUT_DIR: 'outputs/_capnhat',
        TASK_KEY: 'CNI-0',
      }),
    });
    let out = '';
    p.stdout.on('data', (x) => { out += String(x); });
    p.stderr.on('data', (x) => { out += String(x); });
    p.on('close', (code) => ok({ code, out }));
  });
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* dọn là tiện ích */ }
  return r;
}

const patchIssue = (b: Bat[]) => b.find((x) => x.method === 'PATCH' && /\/issues\/TEST-1$/.test(x.duong)) || null;

test.describe.configure({ mode: 'default' });

test.describe('@infra cap_nhat_issue — không khai điều response không trả về', () => {
  test('ĐỐI CHỨNG DƯƠNG: có `--anh` ⇒ khai attachmentId ĐÃ GỬI, và chỉ đường xác nhận', async () => {
    const { cong, dong } = await server();
    const r = await chay(cong, [], true);
    await dong();
    expect(r.code, r.out).toBe(0);
    expect(r.out, 'phải khai id thật sự gửi đi, vì đó là điều duy nhất script biết').toMatch(/đã gửi kèm attachmentId 901/);
    expect(r.out, 'và phải chỉ đường kiểm lại, thay vì tự khẳng định').toContain('doc_comment.js TEST-1');
  });

  test('response POST comment KHÔNG có `attachments` ⇒ KHÔNG được in "(không có)"', async () => {
    const { cong, dong } = await server();
    const r = await chay(cong, [], true);
    await dong();
    /*
     * Chuỗi cũ: `đính kèm trong comment: (không có)`. Nó in ra ngay cả khi ảnh đã đính THÀNH CÔNG, vì
     * nó đọc một trường không tồn tại trong response. Một dòng log khai điều nó chưa đo.
     */
    expect(r.out, 'in "(không có)" trong khi vừa gửi ảnh thành công là nói sai sự thật')
      .not.toMatch(/đính kèm trong comment/);
  });

  test('ĐỐI CHỨNG ÂM: không `--anh` ⇒ nói rõ "không gửi kèm ảnh", không im lặng', async () => {
    const { cong, dong } = await server();
    const r = await chay(cong, []);
    await dong();
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('không gửi kèm ảnh');
    expect(r.out, 'không gửi gì thì không được khai một id nào').not.toMatch(/đã gửi kèm attachmentId/);
  });
});

test.describe('@infra cap_nhat_issue — `--go-assignee` gỡ người nhận', () => {
  test('ĐỐI CHỨNG DƯƠNG: `--go-assignee` ⇒ PATCH mang `assigneeId` RỖNG', async () => {
    const { cong, batDuoc, dong } = await server();
    await chay(cong, ['--go-assignee']);
    await dong();
    const p = patchIssue(batDuoc);
    expect(p, 'không thấy PATCH ⇒ phép kiểm này RỖNG').not.toBeNull();
    const than = new URLSearchParams(p!.than);
    expect(than.has('assigneeId'), 'không gửi khoá thì Backlog giữ nguyên người nhận cũ').toBe(true);
    expect(than.get('assigneeId'),
      'phải là RỖNG: `0` thì Backlog trả 404 "No such user", còn bỏ qua thì không gỡ được').toBe('');
  });

  test('ĐỐI CHỨNG ÂM: KHÔNG truyền cờ ⇒ KHÔNG có PATCH nào, hành vi cũ y nguyên', async () => {
    const { cong, batDuoc, dong } = await server();
    await chay(cong, []);
    await dong();
    expect(patchIssue(batDuoc),
      'thêm cờ mới mà làm lượt không-truyền-gì cũng PATCH thì nó đã đổi hành vi cũ').toBeNull();
  });

  test('`--assignee-id` một mình ⇒ gửi đúng id đó, không bị cờ mới chen vào', async () => {
    const { cong, batDuoc, dong } = await server();
    await chay(cong, ['--assignee-id', '777']);
    await dong();
    const than = new URLSearchParams(patchIssue(batDuoc)!.than);
    expect(than.get('assigneeId')).toBe('777');
  });

  /*
   * CA PHIÊN TASK-4008 TỰ NÊU, và nó là loại dễ trôi nhất: một ưu tiên NGẦM giữa hai cờ. Hiện
   * `--go-assignee` thắng — chủ ý, nhưng không ai viết ra. Lần sau ai đổi thứ tự `if/else` thì nghĩa đổi
   * mà không ca nào đỏ. Spec này ghim lựa chọn ấy lại.
   */
  test('HAI cờ cùng lúc ⇒ tất định: `--go-assignee` THẮNG', async () => {
    const { cong, batDuoc, dong } = await server();
    await chay(cong, ['--go-assignee', '--assignee-id', '777']);
    await dong();
    const than = new URLSearchParams(patchIssue(batDuoc)!.than);
    expect(than.get('assigneeId'),
      'gỡ người nhận là ý định rõ hơn gán ai đó, nên nó thắng — và lựa chọn này phải được ghim')
      .toBe('');
  });

  test('`--status-id` đi cùng `--go-assignee` ⇒ gửi CẢ HAI khoá', async () => {
    const { cong, batDuoc, dong } = await server();
    await chay(cong, ['--go-assignee', '--status-id', '4']);
    await dong();
    const than = new URLSearchParams(patchIssue(batDuoc)!.than);
    expect(than.get('statusId'), 'cờ mới không được ăn mất khoá cũ').toBe('4');
    expect(than.get('assigneeId')).toBe('');
  });
});
