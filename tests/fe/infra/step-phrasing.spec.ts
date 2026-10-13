/*
 * §K — CHUẨN VIẾT CÂU BƯỚC. OFFLINE, không chạm UAT.
 *
 * §G đo được: cùng bộ khớp, cùng danh mục 6 mục, case viết tự do khớp 0–3% còn case viết đúng chuẩn
 * khớp 79%. Khoảng cách đó là phần §K mua được, và nó KHÔNG mua được bằng một bộ khớp tốt hơn. Nên §K
 * là mục có đòn bẩy lớn nhất của cả đợt, và tiêu chí 9 là chỗ nó có răng.
 *
 * Spec này canh hai thứ, và thứ hai mới là thứ giữ cho tiêu chí 9 sống được:
 *
 *   1. Hai luật đang chấm (P1 · P4) bắt đúng và KHÔNG báo oan.
 *   2. BA LUẬT ĐÃ BỊ LOẠI (P2 · P3 · P5) không được thêm lại mà không đo. Mỗi luật có một test ghim
 *      lại CON SỐ đã khiến nó bị loại — P3 từng bắt 58% số mệnh đề vì tôi nhầm danh sách dạng chuẩn
 *      của nhóm đồng nghĩa thành danh sách động từ được phép.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '..', '..', '..');
/* eslint-disable @typescript-eslint/no-var-requires, global-require */
const pc = require(path.join(REPO, 'scripts', 'qa', 'lib', 'step_phrasing_check.js'));
const sg = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'steps_suggest.js'));
const sm = require(path.join(REPO, 'scripts', 'qa', 'reuse', 'steps_match.js'));
/* eslint-enable @typescript-eslint/no-var-requires, global-require */

const FIXTURE = path.join(REPO, 'tests', 'fe', 'fixtures', 'steps', 'testcase-chuan-phrasing.md');

test.describe('§K — hai luật đang chấm', () => {
  test('ĐỐI CHỨNG HAI CHIỀU đi kèm luật, không chép lại ở đây', () => {
    for (const s of pc.DOI_CHUNG.phai_bat) {
      expect(pc.viPhamCuaMenhDe(s).length, `phải bắt: ${s}`).toBeGreaterThan(0);
    }
    for (const s of pc.DOI_CHUNG.khong_duoc_bat) {
      expect(pc.viPhamCuaMenhDe(s), `báo oan: ${s}`).toHaveLength(0);
    }
  });

  test('P1 bắt `= giá trị` không bọc, tha `= "giá trị"`', () => {
    expect(pc.viPhamCuaMenhDe('Nhập Stt 26 Diện tích đất = 5000').map((v: { ma: string }) => v.ma)).toContain('P1');
    expect(pc.viPhamCuaMenhDe('nhập "Diện tích đất" = "5000"')).toHaveLength(0);
    expect(pc.viPhamCuaMenhDe('chọn combobox "Năm học" = "2026-2027"')).toHaveLength(0);
  });

  test('P4 phân biệt ĐƯỜNG DẪN MÀN với DỮ LIỆU của ô', () => {
    /*
     * `Website = "http://..."` là GIÁ TRỊ một ô, không phải một màn. Bản đầu bắt cả nó — 2 trong 4 ví
     * dụ đầu tiên trên bộ thật là loại này, tức một nửa số lần nó kêu là kêu oan.
     */
    expect(pc.viPhamCuaMenhDe('mở C2/HoSoTruongDetail.aspx').map((v: { ma: string }) => v.ma)).toContain('P4');
    expect(pc.viPhamCuaMenhDe('Mở tab mới vào https://vi-du.com/Manage/Log').map((v: { ma: string }) => v.ma)).toContain('P4');
    expect(pc.viPhamCuaMenhDe('Nhập Stt 15 Website = "http://truong-test.edu.vn"')).toHaveLength(0);
  });

  test('P4 KHÔNG bắt payload XSS — bản đầu phạt đúng case bảo mật', () => {
    expect(pc.viPhamCuaMenhDe('Xoá trắng ô Stt 116 và nhập <script>alert(1)</script>')).toHaveLength(0);
  });

  test('câu SQL nằm ngoài phạm vi chấm', () => {
    expect(pc.viPhamCuaMenhDe('Chạy db_readonly: SELECT MA_TRUONG FROM TRUONG WHERE MA_NAM_HOC = 2026')).toHaveLength(0);
  });
});

test.describe('§K — ba luật ĐÃ BỊ LOẠI, và con số khiến chúng bị loại', () => {
  test('P3 KHÔNG được chấm: danh sách `chuan` là dạng chuẩn của NHÓM ĐỒNG NGHĨA, không phải động từ được phép', () => {
    /*
     * Lỗi của tôi, đo được: lấy `chuan` làm allow-list thì 3.425/5.886 mệnh đề (58%) bị bắt, mà ví dụ
     * đầu tiên là `Đọc tiêu đề khung nội dung` — một câu đúng. `đọc`, `đếm`, `cuộn` không có đồng nghĩa
     * nên không nằm trong nhóm nào. Một tiêu chí phạt 58% vì dùng chữ "đọc" sẽ bị tắt ngay trong tuần.
     */
    const ng = sm.napNguPhap();
    const chuan = new Set((ng._nguon.dong_nghia.nhom || []).map((g: { chuan: string }) => sm.boDau(g.chuan)));
    for (const v of ['doc', 'dem', 'cuon', 'chup', 'quan sat']) {
      expect(chuan.has(v), `\`${v}\` là động từ hợp lệ mà KHÔNG nằm trong nhóm đồng nghĩa`).toBe(false);
    }
    /* Và chúng phải sạch với bộ luật đang chạy. */
    for (const s of ['đọc giá trị combobox "cbNamHoc"', 'đếm tổng số dòng của bảng', 'Cuộn ngang bảng hết sang phải']) {
      expect(pc.viPhamCuaMenhDe(s), s).toHaveLength(0);
    }
  });

  test('P2 KHÔNG được chấm lại: tiêu chí 1 đã phạt bước gộp nhiều hành động', () => {
    /* Phạt hai lần cùng một lỗi làm điểm mất nghĩa, và người viết không biết sửa theo cái nào. */
    const src = fs.readFileSync(path.join(REPO, 'scripts', 'qa', 'tc_review.js'), 'utf8');
    expect(src, 'tiêu chí 1 vẫn là nơi bắt bước gộp hành động').toMatch(/gộp từ 3 hành động/);
    expect(pc.LUAT.map((l: { ma: string }) => l.ma), 'P2 không được nằm trong bộ luật tiêu chí 9').not.toContain('P2');
  });

  test('P5 KHÔNG được chấm lại: tiêu chí 2 và `steps:lint` đã canh oracle', () => {
    expect(pc.LUAT.map((l: { ma: string }) => l.ma)).not.toContain('P5');
    expect(fs.existsSync(path.join(REPO, 'scripts', 'qa', 'reuse', 'steps_lint.js'))).toBe(true);
  });

  test('bộ luật đang chấm đúng bằng HAI, và mỗi luật có dòng CHỮA', () => {
    expect(pc.LUAT.map((l: { ma: string }) => l.ma)).toEqual(['P1', 'P4']);
    for (const l of pc.LUAT) expect(String(l.chua).length, l.ma).toBeGreaterThan(20);
  });
});

test.describe('§K — tiêu chí 9 trong tc:review', () => {
  const tcGia = (buoc: string[]) => ({
    tcId: 'T', module: 'M', title: 't', precondition: '[ui] x',
    steps: buoc.map((b, i) => ({ n: i + 1, text: b })), expected: [],
  });

  test('sạch ⇒ 2 điểm · một chỗ sai ⇒ 1 · nhiều chỗ ⇒ 0', () => {
    expect(pc.diem(tcGia(['bấm nút "Ghi"'])).diem).toBe(2);
    expect(pc.diem(tcGia(['Nhập Stt 26 = 5000'])).diem).toBe(1);
    expect(pc.diem(tcGia(['Nhập Stt 26 = 5000', 'mở C2/HoSo.aspx'])).diem).toBe(0);
  });

  test('case KHÔNG có bước nào ⇒ `null` (n/a), KHÔNG phải 0', () => {
    /* Cho 0 là phạt một case vì nó không có dữ liệu để chấm — và một gate phạt oan sẽ bị tắt. */
    const r = pc.diem(tcGia([]));
    expect(r.diem).toBeNull();
    expect(r.vi_sao[0]).toContain('n/a');
  });

  test('`n/a` KHÔNG vào mẫu số — cùng cách tiêu chí 8 làm', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts', 'qa', 'tc_review.js'), 'utf8');
    expect(src).toMatch(/toiDa: r\.diem === null \? 0 : 2/);
  });

  test('ngưỡng theo SỐ CHỖ sai, không theo tỉ lệ trên số bước', () => {
    /*
     * Một case 3 bước và một case 30 bước cùng sai hai chỗ thì việc phải sửa là như nhau, còn tỉ lệ
     * thì khác hẳn — chấm theo tỉ lệ sẽ tha case dài.
     */
    const ngan = pc.diem(tcGia(['Nhập Stt 1 = 1', 'Nhập Stt 2 = 2']));
    const dai = pc.diem(tcGia(['Nhập Stt 1 = 1', 'Nhập Stt 2 = 2', ...Array.from({ length: 28 }, () => 'bấm nút "Ghi"')]));
    expect(ngan.diem).toBe(dai.diem);
    expect(dai.diem).toBe(0);
  });

  test('tc_review gọi MỘT NGUỒN, không viết lại luật', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts', 'qa', 'tc_review.js'), 'utf8');
    expect(src).toContain("require(path.resolve(__dirname, 'lib', 'step_phrasing_check'))");
    expect(src).toContain('phrasing.diem(tc)');
  });
});

test.describe('§K — steps:suggest', () => {
  test('gom theo KHUNG câu và sắp theo SỐ LƯỢT', () => {
    /*
     * Một khung câu sai lặp 19 lượt thì sửa nó đáng hơn 19 câu sai mỗi câu một lượt, và danh sách theo
     * thứ tự case giấu mất điều đó.
     */
    const d = sg.dungDo({ taskKey: 'FIXTURE', duongMd: FIXTURE });
    expect(d.loi).toBeUndefined();
    for (let i = 1; i < d.nhom.length; i += 1) {
      expect(d.nhom[i - 1].so_luot).toBeGreaterThanOrEqual(d.nhom[i].so_luot);
    }
  });

  test('fixture viết đúng chuẩn ⇒ 0 lượt lệch', () => {
    const d = sg.dungDo({ taskKey: 'FIXTURE', duongMd: FIXTURE });
    expect(d.so_luot_vi_pham, `còn lệch: ${JSON.stringify(d.nhom)}`).toBe(0);
  });

  test('dùng CÙNG bộ luật với tiêu chí 9, không giữ bản sao', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts', 'qa', 'reuse', 'steps_suggest.js'), 'utf8');
    expect(src).toContain('step_phrasing_check');
    expect(src, 'không được tự khai regex riêng').not.toMatch(/const RE_[A-Z_]+\s*=\s*\//);
  });

  test('0 case ⇒ CHƯA ĐO ĐƯỢC, không phải "câu bước hoàn hảo"', () => {
    const d = sg.dungDo({ taskKey: 'X', duongMd: path.join(REPO, 'khong-ton-tai.md') });
    expect(d.loi).toBe('khong-co-case');
  });
});
