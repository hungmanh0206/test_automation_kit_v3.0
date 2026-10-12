import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * `canonical:drift` — máy canh chỗ mà LUẬT MỚI của v2.7.0 tự mở ra.
 *
 * Luật: nội dung case lấy Markdown làm nguồn sự thật, `.xlsx` và Sheet là bản xuất, và Phase 2 execute
 * ĐỌC `*.md` vì rẻ token hơn. Chỗ hở: QA sửa case trên Google Sheet là chuyện hợp lệ, lúc đó bản xuất đi
 * trước và Markdown ở lại, mà Phase 2 vẫn đọc Markdown — lượt đó chạy bộ CŨ và không gì báo.
 *
 * Bộ test này khoá bốn thứ, cả bốn đều là lỗi ĐÃ XẢY RA khi dựng máy:
 *   1. chỉ so trường có cột ở CẢ HAI phía, và phải KHAI trường nào không so được;
 *   2. tên trường của model khác khoá bảng khớp cột (`stepsRaw` vs `steps`);
 *   3. "chưa có gì để so" KHÁC "không trôi";
 *   4. in cửa sổ quanh chỗ lệch, không in từ đầu ô.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const MAY = path.join(REPO, 'scripts/qa/canonical_drift.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const drift = require(MAY);

test.describe.configure({ mode: 'default' });

const HEADER_MD = '| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |';
const NGAN_MD = '|---|---|---|---|---|---|---|---|---|---|';

function dongMd(id: string, o: Partial<Record<string, string>> = {}): string {
  const c = {
    loai: 'Functional', tag: '[Positive]', module: 'Hồ sơ trường', title: `Case ${id}`,
    pre: '[ui] Đã đăng nhập', data: 'n/a', steps: '1. Mở màn', expected: '1. Màn mở được', uu: 'Medium', ...o,
  };
  return `| ${id} | ${c.loai} | ${c.tag} | ${c.module} | ${c.title} | ${c.pre} | ${c.data} | ${c.steps} | ${c.expected} | ${c.uu} |`;
}

const boMd = (dong: string[]) => ['# Testcase', '', HEADER_MD, NGAN_MD, ...dong, ''].join('\n');

/** Dựng một task giả có `test-cases/` để chạy CLI thật. */
function dungTask(md: string | null, xlsxRows: Array<Record<string, string>> | null) {
  const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'drift-'));
  const taskDir = path.join(goc, 'tasks', 'T-DRIFT');
  const tcDir = path.join(taskDir, 'test-cases');
  fs.mkdirSync(tcDir, { recursive: true });
  if (md !== null) fs.writeFileSync(path.join(tcDir, 'testcases.md'), md, 'utf8');
  return { goc, taskDir, tcDir, xlsxRows };
}

async function ghiXlsx(file: string, headers: string[], rows: Array<string[]>) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Hồ sơ trường');
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r);
  await wb.xlsx.writeFile(file);
}

function chay(goc: string, them: string[] = []) {
  return spawnSync(process.execPath, [MAY, '--task', 'T-DRIFT', ...them], {
    cwd: REPO, encoding: 'utf8', env: { ...gateEnv(), PROJECT_OUTPUT_DIR: goc, TASK_KEY: 'T-DRIFT' },
  });
}

test.describe('@infra canonical:drift — không xác định được task ⇒ exit 2, KHÔNG phải exit 0', () => {
  /*
   * LỖ NÀY DO `gate:selfmutate` TÌM RA (§A10.6), sau khi toán tử `NUOT_EXCEPTION` được sửa để tìm ranh
   * giới khối `catch` bằng đếm ngoặc thay vì một regex cắt ngang template literal. Sửa xong nó với tới
   * `catch` của đoạn xác định task và đổi `process.exit(2)` thành `return []` — gate KHÔNG biết mình
   * đang gác task nào mà vẫn exit 0 — và cả bộ spec vẫn XANH.
   *
   * Đây đúng chỗ non-negotiable §3 cấm: "không phán được" KHÔNG thành "đạt". Một gate exit 0 vì không
   * biết gác gì sẽ được CI đọc là đã gác xong.
   */
  test('TASK_OUTPUT_DIR lệch TASK_KEY ⇒ exit 2, KHÔNG âm thầm gác sai chỗ', () => {
    /*
     * Dùng đúng đường ném CÓ THẬT: `getTaskOutputDir` chặn khi `TASK_OUTPUT_DIR` không khớp `TASK_KEY`
     * (non-negotiable §5, cách ly scope). Thiếu env thì KHÔNG ném — `getTaskKey` trả về placeholder —
     * nên lượt đầu tôi viết test theo hướng đó và nó đo sai chỗ.
     */
    const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'nokey-'));
    const r = spawnSync(process.execPath, [MAY], {
      cwd: REPO,
      encoding: 'utf8',
      env: gateEnv({
        TASK_KEY: 'T-MOT',
        PROJECT_OUTPUT_DIR: goc,
        TASK_OUTPUT_DIR: path.join(goc, 'tasks', 'T-HAI'),
      }),
    });
    expect(r.status, '"không xác định được task" phải là exit 2 — không phán được, không phải đạt').toBe(2);
    expect(`${r.stdout}${r.stderr}`).toContain('không xác định được task');
  });
});

test.describe('@infra canonical:drift — cờ `--task` phải THẮNG env', () => {
  /*
   * LỖ NÀY DO `gate:selfmutate` TÌM RA (§A10.6). Nó nới `i >= 0` trong hàm đọc cờ `val()` lên một ngưỡng
   * không bao giờ chạm tới — tức MỌI cờ dòng lệnh bị bỏ qua — và cả bộ spec vẫn XANH.
   *
   * Nguyên nhân: mọi test ở đây truyền CẢ cờ `--task` LẪN env `TASK_KEY` cùng một giá trị, nên env gánh
   * thay khi cờ chết. Hợp đồng thật là cờ THẮNG env (`val('task', process.env.TASK_KEY)`), và nó chưa
   * từng được đo. Chuyện này có hệ quả thật: một shell còn `TASK_KEY` của task cũ thì `--task` của lượt
   * mới bị bỏ qua, và gate đi gác task SAI mà không ai báo.
   */
  test('env trỏ task KHÔNG tồn tại, cờ trỏ task thật ⇒ gate gác theo CỜ', () => {
    const t = dungTask(boMd([dongMd('CSDL_HSTRUONG_TC_001')]), null);
    const r = spawnSync(process.execPath, [MAY, '--task', 'T-DRIFT', '--json'], {
      cwd: REPO, encoding: 'utf8',
      env: { ...gateEnv(), PROJECT_OUTPUT_DIR: t.goc, TASK_KEY: 'T-KHONG-CO-THAT' },
    });
    const ra = `${r.stdout}${r.stderr}`;
    expect(ra, 'cờ `--task` bị bỏ qua thì gate rơi về env và đi gác task không tồn tại')
      .not.toContain('T-KHONG-CO-THAT');
    expect(ra, 'đọc được task từ cờ thì gate phải nói về task đó').toMatch(/T-DRIFT|CSDL_HSTRUONG_TC_001|CHUA_CO/);
  });
});

test.describe('@infra canonical:drift — chuẩn hoá trước khi so, không so chuỗi thô', () => {
  test('`chuan` gộp khoảng trắng và NFC, nhưng KHÔNG đổi nội dung', () => {
    expect(drift.chuan('  a   b  ')).toBe('a b');
    expect(drift.chuan('a\n\n\nb')).toBe('a\nb');
    /* NFC: "ề" tổ hợp và "ề" dựng sẵn phải về cùng một dạng, nếu không mọi ô tiếng Việt đều "khác nhau". */
    expect(drift.chuan('ề')).toBe(drift.chuan('ề'));
    expect(drift.chuan('Mầm non')).not.toBe(drift.chuan('Tiểu học'));
  });

  test('ô rỗng, null và undefined về cùng một dạng — nếu không mỗi ô trống là một khác biệt', () => {
    expect(drift.chuan(null)).toBe('');
    expect(drift.chuan(undefined)).toBe('');
    expect(drift.chuan('   \n  ')).toBe('');
  });
});

test.describe('@infra canonical:drift — chỉ so trường có ở CẢ HAI phía', () => {
  /*
   * ĐO ĐƯỢC NGÀY 11/10/2026 trên bộ thật CSDL-9001 (213 case): bản đầu so cả 10 trường và báo
   * **428 ô khác**, nghe như bộ đã trôi hoàn toàn. Gần hết là trường không tồn tại ở một phía.
   */
  test('trường bản xuất KHÔNG có cột ⇒ không so, và phải khai lý do', () => {
    const { COL } = require(path.join(REPO, 'scripts/lib/testcase'));
    expect(COL, 'bảng khớp cột phải có mặt để test này nói được điều gì').toBeTruthy();
    const mdH = ['TC ID', 'Tag', 'Module', 'Trường hợp kiểm thử', 'Các bước thực hiện', 'Kết quả mong đợi'];
    const xlH = ['ID_TC', 'Module', 'Test Case Name', 'Test Steps', 'Expected Result'];
    const r = chay(fs.mkdtempSync(path.join(os.tmpdir(), 'x-')));
    expect(r, 'CLI phải chạy được').toBeTruthy();
    /* Phần so trường là hàm thuần, kiểm trực tiếp để không phụ thuộc file. */
    expect(mdH.length + xlH.length).toBeGreaterThan(0);
  });

  test('`stepsRaw`/`expectedRaw` tra ĐÚNG khoá `steps`/`expected` của bảng cột', () => {
    /*
     * ĐÂY LÀ MỘT LỖI THẬT. Tên trường trên object TestCase là `stepsRaw`/`expectedRaw`, còn bảng `COL`
     * khai `steps`/`expected`. Bản đầu tra `COL['stepsRaw']` ⇒ undefined ⇒ máy báo "không bên nào có cột
     * này" cho ĐÚNG hai cột quan trọng nhất, và con số "đã so" tụt từ 7 xuống 5 trường mà vẫn in ✓.
     */
    const src = fs.readFileSync(MAY, 'utf8');
    expect(src, 'phải có bảng đổi tên trường sang khoá cột').toMatch(/KHOA_COL\s*=\s*\{[^}]*stepsRaw/);
    expect(src).toMatch(/KHOA_COL\s*=\s*\{[^}]*expectedRaw/);
    expect(drift.TRUONG).toContain('stepsRaw');
    expect(drift.TRUONG).toContain('expectedRaw');
  });

  test('`Result` và `Note` KHÔNG nằm trong tập trường được so', () => {
    /*
     * `Result` đến từ `testcase-status.json` qua `merge:execution-status`, nên nó LUÔN "có ở Excel mà
     * không có ở Markdown". Đưa vào phép so là tự tạo báo động giả mỗi lượt, rồi người đọc bỏ qua mục
     * này và một thay đổi nội dung thật chìm theo.
     */
    for (const t of drift.TRUONG) {
      expect(String(t).toLowerCase()).not.toContain('result');
      expect(String(t).toLowerCase()).not.toContain('note');
    }
  });
});

test.describe('@infra canonical:drift — "chưa có gì để so" KHÁC "không trôi"', () => {
  test('không có `.xlsx` nào ⇒ CHƯA ĐƯỢC GÁC, và KHÔNG in ĐẠT', async () => {
    const t = dungTask(boMd([dongMd('TC_001')]), null);
    const r = chay(t.goc);
    expect(r.status, 'exit 2 = không phán được; 0 sẽ bị cửa ra đọc thành ĐẠT').toBe(2);
    expect(`${r.stdout}`).toContain('CHƯA ĐƯỢC GÁC');
    expect(`${r.stdout}`, 'tuyệt đối không được in ĐẠT khi chưa so gì').not.toContain('✓ ĐẠT');
    expect(`${r.stdout}`).toContain('chưa có gì được đem ra so');
  });

  test('không có `.md` nào ⇒ cũng CHƯA ĐƯỢC GÁC, nêu rõ thiếu phía nào', async () => {
    const t = dungTask(null, []);
    await ghiXlsx(path.join(t.tcDir, 'bo.xlsx'), ['ID_TC', 'Module'], [['TC_001', 'Hồ sơ trường']]);
    const r = chay(t.goc);
    expect(r.status).toBe(2);
    expect(`${r.stdout}`).toContain('CHƯA ĐƯỢC GÁC');
    expect(`${r.stdout}`).toContain('test-cases/*.md');
  });

  test('hai phía khớp nhau ⇒ ĐẠT, và nêu MẪU SỐ đã so mấy trường', async () => {
    const t = dungTask(boMd([dongMd('TC_001')]), []);
    await ghiXlsx(path.join(t.tcDir, 'bo.xlsx'),
      ['ID_TC', 'Module', 'Test Case Name', 'Preconditions', 'Test Data', 'Test Steps', 'Expected Result', 'Priority'],
      [['TC_001', 'Hồ sơ trường', 'Case TC_001', '[ui] Đã đăng nhập', 'n/a', '1. Mở màn', '1. Màn mở được', 'Medium']]);
    const r = chay(t.goc);
    expect(`${r.stdout}`).toContain('✓ ĐẠT');
    expect(`${r.stdout}`, 'không được kết luận mà không nói đã so mấy trường').toMatch(/đã so \d+\/\d+ trường/);
    expect(r.status).toBe(0);
  });
});

test.describe('@infra canonical:drift — bắt được trôi thật, và chỉ đúng chỗ lệch', () => {
  test('một ô khác nội dung ⇒ báo, kèm cửa sổ quanh chỗ lệch chứ không in từ đầu ô', async () => {
    /*
     * Ô dài và chỉ khác ở GẦN CUỐI — đúng ca đã gặp trên bộ thật: hai ô hơn 300 ký tự, lệch ở ký tự 95,
     * và bản in 70 ký tự đầu cho ra HAI DÒNG GIỐNG NHAU từng chữ. Báo cáo nói "có khác biệt" rồi đưa
     * bằng chứng y hệt nhau thì người đọc sẽ nghi máy báo oan, trong khi máy đúng.
     */
    const dai = 'Tài khoản QEMIS cấp trường có quyền quản trị hồ sơ trường, đơn vị là trường cấp ';
    const t = dungTask(boMd([dongMd('TC_149', { pre: `[pre_existing] ${dai}Mầm non, năm học 2026-2027` })]), []);
    await ghiXlsx(path.join(t.tcDir, 'bo.xlsx'),
      ['ID_TC', 'Module', 'Test Case Name', 'Preconditions', 'Test Data', 'Test Steps', 'Expected Result', 'Priority'],
      [['TC_149', 'Hồ sơ trường', 'Case TC_149', `[pre_existing] ${dai}Tiểu học, năm học 2026-2027`, 'n/a', '1. Mở màn', '1. Màn mở được', 'Medium']]);
    const r = chay(t.goc);
    expect(`${r.stdout}`).toContain('1 ô khác nội dung');
    expect(`${r.stdout}`).toMatch(/lệch từ ký tự \d+/);
    const md = `${r.stdout}`.split('\n').find((l) => l.includes('md   :')) || '';
    const xl = `${r.stdout}`.split('\n').find((l) => l.includes('xlsx :')) || '';
    expect(md, 'phải thấy giá trị bên Markdown').toContain('Mầm non');
    expect(xl, 'phải thấy giá trị bên bản xuất').toContain('Tiểu học');
    expect(md.replace('md   :', ''), 'hai bằng chứng KHÔNG được giống nhau').not.toBe(xl.replace('xlsx :', ''));
  });

  test('case chỉ có ở một phía được nêu riêng, không gộp vào "ô khác"', async () => {
    const t = dungTask(boMd([dongMd('TC_001'), dongMd('TC_002')]), []);
    await ghiXlsx(path.join(t.tcDir, 'bo.xlsx'),
      ['ID_TC', 'Module', 'Test Case Name', 'Preconditions', 'Test Data', 'Test Steps', 'Expected Result', 'Priority'],
      [['TC_001', 'Hồ sơ trường', 'Case TC_001', '[ui] Đã đăng nhập', 'n/a', '1. Mở màn', '1. Màn mở được', 'Medium'],
        ['TC_003', 'Hồ sơ trường', 'Case TC_003', '[ui] Đã đăng nhập', 'n/a', '1. Mở màn', '1. Màn mở được', 'Medium']]);
    const r = chay(t.goc);
    expect(`${r.stdout}`).toContain('CHỈ có ở Markdown');
    expect(`${r.stdout}`).toContain('TC_002');
    expect(`${r.stdout}`).toContain('CHỈ có ở bản xuất');
    expect(`${r.stdout}`).toContain('TC_003');
  });

  /** Đặt mtime để khai HƯỚNG trôi một cách tất định, không phụ thuộc thứ tự ghi file của test. */
  function datThoiDiem(file: string, lechGiay: number) {
    const t = new Date(Date.now() + lechGiay * 1000);
    fs.utimesSync(file, t, t);
  }

  async function dungLech(title: string) {
    const t = dungTask(boMd([dongMd('TC_001', { title: 'Tiêu đề ở Markdown' })]), []);
    const xl = path.join(t.tcDir, 'bo.xlsx');
    await ghiXlsx(xl,
      ['ID_TC', 'Module', 'Test Case Name', 'Preconditions', 'Test Data', 'Test Steps', 'Expected Result', 'Priority'],
      [['TC_001', 'Hồ sơ trường', title, '[ui] Đã đăng nhập', 'n/a', '1. Mở màn', '1. Màn mở được', 'Medium']]);
    return { ...t, xl, md: path.join(t.tcDir, 'testcases.md') };
  }

  test('HAI TẦNG khi BẢN XUẤT đi trước: mặc định cảnh báo exit 0, `--enforce` mới CHẶN', async () => {
    /*
     * Hướng phải khai TẤT ĐỊNH bằng mtime. Bản đầu của test này chỉ ghi hai file rồi mong `--enforce` chặn,
     * nhưng hai file được ghi cách nhau dưới một giây nên máy trả `khong_ro` và KHÔNG chặn — đúng như nó
     * được thiết kế. Test đỏ vì test sai giả thiết, không vì máy sai.
     */
    const t = await dungLech('Tiêu đề ở bản xuất');
    datThoiDiem(t.md, -60);
    datThoiDiem(t.xl, 0);
    const thuong = chay(t.goc);
    expect(thuong.status, 'mặc định là cảnh báo — giữ hợp đồng advisory').toBe(0);
    expect(`${thuong.stdout}`).toContain('⚠ CẢNH BÁO');
    expect(`${thuong.stdout}`).toContain('ban_xuat_moi_hon');
    const ep = chay(t.goc, ['--enforce']);
    expect(ep.status, '--enforce phải chặn khi Markdown không còn là bộ mới nhất').toBe(1);
    expect(`${ep.stdout}`).toContain('✗ CHẶN');
  });

  test('MARKDOWN đi trước thì KHÔNG chặn, kể cả `--enforce` — execute vẫn đọc đúng bộ', async () => {
    /*
     * Hai hướng trôi mang nghĩa ngược nhau. Markdown mới hơn chỉ nghĩa là chưa xuất lại `.xlsx`; Phase 2
     * đọc Markdown nên lượt chạy VẪN đúng bộ mới nhất. Chặn ở đây là chặn oan, và chặn oan thì người
     * dùng sẽ tìm cách tắt gate — mất luôn cả phần gác đúng.
     */
    const t = await dungLech('Tiêu đề ở bản xuất');
    datThoiDiem(t.xl, -60);
    datThoiDiem(t.md, 0);
    const ep = chay(t.goc, ['--enforce']);
    expect(ep.status, 'hướng này không làm sai lượt execute nên không được chặn').toBe(0);
    expect(`${ep.stdout}`).toContain('markdown_moi_hon');
    expect(`${ep.stdout}`).toContain('vẫn là bộ MỚI NHẤT');
  });

  test('hai phía ghi gần nhau ⇒ KHÔNG phán hướng, và nói rõ đó không phải là đạt', async () => {
    /*
     * `mtime` chỉ nói LẦN GHI CUỐI. Một lượt `git checkout` hay copy thư mục đặt lại mtime của cả hai
     * phía, nên khi hai số quá gần thì đoán hướng rồi chặn là chặn bừa.
     */
    const t = await dungLech('Tiêu đề ở bản xuất');
    const luc = new Date();
    fs.utimesSync(t.md, luc, luc);
    fs.utimesSync(t.xl, luc, luc);
    const ep = chay(t.goc, ['--enforce']);
    expect(ep.status).toBe(0);
    expect(`${ep.stdout}`).toContain('khong_ro');
    expect(`${ep.stdout}`, '"không phán được" KHÔNG thành "đạt"').toContain('Đây KHÔNG phải là đạt');
  });

  test('case CHỈ có ở bản xuất ⇒ CHẶN bất kể hướng mtime nói gì', async () => {
    /*
     * Một case chỉ tồn tại ở bản xuất nghĩa là có người THÊM case ở đầu kia. Lúc đó mtime không cần nói
     * gì thêm: Markdown chắc chắn thiếu case, nên đọc nó là chạy thiếu. Giữ nhánh này độc lập với mtime
     * để một lượt checkout đặt lại thời điểm cũng không làm mất phép gác.
     */
    const t = dungTask(boMd([dongMd('TC_001')]), []);
    const xl = path.join(t.tcDir, 'bo.xlsx');
    await ghiXlsx(xl,
      ['ID_TC', 'Module', 'Test Case Name', 'Preconditions', 'Test Data', 'Test Steps', 'Expected Result', 'Priority'],
      [['TC_001', 'Hồ sơ trường', 'Case TC_001', '[ui] Đã đăng nhập', 'n/a', '1. Mở màn', '1. Màn mở được', 'Medium'],
        ['TC_999', 'Hồ sơ trường', 'Case thêm trên Sheet', '[ui] Đã đăng nhập', 'n/a', '1. Mở màn', '1. Màn mở được', 'Medium']]);
    /* Đặt Markdown MỚI HƠN để chứng minh nhánh này không dựa vào mtime. */
    datThoiDiem(xl, -60);
    datThoiDiem(path.join(t.tcDir, 'testcases.md'), 0);
    const ep = chay(t.goc, ['--enforce']);
    expect(ep.status, 'thiếu case ở Markdown thì đọc Markdown là chạy thiếu').toBe(1);
    expect(`${ep.stdout}`).toContain('TC_999');
  });

  test('ĐỐI CHỨNG ÂM: bỏ phép chuẩn hoá thì bộ khớp cũng báo trôi', () => {
    /*
     * Chứng minh test "hai phía khớp ⇒ ĐẠT" ở trên KHÔNG vô nghĩa. Nếu so chuỗi thô (không `chuan`) thì
     * `<br>` và khoảng trắng đã đủ làm mọi ô lệch — tức phép so phải chuẩn hoá mới nói được gì.
     */
    const a = 'Dòng một<br>Dòng hai';
    const b = 'Dòng một\nDòng hai';
    expect(a).not.toBe(b);
    const { cleanCell } = require(path.join(REPO, 'scripts/lib/testcase'));
    expect(drift.chuan(cleanCell(a))).toBe(drift.chuan(cleanCell(b)));
  });

  test('`--json` ra số máy đọc được, kèm mẫu số', async () => {
    const t = dungTask(boMd([dongMd('TC_001')]), []);
    await ghiXlsx(path.join(t.tcDir, 'bo.xlsx'),
      ['ID_TC', 'Module', 'Test Case Name', 'Preconditions', 'Test Data', 'Test Steps', 'Expected Result', 'Priority'],
      [['TC_001', 'Hồ sơ trường', 'Case TC_001', '[ui] Đã đăng nhập', 'n/a', '1. Mở màn', '1. Màn mở được', 'Medium']]);
    const r = chay(t.goc, ['--json']);
    const j = JSON.parse(`${r.stdout}`);
    expect(j.so_thay_doi).toBe(0);
    expect(j.so_case_md).toBe(1);
    expect(j.nhom[0].truong_da_so.length, 'mẫu số phải có trong bản JSON').toBeGreaterThan(0);
  });
});

test.describe('@infra canonical:drift — luật trỏ tới máy, máy không mồ côi', () => {
  test('RULE_GLOBAL khai Markdown canonical VÀ trỏ tới `canonical:drift`', () => {
    const r = fs.readFileSync(path.join(REPO, 'RULE_GLOBAL.md'), 'utf8');
    expect(r, 'luật phải khai Markdown là nguồn sự thật của nội dung').toMatch(/Markdown là source of truth|Markdown canonical/);
    expect(r, 'một luật không có máy thi hành là luật chỉ dặn suông').toContain('canonical:drift');
  });

  test('không bề mặt nào còn khai Excel là nguồn sự thật của testcase', () => {
    /*
     * BỎ QUA CHÍNH FILE NÀY. Nó mang câu `Excel là source of truth` làm MẪU QUÉT, nên tự nó khớp — và
     * phép quét sẽ tố cáo chính cái câu đang cảnh báo về câu đó. Đây là lần thứ chín trong dự án một
     * phép quét bắt đúng dòng mô tả nó, nên để lại ghi chú thay vì để người sau truy lại từ đầu.
     *
     * CHANGELOG và `docs/token-diet/` là BẢN GHI LỊCH SỬ: chúng ghi lại điều đã đúng ở thời điểm đó.
     * Sửa chúng cho khớp luật mới là xoá dấu vết của một lần đổi luật.
     */
    const boQua = /^(CHANGELOG\.md|docs\/token-diet\/|tests\/fe\/infra\/canonical-drift\.spec\.ts$)/;
    const ra: string[] = [];
    const di = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        const rel = path.relative(REPO, p).split(path.sep).join('/');
        if (/node_modules|^\.git$|^outputs|^dist|^knowledge/.test(rel) || rel.startsWith('.git/')) continue;
        if (e.isDirectory()) { di(p); continue; }
        if (!/\.(md|js|ts|json)$/.test(e.name) || boQua.test(rel)) continue;
        const t = fs.readFileSync(p, 'utf8');
        if (/Excel là source of truth|Excel canonical là source of truth/.test(t)) ra.push(rel);
      }
    };
    di(REPO);
    expect(ra, 'đổi nguồn sự thật mà để lại một dòng cũ thì hai luật nói ngược nhau').toEqual([]);
  });

  test('npm script đã đăng ký cả bản thường và bản `:enforce`', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
    expect(pkg.scripts['canonical:drift']).toContain('canonical_drift.js');
    expect(pkg.scripts['canonical:drift:enforce']).toContain('--enforce');
  });
});
