/**
 * tc:semantic — chấm NGỮ NGHĨA bộ testcase bằng bảng trường của đặc tả (11/11/2026).
 *
 * Người review (P1): "đo testcase AI có expected đúng nghiệp vụ, có thiếu negative/boundary và có giả định sai
 * không". Máy này đi qua BA lượt đọc tay trên dữ liệu thật (CSDL-9001..9004) trước khi ra con số đáng tin. Độ
 * chính xác trục ②③ ở bản đầu là 0/4 — mọi phát hiện nặng đều là lỗi của máy. Mỗi ca dưới đây giữ ĐÚNG MỘT bài
 * học đã đọc ra, để bản sau không mắc lại.
 *
 * Phần cuối là BỘ CẤY LỖI: bốn lỗi đã biết cấy vào một bộ sạch, cộng đối chứng âm. Bộ cấy lỗi đầu tiên của tôi
 * cũng HỎNG (regex `\|` trong template literal thành `|`, xoá nhầm dòng tiêu đề) — nên ca đối chứng ở đây tự
 * kiểm rằng phép cấy THẬT SỰ làm đổi bộ case.
 */
import { test, expect } from '@playwright/test';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { cham } = require(path.join(REPO, 'scripts/qa/tc_semantic.js'));

const SPEC = [
  '| Stt | Trường trên màn hình | Control | Data type | Bắt buộc | DB Field | Mô tả nghiệp vụ |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  '| 1 | Tên đơn vị chính thức | Textbox | nvarchar(200) | Y | TEN | Tối đa 200 ký tự |',
  '| 2 | Mã định danh | Textbox | nvarchar(20) | N | MA | Hệ thống cấp |',
  '| 3 | Mã định danh tổ chức | Textbox | nvarchar(50) | Y | MA_TC | Chỉ chữ số 0–9, đủ 12 chữ số |',
  '| 4 | Loại hình đơn vị | Combobox | nvarchar(20) | Y | LH | Trường chỉ view |',
  '| 5 | Kiểu phân loại | Combobox | nvarchar(20) | Y | KPL | Chọn theo danh mục |',
  '| 6 | Năm thành lập đơn vị | Date picker | datetime | N | NTL | Riêng sở HCM đây là yêu cầu bắt buộc |',
  '| 7 | Nhóm chức vụ quản lý | Combobox |  | Y (đk) | NCV | Bắt buộc khi là CBQL |',
  '| 8 | Tên lớp học chính | Textbox |  | Y | TL | Mầm non tối đa 50 ký tự, ba cấp phổ thông tối đa 200 ký tự |',
  '| 14 | Số định danh cá nhân | Textbox |  | N | DDCN | Không quá 12 ký tự |',
  '| 15 | Nghề nghiệp người cha | Textbox |  | N | NN | Không quá 250 ký tự |',
].join('\n');
const HDR = '| TC ID | Loại case | Tag | Áp dụng cho cấp | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |';
const ca = (id: string, tag: string, tieuDe: string, duLieu: string, buoc: string, kyVong: string) =>
  `| T_TC_${id} | Functional | ${tag} | Tất cả | X | ${tieuDe} | [ui] x | ${duLieu} | 1. ${buoc} | ${kyVong} | Medium |`;

/* Bộ SẠCH: phủ đúng các nghĩa vụ của các trường gõ được. */
const SACH = [
  ca('001', '[Negative]', 'Bỏ trống Tên đơn vị chính thức - Bị chặn', 'Stt 1 Tên đơn vị chính thức: `""` (bỏ trống)', 'Bấm Ghi', 'Hệ thống chặn lưu, báo thông tin bắt buộc nhập'),
  ca('002', '[Boundary]', 'Tên đơn vị chính thức - Nhận 200, chặn tại 201 ký tự', 'Stt 1: chuỗi 200 rồi 201 ký tự', 'Nhập rồi Ghi', 'Nhận 200 ký tự; chặn tại 201 ký tự'),
  ca('003', '[Negative]', 'Bỏ trống Mã định danh tổ chức - Bị chặn', 'Stt 3 Mã định danh tổ chức: `""`', 'Bấm Ghi', 'Hệ thống chặn lưu'),
  ca('004', '[Negative]', 'Mã định danh tổ chức có chữ cái - Bị chặn', 'Stt 3: `37900a` (có chữ cái)', 'Bấm Ghi', 'Hệ thống chặn lưu, báo không hợp lệ'),
  ca('005', '[Boundary]', 'Mã định danh tổ chức 13 chữ số - Bị chặn', 'Stt 3: 13 chữ số', 'Bấm Ghi', 'Hệ thống chặn lưu'),
  ca('006', '[Negative]', 'Bỏ trống Kiểu phân loại - Bị chặn', 'Stt 5 Kiểu phân loại: `""`', 'Bấm Ghi', 'Hệ thống chặn lưu'),
  ca('007', '[Negative]', 'Bỏ trống Tên lớp học chính - Bị chặn', 'Tên lớp học chính: `""`', 'Bấm Ghi', 'Hệ thống chặn lưu'),
  ca('008', '[Boundary]', 'Tên lớp học chính 200 ký tự ở cấp THCS (biên max phổ thông)', 'Tên lớp học chính: `6A` + 198 ký tự `x` (tổng đúng 200 ký tự)', 'Nhập rồi Ghi', 'Đọc lại đủ 200 ký tự'),
  ca('009', '[Boundary]', 'Tên lớp học chính 201 ký tự - Bị chặn', 'Tên lớp học chính: 201 ký tự', 'Nhập rồi Ghi', 'Chặn tại 201 ký tự'),
  ca('010', '[Boundary]', 'Số định danh cá nhân 13 ký tự - Bị chặn', 'Stt 14 Số định danh cá nhân: 13 ký tự', 'Nhập rồi Ghi', 'Bị chặn'),
  ca('011', '[Boundary]', 'Nghề nghiệp người cha 251 ký tự - Bị chặn', 'Nghề nghiệp người cha: 251 ký tự', 'Nhập rồi Ghi', 'Bị chặn'),
  ca('012', '[Boundary]', 'Stt 2 Mã định danh 21 ký tự - Bị chặn', 'Stt 2: 21 ký tự', 'Nhập rồi Ghi', 'Bị chặn'),
].join('\n');
const BO = (them = '') => `${HDR}\n${SACH}${them ? `\n${them}` : ''}`;
const tom = (k: any) => ({
  thieu: k.nghiaVu.filter((x: any) => x.trangThai === 'thieu').map((x: any) => `${x.stt}:${x.nghiaVu}`).sort(),
  lech: k.mauThuan.filter((x: any) => !x.khaiChuDich).map((x: any) => x.id),
  gd: k.giaDinhSai.map((x: any) => `${x.id}:${x.loai}`),
});

test.describe('@infra tc:semantic — bộ sạch thì im lặng', () => {
  test('bộ sạch: 0 thiếu · 0 lệch · 0 giả định sai', () => {
    const k = cham(SPEC, BO());
    expect(tom(k)).toEqual({ thieu: [], lech: [], gd: [] });
  });
});

test.describe('@infra tc:semantic — mỗi ca giữ một bài học đọc tay', () => {
  const nv = (stt: string) => cham(SPEC, BO()).nghiaVu.filter((x: any) => x.stt === stt).map((x: any) => x.nghiaVu);

  test('combobox `nvarchar(20)` KHÔNG sinh nghĩa vụ biên độ dài — đó là kiểu cột DB', () => {
    expect(nv('5')).toEqual(['bat_buoc_bo_trong']);
  });
  test('"Trường chỉ view" không sinh nghĩa vụ gì', () => { expect(nv('4')).toEqual([]); });
  test('`Y (đk)` là bắt buộc CÓ ĐIỀU KIỆN — không sinh nghĩa vụ bỏ trống tuyệt đối', () => { expect(nv('7')).toEqual([]); });
  test('mô tả "đủ 12 chữ số" THẮNG `nvarchar(50)`', () => {
    expect(nv('3')).toEqual(expect.arrayContaining(['nhap_chu_vao_o_so', 'bien_chu_so']));
    expect(nv('3')).not.toContain('bien_do_dai');
  });

  test('`Stt 1` không khớp vào giữa `Stt 14`', () => {
    /* Case phải ĐIỀN Stt 1 (để nó được neo vào Stt 1) và BỎ TRỐNG Stt 14 — đúng hình dạng 9003 TC_024. Bản đầu
     * của ca này không nhắc Stt 1, nên luật đang thử chưa từng chạy tới: phá nó vẫn 0 ca đỏ. */
    const k = cham(SPEC, BO(ca('050', '[Positive]', 'Bỏ trống Stt 14 Số định danh cá nhân - Vẫn lưu', 'Stt 1 Tên đơn vị chính thức: `ABC`<br>Stt 14 Số định danh cá nhân: `""`', 'Ghi', 'Lưu thành công')));
    expect(tom(k).gd.filter((x: string) => /TC_050/.test(x)), 'Stt 1 là bắt buộc — nhầm thì thành "bỏ trống bắt buộc mà cho lưu"').toEqual([]);
  });

  test('tiêu đề nhắc HAI trường: dấu "để trống" chỉ thuộc trường đứng ngay sau nó', () => {
    const k = cham(SPEC, BO(ca('051', '[Positive]', 'Tên lớp học chính = 6A - Để trống Nghề nghiệp người cha vẫn lưu', 'Tên lớp học chính: `6A`<br>Nghề nghiệp người cha: `""`', 'Ghi', 'Lưu thành công')));
    expect(tom(k).gd).toEqual([]);
  });

  test('"Xoá trắng ô rồi nhập X" là THAY giá trị, không phải bỏ trống', () => {
    const k = cham(SPEC, BO(ca('052', '[Positive]', 'Tên đơn vị chính thức hợp lệ - Lưu', 'Stt 1 Tên đơn vị chính thức: `ABC`', 'Xoá trắng ô Stt 1 Tên đơn vị chính thức, nhập `ABC`', 'Lưu thành công')));
    expect(tom(k).gd).toEqual([]);
  });

  test('chuỗi GHÉP trong dữ liệu ("`6A` + 198 ký tự") không phải con số biên', () => {
    expect(tom(cham(SPEC, BO())).lech, 'T_TC_008 chỉ thử 200 = biên phổ thông').toEqual([]);
  });

  test('biên theo cấp: "Mầm non 50, phổ thông 200" — thử 200 không lệch', () => {
    const k = cham(SPEC, BO());
    expect(k.nghiaVu.find((x: any) => x.stt === '8' && x.nghiaVu === 'bien_do_dai').maxLens).toEqual([50, 200]);
  });

  test('"Mã định danh" (ngắn) không neo vào case của "Mã định danh tổ chức" (dài)', () => {
    const k = cham(SPEC, BO());
    /* KHÔNG dùng `.every()` trên mảng có thể rỗng — rỗng thì luôn true. Stt 2 có ĐÚNG MỘT case riêng (T_TC_012);
     * nếu tên ngắn ăn vào case của Stt 3 (T_TC_003/004/005) thì con số này thành 4. */
    const nvStt2 = k.nghiaVu.filter((x: any) => x.stt === '2');
    expect(nvStt2.length, 'Stt 2 phải có nghĩa vụ để ca này không rỗng nghĩa').toBeGreaterThan(0);
    expect(nvStt2.map((x: any) => x.soCaNeo)).toEqual([1]);
  });

  test('ca DƯỚI biên ("không quá 250 ký tự thì 26 ký tự PHẢI lưu được") không phải lệch', () => {
    const k = cham(SPEC, BO(ca('053', '[Boundary]', 'Nghề nghiệp người cha 26 ký tự - Phải lưu được (giới hạn 250 ký tự)', 'Nghề nghiệp người cha: 26 ký tự', 'Ghi', 'Theo đặc tả ("không quá 250 ký tự") thì 26 ký tự PHẢI lưu được')));
    expect(tom(k).lech).toEqual([]);
  });

  test('bắt buộc có điều kiện trong MÔ TẢ ⇒ case "báo bắt buộc" không phải giả định sai', () => {
    const k = cham(SPEC, BO(ca('054', '[Negative]', 'Bỏ trống Năm thành lập đơn vị ở Sở HCM - Bị chặn', 'Năm thành lập đơn vị: `""`', 'Ghi', 'Chặn lưu, báo thông tin bắt buộc nhập')));
    expect(tom(k).gd).toEqual([]);
  });

  test('case QUAN SÁT ("ghi lại chặn hay cho lưu") không khẳng định gì', () => {
    const k = cham(SPEC, BO(ca('055', '[Negative]', 'Xoá trắng Nghề nghiệp người cha rồi lưu', 'Nghề nghiệp người cha: `""`', 'Ghi', 'Ghi lại hệ thống chặn hay cho lưu; nếu bị chặn thì báo "Thông tin bắt buộc nhập"')));
    expect(tom(k).gd).toEqual([]);
  });

  test('case dẫn BR lệch bảng trường ⇒ "cần đối chiếu nguồn", KHÔNG gọi là giả định sai', () => {
    const k = cham(SPEC, BO(ca('056', '[Negative][BR-HS-011]', 'Bỏ trống Nghề nghiệp người cha - Bị chặn', 'Nghề nghiệp người cha: `""`', 'Ghi', 'Bị chặn lưu, báo thông tin bắt buộc nhập theo BR-11')));
    expect(tom(k).gd).toEqual(['T_TC_056:lech_nguon_can_doi_chieu']);
  });
});

test.describe('@infra tc:semantic — BỘ CẤY LỖI: bốn lỗi đã biết phải bị bắt', () => {
  const goc = tom(cham(SPEC, BO()));
  const delta = (doc: string) => {
    const d = tom(cham(SPEC, doc));
    return { thieu: d.thieu.filter((x: string) => !goc.thieu.includes(x)), lech: d.lech.filter((x: string) => !goc.lech.includes(x)), gd: d.gd.filter((x: string) => !goc.gd.includes(x)) };
  };

  test('① xoá ca biên duy nhất của một trường ⇒ nghĩa vụ đó thành THIẾU (không phải "không neo")', () => {
    const doc = BO().split('\n').filter((d) => !d.startsWith('| T_TC_011 ')).join('\n');
    expect(doc, 'phép cấy phải THẬT SỰ xoá dòng — bộ cấy đầu tiên đã xoá nhầm dòng tiêu đề').not.toContain('T_TC_011');
    expect(delta(doc).thieu).toEqual(['15:bien_do_dai']);
  });

  test('② ca biên khẳng định SAI con số (200 → 300) ⇒ LỆCH', () => {
    const doc = BO().replace('| T_TC_009 | Functional | [Boundary] | Tất cả | X | Tên lớp học chính 201 ký tự - Bị chặn', '| T_TC_009 | Functional | [Boundary] | Tất cả | X | Tên lớp học chính 301 ký tự - Bị chặn')
      .replace('Chặn tại 201 ký tự', 'Chặn tại 301 ký tự');
    expect(doc).toContain('Chặn tại 301 ký tự');
    expect(delta(doc).lech).toEqual(['T_TC_009']);
  });

  test('③a bỏ trống trường KHÔNG bắt buộc mà kỳ vọng "báo bắt buộc" ⇒ giả định sai', () => {
    const doc = BO(ca('901', '[Negative]', 'Bỏ trống Nghề nghiệp người cha - Bị chặn', 'Nghề nghiệp người cha: `""`', 'Ghi', 'Hệ thống chặn lưu, hiện thông báo trường bắt buộc nhập'));
    expect(delta(doc).gd).toEqual(['T_TC_901:coi_la_bat_buoc']);
  });

  test('③b bỏ trống trường BẮT BUỘC mà kỳ vọng lưu thành công ⇒ giả định sai', () => {
    const doc = BO(ca('902', '[Positive]', 'Để trống Tên đơn vị chính thức - Vẫn lưu', 'Stt 1 Tên đơn vị chính thức: `""`', 'Ghi', 'Hệ thống lưu thành công'));
    expect(delta(doc).gd).toEqual(['T_TC_902:bo_trong_ma_cho_luu']);
  });
});

test.describe('@infra tc:semantic — "không phán được" không phải "đạt"', () => {
  test('không có bảng trường ⇒ phanDuoc=false, không trả số nào', () => {
    const k = cham('# Biểu báo cáo\n\nKhông có bảng trường.', BO());
    expect(k.phanDuoc).toBe(false);
    expect(k.nghiaVu).toBeUndefined();
  });

  test('CLI: task không có bảng trường ⇒ exit 2 và nói rõ KHÔNG đồng nghĩa với "đạt"', () => {
    const r = spawnSync(process.execPath, [path.join(REPO, 'scripts/qa/tc_semantic.js'), '--task', 'KHONG-CO-TASK-NAY'], { encoding: 'utf8', cwd: REPO, env: gateEnv() });
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/KHÔNG PHÁN ĐƯỢC/);
    expect(r.stdout).toMatch(/KHÔNG đồng nghĩa với "đạt"/);
  });
});
