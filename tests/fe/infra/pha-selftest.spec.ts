/*
 * `_pha` — ĐỐI CHỨNG CHO CHÍNH ĐỐI CHỨNG.
 *
 * Helper này sinh ra để làm "phép phá rỗng" thành thứ không viết nổi. Nhưng một helper như vậy mà chưa
 * bao giờ NÉM thì nó cũng chỉ là một phép phá rỗng cỡ lớn hơn. Nên mỗi ca dưới đây dựng đúng MỘT kiểu
 * hỏng và đòi helper ném, kèm nói rõ điều kiện nào trượt.
 *
 * Dùng cửa GIẢ (một hàm trong test) chứ không dùng cửa thật: ở đây đang đo HELPER, không đo cửa nào cả.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pha, thayChuoi, type KetCua } from './_pha';

function cayTam(noi: string): { d: string; f: string } {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pha-self-'));
  const f = path.join(d, 'muc-tieu.txt');
  fs.writeFileSync(f, noi, 'utf8');
  return { d, f };
}

/** Cửa giả: ĐỎ khi file chứa `dauHieu`. */
const cuaTheo = (f: string, dauHieu: string) => (): KetCua => {
  const s = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  return s.includes(dauHieu)
    ? { code: 1, out: `CHẶN — thấy ${dauHieu}` }
    : { code: 0, out: 'ĐẠT' };
};

test.describe('@infra _pha — năm điều kiện, thiếu một là NÉM', () => {
  test('đường thuận: đủ năm điều kiện thì KHÔNG ném, và file nguyên vẹn', () => {
    const { d, f } = cayTam('dong mot\nLUAT SONG\ndong ba\n');
    try {
      const goc = fs.readFileSync(f);
      pha({
        moTa: 'gỡ một luật',
        tep: [f],
        doi: thayChuoi('LUAT SONG', 'LUAT DA GO'),
        chayCua: cuaTheo(f, 'LUAT DA GO'),
        doVi: /LUAT DA GO/,
      });
      expect(fs.readFileSync(f).equals(goc), 'file phải nguyên như trước').toBe(true);
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('ĐIỀU KIỆN 1 — cửa ĐÃ ĐỎ sẵn thì ném, vì cái đỏ sau đó không chứng minh gì', () => {
    const { d, f } = cayTam('co SAN LOI roi\n');
    try {
      let nem: Error | null = null;
      try {
        pha({
          moTa: 'cửa đỏ sẵn',
          tep: [f],
          doi: thayChuoi('co SAN', 'da doi'),
          chayCua: cuaTheo(f, 'LOI'),   // đỏ ngay từ đầu
        });
      } catch (e) { nem = e as Error; }
      expect(nem, 'phải ném').not.toBeNull();
      expect(nem!.message).toMatch(/ĐIỀU KIỆN 1/);
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('ĐIỀU KIỆN 2 — phép biến đổi KHÔNG đổi byte nào thì ném (đây là lỗi đã gặp 2 lần)', () => {
    const { d, f } = cayTam('noi dung khong he chua chuoi can thay\n');
    try {
      let nem: Error | null = null;
      try {
        pha({
          moTa: 'mẫu khớp nhầm chỗ',
          tep: [f],
          /* KHÔNG dùng `thayChuoi` — dựng lại đúng lỗi cũ: `replace` không khớp thì trả nguyên bản, im lặng. */
          doi: (goc) => goc.map((b) => Buffer.from(b.toString('utf8').replace('CHUOI-KHONG-CO', 'x'), 'utf8')),
          chayCua: cuaTheo(f, 'x-khong-bao-gio-co'),
        });
      } catch (e) { nem = e as Error; }
      expect(nem, 'phải ném').not.toBeNull();
      expect(nem!.message).toMatch(/ĐIỀU KIỆN 2|PHÉP PHÁ RỖNG/);
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('ĐIỀU KIỆN 3 — phá rồi mà cửa vẫn XANH thì ném (cửa không gác thứ nó tự nhận)', () => {
    const { d, f } = cayTam('LUAT SONG\n');
    try {
      let nem: Error | null = null;
      try {
        pha({
          moTa: 'cửa không gác gì',
          tep: [f],
          doi: thayChuoi('LUAT SONG', 'LUAT DA GO'),
          chayCua: () => ({ code: 0, out: 'luôn xanh' }),   // cửa mù
        });
      } catch (e) { nem = e as Error; }
      expect(nem, 'phải ném').not.toBeNull();
      expect(nem!.message).toMatch(/ĐIỀU KIỆN 3/);
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('CỬA CÓ TÁC DỤNG PHỤ lên chính file đang đo thì helper phải NÉM ngay', () => {
    /*
     * Dựng lại đúng lỗi `skills_index --write`: cửa có TÁC DỤNG PHỤ lên chính file đang đo, nên sau khi
     * hoàn lại thì nội dung khác byte. Helper hoàn lại ở `finally`, nên lượt `chayCua` CUỐI (điều kiện 5)
     * mới là chỗ cửa kịp ghi đè — bắt được ở điều kiện 4 của lượt sau hoặc điều kiện 5 ngay đây.
     */
    const { d, f } = cayTam('LUAT SONG\n');
    try {
      let nem: Error | null = null;
      try {
        pha({
          moTa: 'cửa có tác dụng phụ',
          tep: [f],
          doi: thayChuoi('LUAT SONG', 'LUAT DA GO'),
          chayCua: () => {
            const s = fs.readFileSync(f, 'utf8');
            fs.writeFileSync(f, `${s}\n// cua tu ghi them\n`, 'utf8');   // tác dụng phụ
            return s.includes('LUAT DA GO') ? { code: 1, out: 'CHẶN' } : { code: 0, out: 'ĐẠT' };
          },
        });
      } catch (e) { nem = e as Error; }
      expect(nem, 'phải ném — một cửa ghi đè file đang đo thì mọi kết luận sau đó vô nghĩa').not.toBeNull();
      expect(nem!.message, 'chẩn đoán phải GỌI TÊN tác dụng phụ, không chỉ nói hoàn-lại-sai-byte').toMatch(/TÁC DỤNG PHỤ/);
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  test('`thayChuoi` ném ngay khi không tìm thấy chuỗi — không im lặng trả nguyên bản', () => {
    const goc = [Buffer.from('abc', 'utf8')];
    expect(() => thayChuoi('KHONG-CO', 'x')(goc)).toThrow(/không tìm thấy chuỗi/);
  });
});
