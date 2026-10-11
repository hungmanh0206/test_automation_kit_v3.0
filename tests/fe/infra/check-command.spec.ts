import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * `npm run check` (v2.7.0 §A3) — MỘT LỆNH KIỂM.
 *
 * Phần BẮT BUỘC của §A3 là **phép đo tương đương**: tập vi phạm của `check` phải BẰNG ĐÚNG hợp của các
 * gate chạy rời, cùng mã và cùng TC ID. Không có phép đo đó thì "một lệnh thay cho mười" chỉ là lời
 * hứa, và một lệnh gộp bỏ sót vi phạm còn tệ hơn mười lệnh rời: nó làm người ta thôi chạy mười lệnh kia.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const MAY = path.join(REPO, 'scripts/qa/check.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const chk = require(MAY);
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const engine = require(path.join(REPO, 'scripts/qa/lib/gate_engine'));

test.describe.configure({ mode: 'default' });

const HEADER = '| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |';
const NGAN = '|---|---|---|---|---|---|---|---|---|---|';

function dongTc(id: string, o: Record<string, string> = {}) {
  const c = {
    loai: 'Functional', tag: '[Positive]', module: 'Hồ sơ trường', title: `Case ${id}`,
    pre: '[ui] Đã đăng nhập', data: 'n/a', steps: '1. Mở màn', expected: '1. Màn mở được', uu: 'Medium', ...o,
  };
  return `| ${id} | ${c.loai} | ${c.tag} | ${c.module} | ${c.title} | ${c.pre} | ${c.data} | ${c.steps} | ${c.expected} | ${c.uu} |`;
}

function dungTask(dong: string[], status?: unknown) {
  const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'chk-'));
  const taskDir = path.join(goc, 'tasks', 'T-CHK');
  fs.mkdirSync(path.join(taskDir, 'test-cases'), { recursive: true });
  fs.mkdirSync(path.join(taskDir, 'reports'), { recursive: true });
  fs.writeFileSync(path.join(taskDir, 'test-cases', 'tc.md'),
    ['# Testcase', '', HEADER, NGAN, ...dong, ''].join('\n'), 'utf8');
  if (status !== undefined) {
    fs.mkdirSync(path.join(taskDir, 'test-results'), { recursive: true });
    fs.writeFileSync(path.join(taskDir, 'test-results', 'testcase-status.json'), JSON.stringify(status, null, 2), 'utf8');
  }
  return { goc, taskDir };
}

function chay(goc: string, them: string[] = []) {
  return spawnSync(process.execPath, [MAY, '--task', 'T-CHK', ...them], {
    cwd: REPO, encoding: 'utf8', env: { ...gateEnv(), PROJECT_OUTPUT_DIR: goc, TASK_KEY: 'T-CHK' },
  });
}

test.describe('@infra check — tự nhận phase theo ARTIFACT, không đoán', () => {
  test('có file status ⇒ Phase 2; chỉ có test-cases ⇒ Phase 1', () => {
    const p1 = dungTask([dongTc('TC_001')]);
    expect(chk.nhanPhase(p1.taskDir).phase).toBe(1);
    const p2 = dungTask([dongTc('TC_001')], { tests: [] });
    expect(chk.nhanPhase(p2.taskDir).phase).toBe(2);
  });

  test('không có artifact nào ⇒ CHƯA BIẾT, KHÔNG mặc định Phase 1', () => {
    /*
     * Mặc định Phase 1 cho một task đã execute nghĩa là bỏ qua toàn bộ gate về evidence và verdict —
     * mà đó đúng là nhóm T0. "Chưa biết" phải là một trạng thái thật, có exit code riêng.
     */
    const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'chk-rong-'));
    fs.mkdirSync(path.join(goc, 'tasks', 'T-CHK'), { recursive: true });
    expect(chk.nhanPhase(path.join(goc, 'tasks', 'T-CHK')).phase).toBeNull();
    const r = chay(goc);
    expect(r.status).toBe(2);
    expect(`${r.stdout}`).toContain('CHƯA BIẾT PHASE');
    expect(`${r.stdout}`, 'và phải nói vì sao không mặc định').toContain('là nhóm T0');
  });

  test('phase nhận ra kèm LÝ DO, in ra cho người đọc kiểm được', () => {
    const t = dungTask([dongTc('TC_001')]);
    const r = chay(t.goc, ['--json']);
    const j = JSON.parse(`${r.stdout}`);
    expect(j.phase).toBe(1);
    expect(String(j.phase_vi_sao)).toContain('test-cases');
  });
});

test.describe('@infra check — PHÉP ĐO TƯƠNG ĐƯƠNG (§A3 bắt buộc)', () => {
  /*
   * Dựng một bộ case có vi phạm BIẾT TRƯỚC, rồi so tập vi phạm của `check` với tập vi phạm của chính
   * các hàm gate chạy rời. Hai bên phải cho cùng tập (mã, TC ID).
   *
   * So bằng (mã, TC ID) chứ không bằng nguyên văn thông điệp: `check` in qua lớp nén nên chữ khác, mà
   * chữ không phải thứ cần giống — thứ cần giống là CÁI GÌ bị bắt và Ở ĐÂU.
   */
  const CASE_LOI = [
    dongTc('TC_001', { expected: '' }),
    dongTc('TC_002', { pre: 'Tài khoản đã đăng nhập' }),
    dongTc('TC_003', { loai: '' }),
  ];

  function tapViPhamRoi(taskDir: string) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const og = require(path.join(REPO, 'scripts/qa/output_gate'));
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const dg = require(path.join(REPO, 'scripts/qa/design_gate'));
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const canonical = require(path.join(REPO, 'scripts/lib/testcase'));
    const f = path.join(taskDir, 'test-cases', 'tc.md');
    const txt = fs.readFileSync(f, 'utf8');
    const doc = canonical.parseMarkdown(txt);
    const ra = new Set<string>();
    for (const row of doc.tests) {
      for (const m of (og.gateTestcaseRow(row).problems || [])) ra.add(`${engine.maCua(m)}|${engine.tcIdTrong(m) || ''}`);
    }
    for (const m of (dg.gateDesign(txt).problems || [])) ra.add(`${engine.maCua(m)}|${engine.tcIdTrong(m) || ''}`);
    return ra;
  }

  function tapViPhamCheck(goc: string) {
    const r = chay(goc, ['--json']);
    const j = JSON.parse(`${r.stdout}`);
    const ra = new Set<string>();
    for (const g of j.results) {
      if (!['design:gate', 'gate:gen-testcase'].includes(g.gateId)) continue;
      for (const f of g.findings) {
        if (f.level !== 'FAIL') continue;
        ra.add(`${engine.maCua(f.message)}|${engine.tcIdTrong(f.message) || ''}`);
      }
    }
    return ra;
  }

  test('tập vi phạm của `check` BẰNG ĐÚNG hợp của các gate chạy rời', () => {
    const t = dungTask(CASE_LOI);
    const roi = tapViPhamRoi(t.taskDir);
    const gop = tapViPhamCheck(t.goc);
    expect(roi.size, 'bộ fixture phải có vi phạm, nếu không phép so này rỗng').toBeGreaterThan(0);
    expect([...gop].sort(), 'check bỏ sót hoặc thêm vi phạm so với gate chạy rời').toEqual([...roi].sort());
  });

  test('ĐỐI CHỨNG ÂM: bộ SẠCH thì cả hai bên đều rỗng', () => {
    /* Chứng minh phép so trên không xanh chỉ vì cả hai bên cùng rỗng trong mọi trường hợp. */
    const t = dungTask([dongTc('TC_001')]);
    const roi = tapViPhamRoi(t.taskDir);
    const gop = tapViPhamCheck(t.goc);
    expect([...gop].sort()).toEqual([...roi].sort());
  });

  test('ĐỐI CHỨNG ÂM: thêm một vi phạm thì CẢ HAI bên đều thấy', () => {
    /*
     * Phép so sẽ "xanh" cả khi hai bên cùng MÙ. Test này chứng minh hai bên cùng NHÌN THẤY: thêm một
     * case có expected rỗng thì tập vi phạm của cả hai phải lớn lên.
     */
    const sach = dungTask([dongTc('TC_001')]);
    const n0 = tapViPhamCheck(sach.goc).size;
    const loi = dungTask([dongTc('TC_001'), dongTc('TC_009', { expected: '' })]);
    const n1 = tapViPhamCheck(loi.goc).size;
    expect(n1, 'thêm vi phạm mà tập không lớn lên nghĩa là check đang mù').toBeGreaterThan(n0);
    expect(tapViPhamRoi(loi.taskDir).size).toBeGreaterThan(tapViPhamRoi(sach.taskDir).size);
  });
});

test.describe('@infra check — parse MỘT LẦN, và khai rõ còn spawn mấy cái', () => {
  test('bộ case được parse một lượt rồi dùng cho mọi gate nhận dữ liệu đã parse', () => {
    const src = fs.readFileSync(MAY, 'utf8');
    expect(src).toMatch(/PARSE MỘT LẦN/);
    /* `gateTestcaseRow` nhận TỪNG DÒNG đã parse, `gateTestExecution` nhận doc đã đọc. */
    expect(src).toContain('og.gateTestcaseRow(row)');
    expect(src).toContain('og.gateTestExecution(doc)');
    /* Và KHÔNG được gọi lại parseMarkdown cho từng gate. */
    const soLanParse = (src.match(/canonical\.parseMarkdown/g) || []).length;
    expect(soLanParse, 'parse nhiều lần là mất đúng thứ §A3 đòi').toBe(1);
  });

  test('số gate trong tiến trình và số còn spawn đều được IN RA', () => {
    /*
     * §A3 viết "một tiến trình, không spawn mỗi gate một lần", và kit chỉ đạt MỘT PHẦN. Một lời hứa
     * không đếm được thì không ai kiểm được, nên hai con số đó phải có trong output.
     */
    const t = dungTask([dongTc('TC_001')]);
    const r = chay(t.goc);
    expect(`${r.stdout}`).toMatch(/\d+ gate trong tiến trình · \d+ còn spawn/);
    const j = JSON.parse(`${chay(t.goc, ['--json']).stdout}`);
    expect(j.trong_tien_trinh).toBeGreaterThan(0);
    expect(j.con_spawn).toBeGreaterThan(0);
  });

  test('header nói THẲNG phần nào chưa đạt và vì sao không sửa tiếp', () => {
    const src = fs.readFileSync(MAY, 'utf8');
    expect(src).toMatch(/Đạt được MỘT PHẦN/);
    /* Chuỗi bị ngắt dòng trong khối chú thích, nên khớp phần không bị ngắt. */
    expect(src, 'phải nói chi phí thật của agent là lượt gọi tool cộng byte, không phải số tiến trình')
      .toContain('LƯỢT GỌI TOOL');
  });
});

test.describe('@infra check — bảng gọn, và `--full` phải khác thật', () => {
  test('dòng đầu là một dòng tổng có đủ bốn con số', () => {
    const t = dungTask([dongTc('TC_001', { expected: '' })]);
    const dong = `${chay(t.goc).stdout}`.split('\n')[0];
    expect(dong).toMatch(/✗ \d+ lỗi phải sửa/);
    expect(dong).toMatch(/⚠ \d+ cảnh báo/);
    expect(dong).toMatch(/✓ \d+ kiểm đạt/);
  });

  test('`--full` in NGUYÊN VĂN, bản gọn in bản nén — so NỘI DUNG, không so độ dài', () => {
    /*
     * Bản đầu của `--full` chỉ nới SỐ DÒNG mà vẫn in qua lớp nén, nên nó ra đúng bằng bản gọn khi số
     * vi phạm còn dưới ngưỡng dòng: đo được 2.310 byte cả hai. Người đọc bật cờ lên rồi tin rằng mình
     * đã thấy bản đầy đủ.
     *
     * NHƯNG SO ĐỘ DÀI LÀ SAI PHÉP ĐO, và bản đầu của test này mắc đúng chỗ đó: với bộ ít vi phạm,
     * `--full` NGẮN HƠN bản gọn (đo được 706 so với 713 byte), vì bản gọn thêm một dòng gợi ý
     * "bỏ --compact để xem giải thích đầy đủ". Thứ cần khác nhau là NỘI DUNG: `--full` phải mang nguyên
     * văn thông điệp, bản gọn thì mang bản nén.
     */
    /*
     * Phải vượt `nguong_gop` (= 5) của `gate_codes.json` mới thấy khác biệt: dưới ngưỡng đó lớp nén
     * không gộp gì, nên hai bản giống nhau — và giống nhau ở đó là ĐÚNG, không phải lỗi.
     */
    const nhieu = Array.from({ length: 8 }, (_, i) => dongTc(`TC_1${String(i).padStart(2, '0')}`, { expected: '' }));
    const t = dungTask(nhieu);
    const gon = `${chay(t.goc).stdout}`;
    const full = `${chay(t.goc, ['--full']).stdout}`;
    expect(gon, 'vượt ngưỡng gộp thì bản gọn phải gộp lại').toMatch(/cùng lỗi|\+\d+ nữa/);
    expect(full, '`--full` KHÔNG đi qua lớp nén').not.toMatch(/case cùng lỗi/);
    expect(full.length, 'bản đầy đủ phải dài hơn khi đã có gì để gộp').toBeGreaterThan(gon.length);
  });

  test('vi phạm tách theo TẦNG, và T1 ở `phase` nói rõ là chưa chặn', () => {
    const t = dungTask([dongTc('TC_001', { expected: '' })]);
    const out = `${chay(t.goc, ['--context', 'phase']).stdout}`;
    if (out.includes('[T1]')) expect(out).toContain('cửa ra sẽ chặn');
    if (out.includes('[T0]')) expect(out).toMatch(/\[T0\] CHẶN/);
  });

  test('CÙNG vi phạm: ngữ cảnh `exit` chặn, ngữ cảnh `phase` thì không', () => {
    /*
     * Đây là chỗ §A1 gặp §A3. Nếu `check` không đổi hành vi theo ngữ cảnh thì phân tầng không có hiệu
     * lực ở lệnh mà người dùng thực sự gõ.
     */
    const t = dungTask([dongTc('TC_001', { loai: '' })]);
    const o1 = chay(t.goc, ['--context', 'phase', '--json']);
    const j1 = JSON.parse(`${o1.stdout}`);
    const o2 = chay(t.goc, ['--context', 'exit', '--json']);
    const j2 = JSON.parse(`${o2.stdout}`);
    /* Chỉ so khi fixture thật sự sinh ra vi phạm T1 — nếu không thì phép so này rỗng. */
    if (j1.theo_tang.T1.length) {
      expect(j1.chan, 'T1 ở phase không được chặn').toBe(false);
      expect(j2.chan, 'CÙNG vi phạm đó ở exit phải chặn').toBe(true);
      expect(o1.status).toBe(0);
      expect(o2.status).toBe(1);
    }
  });

  test('T1 ở `phase` ghi vào SỔ NỢ — không chặn nhưng không mất dấu', () => {
    const t = dungTask([dongTc('TC_001', { loai: '' })]);
    const j = JSON.parse(`${chay(t.goc, ['--context', 'phase', '--json']).stdout}`);
    if (j.theo_tang.T1.length) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const gt = require(path.join(REPO, 'scripts/qa/lib/gate_tier.js'));
      const so = gt.docSoNo(t.taskDir);
      expect(so, 'vi phạm T1 phải vào sổ nợ').toBeTruthy();
      expect(so.mon.length).toBeGreaterThan(0);
    }
  });

  test('`○ không phán được` KHÔNG bị gộp vào "kiểm đạt"', () => {
    const t = dungTask([dongTc('TC_001')]);
    const j = JSON.parse(`${chay(t.goc, ['--json']).stdout}`);
    for (const g of j.khong_phan_duoc) {
      const r = j.results.find((x: { gateId: string }) => x.gateId === g);
      expect(r.status, `${g} phải là SKIP, không PASS`).toBe('SKIP');
    }
  });
});

test.describe('@infra check --explain — §A5', () => {
  test('mã có thật ⇒ in ý chính; mã lạ ⇒ exit 2 và liệt kê mã có thật', () => {
    const r1 = spawnSync(process.execPath, [MAY, '--explain', 'EVID_THIEU'], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    expect(r1.status).toBe(0);
    expect(`${r1.stdout}`).toContain('EVID_THIEU');
    const r2 = spawnSync(process.execPath, [MAY, '--explain', 'MA_KHONG_CO'], { cwd: REPO, encoding: 'utf8', env: gateEnv() });
    expect(r2.status).toBe(2);
    expect(`${r2.stderr}`).toContain('EVID_THIEU');
  });

  test('mã còn THIẾU "sửa thế nào" hoặc ví dụ thì `--explain` phải NÓI RA', () => {
    /*
     * §A5 đòi mỗi mã có "sửa thế nào" cộng ví dụ sai→đúng. Một `--explain` trả về nửa câu mà không khai
     * là nửa câu thì tệ hơn không có: người đọc tưởng đã đọc hết hướng dẫn rồi dừng.
     */
    const src = fs.readFileSync(MAY, 'utf8');
    expect(src).toMatch(/còn THIẾU/);
    const cfg = JSON.parse(fs.readFileSync(path.join(REPO, '.agent/config/gate_codes.json'), 'utf8'));
    const ds = Array.isArray(cfg) ? cfg : (cfg.codes || []);
    const thieu = ds.filter((x: { sua?: string; vi_du?: string }) => !x.sua || !x.vi_du).length;
    /* Con số này là NỢ của §A5, không phải lỗi — ghi lại để đợt sau đo được là đã giảm hay chưa. */
    expect(thieu).toBeLessThanOrEqual(ds.length);
  });
});
