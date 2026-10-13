import { dangKy, tinh } from './index';

/*
 * Oracle miền HỒ SƠ TRƯỜNG.
 *
 * Mỗi oracle ở đây tính kỳ vọng TỪ ĐẶC TẢ. Không hàm nào trong file này được đọc giá trị của app —
 * `oracle:calc` canh theo cấu trúc, và `oracle-calc.spec.ts` canh theo hành vi.
 */

export type OTong = { quanLy: number; giangDay: number; hocTap: number; nhanVienIT: number };

/**
 * BR-HSTRUONG-010 — bốn ô tổng là ô CHỈ ĐỌC, hệ thống tự cộng từ các ô chi tiết bên dưới.
 *
 * Ví dụ trong rule: "Máy để bàn=10, Máy xách tay=5, Máy tính bảng=3, Điện thoại=2 ở nhóm quản lý"
 * ⇒ ô Số lượng máy tính cho quản lý hiển thị **20**.
 *
 * Ca LỆCH lấy từ chính lớp bug mà ô chỉ-đọc hay dính: app giữ lại giá trị người dùng từng nhập tay trước
 * khi ô bị khoá, nên tổng hiển thị KHÔNG bằng tổng các ô chi tiết. Oracle phải trả tổng thật, khác hẳn
 * con số app giữ.
 */
export const tongThietBi = dangKy<{ chiTiet: number[] }, number>({
  oracle_ref: 'BR-HSTRUONG-010',
  ten: 'tổng thiết bị của một nhóm (ô chỉ đọc)',
  doi: ['chiTiet'],
  tinh: ({ chiTiet }) => {
    /*
     * Cộng THẲNG, không bỏ qua ô trống. Một ô chi tiết `undefined` nghĩa là chưa đọc được, và cộng nó
     * thành 0 sẽ ra một tổng nhỏ hơn thật mà trông vẫn hợp lệ — đúng kiểu sai im lặng mà cả kit đang
     * chống. Ô chưa đọc được ⇒ ném, để case thành "không phán được" chứ không thành PASS.
     */
    chiTiet.forEach((v, i) => {
      if (typeof v !== 'number' || Number.isNaN(v)) {
        throw new Error(`ô chi tiết thứ ${i + 1} không đọc được số (${JSON.stringify(v)}) — tổng chưa tính được`);
      }
    });
    return chiTiet.reduce((a, b) => a + b, 0);
  },
  dung: [
    { input: { chiTiet: [10, 5, 3, 2] }, ky_vong: 20, ghi_chu: 'nguyên ví dụ trong BR-HSTRUONG-010' },
    { input: { chiTiet: [0, 0, 0, 0] }, ky_vong: 0, ghi_chu: 'tổng 0 là kỳ vọng THẬT, không phải "chưa có dữ liệu"' },
  ],
  lech: [
    {
      input: { chiTiet: [10, 5, 3, 2] },
      app_tra: 18,
      vi_sao: 'ô tổng giữ lại giá trị nhập tay cũ thay vì cộng lại từ các ô chi tiết — lớp bug của ô chỉ-đọc',
    },
  ],
});

/** Tiện dụng cho spec: tổng của một nhóm thiết bị. */
export function tinhTongThietBi(chiTiet: number[]): number {
  return tinh(tongThietBi, { chiTiet });
}
