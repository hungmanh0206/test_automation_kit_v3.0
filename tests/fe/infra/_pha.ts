/*
 * _pha — khuôn chung cho PHÉP PHÁ, và nó làm "phép phá rỗng" thành thứ không viết nổi.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * VÌ SAO, và đây là số đo chứ không phải linh cảm.
 *
 * 49 file spec hạ tầng có phép phá, KHÔNG file nào dùng chung một khuôn — mỗi chỗ tự viết lại. Hệ quả
 * đo được, chỉ trong một phiên (09/11/2026):
 *
 *   · `S1` và lô `case_types` — phép biến đổi khớp nhầm chỗ, file KHÔNG đổi, cửa vẫn xanh, và tôi suýt
 *     ghi "đã nghiệm thu" cho một phép phá chưa từng chạm vào gì.
 *   · phép phá "skill MỒ CÔI" — ghim cứng hai file đường nối; khi có chỗ nhắc thứ ba thì gỡ hai file kia
 *     xong cửa VẪN exit 0. Phép phá tự vô hiệu mà vẫn xanh.
 *   · nhánh đối chứng của phép A/B — cầm sẵn đáp án trong `templates/` của chính skill.
 *
 * Bốn lần, cùng một hình: **một phép kiểm RỖNG thì tệ hơn không có phép kiểm**, vì nó xanh và người đọc
 * yên tâm.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * NĂM ĐIỀU KIỆN, THIẾU MỘT LÀ NÉM.
 *
 *   1. Trước khi phá, cửa phải XANH. Cửa đã đỏ sẵn thì cái đỏ sau đó không chứng minh gì.
 *   2. Phép biến đổi phải THẬT SỰ đổi mục tiêu (so byte trước/sau).
 *   3. Sau khi phá, cửa phải ĐỎ.
 *   4. Hoàn lại phải ĐÚNG TỪNG BYTE.
 *   5. Sau khi hoàn lại, cửa phải XANH trở lại.
 *
 * Điều 4 là bài học riêng: một phép phá hoàn lại không đúng byte đã làm `full:suite` từ chối phán
 * (`skills_index --write` ghi LF vào 29 file CRLF).
 */
import { expect } from '@playwright/test';
import * as fs from 'fs';

export type KetCua = { code: number | null; out: string };

export type DonPha = {
  /** Mô tả ngắn, đi vào mọi thông điệp lỗi. */
  moTa: string;
  /** Đường dẫn TUYỆT ĐỐI của các file sẽ bị đổi. Dùng để so byte và hoàn lại. */
  tep: string[];
  /** Biến đổi nội dung. Nhận nội dung gốc theo thứ tự `tep`, trả nội dung mới. */
  doi: (goc: Buffer[]) => Buffer[];
  /** Chạy cửa, trả mã thoát. Gọi 3 lần: trước khi phá, sau khi phá, sau khi hoàn lại. */
  chayCua: () => KetCua;
  /** Mẫu bắt buộc có trong stdout lúc cửa ĐỎ — để chắc nó đỏ vì ĐÚNG lý do. */
  doVi?: RegExp;
};

/**
 * Chạy một phép phá đủ năm điều kiện. Ném với thông điệp nói rõ điều kiện nào trượt.
 */
export function pha(d: DonPha): void {
  const goc = d.tep.map((f) => {
    if (!fs.existsSync(f)) throw new Error(`[pha:${d.moTa}] mục tiêu không tồn tại: ${f}`);
    return fs.readFileSync(f);
  });

  /*
   * Sau MỖI lượt chạy cửa, mục tiêu phải còn đúng như ta để lại. Thiếu phép kiểm này thì một cửa CÓ
   * TÁC DỤNG PHỤ lên chính file đang đo sẽ đi lọt — và phép phá hoàn lại từ bản gốc sẽ XOÁ SẠCH dấu
   * vết ấy. Đúng lớp lỗi  ghi LF vào 29 file CRLF rồi làm  từ chối phán.
   */
  const conNguyen = (mong, khi) => {
    d.tep.forEach((f, k) => {
      expect(fs.readFileSync(f).equals(mong[k]),
        `[pha:${d.moTa}] CỬA CÓ TÁC DỤNG PHỤ — nó ghi lên ${f} khi chạy (${khi}). `
        + 'Mọi kết luận sau đó vô nghĩa: cửa đang đo một cây do chính nó vừa sửa.')
        .toBe(true);
    });
  };

  // ① cửa phải XANH trước khi phá
  const truoc = d.chayCua();
  conNguyen(goc, 'lượt trước khi phá');
  expect(truoc.code,
    `[pha:${d.moTa}] ĐIỀU KIỆN 1 — cửa đã ĐỎ TRƯỚC khi phá, nên cái đỏ sau đó không chứng minh gì.\n${truoc.out}`)
    .toBe(0);

  let daGhi = false;
  try {
    // ② phép biến đổi phải THẬT SỰ đổi
    const moi = d.doi(goc.map((b) => Buffer.from(b)));
    expect(moi.length, `[pha:${d.moTa}] \`doi\` phải trả đúng ${d.tep.length} nội dung`).toBe(d.tep.length);
    const doiThat = moi.map((b, i) => !b.equals(goc[i]));
    expect(doiThat.some(Boolean),
      `[pha:${d.moTa}] ĐIỀU KIỆN 2 — PHÉP PHÁ RỖNG: không file nào đổi byte. `
      + 'Mẫu khớp nhầm chỗ, hoặc chuỗi cần thay đã không còn trong file.')
      .toBe(true);

    d.tep.forEach((f, i) => fs.writeFileSync(f, moi[i]));
    daGhi = true;

    // ③ cửa phải ĐỎ, và đỏ vì ĐÚNG lý do
    const sau = d.chayCua();
    conNguyen(moi, 'lượt sau khi phá');
    expect(sau.code,
      `[pha:${d.moTa}] ĐIỀU KIỆN 3 — phá rồi mà cửa VẪN XANH ⇒ cửa không gác thứ nó tự nhận là gác.\n${sau.out}`)
      .not.toBe(0);
    if (d.doVi) {
      expect(sau.out,
        `[pha:${d.moTa}] cửa đỏ nhưng KHÔNG vì lý do mong đợi — đỏ vì một chuyện khác thì phép phá này vẫn rỗng`)
        .toMatch(d.doVi);
    }
  } finally {
    if (daGhi) d.tep.forEach((f, i) => fs.writeFileSync(f, goc[i]));
  }

  // ④ hoàn lại phải ĐÚNG TỪNG BYTE
  d.tep.forEach((f, i) => {
    expect(fs.readFileSync(f).equals(goc[i]),
      `[pha:${d.moTa}] ĐIỀU KIỆN 4 — hoàn lại KHÔNG đúng từng byte: ${f}. `
      + 'Một phép phá làm bẩn file đã track rồi không hoàn nguyên đúng byte đã làm `full:suite` từ chối phán.')
      .toBe(true);
  });

  // ⑤ cửa phải XANH trở lại
  const lai = d.chayCua();
  conNguyen(goc, 'lượt sau khi hoàn lại');
  expect(lai.code,
    `[pha:${d.moTa}] ĐIỀU KIỆN 5 — hoàn lại rồi mà cửa vẫn ĐỎ ⇒ phép phá để lại dấu vết.\n${lai.out}`)
    .toBe(0);
}

/**
 * Phép biến đổi thay chuỗi, có sẵn phép gác "không khớp thì ném".
 *
 * Bọc riêng vì lỗi khớp-nhầm-chỗ là nguyên nhân của hai phép phá rỗng đã gặp: `s.replace(a, b)` khi `a`
 * không còn trong file trả về NGUYÊN BẢN, im lặng, và phép phá thành không làm gì.
 */
export function thayChuoi(tim: string, thanh: string) {
  return (goc: Buffer[]): Buffer[] => goc.map((b) => {
    const s = b.toString('utf8');
    if (!s.includes(tim)) throw new Error(`[pha] không tìm thấy chuỗi cần thay: ${JSON.stringify(tim.slice(0, 60))}`);
    return Buffer.from(s.split(tim).join(thanh), 'utf8');
  });
}
