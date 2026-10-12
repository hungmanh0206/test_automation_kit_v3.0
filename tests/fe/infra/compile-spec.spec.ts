/*
 * §D — BIÊN DỊCH TESTCASE THÀNH SPEC. Chạy hoàn toàn OFFLINE: không mở browser, không chạm UAT.
 *
 * Spec này tự biên dịch fixture vào một thư mục tạm rồi kiểm kết quả, thay vì đọc một thư mục đã biên
 * dịch sẵn. Lý do không phải sự gọn gàng: `outputs/*` bị `.gitignore`, nên một bản biên dịch sẵn sẽ
 * KHÔNG có trên máy người khác và mọi test đọc nó sẽ xanh vì tập rỗng.
 *
 * Thư mục tạm phải nằm TRONG repo, không nằm ở `os.tmpdir()`: trên máy này tmpdir ở ổ C: còn repo ở ổ D:,
 * và `path.relative` giữa hai ổ trả về đường tuyệt đối ⇒ import sinh ra vỡ. Chính `compile:spec` giờ ném
 * lỗi ở trường hợp đó, nên test chạy ở tmpdir sẽ đỏ với lý do lạc hướng.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { thuMucTam } from './_thu_muc_tam';

const REPO = path.resolve(__dirname, '..', '..', '..');
/* eslint-disable @typescript-eslint/no-var-requires, global-require */
const cs = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'compile_spec.js'));
const cc = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'compile_check.js'));
/* eslint-enable @typescript-eslint/no-var-requires, global-require */

const FIXTURE = path.join(REPO, 'tests', 'fe', 'fixtures', 'steps', 'testcase-chuan-phrasing.md');

let OUT: string;
let ketQua: Record<string, any>;

test.beforeAll(() => {
  OUT = thuMucTam('compile-test');
  ketQua = cs.bienDich({ taskKey: 'FIXTURE', duongMd: FIXTURE, outDir: OUT });
});
test.afterAll(() => { fs.rmSync(OUT, { recursive: true, force: true }); });

const docHet = () => fs.readdirSync(OUT).filter((f) => f.endsWith('.spec.ts'))
  .map((f) => ({ ten: f, src: fs.readFileSync(path.join(OUT, f), 'utf8') }));

/*
 * Tìm file theo NỘI DUNG, không ghim tên file. Tên file sinh ra theo đoạn đầu của `Module`, và nó đã đổi
 * một lần trong lúc dựng §D (gom theo module đầy đủ → gom theo đoạn đầu) làm sáu test đỏ cùng lúc. Ghim
 * tên file là ghim một chi tiết thi hành.
 */
const fileChua = (chuoi: string) => {
  const f = docHet().find((x) => x.src.includes(chuoi));
  expect(f, `không file nào chứa ${chuoi}`).toBeTruthy();
  return (f as { ten: string; src: string }).src;
};

test.describe('§D — bộ biên dịch sinh được file CHẠY ĐƯỢC', () => {
  test('sinh đủ file, mỗi module một file', () => {
    expect(ketQua.loi, `biên dịch hỏng: ${ketQua.loi}`).toBeUndefined();
    expect(ketQua.so_case).toBe(10);
    expect(docHet().length).toBe(ketQua.so_file);
  });

  test('gom theo ĐOẠN ĐẦU của Module, không theo module đầy đủ', () => {
    /*
     * Đo trên CSDL-9001: 213 case có 196 module đầy đủ khác nhau nhưng chỉ 5 đoạn đầu. Gom theo module
     * đầy đủ sinh ra 196 file cho 213 case — đúng kỹ thuật, và vô dụng.
     *
     * Dựng một MD canonical thật ở đây (6 case, 6 module đầy đủ khác nhau, CÙNG một đoạn đầu) rồi biên
     * dịch, vì đó là thứ duy nhất đo được phép gom. Khẳng định về chính dữ liệu test thì không đo gì.
     */
    const cot = '| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |';
    const hang = Array.from({ length: 6 }, (_, i) => `| T_${i} | UI | [Positive] | Cập nhật hồ sơ trường / tình huống ${i} | ca ${i} | [ui] x | — | 1. bấm nút "Ghi" | 1. Hiện thông báo "xong" | Medium |`);
    const d = thuMucTam('gom');
    const md = path.join(d, 'x.md');
    fs.writeFileSync(md, `# gom\n\n${cot}\n|---|---|---|---|---|---|---|---|---|---|\n${hang.join('\n')}\n`, 'utf8');
    const r = cs.bienDich({ taskKey: 'GOM', duongMd: md, outDir: d });
    expect(r.so_case).toBe(6);
    expect(r.so_file, '6 module đầy đủ khác nhau nhưng chung một đoạn đầu ⇒ phải ra 1 file').toBe(1);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('tên file TRÙNG sau khi cắt 60 ký tự thì KHÔNG được ghi đè im lặng', () => {
    /*
     * Lỗi thật ở CSDL-9001: hai module `… ở cấp THCS` và `… ở cấp Mầm non` cắt còn 60 ký tự ra cùng một
     * slug, file thứ hai ghi đè file thứ nhất, và `compile:spec` báo 196 file trong khi trên đĩa có 195.
     * Cùng lớp lỗi với chuyện Excel mất 129 ô: con số báo ra và hiện thực lệch nhau mà không ai thấy.
     *
     * Máy canh nằm trong chính `bienDich`: nó so số file báo ra với số file trên đĩa và NÉM nếu lệch.
     */
    const tren = fs.readdirSync(OUT).filter((f) => f.endsWith('.spec.ts')).length;
    expect(tren).toBe(ketQua.so_file);
    expect(ketQua.trung_ten).toEqual([]);
  });

  test('sinh NỐT `playwright.task.config.js` — thiếu nó thì spec không chạy được', () => {
    /*
     * `playwright.config.js` ở gốc khai `testDir: './tests'` và không project nào trỏ tới `outputs/**`,
     * nên gọi thẳng spec ở thư mục biên dịch trả "No tests found". Sinh ra một thư mục spec không chạy
     * được là sinh ra một bản kê ước nguyện.
     */
    const f = path.join(OUT, 'playwright.task.config.js');
    expect(fs.existsSync(f)).toBe(true);
    const src = fs.readFileSync(f, 'utf8');
    expect(src).toContain('testDir: __dirname');
    /* Reporter phải được chuyển sang đường tuyệt đối, nếu không nó vỡ với MODULE_NOT_FOUND. */
    expect(src).toContain('path.resolve(REPO, r[0])');
  });

  test('đường import là TƯƠNG ĐỐI và trỏ tới file có thật', () => {
    for (const { ten, src } of docHet()) {
      for (const m of src.matchAll(/from '([^']+)'/g)) {
        const p = m[1];
        if (p === '@playwright/test') continue;
        expect(p.startsWith('.'), `${ten}: import không tương đối — ${p}`).toBe(true);
        expect(/^[A-Za-z]:/.test(p.replace(/^\.\//, '')), `${ten}: import dính ổ đĩa — ${p}`).toBe(false);
        const abs = path.resolve(OUT, p);
        const co = fs.existsSync(`${abs}.ts`) || fs.existsSync(`${abs}.js`) || fs.existsSync(abs);
        expect(co, `${ten}: import trỏ tới file không tồn tại — ${p}`).toBe(true);
      }
    }
  });

  test('NÉM khi thư mục đích ở ổ đĩa khác, thay vì sinh import hỏng', () => {
    /*
     * Bản đầu không kiểm và sinh ra `from './D:/Project/.../radcombobox'`. File trông bình thường và chỉ
     * vỡ lúc Playwright nạp, với một thông báo lạc hướng về module không tìm thấy.
     */
    expect(() => cs.duongImport('C:\\khong-cung-o-dia', 'tests/fe/lib/_widget/radcombobox.ts'))
      .toThrow(/cùng ổ đĩa/);
  });
});

test.describe('§D — case chưa đủ KHÔNG ĐƯỢC PASS', () => {
  test('mọi case còn TODO đều là `test.skip`', () => {
    for (const { ten, src } of docHet()) {
      const { ds } = cc.tachCase(src);
      for (const c of ds) {
        if (cc.RE_TODO.test(c.than)) {
          expect(c.co_skip, `${ten} dòng ${c.dong}: còn TODO mà không phải test.skip`).toBe(true);
        }
      }
    }
  });

  test('không case nào khai `finish(\'PASS\')` khi còn TODO', () => {
    for (const { ten, src } of docHet()) {
      const { ds } = cc.tachCase(src);
      for (const c of ds) {
        if (!cc.RE_TODO.test(c.than)) continue;
        expect(/finish\(\s*['"]PASS['"]/.test(c.than), `${ten} dòng ${c.dong}`).toBe(false);
      }
    }
  });

  test('bản vừa sinh phải qua `compile:check` sạch (đối chứng DƯƠNG)', () => {
    const d = cc.kiem(OUT);
    expect(d.so_file).toBeGreaterThan(0);
    expect(d.chan, JSON.stringify(d.chan, null, 2)).toHaveLength(0);
  });
});

test.describe('§D — bộ biên dịch KHÔNG bịa giá trị kỳ vọng', () => {
  test('dòng kỳ vọng không có giá trị bọc nháy ⇒ TODO-ORACLE', () => {
    expect(cs.rutKyVong('Màn hiển thị đúng dữ liệu của đơn vị')).toBeNull();
    expect(cs.rutKyVong('Hệ thống xử lý bình thường')).toBeNull();
  });

  test('có giá trị bọc nháy NHƯNG không rõ kiểm gì ⇒ vẫn TODO-ORACLE', () => {
    /*
     * Có giá trị KHÔNG có nghĩa là biết phải kiểm cái gì với nó. Đây là chỗ một bộ biên dịch dễ trượt
     * nhất: thấy một chuỗi trong nháy rồi sinh đại một `expect`, và bộ kiểm sinh ra so app với app.
     */
    expect(cs.rutKyVong('Tham chiếu tài liệu "QEMIS - THCS.md" ở dòng 302')).toBeNull();
  });

  test('nhận dòng thông báo có giá trị bọc nháy', () => {
    const r = cs.rutKyVong('Hiển thị thông báo "Tên trường là bắt buộc"');
    expect(r).not.toBeNull();
    expect(r.kiem).toBe('expectToast');
    expect(r.gia_tri).toBe('Tên trường là bắt buộc');
  });

  test('ô kỳ vọng RỖNG ⇒ TODO-ORACLE, không phải bỏ qua im lặng', () => {
    const tc = { tcId: 'X', module: 'M', title: 't', precondition: '[ui] x', steps: [], expected: [], expectedRaw: '' };
    const r = cs.sinhThanCase(tc, { buoc: [] }, { nhom: [], ngat: [','] }, OUT);
    expect(r.chuaDu.some((x: string) => x.includes('ô kỳ vọng rỗng'))).toBe(true);
  });
});

test.describe('§D — tiền điều kiện', () => {
  test('tách tag `[<method>]` đúng danh sách hợp lệ', () => {
    const r = cs.tachTienDieuKien('[ui] Đã đăng nhập<br>[pre_existing] Có sẵn 1 trường THCS');
    expect(r).toEqual([
      { method: 'ui', noi_dung: 'Đã đăng nhập' },
      { method: 'pre_existing', noi_dung: 'Có sẵn 1 trường THCS' },
    ]);
  });

  test('tag LẠ không được nhận là method', () => {
    const r = cs.tachTienDieuKien('[db] SELECT TOP 1 FROM TRUONG');
    expect(r[0].method).toBeNull();
  });

  test('`pre_existing` và `manual` KHÔNG sinh TODO — chúng không dựng bằng máy được', () => {
    const tc = {
      tcId: 'X', module: 'M', title: 't',
      precondition: '[pre_existing] Có sẵn dữ liệu',
      steps: [], expected: [{ n: 1, text: 'Hiển thị thông báo "xong"' }],
    };
    const r = cs.sinhThanCase(tc, { buoc: [] }, { nhom: [], ngat: [','] }, OUT);
    expect(r.chuaDu.some((x: string) => x.includes('TODO-SETUP'))).toBe(false);
  });

  test('tag có method NHƯNG chưa nối được tới factory ⇒ TODO-SETUP, không sinh lời gọi đoán ra', () => {
    /*
     * Dựng state sai mà case vẫn chạy thì cái FAIL sinh ra bị gán sai tầng lỗi, và người ta đi tìm bug
     * sản phẩm cho một setup hỏng.
     */
    const tc = { tcId: 'X', module: 'M', title: 't', precondition: '[factory] Tạo lớp QA10A1', steps: [], expected: [] };
    const r = cs.sinhThanCase(tc, { buoc: [] }, { nhom: [], ngat: [','] }, OUT);
    expect(r.chuaDu.some((x: string) => x.includes('TODO-SETUP [factory]'))).toBe(true);
  });
});

test.describe('§D — dấu đầu spec ghi PHIÊN BẢN bước', () => {
  test('case khớp bước nào thì ghi `id@version` của bước đó', () => {
    expect(fileChua('FIX_STEPS_TC_002')).toContain('widget.combobox.chon-gia-tri@1.0.0');
  });

  test('bước `draft` được nêu ra ngay trong case', () => {
    expect(fileChua('FIX_STEPS_TC_002')).toContain('BUOC-DRAFT');
  });

  test('chuỗi trong mã sinh ra được escape bằng JSON.stringify, không ghép tay', () => {
    /* Một tên case chứa dấu nháy mà ghép tay thì file sinh ra không biên dịch nổi. */
    const tc = {
      tcId: 'X_"1"', module: 'M', title: 'tên có "nháy" và \\ gạch', precondition: '', steps: [], expected: [],
    };
    const r = cs.sinhFile({ taskKey: 'T', nhanFile: 'M', cases: [tc], danhMuc: { buoc: [] }, nguPhap: { nhom: [], ngat: [','] }, specDir: OUT });
    expect(r.noiDung).toContain('X_\\"1\\"');
    expect(() => new Function(`const x = ${JSON.stringify(tc.title)};`)).not.toThrow();
  });
});

test.describe('§D — compile:check: đối chứng ÂM', () => {
  const chay = (ten: string, pha: (s: string) => string) => {
    const d = thuMucTam(`cc-${ten}`);
    const nguon = fileChua('FIX_STEPS_TC_002');
    fs.writeFileSync(path.join(d, 'x.spec.ts'), pha(nguon), 'utf8');
    const kq = cc.kiem(d);
    fs.rmSync(d, { recursive: true, force: true });
    return kq;
  };

  test('luật 1 — bỏ `.skip` mà còn TODO', () => {
    const kq = chay('l1', (s) => s.replace('test.skip(', 'test('));
    expect(kq.chan.some((x: { luat: number }) => x.luat === 1)).toBe(true);
  });

  test('luật 2 — bỏ `.skip` và XOÁ TODO mà việc chưa làm', () => {
    const kq = chay('l2', (s) => s.replace('test.skip(', 'test(')
      .split('\n').filter((l) => !cc.RE_TODO.test(l) || /\*\s+-\s/.test(l)).join('\n'));
    expect(kq.chan.some((x: { luat: number }) => x.luat === 2)).toBe(true);
  });

  test('luật 3 — khai `finish(\'PASS\')` khi còn TODO', () => {
    const kq = chay('l3', (s) => s.replace("finish('SKIP')", "finish('PASS')"));
    expect(kq.chan.some((x: { luat: number }) => x.luat === 3)).toBe(true);
  });

  test('luật 4 — `test.skip` mà không còn TODO nào (cảnh báo)', () => {
    const kq = chay('l4', (s) => s.split('\n').filter((l) => !cc.RE_TODO.test(l) && !l.includes(cs.DAU_CHUA_DU)).join('\n'));
    expect(kq.canh_bao.some((x: { luat: number }) => x.luat === 4)).toBe(true);
  });

  test('file KHÔNG mang dấu sinh tự động thì không bị quét', () => {
    const d = thuMucTam('cc-tay');
    fs.writeFileSync(path.join(d, 'tay.spec.ts'), 'test("x", async () => { /* TODO-ORACLE */ });', 'utf8');
    const kq = cc.kiem(d);
    fs.rmSync(d, { recursive: true, force: true });
    expect(kq.so_file).toBe(0);
  });

  test('quét 0 file là PHÉP ĐO HỎNG, không phải "sạch"', () => {
    const d = thuMucTam('cc-rong');
    const kq = cc.kiem(d);
    fs.rmSync(d, { recursive: true, force: true });
    expect(kq.so_file).toBe(0);
    expect(kq.chan).toHaveLength(0);
    /* `main()` biến đúng tình huống này thành exit 2 — xem `compile_check.js`. */
  });
});
