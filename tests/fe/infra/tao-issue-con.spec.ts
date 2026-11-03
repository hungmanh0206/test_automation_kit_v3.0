/*
 * `tao_issue_con.js` — NHÁNH TẠO TỪNG BỎ QUA `--anh`, VÀ BỎ QUA IM LẶNG.
 *
 * Đo 03/11/2026 trên `main`: `--anh` được đọc ở dòng 37 và được kiểm tồn tại ở dòng 44, nhưng toàn bộ
 * logic đính kèm nằm trong nhánh `if (SUA)` ở dòng 84. Nhánh TẠO không có một dòng nào nhắc `ANH`.
 *
 * Hậu quả: `--parent … --tieu-de … --anh buoc1.png` tạo issue với **0 tệp**, log vẫn in "đã tạo" như
 * bình thường, còn mô tả thì nhúng `![image][buoc1.png]` trỏ vào hư không — tức một issue tầng bug ra
 * đời không mang được chứng cứ nào. Yêu cầu độ sâu evidence là của `RULE_GLOBAL.md` → *Evidence — Quy
 * chuẩn bắt buộc* → PHẠM VI; spec này KHÔNG diễn giải lại câu đó, vì `rule:consistency` chặn mọi bản
 * tóm và nó đã chặn đúng dòng này ở lượt đầu. Phiên CSDL-4008 đã cắn chuyện mất đính kèm ở CSDL-4089.
 *
 * NĂM TÍNH CHẤT ĐƯỢC GÁC:
 *
 *   ① `--anh` ở nhánh TẠO phải THẬT SỰ tải lên: một lượt `POST /space/attachment` cho mỗi ảnh, và
 *      `attachmentId[]` phải có trong thân `POST /issues`.
 *   ② Tạo xong phải ĐỌC LẠI từ máy chủ. `attachmentId[]` sai kiểu thì Backlog vẫn trả 201 kèm issue
 *      rỗng — tin mã trả về của lượt ghi là tin chính thứ đang cần kiểm.
 *   ③ Máy chủ trả THIẾU ảnh ⇒ `exit 1` kèm lệnh sửa. Đây là tính chất §4 quan trọng nhất: một lượt
 *      "thành công nhưng thiếu evidence" phải thành THẤT BẠI ỒN ÀO.
 *   ④ Không `--anh` ⇒ không `attachmentId[]`, và 0 lượt tải lên.
 *   ⑤ `--dry-run` ⇒ 0 lượt ghi, nhưng vẫn in danh sách ảnh để người gọi thấy mình đang gửi gì.
 *
 * ĐỐI CHỨNG HÀNH VI: dựng HTTP server cục bộ giả Backlog, bắt từng request. Không chạm Backlog thật.
 *
 * ⚠️ `spawnSync` LÀM TREO VĨNH VIỄN — server nằm cùng tiến trình với test, `spawnSync` chặn vòng lặp sự
 * kiện nên server không trả lời được tiến trình con. Phải `spawn` bất đồng bộ. Đã mất 120 giây vì nó ở
 * `sua-mo-ta.spec.ts`; đừng "dọn" về `spawnSync`.
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
const MAY = mayThu('TAO_ISSUE_CON_JS', path.join(REPO, 'scripts/integrations/backlog/tao_issue_con.js'));
const KHOA_GIA = ['khoa', 'gia', 'chi', 'de', 'kiem'].join('-');

type Bat = { method: string; duong: string; than: string };

/**
 * Backlog giả. `soTepTraVe` quyết định GET sau khi tạo trả về bao nhiêu đính kèm — đó là cách giả lập
 * ca "máy chủ nhận ít hơn số ảnh đã gửi" mà không cần làm gì sai ở phía script.
 */
async function server(soTepTraVe: (daGui: number) => number = (n) => n) {
  const batDuoc: Bat[] = [];
  let daTaiLen = 0;
  const s = http.createServer((req, res) => {
    const khuc: Buffer[] = [];
    req.on('data', (c) => khuc.push(c as Buffer));
    req.on('end', () => {
      const duong = String(req.url).split('?')[0];
      const than = Buffer.concat(khuc).toString('utf8');
      batDuoc.push({ method: String(req.method), duong, than });
      const tra = (o: unknown) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(o));
      };
      if (duong === '/api/v2/space/attachment') {
        daTaiLen += 1;
        tra({ id: 900 + daTaiLen, name: `tep-${daTaiLen}.png`, size: 10 });
      } else if (duong === '/api/v2/priorities') {
        tra([{ id: 2, name: 'High' }, { id: 3, name: 'Normal' }, { id: 4, name: 'Low' }]);
      } else if (/\/issueTypes$/.test(duong)) {
        tra([{ id: 77, name: 'Task' }, { id: 78, name: 'Bug' }]);
      } else if (duong === '/api/v2/issues' && req.method === 'POST') {
        tra({ id: 5, issueKey: 'TEST-9', summary: 'issue vua tao' });
      } else if (duong === '/api/v2/issues/TEST-9') {
        /* GET nghiệm thu: trả số tệp theo hàm, để giả lập cả ca đủ và ca thiếu. */
        const n = soTepTraVe(daTaiLen);
        tra({
          id: 5,
          issueKey: 'TEST-9',
          summary: 'issue vua tao',
          attachments: Array.from({ length: n }, (_, i) => ({ id: 900 + i + 1, name: `tep-${i + 1}.png` })),
        });
      } else {
        /* Issue CHA — quyết định projectId và người nhận. */
        tra({
          id: 1,
          issueKey: 'TEST-1',
          summary: 'issue cha',
          projectId: 42,
          issueType: { id: 77, name: 'Task' },
          assignee: { id: 555, name: 'Nguoi Nhan' },
        });
      }
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

/** Dựng file mô tả + `soAnh` ảnh giả, rồi chạy script thật BẤT ĐỒNG BỘ. */
async function chay(cong: number, soAnh: number, themArgv: string[] = []) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'taoissue-'));
  const fMoTa = path.join(d, 'mo-ta.md');
  const anh: string[] = [];
  for (let i = 1; i <= soAnh; i += 1) {
    const f = path.join(d, `buoc${i}.png`);
    fs.writeFileSync(f, Buffer.from([0x89, 0x50, 0x4e, 0x47, i]));
    anh.push(f);
  }
  fs.writeFileSync(fMoTa, `Bước 1\n\n${anh.map((a) => `![image][${path.basename(a)}]`).join('\n')}\n`, 'utf8');

  const argv = ['--parent', 'TEST-1', '--tieu-de', 'bug thu', '--mo-ta-file', fMoTa,
    ...anh.flatMap((a) => ['--anh', a]), ...themArgv];

  const r = await new Promise<{ code: number | null; out: string }>((ok) => {
    const p = spawn(process.execPath, [MAY, ...argv], {
      cwd: REPO,
      env: gateEnv({
        BACKLOG_BASE_URL: `http://127.0.0.1:${cong}`,
        BACKLOG_API_KEY: KHOA_GIA,
        PROJECT_OUTPUT_DIR: 'outputs/_taoissue',
        TASK_KEY: 'TIC-0',
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

const taiLen = (b: Bat[]) => b.filter((x) => x.duong === '/api/v2/space/attachment');
const taoIssue = (b: Bat[]) => b.find((x) => x.duong === '/api/v2/issues' && x.method === 'POST') || null;

test.describe.configure({ mode: 'default' });

test.describe('@infra tao_issue_con — nhánh TẠO phải đính ảnh thật', () => {
  test('ĐỐI CHỨNG DƯƠNG: 2 ảnh ⇒ 2 lượt tải lên và `attachmentId[]` trong thân POST', async () => {
    const { cong, batDuoc, dong } = await server();
    const r = await chay(cong, 2);
    await dong();
    expect(r.code, r.out).toBe(0);
    expect(taiLen(batDuoc).length, 'không tải lên thì `attachmentId[]` chỉ là id của hư không').toBe(2);
    const post = taoIssue(batDuoc);
    expect(post, 'không thấy lượt tạo issue ⇒ phép kiểm này RỖNG').not.toBeNull();
    const than = new URLSearchParams(post!.than);
    /*
     * HÌNH DẠNG DÂY LÀ MỘT CẶP, GIÁ TRỊ NGĂN BẰNG PHẨY — đừng đổi sang `getAll().length`.
     *
     * `api()` dựng thân bằng `new URLSearchParams(form)`, và `URLSearchParams` LÀM PHẲNG mảng: `[901,
     * 902]` thành MỘT cặp `attachmentId[]=901%2C902`, không phải hai cặp lặp. Lượt đầu của spec này đỏ
     * vì tôi đoán là hai cặp. Nhánh `--update` dùng y hệt hình dạng ấy và đã chạy thật được, nên đây là
     * hình dạng Backlog nhận — không phải chỗ cần sửa.
     */
    const dsId = String(than.get('attachmentId[]') || '').split(',').filter(Boolean);
    expect(dsId.length,
      'nhánh TẠO bỏ qua `--anh` thì đây là 0, và issue ra đời KHÔNG CÓ EVIDENCE').toBe(2);
    expect(dsId.every((x) => /^\d+$/.test(x)), 'phải là id số do lượt tải lên trả về').toBe(true);
  });

  test('ĐỐI CHỨNG ÂM: không `--anh` ⇒ 0 lượt tải lên và KHÔNG `attachmentId[]`', async () => {
    const { cong, batDuoc, dong } = await server();
    const r = await chay(cong, 0);
    await dong();
    expect(r.code, r.out).toBe(0);
    expect(taiLen(batDuoc).length).toBe(0);
    const than = new URLSearchParams(taoIssue(batDuoc)!.than);
    expect(than.has('attachmentId[]'), 'gửi khoá rỗng cũng là THAY cả bộ đính kèm').toBe(false);
  });

  test('tạo xong phải ĐỌC LẠI từ máy chủ, không tin phản hồi của lượt POST', async () => {
    const { cong, batDuoc, dong } = await server();
    await chay(cong, 1);
    await dong();
    const sauPost = batDuoc.slice(batDuoc.findIndex((x) => x.duong === '/api/v2/issues' && x.method === 'POST') + 1);
    expect(sauPost.some((x) => x.method === 'GET' && x.duong === '/api/v2/issues/TEST-9'),
      '`attachmentId[]` sai kiểu thì Backlog vẫn trả 201 kèm issue rỗng — phải GET lại mới biết').toBe(true);
  });
});

test.describe('@infra tao_issue_con — thiếu evidence phải THẤT BẠI ỒN ÀO', () => {
  /*
   * CA QUAN TRỌNG NHẤT. Trước bản vá, một lượt tạo thiếu ảnh vẫn in "[OK] đã tạo" và thoát 0 — tức bug
   * ra Backlog không có evidence mà người gọi không biết. §4 đòi điều ngược lại.
   */
  test('ĐỐI CHỨNG DƯƠNG: máy chủ nhận 1/2 ảnh ⇒ exit 1, nêu số thiếu và lệnh sửa', async () => {
    const { cong, dong } = await server((daGui) => Math.max(0, daGui - 1));
    const r = await chay(cong, 2);
    await dong();
    expect(r.code, `thoát 0 ở đây là để bug không có evidence đi ra mà không ai biết
OUT:${r.out}`).toBe(1);
    expect(r.out, 'phải nói THIẾU BAO NHIÊU, không chỉ nói "có lỗi"').toMatch(/thiếu 1 ảnh/);
    expect(r.out, 'phải chỉ luôn đường sửa, vì issue đã tồn tại rồi').toContain('--update TEST-9');
    expect(r.out).toContain('đính kèm sau khi tạo: 1/2');
  });

  test('ĐỐI CHỨNG ÂM: máy chủ nhận đủ 2/2 ⇒ exit 0, KHÔNG báo thiếu', async () => {
    const { cong, dong } = await server();
    const r = await chay(cong, 2);
    await dong();
    expect(r.code, r.out).toBe(0);
    expect(r.out).toContain('đính kèm sau khi tạo: 2/2');
    expect(r.out, 'báo thiếu khi không thiếu thì người gọi sẽ học cách bỏ qua cảnh báo').not.toMatch(/thiếu \d+ ảnh/);
  });

  test('0 ảnh và máy chủ trả 0 ⇒ KHÔNG coi là thiếu', async () => {
    const { cong, dong } = await server();
    const r = await chay(cong, 0);
    await dong();
    expect(r.code, 'không gửi ảnh nào thì không có gì để thiếu').toBe(0);
    expect(r.out).not.toMatch(/thiếu \d+ ảnh/);
  });
});

test.describe('@infra tao_issue_con — `--dry-run` KHÔNG được ghi', () => {
  test('ĐỐI CHỨNG DƯƠNG: `--dry-run` ⇒ 0 tải lên, 0 POST, nhưng VẪN in danh sách ảnh', async () => {
    const { cong, batDuoc, dong } = await server();
    const r = await chay(cong, 2, ['--dry-run']);
    await dong();
    expect(r.code, r.out).toBe(0);
    expect(taiLen(batDuoc).length, '`--dry-run` mà vẫn tải ảnh lên space thì nó không phải dry-run').toBe(0);
    expect(taoIssue(batDuoc), '`--dry-run` mà vẫn POST thì nó là lời khai, không phải chế độ').toBeNull();
    expect(r.out, 'phải in ảnh sẽ gửi — người gọi cần thấy mình đang gửi gì TRƯỚC khi gửi')
      .toMatch(/ảnh đính kèm: buoc1\.png · buoc2\.png/);
    expect(batDuoc.filter((x) => x.method === 'GET').length, 'vẫn phải đọc cha để dựng được payload')
      .toBeGreaterThan(0);
  });

  test('`--dry-run` không `--anh` ⇒ in rõ "(không có)", không im lặng', async () => {
    const { cong, dong } = await server();
    const r = await chay(cong, 0, ['--dry-run']);
    await dong();
    expect(r.out, 'im lặng ở đây là lý do lỗ cũ sống được lâu').toContain('ảnh đính kèm: (không có)');
  });
});
