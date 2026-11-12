/**
 * ab:doi-chung — ba máy còn thiếu của quy trình đối chứng A/B (docs/v2.11.0/DOI_CHUNG_A_B.md §7).
 *
 * Fixture kit A theo đúng bảng 19 cột của `rbt-manual-testing` (dòng ví dụ trong SOURCE_GUIDE của A); fixture kit B
 * theo bảng canonical. Cả hai trích yêu cầu từ CÙNG một danh mục `INV-*` — mẫu số chung của M1.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { thuMucTam } from './_thu_muc_tam';
import { gateEnv } from './_gate_env';

const REPO = path.resolve(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ab = require(path.join(REPO, 'scripts/qa/doi_chung_ab.js'));
const MAY = path.join(REPO, 'scripts/qa/doi_chung_ab.js');
const chay = (...a: string[]) => spawnSync(process.execPath, [MAY, ...a], { encoding: 'utf8', cwd: REPO, env: gateEnv() });

const A_MD = [
  '| TC ID | REQ ID | Module | Risk Level | Test Scenario | Test Objective | Test Type | Test Level | Technique | Actor/Role | Context | Pre-Condition | Test Data | Test Steps | Expected Result | Priority | Automatable | Auto Type | Tags |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  '| BC-ST-001 | INV-01, INV-02 | Bao cao | High | Gửi | Gửi được | Functional | System | ST | Trường | Đã đăng nhập | Báo cáo Chưa gửi | 5 biểu đủ | 1. Bấm Gửi<br>2. Đồng ý | 1. Hộp xác nhận<br>2. Trạng thái "Đã gửi" | High | Yes | UI | @Regression |',
  '| BC-ST-002 | INV-03 | Bao cao | High | Mở khoá | Chặn | Functional | System | ST | Phường/Xã | Đã đăng nhập | Báo cáo Đã gửi | - | 1. Bấm Mở khoá | 1. Bị chặn \\| giữ "Đã gửi" | High | Yes | UI | @Guard |',
  '',
  '## Truy vết',
  '| REQ ID | TC ID | Ghi chú |',
  '|---|---|---|',
  '| INV-01 | BC-ST-001 | bảng truy vết — KHÔNG phải bảng testcase |',
].join('\n');
const B_MD = [
  '| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử | Tiền điều kiện | Dữ liệu Test | Các bước thực hiện | Kết quả mong đợi | Ưu tiên |',
  '|---|---|---|---|---|---|---|---|---|---|',
  '| X_TC_001 | Functional | [Positive][INV-01][BR-ZZ-009] | Gửi báo cáo | Gửi | [ui] Chưa gửi | 5 biểu | 1. Bấm Gửi | 1. "Đã gửi" | High |',
].join('\n');

const dung = () => {
  const d = thuMucTam('ab');
  fs.writeFileSync(path.join(d, 'a.md'), A_MD);
  fs.writeFileSync(path.join(d, 'b.md'), B_MD);
  return d;
};

test.describe('@infra ab:doi-chung — chuyển khuôn', () => {
  test('đọc đúng bảng 19 cột của A và bảng canonical của B; bảng truy vết có cột TC ID KHÔNG bị vơ', () => {
    const d = dung();
    const a = ab.chuyen('A', path.join(d, 'a.md'));
    const b = ab.chuyen('B', path.join(d, 'b.md'));
    fs.rmSync(d, { recursive: true, force: true });
    expect(a.loi).toEqual([]);
    expect(a.bo.ca.map((c: any) => c.id), 'đo trên TASK-4008: dò mỗi cột "TC ID" ra 368 dòng thay vì 312').toEqual(['BC-ST-001', 'BC-ST-002']);
    expect(a.bo.ca[0].yeu_cau).toEqual(['INV-01', 'INV-02']);
    expect(a.bo.ca[0].buoc).toBe('1. Bấm Gửi\n2. Đồng ý');
    expect(a.bo.ca[0].tien_de, 'tiền đề của A gộp Pre-Condition + Context').toBe('Báo cáo Chưa gửi\nĐã đăng nhập');
    expect(a.bo.ca[1].ky_vong, '`\\|` trong ô là chữ, không phải ranh giới cột').toBe('1. Bị chặn | giữ "Đã gửi"');
    expect(b.bo.ca[0].yeu_cau).toEqual(['INV-01', 'BR-ZZ-009']);
  });

  test('bộ trung lập bị sửa nội dung, hoặc nguồn đổi sau khi chuyển ⇒ kiem-khuon bắt được', () => {
    const d = dung();
    const a = ab.chuyen('A', path.join(d, 'a.md')).bo;
    expect(ab.kiemKhuon(a)).toEqual([]);
    const sua = JSON.parse(JSON.stringify(a));
    sua.ca[0].ky_vong = '1. Hộp xác nhận\n2. Trạng thái "Đã duyệt"';
    expect(ab.kiemKhuon(sua).join(' ')).toMatch(/BC-ST-001: trường `ky_vong` khác nguồn/);
    fs.writeFileSync(path.join(d, 'a.md'), A_MD.replace('2. Đồng ý', '2. Huỷ'));
    expect(ab.kiemKhuon(a).join(' ')).toMatch(/BC-ST-001: nguồn đã đổi/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('M1 chỉ đếm mã có trong DANH MỤC đã đăng ký; mã kit tự đặt báo riêng, không tính', () => {
    const d = dung();
    const b = ab.chuyen('B', path.join(d, 'b.md')).bo;
    fs.rmSync(d, { recursive: true, force: true });
    const k = ab.m1(b, { muc: [{ ma: 'INV-01' }, { ma: 'INV-02' }, { ma: 'INV-03' }] });
    expect([k.phu, k.tong]).toEqual([1, 3]);
    expect(k.chua_phu).toEqual(['INV-02', 'INV-03']);
    expect(k.ma_ngoai_danh_muc).toEqual(['BR-ZZ-009']);
  });
});

test.describe('@infra ab:doi-chung — đăng ký trước', () => {
  const dk = (d: string, extra: Record<string, unknown> = {}) => {
    fs.writeFileSync(path.join(d, 'spec.md'), 'đặc tả');
    fs.writeFileSync(path.join(d, 'dm.json'), JSON.stringify({ muc: [{ ma: 'INV-01' }] }));
    const t = (ma: string, loai: string) => ({ ma, loai, dau_vao: ['spec.md'], danh_muc: 'dm.json', cam: ['outputs/', 'knowledge/'] });
    return { tasks: [t('T1', 'validation'), t('T2', 'trang_thai_quyen'), t('T3', 'xuyen_module'), t('T0', 'doi_chung')], model: 'claude-opus-5-5', so_luot: 3, nguong: { m2_chenh: 0.2 }, duyet_boi: 'QA-Lead', ...extra };
  };

  test('thiếu từng mục ⇒ một lỗi riêng', () => {
    const d = thuMucTam('ab-dk');
    const ok = dk(d);
    expect(ab.kiemDangKy(ok, d)).toEqual([]);
    const loi = (x: any) => ab.kiemDangKy(x, d).join(' | ');
    expect(loi({ ...ok, tasks: ok.tasks.slice(1) })).toMatch(/cần ≥3 task thật/);
    expect(loi({ ...ok, tasks: ok.tasks.slice(0, 3) }), 'không có task đối chứng thì không phân biệt được kit với bộ chấm thiên vị').toMatch(/thiếu task đối chứng/);
    expect(loi({ ...ok, so_luot: 1 })).toMatch(/so_luot/);
    expect(loi({ ...ok, nguong: {} })).toMatch(/nguong/);
    expect(loi({ ...ok, tasks: [{ ...ok.tasks[0], cam: [] }, ...ok.tasks.slice(1)] })).toMatch(/thiếu `cam`/);
    expect(loi({ ...ok, tasks: [{ ...ok.tasks[0], dau_vao: ['khong-co.md'] }, ...ok.tasks.slice(1)] })).toMatch(/không có file đầu vào khong-co\.md/);
    fs.rmSync(d, { recursive: true, force: true });
  });

  test('CLI: khoá → kiểm khớp → đổi đầu vào sau khi khoá ⇒ mất giá trị; khoá lần hai bị từ chối', () => {
    const d = thuMucTam('ab-khoa');
    const f = path.join(d, 'dang-ky.json');
    fs.writeFileSync(f, JSON.stringify(dk(d)));
    try {
      expect(chay('--kiem-dang-ky', f).status, 'chưa khoá').toBe(2);
      expect(chay('--dang-ky', f).status).toBe(0);
      expect(chay('--dang-ky', f).status, 'đổi đăng ký là mở lượt mới, không khoá lại').toBe(1);
      expect(chay('--kiem-dang-ky', f).status).toBe(0);
      fs.writeFileSync(path.join(d, 'spec.md'), 'đặc tả đã sửa sau khi thấy kết quả');
      const r = chay('--kiem-dang-ky', f);
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(/spec\.md: đổi nội dung sau khi khoá/);
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });
});

test.describe('@infra ab:doi-chung — phiếu chấm mù M2', () => {
  const bugs = [{ ma: 'TASK-1', mo_ta: 'Mở khoá báo cáo Đã gửi bằng nút Mở khoá vẫn được' }, { ma: 'TASK-2', mo_ta: 'Gửi khi 1 biểu trống vẫn được' }];
  const hai = () => {
    const d = dung();
    const bos = { A: ab.chuyen('A', path.join(d, 'a.md')).bo, B: ab.chuyen('B', path.join(d, 'b.md')).bo };
    fs.rmSync(d, { recursive: true, force: true });
    return bos;
  };

  test('phiếu và phụ lục KHÔNG lộ kit: không tên kit, không mã case gốc; cùng seed ⇒ cùng nhãn', () => {
    const bos = hai();
    const p = ab.dungPhieuM2(bugs, bos, 5);
    const lo = [p.phieu, ...Object.values(p.phuLuc)].join('\n');
    for (const goc of ['BC-ST-001', 'BC-ST-002', 'X_TC_001']) expect(lo, `mã gốc ${goc} tự lộ kit`).not.toContain(goc);
    expect(lo).not.toMatch(/\bkit [AB]\b/);
    expect(Object.values(p.niemPhong.nhan).sort()).toEqual(['A', 'B']);
    expect(ab.dungPhieuM2(bugs, bos, 5).niemPhong).toEqual(p.niemPhong);
  });

  test('mô tả bug có số điện thoại hoặc email ⇒ TỪ CHỐI (CLAUDE.md §1)', () => {
    expect(ab.kiemBugs([{ ma: 'C-1', mo_ta: 'phụ huynh 0912345678 báo lỗi' }]).join(' ')).toMatch(/che PII/);
    expect(ab.kiemBugs([{ ma: 'C-1', mo_ta: 'gửi cho a.b@vd.vn' }]).join(' ')).toMatch(/che PII/);
    expect(ab.kiemBugs(bugs)).toEqual([]);
  });

  test('chấm: thiếu ô, mã không thuộc bộ, ghi mã mà không nói vì sao ⇒ chặn; đủ ⇒ recall theo kit, lộ tên kit lúc chấm', () => {
    const bos = hai();
    const { phieu, niemPhong } = ab.dungPhieuM2(bugs, bos, 5);
    const nhanA = Object.entries(niemPhong.nhan).find(([, k]) => k === 'A')![0];
    const nhanB = Object.entries(niemPhong.nhan).find(([, k]) => k === 'B')![0];
    const maA = Object.keys(niemPhong.ma).find((m) => m.startsWith(`${nhanA}-`) && niemPhong.ma[m] === 'BC-ST-002')!;
    const dien = (bat: Record<string, string>, viSao: Record<string, string> = {}) => phieu
      .replace(/^- nguoi_cham: $/m, '- nguoi_cham: Lê Văn C')
      .replace(/^bat\[([^\]]+)\]\[([A-Z])\]: $/gm, (_: string, b: string, n: string) => `bat[${b}][${n}]: ${bat[`${b}|${n}`] ?? ''}`)
      .replace(/^vi_sao\[([^\]]+)\]\[([A-Z])\]: $/gm, (_: string, b: string, n: string) => `vi_sao[${b}][${n}]: ${viSao[`${b}|${n}`] ?? ''}`);
    const du = { [`TASK-1|${nhanA}`]: maA, [`TASK-2|${nhanA}`]: 'khong_co', [`TASK-1|${nhanB}`]: 'khong_co', [`TASK-2|${nhanB}`]: 'khong_co' };

    expect(ab.chamM2(dien({ [`TASK-1|${nhanA}`]: maA }), niemPhong, bugs).loi.join(' ')).toMatch(/chưa chấm/);
    expect(ab.chamM2(dien({ ...du, [`TASK-1|${nhanA}`]: `${nhanB}-001` }), niemPhong, bugs).loi.join(' ')).toMatch(/không phải mã case của bộ/);
    expect(ab.chamM2(dien(du), niemPhong, bugs).loi.join(' '), 'ghi mã mà không nói vì sao là đoán').toMatch(/vi_sao phải nói/);
    const k = ab.chamM2(dien(du, { [`TASK-1|${nhanA}`]: 'bước 1 bấm Mở khoá, kỳ vọng giữ Đã gửi — đúng chỗ lỗi' }), niemPhong, bugs);
    expect(k.loi).toEqual([]);
    expect([k.theoKit.A.bat, k.theoKit.A.tong, k.theoKit.B.bat]).toEqual([1, 2, 0]);
    expect(k.theoKit.A.chi_tiet).toEqual([{ bug: 'TASK-1', ca: 'BC-ST-002' }]);
    expect(ab.chamM2(dien(du).replace(/bam_niem_phong: [0-9a-f]+/, 'bam_niem_phong: 0000000000000000'), niemPhong, bugs).loi.join(' ')).toMatch(/không khớp niem-phong/);
  });
});
