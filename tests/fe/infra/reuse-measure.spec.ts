/*
 * §G — ĐO NĂM MỤC TIÊU. OFFLINE, không chạm UAT.
 *
 * Spec này canh ba thứ, và thứ ba là thứ dễ mất nhất:
 *
 *   1. Phép đo "dùng lại" đúng nghĩa — CHÉO BỘ, không phải lặp trong cùng một bộ.
 *   2. Mọi tỉ lệ đều đi kèm MẪU SỐ, và mẫu số 0 không bao giờ thành một tỉ lệ.
 *   3. Ba mục CHƯA ĐO ĐƯỢC phải còn nguyên trong báo cáo, mỗi mục kèm lý do và điều kiện để đo.
 *      Đây là phần sẽ bị bào mòn trước tiên: một bảng toàn số trông "xong" hơn một bảng có ba dòng
 *      thú nhận, và cách nhanh nhất để bảng đẹp lên là lặng lẽ bỏ ba dòng đó đi.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..', '..');
/* eslint-disable @typescript-eslint/no-var-requires, global-require */
const me = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'measure.js'));
const sm = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'steps_match.js'));
/* eslint-enable @typescript-eslint/no-var-requires, global-require */

const FIXTURE = path.join(REPO, 'tests', 'fe', 'fixtures', 'steps', 'testcase-chuan-phrasing.md');
const tmp = (t: string) => fs.mkdtempSync(path.join(REPO, 'outputs', '_scratch', `${t}-`));

/** Dựng một bộ case canonical tối thiểu để đo, không phụ thuộc `outputs/**` (vốn bị gitignore). */
function dungBo(dir: string, ten: string, cauBuoc: string[][]) {
  const cot = '| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |';
  const hang = cauBuoc.map((cac, i) => `| ${ten}_${i} | UI | [Positive] | M / ca ${i} | ca ${i} | [ui] x | — | ${cac.map((c, n) => `${n + 1}. ${c}`).join('<br>')} | 1. ok | Medium |`);
  const f = path.join(dir, `${ten}.md`);
  fs.writeFileSync(f, `# ${ten}\n\n${cot}\n|---|---|---|---|---|---|---|---|---|---|\n${hang.join('\n')}\n`, 'utf8');
  return f;
}

test.describe('§G — phép đo "dùng lại" là CHÉO BỘ', () => {
  test('mệnh đề có ở bộ KHÁC thì tính; chỉ lặp trong CÙNG bộ thì không', () => {
    /*
     * Phân biệt này là cả giá trị của phép đo. "Lặp trong cùng một bộ" không chứng minh gì về việc dùng
     * lại ở task sau — nó chỉ nói case trong một task hay giống nhau. Đo nhầm sang đó thì tỉ lệ đẹp lên
     * mà thư viện không hề dùng lại được.
     */
    const d = tmp('g-cheo');
    const a = dungBo(d, 'A', [['bấm nút "Ghi"'], ['bấm nút "Ghi"'], ['nhập ô "Tên" = "X"']]);
    const b = dungBo(d, 'B', [['bấm nút "Ghi"'], ['xoá trắng ô "Mã"']]);
    const r = me.dungDo({ duongChiDinh: `${a},${b}` });
    fs.rmSync(d, { recursive: true, force: true });

    const boB = r.dung_lai_cheo_bo.find((x: { bo: string }) => x.bo === 'B');
    expect(boB.mau_so, 'B có 2 mệnh đề').toBe(2);
    expect(boB.co_san, 'chỉ `bấm nút "Ghi"` có ở A').toBe(1);
    expect(boB.ti_le).toBe(0.5);

    const boA = r.dung_lai_cheo_bo.find((x: { bo: string }) => x.bo === 'A');
    expect(boA.mau_so, 'A có 3 mệnh đề, kể cả câu lặp lại trong chính nó').toBe(3);
    expect(boA.co_san, 'hai câu `bấm nút "Ghi"` đều có ở B — lặp nội bộ KHÔNG làm tăng mẫu số có sẵn sai').toBe(2);
  });

  test('một bộ duy nhất ⇒ tỉ lệ 0, vì không có bộ nào khác để dùng lại', () => {
    const d = tmp('g-mot');
    const a = dungBo(d, 'A', [['bấm nút "Ghi"'], ['bấm nút "Ghi"']]);
    const r = me.dungDo({ duongChiDinh: a });
    fs.rmSync(d, { recursive: true, force: true });
    expect(r.dung_lai_cheo_bo[0].co_san, 'lặp trong chính nó KHÔNG được tính là dùng lại').toBe(0);
  });

  test('bộ RỖNG ⇒ `ti_le: null`, không phải 0', () => {
    /* 0% nghĩa "đo rồi, không dùng lại được gì". `null` nghĩa "không có gì để đo". */
    const d = tmp('g-rong');
    const a = dungBo(d, 'A', []);
    const b = dungBo(d, 'B', [['bấm nút "Ghi"']]);
    const r = me.dungDo({ duongChiDinh: `${a},${b}` });
    fs.rmSync(d, { recursive: true, force: true });
    expect(r.dung_lai_cheo_bo.find((x: { bo: string }) => x.bo === 'A').ti_le).toBeNull();
  });

  test('gộp đồng nghĩa có hiệu lực trong phép đo — `kích nút` và `bấm nút` là một', () => {
    const d = tmp('g-dn');
    const a = dungBo(d, 'A', [['kích nút "Ghi"']]);
    const b = dungBo(d, 'B', [['bấm nút "Ghi"']]);
    const r = me.dungDo({ duongChiDinh: `${a},${b}` });
    fs.rmSync(d, { recursive: true, force: true });
    expect(r.dung_lai_cheo_bo.find((x: { bo: string }) => x.bo === 'B').co_san).toBe(1);
  });
});

test.describe('§G — báo cáo không được giấu phần chưa đo được', () => {
  const d = () => me.dungDo({ duongChiDinh: FIXTURE });

  test('ba mục CHƯA ĐO ĐƯỢC còn nguyên, mỗi mục kèm lý do VÀ điều kiện để đo', () => {
    /*
     * Đây là phần sẽ bị bào mòn trước tiên. Một bảng toàn số trông "xong" hơn một bảng có ba dòng thú
     * nhận, và cách nhanh nhất để bảng đẹp lên là lặng lẽ bỏ ba dòng đó.
     */
    const r = d();
    expect(r.chua_do_duoc).toHaveLength(3);
    for (const x of r.chua_do_duoc) {
      expect(x.muc_tieu, 'mục tiêu phải nêu tên').toBeTruthy();
      expect(String(x.vi_sao).length, 'lý do phải cụ thể, không phải một chữ').toBeGreaterThan(40);
      expect(String(x.de_do_duoc).length, 'phải nói ĐIỀU KIỆN để đo được').toBeGreaterThan(20);
    }
    const ten = r.chua_do_duoc.map((x: { muc_tieu: string }) => x.muc_tieu).join(' | ');
    expect(ten).toContain('token');
    expect(ten).toContain('bug gài');
    expect(ten).toContain('mutation_check');
  });

  test('proxy token tự khai nó là PROXY, không khai là token', () => {
    /* Một con số đúng bị dùng để chứng minh điều nó không nói — đó là cách nó thành con số sai. */
    const r = d();
    expect(r.proxy_khoi_luong_viec._la_proxy).toMatch(/KHÔNG phải tỉ lệ token/);
  });

  test('báo cáo mang SỐ MỤC DANH MỤC — mẫu số chặn mọi tỉ lệ ở §G.3', () => {
    const r = d();
    expect(r.so_muc_danh_muc).toBe((sm.napDanhMuc() || { buoc: [] }).buoc.length);
    expect(r.so_muc_danh_muc).toBeGreaterThan(0);
  });

  test('mục tiêu §G khai ở MỘT chỗ, không rải ra nhiều nơi', () => {
    expect(me.MUC_TIEU.dung_lai_cung_module).toBe(0.7);
    expect(me.MUC_TIEU.dung_lai_khac_module).toBe(0.5);
    const src = fs.readFileSync(path.join(REPO, 'scripts', 'qa', 'reuse', 'measure.js'), 'utf8');
    /* Chỉ được xuất hiện trong khai báo MUC_TIEU, không hardcode lại ở phần in. */
    expect((src.match(/0\.70|0\.50/g) || []).length).toBeLessThanOrEqual(3);
  });

  test('không bộ case nào ⇒ CHƯA ĐO ĐƯỢC, không phải "chưa đạt"', () => {
    const r = me.dungDo({ duongChiDinh: path.join(REPO, 'khong-ton-tai.md') });
    expect(r.loi).toBe('khong-co-bo-case');
    /* `main()` biến đúng tình huống này thành exit 2 — xem `measure.js`. */
  });
});

test.describe('§G — đọc hai con số cạnh nhau', () => {
  test('bộ viết đúng chuẩn §K khớp CAO HƠN HẲN bộ viết tự do, trên CÙNG danh mục', () => {
    /*
     * Đây là kết luận chính của cả §G: khoảng cách giữa hai con số là phần §K mua được, và nó KHÔNG
     * mua được bằng một bộ khớp tốt hơn. Thiếu phép đo này thì con số thấp ở bộ thật sẽ bị quy cho
     * thiết kế thay vì quy cho cách viết câu bước.
     */
    const chuan = me.khopVaoDanhMuc(FIXTURE);
    expect(chuan.ti_le_exact).toBeGreaterThan(0.7);

    const d = tmp('g-tudo');
    /* Cùng thao tác, viết theo kiểu tự do: tham số không bọc nháy (đo được: 69% câu thật viết thế). */
    const tuDo = dungBo(d, 'TUDO', [['chọn combobox cbNamHoc = 2026-2027'], ['đọc giá trị combobox cbNamHoc']]);
    const r = me.khopVaoDanhMuc(tuDo);
    fs.rmSync(d, { recursive: true, force: true });

    expect(r.ti_le_exact, 'tham số không bọc nháy ⇒ không khớp tuyệt đối được').toBeLessThan(chuan.ti_le_exact);
  });
});
