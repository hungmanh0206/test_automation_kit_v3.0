import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

/*
 * `check --fix` (v2.7.0 §A4) — TỰ SỬA ĐỊNH DẠNG, KHÔNG ĐỔI NGHĨA.
 *
 * Một máy tự sửa testcase ở sai chỗ là một máy GIAN LẬN THAY CHO NGƯỜI: sửa `Kết quả mong đợi` cho khớp
 * cái app đang trả về thì mọi case đỏ thành xanh, và non-negotiable §6 bị phá bởi chính công cụ của kit.
 * Nên bộ test này nặng về phần CẤM, không về phần sửa được:
 *   · không luật nào khai một cột trong `CAM_CHAM` — kiểm ngay lúc nạp module;
 *   · luật duy nhất chạm `Kết quả mong đợi` chỉ sửa tiền tố số, và tự chứng minh phần chữ y nguyên;
 *   · ĐỐI CHỨNG ÂM: fixture có Expected mơ hồ thì `--fix` KHÔNG được đụng, và vẫn phải báo lỗi;
 *   · idempotent: chạy hai lần thì lần hai không đổi gì.
 */
const REPO = path.resolve(__dirname, '..', '..', '..');
const CHECK = path.join(REPO, 'scripts/qa/check.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const af = require(path.join(REPO, 'scripts/qa/autofix.js'));

test.describe.configure({ mode: 'default' });

const HEADER = '| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |';
const NGAN = '|---|---|---|---|---|---|---|---|---|---|';

function hang(o: Record<string, string> = {}) {
  const c = {
    id: 'TC_001', loai: 'Functional', tag: '[Positive]', module: 'Hồ sơ trường',
    title: 'Xem hồ sơ trường', pre: '[ui] Đã đăng nhập', data: 'n/a',
    steps: '1. Mở màn', expected: '1. Màn mở được', uu: 'Medium', ...o,
  };
  return `| ${c.id} | ${c.loai} | ${c.tag} | ${c.module} | ${c.title} | ${c.pre} | ${c.data} | ${c.steps} | ${c.expected} | ${c.uu} |`;
}

const bo = (dong: string[]) => ['# Testcase', '', 'Một đoạn văn xuôi phải được giữ nguyên.', '', HEADER, NGAN, ...dong, ''].join('\n');

function dungTask(md: string) {
  const goc = fs.mkdtempSync(path.join(os.tmpdir(), 'afix-'));
  const taskDir = path.join(goc, 'tasks', 'T-FIX');
  fs.mkdirSync(path.join(taskDir, 'test-cases'), { recursive: true });
  fs.mkdirSync(path.join(taskDir, 'reports'), { recursive: true });
  const f = path.join(taskDir, 'test-cases', 'tc.md');
  fs.writeFileSync(f, md, 'utf8');
  return { goc, taskDir, f };
}

function chayCheck(goc: string, them: string[]) {
  return spawnSync(process.execPath, [CHECK, '--task', 'T-FIX', ...them], {
    cwd: REPO, encoding: 'utf8', env: { ...gateEnv(), PROJECT_OUTPUT_DIR: goc, TASK_KEY: 'T-FIX' },
  });
}

test.describe('@infra autofix — hàng rào an toàn, kiểm NGAY lúc nạp', () => {
  test('không luật nào khai cột nằm trong `CAM_CHAM`', () => {
    for (const l of af.LUAT) {
      if (l.cot === '*') continue;
      expect(af.CAM_CHAM, `luật ${l.ma} khai cột bị cấm`).not.toContain(l.cot);
    }
  });

  test('`kiemLuat()` NÉM khi một luật khai cột bị cấm — không để nó chạy rồi mới biết', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts/qa/autofix.js'), 'utf8');
    expect(src).toMatch(/LUẬT SAI CHỖ/);
    expect(src, '`kiemLuat()` phải được gọi ngay khi nạp module').toMatch(/\nkiemLuat\(\);/);
  });

  test('luật `*` KHÔNG chạm cột bị cấm — "mọi cột" vẫn tôn trọng CAM_CHAM', () => {
    for (const c of af.CAM_CHAM) expect(af.duocCham(c), `${c} phải bị chặn`).toBe(false);
    for (const c of ['Ưu tiên', 'Tag', 'Module', 'Các bước thực hiện']) {
      expect(af.duocCham(c), `${c} phải được phép`).toBe(true);
    }
  });

  test('`Kết quả mong đợi` nằm trong CAM_CHAM — oracle không được máy sửa', () => {
    expect(af.CAM_CHAM).toContain('Kết quả mong đợi');
    expect(af.CAM_CHAM).toContain('Dữ liệu Test');
    expect(af.CAM_CHAM).toContain('Loại case');
    expect(af.CAM_CHAM).toContain('Tiền điều kiện');
  });
});

test.describe('@infra autofix — từng loại sửa có fixture trước/sau', () => {
  test('UU_TIEN_ALIAS: Highest → Critical', () => {
    const t = dungTask(bo([hang({ uu: 'Highest' })]));
    const kq = af.suaVanBan(fs.readFileSync(t.f, 'utf8'));
    expect(kq.doi.map((d: { ma: string }) => d.ma)).toContain('UU_TIEN_ALIAS');
    expect(kq.txt).toContain('| Critical |');
    expect(kq.txt).not.toContain('Highest');
  });

  test('BR_CHUAN: `<BR>` và `<br/>` về `<br>`', () => {
    const t = dungTask(bo([hang({ steps: '1. Mở màn<BR>2. Bấm Ghi<br />3. Xem' })]));
    const kq = af.suaVanBan(fs.readFileSync(t.f, 'utf8'));
    expect(kq.txt).not.toMatch(/<BR>|<br \/>/);
    expect((kq.txt.match(/<br>/g) || []).length).toBe(2);
  });

  test('KY_TU_VO_HINH: zero-width, non-breaking space, khoảng trắng đôi', () => {
    const t = dungTask(bo([hang({ module: 'Hồ​sơ  trường ' })]));
    const kq = af.suaVanBan(fs.readFileSync(t.f, 'utf8'));
    expect(kq.doi.map((d: { ma: string }) => d.ma)).toContain('KY_TU_VO_HINH');
    expect(kq.txt).not.toMatch(/[​ ]/);
    expect(kq.txt).not.toMatch(/ {2,}\S/);
  });

  test('TAG_TRONG_TIEU_DE: chuyển sang cột Tag, HỢP lại và bỏ trùng', () => {
    const t = dungTask(bo([hang({ title: '[Positive][Display] Xem hồ sơ trường', tag: '[BR-01]' })]));
    const kq = af.suaVanBan(fs.readFileSync(t.f, 'utf8'));
    expect(kq.txt).toContain('| [BR-01][Positive][Display] |');
    expect(kq.txt).toContain('| Xem hồ sơ trường |');
  });

  test('TAG_TRONG_TIEU_DE: trùng tag thì KHÔNG nhân đôi', () => {
    const t = dungTask(bo([hang({ title: '[Positive] Xem hồ sơ', tag: '[Positive]' })]));
    const kq = af.suaVanBan(fs.readFileSync(t.f, 'utf8'));
    expect((kq.txt.match(/\[Positive\]/g) || []).length).toBe(1);
  });

  test('TAG_TRONG_TIEU_DE: tiêu đề CHỈ có tag thì KHÔNG chuyển', () => {
    /*
     * Chuyển hết thì tiêu đề thành rỗng, và một case không có tiêu đề là một case không ai đọc được.
     * Đây là ca máy phải DỪNG LẠI để người xem, không phải ca để tự quyết.
     */
    expect(af.chuyenTag('[Positive][Display]', '')).toBeNull();
  });

  test('SO_BUOC_LECH: 2,3,4 → 1,2,3 và giữ nguyên từng chữ', () => {
    const cu = '2. Mở màn<br>3. Bấm Ghi<br>4. Xem thông báo';
    const moi = af.danhSoLai(cu);
    expect(moi).toBe('1. Mở màn<br>2. Bấm Ghi<br>3. Xem thông báo');
    /* Phần chữ phải y nguyên, không mất và không thêm. */
    const chu = (s: string) => s.split('<br>').map((d) => d.replace(/^\d+\.\s*/, '')).join('|');
    expect(chu(moi as string)).toBe(chu(cu));
  });

  test('SO_BUOC_LECH: số đã đúng ⇒ KHÔNG đổi (không tạo diff rỗng)', () => {
    expect(af.danhSoLai('1. A<br>2. B<br>3. C')).toBeNull();
  });

  test('SO_BUOC_LECH: có dòng KHÔNG đánh số ⇒ bỏ luật, không đoán', () => {
    /* Không phải ca đánh số lệch; đoán ở đây là tự thêm số cho một dòng người ta cố ý viết vậy. */
    expect(af.danhSoLai('1. A<br>Bấm Ghi<br>3. C')).toBeNull();
    expect(af.danhSoLai('Mở màn rồi bấm Ghi')).toBeNull();
  });
});

test.describe('@infra autofix — ĐỐI CHỨNG ÂM: không đụng thứ cần người', () => {
  test('Expected MƠ HỒ ⇒ `--fix` KHÔNG đụng, và gate VẪN báo lỗi', () => {
    /*
     * Đây là test quan trọng nhất của §A4. "Hiện thông báo phù hợp" là oracle rỗng nghĩa — gate phải
     * bắt, và máy tự sửa KHÔNG được quyền viết lại nó thành một câu cụ thể. Viết hộ nghĩa là máy tự
     * dựng kỳ vọng, và kỳ vọng do máy dựng thì không ai kiểm được nó đến từ đâu.
     */
    const t = dungTask(bo([hang({ expected: '1. Hiện thông báo phù hợp' })]));
    const truoc = fs.readFileSync(t.f, 'utf8');
    const r = chayCheck(t.goc, ['--fix']);
    const sau = fs.readFileSync(t.f, 'utf8');
    expect(sau, 'ô Expected phải y nguyên').toContain('Hiện thông báo phù hợp');
    expect(sau).toBe(truoc);
    expect(`${r.stdout}`, 'và gate vẫn phải báo lỗi về nó').toMatch(/lỗi phải sửa|CHẶN/);
  });

  test('`Dữ liệu Test` và `Loại case` KHÔNG bị chuẩn hoá khoảng trắng', () => {
    /*
     * Luật `KY_TU_VO_HINH` khai cột `*`, nên nếu `duocCham` hỏng thì nó sẽ chạm cả hai cột này. Test
     * này là phép kiểm-âm cho chính hàng rào đó.
     */
    const t = dungTask(bo([hang({ data: 'A  B', loai: 'Functional  ' })]));
    const kq = af.suaVanBan(fs.readFileSync(t.f, 'utf8'));
    const coChamCam = kq.doi.some((d: { cot: string }) => af.CAM_CHAM.includes(d.cot) && d.cot !== 'Kết quả mong đợi');
    expect(coChamCam, 'không luật nào được chạm cột bị cấm').toBe(false);
    expect(kq.txt, 'khoảng trắng đôi trong Dữ liệu Test phải còn').toContain('A  B');
  });

  test('`Kết quả mong đợi` chỉ bị chạm bởi SO_BUOC_LECH, và chỉ ở tiền tố số', () => {
    const t = dungTask(bo([hang({ expected: '3. Hiện thông báo "Ghi thành công"<br>5. Lưới cập nhật' })]));
    const kq = af.suaVanBan(fs.readFileSync(t.f, 'utf8'));
    const chamKq = kq.doi.filter((d: { cot: string }) => d.cot === 'Kết quả mong đợi');
    for (const d of chamKq) expect(d.ma, 'chỉ SO_BUOC_LECH được chạm ô này').toBe('SO_BUOC_LECH');
    expect(kq.txt, 'chữ sau số phải y nguyên').toContain('Hiện thông báo "Ghi thành công"');
    expect(kq.txt).toContain('1. Hiện thông báo');
    expect(kq.txt).toContain('2. Lưới cập nhật');
  });

  test('văn xuôi và dòng ngoài bảng giữ nguyên từng ký tự', () => {
    const t = dungTask(bo([hang({ uu: 'Highest' })]));
    const kq = af.suaVanBan(fs.readFileSync(t.f, 'utf8'));
    expect(kq.txt).toContain('Một đoạn văn xuôi phải được giữ nguyên.');
    expect(kq.txt.split('\n')[0]).toBe('# Testcase');
  });

  test('bảng KHÔNG phải testcase thì không bị chạm', () => {
    const md = ['# Tài liệu', '', '| Cột A | Cột B |', '|---|---|', '| Highest | A  B |', ''].join('\n');
    const kq = af.suaVanBan(md);
    expect(kq.doi).toHaveLength(0);
    expect(kq.txt).toBe(md);
  });
});

test.describe('@infra check --fix — idempotent và có dấu vết', () => {
  test('chạy HAI lần: lần hai không đổi gì', () => {
    const t = dungTask(bo([hang({ uu: 'Highest', steps: '2. A<br>3. B', title: '[Positive] Xem hồ sơ', module: 'Hồ  sơ' })]));
    chayCheck(t.goc, ['--fix']);
    const sauLan1 = fs.readFileSync(t.f, 'utf8');
    const r2 = chayCheck(t.goc, ['--fix']);
    const sauLan2 = fs.readFileSync(t.f, 'utf8');
    expect(sauLan2, 'lần hai phải không đổi gì — nếu không thì hai luật đang đẩy qua đẩy lại').toBe(sauLan1);
    expect(`${r2.stdout}`).toContain('không có gì để sửa');
  });

  test('ghi DIFF từng ô vào `reports/autofix.log`, không chỉ đếm', () => {
    /*
     * Một máy tự sửa testcase mà không để lại dấu vết từng ô là một máy không ai rà lại được, và thứ
     * nó chạm là bộ case quyết định đúng/sai của cả task.
     */
    const t = dungTask(bo([hang({ uu: 'Highest' })]));
    chayCheck(t.goc, ['--fix']);
    const log = fs.readFileSync(path.join(t.taskDir, 'reports', 'autofix.log'), 'utf8');
    expect(log).toContain('UU_TIEN_ALIAS');
    expect(log).toContain('TC_001');
    expect(log, 'diff phải có cả dòng cũ và dòng mới').toMatch(/- Highest/);
    expect(log).toMatch(/\+ Critical/);
  });

  test('`--dry-run` KHÔNG ghi gì: không sửa file, không ghi log', () => {
    const t = dungTask(bo([hang({ uu: 'Highest' })]));
    const truoc = fs.readFileSync(t.f, 'utf8');
    const r = chayCheck(t.goc, ['--dry-run']);
    expect(fs.readFileSync(t.f, 'utf8')).toBe(truoc);
    expect(fs.existsSync(path.join(t.taskDir, 'reports', 'autofix.log'))).toBe(false);
    expect(`${r.stdout}`).toContain('DRY-RUN');
  });

  test('in ra danh sách CỘT KHÔNG CHẠM, để người đọc biết ranh giới', () => {
    const t = dungTask(bo([hang({ uu: 'Highest' })]));
    const r = chayCheck(t.goc, ['--fix']);
    expect(`${r.stdout}`).toContain('KHÔNG chạm');
    expect(`${r.stdout}`).toContain('Kết quả mong đợi');
  });

  test('`--fix` chạy TRƯỚC kiểm, rồi báo phần CÒN LẠI', () => {
    /*
     * Sửa xong thì phần vi phạm định dạng không còn để báo nữa — đó là cả mục đích. Nhưng nó phải chạy
     * tiếp để báo phần KHÔNG tự sửa được, nếu không người ta tưởng `--fix` đã dọn sạch.
     */
    const t = dungTask(bo([hang({ uu: 'Highest', expected: '1. Hiện thông báo phù hợp' })]));
    const r = chayCheck(t.goc, ['--fix']);
    const out = `${r.stdout}`;
    expect(out).toContain('[fix]');
    expect(out, 'phải có cả bảng kiểm sau phần fix').toMatch(/lỗi phải sửa/);
    expect(out.indexOf('[fix]')).toBeLessThan(out.indexOf('lỗi phải sửa'));
  });
});
