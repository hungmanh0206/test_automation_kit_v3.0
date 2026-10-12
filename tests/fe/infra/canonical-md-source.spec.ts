import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * MD LÀ NGUỒN SỰ THẬT, EXCEL VÀ SHEET LÀ BẢN PHÁI SINH (v2.8.0 §0c).
 *
 * `CLAUDE.md` §6 đã nói "MD canonical" từ đợt trước, nhưng đo 12/10/2026 thì tài liệu MÂU THUẪN với chính
 * non-negotiable đó: 9 file lớp kit vẫn gọi Excel là canonical, và 6 prompt + 2 skill vẫn dặn "tải bản
 * Sheet mới nhất" trước mỗi lượt execute.
 *
 * Bộ test này khoá bốn thứ:
 *   1. một bộ ghi, toả ba nơi, ĐÚNG THỨ TỰ MD → Excel → Sheet;
 *   2. một bước toả thất bại KHÔNG được im lặng;
 *   3. kết quả chạy ghi vào KHỐI RIÊNG, không giẫm lên nội dung;
 *   4. gate CHẶN khi lệch NỘI DUNG, chỉ CẢNH BÁO khi lệch phần kết quả.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const SYNC = path.join(REPO, 'scripts/qa/testcases/sync_canonical.js');
const CHECK = path.join(REPO, 'scripts/qa/canonical_check.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const sc = require(SYNC);

const HEADER = '| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên | Mức độ rủi ro |';
const NGAN = '|---|---|---|---|---|---|---|---|---|---|---|';

function dungTask(soCase = 2) {
  const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'canon-'));
  const taskDir = path.join(goc, 'tasks', 'T-CANON');
  const tcDir = path.join(taskDir, 'test-cases');
  fs.mkdirSync(tcDir, { recursive: true });
  const dong = [];
  for (let i = 1; i <= soCase; i += 1) {
    dong.push(`| CANON_TC_${String(i).padStart(3, '0')} | Functional | [Positive] | Hồ sơ trường | Case ${i} | [ui] Đã đăng nhập | n/a | 1. Mở màn | 1. Màn hiện 4 tab | Medium | Medium |`);
  }
  fs.writeFileSync(path.join(tcDir, 'tc.md'), ['# Testcase', '', HEADER, NGAN, ...dong, ''].join('\n'), 'utf8');
  return { goc, taskDir, tcDir, md: path.join(tcDir, 'tc.md'), xlsx: path.join(tcDir, 'tc.xlsx') };
}

const chay = (may: string, args: string[], goc: string) => spawnSync(process.execPath, [may, ...args], {
  cwd: REPO, encoding: 'utf8', env: gateEnv({ PROJECT_OUTPUT_DIR: goc, TASK_KEY: 'T-CANON' }),
});

test.describe.configure({ mode: 'default' });
test.setTimeout(3 * 60 * 1000);

test.describe('@infra sync:canonical — một bộ ghi, toả ba nơi theo THỨ TỰ', () => {
  test('MD → Excel: Excel được sinh LẠI từ MD', () => {
    const t = dungTask();
    const r = chay(SYNC, [], t.goc);
    expect(`${r.stdout}${r.stderr}`).toMatch(/MD ✓ 2 case/);
    expect(fs.existsSync(t.xlsx), 'Excel phải được sinh ra').toBe(true);
  });

  test('0 file MD ⇒ CHƯA ĐƯỢC GÁC (exit 2), không phải "không có việc"', () => {
    const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'canon-rong-'));
    fs.mkdirSync(path.join(goc, 'tasks', 'T-CANON', 'test-cases'), { recursive: true });
    const r = chay(SYNC, [], goc);
    expect(r.status).toBe(2);
    expect(`${r.stdout}${r.stderr}`).toMatch(/MD là NGUỒN/);
  });

  test('MD không parse được ⇒ DỪNG, KHÔNG toả tiếp', () => {
    /*
     * Thứ tự là bắt buộc, không phải cho gọn: toả tiếp từ một nguồn hỏng thì ba nơi mang ba nội dung khác
     * nhau, và không ai biết nơi nào đúng.
     */
    const t = dungTask();
    fs.writeFileSync(t.md, '# Không có bảng nào ở đây\n', 'utf8');
    const r = chay(SYNC, [], t.goc);
    expect(r.status).toBe(2);
    expect(fs.existsSync(t.xlsx), 'nguồn hỏng mà vẫn sinh Excel thì thứ tự vô nghĩa').toBe(false);
  });

  test('Sheet CHƯA đồng bộ ⇒ ghi `sheet_stale: true` và NÓI RA, không im lặng', () => {
    /*
     * Một lần toả nửa vời mà im lặng tạo ra đúng tình huống tệ nhất: người đọc Sheet tin mình đang đọc
     * bản mới nhất.
     */
    const t = dungTask();
    const r = chay(SYNC, [], t.goc);
    expect(r.status, 'Sheet chưa đồng bộ thì exit khác 0').toBe(1);
    expect(`${r.stdout}${r.stderr}`).toMatch(/CHƯA ĐỒNG BỘ/);

    const st = JSON.parse(fs.readFileSync(path.join(t.tcDir, sc.TEN_STATE), 'utf8'));
    expect(st.sheet_stale).toBe(true);
    expect(st.sheet.trang_thai).toBe('chua_xac_nhan');
  });

  test('BA kết cục Sheet được phân biệt, không gộp thành một', () => {
    /*
     * "Chưa cấu hình" KHÔNG phải lỗi, và cũng KHÔNG phải "đã đồng bộ". Gộp ba kết cục lại thì một môi
     * trường chưa nối Sheet sẽ đọc thành một môi trường đã đồng bộ.
     */
    const src = fs.readFileSync(SYNC, 'utf8');
    for (const tt of ['chua_xac_nhan', 'chua_cau_hinh', 'can_chay_tay']) {
      expect(src, `thiếu kết cục "${tt}"`).toContain(tt);
    }
    expect(sc.buocSheet([]).trang_thai, 'không có cờ --cham-sheet ⇒ chua_xac_nhan').toBe('chua_xac_nhan');
  });

  test('chạm Sheet đòi cờ tường minh `--cham-sheet`', () => {
    /* Sheet là bề mặt dùng chung của cả team — cùng tinh thần với luật xác nhận trước khi chạm UAT. */
    const src = fs.readFileSync(SYNC, 'utf8');
    expect(src).toContain('--cham-sheet');
    expect(src).toMatch(/bề mặt dùng chung/);
  });
});

test.describe('@infra sync:canonical --results — kết quả ghi KHỐI RIÊNG', () => {
  function ghiStatus(taskDir: string, ds: unknown[]) {
    const d = path.join(taskDir, 'test-results');
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'testcase-status.json'), JSON.stringify(ds, null, 2), 'utf8');
  }

  test('verdict vào MD trong khối riêng; phần NỘI DUNG không bị đụng', () => {
    /*
     * Tách khối thì `git diff` nói được "đổi nội dung" hay "ghi kết quả". Gộp một chỗ thì mọi lượt chạy
     * trông như một lượt sửa case, và lúc đó không ai dám tin `canonical:check`.
     */
    const t = dungTask();
    const noiDungTruoc = fs.readFileSync(t.md, 'utf8');
    ghiStatus(t.taskDir, [
      { tcId: 'CANON_TC_001', status: 'PASSED', reruns: 0, evidence: ['a.png'] },
      { tcId: 'CANON_TC_002', status: 'FAILED', failureLayer: 'product_bug', reruns: 3, evidence: ['b.png'] },
    ]);

    const r = chay(SYNC, ['--results'], t.goc);
    expect(`${r.stdout}${r.stderr}`).toMatch(/kết quả: ghi khối riêng/);

    const sau = fs.readFileSync(t.md, 'utf8');
    expect(sau).toContain('KET-QUA:BAT-DAU');
    expect(sau).toContain('CANON_TC_002');
    expect(sau).toContain('product_bug');

    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const cc = require(CHECK);
    expect(cc.boKhoiKetQua(sau).than.trim(), 'khối nội dung bị đụng khi ghi kết quả')
      .toBe(noiDungTruoc.trim());
  });

  test('ghi kết quả HAI LẦN không nhân đôi khối', () => {
    const t = dungTask();
    ghiStatus(t.taskDir, [{ tcId: 'CANON_TC_001', status: 'PASSED', reruns: 0, evidence: [] }]);
    chay(SYNC, ['--results'], t.goc);
    chay(SYNC, ['--results'], t.goc);
    const s = fs.readFileSync(t.md, 'utf8');
    expect((s.match(/KET-QUA:BAT-DAU/g) || []).length, 'khối kết quả bị nhân đôi').toBe(1);
  });

  test('chưa có file status ⇒ nói rõ, không ghi khối rỗng', () => {
    const t = dungTask();
    const r = chay(SYNC, ['--results'], t.goc);
    expect(r.status).toBe(1);
    expect(`${r.stdout}${r.stderr}`).toMatch(/không toả được kết quả/);
    expect(fs.readFileSync(t.md, 'utf8')).not.toContain('KET-QUA:BAT-DAU');
  });

  test('file status RỖNG ⇒ nói rõ, không coi là "đã toả"', () => {
    const t = dungTask();
    ghiStatus(t.taskDir, []);
    const r = chay(SYNC, ['--results'], t.goc);
    expect(r.status).toBe(1);
    expect(`${r.stdout}${r.stderr}`).toMatch(/rỗng/);
  });
});

test.describe('@infra canonical:check — CHẶN lệch nội dung, CẢNH BÁO lệch kết quả', () => {
  test('MD và Excel khớp ⇒ ĐẠT', () => {
    const t = dungTask();
    chay(SYNC, [], t.goc);
    const r = chay(CHECK, [], t.goc);
    expect(r.status, `${r.stdout}${r.stderr}`).toBe(0);
    expect(`${r.stdout}`).toMatch(/khớp phần NỘI DUNG/);
  });

  test('ĐỐI CHỨNG: sửa NỘI DUNG thẳng trong Excel ⇒ CHẶN, và nhắc đúng cách chữa', async () => {
    /*
     * Đây là phép đo quyết định gate này có tác dụng gì. Không có nó thì "đã có gate chống lệch" chỉ là
     * một dòng trong tài liệu.
     *
     * Nhắc đúng cách chữa cũng quan trọng không kém: cách SAI là sync một chiều lên bản vừa sửa, vì làm
     * vậy là xoá đúng thay đổi của người ta.
     */
    const t = dungTask();
    chay(SYNC, [], t.goc);

    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(t.xlsx);
    let doi = 0;
    for (const ws of wb.worksheets) {
      ws.eachRow((row: { cellCount: number; getCell: (i: number) => { value: unknown } }, n: number) => {
        if (n < 2) return;
        for (let i = 1; i <= row.cellCount; i += 1) {
          const c = row.getCell(i);
          if (String(c.value || '').includes('Mở màn')) { c.value = 'SỬA THẲNG TRÊN EXCEL'; doi += 1; return; }
        }
      });
    }
    expect(doi, 'không tìm thấy ô để sửa — phép đối chứng mất neo').toBeGreaterThan(0);
    await wb.xlsx.writeFile(t.xlsx);

    const r = chay(CHECK, [], t.goc);
    expect(r.status, `sửa nội dung Excel mà gate vẫn xanh:\n${r.stdout}${r.stderr}`).toBe(1);
    const ra = `${r.stdout}${r.stderr}`;
    expect(ra).toMatch(/LỆCH NỘI DUNG/);
    expect(ra, 'phải nhắc nội dung chỉ sửa ở MD').toMatch(/CHỈ sửa ở MD/);
    expect(ra, 'phải cảnh báo đừng sync một chiều lên bản vừa sửa').toMatch(/xoá đúng thay đổi/);
  });

  test('chưa có `sync_state.json` ⇒ CẢNH BÁO "chưa kiểm", KHÔNG phải "đã đồng bộ"', () => {
    const t = dungTask();
    // Sinh Excel bằng tay, KHÔNG qua sync ⇒ không có sync_state.
    const r0 = spawnSync(process.execPath, [path.join(REPO, 'scripts/convert_excel/md_to_xlsx.js'), t.md, t.xlsx], {
      cwd: REPO, encoding: 'utf8', env: gateEnv(),
    });
    expect(r0.status, `${r0.stdout}${r0.stderr}`).toBe(0);

    const r = chay(CHECK, [], t.goc);
    expect(`${r.stdout}${r.stderr}`).toMatch(/chưa kiểm/);
  });

  test('cảnh báo về Sheet tự khai nó là LỜI KHAI, không phải phép đo', () => {
    /*
     * So Sheet trực tiếp cần credential, nên gate đọc `sync_state.json`. Nói nó là "đã kiểm Sheet" là tự
     * nhận một phép đo chưa xảy ra.
     */
    const t = dungTask();
    chay(SYNC, [], t.goc);
    const r = chay(CHECK, [], t.goc);
    expect(`${r.stdout}${r.stderr}`).toMatch(/lời khai, không phải phép đo/);
  });

  test('DÙNG LẠI `canonical_drift`, không dựng bộ so thứ hai', () => {
    const src = fs.readFileSync(CHECK, 'utf8');
    expect(src).toContain("require(path.join(__dirname, 'canonical_drift.js'))");
    expect(src, 'tự khai lại danh sách trường so được').not.toMatch(/const\s+TRUONG\s*=\s*\[/);
  });
});

test.describe('@infra tài liệu KHÔNG còn gọi Excel hay Sheet là canonical', () => {
  const BE_MAT = [
    'README.md', 'QUICKSTART.md', 'USER_GUIDE.md', 'RULE_GLOBAL.md', 'CLAUDE.md',
    '.agent/AUDIT_REFERENCES.md',
    '.agent/workflows/phase1_generate_tc.md',
    '.agent/workflows/phase1_04_auto_publish_backlog.md',
    '.agent/skills/shared/backlog_testcase_publisher/SKILL.md',
    'prompt_templates/phase1/04_auto_publish_backlog.md',
    'partial-rerun/run_testcase_cleanup.md',
  ];

  test('không bề mặt nào gọi Excel/Sheet là canonical hay source of truth', () => {
    /*
     * Đo 12/10/2026 TRƯỚC khi sửa: 9 file lớp kit gọi Excel là canonical, trong khi `CLAUDE.md` §6 đã nói
     * MD canonical. Tài liệu mâu thuẫn với non-negotiable của chính kit là chỗ người đọc sẽ tin tài liệu,
     * vì nó cụ thể hơn.
     */
    /*
     * BỘ DÒ PHẢI HẸP, và lượt đầu nó KHÔNG hẹp. Mẫu "Excel hoặc Sheet nằm gần chữ canonical" bắt 45 dòng,
     * nhưng hơn nửa là câu VỐN ĐÃ ĐÚNG: "đi từ **Markdown canonical** qua bản xuất Excel". Một test báo
     * oan quá nửa thì nó không nói được gì, và người đọc sẽ nới nó cho xong việc.
     *
     * Nên chỉ bắt câu KHẲNG ĐỊNH Excel/Sheet là nguồn. Đo lại bằng mẫu hẹp: 22 dòng thật trên 9 file.
     */
    const KHANG_DINH = [
      /Excel\s*\(?\s*[Ss]ource of truth/,
      /Excel\s+l[àa]\s+canonical/i,
      /Excel\s+l[àa]\s+(nguồn chính|nguồn sự thật)/i,
      /Excel\s+canonical\s+source/i,
      /Sheet\s+l[àa]\s+canonical/i,
      /canonical\s+tải\s+từ\s+Google\s+Sheet/i,
      /nguồn execute mặc định/i,
    ];
    const xau: string[] = [];
    for (const f of BE_MAT) {
      const p = path.join(REPO, f);
      if (!fs.existsSync(p)) continue;
      fs.readFileSync(p, 'utf8').split(/\r?\n/).forEach((l, i) => {
        if (KHANG_DINH.some((re) => re.test(l))) xau.push(`${f}:${i + 1} ${l.trim().slice(0, 100)}`);
      });
    }
    expect(xau, `bề mặt còn gọi Excel/Sheet là canonical:\n${xau.join('\n')}`).toEqual([]);
  });

  test('prompt execute KHÔNG còn dặn tải Sheet mỗi lượt', () => {
    /*
     * Cú tải Sheet mỗi lượt vừa tốn token vừa thêm một nguồn thứ ba. Execute đọc MD canonical local.
     */
    const PROMPT = [
      'prompt_templates/phase2/04_execute_fe_playwright.md',
      'prompt_templates/phase2/04L_execute_lite.md',
      'prompt_templates/phase2/05_execute_api_playwright.md',
      'prompt_templates/run_phase2_template.md',
      'prompt_templates/run_phase_re-run_template.md',
    ];
    const xau: string[] = [];
    for (const f of PROMPT) {
      const p = path.join(REPO, f);
      if (!fs.existsSync(p)) continue;
      const t = fs.readFileSync(p, 'utf8');
      for (const m of t.matchAll(/^.*(tải|download)[^\n]{0,60}(Sheet|Drive MCP)[^\n]*$/gim)) {
        /* Cho phép câu nói VỀ gate chống lệch — đó là chỗ duy nhất còn được dùng Drive MCP. */
        /*
         * Miễn cho câu nói VỀ gate chống lệch: `canonical:check` và `canonical:drift` được phép dùng
         * Drive MCP, vì chúng SO Sheet với MD chứ không lấy Sheet làm nguồn. Phân biệt này là ruột của
         * §0c — bỏ nó thì test sẽ đòi gỡ luôn gate chống lệch.
         */
        /*
         * Miễn hai nhóm, và nhóm thứ hai là bài học của chính lượt này:
         *
         *  · câu nói VỀ gate chống lệch — `canonical:check` và `canonical:drift` ĐƯỢC phép dùng Drive
         *    MCP, vì chúng SO Sheet với MD chứ không lấy Sheet làm nguồn. Phân biệt đó là ruột của §0c;
         *    bỏ nó thì test sẽ đòi gỡ luôn gate chống lệch.
         *  · câu PHỦ ĐỊNH — một dòng viết "KHÔNG tải Sheet" là trạng thái ĐÚNG, mà mẫu `tải.*Sheet` vẫn
         *    khớp. Lượt sửa đầu của tôi vá xong prompt thì test vẫn đỏ, và nó đỏ vì câu vừa sửa.
         *
         * Đây là lần thứ ba trong đợt này một bộ dò bằng chữ của tôi cần nới đúng chỗ: dò `pyodbc` trần
         * bắt cả tài liệu, dò chuỗi kết nối bắt cả lệnh `grep`, và giờ dò `tải Sheet` bắt cả câu phủ định.
         */
        if (/canonical:(check|drift)|chống lệch|gate/i.test(m[0])) continue;
        if (/KHÔNG\s+(tải|download)|không\s+còn\s+(tải|cú tải)|thay cho nguồn/i.test(m[0])) continue;
        xau.push(`${f}: ${m[0].trim().slice(0, 110)}`);
      }
    }
    expect(xau, `prompt còn dặn tải Sheet:\n${xau.join('\n')}`).toEqual([]);
  });
});
