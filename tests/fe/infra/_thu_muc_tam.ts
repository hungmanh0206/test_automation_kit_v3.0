import * as fs from 'fs';
import * as path from 'path';

/*
 * THƯ MỤC TẠM cho spec của v2.8.0 — MỘT NGUỒN.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * VÌ SAO KHÔNG DÙNG `os.tmpdir()`, và vì sao phải TỰ TẠO thư mục gốc.
 *
 * Nhiều spec của đợt này sinh ra file có `import` TƯƠNG ĐỐI trỏ về `tests/fe/lib/**` (spec biên dịch,
 * smoke). Trên Windows, `path.relative` giữa HAI Ổ ĐĨA trả về đường TUYỆT ĐỐI, nên nếu thư mục tạm nằm
 * ở `C:\Users\...\Temp` còn repo ở `D:\`, import sinh ra thành `from './D:/Project/...'` — file trông
 * bình thường và chỉ vỡ lúc Playwright nạp, với thông báo lạc hướng về module không tìm thấy. Vì thế
 * thư mục tạm phải nằm **trong repo**.
 *
 * NHƯNG `outputs/` BỊ `.gitignore`, NÊN NÓ KHÔNG CÓ TRONG GÓI PHÁT HÀNH.
 *
 * Đo 12/10/2026 bằng `npm run release:verify`: gói `kit-2.8.0.tar.gz` có **0 file** dưới `outputs/`, và
 * `fs.mkdtempSync(path.join(REPO, 'outputs', '_scratch', 'x-'))` ném `ENOENT` ⇒ **69 test ĐỎ trong gói**
 * trong khi cả 5 spec đó xanh ở repo. Đây đúng loại lỗi mà `release:verify` sinh ra để bắt: chạy bộ test
 * trên cây làm việc KHÔNG trả lời được câu "bản sẽ phát hành có chạy không".
 *
 * Nên helper này `mkdirSync(..., { recursive: true })` cho thư mục gốc TRƯỚC khi `mkdtemp`. Năm bản sao
 * của cùng một dòng `mkdtempSync` là năm chỗ phải sửa lần sau — đợt này đã trả giá năm lần cho chuyện
 * hai bản sao trôi khỏi nhau, nên gom về đây.
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 */

const REPO = path.resolve(__dirname, '..', '..', '..');

/** Thư mục gốc chứa mọi thư mục tạm của spec. Trong repo, cùng ổ đĩa — xem khối chú thích trên. */
export const GOC_TAM = path.join(REPO, 'outputs', '_scratch');

/**
 * Tạo một thư mục tạm, và TỰ TẠO thư mục gốc nếu chưa có.
 *
 * `tien_to` chỉ để người đọc log nhận ra thư mục của test nào — nó không ảnh hưởng hành vi.
 */
export function thuMucTam(tienTo: string): string {
  fs.mkdirSync(GOC_TAM, { recursive: true });
  return fs.mkdtempSync(path.join(GOC_TAM, `${tienTo}-`));
}

/** Dọn thư mục tạm. Không ném khi đã bị xoá — dọn hai lần là chuyện bình thường ở `afterAll`. */
export function donThuMucTam(duong: string): void {
  fs.rmSync(duong, { recursive: true, force: true });
}
