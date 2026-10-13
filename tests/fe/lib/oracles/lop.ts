import { dangKy, tinh } from './index';

/*
 * Oracle miền HỒ SƠ LỚP HỌC.
 *
 * Ngưỡng dưới đây chép NGUYÊN VĂN từ `BR-HSLOP-035` trong `knowledge/domain`, vốn dẫn lại Điều lệ nhà
 * trường: TT28/2020 Đ16.1 (tiểu học) và TT52/2020 Đ15 (mầm non). Không làm tròn, không "khoảng chừng".
 */

export type Cap = 'MN' | 'TH' | 'THCS' | 'THPT' | 'GDTX';
export type LoaiLop = 'thuong' | 'ghep';
/** Nhóm tuổi mầm non, đúng cách rule chia. */
export type NhomTuoiMN = '3-12thang' | '13-24thang' | '25-36thang' | '3-4tuoi' | '4-5tuoi' | '5-6tuoi';

const MN_THUONG: Record<NhomTuoiMN, number> = {
  '3-12thang': 15,
  '13-24thang': 20,
  '25-36thang': 25,
  '3-4tuoi': 25,
  '4-5tuoi': 30,
  '5-6tuoi': 35,
};

/**
 * BR-HSLOP-035 — ngưỡng sĩ số tối đa theo cấp và loại lớp.
 *
 * ⚠️ RULE KHÔNG PHỦ THCS/THPT/GDTX. Nó chỉ dẫn TT28 (tiểu học) và TT52 (mầm non). Oracle vì thế NÉM cho
 * ba cấp kia thay vì suy ra một con số — "chưa có neo" phải thành *không phán được*, không được thành một
 * ngưỡng trông hợp lý. Đây đúng là chỗ một oracle dễ bịa nhất: 45 hay 50 nghe rất thuận tai.
 *
 * Mầm non lớp ghép: rule chia hai mức — NHÓM TRẺ ghép tối đa 20, LỚP MẪU GIÁO ghép tối đa 30. "Nhóm trẻ"
 * là ba nhóm tháng tuổi, "mẫu giáo" là ba nhóm tuổi.
 */
export const nguongSiSo = dangKy<{ cap: Cap; loai: LoaiLop; nhomTuoi?: NhomTuoiMN }, number>({
  oracle_ref: 'BR-HSLOP-035',
  ten: 'ngưỡng sĩ số tối đa của một lớp',
  doi: ['cap', 'loai'],
  tinh: ({ cap, loai, nhomTuoi }) => {
    if (cap === 'TH') return loai === 'ghep' ? 15 : 35;
    if (cap === 'MN') {
      if (!nhomTuoi) throw new Error('cấp MN phải có `nhomTuoi` — ngưỡng mầm non chia theo nhóm tuổi, không có một mức chung');
      if (loai === 'ghep') return nhomTuoi.endsWith('thang') ? 20 : 30;
      return MN_THUONG[nhomTuoi];
    }
    throw new Error(
      `BR-HSLOP-035 KHÔNG quy định ngưỡng cho cấp ${cap} (rule chỉ dẫn TT28/2020 cho TH và TT52/2020 cho MN). `
      + 'Chưa có neo ⇒ không phán được. Muốn đo cấp này thì bổ sung rule vào knowledge/domain trước.',
    );
  },
  dung: [
    { input: { cap: 'TH', loai: 'thuong' }, ky_vong: 35, ghi_chu: 'TT28/2020 Đ16.1' },
    { input: { cap: 'TH', loai: 'ghep' }, ky_vong: 15, ghi_chu: 'TT28/2020 Đ16.1 — lớp ghép' },
    { input: { cap: 'MN', loai: 'thuong', nhomTuoi: '5-6tuoi' }, ky_vong: 35, ghi_chu: 'TT52/2020 Đ15' },
    { input: { cap: 'MN', loai: 'thuong', nhomTuoi: '3-12thang' }, ky_vong: 15, ghi_chu: 'nhóm trẻ nhỏ nhất' },
    { input: { cap: 'MN', loai: 'ghep', nhomTuoi: '25-36thang' }, ky_vong: 20, ghi_chu: 'NHÓM TRẺ ghép' },
    { input: { cap: 'MN', loai: 'ghep', nhomTuoi: '4-5tuoi' }, ky_vong: 30, ghi_chu: 'LỚP MẪU GIÁO ghép' },
  ],
  lech: [
    {
      input: { cap: 'TH', loai: 'ghep' },
      app_tra: 20,
      vi_sao: 'ví dụ trong chính rule: "Cap Tieu hoc: lop ghep co 20 hoc sinh ⇒ vuot nguong — TT28 D16.1 cho toi da 15"',
    },
    {
      input: { cap: 'MN', loai: 'ghep', nhomTuoi: '4-5tuoi' },
      app_tra: 35,
      vi_sao: 'ví dụ trong chính rule: "Cap Mam non: lop mau giao ghep co 35 tre ⇒ vuot nguong — TT52 D15.2 cho toi da 30"',
    },
    {
      input: { cap: 'MN', loai: 'ghep', nhomTuoi: '25-36thang' },
      app_tra: 30,
      vi_sao: 'lẫn mức LỚP MẪU GIÁO ghép (30) sang NHÓM TRẺ ghép (20) — hai mức khác nhau trong cùng một câu của rule',
    },
  ],
});

/** Tiện dụng cho spec/case. */
export function tinhNguongSiSo(d: { cap: Cap; loai: LoaiLop; nhomTuoi?: NhomTuoiMN }): number {
  return tinh(nguongSiSo, d);
}
