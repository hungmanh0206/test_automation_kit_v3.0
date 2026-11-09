/**
 * `tc:doi-chieu` — đối chiếu bộ case của kit với BỘ NGƯỜI VIẾT, ở mức FIELD.
 *
 * BỐI CẢNH. Chủ dự án nêu: *"chưa có phép đo đối chứng xem AI… phát hiện được bao nhiêu trường hợp
 * quan trọng bị bỏ sót"*. Đúng — nhưng KHÔNG phải vì thiếu ground truth: bộ **929 case do người viết**
 * có thật và đang nằm trên đĩa.
 *
 * HAI CÁCH KHỚP SAI, cả hai đã THỬ và BỊ BÁC bằng số đo:
 *   ① theo tên NHÓM — hai bộ chia nhóm TRỰC GIAO (khối field vs hành động), chỉ 2/12 tên trùng.
 *      Khớp kiểu này báo "10/12 nhóm không có case nào": báo động giả.
 *   ② theo TỔNG SỐ CASE — bộ người viết phủ 1 cấp, bộ kit phủ 5 cấp. "200 vs 223" không nói gì.
 *
 * Nên khớp ở mức FIELD. Và quy ước trỏ field `#N` là của RIÊNG vài sheet (đo: 72% · 21% · 2% · 0),
 * nên máy phải TỪ CHỐI PHÁN ở sheet không dùng nó — lượt đầu chưa có cửa đó và nó in "PHỦ FIELD
 * 1/24" cho sheet "Lớp", đủ để người ta không bao giờ tin công cụ này nữa.
 *
 * Spec này dựng workbook RIÊNG bằng `xlsx`, không neo vào file trên máy ai: file đó nằm NGOÀI repo
 * và không đi theo gói.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { gateEnv } from './_gate_env';

// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const XLSX = require('xlsx');

const REPO = path.resolve(__dirname, '..', '..', '..');
const CUA = path.join(REPO, 'scripts', 'qa', 'tc_doi_chieu.js');

type Ca = { id: string; module: string; ten: string; buoc: string };

/** Dựng một workbook có đúng khuôn của bộ hệ thống: tiêu đề ở hàng `ID_TC`. */
function workbook(sheet: string, ds: Ca[]): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'doichieu-'));
  const aoa: unknown[][] = [
    ['Tên màn hình/chức năng', '', sheet],
    ['Kết quả', 'Tổng số case'],
    ['Lần 1'],
    ['Mới nhất', ds.length],
    ['ID_TC', 'Module', 'Test Case Name', 'Preconditions', 'Test Data', 'Test Steps', 'Expected Result'],
    ...ds.map((c) => [c.id, c.module, c.ten, '', '', c.buoc, '']),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheet);
  const f = path.join(d, 'bo.xlsx');
  XLSX.writeFile(wb, f);
  return f;
}

/** Bộ case của kit: bảng Markdown canonical. */
function boKit(d: string, moduleVaTen: Array<[string, string]>): string {
  const f = path.join(d, 'bo_kit.md');
  const head = '| TC ID | Loại case | Tag | Module | Trường hợp kiểm thử |';
  const sep = '|---|---|---|---|---|';
  const rows = moduleVaTen.map(([m, t], i) => `| X_TC_${String(i + 1).padStart(3, '0')} | UI | [Positive] | ${m} | ${t} |`);
  fs.writeFileSync(f, [head, sep, ...rows].join('\n'), 'utf8');
  return f;
}

const chay = (xlsx: string, sheet: string, bo: string) => {
  const r = spawnSync(process.execPath, [CUA, '--sheet', sheet, '--bo', bo, '--xlsx', xlsx],
    { cwd: REPO, encoding: 'utf8', env: gateEnv() });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
};

/** 6 case đều trỏ `#N` ⇒ 100%, vượt ngưỡng 50% nên máy phán được. */
const dsDu = (): Ca[] => [
  { id: 'HST001', module: 'Định danh', ten: 'a', buoc: 'Đọc `#1 Tên trường`' },
  { id: 'HST002', module: 'Định danh', ten: 'b', buoc: 'Sửa `#2 Mã định danh`' },
  { id: 'HST003', module: 'Liên hệ', ten: 'c', buoc: 'Nhập `#11 Fax`' },
  { id: 'HST004', module: 'Liên hệ', ten: 'd', buoc: 'Nhập `#12 Email`' },
  { id: 'HST005', module: 'Khác', ten: 'e', buoc: 'Tích `#27 Có chi bộ Đảng`' },
  { id: 'HST006', module: 'Khác', ten: 'f', buoc: 'Tích `#38 Có Internet`' },
];

test.describe('@infra tc:doi-chieu — phủ field, và danh sách để NGƯỜI rà', () => {
  test('field bộ kit KHÔNG nhắc ⇒ nêu đích danh, kèm mã case tra ngược', () => {
    const x = workbook('S1', dsDu());
    const bo = boKit(path.dirname(x), [
      ['Xem', 'Đọc Tên trường và Mã định danh'],
      ['Cập nhật', 'Sửa Fax và Email'],
    ]);
    const r = chay(x, 'S1', bo);
    expect(r.code, r.out).toBe(0);
    expect(r.out, 'phải nêu TÊN field bị thiếu').toContain('Có chi bộ Đảng');
    expect(r.out, 'phải kèm mã case để tra ngược').toContain('HST005');
    expect(r.out, 'field kit CÓ nhắc thì không được liệt kê là thiếu').not.toMatch(/case\s+Tên trường/);
  });

  test('ĐỐI CHỨNG: bộ kit nhắc ĐỦ ⇒ 0 field thiếu', () => {
    /* Khác ca trên đúng một thứ: nội dung bộ kit. Nếu cả hai cùng ra danh sách thiếu thì máy không đo gì. */
    const x = workbook('S1', dsDu());
    const bo = boKit(path.dirname(x), [
      ['Xem', 'Tên trường · Mã định danh · Fax · Email'],
      ['Cập nhật', 'Có chi bộ Đảng · Có Internet'],
    ]);
    const r = chay(x, 'S1', bo);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/PHỦ FIELD: 6\/6/);
    expect(r.out).toMatch(/⚠ 0 field/);
  });

  test('LUÔN in giới hạn: "không nhắc" ≠ "không kiểm", và KHÔNG so tổng số case', () => {
    /*
     * Đây là phần dễ bị cắt đi nhất khi ai đó thấy output dài. Mất nó thì một DANH SÁCH ĐỂ RÀ bị đọc
     * thành một PHÁN QUYẾT — đúng lỗi mà cả đợt này đang đi sửa.
     */
    const x = workbook('S1', dsDu());
    const r = chay(x, 'S1', boKit(path.dirname(x), [['Xem', 'Tên trường']]));
    expect(r.out).toMatch(/≠ "kit KHÔNG KIỂM field đó"|≠ "kit KHÔNG KIỂM/);
    expect(r.out).toMatch(/KHÔNG so tổng số case/);
    expect(r.out).toMatch(/KHÔNG khớp theo tên NHÓM/);
  });
});

test.describe('@infra tc:doi-chieu — TỪ CHỐI PHÁN ở sheet không dùng quy ước `#N`', () => {
  test('dưới 50% case trỏ `#N` ⇒ KHÔNG PHÁN ĐƯỢC, nêu tỉ lệ đo được', () => {
    /*
     * Đo trên bộ thật: "Hồ sơ trường" 72% · "Lớp" 21% · "Đội ngũ" 2%. Lượt đầu chưa có cửa này và nó
     * in "PHỦ FIELD 1/24" cho sheet "Lớp" — 23 "field" kia là mảnh câu nhặt nhầm.
     */
    const it: Ca[] = [
      { id: 'HSL001', module: 'm', ten: 'a', buoc: 'Đọc `#1 Tên lớp`' },
      { id: 'HSL002', module: 'm', ten: 'b', buoc: 'Chọn khối rồi lưu' },
      { id: 'HSL003', module: 'm', ten: 'c', buoc: 'Mở màn danh sách' },
      { id: 'HSL004', module: 'm', ten: 'd', buoc: 'Bấm Ghi' },
    ];
    const x = workbook('S2', it);
    const r = chay(x, 'S2', boKit(path.dirname(x), [['Xem', 'Tên lớp']]));
    expect(r.code, 'không phán được thì KHÔNG được exit 0').toBe(2);
    expect(r.out).toMatch(/KHÔNG PHÁN ĐƯỢC/);
    expect(r.out, 'phải nêu tỉ lệ ĐO ĐƯỢC, không chỉ nói "không đủ"').toMatch(/25% case/);
    expect(r.out).toMatch(/BÁO ĐỘNG GIẢ/);
  });

  test('ĐỐI CHỨNG: cùng số case đó, đủ `#N` ⇒ phán được', () => {
    /* Khác ca trên đúng một thứ: bao nhiêu case trỏ `#N`. */
    const du: Ca[] = [
      { id: 'HSL001', module: 'm', ten: 'a', buoc: 'Đọc `#1 Tên lớp`' },
      { id: 'HSL002', module: 'm', ten: 'b', buoc: 'Đọc `#2 Khối`' },
      { id: 'HSL003', module: 'm', ten: 'c', buoc: 'Đọc `#3 Sĩ số`' },
      { id: 'HSL004', module: 'm', ten: 'd', buoc: 'Bấm Ghi' },
    ];
    const x = workbook('S2', du);
    const r = chay(x, 'S2', boKit(path.dirname(x), [['Xem', 'Tên lớp']]));
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/PHỦ FIELD: 1\/3/);
  });

  test('không có workbook ⇒ KHÔNG PHÁN ĐƯỢC — gói phát hành không chở nó', () => {
    const r = chay(path.join(os.tmpdir(), 'khong-he-co-file.xlsx'), 'S1', 'package.json');
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/KHÔNG PHÁN ĐƯỢC/);
    expect(r.out, 'phải nói rõ đây không phải "đạt"').toMatch(/KHÔNG phải là đạt/);
  });

  test('sai tên sheet ⇒ liệt kê sheet đang có, không chỉ báo lỗi cụt', () => {
    const x = workbook('S1', dsDu());
    const r = chay(x, 'KhongCoSheetNay', boKit(path.dirname(x), [['Xem', 'a']]));
    expect(r.code).toBe(2);
    expect(r.out).toContain('S1');
  });
});
